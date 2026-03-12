# Prism Design System — Color Scheme & Visual Patterns

A complete reference for replicating the Prism brand visual identity in new projects.

---

## Brand Color Palette

### Primary Brand Colors (The Core)

| Token | Hex | Usage |
|-------|-----|-------|
| `--quiz-gold` | `#C9A36A` | Primary accent — buttons, headings, focus rings, progress bars |
| `--quiz-gold-dark` | `#B8935D` (light) / `#DAB87A` (dark) | Hover states, depth, gradient endpoints |
| `--quiz-cream` | `#EEDEC5` (light) / `#3A3530` (dark) | Secondary/ambient — background gradients, subtle hover fills |
| `--quiz-text-on-gold` | `#3D3225` (light) / `#1a1815` (dark) | Text rendered on gold backgrounds |

**Key insight:** The gold stays identical (`#C9A36A`) across light/dark modes to maintain brand consistency. The supporting colors shift to maintain contrast.

### Dark Mode Background

```
#262624  — Dark charcoal (not pure black — warmer, easier on eyes)
```

---

## Neutral System (OKLch Color Space)

The entire neutral scale uses OKLch for perceptual uniformity.

### Light Mode

```css
--background: oklch(1 0 0);            /* Pure white */
--foreground: oklch(0.145 0 0);        /* Near black text */
--primary: oklch(0.205 0 0);           /* Very dark — buttons, emphasis */
--primary-foreground: oklch(0.985 0 0); /* Near white on dark buttons */
--secondary: oklch(0.97 0 0);          /* Light gray — subtle backgrounds */
--muted: oklch(0.97 0 0);             /* Muted backgrounds */
--muted-foreground: oklch(0.556 0 0);  /* Medium gray — secondary text */
--border: oklch(0.922 0 0);           /* Light gray borders */
--input: oklch(0.922 0 0);            /* Input borders */
--ring: oklch(0.708 0 0);             /* Focus ring fallback */
--destructive: oklch(0.577 0.245 27.325); /* Red-orange errors */
```

### Dark Mode

```css
--background: #262624;                 /* Warm dark charcoal */
--foreground: oklch(0.985 0 0);        /* Near white */
--primary: oklch(0.922 0 0);           /* Light for contrast flip */
--primary-foreground: oklch(0.205 0 0);
--secondary: oklch(0.269 0 0);         /* Dark gray */
--muted: oklch(0.269 0 0);
--muted-foreground: oklch(0.708 0 0);  /* Lighter gray for readability */
--border: oklch(1 0 0 / 10%);         /* White at 10% — subtle separation */
--input: oklch(1 0 0 / 15%);          /* White at 15% */
--ring: oklch(0.556 0 0);
--destructive: oklch(0.704 0.191 22.216);
```

**Pattern:** Dark mode borders use white with very low opacity (10-15%) rather than solid gray values. This creates softer, more integrated separation.

---

## Gradient Patterns

### 1. Brand Cover Gradient (Linear — Top to Bottom)

```css
background: linear-gradient(to bottom, #EEDEC5 0%, #C9A36A 50%, #B8935D 100%);
```

Cream → Gold → Dark Gold. Used for full-bleed hero/cover sections.

### 2. Background Ambient Gradient (Radial)

```css
/* Light mode */
background:
  radial-gradient(ellipse at top center, var(--quiz-cream) 0%, transparent 50%),
  var(--background);

/* Dark mode — tighter fade */
background:
  radial-gradient(ellipse at top center, var(--quiz-cream) 0%, transparent 40%),
  var(--background);
```

Subtle top-center cream glow layered over the base background. Creates warmth without competing with content. Dark mode uses a tighter fade (40% vs 50%).

### 3. Progress/Accent Gradient (Linear — Horizontal)

```css
/* SVG linearGradient or CSS */
background: linear-gradient(to right, #C9A36A, #B8935D);
```

Gold → Dark Gold horizontal. Used on progress bars, accent stripes.

---

## Interactive Element Patterns

### Button Accent System

```js
// Reusable accent config
const ACCENT = {
  base: "bg-[var(--quiz-gold)] hover:bg-[var(--quiz-gold-dark)] border-[var(--quiz-gold)]",
  light: "bg-[var(--quiz-gold)]/80 hover:bg-[var(--quiz-gold)] border-[var(--quiz-gold)]/80",
  text: "text-[var(--quiz-text-on-gold)]",
  ring: "ring-[var(--quiz-gold)]/20",
};
```

### Selected/Active States

- **Background:** `bg-[var(--quiz-gold)]`
- **Hover:** `hover:bg-[var(--quiz-gold-dark)]`
- **Shadow (selected):** `shadow-lg shadow-[var(--quiz-gold)]/25`
- **Shadow (hover selected):** `shadow-xl shadow-[var(--quiz-gold)]/30`

### Unselected/Hover States

- **Hover fill:** `hover:bg-[var(--quiz-cream)]/50` — cream at 50% opacity
- **Expanded/active fill:** `bg-[var(--quiz-cream)]/20` — cream at 20%
- **Row hover:** `hover:bg-[var(--quiz-cream)]/30`

### Focus Rings

```
focus-visible:ring-[var(--quiz-gold)]
focus-visible:ring-offset-2
```

### Outline Buttons (Secondary Actions)

```
border-[var(--quiz-gold)] text-[var(--quiz-gold-dark)]
hover:bg-[var(--quiz-gold)]/10 hover:text-[var(--quiz-gold-dark)]
```

---

## Sticky Chrome

### Header/Footer

```
bg-background/95 border-b
```

95% background opacity. Avoid `backdrop-blur-sm` on sticky elements — it forces per-frame GPU blur recomputation during animations, which can crash Chrome on weaker hardware (see `docs/backdrop-blur-chrome-crash-fix.md`).

### Dark Mode Inputs

```
dark:bg-input/30          /* 30% white overlay */
dark:hover:bg-input/50    /* 50% on hover */
dark:border-input
```

---

## Shadow System

| Level | Class | Usage |
|-------|-------|-------|
| XS | `shadow-xs` | Default UI chrome |
| SM | `shadow-sm` | Cards, inputs |
| MD | `shadow-md` | Hover states |
| LG | `shadow-lg` | Elevated buttons, active elements |
| XL | `shadow-xl` | Hover on elevated elements |
| Glow | `shadow-[0_0_8px_var(--quiz-gold)]/50` | Progress bars, accent glow |

---

## Semantic Status Colors

```
Positive:  text-emerald-600 / dark:text-emerald-400
Warning:   text-amber-600   / dark:text-amber-400
Neutral:   text-yellow-600  / dark:text-yellow-400
Negative:  text-red-500     / dark:text-red-400
```

---

## Typography

| Role | Font | Variable |
|------|------|----------|
| Body | Geist Sans | `--font-sans` / `--font-geist-sans` |
| Code | Geist Mono | `--font-mono` / `--font-geist-mono` |
| Display/Headings | Libre Baskerville (serif) | `--font-display` |

### Heading Colors in Brand Content

- **H1, H3:** `color: var(--quiz-gold)` — gold accent
- **H2, H4-H6:** Inherit default foreground

### Gold-bordered Tables

```css
border: 2px solid var(--quiz-gold);        /* outer */
cell border: 1px solid var(--quiz-gold);   /* inner */
```

---

## Layout Tokens

```css
--container-max-w: 840px;
--composer-offset: 8rem;
--radius: 0.625rem;       /* 10px base */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 14px;
```

---

## Animations

### Shimmer (Loading States)

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.animate-shimmer {
  animation: shimmer 2s linear infinite;
  background-size: 200% 100%;
}
```

### Stagger Delays

```css
.animation-delay-50  { animation-delay: 50ms; }
.animation-delay-100 { animation-delay: 100ms; }
.animation-delay-150 { animation-delay: 150ms; }
.animation-delay-200 { animation-delay: 200ms; }
.animation-delay-300 { animation-delay: 300ms; }
```

---

## Touch Interaction

```css
/* All interactive elements */
touch-action: manipulation;
-webkit-tap-highlight-color: oklch(0 0 0 / 5%);     /* light mode */
-webkit-tap-highlight-color: oklch(1 0 0 / 5%);     /* dark mode */
```

---

## Chart Colors (Data Visualization)

### Light Mode
```css
--chart-1: oklch(0.646 0.222 41.116);   /* Warm orange */
--chart-2: oklch(0.6 0.118 184.704);    /* Teal */
--chart-3: oklch(0.398 0.07 227.392);   /* Deep blue */
--chart-4: oklch(0.828 0.189 84.429);   /* Yellow-green */
--chart-5: oklch(0.769 0.188 70.08);    /* Golden */
```

### Dark Mode
```css
--chart-1: oklch(0.488 0.243 264.376);  /* Purple */
--chart-2: oklch(0.696 0.17 162.48);    /* Teal (lighter) */
--chart-3: oklch(0.769 0.188 70.08);    /* Golden */
--chart-4: oklch(0.627 0.265 303.9);    /* Magenta */
--chart-5: oklch(0.645 0.246 16.439);   /* Red-orange */
```

---

## Quick-Reference: Hardcoded Hex Values (PDF/Static Contexts)

For contexts without CSS variable support:

```
Brand Gold:        #C9A36A
Brand Gold Dark:   #B8935D
Brand Cream:       #EEDEC5
Text on Gold:      #3D3225
Dark Background:   #262624

Body text:         #1a1a1a
Muted text:        #4b5563
Gray scale:        #6b7280, #9ca3af, #d1d5db, #e5e7eb
Light backgrounds: #f3f4f6, #f9fafb, #fafafa
Links:             #2563eb (blue-600)
```

---

## Design Principles Summary

1. **Gold as the throughline** — `#C9A36A` appears everywhere: buttons, headings, focus rings, borders, progress, shadows. It IS the brand.
2. **Cream for ambient warmth** — Used at low opacities (20-50%) for hover states, background gradients, and subtle fills.
3. **OKLch for neutrals** — Perceptually uniform gray scale. No hue shifts in the neutral palette.
4. **Opacity-based dark mode borders** — White at 10-15% instead of solid grays. Softer, more cohesive.
5. **Warm dark mode** — `#262624` charcoal, not pure black. Matches the gold/cream warmth.
6. **Gold glow effects** — `shadow-[0_0_Npx_var(--quiz-gold)]/opacity` for elevated brand elements.
7. **No backdrop-blur on sticky elements** — Use `bg-background/95` instead. `backdrop-blur` causes GPU crashes during animations (see `docs/backdrop-blur-chrome-crash-fix.md`).
