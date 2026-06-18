// Cloudflare Pages Function -> POST /api/parse  (needs env ANTHROPIC_API_KEY)
const PROMPT = `이 증권사/거래소 스크린샷에서 보유 종목을 추출해줘.
설명 없이 JSON 배열만 출력해. 각 항목: {"ticker": string, "qty": number, "avgCost": number|null}.
티커 규칙: 미국주식은 심볼(AAPL), 한국주식은 6자리+거래소(005930.KS 또는 .KQ), 크립토는 심볼(BTC).
한국 종목이 이름으로만 보이면 그 한글 이름을 ticker에 그대로 넣어도 돼. 수량/평단가를 모르면 null.
못 찾으면 [] 만 출력.`;

export async function onRequest(context) {
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (context.request.method !== "POST") return new Response(JSON.stringify({ holdings: [] }), { status: 405, headers });
  const key = context.env && context.env.ANTHROPIC_API_KEY;
  if (!key) return new Response(JSON.stringify({ holdings: [], error: "no key" }), { headers });
  try {
    const { image, media_type } = await context.request.json();
    if (!image) return new Response(JSON.stringify({ holdings: [], error: "no image" }), { status: 400, headers });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1500,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: media_type || "image/png", data: image } },
          { type: "text", text: PROMPT },
        ] }],
      }),
    });
    const j = await r.json();
    let text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    text = text.replace(/```json|```/g, "").trim();
    let holdings = []; try { holdings = JSON.parse(text); } catch { holdings = []; }
    return new Response(JSON.stringify({ holdings: Array.isArray(holdings) ? holdings : [] }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ holdings: [], error: String(e) }), { headers });
  }
}
