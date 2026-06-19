// Cloudflare -> POST /api/feedback  (env: FEEDBACK_FORMSPREE / FEEDBACK_DISCORD / FEEDBACK_WEBHOOK)
export async function onRequest(context) {
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (context.request.method !== "POST") return new Response(JSON.stringify({ ok: false }), { status: 405, headers });
  const env = context.env || {};
  let b = {}; try { b = await context.request.json(); } catch {}
  const at = new Date().toISOString();
  const line = `[${b.type || "feedback"}] ${b.email || "(이메일 없음)"} · from:${b.meta?.from || "-"}\n${b.message || ""}`;
  const sinks = [];
  if (env.FEEDBACK_FORMSPREE) sinks.push(fetch(env.FEEDBACK_FORMSPREE, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ email: b.email || "", message: b.message || "", type: b.type || "feedback", from: b.meta?.from || "", url: b.meta?.url || "", at }) }).catch(() => {}));
  if (env.FEEDBACK_DISCORD) sinks.push(fetch(env.FEEDBACK_DISCORD, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: line.slice(0, 1900) }) }).catch(() => {}));
  if (env.FEEDBACK_WEBHOOK) sinks.push(fetch(env.FEEDBACK_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...b, at, content: line }) }).catch(() => {}));
  if (!sinks.length) return new Response(JSON.stringify({ ok: false, noEndpoint: true }), { headers });
  await Promise.allSettled(sinks);
  return new Response(JSON.stringify({ ok: true }), { headers });
}
