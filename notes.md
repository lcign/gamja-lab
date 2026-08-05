# Notes

Traps and constraints behind the customizations in the [README](README.md). Nothing here is needed to
install them.

## Living beside preact

- Nodes added inside gamja's tree are wiped on the next render, so they are **re-injected on a light
  interval** (700 ms – 1 s), never with a `MutationObserver` on message rendering.
- Ordering and labels are carried by **`style.order` and `data-*` attributes** on the `<li>`, which
  preact does not manage and therefore does not overwrite. A `class` would be.
- Appending as the **last child** is tolerated; inserting between children upsets the diff. The group
  captions are `::before` pseudo-elements, out of flow, so no node enters the list at all.
- The composer is a **controlled input** submitting `this.state.text`: writing `input.value` is not
  enough, an `input` event has to be dispatched and a tick allowed before submitting.
- `attr()` reads only its **own** element, so a label drawn by `a::after` needs the attribute on the
  anchor, not on the `<li>`.
- An element has **one `::after`**. The network label and the unread dot both wanted it; the label sits
  on `a::after` (inside the link, so the whole row is clickable) and the dot on `li::after`.

## CSS in this file

- `custom.css` loads after gamja's, so conflicts are settled by **specificity and then order** — twice
  a later rule of ours silently overrode an earlier one (the half-highlighted row, a doubled dot).
- Selectors must exclude `a.nick` and `a.timestamp`: inside `#buffer` those are links too, and an id
  selector overrides the colours gamja gives them.
- State backgrounds (active, mention) go on the `<li>`, not the link: the link ends with the name, so
  painted there the highlight covers half a row.
- `overflow:hidden` on an `inline-block` moves its baseline and spaces **every** row apart; blockify it
  first.
- A flex item with `flex-basis:100%` takes part in the container's `max-content` width and blew the
  sidebar far past its longest name.
- Nick shortening is done on the **text**, not with `text-overflow`, which produced no ellipsis here at
  all. The original is kept in `data-full`; the nick is not `lastChild`, that is whitespace from the
  template's indentation.

## Three gamja rules declared only in a dark media query

`kbd`, the channel-activity colour and `a{color:var(--green)}` live inside
`@media (prefers-color-scheme: dark)`. The dark theme here is forced regardless of the system setting,
so with the OS in **light** mode those rules never applied: `/help` key chips went unreadable, and the
panel's *Accent* and link colours appeared to do nothing. `custom.css` declares all three
unconditionally. `--activity-color` was worse — declared by gamja, offered in its settings, and used by
nothing.

## Limits worth knowing

- Settings live in `localStorage`, so they are **per-browser** and do not travel with the files.
- The unread dot signals presence, never a count: gamja's `unread` is a three-level enum, so no number
  exists to show.
- Search covers the lines **currently rendered**. Reaching real history means querying the bouncer,
  which browser-side files cannot do.
- Sidebar hrefs do not carry the network: it is derived from DOM order, by walking up to the network
  row above. The same `#channel` on two networks therefore pins on both.
- Emoji (📌 🐇) are drawn by a colour font and ignore `color`; the pin picker approximates with a
  `hue-rotate` filter. A tinted SVG via `mask` is not an option either — gamja's CSP blocks `data:`
  URIs.
- Uploading needs the service to send **CORS headers**, or the browser posts the file and is not
  allowed to read the URL that comes back — the only thing wanted. Measured 2026-08-05: litterbox
  (`/image`) and tmpfiles.org send them, catbox.moe, uguu.se, x0.at and file.io do not, and 0x0.st has
  closed uploads. soju can host files itself, but that host has to be reachable by everyone in the
  channel, which means exposing the machine it runs on.
- **Mobile is not supported.** On iPhone Safari, elements appended to `<body>` outside preact's tree
  receive only `pointerdown`, never `click`/`touchend`, so custom tap controls are unreliable. Restyle
  gamja's native elements instead.

---

Back to the [README](README.md).
