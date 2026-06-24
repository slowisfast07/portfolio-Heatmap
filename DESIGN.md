---
version: 1.0
name: TradingView-design-analysis
description: A focused charting-platform interface anchored on TradingView's signature blue-black canvas (#131722), where TradingView blue (#2962FF) carries every primary CTA, link, and brand accent. Type runs the platform's neutral system stack (-apple-system / Trebuchet MS / Roboto) at modest weights — numbers use the same sans with tabular figures, never a monospace face. The dark theme is the default charting/dashboard surface; a clean white light theme shares the same blue CTA. Trading green (up) and red (down) thread through both modes for price-direction and heatmap signals.

colors:
  primary: "#2962ff"
  primary-active: "#1e53e5"
  on-primary: "#ffffff"
  # dark theme
  canvas-dark: "#131722"
  surface-panel-dark: "#1e222d"
  surface-elevated-dark: "#2a2e39"
  hairline-dark: "#2a2e39"
  hairline-strong-dark: "#363a45"
  text-dark: "#d1d4dc"
  text-muted-dark: "#787b86"
  text-faint-dark: "#5d606b"
  # light theme
  canvas-light: "#ffffff"
  surface-soft-light: "#f0f3fa"
  surface-band-light: "#f8f9fd"
  hairline-light: "#e0e3eb"
  hairline-strong-light: "#d1d4dc"
  text-light: "#131722"
  text-muted-light: "#787b86"
  # trading semantics (price direction only)
  up-dark: "#26a69a"
  down-dark: "#ef5350"
  up-light: "#089981"
  down-light: "#f23645"

typography:
  ui-stack: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, "Helvetica Neue", Arial, sans-serif'
  number-stack: 'same as ui-stack; apply font-variant-numeric: tabular-nums (class .num). NOT monospace.'
  display-weight-cap: 700
  letter-spacing-display: "-0.02em"

radius:
  button: 6px
  input: 8px
  card: 8px
  elevated-container: 12px
  prominent-cta: 9999px

elevation: >
  Flat. Lean on surface/canvas color contrast and 1px hairlines.
  Shadows are minimal (e.g. 0 2px 8px rgba(0,0,0,.40) dark / rgba(19,23,34,.08) light),
  used only to lift modals/floating cards — never as the primary separation device.
---

# TradingView Design System

This document is the written source of truth for the project's visual language. The runtime
implementation lives in `src/App.jsx` → the `THEMES` object (`dark` + `light`). Always style
off `th.*` tokens, never hardcoded hex.

## 1. Brand & accent
**TradingView blue `#2962FF`** is the single brand color. It carries primary buttons, active
segmented controls, links, sliders, focus rings, the portfolio trend line, and brand marks.
Text on blue is **white `#ffffff`**. Hover/active deepens to `#1e53e5`. Never introduce a
second brand color, and never use blue for body text.

## 2. Surfaces
- **Dark (default — charting/dashboard):** canvas `#131722`, panels `#1e222d`, elevated/hover
  `#2a2e39`, hairlines `#2a2e39` (strong `#363a45`).
- **Light (transactional):** canvas `#ffffff`, soft surface `#f0f3fa`, hairlines `#e0e3eb`.

## 3. Text
Dark: primary `#d1d4dc`, muted `#787b86`, faint `#5d606b`.
Light: primary `#131722`, muted `#787b86`, faint `#9598a1`.

## 4. Trading semantics (price direction)
Up is **teal-green** (`#26a69a` dark / `#089981` light); down is **red** (`#ef5350` dark /
`#f23645` light). Use these for value text, deltas, and heatmap tiles only — never as a solid
full-bleed card background. The heatmap interpolates from a neutral hairline tone toward these
endpoints. Index/benchmark bars follow the same up/down semantics.

## 5. Typography
The UI stack is TradingView's neutral system stack: `-apple-system, BlinkMacSystemFont,
"Trebuchet MS", Roboto, "Helvetica Neue", Arial, sans-serif` (Roboto is web-loaded as a
cross-platform fallback). **Numbers, prices, and percentages use the same sans** via the
`.num` class with `font-variant-numeric: tabular-nums` — TradingView does not set prices in a
monospace face. Display headings cap at weight 700 with tight `-0.02em` tracking.

## 6. Shape & elevation
Radii: buttons 6px, inputs/cards 8px, elevated containers 12px, prominent pill CTAs 9999px.
Elevation is flat — rely on surface contrast and 1px hairlines; reserve soft shadows for
modals and floating cards only.

## Do / Don't
- **Do** decide dark vs light per surface first, then reuse the shared blue CTA + green/red tokens.
- **Do** keep numbers tabular and in the UI sans.
- **Don't** reintroduce Binance yellow (`#fcd535`), Inter, or JetBrains Mono.
- **Don't** color a card's full background green/red — direction lives in text and heatmap tiles.
