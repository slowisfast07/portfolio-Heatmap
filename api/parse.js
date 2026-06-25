// Vercel Serverless Function -> POST /api/parse
// Reads a brokerage screenshot with Claude vision and returns holdings JSON.
// Requires env ANTHROPIC_API_KEY. Without it returns {holdings:[]}.

const PROMPT = `이 증권사/거래소 앱(토스증권·키움 영웅문·미래에셋·삼성증권·NH나무·KB·업비트·빗썸 등) 스크린샷에서 보유 종목을 모두 추출해줘.
설명 없이 JSON 배열만 출력해. 각 항목: {"ticker": string, "qty": number, "avgCost": number|null}.

티커 규칙:
- 미국주식/ETF: 영문 심볼 (AAPL, NVDA, SCHD, TLT, GLD).
- 한국주식: 종목코드를 알면 6자리+거래소(코스피 005930.KS, 코스닥 247540.KQ). 코드가 안 보이면 화면의 한글 이름을 그대로 ticker에 넣어(예: "삼성전자").
- 크립토: 심볼만 (BTC, ETH, SOL).

수량(qty):
- "주", "개", "수량" 옆 숫자. 소수점 그대로 유지(예: 0.0234523, 코인은 소수 흔함).
- 천단위 쉼표(1,200)는 제거하고 숫자만(1200).

평단가(avgCost):
- "평균단가/매입가/평단" 값. "현재가/평가금액/수익률/손익/등락률"과 절대 혼동하지 마.
- 통화기호(₩,$)·쉼표·"원" 제거하고 숫자만. 모르면 null.

규칙: 보이는 종목은 빠짐없이. 합계·현금성 항목(예수금)은 제외. 확실치 않으면 그 칸은 null. 종목을 못 찾으면 [] 만 출력.`;

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
