# Portfolio Heatmap — Project Notes

## Design system: Coinbase (MANDATORY)
This project follows the **Coinbase design system**, fully specified in [`DESIGN.md`](./DESIGN.md).
Every existing and **future** page/component must use these tokens — never reintroduce the
old Wise lime (#9fe870), TradingView blue, or Binance yellow.

Source of truth lives in two places:
- `DESIGN.md` — the full written spec (colors, type, spacing, components, do/don't).
- `src/App.jsx` → `THEMES` object — the runtime token implementation (`dark` default + `light`),
  plus the `DISP` / `DISP_HERO` calm-display style constants. Style off `th.*` tokens, never
  hardcoded hex.

### Core tokens (quick reference)
- Accent: **#0052ff** (Coinbase Blue), active **#003ecc**, text-on-blue **#ffffff** (`onAccent`).
  Blue is the SOLE brand color and is used **SCARCELY** — primary CTA pill, logo, active tab/
  toggle, slider, inline accent. Never flood a surface with blue (one or two blue moments per
  band). For blue-as-text use `th.accentText` (#4d8bff dark / #0052ff light).
- Dark (default — calm near-black): canvas **#0a0b0d** · card **#16181c** · elevated **#1f2227**
  · hairline **#23262c** · text #ffffff · dim #a8acb3 · faint #7c828a.
- Light (editorial white variant): canvas #ffffff · soft #eef0f3 · hairline #dee1e6 · ink #0a0b0d.
- Trading semantics: up **#05b169** (green), down **#cf202f** (red) — TEXT/tile color only,
  never a button background. Blue is never a success cue.
- Type: editorial **calm** — Inter at **weight ~500** for display/headlines (DISP/DISP_HERO),
  NEVER heavy/800. Tight negative tracking on display. Body Inter 400/600. **Numbers render in
  mono** (JetBrains Mono ≈ CoinbaseMono) via the `.num` class.
- Shape: every CTA is a **pill** (9999), cards 16–24px, icon buttons circular. Flat elevation
  (one soft shadow tier) — depth comes from surface layering, not heavy shadows.
- Hero/welcome: full-bleed near-black band with a **white** calm headline (not blue) + a blue
  CTA pill + an outline pill; subtle blue radial glow is the single decorative blue moment.

When adding a surface: near-black canvas → #16181c cards. Keep blue scarce; let green/red carry
price direction. Headlines stay calm (weight 500), numbers stay mono.
