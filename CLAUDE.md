# Portfolio Heatmap — Project Notes

## Design system: Wise (MANDATORY)
This project follows the **Wise design system**, fully specified in [`DESIGN.md`](./DESIGN.md).
Every existing and **future** page/component must use these tokens — never reintroduce the
old TradingView blue (#2962ff) or Binance yellow (#fcd535).

Source of truth lives in two places:
- `DESIGN.md` — the full written spec (colors, type, spacing, components, do/don't).
- `src/App.jsx` → `THEMES` object — the runtime token implementation (`light` default + `dark`),
  plus the `DISP` / `DISP_HERO` heavy-display style constants. Style off `th.*` tokens, never
  hardcoded hex.

### Core tokens (quick reference)
- Accent: **#9fe870** (Wise lime). Text on lime is **#0e0f0c** (ink, `onAccent`), never white.
  Lime = primary CTA / brand only. It is the SOLE brand color — never add a second accent, and
  never use lime as success/positive (that's the semantic green). For lime-as-text on light
  surfaces use `th.accentText` (readable forest green), never raw lime.
- Light (default): sage canvas **#e8ebe6** · white cards **#ffffff** · ink text **#0e0f0c** ·
  body **#454745** · mute **#868685** · hairline **#d6dccf**.
- Dark: ink canvas **#0e0f0c** · panel **#17190f** · lime accent · canvas-soft text **#e8ebe6**.
- Surface contrast IS the elevation — sage canvas vs white cards. Shadows are minimal/flat.
- Trading semantics (heat): up **#2ead4b** (green), down **#d03238** (red) — light; brighter on
  dark. Never the lime brand green.
- Type: **Manrope** weight 800 (`DISP`) stands in for Wise Sans on hero / section / big-number
  moments; **Inter** carries body + numbers (`.num`, tabular). Hero uses `DISP_HERO`.
- Radius: inputs 12px · cards 16–18px · buttons & pills **9999** (Wise's friendly pill geometry).
  Icon buttons are circular. The hero/welcome band is a 24px ink card with a lime headline.

When adding a surface: sage canvas → white cards. Buttons are lime pills with ink text; the
welcome/promo moment is the polarity-flipped ink hero with a giant lime Manrope headline.
