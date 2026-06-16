// Cloudflare Pages Function  ->  available at  /api/quote
// Same job as api/quote.js but in the Cloudflare Workers runtime.
// Usage: /api/quote?symbols=AAPL,NVDA,005930.KS

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "s-maxage=30",
  };

  const raw = url.searchParams.get("symbols") || "";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length)
    return new Response(JSON.stringify({ error: "no symbols" }), { status: 400, headers });

  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const y = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          sym
        )}?range=1d&interval=1d`;
        const r = await fetch(y, { headers: { "User-Agent": "Mozilla/5.0" } });
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
        /* skip */
      }
    })
  );

  return new Response(JSON.stringify(out), { headers });
}
