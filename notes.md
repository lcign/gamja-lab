# Notes

Details, gotchas and things learned the hard way while building the customizations described in the
[README](README.md). Nothing here is needed to install them.

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

---

Back to the [README](README.md).
