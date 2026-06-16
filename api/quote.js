// Vercel Serverless Function  ->  available at  /api/quote
// Proxies Yahoo Finance server-side so the browser never hits CORS.
// Usage: /api/quote?symbols=AAPL,NVDA,005930.KS

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  const raw = (req.query.symbols || "").toString();
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length) return res.status(400).json({ error: "no symbols" });

  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          sym
        )}?range=1d&interval=1d`;
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const j = await r.json();
        const meta = j?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice != null) {
          const prev = meta.chartPreviousClose ?? meta.previousClose;
          const price = meta.regularMarketPrice;
          out[sym] = {
            price,
            chg: prev ? ((price - prev) / prev) * 100 : null,
            cur: meta.currency || null,
          };
        }
      } catch {
        /* skip this symbol */
      }
    })
  );

  return res.status(200).json(out);
}
