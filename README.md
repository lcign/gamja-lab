# gamja — customizations

Customizations for [gamja](https://codeberg.org/emersion/gamja), the web IRC client, as used in front
of a [soju](https://codeberg.org/emersion/soju) bouncer. `custom.css` + `custom.js` sit beside gamja's
bundle and never touch it, so they survive a rebuild — two features also need the patches below.
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
  side or an unread **count** as a badge (needs the patch below; `?` where the tally is unknown),
  long nicks shortened.
- **Runs of messages**: repeated nick and timestamp dropped, wrapped lines indented into the text column.
- **⟳ reload** in the buffer header, for a channel that renders empty after joining.
- **`/paste`**: one message per line, or uploaded to dpaste.com and sent as a link — ⚠️ that leaves the
  network and expires in 7 days.
- **`/image`**: a picture chosen or dragged in goes to litterbox.catbox.moe and the link is sent — ⚠️ it
  leaves the network, and expires after the time set in the panel (1h to 72h).
- **`/list`** dialog, sortable and filterable. **Buffer search** with ⌘F over the rendered lines.
- **Image preview** and **link confirmation**, both off by default — ⚠️ the preview needs `img-src` in
  the page's CSP, see `index.html.example`.
- **`/ignore <nick>`** hides that person's lines, matching **nick and host**, so a nick change does not
  defeat it, and **`/ignoretext <words>`** hides any message containing them, whoever wrote it. Without
  an argument either command opens the list, with a *remove* per row (*Ignored people* in the panel does
  the same); `/unignore` and `/unignoretext` remove directly. Tab completes all four. ⚠️ Cosmetic: the
  messages still arrive and soju still stores them, and unread state stays gamja's business.
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
4. For the `/list` dialog and the unread count, apply the patches in [`patches/`](patches).

## Patches for gamja itself

Two features need gamja to report something it keeps to itself, and three are plain gamja defects.
All five live in [`patches/`](patches), against gamja **master** (`cdf94d6`) — source, not edits to a
built file. Applied and verified in this order on a clean clone (`eslint` clean, `parcel` builds):

```sh
git clone https://codeberg.org/emersion/gamja.git && cd gamja
for p in ../gamja-lab/patches/*.patch; do git apply "$p"; done
npm install && npm run build          # dist/ is what you deploy
```

| Patch | What it does | Needed by |
|---|---|---|
| `0001` | `window.gamjaUnread{Bump,Clear,ClearAll,Of}` on the unread transitions; the row reads its own count into `data-unread` while it renders | Unread count |
| `0002` | a `gamja-list` event with the LIST replies, numerics kept out of the buffer | `/list` dialog |
| `0003` | the *Open buffer* dialog gets `onDismiss`, so ✕, Esc and click-outside work | — |
| `0004` | a pending channel switch is cancelled when you switch yourself, so a slow JOIN cannot drag you away | — |
| `0005` | history is requested for a buffer that renders empty | ⟳ button rarely needed |

The first two are hooks, the others are fixes worth carrying regardless. Everything else here is
plain page files: gamja runs unpatched, it just keeps the defects and those two features stay off —
the *Extra* panel says so, greying the switch out when the build cannot report counts.

💡 The hooks are deliberately thin: gamja keeps the state it already kept, the tally lives on the
page, and nothing polls or observes the DOM.

Without a build step the same edits can be made by hand inside `build.*.js` — see
[`bundle-fixes.md`](bundle-fixes.md), and mind the caveats:
minified names change on every build, a rebuild overwrites the edit, and a bundle served with a long
`max-age` needs a **new filename** with `index.html` pointed at it. ⚠️ Never reuse a filename that
has already been served: browsers keep the old file and you end up debugging code that is not there.

⚠️ Do **not** wrap `window.WebSocket` to intercept `/list`. That was the first attempt, together with a
document-wide observer, and it left gamja sluggish with messages flickering in and out.

## More

- [**Optional bundle fixes**](bundle-fixes.md) — three gamja defects worth patching.
- [**Notes**](notes.md) — how the pieces hold together, and the traps behind them.

## Licenses

`custom.css` and `custom.js` are original work. gamja itself is **AGPL-3.0** and is not included here.
**JetBrains Mono** is under the **SIL Open Font License 1.1**, shipped with the fonts in
[`fonts/OFL.txt`](fonts/OFL.txt).
