// Vercel Serverless Function -> /api/classify
// Uses Claude to classify a ticker into a short investment theme (Korean).
// Requires env var ANTHROPIC_API_KEY. Without it, returns {theme:null} (app still works).
// Usage: /api/classify?symbol=IREN&name=Iris%20Energy

const PROMPT = (symbol, name) =>
  `다음 종목을 투자 테마/섹터로 한 단어나 짧은 구로 분류해줘. 가능하면 구체적인 테마로.
예시 카테고리: AI 반도체, 메모리/반도체, 반도체 파운드리, AI 데이터센터, 네오클라우드, 양자컴퓨팅, 소프트웨어, 클라우드, 전기차, 2차전지, 바이오, 헬스케어, 에너지, 금융, 소비재, 미디어, 우주항공, 방산, 성장주, 배당주, 크립토.
한국어 카테고리명만 출력하고 다른 설명은 절대 하지 마.

티커: ${symbol}
이름: ${name || "(미상)"}`;

const DESC_PROMPT = (symbol, name) =>
  `${symbol}(${name || ""}) 종목을 투자자 관점에서 2~3문장으로 아주 간단히 설명해줘. 무엇을 하는 회사/자산인지, 핵심 사업이나 투자 포인트를 한국어로. 마크다운 없이 평문으로만.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=604800");
  const symbol = (req.query.symbol || "").toString();
  const mode = (req.query.mode || "").toString();
  const name = (req.query.name || "").toString();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!symbol || !key) return res.status(200).json({ theme: null });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: mode === "desc" ? 220 : 40, messages: [{ role: "user", content: (mode === "desc" ? DESC_PROMPT : PROMPT)(symbol, name) }] }),
    });
    const j = await r.json();
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return res.status(200).json(mode === "desc" ? { text: text || null } : { theme: text || null });
  } catch {
    return res.status(200).json({ theme: null });
  }
}
