// Vercel Serverless Function -> /api/lookup
// Returns company name + sector for each symbol (used to auto-fill the table).
// Usage: /api/lookup?symbols=AAPL,005930.KS

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");

  const raw = (req.query.symbols || "").toString();
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length) return res.status(400).json({ error: "no symbols" });

  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const u = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
          sym
        )}&quotesCount=4&newsCount=0`;
        const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
        const j = await r.json();
        const quotes = j?.quotes || [];
        const hangul = /[\uAC00-\uD7A3]/.test(sym);
        const q = (hangul
          ? quotes.find((x) => /\.(KS|KQ)$/i.test(x.symbol || ""))
          : quotes.find((x) => (x.symbol || "").toUpperCase() === sym.toUpperCase())) || quotes[0];
        if (q) out[sym] = { symbol: q.symbol || null, name: q.longname || q.shortname || null, sector: q.sector || null };
      } catch {
        /* skip */
      }
    })
  );

  return res.status(200).json(out);
}
