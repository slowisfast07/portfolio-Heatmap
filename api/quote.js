// Vercel Serverless Function -> /api/quote
// Yahoo Finance price incl. pre-market / after-hours (server-side, no CORS).
// Usage: /api/quote?symbols=AAPL,005930.KS

function parseQuote(j) {
  const result = j?.chart?.result?.[0];
  const meta = result?.meta;
  if (meta?.regularMarketPrice == null) return null;
  const regular = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? regular;
  const closes = result?.indicators?.quote?.[0]?.close || [];
  let latest = null;
  for (let i = closes.length - 1; i >= 0; i--) { if (closes[i] != null) { latest = closes[i]; break; } }
  const price = latest != null ? latest : regular;
  const state = meta.marketState || "";
  const mkt = state.startsWith("PRE") ? "프리장"
    : state.startsWith("POST") ? "애프터장"
    : state === "REGULAR" ? "정규장" : "장마감";
  return { price, chg: prev ? ((price - prev) / prev) * 100 : null, cur: meta.currency || null, mkt };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
  const raw = (req.query.symbols || "").toString();
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length) return res.status(400).json({ error: "no symbols" });

  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=2m&includePrePost=true`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const j = await r.json();
      const q = parseQuote(j);
      if (q) out[sym] = q;
    } catch { /* skip */ }
  }));
  return res.status(200).json(out);
}
