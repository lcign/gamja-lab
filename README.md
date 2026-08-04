# gamja — customizations

Customizations for [gamja](https://codeberg.org/emersion/gamja), the web IRC client, as used in front
of a [soju](https://codeberg.org/emersion/soju) bouncer. `custom.css` + `custom.js` sit beside gamja's
bundle and never touch it, so they survive a rebuild — the one exception is the `/list` hook below.
Desktop only.

**Tested against gamja `master` at [`cdf94d6`](https://codeberg.org/emersion/gamja/commit/cdf94d6)
(2026-07-24).** Follow `master`, not the tags: the latest release, `v1.0.0-beta.11`, is from 2025-03-20
and 54 commits behind. These files hook gamja's DOM and CSS variables, not a stable API, so a newer
`master` can move things underneath them.

![gamja with these customizations](screenshot.png)

## What it adds

<img src="panel-options.png" alt="Extra panel, Options tab" width="330"> <img src="panel-colors.png" alt="Extra panel, Colors tab" width="330">

- **Extra panel** next to *Settings*, in two tabs: **29 theme colours**, each row drawn with the colours
  it sets, and the options below. *Reset* restores every default and leaves pinned channels alone.
- **Channel list**: 📌 pinning, marks for the bouncer and the networks, private messages in their own
  block, optional grouping of names shared across networks as `#channel@network`, unread dot on either
  side, long nicks shortened.
- **Runs of messages**: repeated nick and timestamp dropped, wrapped lines indented into the text column.
- **⟳ reload** in the buffer header, for a channel that renders empty after joining.
- **`/paste`**: one message per line, or uploaded to dpaste.com and sent as a link — ⚠️ that leaves the
  network and expires in 7 days.
- **`/list`** dialog, sortable and filterable. **Buffer search** with ⌘F over the rendered lines.
- **Image preview** and **link confirmation**, both off by default — ⚠️ the preview needs `img-src` in
  the page's CSP, see `index.html.example`.
- **Text shortcuts** `:shrug` `:tableflip` `:unflip`, on send and in what you receive.
- **Timestamp as plain text**, so a selection can start there; the permalink is an option.
- **Command history** ↑/↓, readable `/help`, working Option+letter shortcuts on macOS, `Alt+↑/↓` in the
  order you see.
- **Forced dark theme** with self-hosted JetBrains Mono.

Why any of it is done the way it is: [notes.md](notes.md). The code is commented where it matters.

## Install

1. Copy `custom.css`, `custom.js` and `fonts/` into your gamja directory.
2. In `index.html`, **after** the bundle tags:

   ```html
   <link rel=stylesheet href="custom.css?v=1">
   <script src="custom.js?v=1"></script>
   ```

   Bump `?v=N` on every change, or browsers keep serving the old file. Serve `index.html`,
   `config.json`, `custom.css` and `custom.js` as `Cache-Control: no-store`; the bundle and the fonts
   carry a content hash in their name and can be cached forever.

3. Copy `config.json.example` to `config.json` and point it at your own bouncer's WebSocket endpoint.
   ⚠️ It **must be on the same origin** as the page, or soju refuses the connection (*"request Origin
   … is not authorized for Host …"*). Nick, autojoin and networks are configured in soju, not here.
4. For the `/list` dialog, apply the bundle hook below.

## Bundle hook for `/list`

gamja does not surface `LIST` numerics, so the dialog is fed by an event. In `build.*.js`, inside
`handleMessage`, right after the message is parsed (that variable is `s` in this build):

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

`321` opens the list, `322` is one row, `323` ends it; returning early keeps them out of the buffer.

⚠️ Names are **minified and change on every build** — read them off your own bundle. Rebuilding gamja
**overwrites the hook**. And if the bundle is served with a long `max-age`, a patched file needs a
**new name** with `index.html` pointed at it, or the patch stays invisible.

⚠️ Do **not** wrap `window.WebSocket` to intercept `/list`. That was the first attempt, together with a
document-wide observer, and it left gamja sluggish with messages flickering in and out.

## More

- [**Optional bundle fixes**](bundle-fixes.md) — three gamja defects worth patching.
- [**Notes**](notes.md) — how the pieces hold together, and the traps behind them.

## Licenses

`custom.css` and `custom.js` are original work. gamja itself is **AGPL-3.0** and is not included here.
**JetBrains Mono** is under the **SIL Open Font License 1.1**, shipped with the fonts in
[`fonts/OFL.txt`](fonts/OFL.txt).
