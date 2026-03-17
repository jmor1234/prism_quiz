# Animation & GPU Pitfalls in React/Next.js

Reference guide for avoiding browser crashes, flickering, and rendering glitches caused by CSS compositing and animation libraries. Derived from real production bugs — not theoretical.

---

## 1. Framer Motion's JS Animation Loop (THE BIG ONE)

### The Bug

Chrome crashes or flickers on specific hardware (Intel integrated GPUs on Mac, particularly 2016–2020 dual-GPU MacBook Pros) during framer-motion step/page transitions. Disabling hardware acceleration fixes it. The issue does NOT appear on Apple Silicon Macs, Windows, or Safari.

### Why

Framer-motion animates individual transform properties (`x`, `y`, `scale`, `rotate`) via a **JavaScript requestAnimationFrame loop**, NOT on the GPU compositor thread. Every frame, it writes `element.style.transform = "translateX(40px) scale(0.975)"` to the DOM. Each write triggers:

1. Style recalculation
2. Full re-rasterization of the promoted compositor layer (every child DOM node repainted)
3. Re-compositing

A 250ms transition at 60fps = **~15 full GPU rasterization passes**. On weak GPUs (Intel UHD 630 running Chrome's new Skia Graphite/Metal renderer), this overwhelms the GPU process and Chrome's watchdog timer kills it — crashing every tab.

Only `opacity` uses WAAPI (Web Animations API) and runs on the compositor thread. Individual transform props (`x`, `y`, `scale`, `rotate`) never do — they always fall back to the JS loop.

### The Critical Insight

The difference between "JS-animated transform" and "CSS transition on transform" is not incremental — it's a **cliff edge**:

| | Framer-motion (`x`, `scale`) | CSS transition (`transform`) |
|---|---|---|
| Animation thread | Main thread (JS) | Compositor thread |
| Re-rasterizations per transition | ~15 (every frame) | **1** (initial paint only) |
| JS per frame | `style.transform = "..."` | None |
| Layer management | `will-change: transform` held during animation | Browser auto-promotes and auto-demotes |

CSS transitions animate the composite `transform` property directly. The browser rasterizes the layer once, then the compositor interpolates the transform matrix on the GPU with zero main-thread involvement.

### The Fix

Replace framer-motion `AnimatePresence` step transitions with **react-transition-group `SwitchTransition` + CSS transitions**.

**Install:**
```bash
npm install react-transition-group
npm install -D @types/react-transition-group
```

**CSS (in globals.css):**
```css
.step-enter {
  opacity: 0;
  transform: translateX(var(--step-x)) scale(0.95);
}
.step-enter-active {
  opacity: 1;
  transform: translateX(0) scale(1);
  transition: opacity 250ms ease-out, transform 250ms ease-out;
}
.step-exit {
  opacity: 1;
  transform: translateX(0) scale(1);
}
.step-exit-active {
  opacity: 0;
  transform: translateX(calc(var(--step-x) * -1)) scale(0.95);
  transition: opacity 250ms ease-out, transform 250ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .step-enter-active,
  .step-exit-active {
    transition-duration: 0ms;
  }
}
```

**Component:**
```tsx
import { SwitchTransition, CSSTransition } from "react-transition-group";

export function StepTransition({ stepKey, direction, children }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className="w-full max-w-md"
      style={{ "--step-x": direction === "forward" ? "80px" : "-80px" } as React.CSSProperties}
    >
      <SwitchTransition mode="out-in">
        <CSSTransition key={stepKey} nodeRef={nodeRef} timeout={250} classNames="step">
          <div ref={nodeRef}>{children}</div>
        </CSSTransition>
      </SwitchTransition>
    </div>
  );
}
```

**Key mapping:**
- `SwitchTransition mode="out-in"` = `AnimatePresence mode="wait"`
- `appear={false}` (default) = `initial={false}`
- `nodeRef` required for React 19 (avoids removed `findDOMNode`)
- Direction via CSS custom property `--step-x` on a **parent wrapper** (not the animated child — the exiting child needs to read the current direction, not its original one)
- Reduced motion via CSS `@media` query instead of `useReducedMotion()` hook

### When Framer-Motion IS Fine

- **Progress bar width animations** — simple, infrequent, tiny element
- **One-shot entrance fades** — single opacity animation via WAAPI, no JS loop
- **Drag gestures** — springs respond to velocity naturally
- **Accordion height animations** — `height: "auto"` is a framer-motion-only feature CSS can't replicate
- **Anything not inside a rapid enter/exit lifecycle** (AnimatePresence)

### How to Detect

```bash
# Find AnimatePresence with transform animations (the dangerous pattern)
grep -rn "AnimatePresence" --include="*.tsx"
# Then check if the motion.div inside animates x, y, scale, or rotate
```

If you see `x:`, `y:`, `scale:`, or `rotate:` inside a `motion.div` wrapped by `AnimatePresence`, it's running a JS animation loop during every transition. Replace with CSS transitions.

---

## 2. Semi-Transparent Overlays During Animations

### The Bug

Sticky headers/footers with `bg-background/95` (95% opacity) force the GPU to alpha-blend on every animation frame. Content behind them can never be culled by the compositor.

### Why

The difference between 100% and 95% opacity is binary at the compositor level:

| | 100% opaque | 95% opaque |
|---|---|---|
| GPU operation | Write-only | Read + Write (2x bandwidth) |
| Occlusion culling | Layers behind are **skipped** | Layers behind are **always drawn** |

### The Fix

```diff
- bg-background/95
+ bg-background
```

The visual difference without `backdrop-blur` is imperceptible. The GPU difference is significant.

---

## 3. backdrop-filter: blur() on Persistent Elements

### The Bug

Chrome freezes or crashes entirely when `backdrop-filter: blur()` is applied to elements visible during animations.

### Why

Chrome uses a single GPU process for all tabs. `backdrop-filter: blur()` forces the GPU to render everything behind the element, apply a Gaussian blur kernel, and composite the result — on every animation frame. Two simultaneous blur elements during a 500ms animation = ~60 blur recomputations.

### The Fix

Remove `backdrop-blur` from any element that overlaps animated content. Use higher opacity instead.

```diff
- bg-background/80 backdrop-blur-sm
+ bg-background
```

### How to Detect

```bash
grep -r "backdrop-blur\|backdrop-filter" --include="*.tsx" --include="*.css"
```

---

## 4. Infinite Framer-Motion Animations Inside AnimatePresence

### The Bug

Loading skeletons with `repeat: Infinity` framer-motion animations inside an `AnimatePresence` container cause GPU stress during exit animations. The parent is trying to exit-animate while the children run infinite JS animation loops.

### The Fix

Use CSS `@keyframes` for infinite animations (shimmer, pulse, dots). CSS infinite animations run on the compositor thread and are cleaned up instantly when the DOM element is removed.

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.85; }
}
```

```tsx
// Before (framer-motion — JS loop)
<motion.div animate={{ opacity: [0.5, 0.85, 0.5] }} transition={{ repeat: Infinity }} />

// After (CSS — compositor thread)
<div className="animate-[skeleton-pulse_1.8s_ease-in-out_infinite]" />
```

---

## 5. Spring Animations Inside AnimatePresence

### The Bug

`AnimatePresence mode="wait"` shows both exiting and entering elements simultaneously with spring transitions.

### Why

Spring animations have no fixed duration — they settle based on velocity thresholds that vary by GPU, OS, and frame timing. If the spring doesn't settle cleanly, the exit never completes and both elements are visible.

### The Fix

Use tweens (fixed duration) or CSS transitions (see section 1).

```diff
- type: "spring", stiffness: 300, damping: 30
+ type: "tween", duration: 0.25, ease: "easeOut"
```

---

## 6. Radix Controlled/Uncontrolled Switch

### The Bug

React warning: "Component is changing from uncontrolled to controlled."

### The Fix

Always pass a controlled value. Use empty string for "nothing selected."

```diff
- value={value === null ? undefined : value ? "yes" : "no"}
+ value={value === null ? "" : value ? "yes" : "no"}
```

---

## Diagnosing GPU Issues

When a user reports Chrome crashes, flickering, or duplicate overlay glitches:

### Step 1: Confirm it's GPU-related

Have the user go to **Chrome Settings → System → "Use graphics acceleration when available"** → toggle OFF → Relaunch. If the issue stops, it's GPU-related.

### Step 2: Get their GPU info

Have them visit `chrome://gpu` and send the top section. Look for:
- **Skia Backend**: `GraphiteDawnMetal` = new renderer (less tested on Intel)
- **Active GPU**: Check if it's Intel integrated vs discrete
- **Problems Detected / Driver Bug Workarounds**: lists known issues for their GPU

### Step 3: Identify the hardware pattern

The highest-risk configuration (as of 2025-2026):
- **2016–2020 15"/16" MacBook Pros** with Intel + AMD dual GPU
- Chrome defaults to the **Intel integrated GPU** (weaker, less-tested Metal driver)
- Chrome's **Skia Graphite** renderer (new, primarily validated on Apple Silicon)
- This affects ~0.5% of Mac Chrome users and is shrinking as Intel Macs age out

### Step 4: User-side fixes (if code changes aren't enough)

In order of simplicity:
1. **`chrome://flags/#use-angle`** → set to **"OpenGL"** → Relaunch (bypasses Metal)
2. **System Settings → Battery → Options → "Automatic graphics switching" OFF** (forces discrete GPU; costs battery)
3. Launch Chrome with `--disable-skia-graphite` (reverts to old Ganesh renderer)

---

## Checklist for New Projects

### Before shipping

1. **Step/page transitions**: Use CSS transitions (react-transition-group) or opacity-only framer-motion. Never animate `x`, `y`, `scale`, `rotate` inside AnimatePresence with framer-motion.
2. **No `backdrop-blur`** on any element that overlaps animated content.
3. **Fully opaque sticky bars**: `bg-background` not `bg-background/95` if animations run behind them.
4. **Infinite animations in CSS**: Shimmer, pulse, dots — always CSS `@keyframes`, never framer-motion `repeat: Infinity`.
5. **`overflow-hidden`** on containers that hold slide animations (prevents layout overflow).
6. **Reduced motion**: Respect `prefers-reduced-motion` via CSS `@media` query or `useReducedMotion()`.

### Testing

1. Test on **Mac Chrome** (if possible, on an older Intel MacBook Pro).
2. If no Intel Mac available, use **Chrome DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion"** and verify instant transitions.
3. Open **Chrome DevTools → Layers panel** during animations — check compositor layer count.
4. Open **Chrome DevTools → Performance tab** — record during transitions, look for long "Composite Layers" or "Paint" tasks.

### The core principle

**CSS transitions on `transform` and `opacity` run on the compositor thread. Framer-motion's individual transform props (`x`, `y`, `scale`, `rotate`) run on the main thread via JS.** This is the fundamental distinction. When in doubt, use CSS.
