# Notes

Traps and constraints behind the customizations in the [README](README.md). Nothing here is needed to
install them.

## Living beside preact

- Nodes added inside gamja's tree are wiped on the next render, so they are re-injected on a light
  interval, never with a `MutationObserver` on message rendering.
- Ordering and labels ride on **`style.order` and `data-*` attributes**, which preact does not manage
  and therefore does not overwrite. A `class` would be.
- Appending as the **last child** is tolerated; inserting between children upsets the diff.
- The composer is a **controlled input** submitting `this.state.text`: writing `input.value` is not
  enough, an `input` event has to be dispatched and a tick allowed before submitting.
- `attr()` reads only its **own** element, so a label drawn by `a::after` needs the attribute on the
  anchor, not on the `<li>`.
- An element has **one `::after`**. The network label and the unread mark both wanted it: the label
  won `a::after`, so the whole row stays clickable, and the mark moved to `li::after`.
- A custom property is substituted as **text**, so `em` inside it resolves against whoever *reads* it —
  in a mark with its own `font-size` the caption height came out ~72% of the truth. `@property` with
  `syntax:"<length>"` resolves it where it is declared.

## CSS in this file

- `custom.css` loads after gamja's, so conflicts are settled by **specificity and then order** — twice
  a later rule of ours silently overrode an earlier one (the half-highlighted row, a doubled dot).
- Selectors must exclude `a.nick` and `a.timestamp`: inside `#buffer` those are links too, and an id
  selector overrides the colours gamja gives them.
- State backgrounds (active, mention) go on the `<li>`, not the link: the link ends with the name, so
  painted there the highlight covers half a row.
- `overflow:hidden` on an `inline-block` moves its baseline and spaces **every** row apart.
- A flex item with `flex-basis:100%` takes part in the container's `max-content` width and blew the
  sidebar far past its longest name.
- A scrollbar sits **on top** of the content: without `scrollbar-gutter:stable` it covered the unread
  badge and stole the clicks from the checkboxes at the right edge of the panel.
- `text-overflow` produced no ellipsis on nicks here at all, hence shortening the text itself.

## Three gamja rules declared only in a dark media query

`kbd`, the channel-activity colour and `a{color:var(--green)}` live inside
`@media (prefers-color-scheme: dark)`. The dark theme here is forced regardless of the system setting,
so with the OS in **light** mode those rules never applied: `/help` key chips went unreadable, and the
panel's *Accent* and link colours appeared to do nothing. `custom.css` declares all three
unconditionally. `--activity-color` was worse — declared by gamja, offered in its settings, and used by
nothing.

## Limits worth knowing

- Settings live in `localStorage`, so they are **per-browser** and do not travel with the files.
- gamja's `unread` is a three-level enum: **no count exists**, hence the tally on the page. It is lost
  on reload, and a row gamja calls unread with no tally behind it shows a **`?`** rather than an
  invented number — rare since `patches/0007`.
- ⚠️ `getReceipt(stored, type)` in `components/app.js` **ignores `type`** and always returns the read
  receipt. Left alone on purpose: fixing it also moves where `fetchBacklog` starts from, which can fetch
  *less* history for a quiet buffer. Worth reporting upstream, not patching blind.
- ⚠️ `isReceiptBefore()` counts equal times as *before*, and equal is the normal case for a channel read
  to its end. It cost `patches/0007` a first version that cleared nothing.
- An ignored sender is vetoed **before** gamja raises the unread state: subtracting from the count
  afterwards would leave the row lit with a count of zero, which shows as `?`.
- Search covers the lines **currently rendered**. Reaching real history means querying the bouncer,
  which browser-side files cannot do.
- Sidebar hrefs do not carry the network: it comes from DOM order. The same `#channel` on two networks
  therefore pins on both.
- The composer grows because `patches/0006` makes it a textarea — as a hand edit to the built file it
  was a mess, because **ScrollManager already watches the buffer with a `ResizeObserver`** and our own
  re-pinning was fighting it. ⚠️ Six selectors here look for the composer; miss one and `/paste`,
  `/image`, history or spell check die in silence.
- Emoji (📌 🐇) are drawn by a colour font and ignore `color`; the pin picker approximates with a
  `hue-rotate` filter. A tinted SVG via `mask` is not an option either — gamja's CSP blocks `data:`
  URIs.
- Uploading needs the service to send **CORS headers**, or the browser posts the file and is not
  allowed to read the URL that comes back — the only thing wanted. Measured 2026-08-05: litterbox
  (`/image`) and tmpfiles.org send them, catbox.moe, uguu.se, x0.at and file.io do not, and 0x0.st has
  closed uploads. soju can host files itself, but that host has to be reachable by everyone in the
  channel, which means exposing the machine it runs on.
- **Mobile is not supported.** On iPhone Safari, elements appended to `<body>` outside preact's tree
  receive only `pointerdown`, never `click`/`touchend`, so custom tap controls are unreliable.

---

Back to the [README](README.md).
