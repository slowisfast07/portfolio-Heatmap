// Cloudflare -> /api/history?symbols=...
function closesFrom(j) {
  const c = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  return c.filter((x) => x != null);
}
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", "Cache-Control": "s-maxage=300" };
  const symbols = (url.searchParams.get("symbols") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  if (!symbols.length) return new Response(JSON.stringify({ error: "no symbols" }), { status: 400, headers });
  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
      const c = closesFrom(await r.json());
      if (c.length) out[sym] = { closes: c.slice(-60) };
    } catch { /* skip */ }
  }));
  return new Response(JSON.stringify(out), { headers });
}
