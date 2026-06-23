// Cloudflare Pages Function -> /api/lookup
// Returns company name + sector for each symbol. With multi=1, returns multiple candidates
// for autocomplete use instead of just the single best match.
// Usage: /api/lookup?symbols=AAPL,005930.KS  or  /api/lookup?symbols=samsung&multi=1

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "s-maxage=86400",
  };

  const raw = url.searchParams.get("symbols") || "";
  const multi = (url.searchParams.get("multi") || "") === "1";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length)
    return new Response(JSON.stringify({ error: "no symbols" }), { status: 400, headers });

  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const u = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
          sym
        )}&quotesCount=${multi ? 8 : 4}&newsCount=0`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(u, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
        clearTimeout(timer);
        if (!r.ok) return;
        const j = await r.json();
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
      } catch {
        /* skip */
      }
    })
  );

  return new Response(JSON.stringify(out), { headers });
}
