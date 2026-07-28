# gamja — customizations

A set of customizations for [gamja](https://codeberg.org/emersion/gamja), the web IRC client, as
used in front of a [soju](https://codeberg.org/emersion/soju) bouncer. Everything in `custom.css` +
`custom.js` is **zero-invasive**: no changes to gamja's bundle, no `WebSocket` wrapper, no
`MutationObserver` watching message rendering.

The one exception is the `/list` dialog, which needs **a small hook inside the bundle** (documented
below). Without it everything else still works and the dialog simply never opens.

Desktop only.

![gamja with these customizations](screenshot.png)

*Pinned channels at the top of the list, the 📌 next to the user count, JetBrains Mono and the dark
theme.*

## What it adds

**"Extra" panel** — a button injected next to *Settings* in the bouncer view:

- **text zoom** A−/A+ (0.3× → 1.8×), applied through the `--fs` CSS variable
- **max rows in the `/list` dialog** (default 2000, range 100–50000) with a warning above 5000
- **theme colors**: background, text, side panels, buttons, mentions, channel activity — plus a few
  things gamja does not expose:
  `--bl-background` / `--bl-color` (background and text of the left channel list *only*, which gamja
  otherwise shares with the member list through `--sidebar-background`) and
  `--bl-active-bg` / `--bl-active-color` (the selected channel, **hardcoded** to `#fff` in gamja).
  `--green` and `--red` are relabelled *Accent* and *Alert*, because that is what they actually
  drive: links / unread / operators / online for the first, errors and offline status for the second.

**Channel pinning (senpai-style)** — a 📌 in the member list header, next to *N users*: pins the open
channel and floats it to the top of the channel list, right below the bouncer row, with a 📌 in front
of its name.

**`/list` dialog** — sortable channel list (by user count or name), filter on name and topic,
*shown / total* counter, click a row to join.

**Command history ↑/↓** in the composer, shell style (deduplicated, capped at 200 entries).

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

3. gamja's `config.json`, pointing at your own bouncer:

   ```json
   {
     "server": {
       "url": "wss://EXAMPLE.invalid/socket",
       "auth": "mandatory"
     }
   }
   ```

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

⚠️ **Do not wrap `window.WebSocket`** to intercept `/list`. The first iteration of this work did
exactly that, together with a document-wide observer, and the result was a sluggish gamja with
messages disappearing and reappearing.

## Two more optional bundle fixes

Unrelated to these customizations — they fix actual gamja defects:

- **The "Open buffer" dialog cannot be dismissed** (✕, Esc and click-outside do nothing, only
  *Open* works): unlike every other dialog it is rendered without an `onDismiss` prop, so `dismiss()`
  calls `undefined` and throws a TypeError. Pass it `onDismiss` like the others.
- **History never loads on an already-read buffer**: in `restoreScrollPosition` the guard
  `if (!e.firstChild) return;` returns before `onScrollTop()`, so on an empty buffer the history
  fetch never fires. Make it `if (!e.firstChild) { this.props.onScrollTop(); return }`.

## Notes

- Settings live in the browser's `localStorage`, so they are **per-browser** and do not travel with
  the files: `gamja_theme`, `gamja_fs`, `gamja_list_rows`, `gamja_pins_side`.
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
- CSP-safe: no inline styles or scripts, colors are applied through the CSSOM.
- **Mobile is not supported.** It was attempted and abandoned: on iPhone Safari, elements appended to
  `<body>` outside preact's tree only ever receive `pointerdown`, never `click`/`touchend`, which
  makes custom tap controls unreliable. If you try again, restyle gamja's native elements rather than
  overlaying your own.

## Licenses

`custom.css` and `custom.js` are original work. gamja itself is **AGPL-3.0** and is not included
here. **JetBrains Mono** is licensed under the **SIL Open Font License 1.1**; its license text ships
with the fonts in [`fonts/OFL.txt`](fonts/OFL.txt).
