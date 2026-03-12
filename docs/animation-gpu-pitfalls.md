# Animation & GPU Pitfalls in React/Next.js

Reference guide for avoiding browser crashes, flickering, and rendering glitches caused by CSS filters and animation libraries. Derived from real production bugs — not theoretical.

---

## 1. backdrop-filter: blur() on Persistent Elements

### The Bug

Chrome freezes or crashes entirely (all tabs, not just one) when `backdrop-filter: blur()` is applied to elements visible during animations.

### Why

Chrome uses a single GPU process for all tabs. `backdrop-filter: blur()` forces the GPU to render everything behind the element, apply a Gaussian blur kernel, and composite the result — on every animation frame. Two simultaneous blur elements (e.g. sticky header + sticky footer) during a 500ms animation = ~60 blur recomputations. On integrated GPUs or memory-constrained systems, this overwhelms the GPU process and freezes the entire browser.

### The Pattern

```
sticky/fixed element with backdrop-blur
  + animated content behind it (transitions, motion, scroll)
  = GPU overload risk
```

Common locations:
- Sticky headers/footers with `backdrop-blur-sm`
- Modal/dialog overlays
- Sheet/drawer backdrops
- Floating toolbars

### How to Detect

Search codebase:
```bash
grep -r "backdrop-blur\|backdrop-filter" --include="*.tsx" --include="*.css"
```

If any match is on a persistently-visible element while animations run nearby, it's a risk.

### The Fix

Replace `backdrop-blur` with higher opacity. The visual difference is negligible.

```diff
- bg-background/80 backdrop-blur-sm
+ bg-background/95
```

### Verification

```js
// Run in Chrome DevTools console
const els = Array.from(document.querySelectorAll('*')).filter(el => {
  const s = getComputedStyle(el);
  return s.backdropFilter && s.backdropFilter !== 'none';
});
console.log('backdrop-filter elements:', els.length); // Should be 0
```

### References

- [shadcn-ui #327](https://github.com/shadcn-ui/ui/issues/327)
- [shadcn-ui #830](https://github.com/shadcn-ui/ui/issues/830)
- [Framer Motion #985](https://github.com/framer/motion/issues/985)
- [Framer Motion #2049](https://github.com/framer/motion/issues/2049)

---

## 2. Spring Animations Inside AnimatePresence

### The Bug

Framer Motion's `AnimatePresence mode="wait"` shows both the exiting and entering elements simultaneously. Content overlays, flickers, or "ghosts" — especially on macOS Chrome.

### Why

`mode="wait"` unmounts the old child only after its exit animation completes. Spring animations have **no fixed duration** — they settle when velocity drops below an internal threshold. That threshold check depends on:

- Frame timing (varies by OS, GPU compositor, refresh rate)
- Floating-point precision (differs between Metal on Mac and DirectX on Windows)
- Animation frame scheduling under load

If the spring doesn't settle cleanly, the exit never signals completion. AnimatePresence gets stuck — the old element stays mounted, the new element mounts anyway, and both are visible.

This is worse with rapid state changes (clicking Next quickly) because AnimatePresence's internal queue gets out of sync.

### The Pattern

```tsx
// RISKY: spring + AnimatePresence mode="wait"
<AnimatePresence mode="wait">
  <motion.div
    key={step}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
  />
</AnimatePresence>
```

### How to Detect

Search codebase:
```bash
grep -r "type.*spring" --include="*.tsx"
```

If any spring is inside or near an `AnimatePresence` with `mode="wait"`, it's a risk.

### The Fix

Replace springs with tweens. Tweens have a fixed duration — they complete at exactly the specified time on every platform.

```diff
  transition={
-   type: "spring",
-   stiffness: 300,
-   damping: 30,
-   opacity: { duration: 0.2 },
+   type: "tween",
+   duration: 0.25,
+   ease: "easeOut",
  }
```

**Duration guidelines:**
- Step/page transitions: `0.2s–0.3s` with `easeOut`
- Progress bars / decorative fills: `0.3s–0.4s` with `easeOut`
- Micro-interactions (hover, press): `0.15s` with `easeOut`

**When springs are still fine:**
- Drag gestures (springs respond to velocity naturally)
- Bouncy interactions not gated by AnimatePresence
- Isolated animations with no exit/enter lifecycle dependency

### References

- [Framer Motion #2554](https://github.com/framer/motion/issues/2554) — AnimatePresence gets stuck with rapid state changes
- [Framer Motion #2023](https://github.com/framer/motion/issues/2023) — AnimatePresence doesn't update with latest state

---

## 3. Radix Controlled/Uncontrolled Switch

### The Bug

React console warning: "Component is changing from uncontrolled to controlled." Fires repeatedly during normal usage.

### Why

Radix UI components (ToggleGroup, Select, etc.) use `useControllableState` internally. Passing `undefined` as the value prop starts the component in uncontrolled mode (it manages its own internal state). When the user interacts and the parent updates state to a real value, the component switches to controlled mode mid-lifecycle.

This doesn't crash the browser — Radix handles it gracefully. But it's an anti-pattern that fires warnings, creates internal state inconsistency, and makes debugging harder.

### The Pattern

```tsx
// WRONG: null maps to undefined, starts uncontrolled
<ToggleGroup
  value={value === null ? undefined : value ? "yes" : "no"}
/>

// WRONG: missing value prop entirely when state is null
<Select value={selectedItem ?? undefined} />
```

### The Fix

Always pass a controlled value. Use empty string for "nothing selected."

```diff
- value={value === null ? undefined : value ? "yes" : "no"}
+ value={value === null ? "" : value ? "yes" : "no"}
```

For Select components:
```diff
- value={selectedItem ?? undefined}
+ value={selectedItem ?? ""}
```

### How to Detect

Open Chrome DevTools console during component interaction. If you see "changing from uncontrolled to controlled" warnings, trace which component fires them.

Or search for the pattern:
```bash
grep -rn "?? undefined\|=== null ? undefined" --include="*.tsx"
```

---

## Quick Checklist for New Projects

1. **Search for `backdrop-blur`** on any sticky/fixed/overlay element. Remove if animations run behind it.
2. **Search for `type: "spring"`** inside or near `AnimatePresence`. Replace with `tween` + fixed duration.
3. **Search for `?? undefined`** or `=== null ? undefined` in Radix component value props. Use empty string instead.
4. **Test on both Mac and Windows Chrome** — GPU compositing and animation frame timing differ between platforms.
5. **Test with Chrome DevTools Performance tab** — record during animations, look for long "Composite Layers" tasks.
