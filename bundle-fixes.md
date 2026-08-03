# Optional bundle fixes

Fixes for gamja defects, unrelated to the customizations here — gamja works without them, it just keeps
the bugs. Each is a hand edit inside `build.*.js`, so the caveats of the
[`/list` hook](README.md#bundle-hook-for-list) apply: minified names change on every build, a rebuild
overwrites everything, and a cached bundle needs the patched file **renamed**.

- **The "Open buffer" dialog cannot be dismissed** (✕, Esc and click-outside do nothing): unlike every
  other dialog it is rendered without an `onDismiss` prop, so `dismiss()` calls `undefined` and throws.
  Pass it `onDismiss` like the others.
- **A slow `/join` yanks you out of whatever you are reading**: the target is recorded in
  `switchToChannel` and the switch happens when the server's `JOIN` confirmation arrives, with no
  timeout and no cancellation — so it can drag you away minutes later, from wherever you moved to
  (autojoin behaves the same on reconnect). Clear it at the top of `switchBuffer`, the one place every
  manual switch goes through: `switchBuffer(e){ this.switchToChannel=null; /* … */ }`. The intended jump
  still works, because the `JOIN` handler tests the field before calling.
- **History never loads on an already-read buffer**: in `restoreScrollPosition` the guard
  `if (!e.firstChild) return;` returns before `onScrollTop()`. Make it
  `if (!e.firstChild) { this.props.onScrollTop(); return }`. Note this does not catch every case — a
  channel can still render empty, which is what the ⟳ button is for.

---

Back to the [README](README.md).
