/* gamja: Colori tema + zoom testo (CSSOM) + cronologia comandi ↑/↓ + modal /list.
   Versione SNELLA: nessun wrapper WebSocket, nessun MutationObserver sull'intero DOM,
   nessun logger. Il modal /list legge i dati dall'evento `gamja-list` emesso da un hook
   minimale nel bundle (che raccoglie i numerici 322/323). CSP-safe (nessun inline). */

/* ===================== Colori tema + zoom ===================== */
(function () {
	/* Il 📌 è un'emoji: la disegna un font a colori, quindi `color` non la tocca. L'unico modo per
	   ricolorarla senza sostituire il glifo è un filtro CSS derivato dal colore scelto -> la tinta
	   segue il picker ma NON coincide col colore esatto (limite noto, accettato). */
	var PIN_DEFAULT = '#e0342b';   // rosso dominante dell'emoji: a questo valore il filtro è none
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

	var VARS = [
		['Background',              '--main-background',    '#212529'],
		['Text',                    '--main-color',         '#f8f9fa'],
		['Side panels',             '--sidebar-background', '#131618'],
		['Channel list background', '--bl-background',      '#131618'],
		['Channel list text',       '--bl-color',           '#f8f9fa'],
		['Active channel background','--bl-active-bg',      '#ffffff'],
		['Active channel text',     '--bl-active-color',    '#131618'],
		['Buttons',                 '--button-background',  '#282879'],
		['Accent (links, unread)',  '--green',              '#53b266'],
		['Alert (errors, offline)', '--red',                '#fb615b'],
		['Mention text',            '--highlight-color',    '#ffe08a'],
		['Mention background',      '--highlight-bg',       '#463a10'],
		['Channel activity',        '--activity-color',     '#d9a441'],
		['Pin 📌',                  '--pin-color',          PIN_DEFAULT]
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
		panel.appendChild(zrow);

		// tetto righe disegnate dal modal /list: letto da lì a ogni render (localStorage gamja_list_rows)
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
		panel.appendChild(lrow); panel.appendChild(lwarn);

		var csep = document.createElement('div'); csep.className = 'tp-sec'; csep.textContent = 'Colors';
		panel.appendChild(csep);
		VARS.forEach(function (v) {
			var row = document.createElement('label'); row.className = 'tp-row';
			var span = document.createElement('span'); span.textContent = v[0];
			var inp = document.createElement('input'); inp.type = 'color'; inp.value = saved[v[1]] || v[2];
			inp.addEventListener('input', function () {
				root.style.setProperty(v[1], inp.value);
				var o = load(); o[v[1]] = inp.value; save(o);
				if (v[1] === '--pin-color') updatePin();
			});
			row.appendChild(span); row.appendChild(inp); panel.appendChild(row);
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
		});
		panel.appendChild(reset);
		backdrop.appendChild(panel);
		document.body.appendChild(backdrop);
		backdrop.addEventListener('click', function (e) { if (e.target === backdrop) hide(); });
		document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) hide(); });
		return backdrop;
	}
	function hide() { if (backdrop) backdrop.classList.add('hidden'); }
	function toggle() { buildPanel().classList.toggle('hidden'); }

	// inietta il bottone "Extra" accanto a Settings (solo vista bouncer). Check LEGGERO a intervallo,
	// niente MutationObserver sul rendering dei messaggi.
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

/* ===================== cronologia comandi ↑/↓ ===================== */
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

/* ===================== pin canali (stile senpai) =====================
   Store proprio (localStorage `gamja_pins_side`, nomi canale in minuscolo): indipendente dai
   preferiti del modal /list, che restano su `gamja_pins`.
   Il canale pinnato va in cima alla lista canali SENZA toccare i <li> renderizzati da preact:
   l'ordine è dato da un <style> generato che seleziona per href. L'unico innesto nel DOM di gamja
   è il bottone 📌 dentro #member-list-header, reiniettato a intervallo come il bottone Extra. */
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

	// nome canale di una voce della sidebar: dall'href (`irc:///<entita-urlencoded>`, i buffer
	// utente hanno ",isuser"), con fallback sull'etichetta se l'href cambiasse forma.
	function chanOf(a) {
		if (!a) return null;
		var h = a.getAttribute('href') || '', name = '';
		if (h.indexOf(',is') >= 0) return null;
		if (h.indexOf('irc://') === 0) { try { name = decodeURIComponent(h.slice(h.indexOf('/', 6) + 1)); } catch (e) { name = ''; } }
		if (!name) name = (a.textContent || '').trim();
		return /^[#&+!]/.test(name) ? name : null;
	}
	function activeChannel() { return chanOf(document.querySelector('#buffer-list li.active > a')); }

	// Ordinamento come senpai: i pinnati vanno in cima all'INTERA lista, subito sotto la prima
	// riga (il bouncer), quindi sopra le reti. Serve un ordine calcolato, non un order:-1 fisso,
	// perché la riga del bouncer deve restare prima. Scrivo `style.order` e `data-pin` sui <li>:
	// nessuna delle due è una prop gestita da preact, quindi sopravvivono ai re-render
	// (`class` invece verrebbe riscritta).
	function markPinned() {
		var ul = document.querySelector('#buffer-list ul');
		if (!ul) return;
		var lis = ul.children, head = null, pin = [], rest = [], i;
		for (i = 0; i < lis.length; i++) {
			var li = lis[i];
			if (i === 0 && li.classList.contains('type-server')) { head = li; continue; }
			var c = chanOf(li.firstElementChild);
			if (c && has(c)) { li.setAttribute('data-pin', ''); pin.push(li); }
			else { li.removeAttribute('data-pin'); rest.push(li); }
		}
		var k = 0;
		function put(x) { var v = String(k++); if (x.style.order !== v) x.style.order = v; }
		if (head) put(head);
		pin.forEach(put);
		rest.forEach(put);
	}

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
	function tick() { markPinned(); injectPinButton(); }
	setInterval(tick, 700);
	tick();
})();

/* ===================== modal /list (dati dall'evento `gamja-list`) ===================== */
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
	// tetto righe: impostabile dal pannello Extra, riletto a ogni render
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
		// quanti ne stai vedendo (filtro + tetto MAXROWS) sul totale ricevuto dalla LIST
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
			// submit rimandato: gamja al submit legge state.text (controllato), che preact
			// aggiorna in modo asincrono dall'evento input -> senza il rinvio invierebbe vuoto.
			setTimeout(function () {
				if (comp.requestSubmit) comp.requestSubmit(); else comp.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
			}, 0);
		}
		hide();
	}
	function openList() { build(); render(); backdrop.classList.remove('hidden'); }
	function hide() { if (backdrop) backdrop.classList.add('hidden'); }
})();
