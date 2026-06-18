// Vercel -> /api/history?symbols=AAPL,005930.KS  (daily closes for RSI/Bollinger)
function closesFrom(j) {
  const c = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  return c.filter((x) => x != null);
}
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  const symbols = (req.query.symbols || "").toString().split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length) return res.status(400).json({ error: "no symbols" });
  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const c = closesFrom(await r.json());
      if (c.length) out[sym] = { closes: c.slice(-60) };
    } catch { /* skip */ }
  }));
  return res.status(200).json(out);
}
