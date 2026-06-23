// Vercel Serverless Function -> /api/quote
// Yahoo Finance price incl. pre-market / after-hours / overnight (server-side, no CORS).
// Usage: /api/quote?symbols=AAPL,005930.KS

// Don't trust Yahoo's `marketState` field — it can be stale/wrong on the chart endpoint.
// Instead compute the session ourselves from the real US Eastern wall-clock time.
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

function parseQuote(j) {
  const result = j?.chart?.result?.[0];
  const meta = result?.meta;
  if (meta?.regularMarketPrice == null) return null;
  const regular = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? regular;
  const state = usSessionFromET(); // PRE | REGULAR | POST | POSTPOST | CLOSED — computed locally, not from Yahoo

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
  // Extended-hours prices (pre/post/overnight) are always compared against the most
  // recent REGULAR-session close, matching Yahoo's own display convention.
  if (state === "PRE") { base = regular; mkt = "프리장"; }
  else if (state === "POST") { base = regular; mkt = "애프터장"; }
  else if (state === "POSTPOST") { base = regular; mkt = "데이마켓"; }
  else if (state === "REGULAR") { base = prevClose; mkt = "정규장"; }
  else { base = prevClose; mkt = "장마감"; }

  return { price, chg: base ? ((price - base) / base) * 100 : null, cur: meta.currency || null, mkt };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=20");
  try {
    const raw = (req.query.symbols || "").toString();
    const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
    if (!symbols.length) return res.status(400).json({ error: "no symbols" });

    const out = {};
    await Promise.all(symbols.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=2m&includePrePost=true`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/json",
          },
        });
        clearTimeout(timer);
        if (!r.ok) return; // skip this symbol, others may still succeed
        const j = await r.json();
        const q = parseQuote(j);
        if (q) out[sym] = q;
      } catch { /* skip this symbol only — never let one bad symbol kill the whole response */ }
    }));
    return res.status(200).json(out);
  } catch (e) {
    // surface the error instead of Vercel returning a bare 0-byte failure
    return res.status(200).json({ error: String(e && e.message || e) });
  }
}
