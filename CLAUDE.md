# Portfolio Heatmap — Project Notes

## Design system: TradingView (MANDATORY)
This project follows the **TradingView design system**, fully specified in [`DESIGN.md`](./DESIGN.md).
Every existing and **future** page/component must use these tokens — never reintroduce the
old Binance yellow (#fcd535) or Polymarket blue/purple palette.

Source of truth lives in two places:
- `DESIGN.md` — the full written spec (colors, type, spacing, components, do/don't).
- `src/App.jsx` → `THEMES` object — the runtime token implementation (`dark` + `light`).
  Style off `th.*` tokens, not hardcoded hex.

### Core tokens (quick reference)
- Accent: **#2962ff** (TradingView blue), active **#1e53e5**, text-on-blue **#ffffff** (white).
  Blue = primary CTAs / brand / links only. Never a second brand color, never body text.
- Dark canvas #131722 · panel #1e222d · elevated #2a2e39 · hairline #2a2e39 · text #d1d4dc.
- Light canvas #ffffff · soft surface #f0f3fa · hairline #e0e3eb · ink #131722.
- Trading semantics: up **#26a69a** (teal-green, light #089981), down **#ef5350** (red, light
  #f23645) — price direction only, as text/heatmap color, never as a solid card background.
- Type: TradingView UI stack — `-apple-system, "Trebuchet MS", Roboto, sans-serif`. Numbers/
  prices/percent use the **same sans** via the `.num` class with `tabular-nums` (NOT monospace).
- Radius: buttons 6px · inputs/cards 8px · elevated containers 12px · prominent CTAs pill (9999).
- Elevation is flat: rely on surface/canvas color contrast + 1px hairlines, not heavy shadows.

When adding a surface, decide dark (dashboard/charting) vs light (transactional) first;
the same blue CTA + teal-green/red price tokens are shared across both.
