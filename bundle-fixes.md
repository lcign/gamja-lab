# Optional bundle fixes

Fixes for actual gamja defects, unrelated to the customizations in this repository — gamja works
without them, it just keeps the bugs. Each one is a hand edit inside `build.*.js`, so the caveats of
the [`/list` hook](README.md#bundle-hook-for-list) apply here too: **variable names are minified and
change on every build**, **rebuilding gamja overwrites everything**, and if the bundle is served with
a long `Cache-Control` the patched file needs a **new name** with `index.html` pointed at it.

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

---

Back to the [README](README.md).
