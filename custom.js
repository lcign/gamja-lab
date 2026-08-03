/* gamja: theme colors + text zoom (CSSOM) + command history ↑/↓ + /list dialog + buffer search.
   LEAN build: no WebSocket wrapper, no document-wide MutationObserver, no logger.
   The /list dialog reads its data from the `gamja-list` event emitted by a minimal hook
   in the bundle (which collects the 321/322/323 numerics). CSP-safe: nothing inline. */

/* ===================== theme colors + zoom ===================== */
(function () {
	/* 📌 is an emoji, drawn by a color font, so `color` does not touch it. The only way to recolor
	   it without replacing the glyph is a CSS filter derived from the chosen color -> the hue
	   follows the picker but does NOT match it exactly (known limitation, accepted). */
	var PIN_DEFAULT = '#e0342b';   // the emoji's dominant red: at this value the filter is none
	function hueSat(hex) {
		var m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
		if (!m) return null;
		var r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
		var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
		if (d) {
			if (mx === r) h = 60 * (((g - b) / d) % 6);
			else if (mx === g) h = 60 * ((b - r) / d + 2);
			else h = 60 * ((r - g) / d + 4);
			if (h < 0) h += 360;
		}
		var l = (mx + mn) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
		return { h: h, s: s, l: l };
	}
	function updatePin() {
		var base = hueSat(PIN_DEFAULT), cur = hueSat((load() || {})['--pin-color'] || PIN_DEFAULT);
		if (!base || !cur) return;
		var dh = Math.round(cur.h - base.h);
		var sat = Math.round((base.s ? cur.s / base.s : 1) * 100) / 100;
		root.style.setProperty('--pin-filter',
			'hue-rotate(' + dh + 'deg) saturate(' + sat + ') brightness(' + (0.7 + cur.l * 0.6).toFixed(2) + ')');
	}

	var GL = 'Channel list (left)', GR = 'Member list (right)', GM = 'Messages', GO = 'Other';
	/* Fourth field = group, rendered as a heading in the panel. Order matters, and the groups follow
	   WHERE the color shows up rather than what the variable is called: that was the flaw of the
	   flat list, where "Side panels" and "Channel list background" looked like the same thing.
	   ⚠️ VARS order must match the controls in the DOM: Reset realigns them by index. */
	var VARS = [
		['Background',              '--bl-background',      '#131618',   GL],
		['Text',                    '--bl-color',           '#f8f9fa',   GL],
		['Active channel back.',    '--bl-active-bg',       '#ffffff',   GL],
		['Active channel text',     '--bl-active-color',    '#131618',   GL],
		['Channel activity',        '--activity-color',     '#d9a441',   GL],
		['Mention text',            '--highlight-color',    '#ffe08a',   GL],
		['Mention background',      '--highlight-bg',       '#463a10',   GL],
		['Pin 📌',                  '--pin-color',          PIN_DEFAULT, GL],

		['Background',              '--sidebar-background', '#131618',   GR],
		['Operators, online',       '--green',              '#53b266',   GR],

		['Background',              '--main-background',    '#212529',   GM],
		['Text',                    '--main-color',         '#f8f9fa',   GM],
		['Links',                   '--link-color',         '#53b266',   GM],
		['Timestamp',               '--timestamp-color',    '#979797',   GM],

		['Buttons',                 '--button-background',  '#282879',   GO],
		['Alert (errors, offline)', '--red',                '#fb615b',   GO]
	];
	var KEY = 'gamja_theme';
	var root = document.documentElement;
	var backdrop = null, panel = null;

	function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
	function save(o) { localStorage.setItem(KEY, JSON.stringify(o)); }
	function apply(o) { VARS.forEach(function (v) { if (o[v[1]]) root.style.setProperty(v[1], o[v[1]]); }); }

	var saved = load();
	apply(saved);
	updatePin();

	var FSKEY = 'gamja_fs';
	function fsClamp(x) { x = Math.round((x || 1) * 20) / 20; return x < 0.3 ? 0.3 : (x > 1.8 ? 1.8 : x); }
	var fs = fsClamp(parseFloat(localStorage.getItem(FSKEY)) || 1);
	function fsApply() { root.style.setProperty('--fs', String(fs)); }
	fsApply();

	var RKEY = 'gamja_list_rows', ROWS_DEF = 2000, ROWS_MIN = 100, ROWS_MAX = 50000, ROWS_WARN = 5000;
	function getRows() { var v = parseInt(localStorage.getItem(RKEY), 10); return v > 0 ? v : ROWS_DEF; }
	function setRows(x) {
		var v = parseInt(x, 10); if (!(v > 0)) v = ROWS_DEF;
		v = v < ROWS_MIN ? ROWS_MIN : (v > ROWS_MAX ? ROWS_MAX : v);
		localStorage.setItem(RKEY, String(v));
		return v;
	}

	function buildPanel() {
		if (backdrop) return backdrop;
		backdrop = document.createElement('div');
		backdrop.id = 'themeBackdrop'; backdrop.className = 'hidden';
		panel = document.createElement('div');
		panel.id = 'themePanel';
		var head = document.createElement('div'); head.className = 'tp-head';
		var h = document.createElement('div'); h.className = 'tp-h'; h.textContent = 'Extra';
		var close = document.createElement('button'); close.type = 'button'; close.className = 'tp-close'; close.textContent = '✕'; close.title = 'Close';
		head.appendChild(h); head.appendChild(close); panel.appendChild(head);
		close.addEventListener('click', hide);

		/* Two tabs, Options and Colors: with seven settings plus fourteen colors the panel had grown
		   taller than most windows. Each pane is its own 2-column grid, so the colors keep their
		   layout; which tab was last open is remembered. */
		var TKEY = 'gamja_extra_tab';
		var tabs = document.createElement('div'); tabs.className = 'tp-tabs';
		var paneOpt = document.createElement('div'); paneOpt.className = 'tp-pane';
		var paneCol = document.createElement('div'); paneCol.className = 'tp-pane';
		var tabOpt = document.createElement('button'); tabOpt.type = 'button'; tabOpt.textContent = 'Options';
		var tabCol = document.createElement('button'); tabCol.type = 'button'; tabCol.textContent = 'Colors';
		function showTab(which) {
			var col = which === 'col';
			paneOpt.classList.toggle('hidden', col);
			paneCol.classList.toggle('hidden', !col);
			tabOpt.classList.toggle('active', !col);
			tabCol.classList.toggle('active', col);
			try { localStorage.setItem(TKEY, col ? 'col' : 'opt'); } catch (e) {}
		}
		tabOpt.addEventListener('click', function () { showTab('opt'); });
		tabCol.addEventListener('click', function () { showTab('col'); });
		tabs.appendChild(tabOpt); tabs.appendChild(tabCol);
		panel.appendChild(tabs); panel.appendChild(paneOpt); panel.appendChild(paneCol);
		var zrow = document.createElement('div'); zrow.className = 'tp-zoom';
		var zlab = document.createElement('span'); zlab.textContent = 'Text size';
		var zminus = document.createElement('button'); zminus.type = 'button'; zminus.className = 'tp-zbtn'; zminus.textContent = 'A−'; zminus.title = 'Smaller text';
		var znum = document.createElement('span'); znum.className = 'tp-znum';
		var zplus = document.createElement('button'); zplus.type = 'button'; zplus.className = 'tp-zbtn'; zplus.textContent = 'A+'; zplus.title = 'Larger text';
		function zshow() { znum.textContent = Math.round(fs * 100) + '%'; }
		function zset(x) { fs = fsClamp(x); fsApply(); localStorage.setItem(FSKEY, String(fs)); zshow(); }
		zminus.addEventListener('click', function () { zset(fs - 0.05); });
		zplus.addEventListener('click', function () { zset(fs + 0.05); });
		zshow();
		zrow.appendChild(zlab); zrow.appendChild(zminus); zrow.appendChild(znum); zrow.appendChild(zplus);
		paneOpt.appendChild(zrow);

		// row cap for the /list dialog: read there on every render (localStorage gamja_list_rows)
		var lrow = document.createElement('div'); lrow.className = 'tp-zoom';
		var llab = document.createElement('span'); llab.textContent = 'Max rows in /list';
		var linp = document.createElement('input'); linp.type = 'number'; linp.className = 'tp-num';
		linp.min = String(ROWS_MIN); linp.max = String(ROWS_MAX); linp.step = '100'; linp.value = String(getRows());
		var lwarn = document.createElement('div'); lwarn.className = 'tp-warn';
		lwarn.textContent = '⚠ Above ~' + ROWS_WARN + ' rows the /list dialog can slow the browser down badly on large networks.';
		function lshow() { lwarn.classList.toggle('hot', getRows() > ROWS_WARN); }
		linp.addEventListener('change', function () { linp.value = String(setRows(linp.value)); lshow(); });
		linp.addEventListener('input', lshow);
		lshow();
		lrow.appendChild(llab); lrow.appendChild(linp);
		paneOpt.appendChild(lrow); paneOpt.appendChild(lwarn);

		// Hook for blocks living outside this closure: they append their own rows here, right
		// before the colors. If nobody listens, nothing happens.
		document.dispatchEvent(new CustomEvent('gamja-extra-panel', { detail: { panel: paneOpt } }));

		var lastGroup = null;
		VARS.forEach(function (v) {
			if (v[3] !== lastGroup) {          // intestazione di gruppo, a riga intera nella griglia
				lastGroup = v[3];
				var sec = document.createElement('div');
				sec.className = 'tp-sec'; sec.textContent = v[3];
				paneCol.appendChild(sec);
			}
			var row = document.createElement('label'); row.className = 'tp-row';
			var span = document.createElement('span'); span.textContent = v[0];
			var inp = document.createElement('input'); inp.type = 'color'; inp.value = saved[v[1]] || v[2];
			inp.addEventListener('input', function () {
				root.style.setProperty(v[1], inp.value);
				var o = load(); o[v[1]] = inp.value; save(o);
				if (v[1] === '--pin-color') updatePin();
			});
			row.appendChild(span); row.appendChild(inp); paneCol.appendChild(row);
		});
		var reset = document.createElement('button');
		reset.type = 'button'; reset.className = 'tp-reset'; reset.textContent = 'Reset';
		reset.addEventListener('click', function () {
			VARS.forEach(function (v) { root.style.removeProperty(v[1]); });
			localStorage.removeItem(KEY);
			updatePin();
			fs = 1; fsApply(); localStorage.removeItem(FSKEY); zshow();
			localStorage.removeItem(RKEY); linp.value = String(ROWS_DEF); lshow();
			var inputs = panel.querySelectorAll('input[type=color]');
			for (var i = 0; i < inputs.length; i++) inputs[i].value = VARS[i][2];
			document.dispatchEvent(new CustomEvent('gamja-extra-reset'));
		});
		panel.appendChild(reset);
		showTab((function () { try { return localStorage.getItem(TKEY) || 'opt'; } catch (e) { return 'opt'; } })());
		backdrop.appendChild(panel);
		document.body.appendChild(backdrop);
		backdrop.addEventListener('click', function (e) { if (e.target === backdrop) hide(); });
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) hide(); });
		return backdrop;
	}
	function hide() { if (backdrop) backdrop.classList.add('hidden'); }
	function toggle() { buildPanel().classList.toggle('hidden'); }

	// injects the "Extra" button next to Settings (bouncer view only). LIGHT interval check,
	// no MutationObserver on message rendering.
	function injectColorsButton() {
		var btns = document.getElementsByTagName('button');
		var settingsBtn = null, hasAddNetwork = false;
		for (var i = 0; i < btns.length; i++) {
			var tx = btns[i].textContent.trim();
			if (tx === 'Settings') settingsBtn = btns[i];
			else if (tx === 'Add network') hasAddNetwork = true;
		}
		var strays = document.querySelectorAll('button.colors-btn'), k;
		if (settingsBtn && hasAddNetwork) {
			var nx = settingsBtn.nextElementSibling;
			if (nx && nx.classList && nx.classList.contains('colors-btn')) return;
			for (k = 0; k < strays.length; k++) strays[k].remove();
			var cb = document.createElement('button');
			cb.type = 'button'; cb.className = 'colors-btn'; cb.textContent = 'Extra';
			cb.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
			settingsBtn.parentNode.insertBefore(cb, settingsBtn.nextSibling);
		} else {
			for (k = 0; k < strays.length; k++) strays[k].remove();
		}
	}
	setInterval(injectColorsButton, 1000);
	injectColorsButton();
})();

/* ===================== command history ↑/↓ ===================== */
(function () {
	var MAX = 200, hist = [], idx = 0, draft = '';
	function composerInput(t) {
		return (t && t.tagName === 'INPUT' && t.name === 'text' && t.closest && t.closest('#composer')) ? t : null;
	}
	function setValue(inp, v) {
		inp.value = v;
		var ev;
		try { ev = new InputEvent('input', { bubbles: true }); } catch (e) { ev = new Event('input', { bubbles: true }); }
		inp.dispatchEvent(ev);
		try { inp.selectionStart = inp.selectionEnd = v.length; } catch (e) {}
	}
	document.addEventListener('keydown', function (e) {
		var inp = composerInput(e.target);
		if (!inp) return;
		if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
			var v = (inp.value || '').trim();
			if (v) { if (hist[hist.length - 1] !== v) hist.push(v); if (hist.length > MAX) hist.shift(); }
			idx = hist.length; draft = '';
			return;
		}
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === 'ArrowUp') {
			if (hist.length === 0) return;
			if (idx === hist.length) draft = inp.value || '';
			if (idx > 0) { idx--; e.preventDefault(); setValue(inp, hist[idx]); }
			else e.preventDefault();
		} else if (e.key === 'ArrowDown') {
			if (idx >= hist.length) return;
			idx++;
			e.preventDefault();
			setValue(inp, idx === hist.length ? draft : hist[idx]);
		}
	}, true);
})();

/* ===================== channel pinning (senpai-style) =====================
   Own store (localStorage `gamja_pins_side`, channel names lowercased).
   A pinned channel floats to the top of the channel list WITHOUT touching the <li> elements
   preact renders: ordering is written as `style.order` + `data-pin` on them. The only graft into
   gamja's DOM is the 📌 button inside #member-list-header, re-injected on an interval like the
   Extra button. */
(function () {
	var PKEY = 'gamja_pins_side';
	var pins; try { pins = JSON.parse(localStorage.getItem(PKEY)) || []; } catch (e) { pins = []; }

	function norm(c) { return (c || '').toLowerCase(); }
	function has(c) { return pins.indexOf(norm(c)) >= 0; }
	function toggle(c) {
		var k = norm(c); if (!k) return;
		var i = pins.indexOf(k);
		if (i >= 0) pins.splice(i, 1); else pins.push(k);
		try { localStorage.setItem(PKEY, JSON.stringify(pins)); } catch (e) {}
		markPinned();
	}

	// channel name of a sidebar entry: from the href (`irc:///<url-encoded entity>`; user buffers
	// carry ",isuser"), falling back to the label in case the href shape ever changes.
	function chanOf(a) {
		if (!a) return null;
		var h = a.getAttribute('href') || '', name = '';
		if (h.indexOf(',is') >= 0) return null;
		if (h.indexOf('irc://') === 0) { try { name = decodeURIComponent(h.slice(h.indexOf('/', 6) + 1)); } catch (e) { name = ''; } }
		if (!name) name = (a.textContent || '').trim();
		return /^[#&+!]/.test(name) ? name : null;
	}
	function activeChannel() { return chanOf(document.querySelector('#buffer-list li.active > a')); }

	// user buffers: gamja builds their href as `irc:///<nick>,isuser`, which is also why chanOf()
	// deliberately returns null for them.
	function isUser(a) {
		var h = a ? (a.getAttribute('href') || '') : '';
		return h.indexOf(',isuser') >= 0;
	}

	// senpai-style ordering: pinned channels go to the top of the WHOLE list, right below the
	// first row (the bouncer), hence above the networks. This needs a computed order rather than a
	// fixed order:-1, because the bouncer row must stay first. `style.order` and `data-pin` are
	// written onto the <li>: neither is a prop preact manages, so both survive re-renders
	// (a `class` would be rewritten instead).
	// Optional grouping of channel names that exist on more than one network: they are lifted out
	// of their network and gathered right below the pinned block, each labelled with its network.
	// Off by default, switched from the Extra panel.
	var GKEY = 'gamja_group_shared';
	function grouping() { try { return localStorage.getItem(GKEY) === '1'; } catch (e) { return false; } }

	function markPinned() {
		var ul = document.querySelector('#buffer-list ul');
		if (!ul) return;
		var lis = Array.prototype.slice.call(ul.children);
		var group = grouping();
		var head = null, pin = [], pm = [], dupe = [], rest = [], meta = [], nets = {}, net = '', i, li, m, c;

		// Pass 1: tie every channel row to the network row above it — the <li> carries no network of
		// its own, only DOM order does — and count on how many networks each name shows up.
		for (i = 0; i < lis.length; i++) {
			li = lis[i];
			if (li.classList.contains('type-server')) {
				if (i > 0) net = ((li.firstElementChild || {}).textContent || '').trim();
				meta.push(null);
				continue;
			}
			c = chanOf(li.firstElementChild);
			if (!c) { meta.push(null); continue; }
			var key = norm(c);
			(nets[key] = nets[key] || {})[net] = 1;
			meta.push({ name: key, net: net });
		}

		// Pass 2: fill the buckets. `rest` is filled in DOM order, so networks keep their channels
		// underneath them; only the shared names are pulled away.
		for (i = 0; i < lis.length; i++) {
			li = lis[i]; m = meta[i];
			if (i === 0 && li.classList.contains('type-server')) { head = li; continue; }
			var pinned = m && has(m.name);
			if (pinned) li.setAttribute('data-pin', ''); else li.removeAttribute('data-pin');
			var shared = !!(group && m && Object.keys(nets[m.name]).length > 1);
			// the label is drawn by `a::after`, and attr() only reads attributes of its OWN element,
			// so the anchor needs the value too — on the <li> alone the label came out empty. The <li>
			// keeps it as well, because the layout rules select on it.
			var a = li.firstElementChild;
			if (shared && m.net) {
				li.setAttribute('data-net', '@' + m.net);
				if (a) a.setAttribute('data-net', '@' + m.net);
			} else {
				li.removeAttribute('data-net');
				if (a) a.removeAttribute('data-net');
			}
			li.removeAttribute('data-shared-head');
			li.removeAttribute('data-pm-head');
			// the pin wins: a pinned channel stays in the pinned block even when its name is shared,
			// it just keeps the @network label so it is not confused with its twin, which stays in
			// the group below. Private messages are always gathered on their own, right under the
			// pinned block and above the shared names.
			if (pinned) pin.push(li);
			else if (isUser(li.firstElementChild)) pm.push(li);
			else if (shared) dupe.push(li);
			else rest.push(li);
		}

		// same names next to each other, networks in a stable order underneath
		dupe.sort(function (a, b) {
			var na = norm(chanOf(a.firstElementChild)), nb = norm(chanOf(b.firstElementChild));
			if (na !== nb) return na < nb ? -1 : 1;
			var x = a.getAttribute('data-net') || '', y = b.getAttribute('data-net') || '';
			return x < y ? -1 : x > y ? 1 : 0;
		});
		if (dupe.length) dupe[0].setAttribute('data-shared-head', '');

		pm.sort(function (a, b) {
			var x = (a.textContent || '').trim().toLowerCase(), y = (b.textContent || '').trim().toLowerCase();
			return x < y ? -1 : x > y ? 1 : 0;
		});
		if (pm.length) pm[0].setAttribute('data-pm-head', '');

		var k = 0;
		function put(x) { var v = String(k++); if (x.style.order !== v) x.style.order = v; }
		if (head) put(head);
		pin.forEach(put);
		pm.forEach(put);
		dupe.forEach(put);
		rest.forEach(put);
	}

	document.addEventListener('gamja-extra-panel', function (ev) {
		var panel = ev.detail && ev.detail.panel;
		if (!panel || panel.querySelector('.gs-row')) return;
		var row = document.createElement('div');
		row.className = 'tp-zoom gs-row';
		var lab = document.createElement('span');
		lab.textContent = 'Group shared channel names';
		var chk = document.createElement('input');
		chk.type = 'checkbox'; chk.checked = grouping(); chk.style.flex = 'none';
		chk.title = 'Channels present on more than one network are gathered below the pinned ones, each labelled with its network';
		chk.addEventListener('change', function () {
			try { localStorage.setItem(GKEY, chk.checked ? '1' : '0'); } catch (e) {}
			markPinned();
		});
		row.appendChild(lab); row.appendChild(chk);
		panel.appendChild(row);
	});

	document.addEventListener('gamja-extra-reset', function () {
		try { localStorage.removeItem(GKEY); } catch (e) {}
		var chk = document.querySelector('.gs-row input[type=checkbox]');
		if (chk) chk.checked = false;
		markPinned();
	});

	function injectPinButton() {
		var head = document.getElementById('member-list-header');
		if (!head) return;
		var btn = head.querySelector('button.mlh-pin');
		var chan = activeChannel();
		if (!chan) { if (btn) btn.remove(); return; }
		if (!btn) {
			btn = document.createElement('button');
			btn.type = 'button'; btn.className = 'mlh-pin'; btn.textContent = '📌';
			btn.addEventListener('click', function (e) {
				e.preventDefault();
				var c = activeChannel();
				if (c) { toggle(c); injectPinButton(); }
			});
			head.appendChild(btn);
		}
		var on = has(chan);
		btn.classList.toggle('on', on);
		btn.title = (on ? 'Unpin ' : 'Pin ') + chan + ' (keeps it at the top of the channel list)';
	}
	// network of a row: the <li> does not carry it, so walk up to the network row above it. The very
	// first row is the bouncer, which is not a network.
	function netOf(li) {
		for (var p = li ? li.previousElementSibling : null; p; p = p.previousElementSibling) {
			if (!p.classList.contains('type-server')) continue;
			return p.previousElementSibling ? ((p.firstElementChild || {}).textContent || '').trim() : '';
		}
		return '';
	}

	// Private messages only: a nick in the header does not say which network the query came from,
	// while a channel is unambiguous enough. The network is stamped on the title element and CSS
	// prefixes it there — and shows the title, which gamja hides on desktop.
	function stampHeader() {
		var title = document.querySelector('#buffer-header .title');
		if (!title) return;
		var li = document.querySelector('#buffer-list li.active');
		var a = li ? li.firstElementChild : null;
		var tag = '';
		if (a && isUser(a)) {
			var net = netOf(li);
			// the sidebar text may have been shortened by shortenNicks(), so prefer the original
			var nick = a.getAttribute('data-full') || (a.textContent || '').trim();
			if (nick && net) tag = nick + '@' + net;
		}
		if (tag) title.setAttribute('data-pm', tag); else title.removeAttribute('data-pm');
	}

	/* ⚠️ The nick is shortened in the TEXT, not with CSS: `text-overflow` produced no ellipsis here
	   whatever the box it was applied to, and measuring the overflow did not help either. Cutting the
	   string is immune to all of that. The original is kept in `data-full`, so a re-render by preact
	   (which puts the whole nick back) is simply cut again on the next tick, and a nick that changes
	   is picked up because the text it restores does not end in an ellipsis. */
	// ⚠️ NOT `lastChild`: gamja's template is indented, so the last child of the link is usually a
	// whitespace text node — shortening that did precisely nothing. This picks the last text node
	// that actually holds characters.
	function nickNode(a) {
		for (var j = a.childNodes.length - 1; j >= 0; j--) {
			var n = a.childNodes[j];
			if (n.nodeType === 3 && n.nodeValue.trim()) return n;
		}
		return null;
	}

	function shortenNicks() {
		var max = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nick-max'), 10);
		max = (max > 1 ? max : 16) - 1;                       // the variable includes room for the …
		var as = document.querySelectorAll('#member-list li > a, #buffer-list li > a[href*=",isuser"]');
		for (var i = 0; i < as.length; i++) {
			var a = as[i], node = nickNode(a);
			if (!node) continue;
			var cur = node.nodeValue, kept = a.getAttribute('data-full');
			var full = (kept && cur.trim().slice(-1) === '…') ? kept : cur.trim();
			if (full.length > max) {
				var cut = full.slice(0, max) + '…';
				if (cur !== cut) { a.setAttribute('data-full', full); node.nodeValue = cut; }
				// the whole nick has to stay readable somewhere: gamja's own title carries the realname
				// and host, not necessarily the nick, so it is prepended (once) rather than replaced.
				var tip = a.getAttribute('title') || '';
				if (tip.indexOf(full) !== 0) a.setAttribute('title', full + (tip ? '\n' + tip : ''));
			} else {
				if (cur !== full) node.nodeValue = full;
				a.removeAttribute('data-full');
			}
		}
	}

	function tick() { markPinned(); injectPinButton(); stampHeader(); shortenNicks(); }
	setInterval(tick, 700);
	tick();
})();

/* ===================== buffer reload (⟳) =====================
   Every so often a channel renders empty right after joining: the buffer is there, the messages
   are not. Switching to another buffer and back brings them in. This button does exactly that,
   and nothing else: it clicks gamja's OWN sidebar links, so no state is reached into and no
   bundle hook is needed. Sits next to the 📌 in the member list header, same injection pattern.

   Why a manual button and not a fix: gamja's history-on-empty-buffer defect is already patched in
   the bundle (`restoreScrollPosition` now calls `onScrollTop()` when the buffer has no children),
   and the empty render still happens now and then — so what is missing is a way to retry, not
   another guard. */
(function () {
	var BACK_MS = 90;

	function activeLink() { return document.querySelector('#buffer-list li.active > a'); }

	// Where to bounce off, best first:
	//   1. a scratch buffer, if one exists — open it once with `/query reload` and it stays in the
	//      sidebar doing nothing. Bouncing off it marks nothing real as read. Rename it through
	//      localStorage `gamja_reload_scratch`.
	//   2. the server row OF THE SAME NETWORK: the sidebar lists a network row followed by its
	//      channels, so it is the nearest preceding `.type-server`.
	//   3. anything else that is not the current buffer.
	// A truly synthetic target is not possible without a bundle hook: gamja switches only between
	// buffers it owns, and a hand-made <a> carries none of its click handlers.
	var SCRATCH_KEY = 'gamja_reload_scratch';
	function scratchName() {
		try { return (localStorage.getItem(SCRATCH_KEY) || 'reload').toLowerCase(); } catch (e) { return 'reload'; }
	}
	function bounceLink(cur) {
		var lis = Array.prototype.slice.call(document.querySelectorAll('#buffer-list li'));
		var want = scratchName(), i, a, cursor = -1;

		for (i = 0; i < lis.length; i++) {
			a = lis[i].firstElementChild;
			if (a === cur) { cursor = i; continue; }
			if (a && (a.textContent || '').trim().toLowerCase() === want) return a;
		}
		for (i = cursor - 1; i >= 0; i--) {
			if (!lis[i].classList.contains('type-server')) continue;
			a = lis[i].firstElementChild;
			if (a && a !== cur) return a;
		}
		for (i = 0; i < lis.length; i++) {
			a = lis[i].firstElementChild;
			if (a && a !== cur) return a;
		}
		return null;
	}

	// "reloading…" over the buffer for the length of the round trip. Passive text, no controls: it
	// is appended into #buffer and preact is free to wipe it on the next render, which is when it
	// stops being wanted anyway.
	function showNotice() {
		var host = document.getElementById('buffer');
		if (!host || host.querySelector('.bh-reloading')) return;
		var d = document.createElement('div');
		d.className = 'bh-reloading'; d.textContent = 'reloading…';
		host.appendChild(d);
	}
	function hideNotice() {
		var d = document.querySelector('#buffer .bh-reloading');
		if (d) d.remove();
	}

	// href lookup by comparison rather than an attribute selector: buffer hrefs carry `#`, `,` and
	// percent escapes, which would need escaping inside a selector string.
	function linkByHref(href) {
		var as = document.querySelectorAll('#buffer-list li > a'), i;
		for (i = 0; i < as.length; i++) { if (as[i].getAttribute('href') === href) return as[i]; }
		return null;
	}

	function reload(btn) {
		var cur = activeLink(); if (!cur) return;
		var href = cur.getAttribute('href'), away = bounceLink(cur);
		if (!href || !away) return;
		if (btn) btn.classList.add('spin');
		away.click();
		showNotice();
		setTimeout(function () {
			var back = linkByHref(href);
			if (back) back.click();
			if (btn) btn.classList.remove('spin');
			setTimeout(hideNotice, 150);
		}, BACK_MS);
	}

	// The button lives in the buffer header, in front of the channel topic, where it is impossible
	// to miss. #buffer-header is a GRID (`.title` 1/1, `.description` 2/1, `.actions` 1/2/3), so the
	// button is APPENDED last — inserting between children is what upsets preact's diff, appending
	// does not — and then placed into the topic's own cell from CSS.
	function injectReloadButton() {
		var head = document.getElementById('buffer-header');
		if (!head) return;
		var btn = head.querySelector('button.bh-reload');
		if (!activeLink()) { if (btn) btn.remove(); return; }
		if (btn && btn.parentNode === head && btn === head.lastElementChild) return;
		if (btn) btn.remove();
		btn = document.createElement('button');
		btn.type = 'button'; btn.className = 'bh-reload'; btn.textContent = '⟳';
		btn.title = 'Reload this buffer (switches away and back, which pulls in messages that did not render)';
		btn.addEventListener('click', function (e) { e.preventDefault(); reload(btn); });
		head.appendChild(btn);
	}
	setInterval(injectReloadButton, 700);
	injectReloadButton();
})();

/* ===================== /list dialog (data from the `gamja-list` event) ===================== */
(function () {
	var chans = [];
	var backdrop, panel, listEl, searchEl, titleEl, bUsers, bName, sortMode = 'users';

	window.addEventListener('gamja-list', function (ev) {
		chans = (ev.detail || []).slice();
		if (chans.length) openList();
	});

	function build() {
		if (backdrop) return;
		backdrop = document.createElement('div'); backdrop.id = 'listBackdrop'; backdrop.className = 'hidden';
		panel = document.createElement('div'); panel.id = 'listPanel';
		var head = document.createElement('div'); head.className = 'lp-head';
		titleEl = document.createElement('div'); titleEl.className = 'lp-h'; titleEl.textContent = 'Channel list';
		var close = document.createElement('button'); close.type = 'button'; close.className = 'lp-close'; close.textContent = '✕'; close.title = 'Close';
		close.addEventListener('click', hide);
		head.appendChild(titleEl); head.appendChild(close); panel.appendChild(head);
		var bar = document.createElement('div'); bar.className = 'lp-bar';
		searchEl = document.createElement('input'); searchEl.type = 'text'; searchEl.className = 'lp-search'; searchEl.placeholder = 'Filter channel or topic…';
		searchEl.addEventListener('input', render);
		bUsers = document.createElement('button'); bUsers.type = 'button'; bUsers.className = 'lp-sort active'; bUsers.textContent = '# users';
		bName = document.createElement('button'); bName.type = 'button'; bName.className = 'lp-sort'; bName.textContent = 'name';
		bUsers.addEventListener('click', function () { setSort('users'); });
		bName.addEventListener('click', function () { setSort('name'); });
		bar.appendChild(searchEl); bar.appendChild(bUsers); bar.appendChild(bName); panel.appendChild(bar);
		listEl = document.createElement('div'); listEl.className = 'lp-list'; panel.appendChild(listEl);
		backdrop.appendChild(panel); document.body.appendChild(backdrop);
		backdrop.addEventListener('click', function (e) { if (e.target === backdrop) hide(); });
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && backdrop && !backdrop.classList.contains('hidden')) hide(); });
	}
	function setSort(mode) {
		sortMode = mode;
		bUsers.classList.toggle('active', mode === 'users');
		bName.classList.toggle('active', mode === 'name');
		render();
	}
	// row cap: configurable from the Extra panel, re-read on every render
	function maxRows() { var v = parseInt(localStorage.getItem('gamja_list_rows'), 10); return v > 0 ? v : 2000; }
	function render() {
		var MAXROWS = maxRows();
		var q = (searchEl.value || '').toLowerCase().trim();
		var arr = chans.slice();
		if (q) arr = arr.filter(function (x) { return x.c.toLowerCase().indexOf(q) >= 0 || (x.t && x.t.toLowerCase().indexOf(q) >= 0); });
		arr.sort(function (a, b) {
			if (sortMode === 'name') { var A = a.c.toLowerCase(), B = b.c.toLowerCase(); return A < B ? -1 : (A > B ? 1 : 0); }
			return b.u - a.u;
		});
		listEl.innerHTML = '';
		var n = Math.min(arr.length, MAXROWS);
		// how many you are seeing (filter + MAXROWS cap) out of the total received from LIST
		titleEl.textContent = n < chans.length
			? 'Channel list (' + n + ' of ' + chans.length + ')'
			: 'Channel list (' + chans.length + ')';
		for (var i = 0; i < n; i++) {
			var x = arr[i];
			var row = document.createElement('div'); row.className = 'lp-row'; row.title = 'Click to join ' + x.c;
			var u = document.createElement('span'); u.className = 'lp-u'; u.textContent = x.u;
			var c = document.createElement('span'); c.className = 'lp-c'; c.textContent = x.c;
			var t = document.createElement('span'); t.className = 'lp-t'; t.textContent = x.t || '';
			row.appendChild(u); row.appendChild(c); row.appendChild(t);
			(function (chan) {
				row.addEventListener('click', function () { joinChannel(chan); });
			})(x.c);
			listEl.appendChild(row);
		}
		if (arr.length > MAXROWS) {
			var more = document.createElement('div'); more.className = 'lp-more';
			more.textContent = '… and ' + (arr.length - MAXROWS) + ' more (use the filter to narrow down)';
			listEl.appendChild(more);
		}
	}
	function joinChannel(chan) {
		var comp = document.getElementById('composer');
		var inp = comp && comp.querySelector('input[name=text]');
		if (comp && inp) {
			inp.focus();
			inp.value = '/join ' + chan;
			try { inp.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch (e) { inp.dispatchEvent(new Event('input', { bubbles: true })); }
			// deferred submit: on submit gamja reads state.text (controlled), which preact updates
			// asynchronously from the input event -> without the deferral it would send empty.
			setTimeout(function () {
				if (comp.requestSubmit) comp.requestSubmit(); else comp.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
			}, 0);
		}
		hide();
	}
	function openList() { build(); render(); backdrop.classList.remove('hidden'); }
	function hide() { if (backdrop) backdrop.classList.add('hidden'); }
})();

/* ===================== buffer search (⌘F / Ctrl+F) =====================
   gamja has no search at all: in the bundle, `search` only ever shows up as `location.search`.
   This block searches the lines already rendered in the active buffer. It runs only while the
   dialog is open: no observer, no timer, nothing ticking in the background.

   ⚠️ It does NOT touch the buffer's DOM, which belongs to preact: the lines are only READ. The one
   write is a temporary outline on the line you jump to, which a re-render simply drops without
   breaking anything. Results are built with createTextNode, never innerHTML: the text comes from
   IRC and must not be able to become markup. */
(function () {
	var MAXROWS = 400;
	var backdrop = null, panel = null, inputEl = null, listEl = null, metaEl = null;
	var hits = [], sel = -1;

	function lines() {
		var buf = document.getElementById('buffer');
		return buf ? buf.querySelectorAll('.logline') : [];
	}

	/* every word must appear, in any order, case-insensitive */
	function terms(q) {
		var out = [], p = q.toLowerCase().split(/\s+/), i;
		for (i = 0; i < p.length; i++) if (p[i]) out.push(p[i]);
		return out;
	}

	function search() {
		var q = (inputEl.value || '').trim();
		hits = []; sel = -1;
		while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
		if (!q) { metaEl.textContent = 'Type to search the messages currently loaded'; return; }

		var t = terms(q), all = lines(), i, j;
		for (i = 0; i < all.length; i++) {
			var txt = all[i].textContent || '', low = txt.toLowerCase(), ok = true;
			for (j = 0; j < t.length; j++) if (low.indexOf(t[j]) < 0) { ok = false; break; }
			if (ok) hits.push({ el: all[i], txt: txt, low: low });
		}

		metaEl.textContent = hits.length
			? hits.length + (hits.length === 1 ? ' result' : ' results')
				+ (hits.length > MAXROWS ? ' (showing ' + MAXROWS + ')' : '')
			: 'no match in the messages currently loaded';

		var n = Math.min(hits.length, MAXROWS);
		for (i = 0; i < n; i++) listEl.appendChild(row(hits[i], i, t));
		if (n) select(0, false);
	}

	/* highlight the earliest matching term, without innerHTML */
	function row(hit, idx, t) {
		var div = document.createElement('div');
		div.className = 'fp-row'; div.dataset.i = String(idx);
		var txt = hit.txt.replace(/\s+/g, ' ').trim();
		var low = txt.toLowerCase(), at = -1, len = 0, k;
		for (k = 0; k < t.length; k++) {
			var p = low.indexOf(t[k]);
			if (p >= 0 && (at < 0 || p < at)) { at = p; len = t[k].length; }
		}
		if (at < 0) { div.appendChild(document.createTextNode(txt)); }
		else {
			var from = at > 60 ? at - 60 : 0;                       // keep a window around the word
			var head = (from ? '… ' : '') + txt.slice(from, at);
			div.appendChild(document.createTextNode(head));
			var mk = document.createElement('mark'); mk.className = 'fp-mk';
			mk.appendChild(document.createTextNode(txt.slice(at, at + len)));
			div.appendChild(mk);
			div.appendChild(document.createTextNode(txt.slice(at + len)));
		}
		div.addEventListener('click', function () { select(idx, true); jump(); });
		return div;
	}

	function select(i, scrollIntoList) {
		var rows = listEl.children, k;
		if (i < 0 || i >= rows.length) return;
		for (k = 0; k < rows.length; k++) rows[k].classList.remove('sel');
		rows[i].classList.add('sel'); sel = i;
		if (scrollIntoList !== false && rows[i].scrollIntoView) rows[i].scrollIntoView({ block: 'nearest' });
	}

	function jump() {
		var h = hits[sel];
		if (!h || !h.el || !h.el.isConnected) return;
		hide();
		h.el.scrollIntoView({ block: 'center' });
		var st = h.el.style, oldO = st.outline, oldR = st.borderRadius;
		st.outline = '2px solid var(--green, #3fb950)';
		st.outlineOffset = '2px'; st.borderRadius = '3px';
		setTimeout(function () {
			if (!h.el) return;
			h.el.style.outline = oldO; h.el.style.outlineOffset = '';
			h.el.style.borderRadius = oldR;
		}, 1600);
	}

	function build() {
		if (backdrop) return backdrop;
		backdrop = document.createElement('div');
		backdrop.id = 'findBackdrop'; backdrop.className = 'hidden';
		panel = document.createElement('div'); panel.id = 'findPanel';

		var head = document.createElement('div'); head.className = 'fp-head';
		var h = document.createElement('div'); h.className = 'fp-h'; h.textContent = 'Search in buffer';
		var close = document.createElement('button'); close.type = 'button';
		close.className = 'fp-close'; close.textContent = '✕'; close.title = 'Close';
		close.addEventListener('click', hide);
		head.appendChild(h); head.appendChild(close); panel.appendChild(head);

		var bar = document.createElement('div'); bar.className = 'fp-bar';
		inputEl = document.createElement('input'); inputEl.type = 'text'; inputEl.className = 'fp-search';
		inputEl.placeholder = 'text, nick, several words…'; inputEl.autocomplete = 'off';
		inputEl.addEventListener('input', search);
		bar.appendChild(inputEl); panel.appendChild(bar);

		metaEl = document.createElement('div'); metaEl.className = 'fp-meta';
		panel.appendChild(metaEl);
		listEl = document.createElement('div'); listEl.className = 'fp-list';
		panel.appendChild(listEl);

		var foot = document.createElement('div'); foot.className = 'fp-foot';
		foot.textContent = '↑↓ move · Enter jumps to the line · Esc closes — searches only the '
			+ 'messages already loaded: scroll up in the buffer to load more';
		panel.appendChild(foot);

		backdrop.appendChild(panel);
		document.body.appendChild(backdrop);
		backdrop.addEventListener('click', function (e) { if (e.target === backdrop) hide(); });
		return backdrop;
	}

	function show() {
		build().classList.remove('hidden');
		inputEl.focus(); inputEl.select();
		search();
	}
	function hide() { if (backdrop) backdrop.classList.add('hidden'); }
	function open() { return backdrop && !backdrop.classList.contains('hidden'); }

	document.addEventListener('keydown', function (e) {
		if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'f' || e.key === 'F')) {
			e.preventDefault(); show(); return;                  // replaces the browser's find
		}
		if (!open()) return;
		if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
		if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1); return; }
		if (e.key === 'ArrowUp')   { e.preventDefault(); select(sel - 1); return; }
		if (e.key === 'Enter')     { e.preventDefault(); jump(); return; }
	}, true);
})();

/* ===================== Alt shortcuts on macOS =====================
   ⚠️ gamja binds its shortcuts to `event.key` (`window.addEventListener("keydown")`, then
   `t[s.key]`). On macOS, Option+letter does NOT produce the letter but a composed character —
   Option+h gives "˙", Option+a gives "å" — so the lookup fails and Alt+h / Alt+a do nothing at
   all. They work on Windows and Linux; this is a macOS-only problem.

   `event.code` keeps the PHYSICAL key, so it is enough to re-emit the event with the right letter
   and let gamja's own handler do the rest: no bundle patch, no duplicated logic.

   ⚠️ Only the letters gamja actually binds are translated. Translating every Option+letter would
   break typing special characters (Option+a for "å" and friends) in the composer. If gamja ever
   adds an Alt+letter shortcut, add it here too. */
(function () {
	// Mirrors gamja's table. `k` is the special case: gamja binds it to CTRL, not Alt, and on macOS
	// Ctrl+K inside a text field is already taken by the system (kill to end of line, an emacs
	// inheritance). So Option+k is translated into Ctrl+k.
	var BOUND = { h: { altKey: true }, a: { altKey: true }, k: { ctrlKey: true } };
	var isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent || '');
	if (!isMac) return;

	window.addEventListener('keydown', function (e) {
		if (!e.isTrusted || !e.altKey || e.metaKey || e.ctrlKey) return;   // isTrusted: no recursion
		var m = /^Key([A-Z])$/.exec(e.code || '');
		if (!m) return;
		var letter = m[1].toLowerCase(), b = BOUND[letter];
		if (!b) return;
		if (b.altKey && (e.key === letter || e.key === m[1])) return;      // already right: leave it
		var ev;
		try {
			ev = new KeyboardEvent('keydown', {
				key: letter, code: e.code,
				altKey: !!b.altKey, ctrlKey: !!b.ctrlKey,
				bubbles: true, cancelable: true
			});
		} catch (err) { return; }
		e.preventDefault();            // without this macOS still inserts the composed character
		window.dispatchEvent(ev);      // gamja's handler is on window, so this reaches it
	}, true);
})();

/* ===================== /help: Mac symbol next to the Windows name =====================
   Shortcuts are rendered as <dt><kbd>Alt</kbd> + <kbd>h</kbd></dt>: every modifier is its own
   <kbd> with an exact label. CSS cannot select on text content, so this needs JS — but it only
   rewrites the text of the modifiers, without adding or removing nodes.

   ⚠️ This is inside preact's tree: a re-render of the dialog restores the original label. That is
   fine (it is cosmetic, and it reapplies the next time the dialog opens) and it is exactly why no
   elements are added — preact removes those, whereas text can simply be rewritten.

   No timer at rest and no observer: it only looks after a click or after a `/help`, the two ways
   that dialog can open, and returns immediately when there is nothing to do. */
(function () {
	var SYM = { Alt: '⌥', Ctrl: '⌃', Shift: '⇧' };
	var isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent || '');

	// The CTRL-bound shortcut can also be pressed with Option on macOS (see the shortcuts block),
	// so the chip has to say so, otherwise the alias exists and nobody knows about it. The row is
	// checked to be the `k` one, so this holds if gamja ever adds other shortcuts.
	function alias(k, t) {
		if (!isMac || t !== 'Ctrl') return '';
		var dt = k.parentNode, sib = dt ? dt.querySelectorAll('kbd') : [], i;
		for (i = 0; i < sib.length; i++)
			if (sib[i] !== k && (sib[i].textContent || '').trim() === 'k') return ' / ⌥';
		return '';
	}

	function decorate() {
		var dl = document.querySelector('.dialog .dialog-body dl');
		if (!dl) return;
		var ks = dl.querySelectorAll('dt kbd'), i;
		for (i = 0; i < ks.length; i++) {
			var k = ks[i], t = (k.textContent || '').trim();
			if (k.getAttribute('data-sym') || !SYM[t]) continue;
			k.setAttribute('data-sym', '1');
			k.textContent = t + ' ' + SYM[t] + alias(k, t);
		}
	}
	function soon() { setTimeout(decorate, 0); setTimeout(decorate, 60); setTimeout(decorate, 200); }

	document.addEventListener('click', soon, true);
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Enter') return;
		var t = e.target;
		if (!t || t.name !== 'text' || !t.closest || !t.closest('#composer')) return;
		if (/^\/help\b/i.test((t.value || '').trim())) soon();
	}, true);
})();

/* ===================== Alt+arrows: follow the order you can see =====================
   ⚠️ Pinned channels were SKIPPED AS A BLOCK. That is not a flaw in the pinning: gamja navigates
   `Array.from(state.buffers.values())`, the internal order of its Map, while pinning only reorders
   the view by writing `style.order` onto the <li> elements. Eye and shortcut followed two
   different orders.

   Navigation is redone here on the VISIBLE order: sort the <li> by `style.order` (ties broken by
   DOM order), find the active one and move to the previous/next, wrapping around as gamja does.

   ⚠️ gamja's handler is a BUBBLE listener on window; this one is a CAPTURE listener, also on
   window, so it runs first and `stopPropagation()` keeps gamja's from firing. Without that both
   would move and the buffer would jump twice. */
(function () {
	function visualOrder() {
		var ul = document.querySelector('#buffer-list ul');
		if (!ul) return [];
		var out = [], i;
		for (i = 0; i < ul.children.length; i++) {
			var li = ul.children[i];
			out.push({ li: li, o: parseInt(li.style.order, 10) || 0, i: i });
		}
		out.sort(function (a, b) { return a.o - b.o || a.i - b.i; });
		return out;
	}
	window.addEventListener('keydown', function (e) {
		if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		var list = visualOrder();
		if (list.length < 2) return;                       // nothing to cycle: let gamja handle it
		var at = -1, i;
		for (i = 0; i < list.length; i++) if (list[i].li.classList.contains('active')) { at = i; break; }
		if (at < 0) return;
		e.preventDefault(); e.stopPropagation();           // gamja must not move as well
		var step = e.key === 'ArrowUp' ? -1 : 1;
		var next = list[(at + step + list.length) % list.length].li;
		var a = next.firstElementChild;
		if (a && a.click) a.click();
	}, true);
})();

/* ===================== image preview (modal) =====================
   Clicking an image link opens it in a modal instead of a browser tab. Off by default.
   ⚠️ This needs `img-src` in the page's CSP: gamja ships `default-src 'self'` and nothing else, so
   remote images are blocked outright and no amount of JS gets around it. index.html here allows
   `https:` and `data:` — http is left out on purpose. Nothing is preloaded: the only request is the
   image you click, so the buffer scrolls exactly as fast as before. */
(function () {
	var KEY = 'gamja_img_modal';
	var IMG_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svgz?)(\?|#|$)/i;
	var backdrop = null, imgEl = null, capEl = null, openEl = null, spinEl = null;

	function on() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

	function build() {
		if (backdrop) return;
		backdrop = document.createElement('div');
		backdrop.id = 'imgBackdrop'; backdrop.className = 'hidden';
		var panel = document.createElement('div'); panel.id = 'imgPanel';
		var head = document.createElement('div'); head.className = 'ip-head';
		capEl = document.createElement('span'); capEl.className = 'ip-cap';
		openEl = document.createElement('a'); openEl.className = 'ip-open';
		openEl.target = '_blank'; openEl.rel = 'noreferrer noopener'; openEl.textContent = 'open';
		var close = document.createElement('button');
		close.type = 'button'; close.className = 'lp-close'; close.textContent = '✕'; close.title = 'Close';
		head.appendChild(capEl); head.appendChild(openEl); head.appendChild(close);
		spinEl = document.createElement('div'); spinEl.className = 'ip-note'; spinEl.textContent = 'loading…';
		imgEl = document.createElement('img'); imgEl.className = 'ip-img'; imgEl.alt = '';
		imgEl.addEventListener('load', function () { spinEl.textContent = ''; imgEl.classList.remove('hidden'); });
		imgEl.addEventListener('error', function () {
			spinEl.textContent = 'could not be loaded — use “open” to see it in the browser';
			imgEl.classList.add('hidden');
		});
		panel.appendChild(head); panel.appendChild(spinEl); panel.appendChild(imgEl);
		backdrop.appendChild(panel);
		document.body.appendChild(backdrop);

		close.addEventListener('click', hide);
		backdrop.addEventListener('click', function (e) { if (e.target === backdrop) hide(); });
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && backdrop && !backdrop.classList.contains('hidden')) hide();
		});
	}

	function show(url) {
		build();
		capEl.textContent = url.replace(/^https?:\/\//, '').slice(0, 90);
		capEl.title = url;
		openEl.href = url;
		spinEl.textContent = 'loading…';
		imgEl.classList.add('hidden');
		imgEl.src = url;
		backdrop.classList.remove('hidden');
	}
	function hide() {
		if (!backdrop) return;
		backdrop.classList.add('hidden');
		imgEl.removeAttribute('src');            // stops a download still in flight
	}

	// one delegated listener, nothing per message and no observer
	document.addEventListener('click', function (e) {
		if (!on() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		var a = e.target && e.target.closest ? e.target.closest('#buffer a') : null;
		if (!a) return;
		var href = a.href || '';
		if (href.indexOf('https://') !== 0 || !IMG_RE.test(href)) return;
		e.preventDefault();
		show(href);
	});

	document.addEventListener('gamja-extra-panel', function (ev) {
		var panel = ev.detail && ev.detail.panel;
		if (!panel || panel.querySelector('.im-row')) return;
		var row = document.createElement('div');
		row.className = 'tp-zoom im-row';
		var lab = document.createElement('span');
		lab.textContent = 'Preview images in a modal';
		var chk = document.createElement('input');
		chk.type = 'checkbox'; chk.checked = on(); chk.style.flex = 'none';
		chk.title = 'Off: image links open in the browser, and the page requests nothing. On: the image is fetched by gamja when you click it.';
		chk.addEventListener('change', function () {
			try { localStorage.setItem(KEY, chk.checked ? '1' : '0'); } catch (e) {}
		});
		row.appendChild(lab); row.appendChild(chk);
		panel.appendChild(row);
	});

	document.addEventListener('gamja-extra-reset', function () {
		try { localStorage.removeItem(KEY); } catch (e) {}
		var chk = document.querySelector('.im-row input[type=checkbox]');
		if (chk) chk.checked = false;
	});
})();

/* ===================== /paste : send multi-line text =====================
   gamja's composer is a single-line <input>, so pasting a block of code into it silently turns the
   newlines into spaces and one message goes out instead of twenty. gamja's own paste handler only
   looks at files, so nothing else deals with this. Here a small dialog takes the text and sends it
   one line per message, spaced out so the network does not treat it as flooding.
   Opened either by typing `/paste` or by pasting multi-line text into the composer. */
(function () {
	var GAP_MS = 450, MKEY = 'gamja_paste_max', MDEF = 50, MMIN = 1, MMAX = 200;
	function maxLines() { var v = parseInt(localStorage.getItem(MKEY), 10); return v > 0 ? v : MDEF; }
	function setMaxLines(x) {
		var v = parseInt(x, 10); if (!(v > 0)) v = MDEF;
		v = v < MMIN ? MMIN : (v > MMAX ? MMAX : v);
		try { localStorage.setItem(MKEY, String(v)); } catch (e) {}
		return v;
	}
	var backdrop = null, area = null, info = null, sendBtn = null, sending = false;

	function composer() { return document.querySelector('#composer input[type=text]'); }

	function lines(txt) {
		return (txt || '').replace(/\r/g, '').split('\n')
			.map(function (l) { return l.replace(/\s+$/, ''); })
			.filter(function (l) { return l.length > 0; });
	}

	function build() {
		if (backdrop) return;
		backdrop = document.createElement('div');
		backdrop.id = 'pasteBackdrop'; backdrop.className = 'hidden';
		var panel = document.createElement('div');
		panel.id = 'pastePanel';
		var head = document.createElement('div'); head.className = 'lp-head';
		var h = document.createElement('div'); h.className = 'lp-h'; h.textContent = 'Send as lines';
		var close = document.createElement('button');
		close.type = 'button'; close.className = 'lp-close'; close.textContent = '✕'; close.title = 'Close';
		head.appendChild(h); head.appendChild(close);
		area = document.createElement('textarea'); area.className = 'pp-area'; area.rows = 12;
		area.placeholder = 'Paste here. One line = one message.';
		var bar = document.createElement('div'); bar.className = 'pp-bar';
		info = document.createElement('span'); info.className = 'pp-info';
		sendBtn = document.createElement('button'); sendBtn.type = 'button'; sendBtn.className = 'lp-sort active';
		bar.appendChild(info); bar.appendChild(sendBtn);
		panel.appendChild(head); panel.appendChild(area); panel.appendChild(bar);
		backdrop.appendChild(panel);
		document.body.appendChild(backdrop);

		close.addEventListener('click', hide);
		backdrop.addEventListener('click', function (e) { if (e.target === backdrop) hide(); });
		area.addEventListener('input', refresh);
		sendBtn.addEventListener('click', send);
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && backdrop && !backdrop.classList.contains('hidden')) hide();
		});
	}

	function refresh() {
		var n = lines(area.value).length, cap = maxLines(), over = n > cap;
		info.textContent = n + (n === 1 ? ' line' : ' lines') + (over ? ' — only the first ' + cap + ' will be sent' : '');
		info.classList.toggle('hot', over);
		sendBtn.textContent = sending ? 'sending…' : 'Send ' + Math.min(n, cap) + ' messages';
		sendBtn.disabled = sending || n === 0;
	}

	function show(txt) {
		build();
		area.value = txt || '';
		sending = false;
		refresh();
		backdrop.classList.remove('hidden');
		area.focus();
	}
	function hide() { if (backdrop) backdrop.classList.add('hidden'); }

	// one message per line, through gamja's own form: the value is written into the composer and the
	// form is submitted, which is exactly what pressing Enter does — no reaching into its state.
	function send() {
		var input = composer(); if (!input || !input.form) return;
		var todo = lines(area.value).slice(0, maxLines());
		if (!todo.length) return;
		sending = true; refresh();
		hide();                    // out of the way at once: the sending carries on behind it
		var i = 0;
		// ⚠️ The composer is a CONTROLLED input and `handleSubmit` sends `this.state.text`, not the
		// DOM value — so writing into the field is not enough. The `input` event has to be dispatched
		// (it bubbles to the form, where gamja's onInput lives) and preact given a tick to store it,
		// before the form is submitted.
		(function step() {
			if (i >= todo.length) { sending = false; return; }
			var line = todo[i++];
			input.value = line;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			refresh();
			setTimeout(function () {
				input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
				setTimeout(step, GAP_MS);
			}, 60);
		})();
	}

	// `/paste` in the composer opens the dialog instead of being sent as an unknown command
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Enter') return;
		var input = composer();
		if (!input || e.target !== input) return;
		if (input.value.trim().toLowerCase() !== '/paste') return;
		e.preventDefault(); e.stopPropagation();
		input.value = '';
		show('');
	}, true);

	document.addEventListener('gamja-extra-panel', function (ev) {
		var panel = ev.detail && ev.detail.panel;
		if (!panel || panel.querySelector('.pm-row')) return;
		var row = document.createElement('div');
		row.className = 'tp-zoom pm-row';
		var lab = document.createElement('span');
		lab.textContent = 'Max lines in /paste';
		var inp = document.createElement('input');
		inp.type = 'number'; inp.className = 'tp-num';
		inp.min = String(MMIN); inp.max = String(MMAX); inp.step = '1'; inp.value = String(maxLines());
		var warn = document.createElement('div');
		warn.className = 'tp-warn';
		warn.textContent = '⚠ One message per line: too many in a row and the network kills you for flooding.';
		inp.addEventListener('change', function () { inp.value = String(setMaxLines(inp.value)); });
		row.appendChild(lab); row.appendChild(inp);
		panel.appendChild(row); panel.appendChild(warn);
	});

	document.addEventListener('gamja-extra-reset', function () {
		try { localStorage.removeItem(MKEY); } catch (e) {}
		var inp = document.querySelector('.pm-row input[type=number]');
		if (inp) inp.value = String(MDEF);
	});

	/* gamja builds /help from its own command list, so the entry has to be grafted in when the dialog
	   is open. The commands list is the <dl> whose first <dt> starts with a slash (the other one holds
	   the keyboard shortcuts), and the row is inserted alphabetically. Re-added on an interval, like
	   every other node that lives inside preact's tree. */
	function injectHelp() {
		var dls = document.querySelectorAll('.dialog .dialog-body dl'), i, dl = null, first;
		for (i = 0; i < dls.length; i++) {
			first = dls[i].querySelector('dt');
			if (first && first.textContent.trim().charAt(0) === '/') { dl = dls[i]; break; }
		}
		if (!dl || dl.querySelector('dt[data-paste]')) return;
		var dt = document.createElement('dt');
		dt.setAttribute('data-paste', ''); dt.textContent = '/paste';
		var dd = document.createElement('dd');
		dd.textContent = 'Send a block of text as one message per line';
		var dts = dl.querySelectorAll('dt'), before = null;
		for (i = 0; i < dts.length; i++) {
			if (dts[i].textContent.trim().toLowerCase() > '/paste') { before = dts[i]; break; }
		}
		if (before) { dl.insertBefore(dt, before); dl.insertBefore(dd, before); }
		else { dl.appendChild(dt); dl.appendChild(dd); }
	}
	setInterval(function () { if (document.querySelector('.dialog')) injectHelp(); }, 800);

	// Tab-completion for `/paste`: gamja completes from its own command list, which cannot know about
	// this one. Handled from three characters on (`/pas`) — no gamja command starts with that, so its
	// own completion (`/part`, `/ping`, …) is never intercepted.
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
		var input = composer();
		if (!input || e.target !== input) return;
		var v = input.value;
		if (!/^\/[a-z]*$/i.test(v)) return;                 // still typing a single command token
		var tok = v.slice(1).toLowerCase();
		if (tok.length < 3 || 'paste'.indexOf(tok) !== 0) return;
		e.preventDefault(); e.stopPropagation();
		input.value = '/paste';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}, true);

	// pasting several lines into the composer: offer the dialog rather than let them be flattened
	document.addEventListener('paste', function (e) {
		var input = composer();
		if (!input || e.target !== input || !e.clipboardData) return;
		var txt = e.clipboardData.getData('text/plain') || '';
		if (lines(txt).length < 2) return;
		e.preventDefault(); e.stopPropagation();
		show(txt);
	}, true);
})();

/* ===================== copy as lines =====================
   Copying a stretch of conversation came out as a single run of text. Rather than chase why the
   browser flattens it, the copy is rebuilt here: every logline the selection touches contributes one
   line. Only inside #buffer, only for multi-line selections — a single line is left to the browser,
   so copying half a sentence still behaves normally. Note that a partially selected first or last
   line is taken whole; that is the trade-off for getting the line breaks back. */
(function () {
	document.addEventListener('copy', function (ev) {
		var sel = window.getSelection();
		if (!sel || sel.isCollapsed || !sel.rangeCount) return;
		var buf = document.getElementById('buffer');
		if (!buf) return;
		// ⚠️ No check on where the selection STARTS: dragging over a long block routinely begins or
		// ends outside #buffer (in the header, or past the last line), and requiring both ends inside
		// it made the handler bail out exactly on the selections that need it. What scopes this
		// instead is the count of loglines the range touches.
		var range = sel.getRangeAt(0), lines = [], els = buf.querySelectorAll('.logline'), i, el;
		for (i = 0; i < els.length; i++) {
			el = els[i];
			if (!range.intersectsNode(el)) continue;
			var txt = (el.innerText || el.textContent || '').replace(/\s+$/, '');
			if (txt) lines.push(txt);
		}
		if (lines.length < 2 || !ev.clipboardData) return;
		ev.clipboardData.setData('text/plain', lines.join('\n'));
		ev.preventDefault();
	}, true);
})();

/* ===================== nick length cap =====================
   How many characters of a nick the member list shows before the ellipsis. Only a number is kept
   here; the cut itself is done in CSS through the --nick-max variable. */
(function () {
	var KEY = 'gamja_nick_max', DEF = 15, MIN = 5, MAX = 60;
	function get() { var v = parseInt(localStorage.getItem(KEY), 10); return v > 0 ? v : DEF; }
	function set(x) {
		var v = parseInt(x, 10); if (!(v > 0)) v = DEF;
		v = v < MIN ? MIN : (v > MAX ? MAX : v);
		try { localStorage.setItem(KEY, String(v)); } catch (e) {}
		return v;
	}
	// +1 leaves room for the ellipsis itself, so the setting means "characters of the nick"
	function apply() { document.documentElement.style.setProperty('--nick-max', String(get() + 1)); }
	apply();

	document.addEventListener('gamja-extra-panel', function (ev) {
		var panel = ev.detail && ev.detail.panel;
		if (!panel || panel.querySelector('.nm-row')) return;
		var row = document.createElement('div');
		row.className = 'tp-zoom nm-row';
		var lab = document.createElement('span');
		lab.textContent = 'Nick length in the member list';
		var inp = document.createElement('input');
		inp.type = 'number'; inp.className = 'tp-num';
		inp.min = String(MIN); inp.max = String(MAX); inp.step = '1'; inp.value = String(get());
		inp.title = 'Characters shown before the ellipsis. Raise it to ' + MAX + ' to stop cutting in practice.';
		inp.addEventListener('change', function () { inp.value = String(set(inp.value)); apply(); });
		row.appendChild(lab); row.appendChild(inp);
		panel.appendChild(row);
	});

	document.addEventListener('gamja-extra-reset', function () {
		try { localStorage.removeItem(KEY); } catch (e) {}
		apply();
		var inp = document.querySelector('.nm-row input[type=number]');
		if (inp) inp.value = String(DEF);
	});
})();

/* ===================== unread dot =====================
   Pure CSS: this only flips an attribute on <html>, which the rule in custom.css uses as its
   switch. Nothing runs at rest — one localStorage read at load. */
(function () {
	var KEY = 'gamja_unread_dot';
	var SKEY = 'gamja_unread_dot_left';                            // side: right unless asked
	function on() { return localStorage.getItem(KEY) !== '0'; }    // on unless explicitly refused
	function left() { return localStorage.getItem(SKEY) === '1'; }
	function apply() {
		var r = document.documentElement;
		if (on()) r.setAttribute('data-unread-dot', ''); else r.removeAttribute('data-unread-dot');
		if (left()) r.setAttribute('data-dot-left', ''); else r.removeAttribute('data-dot-left');
	}
	apply();

	document.addEventListener('gamja-extra-panel', function (ev) {
		var panel = ev.detail && ev.detail.panel;
		if (!panel || panel.querySelector('.ud-row')) return;
		var row = document.createElement('div');
		row.className = 'tp-zoom ud-row';
		var lab = document.createElement('span');
		lab.textContent = 'Unread dot';
		var chk = document.createElement('input');
		chk.type = 'checkbox'; chk.checked = on(); chk.style.flex = 'none';
		chk.addEventListener('change', function () {
			localStorage.setItem(KEY, chk.checked ? '1' : '0');
			apply();
		});
		row.appendChild(lab); row.appendChild(chk);
		panel.appendChild(row);

		// side of the dot, only meaningful while the dot itself is on
		var srow = document.createElement('div');
		srow.className = 'tp-zoom uds-row';
		var slab = document.createElement('span');
		slab.textContent = 'Unread dot on the left';
		var schk = document.createElement('input');
		schk.type = 'checkbox'; schk.checked = left(); schk.style.flex = 'none';
		schk.title = 'Off: the dot sits at the end of the row (default). On: it goes in front of the name.';
		schk.addEventListener('change', function () {
			localStorage.setItem(SKEY, schk.checked ? '1' : '0');
			apply();
		});
		srow.appendChild(slab); srow.appendChild(schk);
		panel.appendChild(srow);
	});

	document.addEventListener('gamja-extra-reset', function () {
		localStorage.removeItem(KEY); localStorage.removeItem(SKEY); apply();
		var chk = document.querySelector('.ud-row input[type=checkbox]');
		if (chk) chk.checked = true;
		var schk = document.querySelector('.uds-row input[type=checkbox]');
		if (schk) schk.checked = false;
	});
})();
