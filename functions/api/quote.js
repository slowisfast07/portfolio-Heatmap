// Cloudflare Pages Function -> /api/quote (pre/regular/after-hours/overnight aware)
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

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", "Cache-Control": "s-maxage=15" };
  const raw = url.searchParams.get("symbols") || "";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length) return new Response(JSON.stringify({ error: "no symbols" }), { status: 400, headers });

  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const y = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=2m&includePrePost=true`;
      const r = await fetch(y, { headers: { "User-Agent": "Mozilla/5.0" } });
      const j = await r.json();
      const q = parseQuote(j);
      if (q) out[sym] = q;
    } catch { /* skip */ }
  }));
  return new Response(JSON.stringify(out), { status: 200, headers });
}
