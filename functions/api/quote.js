// Cloudflare Pages Function -> /api/quote (pre/regular/after-hours/overnight aware, US + KR)

function usSessionFromET() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const wd = get("weekday"); const mins = Number(get("hour")) * 60 + Number(get("minute"));
  if (wd === "Sat" || wd === "Sun") return "CLOSED";
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return "PRE";
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return "REGULAR";
  if (mins >= 16 * 60 && mins < 20 * 60) return "POST";
  if (mins >= 20 * 60 || mins < 4 * 60) return "POSTPOST";
  return "CLOSED";
}

function krSessionFromKST() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const wd = get("weekday"); const mins = Number(get("hour")) * 60 + Number(get("minute"));
  if (wd === "Sat" || wd === "Sun") return "CLOSED";
  if (mins >= 7 * 60 + 30 && mins < 8 * 60 + 30) return "PRE";
  if (mins >= 9 * 60 && mins < 15 * 60 + 30) return "REGULAR";
  if (mins >= 15 * 60 + 40 && mins < 16 * 60) return "POST";
  if (mins >= 16 * 60 && mins < 18 * 60) return "POSTPOST";
  return "CLOSED";
}

function parseQuote(j, sym) {
  const result = j?.chart?.result?.[0];
  const meta = result?.meta;
  if (meta?.regularMarketPrice == null) return null;
  const regular = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? regular;
  const isKR = /\.(KS|KQ)$/i.test(sym || "");
  const state = isKR ? krSessionFromKST() : usSessionFromET();

  const closes = result?.indicators?.quote?.[0]?.close || [];
  let latest = null;
  for (let i = closes.length - 1; i >= 0; i--) { if (closes[i] != null) { latest = closes[i]; break; } }
  const price = latest != null ? latest : regular;

  let base, mkt;
  if (isKR) {
    if (state === "PRE") { base = prevClose; mkt = "장전 시간외"; }
    else if (state === "POST") { base = regular; mkt = "장후 시간외(종가)"; }
    else if (state === "POSTPOST") { base = regular; mkt = "장후 시간외(단일가)"; }
    else if (state === "REGULAR") { base = prevClose; mkt = "정규장"; }
    else { base = prevClose; mkt = "장마감"; }
  } else {
    if (state === "PRE") { base = regular; mkt = "프리장"; }
    else if (state === "POST") { base = regular; mkt = "애프터장"; }
    else if (state === "POSTPOST") { base = regular; mkt = "데이마켓"; }
    else if (state === "REGULAR") { base = prevClose; mkt = "정규장"; }
    else { base = prevClose; mkt = "장마감"; }
  }

  return { price, chg: base ? ((price - base) / base) * 100 : null, cur: meta.currency || null, mkt };
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", "Cache-Control": "s-maxage=15" };
  try {
    const raw = url.searchParams.get("symbols") || "";
    const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
    if (!symbols.length) return new Response(JSON.stringify({ error: "no symbols" }), { status: 400, headers });

    const out = {};
    await Promise.all(symbols.map(async (sym) => {
      try {
        const y = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=2m&includePrePost=true`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(y, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
        clearTimeout(timer);
        if (!r.ok) return;
        const j = await r.json();
        const q = parseQuote(j, sym);
        if (q) out[sym] = q;
      } catch { /* skip this symbol only */ }
    }));
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e && e.message || e) }), { status: 200, headers });
  }
}
