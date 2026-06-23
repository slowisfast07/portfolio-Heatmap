// Vercel Serverless Function -> /api/quote
// Yahoo Finance price incl. pre-market / after-hours / overnight (server-side, no CORS).
// Usage: /api/quote?symbols=AAPL,005930.KS

function parseQuote(j) {
  const result = j?.chart?.result?.[0];
  const meta = result?.meta;
  if (meta?.regularMarketPrice == null) return null;
  const regular = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? regular;
  const state = meta.marketState || "REGULAR"; // PRE | REGULAR | POST | POSTPOST | CLOSED

  // We do NOT rely on meta.postMarketPrice/preMarketPrice — the /v8/finance/chart
  // endpoint's meta object doesn't reliably carry those fields (that's the /v7/quote
  // schema). Instead we always take the latest non-null close from the minute-bar
  // series, which (with includePrePost=true) already reflects whichever session is
  // currently live. Only the comparison baseline changes by session.
  const closes = result?.indicators?.quote?.[0]?.close || [];
  let latest = null;
  for (let i = closes.length - 1; i >= 0; i--) { if (closes[i] != null) { latest = closes[i]; break; } }
  const price = latest != null ? latest : regular;

  let base, mkt;
  if (state === "PRE") { base = prevClose; mkt = "프리장"; }
  else if (state === "POST") { base = regular; mkt = "애프터장"; }
  else if (state === "POSTPOST") { base = regular; mkt = "데이마켓"; }
  else if (state === "REGULAR") { base = prevClose; mkt = "정규장"; }
  else { base = prevClose; mkt = "장마감"; }

  return { price, chg: base ? ((price - base) / base) * 100 : null, cur: meta.currency || null, mkt };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=20");
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
