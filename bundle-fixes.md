# Optional bundle fixes

Three gamja defects, for whoever does not rebuild. Building from source? Take
[`patches/`](patches) instead — same fixes against the real files.

Each is a hand edit inside `build.*.js`: minified names change on every build, a rebuild overwrites
everything, and a cached bundle needs the patched file **renamed** — ⚠️ never to a name already served.

- **The "Open buffer" dialog cannot be dismissed** (✕, Esc and click-outside do nothing): it is the one
  dialog rendered without an `onDismiss` prop, so `dismiss()` calls `undefined` and throws. Pass it
  `onDismiss` like the others.
- **A slow `/join` yanks you out of whatever you are reading**: the target is recorded and the switch
  happens when the server's `JOIN` arrives, with no timeout and no cancellation, so it can drag you away
  minutes later (autojoin does the same on reconnect). Clear `switchToChannel` at the top of
  `switchBuffer`, where every manual switch goes through. The intended jump still works, because the
  `JOIN` handler tests the field first.
- **History never loads on an already-read buffer**: in `restoreScrollPosition` the `!firstChild` guard
  returns before `onScrollTop()`. Call it before returning. ⚠️ It does not catch every case — a channel
  can still render empty, which is what the ⟳ button is for.

---

Back to the [README](README.md).
