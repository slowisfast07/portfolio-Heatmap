// Cloudflare Pages Function -> /api/classify  (needs env ANTHROPIC_API_KEY)
const PROMPT = (symbol, name) =>
  `다음 종목을 투자 테마/섹터로 한 단어나 짧은 구로 분류해줘. 가능하면 구체적인 테마로.
예시 카테고리: AI 반도체, 메모리/반도체, 반도체 파운드리, AI 데이터센터, 네오클라우드, 양자컴퓨팅, 소프트웨어, 클라우드, 전기차, 2차전지, 바이오, 헬스케어, 에너지, 금융, 소비재, 미디어, 우주항공, 방산, 성장주, 배당주, 크립토.
한국어 카테고리명만 출력하고 다른 설명은 절대 하지 마.

티커: ${symbol}
이름: ${name || "(미상)"}`;

const DESC_PROMPT = (symbol, name) =>
  `${symbol}(${name || ""}) 종목을 투자자 관점에서 2~3문장으로 아주 간단히 설명해줘. 무엇을 하는 회사/자산인지, 핵심 사업이나 투자 포인트를 한국어로. 마크다운 없이 평문으로만.`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", "Cache-Control": "s-maxage=604800" };
  const symbol = url.searchParams.get("symbol") || "";
  const mode = url.searchParams.get("mode") || "";
  const name = url.searchParams.get("name") || "";
  const key = context.env && context.env.ANTHROPIC_API_KEY;
  if (!symbol || !key) return new Response(JSON.stringify({ theme: null }), { headers });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: mode === "desc" ? 220 : 40, messages: [{ role: "user", content: (mode === "desc" ? DESC_PROMPT : PROMPT)(symbol, name) }] }),
    });
    const j = await r.json();
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return new Response(JSON.stringify(mode === "desc" ? { text: text || null } : { theme: text || null }), { headers });
  } catch {
    return new Response(JSON.stringify({ theme: null }), { headers });
  }
}
