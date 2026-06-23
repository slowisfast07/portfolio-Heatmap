// Vercel Serverless Function -> /api/lookup
// Returns company name + sector for each symbol (used to auto-fill the table).
// Usage: /api/lookup?symbols=AAPL,005930.KS

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");

  const raw = (req.query.symbols || "").toString();
  const multi = (req.query.multi || "").toString() === "1";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length) return res.status(400).json({ error: "no symbols" });

  // Try query1 first (same host quote.js uses successfully), then query2 as a fallback —
  // Yahoo sometimes rate-limits/blocks one query-N host for the search endpoint while
  // leaving the other open, so trying both before giving up on a symbol avoids a blanket failure.
  const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

  async function searchYahoo(sym) {
    let lastErr = null;
    for (const host of HOSTS) {
      try {
        const u = `https://${host}/v1/finance/search?q=${encodeURIComponent(
          sym
        )}&quotesCount=${multi ? 8 : 4}&newsCount=0`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(u, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/json",
          },
        });
        clearTimeout(timer);
        if (!r.ok) { lastErr = `${host} HTTP ${r.status}`; console.warn("[api/lookup] search failed:", lastErr, "sym:", sym); continue; }
        const j = await r.json();
        return j;
      } catch (e) {
        lastErr = `${host} ${e?.name || e}`;
        console.warn("[api/lookup] search threw:", lastErr, "sym:", sym);
      }
    }
    console.warn("[api/lookup] all hosts failed for sym:", sym, "lastErr:", lastErr);
    return null;
  }

  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      const j = await searchYahoo(sym);
      if (!j) return;
      const quotes = j?.quotes || [];
      if (multi) {
        const candidates = quotes
          .filter((x) => x.symbol && (x.quoteType === "EQUITY" || x.quoteType === "ETF" || x.quoteType === "CRYPTOCURRENCY" || !x.quoteType))
          .map((x) => ({ symbol: x.symbol, name: x.longname || x.shortname || "" }));
        out[sym] = { candidates };
        return;
      }
      const hangul = /[\uAC00-\uD7A3]/.test(sym);
      const q = (hangul
        ? quotes.find((x) => /\.(KS|KQ)$/i.test(x.symbol || ""))
        : quotes.find((x) => (x.symbol || "").toUpperCase() === sym.toUpperCase())) || quotes[0];
      if (q) out[sym] = { symbol: q.symbol || null, name: q.longname || q.shortname || null, sector: q.sector || null };
    })
  );

  return res.status(200).json(out);
}
