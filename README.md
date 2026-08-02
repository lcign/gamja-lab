# gamja — customizations

A set of customizations for [gamja](https://codeberg.org/emersion/gamja), the web IRC client, as
used in front of a [soju](https://codeberg.org/emersion/soju) bouncer. Everything in `custom.css` +
`custom.js` is **zero-invasive**: no changes to gamja's bundle, no `WebSocket` wrapper, no
`MutationObserver` watching message rendering.

The one exception is the `/list` dialog, which needs **a small hook inside the bundle** (documented
below). Without it everything else still works and the dialog simply never opens.

Desktop only.

**Tested against gamja `master` at commit [`cdf94d6`](https://codeberg.org/emersion/gamja/commit/cdf94d6)
(2026-07-24).** Follow `master`, not the tags: the latest release, `v1.0.0-beta.11`, dates from
2025-03-20 and is 54 commits behind. Note that these customizations hook gamja's DOM and CSS
variables rather than a stable API, so a newer `master` may move things underneath them — the CSS
variable names and the injection points are the parts most likely to drift.

![gamja with these customizations](screenshot.png)

*Pinned channels at the top of the list, the 📌 next to the user count, unread dots on `##anime` and
`#archlinux`, JetBrains Mono and the dark theme.*

## What it adds

**"Extra" panel** — a button injected next to *Settings* in the bouncer view:

- **text zoom** A−/A+ (0.3× → 1.8×), applied through the `--fs` CSS variable
- **max rows in the `/list` dialog** (default 2000, range 100–50000) with a warning above 5000
- **unread dot**: a dot next to channels with activity or a mention, on by default

The panel is two columns wide: fourteen colors in a single column turned it into a very tall strip.
The grid sits on the panel itself, so blocks that add their own rows through `gamja-extra-panel` get
full-width placement for free.
- **theme colors**, grouped by **where you see them** rather than by what the variable is called —
  *Channel list (left)*, *Member list (right)*, *Messages*, *Other*. The flat list used to put
  *Side panels* right next to *Channel list background* as if they were the same thing.

  Beyond what gamja exposes: `--bl-background` / `--bl-color` (background and text of the left
  channel list *only*, which gamja otherwise shares with the member list through
  `--sidebar-background`), `--bl-active-bg` / `--bl-active-color` (the selected channel,
  **hardcoded** to `#fff` in gamja), `--link-color` for links in messages — gamja paints those with
  `--green`, the very same variable as unread, so the two could never be set apart — and
  `--timestamp-color` for the time next to each message.
  `--green` is left with what it actually still drives, operators and online status, and `--red`
  is *Alert*.

<img src="extra-panel.png" alt="The Extra panel" width="330">

**Channel pinning (senpai-style)** — a 📌 in the member list header, next to *N users*: pins the open
channel and floats it to the top of the channel list, right below the bouncer row, with a 📌 in front
of its name.

**Buffer reload (⟳)** — a button in the buffer header, in front of the channel topic. Every so often a
channel renders empty right after joining: the buffer is there, the messages are not. Switching to
another buffer and back brings them in, and this button does exactly that — it clicks gamja's own
sidebar links and returning, with a *reloading…* notice over the buffer while it happens.

The bounce needs a **real** buffer: gamja switches only between buffers it owns, and a hand-made
`<a>` carries none of its click handlers, so a synthetic "empty page" is not possible without a
bundle hook. Targets are tried in this order: a **scratch buffer** — open one once with
`/query reload` and it sits in the sidebar doing nothing, so the round trip marks nothing real as
read (rename it through `localStorage` key `gamja_reload_scratch`) — then the **server row of the
same network**, then any other buffer. The underlying defect (no history fetch on an empty buffer) is one of the optional
bundle fixes below, but it does not catch every case, so a manual retry is still worth having.

**`/list` dialog** — sortable channel list (by user count or name), filter on name and topic,
*shown / total* counter, click a row to join.

**Buffer search (⌘F / Ctrl+F)** — gamja has none. A dialog that filters the lines already rendered
in the active buffer: several words match in any order, case-insensitive, the matched term is
highlighted, `↑↓` moves through the results and Enter jumps to the line in the buffer, which flashes
an outline. It replaces the browser's own find while gamja has focus.

**Command history ↑/↓** in the composer, shell style (deduplicated, capped at 200 entries).

**Readable `/help`** — gamja renders the help dialog as `<dt>`/`<dd>` pairs but never styles them,
so every command comes out looking exactly like its own description. Commands now sit on a chip and
descriptions are dimmed. It also fixes gamja's `<kbd>` chips, which are unreadable here (see below).

**Working shortcuts on macOS** — gamja binds its shortcuts to `event.key`, but Option+letter on
macOS produces a composed character (`Option+h` is `˙`), so Alt+h and Alt+a simply do nothing there.
The physical key is read from `event.code` and the event is re-emitted with the right letter, so
gamja's own handler still does the work. `Option+k` is accepted as well for the buffer switcher,
which gamja binds to Ctrl — handy because macOS already claims Ctrl+K inside a text field. The
`/help` dialog shows the Mac symbols (`⌥`, `⌃`) next to the Windows names.

**Alt+↑/↓ follows the order you see** — with channels pinned, gamja's own navigation skips them as a
block, because it walks the internal buffer Map while pinning only reorders the view. Navigation is
redone on the visible order.

**Forced dark theme** with self-hosted JetBrains Mono.

## Install

1. Copy `custom.css`, `custom.js` and the `fonts/` directory into your gamja directory.
2. In `index.html`, **after** the bundle tags, add:

   ```html
   <link rel=stylesheet href="custom.css?v=1">
   <script src="custom.js?v=1"></script>
   ```

   The `?v=N` is cache busting: **bump it on every change**, otherwise browsers keep serving the old
   file. It also helps to serve `index.html`, `config.json`, `custom.css` and `custom.js` with
   `Cache-Control: no-store`.

3. Copy `config.json.example` to `config.json` and **replace the URL with your own bouncer's
   WebSocket endpoint** — the example value is a placeholder and connects to nothing:

   ```json
   {
     "server": {
       "url": "wss://YOUR-BOUNCER.example/socket",
       "auth": "mandatory"
     }
   }
   ```

   `auth` can be `mandatory` (always ask for credentials), `optional`, or `external` (client
   certificate). Nickname, autojoin channels and networks are configured in soju, not here.

   ⚠️ The WebSocket **must live on the same origin** as the gamja page. If the page's Origin does not
   match the WebSocket's Host, soju refuses the connection with
   *"request Origin ... is not authorized for Host ..."*.

4. For the `/list` dialog, apply the bundle hook below.

## Bundle hook for `/list`

gamja does not surface `LIST` numerics, so the dialog has to be fed by an event. In `build.*.js`,
inside `handleMessage`, right **after** the message is parsed (where the parsed-message variable
already exists — `s` in this build), insert:

```js
if ("322" === s.command) {
    (window.__gl = window.__gl || []).push({
        c: s.params[1],
        u: parseInt(s.params[2], 10) || 0,
        t: s.params[3] || ""
    });
    return;
} else if ("321" === s.command) {
    window.__gl = [];
    return;
} else if ("323" === s.command) {
    try {
        window.dispatchEvent(new CustomEvent("gamja-list", { detail: window.__gl || [] }));
    } catch (_e) {}
    return;
}
```

`321` starts the list, `322` is one row, `323` ends it. Returning early keeps those numerics out of
the message buffer. Cost: one string comparison per received message.

⚠️ Variable names are **minified and change on every build**: read them off your own bundle instead
of copying blindly. And rebuilding gamja **overwrites everything**, this hook included.

⚠️ If the bundle is served with a long `Cache-Control` (its name carries a content hash, so that is
the sane way to serve it), patching the file **in place is not enough** — browsers keep the cached
copy. Give the patched file a new name and point `index.html` at it; `index.html` itself must stay
`no-store`.

⚠️ **Do not wrap `window.WebSocket`** to intercept `/list`. The first iteration of this work did
exactly that, together with a document-wide observer, and the result was a sluggish gamja with
messages disappearing and reappearing.

## Two more optional bundle fixes

Unrelated to these customizations — they fix actual gamja defects:

- **The "Open buffer" dialog cannot be dismissed** (✕, Esc and click-outside do nothing, only
  *Open* works): unlike every other dialog it is rendered without an `onDismiss` prop, so `dismiss()`
  calls `undefined` and throws a TypeError. Pass it `onDismiss` like the others.
- **Joining a channel yanks you out of whatever you are reading**: `/join` records the target in
  `switchToChannel` and the switch happens when the server's `JOIN` confirmation arrives, with no
  timeout and no cancellation — so a slow join drags you away minutes later, from whichever buffer
  you had moved to (autojoin behaves the same on reconnect). Clear it at the top of `switchBuffer`,
  which is the one place every manual switch goes through, sidebar clicks and `Alt+↑/↓` and the
  `Ctrl+K` switcher alike: `switchBuffer(e){ this.switchToChannel=null; /* … */ }`. The intended
  jump still works, because the `JOIN` handler tests `switchToChannel` before calling.
- **History never loads on an already-read buffer**: in `restoreScrollPosition` the guard
  `if (!e.firstChild) return;` returns before `onScrollTop()`, so on an empty buffer the history
  fetch never fires. Make it `if (!e.firstChild) { this.props.onScrollTop(); return }`.

## Notes

- Nothing here is tied to any particular deployment: these files are plain browser-side CSS/JS and
  do not know, or care, where your gamja is hosted or how you reach it. The only place your own
  server appears is `config.json`, which you provide — it is not part of this repository.
- Settings live in the browser's `localStorage`, so they are **per-browser** and do not travel with
  the files: `gamja_theme`, `gamja_fs`, `gamja_list_rows`, `gamja_pins_side`.
- Search only covers the messages **currently rendered**. soju replays what is unread and the rest
  arrives as you scroll up, so searching further back means loading it first. Reaching real history
  would mean querying the bouncer, which is outside what browser-side files can do.
- The search dialog reads the buffer's lines and never mutates them; the only write is the temporary
  outline on the line you jump to, which a re-render drops on its own. Result rows are assembled with
  `createTextNode`, never `innerHTML`, since the text comes straight from IRC.
- The 📌 color is approximate. Emoji are drawn by a color font, so `color` has no effect on them; the
  picker derives a filter (`hue-rotate` + `saturate` + `brightness`) from the chosen color, so the
  hue follows the picker without matching it. A tinted SVG icon via `mask` is not an option either:
  gamja's CSP (`default-src 'self'`) blocks data URIs.
- Pinned ordering is done with `style.order` and a `data-pin` attribute written onto the `<li>`
  elements. Neither is a prop preact manages, so both survive re-renders — a `class` would be
  rewritten on the next update.
- The *Extra* button and the 📌 are re-injected by a light interval check (1s and 700ms), **not** by a
  MutationObserver: nodes appended inside preact's tree get removed on the next re-render.
- Sidebar hrefs do not carry the network, so on a multi-network bouncer the same `#channel` present
  on two networks gets pinned on both.
- The `/help` styling derives its cues from `currentColor` rather than the theme variables, so
  commands stay distinguishable under any color combination — including one where the accent and the
  text color are set to the same value.
- ⚠️ **gamja bug worth knowing about if you force a theme:** `kbd` gets a light chip
  (`background:#f0f0f0`) that is only corrected inside `@media (prefers-color-scheme: dark)`. Since
  the dark theme here is forced regardless of the system setting, running the OS in *light* mode
  leaves pale text on a pale chip and the key bindings in `/help` vanish. `custom.css` overrides
  `kbd` with a chip derived from `currentColor`, which does not depend on the system theme at all.
- Only the Option+letter combinations gamja actually binds are translated on macOS. Translating
  every one of them would break typing special characters (`Option+a` for `å`) in the composer, so
  the table has to be kept in sync if gamja gains a new Alt+letter shortcut.
- The Alt+↑/↓ override is a capture listener on `window`, which runs before gamja's bubble listener
  on the same target and stops it with `stopPropagation()` — otherwise both would move and the
  buffer would jump twice.
- The unread dot only signals presence, never a count: gamja's `unread` is a three-level enum
  (`NONE` / `MESSAGE` / `HIGHLIGHT`), so no number exists to show. Getting one would mean reading
  preact's internal state through mangled property names, or wrapping the WebSocket — the very thing
  that made gamja sluggish the first time round. The dot inherits `currentColor`, so it follows the
  Accent and Mention colors on its own.
- ⚠️ **Second gamja bug of the same family as the `kbd` one:** the Accent color for channels with
  activity is only declared inside `@media (prefers-color-scheme: dark)`. With the dark theme forced
  regardless of the system setting, running the OS in *light* mode fell back to a hardcoded orange
  and the panel's *Accent* entry had no effect on the channel list. `custom.css` declares it
  unconditionally.
- Blocks that live outside the panel's closure add their rows through two events, `gamja-extra-panel`
  and `gamja-extra-reset`. If nothing listens, nothing happens.
- ⚠️ **`--activity-color` was a dead variable in gamja**: declared, offered as *Channel activity*,
  and used by nothing at all — the color picker did nothing. It now drives a channel with activity in
  the left list, falling back to `--green`, so the look is unchanged until you touch it.
- ⚠️ **Third member of the `kbd` family**: `a{color:var(--green)}` is also declared only inside
  `@media (prefers-color-scheme: dark)`, so with the dark theme forced and the OS in *light* mode
  links lost the theme color. The `--link-color` rule is unconditional and fixes that too. It is
  written as `#buffer a:not(.nick):not(.timestamp)` on purpose: nicknames **and timestamps** are
  `<a>` inside `#buffer` as well (`a.nick`, `a.timestamp`), and an id selector overrides the colors
  gamja gives them. Miss one and setting the link color silently repaints it.
- CSP-safe: no inline styles or scripts, colors are applied through the CSSOM.
- **Mobile is not supported.** It was attempted and abandoned: on iPhone Safari, elements appended to
  `<body>` outside preact's tree only ever receive `pointerdown`, never `click`/`touchend`, which
  makes custom tap controls unreliable. If you try again, restyle gamja's native elements rather than
  overlaying your own.

## Licenses

`custom.css` and `custom.js` are original work. gamja itself is **AGPL-3.0** and is not included
here. **JetBrains Mono** is licensed under the **SIL Open Font License 1.1**; its license text ships
with the fonts in [`fonts/OFL.txt`](fonts/OFL.txt).
