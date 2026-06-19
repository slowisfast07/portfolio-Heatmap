// Vercel -> POST /api/feedback  { type, message, email, meta }
// Fans out to every configured sink. Set whichever you want in Vercel env vars:
//   FEEDBACK_FORMSPREE  = https://formspree.io/f/xxxxxxx   (Formspree -> emails you)
//   FEEDBACK_DISCORD    = https://discord.com/api/webhooks/.... (Discord channel)
//   FEEDBACK_WEBHOOK    = any other generic JSON webhook (optional)
// If none are set, the app falls back to opening the user's mail client.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const b = req.body || {};
  const at = new Date().toISOString();
  const line = `[${b.type || "feedback"}] ${b.email || "(이메일 없음)"} · from:${b.meta?.from || "-"}\n${b.message || ""}`;
  const sinks = [];

  if (process.env.FEEDBACK_FORMSPREE) {
    sinks.push(fetch(process.env.FEEDBACK_FORMSPREE, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email: b.email || "", message: b.message || "", type: b.type || "feedback", from: b.meta?.from || "", url: b.meta?.url || "", at }),
    }).catch(() => {}));
  }
  if (process.env.FEEDBACK_DISCORD) {
    sinks.push(fetch(process.env.FEEDBACK_DISCORD, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: line.slice(0, 1900) }),
    }).catch(() => {}));
  }
  if (process.env.FEEDBACK_WEBHOOK) {
    sinks.push(fetch(process.env.FEEDBACK_WEBHOOK, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...b, at, content: line }),
    }).catch(() => {}));
  }

  if (!sinks.length) return res.status(200).json({ ok: false, noEndpoint: true });
  try { await Promise.allSettled(sinks); return res.status(200).json({ ok: true }); }
  catch (e) { return res.status(200).json({ ok: false, error: String(e) }); }
}
