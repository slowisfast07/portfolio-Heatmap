// Vercel Serverless Function -> POST /api/parse
// Reads a brokerage screenshot with Claude vision and returns holdings JSON.
// Requires env ANTHROPIC_API_KEY. Without it returns {holdings:[]}.

const PROMPT = `이 증권사/거래소 스크린샷에서 보유 종목을 추출해줘.
설명 없이 JSON 배열만 출력해. 각 항목: {"ticker": string, "qty": number, "avgCost": number|null}.
티커 규칙: 미국주식은 심볼(AAPL), 한국주식은 6자리+거래소(005930.KS 또는 .KQ), 크립토는 심볼(BTC).
한국 종목이 이름으로만 보이면 그 한글 이름을 ticker에 그대로 넣어도 돼. 수량/평단가를 모르면 null.
못 찾으면 [] 만 출력.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ holdings: [], error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ holdings: [], error: "no key" });
  try {
    const { image, media_type } = req.body || {};
    if (!image) return res.status(400).json({ holdings: [], error: "no image" });
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
    return res.status(200).json({ holdings: Array.isArray(holdings) ? holdings : [] });
  } catch (e) {
    return res.status(200).json({ holdings: [], error: String(e) });
  }
}
