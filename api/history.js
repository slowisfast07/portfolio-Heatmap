// Vercel -> /api/history?symbols=AAPL,005930.KS  (daily closes + timestamps)
function seriesFrom(j) {
  const r = j?.chart?.result?.[0];
  const ts = r?.timestamp || [];
  const c = r?.indicators?.quote?.[0]?.close || [];
  const closes = [], times = [];
  for (let i = 0; i < c.length; i++) { if (c[i] != null) { closes.push(c[i]); times.push(ts[i] || null); } }
  return { closes: closes.slice(-90), ts: times.slice(-90) };
}
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  const symbols = (req.query.symbols || "").toString().split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length) return res.status(400).json({ error: "no symbols" });
  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=6mo&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const s = seriesFrom(await r.json());
      if (s.closes.length) out[sym] = s;
    } catch { /* skip */ }
  }));
  return res.status(200).json(out);
}
