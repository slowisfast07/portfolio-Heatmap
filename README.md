# Portfolio Heatmap

미국주식 · 한국주식 · 크립토를 한 화면에서 보는 개인용 포트폴리오 히트맵.
트리맵(색=일간변동, 크기=비중) + 섹터 도넛 + 실시간 환율 + 다크/라이트 테마.

## 로컬 실행

```bash
npm install
npm run dev          # http://localhost:5173
```

> `npm run dev`(순수 Vite)에서는 `/api/quote` 백엔드가 실행되지 않습니다.
> 이 경우 주식 가격은 공개 프록시로 폴백되거나, 표에서 가격을 직접 입력하면 됩니다.
> 백엔드까지 로컬에서 테스트하려면: `npm i -g vercel` 후 `vercel dev`.

## 빌드

```bash
npm run build        # 결과물은 dist/
npm run preview      # 빌드 결과 미리보기
```

## 배포

### A. Vercel (가장 쉬움)
1. 이 폴더를 GitHub 저장소에 push
2. vercel.com → New Project → 저장소 선택
3. Framework: **Vite** 자동 감지 → Deploy
4. `api/quote.js` 가 서버리스 함수로 자동 배포되어 `/api/quote` 동작
   (Cloudflare용 `functions/` 폴더는 삭제해도 됩니다)

### B. Cloudflare Pages
1. GitHub에 push
2. Cloudflare → Workers & Pages → Create → Pages → 저장소 연결
3. Build command: `npm run build`  /  Output directory: `dist`
4. `functions/api/quote.js` 가 Pages Function으로 자동 배포
   (Vercel용 `api/` 폴더는 삭제해도 됩니다)

## 데이터 소스
- 환율 USD/KRW: open.er-api.com (실패 시 frankfurter.app)
- 크립토: CoinGecko
- 주식: Yahoo Finance ← 자체 `/api/quote` 백엔드가 CORS 우회 프록시 역할

저장: 브라우저 localStorage (포트폴리오 · 테마 · 설정)
