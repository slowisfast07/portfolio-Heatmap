import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, ReferenceLine } from "recharts";
import {
  Plus, Trash2, RefreshCw, Sun, Moon, TrendingUp, TrendingDown, Wifi, WifiOff, Wallet, Upload, Target,
  Image as ImageIcon, FileText,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 *  MVP CONFIG  (edit these few lines for your launch)                 *
 * ------------------------------------------------------------------ */
const CONFIG = {
  feedbackEmail: "albert_song@snu.ac.kr",
  productName: "나만의 포트폴리오 히트맵",
  siteUrl: "https://portfolio-heatmap-nine.vercel.app",
};

/* which channel did this visitor come from? (?from=reddit / utm_source=...) */
function getSource() {
  try { const p = new URLSearchParams(window.location.search); return p.get("from") || p.get("utm_source") || "direct"; }
  catch { return "direct"; }
}

/* privacy-friendly event tracking — fires only if Plausible / Vercel / GA is loaded.
   Safe no-op otherwise, so it never breaks anything. */
function track(event, props) {
  try {
    if (typeof window === "undefined") return;
    if (window.plausible) window.plausible(event, props ? { props } : undefined);
    if (window.va) window.va("event", { name: event, ...(props || {}) });
    if (window.gtag) window.gtag("event", event, props || {});
  } catch { /* ignore */ }
}

/* demo portfolio for the "예시로 둘러보기" button (reduces empty-state bounce) */
const SAMPLE_HOLDINGS = [
  { type: "us", ticker: "NVDA", name: "NVIDIA", sector: "AI 반도체", qty: 10, avgCost: 120, cur: "USD" },
  { type: "us", ticker: "MSFT", name: "Microsoft", sector: "소프트웨어", qty: 5, avgCost: 380, cur: "USD" },
  { type: "us", ticker: "MU", name: "Micron", sector: "메모리/반도체", qty: 15, avgCost: 95, cur: "USD" },
  { type: "kr", ticker: "005930.KS", name: "삼성전자", sector: "메모리/반도체", qty: 50, avgCost: 70000, cur: "KRW" },
  { type: "crypto", ticker: "BTC", name: "Bitcoin", sector: "Crypto", qty: 0.2, avgCost: 60000, cur: "USD" },
];

/* feedback / waitlist — POSTs to /api/feedback (forwards to your webhook).
   Falls back to the user's email client if no backend/endpoint is configured. */
async function submitFeedback(payload) {
  try {
    const r = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (r.ok) { const j = await r.json(); if (j.ok) return { ok: true }; }
  } catch { /* fall through */ }
  return { ok: false };
}


/* ------------------------------------------------------------------ *
 *  THEME  (Polymarket-inspired: slate #15191d + blue #2d9cdb)         *
 * ------------------------------------------------------------------ */
const THEMES = {
  dark: {
    name: "dark", bg: "#0f1318", panel: "#181d24", panelAlt: "#222933", border: "#272e38",
    borderHover: "#3a4350", text: "#eef1f4", textDim: "#9aa3ad", textFaint: "#69727d",
    accent: "#2d9cdb", accentGlow: "rgba(45,156,219,.38)",
    inputBg: "#12161c", heatPos: "#21a85a", heatNeg: "#e5484d", heatNeu: "#2b323c",
    rowHover: "#232a34", band: "#13171d",
    posBg: "rgba(33,168,90,.16)", negBg: "rgba(229,72,77,.16)",
    cardShadow: "0 8px 28px rgba(0,0,0,.38)",
    heroGlow: "linear-gradient(180deg, rgba(155,93,229,.12), rgba(45,212,191,.05) 42%, transparent 78%)",
  },
  light: {
    name: "light", bg: "#f4f6f9", panel: "#ffffff", panelAlt: "#eef1f5", border: "#e2e6ec",
    borderHover: "#cdd5df", text: "#15191d", textDim: "#5b646d", textFaint: "#97a0aa",
    accent: "#1d83c6", accentGlow: "rgba(29,131,198,.28)",
    inputBg: "#ffffff", heatPos: "#1c9d57", heatNeg: "#d83a40", heatNeu: "#dde2e8",
    rowHover: "#eef2f7", band: "#eef1f5",
    posBg: "rgba(28,157,87,.13)", negBg: "rgba(216,58,64,.12)",
    cardShadow: "0 8px 24px rgba(15,25,40,.10)",
    heroGlow: "linear-gradient(180deg, rgba(155,93,229,.08), rgba(45,156,219,.05) 42%, transparent 78%)",
  },
};

const SECTORS = [
  "Technology", "Communication", "Consumer Cyclical", "Consumer Defensive", "Financial",
  "Healthcare", "Industrials", "Energy", "Real Estate", "Basic Materials", "Utilities", "Crypto", "Cash", "Other",
];
/* vivid, punchy categorical palette (assigned by sector order) */
const PALETTE = ["#16c784", "#3b82f6", "#22c1e0", "#f5a623", "#e5484d", "#8b5cf6", "#ec4899", "#0fb9b1", "#fc6e51", "#5b7cfa", "#84cc16", "#fb7185", "#f7b500", "#06b6d4"];
const CASH_COLOR = "#7c8794";
const RESERVED_COLORS = { Cash: CASH_COLOR, Crypto: "#f7b500" };
/* build a stable, distinct color per sector from the (value-sorted) list */
function buildColorMap(sectors) {
  const m = {}; let p = 0;
  sectors.forEach((s) => { m[s] = RESERVED_COLORS[s] || PALETTE[p++ % PALETTE.length]; });
  return m;
}

/* theme -> representative tickers, used to generate recommendations */
const THEME_CATALOG = {
  "AI 반도체": ["NVDA", "AVGO", "AMD", "MRVL", "TSM", "ARM"],
  "메모리/반도체": ["MU", "000660.KS", "005930.KS", "WDC", "STX"],
  "AI 데이터센터": ["VRT", "APLD", "IREN", "SMCI", "DLR"],
  "네오클라우드": ["NBIS", "CRWV", "CORZ", "APLD"],
  "양자컴퓨팅": ["IONQ", "RGTI", "QBTS", "INFQ", "QUBT"],
  "소프트웨어": ["MSFT", "PLTR", "CRM", "NOW", "SNOW"],
  "전기차": ["TSLA", "RIVN", "LCID", "BYDDY"],
  "2차전지": ["373220.KS", "006400.KS", "051910.KS"],
  "바이오/헬스케어": ["LLY", "NVO", "UNH", "ISRG"],
  "에너지": ["XOM", "CVX", "NEE"],
  "방산/우주": ["LMT", "RTX", "RKLB"],
  "배당주": ["SCHD", "JEPI", "KO", "O"],
  "크립토": ["BTC", "ETH", "SOL"],
  "금융": ["JPM", "BAC", "V", "105560.KS"],
};
function buildIdeas(sectorData, heldSet) {
  const wByTheme = {}; sectorData.forEach((d) => { wByTheme[d.sector] = d.pct; });
  const ideas = [];
  Object.entries(THEME_CATALOG).forEach(([theme, tickers]) => {
    const fresh = tickers.filter((t) => !heldSet.has(t.toUpperCase()));
    if (!fresh.length) return;
    const w = wByTheme[theme] || 0;
    ideas.push({ kind: w < 8 ? "diversify" : "more", theme, ticker: fresh[0] });
  });
  return ideas;
}

/* famous investors + representative holdings (참고용 / illustrative).
   weights approximate a full 13F; "기타" = the long tail of smaller positions. */
const WHALES = [
  { name: "워런 버핏", fund: "버크셔 해서웨이", q: "Berkshire Hathaway", hue: "#e8453c", desc: "가치투자의 대명사. 경제적 해자를 가진 우량 기업을 사서 장기 보유하는 전략으로 유명합니다.", holdings: [{ t: "AAPL", w: 26 }, { t: "AXP", w: 16 }, { t: "BAC", w: 11 }, { t: "KO", w: 9 }, { t: "CVX", w: 6 }, { t: "OXY", w: 4 }, { t: "MCO", w: 4 }, { t: "KHC", w: 3 }, { t: "기타", w: 21 }] },
  { name: "빌 애크먼", fund: "퍼싱 스퀘어", q: "Pershing Square", hue: "#16c784", desc: "소수 종목에 집중 투자하는 행동주의 투자자. 경영 개입으로 기업가치를 끌어올리는 스타일.", holdings: [{ t: "GOOG", w: 19 }, { t: "CMG", w: 17 }, { t: "HLT", w: 16 }, { t: "QSR", w: 14 }, { t: "BN", w: 12 }, { t: "CP", w: 9 }, { t: "HHH", w: 7 }, { t: "기타", w: 6 }] },
  { name: "캐시 우드", fund: "ARK Invest", q: "ARK Investment Management", hue: "#8b5cf6", desc: "파괴적 혁신·성장주에 베팅하는 액티브 ETF 운용사. 변동성이 크지만 테마 투자의 상징.", holdings: [{ t: "TSLA", w: 12 }, { t: "COIN", w: 10 }, { t: "ROKU", w: 8 }, { t: "PLTR", w: 7 }, { t: "HOOD", w: 6 }, { t: "RBLX", w: 5 }, { t: "SQ", w: 5 }, { t: "PATH", w: 4 }, { t: "기타", w: 43 }] },
  { name: "스탠리 드러켄밀러", fund: "듀케인", q: "Duquesne Family Office", hue: "#f5a623", desc: "거시경제 흐름을 읽어 큰 베팅을 하는 전설적 매크로 투자자.", holdings: [{ t: "NVDA", w: 10 }, { t: "MSFT", w: 8 }, { t: "CPNG", w: 7 }, { t: "TEVA", w: 6 }, { t: "NTRA", w: 5 }, { t: "WMT", w: 4 }, { t: "기타", w: 60 }] },
  { name: "테리 스미스", fund: "펀드스미스", q: "Fundsmith", hue: "#ec4899", desc: "\"좋은 기업을 사서 가만히 둔다\"는 원칙의 영국 대표 장기투자자.", holdings: [{ t: "MSFT", w: 9 }, { t: "META", w: 8 }, { t: "NVO", w: 7 }, { t: "PG", w: 6 }, { t: "AMZN", w: 6 }, { t: "VISA", w: 5 }, { t: "STRYKER", w: 5 }, { t: "기타", w: 54 }] },
  { name: "체이스 콜먼", fund: "타이거 글로벌", q: "Tiger Global", hue: "#0fb9b1", desc: "기술·인터넷 성장주에 집중하는 헤지펀드. 비상장 투자로도 유명.", holdings: [{ t: "META", w: 14 }, { t: "NVDA", w: 11 }, { t: "SE", w: 9 }, { t: "SPOT", w: 8 }, { t: "MSFT", w: 7 }, { t: "AMZN", w: 6 }, { t: "기타", w: 45 }] },
  { name: "데이비드 테퍼", fund: "아팔루사", q: "Appaloosa", hue: "#3b82f6", desc: "역발상·턴어라운드 베팅에 강한 헤지펀드 매니저.", holdings: [{ t: "NVDA", w: 10 }, { t: "BABA", w: 9 }, { t: "AMZN", w: 8 }, { t: "META", w: 7 }, { t: "MSFT", w: 6 }, { t: "PDD", w: 5 }, { t: "기타", w: 55 }] },
  { name: "마이클 버리", fund: "사이언", q: "Scion Asset Management", hue: "#fc6e51", desc: "영화 '빅쇼트'의 그 인물. 깊은 가치·역발상 베팅으로 유명.", holdings: [{ t: "EL", w: 12 }, { t: "BABA", w: 11 }, { t: "JD", w: 10 }, { t: "BIDU", w: 8 }, { t: "기타", w: 59 }] },
];

/* presets shown in the sector autocomplete (you can also type your own) */
const SECTOR_PRESETS = [
  "Technology", "Communication", "Consumer Cyclical", "Consumer Defensive", "Financial",
  "Healthcare", "Industrials", "Energy", "Real Estate", "Basic Materials", "Utilities", "Crypto", "Other",
  "AI 반도체", "메모리/반도체", "반도체 파운드리", "AI 데이터센터", "네오클라우드", "양자컴퓨팅", "성장주", "배당주",
];

/* curated starter theme tags for well-known tickers — fully editable in the table */
const THEME_MAP = {
  "IREN": "AI 데이터센터", "NBIS": "네오클라우드", "MU": "메모리/반도체", "000660.KS": "메모리/반도체",
  "005930.KS": "메모리/반도체", "INFQ": "양자컴퓨팅", "MRVL": "AI 반도체", "NVDA": "AI 반도체",
  "AVGO": "AI 반도체", "AMD": "AI 반도체", "TSM": "반도체 파운드리",
};



const YH_SECTOR = {
  "Technology": "Technology", "Communication Services": "Communication",
  "Consumer Cyclical": "Consumer Cyclical", "Consumer Defensive": "Consumer Defensive",
  "Financial Services": "Financial", "Financial": "Financial", "Healthcare": "Healthcare",
  "Industrials": "Industrials", "Energy": "Energy", "Real Estate": "Real Estate",
  "Basic Materials": "Basic Materials", "Utilities": "Utilities",
};
const mapSector = (ys) => YH_SECTOR[ys] || "Other";

const CRYPTO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano",
  DOGE: "dogecoin", BNB: "binancecoin", AVAX: "avalanche-2", DOT: "polkadot",
  MATIC: "matic-network", LINK: "chainlink", TRX: "tron",
};
const CRYPTO_NAMES = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP", ADA: "Cardano",
  DOGE: "Dogecoin", BNB: "BNB", AVAX: "Avalanche", DOT: "Polkadot",
  MATIC: "Polygon", LINK: "Chainlink", TRX: "TRON",
};

/* common Korean company names -> Yahoo ticker (reliable instant resolution;
   anything not here still falls back to Yahoo search) */
const KR_NAME_MAP = {
  "삼성전자": "005930.KS", "삼성전자우": "005935.KS", "SK하이닉스": "000660.KS", "에스케이하이닉스": "000660.KS",
  "LG에너지솔루션": "373220.KS", "엘지에너지솔루션": "373220.KS", "삼성바이오로직스": "207940.KS",
  "현대차": "005380.KS", "기아": "000270.KS", "셀트리온": "068270.KS", "네이버": "035420.KS", "NAVER": "035420.KS",
  "카카오": "035720.KS", "삼성SDI": "006400.KS", "LG화학": "051910.KS", "엘지화학": "051910.KS",
  "포스코홀딩스": "005490.KS", "POSCO홀딩스": "005490.KS", "현대모비스": "012330.KS", "삼성물산": "028260.KS",
  "KB금융": "105560.KS", "신한지주": "055550.KS", "하나금융지주": "086790.KS", "삼성생명": "032830.KS",
  "SK이노베이션": "096770.KS", "LG전자": "066570.KS", "엘지전자": "066570.KS", "한미반도체": "042700.KS",
  "두산에너빌리티": "034020.KS", "HD현대중공업": "329180.KS", "한화에어로스페이스": "012450.KS",
  "삼성전기": "009150.KS", "SK텔레콤": "017670.KS", "KT": "030200.KS", "크래프톤": "259960.KS",
  "에코프로비엠": "247540.KQ", "에코프로": "086520.KQ", "알테오젠": "196170.KQ", "엔켐": "348370.KQ",
  "리노공업": "058470.KQ", "HLB": "028300.KQ", "JYP Ent.": "035900.KQ", "펄어비스": "263750.KQ",
};

const SEED = [
  { id: "s1", type: "us", ticker: "", name: "", sector: "", qty: 0, avgCost: null, buyDate: null, price: null, cur: "USD", chg: null, live: false },
];
const SEED_CASH = [];

const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (n, d = 2) =>
  n == null || isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMoney = (n, cur) => {
  if (n == null || isNaN(n)) return "—";
  const sym = cur === "KRW" ? "₩" : "$";
  const d = cur === "KRW" ? 0 : 2;
  return sym + Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};
const returnPct = (h) =>
  h.avgCost && h.price != null && h.avgCost > 0 ? ((h.price - h.avgCost) / h.avgCost) * 100 : null;

function heatColor(pct, th, cap) {
  if (pct == null || isNaN(pct)) return th.heatNeu;
  const t = Math.max(-1, Math.min(1, pct / cap));
  if (t >= 0) return d3.interpolateRgb(th.heatNeu, th.heatPos)(t);
  return d3.interpolateRgb(th.heatNeu, th.heatNeg)(-t);
}

/* ------------------------------------------------------------------ *
 *  FETCHERS                                                            *
 * ------------------------------------------------------------------ */
async function fetchFx() {
  const tries = [
    async () => (await (await fetch("https://open.er-api.com/v6/latest/USD")).json())?.rates?.KRW,
    async () => (await (await fetch("https://api.frankfurter.app/latest?from=USD&to=KRW")).json())?.rates?.KRW,
  ];
  for (const t of tries) { try { const v = await t(); if (v) return v; } catch { /* next */ } }
  return null;
}
async function fetchCrypto(symbols) {
  const ids = symbols.map((s) => CRYPTO_IDS[s]).filter(Boolean);
  if (!ids.length) return {};
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`);
    const j = await r.json();
    const out = {};
    for (const sym of symbols) { const id = CRYPTO_IDS[sym]; if (id && j[id]) out[sym] = { price: j[id].usd, chg: j[id].usd_24h_change, cur: "USD" }; }
    return out;
  } catch { return {}; }
}
async function fetchStocks(symbols) {
  if (!symbols.length) return {};
  try {
    const r = await fetch(`/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`);
    if (r.ok) { const j = await r.json(); if (j && !j.error) return j; }
  } catch { /* fall through */ }
  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const y = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=2m&includePrePost=true`;
      const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(y)}`);
      const j = await r.json();
      const result = j?.chart?.result?.[0];
      const meta = result?.meta;
      if (meta?.regularMarketPrice != null) {
        const regular = meta.regularMarketPrice;
        const prev = meta.chartPreviousClose ?? meta.previousClose ?? regular;
        const closes = result?.indicators?.quote?.[0]?.close || [];
        let latest = null;
        for (let i = closes.length - 1; i >= 0; i--) { if (closes[i] != null) { latest = closes[i]; break; } }
        const price = latest != null ? latest : regular;
        const state = meta.marketState || "";
        const mkt = state.startsWith("PRE") ? "프리장" : state.startsWith("POST") ? "애프터장" : state === "REGULAR" ? "정규장" : "장마감";
        out[sym] = { price, chg: prev ? ((price - prev) / prev) * 100 : null, cur: meta.currency || null, mkt };
      }
    } catch { /* skip */ }
  }));
  return out;
}
/* AI theme classification — deploy build calls the /api/classify backend.
   (Backend needs env ANTHROPIC_API_KEY; without it returns null and we fall back.) */
async function classifyTicker(symbol, name) {
  try {
    const r = await fetch(`/api/classify?symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name || "")}`);
    if (r.ok) { const j = await r.json(); if (j && j.theme) return j.theme; }
  } catch { /* none */ }
  return null;
}

/* Screenshot -> holdings via Claude vision. Deploy build POSTs to /api/parse. */
async function parseScreenshot(image, media_type) {
  try {
    const r = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, media_type }) });
    if (r.ok) { const j = await r.json(); if (Array.isArray(j.holdings)) return j.holdings; }
  } catch { /* none */ }
  return [];
}

/* minimal CSV/TSV parser: ticker, qty, avgCost[, currency] per line */
function parseCSV(text) {
  const rows = [];
  (text || "").trim().split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const p = line.split(/[,\t]/).map((s) => s.trim());
    if (p.length < 2) return;
    if (isNaN(parseFloat(p[1]))) return; // header / junk
    const cur = /KRW|won|원|₩/i.test(p[3] || "") ? "KRW" : /USD|\$/i.test(p[3] || "") ? "USD" : undefined;
    rows.push({ ticker: p[0], qty: parseFloat(p[1]), avgCost: p[2] != null && p[2] !== "" && !isNaN(parseFloat(p[2])) ? parseFloat(p[2]) : null, cur });
  });
  return rows;
}

const BENCH = [{ sym: "^GSPC", label: "S&P 500" }, { sym: "^NDX", label: "나스닥100" }, { sym: "^KS11", label: "코스피" }];

/* AI 1-line description (deploy: /api/classify?mode=desc) */
async function describeTicker(symbol, name) {
  try {
    const r = await fetch(`/api/classify?mode=desc&symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name || "")}`);
    if (r.ok) { const j = await r.json(); if (j && j.text) return j.text; }
  } catch { /* none */ }
  return null;
}

/* daily closes for indicators (deploy: /api/history) */
async function fetchHistory(symbols) {
  if (!symbols.length) return {};
  try {
    const r = await fetch(`/api/history?symbols=${encodeURIComponent(symbols.join(","))}`);
    if (r.ok) { const j = await r.json(); if (j && !j.error) return j; }
  } catch { /* fall through */ }
  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const y = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=6mo&interval=1d`;
      const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(y)}`);
      const j = await r.json();
      const res0 = j?.chart?.result?.[0];
      const tsArr = res0?.timestamp || [];
      const cArr = res0?.indicators?.quote?.[0]?.close || [];
      const closes = [], ts = [];
      for (let i = 0; i < cArr.length; i++) { if (cArr[i] != null) { closes.push(cArr[i]); ts.push(tsArr[i] || null); } }
      if (closes.length) out[sym] = { closes: closes.slice(-90), ts: ts.slice(-90) };
    } catch { /* skip */ }
  }));
  return out;
}
function calcRSI(closes, p = 14) {
  if (!closes || closes.length < p + 1) return null;
  let g = 0, l = 0;
  for (let i = closes.length - p; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) g += d; else l -= d; }
  const al = l / p; if (al === 0) return 100;
  return 100 - 100 / (1 + (g / p) / al);
}
function calcBBPos(closes, p = 20, k = 2) {
  if (!closes || closes.length < p) return null;
  const seg = closes.slice(-p);
  const mid = seg.reduce((a, b) => a + b, 0) / p;
  const sd = Math.sqrt(seg.reduce((a, b) => a + (b - mid) ** 2, 0) / p);
  const up = mid + k * sd, lo = mid - k * sd;
  if (up === lo) return 50;
  return ((closes[closes.length - 1] - lo) / (up - lo)) * 100;
}

/* relative-performance series (start = 100): portfolio (time-weighted, respects
   매수일 & 수량) vs indices (buy & hold the window). */
function closeAt(series, t) {
  if (!series?.ts?.length) return null;
  let v = null;
  for (let i = 0; i < series.ts.length; i++) {
    if (series.ts[i] != null && series.ts[i] <= t) v = series.closes[i];
    else if (series.ts[i] > t) break;
  }
  return v;
}
function buildPerf(histMap, holdings, rate) {
  const g = histMap["^GSPC"], n = histMap["^NDX"], k = histMap["^KS11"];
  const master = g || n || k;
  if (!master?.ts?.length) return { data: [], hasMe: false };
  const L = Math.min(master.ts.length, 130);
  const axis = master.ts.slice(master.ts.length - L);

  const pos = holdings.map((h) => {
    const key = h.type === "crypto" ? `${(h.ticker || "").toUpperCase()}-USD` : h.ticker;
    const hist = histMap[key];
    const qty = Number(h.qty) || 0;
    if (!hist?.closes?.length || qty <= 0) return null;
    const fxMul = h.cur === "KRW" ? 1 / rate : 1;
    const buyTs = h.buyDate ? Math.floor(new Date(h.buyDate + "T00:00:00Z").getTime() / 1000) : null;
    return { hist, qty, fxMul, buyTs };
  }).filter(Boolean);

  const normBench = (s) => {
    if (!s?.closes?.length) return null;
    const base = closeAt(s, axis[0]);
    return axis.map((t) => { const c = closeAt(s, t); return c != null && base ? +((c / base) * 100).toFixed(2) : null; });
  };
  const gN = normBench(g), nN = normBench(n), kN = normBench(k);

  const me = new Array(L).fill(null);
  let idx = null;
  for (let j = 0; j < L; j++) {
    const tNow = axis[j];
    if (j === 0) {
      const active = pos.filter((p) => p.buyTs == null || p.buyTs <= tNow);
      if (active.length) { me[0] = 100; idx = 100; }
      continue;
    }
    const tPrev = axis[j - 1];
    const active = pos.filter((p) => (p.buyTs == null || p.buyTs <= tPrev));
    if (!active.length) { me[j] = idx; continue; }
    let wSum = 0, ret = 0;
    active.forEach((p) => { const pp = closeAt(p.hist, tPrev); if (pp != null) wSum += p.qty * pp * p.fxMul; });
    if (wSum > 0) {
      active.forEach((p) => {
        const pp = closeAt(p.hist, tPrev), pc = closeAt(p.hist, tNow);
        if (pp != null && pc != null) ret += (p.qty * pp * p.fxMul / wSum) * (pc / pp - 1);
      });
    }
    if (idx == null) { idx = 100; me[j] = 100; }
    else { idx = idx * (1 + ret); me[j] = +idx.toFixed(2); }
  }

  const data = axis.map((t, j) => ({
    t: new Date(t * 1000).toISOString().slice(5, 10),
    me: me[j], gspc: gN ? gN[j] : null, ndx: nN ? nN[j] : null, ks: kN ? kN[j] : null,
  }));
  return { data, hasMe: pos.length > 0 };
}

/* external links */
const bareCode = (sym) => (sym || "").replace(/\.(KS|KQ)$/i, "");
const yahooUrl = (sym) => `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
const tossUrl = (sym) => `https://www.tossinvest.com/stocks/${encodeURIComponent(bareCode(sym))}`;
const redditUrl = (sym) => `https://www.reddit.com/search/?q=${encodeURIComponent(bareCode(sym) + " stock")}`;
const edgarUrl = (q) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(q)}&type=13F-HR&dateb=&owner=include&count=40`;

async function lookupTicker(query) {
  const trimmed = (query || "").trim();
  // 1) Korean name map → instant, reliable
  if (KR_NAME_MAP[trimmed]) {
    return { symbol: KR_NAME_MAP[trimmed], name: trimmed, sector: null };
  }
  // 2) our backend (Yahoo search)
  try {
    const r = await fetch(`/api/lookup?symbols=${encodeURIComponent(trimmed)}`);
    if (r.ok) { const j = await r.json(); if (j && j[trimmed] && j[trimmed].symbol) return j[trimmed]; }
  } catch { /* fall through */ }
  // 3) direct Yahoo search via public proxy (works in local/preview)
  try {
    const u = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(trimmed)}&quotesCount=10&newsCount=0`;
    const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
    const j = await r.json();
    const quotes = (j?.quotes || []).filter((x) => x.symbol && (x.quoteType === "EQUITY" || x.quoteType === "ETF" || !x.quoteType));
    const hangul = /[\uAC00-\uD7A3]/.test(trimmed);
    const q = (hangul
      ? (quotes.find((x) => /\.(KS|KQ)$/i.test(x.symbol)) || quotes[0])
      : (quotes.find((x) => x.symbol.toUpperCase() === trimmed.toUpperCase()) || quotes[0]));
    if (q) return { symbol: q.symbol, name: q.longname || q.shortname || null, sector: q.sector || null };
  } catch { /* skip */ }
  return null;
}

/* multi-result search for the autocomplete dropdown (#11) */
async function lookupCandidates(query) {
  const q = (query || "").trim();
  if (q.length < 1) return [];
  const out = [], seen = new Set();
  const ql = q.toLowerCase();
  Object.keys(KR_NAME_MAP).forEach((nm) => {
    if (out.length < 6 && nm.toLowerCase().includes(ql)) { const sym = KR_NAME_MAP[nm]; if (!seen.has(sym)) { seen.add(sym); out.push({ symbol: sym, name: nm }); } }
  });
  try {
    const u = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
    const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
    const j = await r.json();
    (j?.quotes || []).forEach((x) => {
      if (x.symbol && !seen.has(x.symbol) && (x.quoteType === "EQUITY" || x.quoteType === "ETF" || x.quoteType === "CRYPTOCURRENCY" || !x.quoteType)) {
        seen.add(x.symbol); out.push({ symbol: x.symbol, name: x.longname || x.shortname || "" });
      }
    });
  } catch { /* offline */ }
  return out.slice(0, 8);
}
/* ------------------------------------------------------------------ *
 *  PERSISTENCE  (localStorage — deployed site)                        *
 * ------------------------------------------------------------------ */
const KEY = "portfolio_heatmap_v2";
async function loadSaved() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
async function persist(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode */ }
}

/* ================================================================== *
 *  MAIN                                                                *
 * ================================================================== */
export default function App() {
  const [themeName, setThemeName] = useState("dark");
  const th = THEMES[themeName];
  const [displayCur, setDisplayCur] = useState("USD");
  const [holdings, setHoldings] = useState(SEED);
  const [cash, setCash] = useState(SEED_CASH);
  const [fx, setFx] = useState(null);
  const [fxLive, setFxLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const [heatMode, setHeatMode] = useState("change");
  const [capChange, setCapChange] = useState(3);
  const [capReturn, setCapReturn] = useState(25);
  const [showPct, setShowPct] = useState(true);
  const [labelMode, setLabelMode] = useState("ticker");
  const [portfolioCollapsed, setPortfolioCollapsed] = useState(false);
  const [goal, setGoal] = useState(null);          // { amount, cur }
  const [snapshots, setSnapshots] = useState([]);   // [{ t: 'YYYY-MM-DD', v: USD }]
  const [benchmarks, setBenchmarks] = useState({}); // { '^GSPC': {chg}, ... }
  const [histMap, setHistMap] = useState({});        // { symbol: {closes, ts} } for indicators + perf chart
  const [showImport, setShowImport] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [selectedWhale, setSelectedWhale] = useState(null);
  const [stockModal, setStockModal] = useState(null); // {key, ticker, name} for mini chart
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [preBackup, setPreBackup] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadSaved();
      if (s?.holdings?.length) setHoldings(s.holdings.map((h) => ({ avgCost: null, ...h })));
      if (s?.cash) setCash(s.cash);
      if (s?.goal) setGoal(s.goal);
      if (s?.snapshots) setSnapshots(s.snapshots);
      const x = s?.settings;
      if (x) {
        if (x.themeName) setThemeName(x.themeName);
        if (x.displayCur) setDisplayCur(x.displayCur);
        if (x.heatMode) setHeatMode(x.heatMode);
        if (x.capChange != null) setCapChange(x.capChange);
        if (x.capReturn != null) setCapReturn(x.capReturn);
        if (x.showPct != null) setShowPct(x.showPct);
        if (x.labelMode) setLabelMode(x.labelMode);
        if (x.portfolioCollapsed != null) setPortfolioCollapsed(x.portfolioCollapsed);
      }
      setHydrated(true);
      track("app_open", { from: getSource() });
    })();
  }, []);

  useEffect(() => {
    if (hydrated && !previewMode) { persist({ holdings, cash, goal, snapshots, settings: { themeName, displayCur, heatMode, capChange, capReturn, showPct, labelMode, portfolioCollapsed } }); setSavedAt(Date.now()); }
  }, [holdings, cash, goal, snapshots, themeName, displayCur, heatMode, capChange, capReturn, showPct, labelMode, portfolioCollapsed, hydrated, previewMode]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const krw = await fetchFx();
    if (krw) { setFx(krw); setFxLive(true); } else { setFx((p) => p ?? 1380); setFxLive(false); }
    const cryptoSyms = holdings.filter((h) => h.type === "crypto").map((h) => h.ticker.toUpperCase());
    const stockSyms = [...new Set(holdings.filter((h) => h.type !== "crypto" && h.ticker).map((h) => h.ticker))];
    const metricSyms = [...stockSyms, ...cryptoSyms.map((s) => `${s}-USD`)];
    const benchSyms = ["^GSPC", "^NDX", "^KS11"];
    const [cryptoData, stockData, bench, hist] = await Promise.all([
      fetchCrypto(cryptoSyms), fetchStocks(stockSyms), fetchStocks(benchSyms), fetchHistory([...metricSyms, ...benchSyms, "KRW=X"]),
    ]);
    setBenchmarks(bench || {});
    setHistMap(hist || {});
    setHoldings((prev) => prev.map((h) => {
      const mkey = h.type === "crypto" ? `${h.ticker.toUpperCase()}-USD` : h.ticker;
      const hc = hist[mkey]?.closes;
      const metrics = hc ? { rsi: calcRSI(hc), bbPos: calcBBPos(hc) } : {};
      if (h.type === "crypto") { const d = cryptoData[h.ticker.toUpperCase()]; return d ? { ...h, price: d.price, chg: d.chg, cur: "USD", live: true, ...metrics } : { ...h, ...metrics }; }
      const d = stockData[h.ticker]; return d ? { ...h, price: d.price, chg: d.chg, cur: d.cur || h.cur, mkt: d.mkt, live: true, ...metrics } : { ...h, ...metrics };
    }));
    setLastUpdate(new Date());
    setLoading(false);
  }, [holdings]);

  useEffect(() => {
    if (!hydrated) return;
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const rate = fx || 1380;
  const conv = useCallback((amount, cur) => {
    if (amount == null) return 0;
    if (cur === displayCur) return amount;
    return cur === "USD" ? amount * rate : amount / rate;
  }, [displayCur, rate]);

  const valueOf = useCallback((h) => (h.price == null || !h.qty ? 0 : conv(h.price * h.qty, h.cur)), [conv]);
  const costOf = useCallback((h) => (h.avgCost == null || !h.qty ? 0 : conv(h.avgCost * h.qty, h.cur)), [conv]);

  const positionsValue = useMemo(() => holdings.reduce((s, h) => s + valueOf(h), 0), [holdings, valueOf]);
  const positionsCost = useMemo(() => holdings.reduce((s, h) => s + costOf(h), 0), [holdings, costOf]);
  const cashValue = useMemo(() => cash.reduce((s, c) => s + conv(c.amount || 0, c.cur), 0), [cash, conv]);
  const totalAssets = positionsValue + cashValue;
  const cashPct = totalAssets ? (cashValue / totalAssets) * 100 : 0;
  const totalReturn = positionsCost ? ((positionsValue - positionsCost) / positionsCost) * 100 : null;

  /* record one net-worth snapshot per day (stored in USD base) */
  useEffect(() => {
    if (!hydrated || !totalAssets) return;
    const usd = displayCur === "USD" ? totalAssets : totalAssets / rate;
    const today = new Date().toISOString().slice(0, 10);
    setSnapshots((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.t === today && Math.abs(last.v - usd) < 0.01) return prev;
      return [...prev.filter((s) => s.t !== today), { t: today, v: usd }].slice(-180);
    });
  }, [hydrated, totalAssets, rate, displayCur]);

  const dayChange = useMemo(() => {
    let w = 0, sum = 0;
    holdings.forEach((h) => { const v = valueOf(h); if (h.chg != null && v) { w += v; sum += v * h.chg; } });
    return w ? sum / w : null;
  }, [holdings, valueOf]);

  /* unified leaves for heatmap + donut (positions + cash) */
  const leaves = useMemo(() => {
    const arr = holdings.filter((h) => h.ticker).map((h) => ({
      id: h.id, ticker: h.ticker, name: h.name, sector: h.sector,
      value: valueOf(h), metric: heatMode === "return" ? returnPct(h) : h.chg,
    })).filter((x) => x.value > 0);
    if (cashValue > 0) arr.push({ id: "__cash", ticker: "CASH", name: "현금", sector: "Cash", value: cashValue, metric: null });
    return arr;
  }, [holdings, valueOf, heatMode, cashValue]);

  const sectorData = useMemo(() => {
    const m = {};
    leaves.forEach((l) => { m[l.sector] = (m[l.sector] || 0) + l.value; });
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    return Object.entries(m).map(([sector, value]) => ({ sector, value, pct: tot ? (value / tot) * 100 : 0 })).sort((a, b) => b.value - a.value);
  }, [leaves]);

  const addHolding = () => { setHoldings((p) => [...p, { id: uid(), type: "us", ticker: "", name: "", sector: "Technology", qty: 0, avgCost: null, buyDate: null, price: null, cur: "USD", chg: null, live: false }]); track("add_holding"); };
  const loadSample = useCallback(() => {
    setPreBackup((prev) => prev || { holdings, cash }); // remember the user's real data (once)
    setHoldings(SAMPLE_HOLDINGS.map((h) => ({ id: uid(), ...h, buyDate: null, price: null, chg: null, live: false })));
    setCash([{ id: uid(), label: "예수금", cur: "USD", amount: 3000 }]);
    setPreviewMode(true);
    setShowWelcome(false); setWelcomeDismissed(true);
    track("load_sample");
  }, [holdings, cash]);

  const exitPreview = useCallback(() => {
    if (preBackup) { setHoldings(preBackup.holdings); setCash(preBackup.cash); }
    setPreBackup(null); setPreviewMode(false);
    track("exit_preview");
  }, [preBackup]);
  const updateHolding = (id, patch) => setHoldings((p) => p.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const removeHolding = (id) => setHoldings((p) => p.filter((h) => h.id !== id));

  const addCash = () => setCash((p) => [...p, { id: uid(), label: "", cur: "USD", amount: 0 }]);
  const updateCash = (id, patch) => setCash((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCash = (id) => setCash((p) => p.filter((c) => c.id !== id));

  const autoFill = useCallback(async (id, raw, type) => {
    if (!raw) return;
    if (type === "crypto") {
      const sym = raw.toUpperCase();
      updateHolding(id, { name: CRYPTO_NAMES[sym] || sym, sector: "Crypto" });
      const cd = await fetchCrypto([sym]);
      if (cd[sym]) updateHolding(id, { price: cd[sym].price, chg: cd[sym].chg, cur: "USD", live: true });
      return;
    }
    const info = await lookupTicker(raw);
    let sym = raw.toUpperCase();
    let nm = null;
    if (info) {
      const patch = {};
      if (info.symbol) { sym = info.symbol.toUpperCase(); patch.ticker = sym; }
      if (info.name) { patch.name = info.name; nm = info.name; }
      const theme = THEME_MAP[sym] || (info.sector ? mapSector(info.sector) : null);
      if (theme) patch.sector = theme;
      updateHolding(id, patch);
    } else if (THEME_MAP[sym]) {
      updateHolding(id, { sector: THEME_MAP[sym] });
    }
    const sd = await fetchStocks([sym]);
    if (sd[sym]) updateHolding(id, { price: sd[sym].price, chg: sd[sym].chg, mkt: sd[sym].mkt, ...(sd[sym].cur ? { cur: sd[sym].cur } : {}), live: true });
    /* AI refines the theme when it isn't one of the curated tickers */
    if (!THEME_MAP[sym]) {
      const theme = await classifyTicker(sym, nm);
      if (theme) updateHolding(id, { sector: theme });
    }
  }, []);

  const colorMap = useMemo(() => buildColorMap(sectorData.map((d) => d.sector)), [sectorData]);
  const heldSet = useMemo(() => new Set(holdings.map((h) => (h.ticker || "").toUpperCase()).filter(Boolean)), [holdings]);
  const ideas = useMemo(() => buildIdeas(sectorData, heldSet), [sectorData, heldSet]);
  const perfSeries = useMemo(() => buildPerf(histMap, holdings, rate), [histMap, holdings, rate]);

  /* per-holding weights by cost basis vs current value (#4) */
  const weightRows = useMemo(() => {
    const tCost = holdings.reduce((s, h) => s + costOf(h), 0);
    const tVal = holdings.reduce((s, h) => s + valueOf(h), 0);
    return holdings.filter((h) => h.ticker && (valueOf(h) > 0 || costOf(h) > 0)).map((h) => ({
      id: h.id, ticker: h.ticker, name: h.name,
      costW: tCost ? (costOf(h) / tCost) * 100 : 0,
      valW: tVal ? (valueOf(h) / tVal) * 100 : 0,
    })).sort((a, b) => b.valW - a.valW);
  }, [holdings, costOf, valueOf]);

  /* FX gain/loss in display currency (#3) — needs 매수일 + 평단가 on foreign holdings */
  const fxPnl = useMemo(() => {
    const fxHist = histMap["KRW=X"]; // USD/KRW history
    const fAt = (cur, ts) => {
      if (cur === displayCur) return 1;
      const usdkrw = ts == null ? rate : (closeAt(fxHist, ts) || rate);
      if (cur === "USD" && displayCur === "KRW") return usdkrw;
      if (cur === "KRW" && displayCur === "USD") return 1 / usdkrw;
      return null;
    };
    let priceP = 0, fxP = 0, n = 0, skipped = 0;
    holdings.forEach((h) => {
      const qty = Number(h.qty) || 0;
      if (!qty || h.avgCost == null || h.price == null) return;
      if (h.cur === displayCur) return;
      if (!h.buyDate) { skipped++; return; }
      const buyTs = Math.floor(new Date(h.buyDate + "T00:00:00Z").getTime() / 1000);
      const fNow = fAt(h.cur, null), fBuy = fAt(h.cur, buyTs);
      if (fNow == null || fBuy == null) { skipped++; return; }
      priceP += qty * (h.price - h.avgCost) * fNow;
      fxP += qty * h.avgCost * (fNow - fBuy);
      n++;
    });
    return { priceP, fxP, total: priceP + fxP, n, skipped, hasFxHist: !!fxHist };
  }, [holdings, histMap, rate, displayCur]);

  /* backup / restore (#14) */
  const exportData = useCallback(() => {
    const payload = { version: 2, exportedAt: new Date().toISOString(), holdings, cash, goal, snapshots, settings: { themeName, displayCur, heatMode, capChange, capReturn, showPct, labelMode } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [holdings, cash, goal, snapshots, themeName, displayCur, heatMode, capChange, capReturn, showPct, labelMode]);

  const importData = useCallback((file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (Array.isArray(d.holdings)) setHoldings(d.holdings.map((h) => ({ avgCost: null, buyDate: null, ...h })));
        if (Array.isArray(d.cash)) setCash(d.cash);
        if (d.goal) setGoal(d.goal);
        if (Array.isArray(d.snapshots)) setSnapshots(d.snapshots);
        const x = d.settings || {};
        if (x.themeName) setThemeName(x.themeName);
        if (x.displayCur) setDisplayCur(x.displayCur);
        if (x.heatMode) setHeatMode(x.heatMode);
        if (x.capChange != null) setCapChange(x.capChange);
        if (x.capReturn != null) setCapReturn(x.capReturn);
        if (x.showPct != null) setShowPct(x.showPct);
        if (x.labelMode) setLabelMode(x.labelMode);
      } catch { alert("백업 파일을 읽을 수 없어요. JSON 형식인지 확인해 주세요."); }
    };
    r.readAsText(file);
  }, []);

  const addAndFill = useCallback((ticker) => {
    const t = (ticker || "").toUpperCase();
    if (!t || heldSet.has(t)) return;
    const type = /\.(KS|KQ)$/i.test(t) ? "kr" : (CRYPTO_IDS[t] ? "crypto" : "us");
    const id = uid();
    setHoldings((p) => [...p, { id, type, ticker: t, name: "", sector: "", qty: 0, avgCost: null, buyDate: null, price: null, cur: type === "kr" ? "KRW" : "USD", chg: null, live: false }]);
    setTimeout(() => autoFill(id, t, type), 50);
  }, [heldSet, autoFill]);

  /* bulk import (from CSV or screenshot) — rows: [{ticker, qty, avgCost, cur?}] */
  const importHoldings = useCallback((rows) => {
    let added = 0;
    rows.forEach((row) => {
      const raw = (row.ticker || "").toString().trim();
      if (!raw) return;
      const t = raw.toUpperCase();
      const isCrypto = !!CRYPTO_IDS[t];
      const isKR = /\.(KS|KQ)$/i.test(t) || /[\uAC00-\uD7A3]/.test(raw);
      const type = isCrypto ? "crypto" : isKR ? "kr" : "us";
      const id = uid();
      const cur = row.cur || (type === "kr" ? "KRW" : "USD");
      setHoldings((p) => [...p, { id, type, ticker: type === "crypto" ? t : raw, name: "", sector: "", qty: Number(row.qty) || 0, avgCost: row.avgCost != null && row.avgCost !== "" ? Number(row.avgCost) : null, buyDate: row.buyDate || null, price: null, cur, chg: null, live: false }]);
      setTimeout(() => autoFill(id, type === "crypto" ? t : raw, type), 90 * added + 60);
      added++;
    });
    return added;
  }, [autoFill]);

  const capNow = heatMode === "return" ? capReturn : capChange;

  return (
    <div style={{ background: th.bg, color: th.text, minHeight: "100vh", transition: "background .25s", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}
        input,select{outline:none;font-family:inherit;} input:focus,select:focus{border-color:${th.accent}!important;}
        .ph-btn{transition:all .15s;cursor:pointer;} .ph-btn:hover{filter:brightness(1.1);}
        .ph-primary:hover{box-shadow:0 4px 16px ${th.accentGlow};}
        .ph-card{transition:box-shadow .2s, border-color .2s, transform .2s;}
        .ph-card:hover{border-color:${th.borderHover};box-shadow:${th.cardShadow};}
        .ph-row{transition:background .12s;} .ph-row:hover{background:${th.rowHover};}
        .ph-tile{transition:filter .14s, box-shadow .14s;cursor:default;}
        .ph-tile:hover{filter:brightness(1.14);box-shadow:inset 0 0 0 2px rgba(255,255,255,.6);z-index:6;}
        .ph-legend{transition:background .12s;border-radius:7px;} .ph-legend:hover{background:${th.rowHover};}
        @keyframes mqscroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .mq-track{animation-name:mqscroll;animation-timing-function:linear;animation-iteration-count:infinite;}
        .mq:hover .mq-track{animation-play-state:paused;} .cax::-webkit-scrollbar{display:none;}
        .sec{scroll-margin-top:118px;}
        .navbtn{transition:all .15s;cursor:pointer;} .navbtn:hover{color:${th.text};background:${th.panelAlt};}
        ::-webkit-scrollbar{height:8px;width:8px;} ::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px;}
        @keyframes spin{to{transform:rotate(360deg);}} .spin{animation:spin 1s linear infinite;}
        input[type=range]{accent-color:${th.accent};}
        @media (max-width:900px){.ph-grid{grid-template-columns:1fr !important;}}
      `}</style>

      {/* HEADER */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 22px", borderBottom: `1px solid ${th.border}`, background: th.bg, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#2d9cdb,#9b5de5)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17, color: "#fff", boxShadow: "0 2px 10px rgba(45,156,219,.4)" }}>P</div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>{CONFIG.productName}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "right", marginRight: 6 }}>
          <div className="num" style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{fmtMoney(totalAssets, displayCur)}</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 3 }}>
            <DeltaPill th={th} label="오늘" v={dayChange} />
            <DeltaPill th={th} label="수익" v={totalReturn} />
          </div>
        </div>
        <Segmented th={th} value={displayCur} onChange={setDisplayCur} options={[["USD", "$"], ["KRW", "₩"]]} />
        <button className="ph-btn" onClick={refresh} title="새로고침" style={iconBtn(th)}><RefreshCw size={16} className={loading ? "spin" : ""} color={th.accent} /></button>
        <button className="ph-btn" onClick={() => setThemeName(themeName === "dark" ? "light" : "dark")} title="테마" style={iconBtn(th)}>{themeName === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
      </header>

      {/* STATUS */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 22px", fontSize: 11.5, color: th.textDim, borderBottom: `1px solid ${th.border}` }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {fxLive ? <Wifi size={12} color={th.heatPos} /> : <WifiOff size={12} color={th.textFaint} />}
          USD/KRW <b className="num" style={{ color: th.text }}>{fmt(rate, 1)}</b><span style={{ color: th.textFaint }}>{fxLive ? "실시간" : "추정"}</span>
        </span>
        <span style={{ color: th.textFaint }}>·</span>
        <span>업데이트 {lastUpdate ? lastUpdate.toLocaleTimeString() : "—"} <span style={{ color: th.textFaint }}>(60초마다 자동)</span></span>
        {savedAt && !previewMode && <><span style={{ color: th.textFaint }}>·</span><span style={{ color: th.heatPos }}>✓ 자동 저장됨</span></>}
        {previewMode && <><span style={{ color: th.textFaint }}>·</span><span style={{ color: th.textFaint }}>미리보기(저장 안 됨)</span></>}
        <div style={{ flex: 1 }} />
        <button className="ph-btn navbtn" onClick={exportData} title="모든 데이터를 JSON 파일로 저장" style={{ background: "transparent", border: "none", color: th.textDim, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "3px 7px", borderRadius: 6 }}>⤓ 백업</button>
        <label className="navbtn" title="JSON 백업 파일에서 복원" style={{ color: th.textDim, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "3px 7px", borderRadius: 6 }}>⤒ 복원
          <input type="file" accept="application/json,.json" onChange={(e) => { importData(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
        </label>
      </div>

      {/* NAV */}
      <TopNav th={th} onHelp={() => { setShowWelcome(true); setWelcomeDismissed(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

      {/* BODY */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
        {previewMode && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 12, border: `1px solid ${th.accent}`, background: th.panelAlt }}>
            <span style={{ fontSize: 18 }}>👀</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>예시 데이터를 둘러보는 중이에요</div>
              <div style={{ fontSize: 12, color: th.textDim }}>샘플이라 저장되지 않아요. 돌아가면 원래 내 데이터가 그대로 있어요.</div>
            </div>
            <button className="ph-btn ph-primary" onClick={exitPreview} style={primaryBtn(th)}>← 내 데이터로 돌아가기</button>
          </div>
        )}
        {(showWelcome || (!welcomeDismissed && holdings.every((h) => !h.ticker) && !cash.length)) && (
          <WelcomeBanner th={th} onSample={loadSample} onAdd={addHolding} onClose={() => { setWelcomeDismissed(true); setShowWelcome(false); }} />
        )}
        {/* Heatmap — full width */}
        <div id="sec-heatmap" className="sec">
        <Panel th={th} title="Heatmap" glow
          titleExtra={<Segmented th={th} value={heatMode} onChange={setHeatMode} options={[["change", "현재가"], ["return", "내 수익률"]]} />}
          right={<HeatControls th={th} mode={heatMode} cap={capNow} setCap={heatMode === "return" ? setCapReturn : setCapChange} showPct={showPct} setShowPct={setShowPct} labelMode={labelMode} setLabelMode={setLabelMode} />}>
          <Treemap leaves={leaves} th={th} cap={capNow} showPct={showPct} labelMode={labelMode}
            onTile={(d) => setStockModal({ key: d.sector === "Crypto" ? `${(d.ticker || "").toUpperCase()}-USD` : d.ticker, ticker: d.ticker, name: d.name })} />
          <HeatLegend th={th} cap={capNow} mode={heatMode} />
        </Panel>
        </div>

        {/* My portfolio */}
        <div id="sec-portfolio" className="sec">
        <Panel th={th} title="내 포트폴리오" sub={portfolioCollapsed ? `${holdings.filter((h) => h.ticker).length}개 종목 · 접힘` : "티커만 넣으면 이름·섹터 자동 분류"}
          right={
            <div style={{ display: "flex", gap: 8 }}>
              {!portfolioCollapsed && <>
                <button className="ph-btn" onClick={() => setShowImport((v) => !v)} style={{ ...secondaryBtn(th) }}><Upload size={14} /> 가져오기</button>
                <button className="ph-btn ph-primary" onClick={addHolding} style={primaryBtn(th)}><Plus size={15} /> 종목 추가</button>
              </>}
              <button className="ph-btn" onClick={() => setPortfolioCollapsed((v) => !v)} style={{ ...secondaryBtn(th) }} title={portfolioCollapsed ? "표 펼치기" : "표 접기"}>
                {portfolioCollapsed ? "▾ 펼치기" : "▴ 접기"}
              </button>
            </div>
          }>
          {portfolioCollapsed ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 2px", fontSize: 13, color: th.textDim, flexWrap: "wrap" }}>
              <span>입력한 종목 <b style={{ color: th.text }}>{holdings.filter((h) => h.ticker).length}개</b>는 위 히트맵·섹터 비중에 그대로 반영돼요.</span>
              <button className="ph-btn" onClick={() => setPortfolioCollapsed(false)} style={{ background: "transparent", border: "none", color: th.accent, fontWeight: 700, cursor: "pointer", padding: 0 }}>편집하려면 펼치기 →</button>
            </div>
          ) : (
            <>
              {showImport && <ImportPanel th={th} onImport={(rows) => { const n = importHoldings(rows); if (n) setShowImport(false); }} />}
              <PortfolioTable holdings={holdings} th={th} displayCur={displayCur} valueOf={valueOf} totalAssets={totalAssets} onUpdate={updateHolding} onRemove={removeHolding} onAutoFill={autoFill} />
              <p style={{ fontSize: 11.5, color: th.textFaint, marginTop: 12, lineHeight: 1.6 }}>
                티커 입력 후 칸을 벗어나면 <b style={{ color: th.textDim }}>이름·섹터·지표(RSI·볼린저) 자동</b> 계산. 한국주식은 <b style={{ color: th.textDim }}>삼성전자</b>처럼 이름으로 넣어도 됩니다.
                <b style={{ color: th.textDim }}> 평단가</b>를 넣으면 "내 수익률" 히트맵이 켜집니다. 다 넣은 뒤엔 <b style={{ color: th.textDim }}>▴ 접기</b>로 깔끔하게 정리하세요.
              </p>
            </>
          )}
        </Panel>
        </div>

        {/* cash + sector donut */}
        <div id="sec-allocation" className="sec ph-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }} >
          <CashCard th={th} cash={cash} displayCur={displayCur} conv={conv} cashValue={cashValue} cashPct={cashPct}
            investedValue={positionsValue} onAdd={addCash} onUpdate={updateCash} onRemove={removeCash} />
          <Panel th={th} title="섹터별 자산 비중" sub={`${sectorData.length}개 구성`}>
            <Donut data={sectorData} th={th} colorMap={colorMap} />
          </Panel>
        </div>

        {/* per-holding weights + FX P&L */}
        <div className="ph-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <WeightCard th={th} rows={weightRows} />
          <FxCard th={th} fx={fxPnl} displayCur={displayCur} />
        </div>

        {/* goal + benchmark */}
        <div id="sec-goal" className="sec ph-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <GoalCard th={th} goal={goal} setGoal={setGoal} totalAssets={totalAssets} displayCur={displayCur} conv={conv} />
          <BenchmarkCard th={th} dayChange={dayChange} benchmarks={benchmarks} perf={perfSeries} />
        </div>

        {/* net-worth trend */}
        <div id="sec-trend" className="sec"><TrendCard th={th} snapshots={snapshots} displayCur={displayCur} rate={rate} /></div>

        {/* recommendations */}
        <div id="sec-ideas" className="sec">
          <ThemeIdeas th={th} ideas={ideas} onSelect={(it) => { setSelectedIdea(it); track("view_idea", { ticker: it.ticker }); }} selected={selectedIdea} />
          {selectedIdea && <IdeaDetail th={th} idea={selectedIdea} onClose={() => setSelectedIdea(null)} onAdd={addAndFill} />}
        </div>
        <div id="sec-whales" className="sec">
          <WhalePortfolios th={th} onSelect={(w) => { setSelectedWhale(w); track("view_whale", { name: w.name }); }} selected={selectedWhale} />
          {selectedWhale && <WhaleDetail th={th} whale={selectedWhale} onClose={() => setSelectedWhale(null)} onAdd={addAndFill} />}
        </div>
      </div>
      {stockModal && <StockModal th={th} info={stockModal} hist={histMap[stockModal.key]} holding={holdings.find((h) => h.ticker === stockModal.ticker)} displayCur={displayCur} onClose={() => setStockModal(null)} />}
      <button className="ph-btn ph-primary" onClick={() => { setFeedbackOpen(true); track("feedback_open"); }} title="의견·건의 보내기"
        style={{ position: "fixed", right: 20, bottom: 20, zIndex: 75, display: "flex", alignItems: "center", gap: 7, background: th.accent, color: "#fff", border: "2px solid rgba(255,255,255,.18)", padding: "13px 20px", borderRadius: 999, fontWeight: 800, fontSize: 14.5, cursor: "pointer", boxShadow: "0 8px 24px rgba(45,156,219,.45)" }}>💬 의견 보내기</button>
      {feedbackOpen && <FeedbackModal th={th} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  CASH CARD                                                          *
 * ------------------------------------------------------------------ */
function CashCard({ th, cash, displayCur, conv, cashValue, cashPct, investedValue, onAdd, onUpdate, onRemove }) {
  const investedPct = 100 - cashPct;
  return (
    <Panel th={th} title="현금 비중"
      titleExtra={<Wallet size={15} color={th.textDim} />}
      right={<button className="ph-btn ph-primary" onClick={onAdd} style={{ ...primaryBtn(th), padding: "6px 10px", fontSize: 12 }}><Plus size={14} /> 현금</button>}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span className="num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>{fmt(cashPct, 1)}%</span>
        <span style={{ fontSize: 12, color: th.textDim }}>현금 / 총자산</span>
      </div>
      <div className="num" style={{ fontSize: 13, color: th.textDim, marginBottom: 12 }}>{fmtMoney(cashValue, displayCur)}</div>

      {/* invested vs cash bar */}
      <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", background: th.inputBg, marginBottom: 6 }}>
        <div style={{ width: `${investedPct}%`, background: th.accent }} />
        <div style={{ width: `${cashPct}%`, background: CASH_COLOR }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: th.textDim, marginBottom: 14 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Dot c={th.accent} />투자 {fmt(investedPct, 1)}%</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Dot c={CASH_COLOR} />현금 {fmt(cashPct, 1)}%</span>
      </div>

      {/* cash entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cash.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={c.label} placeholder="메모(선택)" onChange={(e) => onUpdate(c.id, { label: e.target.value })} style={{ ...inpStyle(th, 0), flex: 1, minWidth: 0 }} />
            <input type="number" value={c.amount || ""} placeholder="금액" onChange={(e) => onUpdate(c.id, { amount: parseFloat(e.target.value) || 0 })} style={{ ...inpStyle(th, 92), textAlign: "right" }} className="num" />
            <select value={c.cur} onChange={(e) => onUpdate(c.id, { cur: e.target.value })} style={selStyle(th, 52)}><option value="USD">$</option><option value="KRW">₩</option></select>
            <button className="ph-btn" onClick={() => onRemove(c.id)} style={{ ...iconBtn(th), width: 28, height: 28, color: th.heatNeg }}><Trash2 size={13} /></button>
          </div>
        ))}
        {!cash.length && <div style={{ fontSize: 12, color: th.textFaint, padding: "4px 0" }}>현금을 추가하면 비중이 계산됩니다</div>}
      </div>
    </Panel>
  );
}
const Dot = ({ c }) => <span style={{ width: 8, height: 8, borderRadius: 3, background: c, display: "inline-block" }} />;

/* ------------------------------------------------------------------ *
 *  HEATMAP CONTROLS                                                   *
 * ------------------------------------------------------------------ */
function HeatControls({ th, mode, cap, setCap, showPct, setShowPct, labelMode, setLabelMode }) {
  const max = mode === "return" ? 100 : 10, step = mode === "return" ? 5 : 0.5, min = mode === "return" ? 5 : 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: th.textDim }}>
        최대 채도 <b className="num" style={{ color: th.text }}>±{cap}%</b>
        <input type="range" min={min} max={max} step={step} value={cap} onChange={(e) => setCap(parseFloat(e.target.value))} style={{ width: 88 }} />
      </label>
      <Segmented th={th} small value={labelMode} onChange={setLabelMode} options={[["ticker", "티커"], ["name", "이름"]]} />
      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: th.textDim, cursor: "pointer" }}>
        <input type="checkbox" checked={showPct} onChange={(e) => setShowPct(e.target.checked)} /> %
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  TREEMAP                                                            *
 * ------------------------------------------------------------------ */
function Treemap({ leaves, th, cap, showPct, labelMode, onTile }) {
  const ref = useRef(null);
  const [w, setW] = useState(800);
  const H = 430;
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const root = useMemo(() => {
    if (!leaves.length) return null;
    const bySector = {};
    leaves.forEach((l) => { (bySector[l.sector] = bySector[l.sector] || []).push(l); });
    const children = Object.entries(bySector).map(([sector, items]) => ({ sector, children: items }));
    const r = d3.hierarchy({ children }).sum((d) => d.value).sort((a, b) => b.value - a.value);
    d3.treemap().size([w, H]).paddingInner(3).paddingTop(21).round(true)(r);
    return r;
  }, [leaves, w]);

  if (!root) return <div ref={ref} style={{ height: H, display: "grid", placeItems: "center", color: th.textFaint, border: `1px dashed ${th.border}`, borderRadius: 10, fontSize: 13 }}>종목을 추가하면 히트맵이 표시됩니다</div>;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: H, borderRadius: 10, overflow: "hidden", background: th.band }}>
      {root.children.map((s, i) => (
        <div key={"sec" + i} style={{ position: "absolute", left: s.x0, top: s.y0, width: s.x1 - s.x0, height: 21, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: th.textDim, padding: "5px 7px 0", textTransform: "uppercase", overflow: "hidden", whiteSpace: "nowrap", pointerEvents: "none" }}>{s.data.sector}</div>
      ))}
      {root.leaves().map((leaf) => {
        const bw = leaf.x1 - leaf.x0, bh = leaf.y1 - leaf.y0, area = bw * bh;
        const color = heatColor(leaf.data.metric, th, cap);
        const showLabel = area > 1300, showPctHere = showPct && area > 4200 && leaf.data.metric != null;
        const fs = Math.max(8, Math.min(23, Math.sqrt(area) / 5.4));
        const dark = d3.hcl(color).l < 60;
        const tc = dark ? "#fff" : "#0b1015";
        const label = labelMode === "name" && leaf.data.name ? leaf.data.name : (leaf.data.ticker || "").replace(".KS", "").replace(".KQ", "");
        const tk = leaf.data.ticker || "";
        const isKR = /\.(KS|KQ)$/i.test(tk) || /^\d{6}$/.test(tk);
        const finalLabel = ((labelMode === "name" || isKR) && leaf.data.name) ? leaf.data.name : (tk.replace(".KS", "").replace(".KQ", "") || label);
        return (
          <div key={leaf.data.id} className="ph-tile" title={`${leaf.data.name || leaf.data.ticker}  ${leaf.data.metric != null ? (leaf.data.metric >= 0 ? "+" : "") + fmt(leaf.data.metric) + "%" : ""} · 클릭하면 차트`}
            onClick={() => { if (onTile && leaf.data.id !== "__cash") onTile(leaf.data); }}
            style={{ position: "absolute", left: leaf.x0, top: leaf.y0, width: bw, height: bh, background: color, borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", color: tc, padding: 2, cursor: leaf.data.id === "__cash" ? "default" : "pointer" }}>
            {showLabel && <div style={{ fontWeight: 700, fontSize: fs, lineHeight: 1.05, textAlign: "center", padding: "0 3px", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", whiteSpace: "nowrap" }}>{finalLabel}</div>}
            {showPctHere && <div className="num" style={{ fontSize: Math.max(8, fs * 0.6), opacity: 0.95 }}>{leaf.data.metric >= 0 ? "+" : ""}{fmt(leaf.data.metric)}%</div>}
          </div>
        );
      })}
    </div>
  );
}

function HeatLegend({ th, cap, mode }) {
  const stops = [-cap * 1.6, -cap, -cap / 2, 0, cap / 2, cap, cap * 1.6];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
      <span style={{ fontSize: 10.5, color: th.textFaint }}>{mode === "return" ? "수익률" : "일간"}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {stops.map((s, i) => (
          <div key={i} className="num" style={{ background: heatColor(s, th, cap), color: Math.abs(s) > cap / 2 ? "#fff" : th.text, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", minWidth: 44, textAlign: "center", borderRadius: 5 }}>{s > 0 ? "+" : ""}{fmt(s, s % 1 === 0 ? 0 : 1)}%</div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  DONUT                                                              *
 * ------------------------------------------------------------------ */
function Donut({ data, th, colorMap }) {
  const col = (s) => (colorMap && colorMap[s]) || "#888";
  if (!data.length) return <div style={{ height: 220, display: "grid", placeItems: "center", color: th.textFaint, fontSize: 13 }}>데이터 없음</div>;
  const top = data[0];
  return (
    <div>
      <div style={{ position: "relative", height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="sector" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((d) => <Cell key={d.sector} fill={col(d.sector)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: col(top.sector) }}>{fmt(top.pct, 1)}%</div>
            <div style={{ fontSize: 11, color: th.textDim, maxWidth: 90, lineHeight: 1.2 }}>{top.sector}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
        {data.map((d) => (
          <div key={d.sector} className="ph-legend" style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, padding: "3px 6px", margin: "0 -6px" }}>
            <Dot c={col(d.sector)} /><span style={{ flex: 1, color: th.text }}>{d.sector}</span>
            <span className="num" style={{ color: th.textDim, fontWeight: 600 }}>{fmt(d.pct, 1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  TABLE                                                              *
 * ------------------------------------------------------------------ */
function PortfolioTable({ holdings, th, displayCur, valueOf, totalAssets, onUpdate, onRemove, onAutoFill }) {
  const mobile = useIsMobile(720);
  if (mobile) return (<><datalist id="ph-sectors">{SECTOR_PRESETS.map((s) => <option key={s} value={s} />)}</datalist><PortfolioCards holdings={holdings} th={th} displayCur={displayCur} valueOf={valueOf} totalAssets={totalAssets} onUpdate={onUpdate} onRemove={onRemove} onAutoFill={onAutoFill} /></>);
  const head = (t) => ({ textAlign: t || "left", fontSize: 10.5, fontWeight: 600, color: th.textFaint, padding: "8px 8px", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" });
  const cell = { padding: "6px 8px", fontSize: 12.5, borderTop: `1px solid ${th.border}` };
  return (
    <div style={{ overflowX: "auto" }}>
      <datalist id="ph-sectors">{SECTOR_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
        <thead><tr>
          <th style={head()}>유형</th><th style={head()}>티커</th><th style={head()}>이름</th><th style={head()}>섹터</th>
          <th style={head("right")}>수량</th><th style={head("right")}>평단가</th><th style={head("center")} title="매수일을 넣으면 벤치마크 추이에 실제 보유 시점이 반영됩니다">매수일</th><th style={head("right")}>현재 주가</th>
          <th style={head("right")}>일간%</th><th style={head("right")} title="RSI(14)">RSI</th><th style={head("right")} title="볼린저밴드 위치 (20일, 2σ) — %B">BB%</th><th style={head("right")}>수익률%</th><th style={head("right")}>평가액 ({displayCur})</th><th style={head("right")}>비중</th><th style={head("center")}></th>
        </tr></thead>
        <tbody>
          {holdings.map((h) => {
            const v = valueOf(h), wpct = totalAssets ? (v / totalAssets) * 100 : 0, ret = returnPct(h);
            return (
              <tr key={h.id} className="ph-row">
                <td style={cell}><select value={h.type} onChange={(e) => { const t = e.target.value; onUpdate(h.id, { type: t, cur: t === "kr" ? "KRW" : "USD", sector: t === "crypto" ? "Crypto" : h.sector }); }} style={selStyle(th, 62)}><option value="us">미국</option><option value="kr">한국</option><option value="etf">ETF</option><option value="crypto">크립토</option></select></td>
                <td style={cell}><TickerInput th={th} value={h.ticker} type={h.type} width={92} placeholder={h.type === "kr" ? "삼성전자" : h.type === "crypto" ? "BTC" : "AAPL"}
                  onText={(val) => onUpdate(h.id, { ticker: val, live: false })}
                  onPick={(sym) => { const s = (sym || h.ticker || "").toUpperCase(); if (s !== h.ticker) onUpdate(h.id, { ticker: s, live: false }); onAutoFill(h.id, s, h.type); }} /></td>
                <td style={cell}><input value={h.name} placeholder="자동" onChange={(e) => onUpdate(h.id, { name: e.target.value })} style={inpStyle(th, 120)} /></td>
                <td style={cell}><input list="ph-sectors" value={h.sector} placeholder="섹터/테마" onChange={(e) => onUpdate(h.id, { sector: e.target.value })} style={inpStyle(th, 132)} /></td>
                <td style={{ ...cell, textAlign: "right" }}><input type="number" value={h.qty || ""} placeholder="0" onChange={(e) => onUpdate(h.id, { qty: parseFloat(e.target.value) || 0 })} style={{ ...inpStyle(th, 66), textAlign: "right" }} className="num" /></td>
                <td style={{ ...cell, textAlign: "right" }}><div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}><input type="number" value={h.avgCost ?? ""} placeholder="평단" onChange={(e) => onUpdate(h.id, { avgCost: e.target.value === "" ? null : parseFloat(e.target.value) })} style={{ ...inpStyle(th, 76), textAlign: "right" }} className="num" /><span style={{ fontSize: 11, color: th.textFaint, width: 10 }}>{h.cur === "KRW" ? "₩" : "$"}</span></div></td>
                <td style={{ ...cell, textAlign: "center" }}><input type="date" value={h.buyDate || ""} onChange={(e) => onUpdate(h.id, { buyDate: e.target.value || null })} style={{ ...inpStyle(th, 124), colorScheme: th === THEMES.dark ? "dark" : "light" }} title="매수일(선택)" /></td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                    <input type="number" value={h.price ?? ""} placeholder="자동" onChange={(e) => onUpdate(h.id, { price: e.target.value === "" ? null : parseFloat(e.target.value), live: false })} style={{ ...inpStyle(th, 84), textAlign: "right", color: h.live ? th.accent : th.text }} className="num" title={h.live ? "야후 실시간" : "직접 입력 가능"} />
                    <span style={{ fontSize: 11, color: th.textFaint, width: 10 }}>{h.cur === "KRW" ? "₩" : "$"}</span>
                  </div>
                  {h.live && h.mkt && h.mkt !== "정규장" && (
                    <div style={{ fontSize: 9.5, marginTop: 2, textAlign: "right", color: h.mkt === "프리장" ? th.accent : h.mkt === "애프터장" ? "#f59e0b" : th.textFaint }}>{h.mkt}</div>
                  )}
                </td>
                <td className="num" style={{ ...cell, textAlign: "right", color: h.chg == null ? th.textFaint : h.chg >= 0 ? th.heatPos : th.heatNeg, fontWeight: 600 }}>{h.chg == null ? "—" : `${h.chg >= 0 ? "+" : ""}${fmt(h.chg)}`}</td>
                <td className="num" style={{ ...cell, textAlign: "right", fontWeight: 600, color: h.rsi == null ? th.textFaint : h.rsi >= 70 ? th.heatNeg : h.rsi <= 30 ? th.heatPos : th.textDim }} title={h.rsi >= 70 ? "과매수권" : h.rsi <= 30 ? "과매도권" : ""}>{h.rsi == null ? "—" : fmt(h.rsi, 0)}</td>
                <td className="num" style={{ ...cell, textAlign: "right", fontWeight: 600, color: h.bbPos == null ? th.textFaint : h.bbPos >= 100 ? th.heatNeg : h.bbPos <= 0 ? th.heatPos : th.textDim }} title="볼린저밴드 내 위치 (0%=하단, 100%=상단)">{h.bbPos == null ? "—" : fmt(h.bbPos, 0) + "%"}</td>
                <td className="num" style={{ ...cell, textAlign: "right", color: ret == null ? th.textFaint : ret >= 0 ? th.heatPos : th.heatNeg, fontWeight: 700 }}>{ret == null ? "—" : `${ret >= 0 ? "+" : ""}${fmt(ret)}`}</td>
                <td className="num" style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{fmtMoney(v, displayCur)}</td>
                <td className="num" style={{ ...cell, textAlign: "right", color: th.textDim }}>{fmt(wpct, 1)}%</td>
                <td style={{ ...cell, textAlign: "center" }}><button className="ph-btn" onClick={() => onRemove(h.id)} style={{ ...iconBtn(th), width: 28, height: 28, color: th.heatNeg }}><Trash2 size={14} /></button></td>
              </tr>
            );
          })}
          {!holdings.length && <tr><td colSpan={15} style={{ ...cell, textAlign: "center", color: th.textFaint, padding: 28 }}>"종목 추가"를 눌러 입력하세요</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  PRIMITIVES                                                         *
 * ------------------------------------------------------------------ */
function DeltaPill({ th, label, v }) {
  const up = v != null && v >= 0;
  const c = v == null ? th.textDim : up ? th.heatPos : th.heatNeg;
  const bg = v == null ? "transparent" : up ? th.posBg : th.negBg;
  return (
    <span className="num" style={{ display: "inline-flex", alignItems: "center", gap: 3, background: bg, color: c, fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
      <span style={{ color: th.textFaint, fontWeight: 600 }}>{label}</span>
      {v != null && (up ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
      {v == null ? "—" : `${up ? "+" : ""}${fmt(v)}%`}
    </span>
  );
}
function Panel({ th, title, sub, titleExtra, right, glow, children }) {
  return (
    <div className="ph-card" style={{ position: "relative", background: th.panel, border: `1px solid ${th.border}`, borderRadius: 16, padding: 18, overflow: "hidden" }}>
      {glow && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 90, background: th.heroGlow, pointerEvents: "none" }} />}
      <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div><div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>{title}</div>{sub && <div style={{ fontSize: 11, color: th.textDim, marginTop: 1 }}>{sub}</div>}</div>
          {titleExtra}
        </div>
        <div style={{ flex: 1 }} />{right}
      </div>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
function Segmented({ th, value, onChange, options, small }) {
  return (
    <div style={{ display: "inline-flex", background: th.panelAlt, borderRadius: 999, padding: 3 }}>
      {options.map(([val, label]) => {
        const on = value === val;
        return (
          <button key={val} className="ph-btn" onClick={() => onChange(val)} style={{ border: "none", borderRadius: 999, padding: small ? "4px 10px" : "5px 13px", fontSize: small ? 11.5 : 12.5, fontWeight: 700, background: on ? th.accent : "transparent", color: on ? "#fff" : th.textDim, cursor: "pointer", transition: "all .15s", boxShadow: on ? "0 1px 6px rgba(0,0,0,.28)" : "none" }}>{label}</button>
        );
      })}
    </div>
  );
}
const iconBtn = (th) => ({ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: th.panelAlt, border: `1px solid ${th.border}`, color: th.text, cursor: "pointer" });
const primaryBtn = (th) => ({ display: "flex", alignItems: "center", gap: 6, background: th.accent, color: "#fff", border: "none", padding: "8px 13px", borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: "pointer" });
const secondaryBtn = (th) => ({ display: "flex", alignItems: "center", gap: 6, background: th.panelAlt, color: th.text, border: `1px solid ${th.border}`, padding: "8px 13px", borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: "pointer" });
const inpStyle = (th, w) => ({ width: w || undefined, background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 8, padding: "6px 9px", fontSize: 12.5 });
const selStyle = (th, w) => ({ width: w, background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 8, padding: "6px 7px", fontSize: 12, cursor: "pointer" });

/* ------------------------------------------------------------------ *
 *  CAROUSELS (auto-scroll, therich.io style)                          *
 * ------------------------------------------------------------------ */
function Carousel({ th, children, speed = 0.5 }) {
  const trackRef = useRef(null);
  const groupRef = useRef(null);
  const offRef = useRef(0);
  const pausedRef = useRef(false);
  const apply = () => { if (trackRef.current) trackRef.current.style.transform = `translateX(${-offRef.current}px)`; };
  useEffect(() => {
    let raf;
    const step = () => {
      const g = groupRef.current; const loop = g ? g.offsetWidth + 12 : 0;
      if (!pausedRef.current) {
        offRef.current += speed;
        if (loop > 0 && offRef.current >= loop) offRef.current -= loop;
        apply();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  const nudge = (dir) => {
    const g = groupRef.current; const loop = g ? g.offsetWidth + 12 : 0;
    offRef.current += dir * 300;
    if (loop > 0) { while (offRef.current < 0) offRef.current += loop; while (offRef.current >= loop) offRef.current -= loop; }
    if (trackRef.current) { trackRef.current.style.transition = "transform .35s ease"; apply(); setTimeout(() => { if (trackRef.current) trackRef.current.style.transition = "none"; }, 360); }
  };
  const arrow = (dir) => ({
    position: "absolute", top: "50%", transform: "translateY(-50%)", [dir < 0 ? "left" : "right"]: 2, zIndex: 5,
    width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer",
    background: th.panel, border: `1px solid ${th.border}`, color: th.text, fontSize: 17, fontWeight: 700, boxShadow: th.cardShadow,
  });
  return (
    <div style={{ position: "relative" }}
      onMouseEnter={() => (pausedRef.current = true)} onMouseLeave={() => (pausedRef.current = false)}
      onTouchStart={() => (pausedRef.current = true)} onTouchEnd={() => (pausedRef.current = false)}>
      <button aria-label="이전" className="navbtn" onClick={() => nudge(-1)} style={arrow(-1)}>‹</button>
      <div style={{ overflow: "hidden", padding: "2px 42px", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)" }}>
        <div ref={trackRef} style={{ display: "flex", gap: 12, width: "max-content", willChange: "transform" }}>
          <div ref={groupRef} style={{ display: "flex", gap: 12 }}>{children}</div>
          <div style={{ display: "flex", gap: 12 }} aria-hidden="true">{children}</div>
        </div>
      </div>
      <button aria-label="다음" className="navbtn" onClick={() => nudge(1)} style={arrow(1)}>›</button>
    </div>
  );
}

function ThemeIdeas({ th, ideas, onSelect, selected }) {
  if (!ideas.length) return null;
  return (
    <Panel th={th} title="투자 아이디어" sub="나에게 맞는 테마주는? · 클릭하면 설명·링크">
      <Carousel th={th}>
        {ideas.map((it, i) => {
          const grad = i % 4 === 3, on = selected && selected.ticker === it.ticker;
          return (
            <button key={i} className="ph-btn" onClick={() => onSelect(it)}
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 156, padding: "12px 18px", borderRadius: 999, border: `1px solid ${on ? th.accent : grad ? "transparent" : th.border}`, background: grad ? "linear-gradient(100deg,#7c4dff,#2d9cdb)" : th.panelAlt, color: grad ? "#fff" : th.text, cursor: "pointer", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 10.5, opacity: 0.78, fontWeight: 600 }}>{it.kind === "diversify" ? "다양화 · " : "+ 추가 · "}{it.theme}</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{(it.ticker || "").replace(".KS", "").replace(".KQ", "")}</span>
            </button>
          );
        })}
      </Carousel>
    </Panel>
  );
}

function LinkBtn({ th, href, children, color }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="ph-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 12.5, fontWeight: 700, padding: "8px 13px", borderRadius: 9, border: `1px solid ${th.border}`, background: th.panelAlt, color: color || th.text }}>{children}</a>;
}

function IdeaDetail({ th, idea, onClose, onAdd }) {
  const [desc, setDesc] = useState(null);
  const [loading, setLoading] = useState(true);
  const sym = idea.ticker;
  useEffect(() => {
    let live = true; setLoading(true); setDesc(null);
    describeTicker(sym, "").then((t) => { if (live) { setDesc(t); setLoading(false); } });
    return () => { live = false; };
  }, [sym]);
  return (
    <div className="ph-card" style={{ marginTop: 12, background: th.panel, border: `1px solid ${th.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{bareCode(sym)}</span>
        <span style={{ fontSize: 12, color: th.textDim, background: th.panelAlt, padding: "2px 9px", borderRadius: 999 }}>{idea.theme}</span>
        <div style={{ flex: 1 }} />
        <button className="ph-btn ph-primary" onClick={() => onAdd(sym)} style={primaryBtn(th)}><Plus size={14} /> 내 포트폴리오에 추가</button>
        <button className="ph-btn" onClick={onClose} style={iconBtn(th)}>✕</button>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: th.text, margin: "6px 0 14px", minHeight: 22 }}>
        {loading ? <span style={{ color: th.textFaint }}>설명을 불러오는 중…</span> : (desc || "이 종목에 대한 간단한 설명을 불러오지 못했어요. 아래 링크에서 자세히 확인하세요. (배포본은 AI 설명에 API 키가 필요합니다)")}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <LinkBtn th={th} href={yahooUrl(sym)} color="#7c4dff">Yahoo Finance ↗</LinkBtn>
        <LinkBtn th={th} href={tossUrl(sym)} color="#2d9cdb">토스증권 ↗</LinkBtn>
        <LinkBtn th={th} href={redditUrl(sym)} color="#fc6e51">Reddit ↗</LinkBtn>
      </div>
    </div>
  );
}

function WhaleCard({ th, w, onSelect, on }) {
  return (
    <button className="ph-card" onClick={() => onSelect(w)} style={{ width: 234, padding: 16, borderRadius: 14, border: `1px solid ${on ? th.accent : th.border}`, background: th.panel, cursor: "pointer", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${w.hue},${th.panelAlt})`, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16, color: "#fff", flexShrink: 0 }}>{w.name.slice(0, 1)}</div>
        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap" }}>{w.name}</div><div style={{ fontSize: 11, color: th.textDim, whiteSpace: "nowrap" }}>{w.fund}</div></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {w.holdings.slice(0, 4).map((x) => (<span key={x.t} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 7, background: th.panelAlt, color: th.textDim }}>{x.t}</span>))}
      </div>
    </button>
  );
}

function WhalePortfolios({ th, onSelect, selected }) {
  return (
    <Panel th={th} title="부자들의 포트폴리오" sub="유명 투자자 (참고용) · 클릭하면 포트폴리오·공시">
      <Carousel th={th} speed={0.35}>
        {WHALES.map((w, i) => <div key={i}><WhaleCard th={th} w={w} onSelect={onSelect} on={selected && selected.name === w.name} /></div>)}
      </Carousel>
    </Panel>
  );
}

function WhaleDetail({ th, whale, onClose, onAdd }) {
  const data = whale.holdings.map((x) => ({ sector: x.t, value: x.w }));
  const cmap = {}; let pi = 0;
  data.forEach((d) => { cmap[d.sector] = d.sector === "기타" ? CASH_COLOR : PALETTE[pi++ % PALETTE.length]; });
  return (
    <div className="ph-card" style={{ marginTop: 12, background: th.panel, border: `1px solid ${th.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg,${whale.hue},${th.panelAlt})`, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, color: "#fff" }}>{whale.name.slice(0, 1)}</div>
        <div><div style={{ fontWeight: 800, fontSize: 15 }}>{whale.name}</div><div style={{ fontSize: 11.5, color: th.textDim }}>{whale.fund} · {whale.holdings.length - 1}개 주요 종목</div></div>
        <div style={{ flex: 1 }} />
        <button className="ph-btn" onClick={onClose} style={iconBtn(th)}>✕</button>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: th.text, margin: "4px 0 12px" }}>{whale.desc}</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 190, height: 190, position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={data} dataKey="value" nameKey="sector" cx="50%" cy="50%" innerRadius={50} outerRadius={84} paddingAngle={1.5} stroke="none">{data.map((d) => <Cell key={d.sector} fill={cmap[d.sector]} />)}</Pie></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
          {data.map((d) => {
            const isOther = d.sector === "기타";
            return (
              <button key={d.sector} className="ph-btn ph-legend" disabled={isOther} onClick={() => !isOther && onAdd(d.sector)} title={isOther ? "그 외 소형 포지션 합계" : "내 포트폴리오에 추가"} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, background: "transparent", border: "none", color: isOther ? th.textFaint : th.text, cursor: isOther ? "default" : "pointer", padding: "3px 6px" }}>
                <Dot c={cmap[d.sector]} /><span style={{ flex: 1, textAlign: "left", fontWeight: 600 }}>{d.sector}</span>
                <span className="num" style={{ color: th.textDim }}>{d.value}%</span>{!isOther && <Plus size={12} color={th.textFaint} />}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <LinkBtn th={th} href={edgarUrl(whale.q)} color="#2d9cdb">실제 13F 공시 (SEC EDGAR) ↗</LinkBtn>
        <span style={{ fontSize: 11, color: th.textFaint }}>※ 종목·비중은 참고용 예시이며 최신 공시와 다를 수 있어요.</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  GOAL                                                               *
 * ------------------------------------------------------------------ */
function GoalCard({ th, goal, setGoal, totalAssets, displayCur, conv }) {
  const amount = goal?.amount ?? "";
  const gcur = goal?.cur || displayCur;
  const goalInDisplay = goal?.amount ? conv(goal.amount, gcur) : 0;
  const pct = goalInDisplay ? Math.min(100, (totalAssets / goalInDisplay) * 100) : 0;
  const remaining = Math.max(0, goalInDisplay - totalAssets);
  return (
    <Panel th={th} title="목표 설정" titleExtra={<Target size={15} color={th.textDim} />}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: th.textDim }}>목표 금액</span>
        <input type="number" value={amount} placeholder="예: 100000000" onChange={(e) => setGoal({ amount: e.target.value === "" ? null : parseFloat(e.target.value), cur: gcur })} style={{ ...inpStyle(th, 0), flex: 1, textAlign: "right" }} className="num" />
        <select value={gcur} onChange={(e) => setGoal({ amount: goal?.amount ?? null, cur: e.target.value })} style={selStyle(th, 54)}><option value="USD">$</option><option value="KRW">₩</option></select>
      </div>
      {goalInDisplay ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <span className="num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6, color: pct >= 100 ? th.heatPos : th.accent }}>{fmt(pct, 1)}%</span>
            <span style={{ fontSize: 12, color: th.textDim }}>달성</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, overflow: "hidden", background: th.inputBg, marginBottom: 8 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? th.heatPos : `linear-gradient(90deg,#2d9cdb,#7c4dff)`, transition: "width .4s" }} />
          </div>
          <div className="num" style={{ fontSize: 12.5, color: th.textDim }}>
            {fmtMoney(totalAssets, displayCur)} / {fmtMoney(goalInDisplay, displayCur)}
            {remaining > 0 && <span> · 남은 금액 <b style={{ color: th.text }}>{fmtMoney(remaining, displayCur)}</b></span>}
            {pct >= 100 && <span style={{ color: th.heatPos, fontWeight: 700 }}> · 목표 달성! 🎉</span>}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: th.textFaint, padding: "8px 0" }}>목표 금액을 입력하면 달성률이 표시됩니다.</div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 *  BENCHMARK (today's performance vs indices)                         *
 * ------------------------------------------------------------------ */
function BenchmarkCard({ th, dayChange, benchmarks, perf }) {
  const [mode, setMode] = useState("bar");
  const data = [
    { label: "내 포트폴리오", v: dayChange == null ? null : +dayChange.toFixed(2), me: true },
    ...BENCH.map((b) => ({ label: b.label, v: benchmarks[b.sym]?.chg != null ? +benchmarks[b.sym].chg.toFixed(2) : null, me: false })),
  ];
  const hasBar = data.some((d) => d.v != null);
  const plot = data.map((d) => ({ ...d, v: d.v == null ? 0 : d.v, _null: d.v == null }));
  const series = perf?.data || [];
  const hasLine = series.length > 1;
  const LINES = [
    { key: "me", name: "내 포트폴리오", color: th.accent, width: 2.6 },
    { key: "gspc", name: "S&P 500", color: "#16c784", width: 1.6 },
    { key: "ndx", name: "나스닥100", color: "#f5a623", width: 1.6 },
    { key: "ks", name: "코스피", color: "#ec4899", width: 1.6 },
  ];
  return (
    <Panel th={th} title="벤치마크 대비"
      sub={mode === "bar" ? "오늘 변동률 비교 (%)" : "상대 성과 추이 (시작=100, 약 6개월)"}
      right={<Segmented th={th} value={mode} onChange={setMode} options={[["bar", "막대"], ["line", "추이"]]} />}>
      {mode === "bar" ? (
        hasBar ? (
          <div style={{ height: 224 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plot} margin={{ top: 18, right: 6, left: -8, bottom: 0 }} barCategoryGap="28%">
                <ReferenceLine y={0} stroke={th.border} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: th.textDim }} axisLine={{ stroke: th.border }} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: th.textFaint }} axisLine={false} tickLine={false} width={34} tickFormatter={(v) => `${v}%`} />
                <Tooltip cursor={{ fill: th.rowHover }} contentStyle={{ background: th.panelAlt, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 12, color: th.text }} labelStyle={{ color: th.textDim }} formatter={(v, n, p) => [p.payload._null ? "데이터 없음" : `${v >= 0 ? "+" : ""}${v}%`, "변동률"]} />
                <Bar dataKey="v" radius={[5, 5, 0, 0]} isAnimationActive={false}
                  label={{ position: "top", fontSize: 11, fontWeight: 700, fill: th.textDim, formatter: (v) => (v === 0 ? "" : `${v > 0 ? "+" : ""}${v}%`) }}>
                  {plot.map((d, i) => <Cell key={i} fill={d._null ? th.textFaint : d.me ? th.accent : d.v >= 0 ? th.heatPos : th.heatNeg} fillOpacity={d.me ? 1 : 0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty th={th} text={<>새로고침하면 내 포트폴리오와<br />S&P500·나스닥100·코스피의 오늘 변동률을 비교해요.</>} />
      ) : (
        hasLine ? (
          <>
            <div style={{ height: 224 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: th.textFaint }} minTickGap={36} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: th.textFaint }} axisLine={false} tickLine={false} width={34} domain={["auto", "auto"]} />
                  <ReferenceLine y={100} stroke={th.border} strokeDasharray="3 3" />
                  <Tooltip contentStyle={{ background: th.panelAlt, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 12, color: th.text }} labelStyle={{ color: th.textDim }} formatter={(v, n) => [`${v} (${v >= 100 ? "+" : ""}${(v - 100).toFixed(1)}%)`, n]} />
                  {LINES.map((l) => (series.some((r) => r[l.key] != null) &&
                    <Area key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={l.width} fill="none" dot={false} isAnimationActive={false} connectNulls />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              {LINES.map((l) => (series.some((r) => r[l.key] != null) &&
                <span key={l.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: th.textDim }}><span style={{ width: 14, height: 3, borderRadius: 2, background: l.color }} />{l.name}</span>
              ))}
            </div>
          </>
        ) : <Empty th={th} text={<>종목을 추가하고 새로고침하면<br />내 포트폴리오와 지수들의 6개월 상대 성과를<br />한 그래프에서 비교해 드려요.</>} />
      )}
      <p style={{ fontSize: 11, color: th.textFaint, marginTop: 8 }}>
        {mode === "bar" ? "파란 막대가 내 포트폴리오의 오늘 등락률입니다." : "현재 보유 비중으로 과거를 환산한 추정 성과예요(참고용)."}
      </p>
    </Panel>
  );
}
function Empty({ th, text }) {
  return <div style={{ height: 150, display: "grid", placeItems: "center", color: th.textFaint, fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>{text}</div>;
}

/* ------------------------------------------------------------------ *
 *  NET-WORTH TREND                                                    *
 * ------------------------------------------------------------------ */
function TrendCard({ th, snapshots, displayCur, rate }) {
  const data = (snapshots || []).map((s) => ({ t: s.t, v: displayCur === "USD" ? s.v : s.v * rate }));
  const enough = data.length >= 2;
  const first = data[0]?.v, last = data[data.length - 1]?.v;
  const chg = enough && first ? ((last - first) / first) * 100 : null;
  return (
    <Panel th={th} title="자산 추이" sub={enough ? `${data.length}일 기록` : "기록이 쌓이면 추이가 보여요"}
      right={chg != null && <span className="num" style={{ fontSize: 13, fontWeight: 700, color: chg >= 0 ? th.heatPos : th.heatNeg }}>{chg >= 0 ? "+" : ""}{fmt(chg)}%</span>}>
      {enough ? (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={th.accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={th.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: th.textFaint }} tickFormatter={(t) => t.slice(5)} minTickGap={28} axisLine={false} tickLine={false} />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip contentStyle={{ background: th.panelAlt, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 12, color: th.text }} labelStyle={{ color: th.textDim }} formatter={(v) => [fmtMoney(v, displayCur), "총자산"]} />
              <Area type="monotone" dataKey="v" stroke={th.accent} strokeWidth={2} fill="url(#nw)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: 120, display: "grid", placeItems: "center", color: th.textFaint, fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
          매일 접속하면 그날의 총자산이 자동 기록되어<br />며칠 뒤부터 자산 변화 그래프가 그려집니다.
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 *  IMPORT (CSV / screenshot)                                          *
 * ------------------------------------------------------------------ */
function ImportPanel({ th, onImport }) {
  const [mode, setMode] = useState("csv");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const doCsv = () => {
    const rows = parseCSV(csv);
    if (!rows.length) { setMsg("인식된 줄이 없어요. '티커, 수량, 평단가' 형식으로 입력해 주세요."); return; }
    const n = onImport(rows);
    setMsg(`${n}개 종목을 가져왔어요.`);
  };

  const doImage = async (file) => {
    if (!file) return;
    setBusy(true); setMsg("스크린샷을 분석하는 중…");
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      const rows = await parseScreenshot(data, file.type || "image/png");
      if (!rows.length) { setMsg("종목을 찾지 못했어요. (배포본은 ANTHROPIC_API_KEY 설정이 필요해요)"); }
      else { const n = onImport(rows); setMsg(`${n}개 종목을 가져왔어요.`); }
    } catch { setMsg("분석에 실패했어요. 다시 시도해 주세요."); }
    setBusy(false);
  };

  return (
    <div style={{ border: `1px solid ${th.border}`, borderRadius: 12, padding: 14, marginBottom: 14, background: th.band }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="ph-btn" onClick={() => setMode("csv")} style={tabBtn(th, mode === "csv")}><FileText size={14} /> CSV 붙여넣기</button>
        <button className="ph-btn" onClick={() => setMode("img")} style={tabBtn(th, mode === "img")}><ImageIcon size={14} /> 스크린샷</button>
      </div>
      {mode === "csv" ? (
        <>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"한 줄에 한 종목:  티커, 수량, 평단가\nAAPL, 30, 175\n삼성전자, 100, 68000\nBTC, 0.5, 55000"}
            style={{ width: "100%", minHeight: 96, background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 8, padding: 10, fontSize: 12.5, fontFamily: "inherit", resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button className="ph-btn ph-primary" onClick={doCsv} style={primaryBtn(th)}>가져오기</button>
          </div>
        </>
      ) : (
        <div>
          <label style={{ ...secondaryBtn(th), display: "inline-flex", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <Upload size={14} /> {busy ? "분석 중…" : "스크린샷 선택"}
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => doImage(e.target.files?.[0])} style={{ display: "none" }} />
          </label>
          <p style={{ fontSize: 11.5, color: th.textFaint, marginTop: 8, lineHeight: 1.6 }}>
            증권사 앱 보유종목 화면을 캡처해서 올리면 AI가 티커·수량·평단가를 읽어 자동 입력해요.
            배포본에서는 <b style={{ color: th.textDim }}>ANTHROPIC_API_KEY</b> 등록이 필요합니다(미리보기는 바로 동작).
          </p>
        </div>
      )}
      {msg && <div style={{ fontSize: 12, color: th.accent, marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
const tabBtn = (th, on) => ({ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid ${on ? "transparent" : th.border}`, background: on ? th.accent : "transparent", color: on ? "#fff" : th.textDim, fontWeight: 700, fontSize: 12, cursor: "pointer" });

/* ------------------------------------------------------------------ *
 *  TOP NAV (jump to sections)                                         *
 * ------------------------------------------------------------------ */
const NAV = [
  ["sec-heatmap", "히트맵"],
  ["sec-portfolio", "포트폴리오"],
  ["sec-allocation", "섹터·현금"],
  ["sec-goal", "목표·벤치마크"],
  ["sec-trend", "자산추이"],
  ["sec-ideas", "투자 아이디어"],
  ["sec-whales", "부자들"],
];
function TopNav({ th, onHelp }) {
  const go = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <div style={{ position: "sticky", top: 63, zIndex: 15, background: th.bg, borderBottom: `1px solid ${th.border}` }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 12px", display: "flex", gap: 2, overflowX: "auto", alignItems: "center" }}>
        {NAV.map(([id, label]) => (
          <button key={id} className="navbtn" onClick={() => go(id)} style={{ flexShrink: 0, background: "transparent", border: "none", color: th.textDim, fontWeight: 700, fontSize: 13, padding: "11px 13px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>{label}</button>
        ))}
        <div style={{ flex: 1, minWidth: 8 }} />
        {onHelp && (
          <button className="navbtn" onClick={onHelp} title="앱 소개 · 예시 데이터 불러오기" style={{ flexShrink: 0, background: th.panelAlt, border: `1px solid ${th.border}`, color: th.text, fontWeight: 700, fontSize: 13, padding: "7px 13px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", margin: "5px 0" }}>✨ 둘러보기</button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  SHARED: mobile hook, ticker autocomplete, stock modal             *
 * ------------------------------------------------------------------ */
function useIsMobile(bp = 720) {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < bp);
  useEffect(() => {
    const f = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", f); f();
    return () => window.removeEventListener("resize", f);
  }, [bp]);
  return m;
}

function TickerInput({ th, value, placeholder, width, type, onText, onPick }) {
  const [open, setOpen] = useState(false);
  const [cands, setCands] = useState([]);
  const [hi, setHi] = useState(-1);
  const [rect, setRect] = useState(null);
  const tRef = useRef(null), inRef = useRef(null), pickedRef = useRef(false);

  useEffect(() => {
    if (type === "crypto" || !value) { setCands([]); return; }
    clearTimeout(tRef.current);
    tRef.current = setTimeout(async () => { const r = await lookupCandidates(value); setCands(r); setHi(-1); }, 320);
    return () => clearTimeout(tRef.current);
  }, [value, type]);

  const refreshRect = () => { if (inRef.current) setRect(inRef.current.getBoundingClientRect()); };
  const pick = (sym) => { pickedRef.current = true; setOpen(false); setCands([]); onPick(sym); };

  return (
    <div style={{ position: "relative" }}>
      <input ref={inRef} value={value} placeholder={placeholder} className="num"
        onChange={(e) => { onText(e.target.value.toUpperCase()); setOpen(true); refreshRect(); }}
        onFocus={() => { setOpen(true); refreshRect(); }}
        onBlur={() => setTimeout(() => { setOpen(false); if (pickedRef.current) { pickedRef.current = false; return; } onPick(value); }, 170)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, cands.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, -1)); }
          else if (e.key === "Enter") { if (hi >= 0 && cands[hi]) { e.preventDefault(); pick(cands[hi].symbol); } else { setOpen(false); onPick(value); } }
          else if (e.key === "Escape") setOpen(false);
        }}
        style={inpStyle(th, width)} />
      {open && cands.length > 0 && rect && (
        <div style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, zIndex: 60, minWidth: Math.max(220, rect.width), background: th.panelAlt, border: `1px solid ${th.border}`, borderRadius: 9, boxShadow: th.cardShadow, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
          {cands.map((c, i) => (
            <div key={c.symbol + i} onMouseDown={(e) => { e.preventDefault(); pick(c.symbol); }}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 11px", cursor: "pointer", background: i === hi ? th.rowHover : "transparent" }}>
              <span className="num" style={{ fontWeight: 700, color: th.text, fontSize: 12.5 }}>{(c.symbol || "").replace(".KS", "").replace(".KQ", "")}</span>
              <span style={{ color: th.textDim, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StockModal({ th, info, hist, holding, displayCur, onClose }) {
  const closes = hist?.closes || [], ts = hist?.ts || [];
  const data = closes.map((c, i) => ({ t: ts[i] ? new Date(ts[i] * 1000).toISOString().slice(5, 10) : i, v: c }));
  const first = closes[0], last = closes[closes.length - 1];
  const chg = first && last ? ((last - first) / first) * 100 : null;
  const up = (chg ?? 0) >= 0;
  const cur = holding?.cur === "KRW" ? "₩" : "$";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 80, display: "grid", placeItems: "center", padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} className="ph-card" style={{ width: "min(560px,100%)", background: th.panel, border: `1px solid ${th.border}`, borderRadius: 16, padding: 20, boxShadow: th.cardShadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 19, fontWeight: 800 }}>{bareCode(info.ticker)}</span>
          <span style={{ fontSize: 13, color: th.textDim }}>{info.name || ""}</span>
          <div style={{ flex: 1 }} />
          <button className="ph-btn" onClick={onClose} style={iconBtn(th)}>✕</button>
        </div>
        {holding && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
            {holding.price != null && <span>현재가 <b className="num">{cur}{fmt(holding.price, 2)}</b></span>}
            {holding.chg != null && <span style={{ color: holding.chg >= 0 ? th.heatPos : th.heatNeg }} className="num">{holding.chg >= 0 ? "+" : ""}{fmt(holding.chg)}% (1일)</span>}
            {holding.rsi != null && <span>RSI <b className="num">{fmt(holding.rsi, 0)}</b></span>}
            {holding.bbPos != null && <span>BB <b className="num">{fmt(holding.bbPos, 0)}%</b></span>}
          </div>
        )}
        {data.length > 1 ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: th.textDim }}>최근 6개월</span>
              {chg != null && <span className="num" style={{ fontSize: 13, fontWeight: 700, color: up ? th.heatPos : th.heatNeg }}>{up ? "+" : ""}{fmt(chg)}%</span>}
            </div>
            <div style={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                  <defs><linearGradient id="sm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={up ? th.heatPos : th.heatNeg} stopOpacity={0.35} /><stop offset="100%" stopColor={up ? th.heatPos : th.heatNeg} stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: th.textFaint }} minTickGap={40} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: th.textFaint }} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: th.panelAlt, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 12, color: th.text }} labelStyle={{ color: th.textDim }} formatter={(v) => [`${cur}${fmt(v, 2)}`, "종가"]} />
                  <Area type="monotone" dataKey="v" stroke={up ? th.heatPos : th.heatNeg} strokeWidth={2} fill="url(#sm)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div style={{ height: 150, display: "grid", placeItems: "center", color: th.textFaint, fontSize: 13, textAlign: "center" }}>차트 데이터를 불러오지 못했어요.<br />(미리보기 샌드박스에선 주가가 막힐 수 있어요)</div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <LinkBtn th={th} href={yahooUrl(info.ticker)} color="#7c4dff">Yahoo Finance ↗</LinkBtn>
          <LinkBtn th={th} href={tossUrl(info.ticker)} color="#2d9cdb">토스증권 ↗</LinkBtn>
          <LinkBtn th={th} href={redditUrl(info.ticker)} color="#fc6e51">Reddit ↗</LinkBtn>
        </div>
      </div>
    </div>
  );
}

/* mobile card view for holdings (#10) */
function PortfolioCards({ holdings, th, displayCur, valueOf, totalAssets, onUpdate, onRemove, onAutoFill }) {
  if (!holdings.length) return <div style={{ textAlign: "center", color: th.textFaint, padding: 24, fontSize: 13 }}>"종목 추가"를 눌러 입력하세요</div>;
  const fld = (label, node) => <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 10, color: th.textFaint, fontWeight: 600 }}>{label}</span>{node}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {holdings.map((h) => {
        const v = valueOf(h), wpct = totalAssets ? (v / totalAssets) * 100 : 0, ret = returnPct(h);
        const metric = (label, val, color) => <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 10, color: th.textFaint }}>{label}</span><span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: color || th.text }}>{val}</span></div>;
        return (
          <div key={h.id} className="ph-card" style={{ border: `1px solid ${th.border}`, borderRadius: 12, padding: 13, background: th.panel }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <TickerInput th={th} value={h.ticker} type={h.type} width={110} placeholder={h.type === "kr" ? "삼성전자" : h.type === "crypto" ? "BTC" : "AAPL"}
                  onText={(val) => onUpdate(h.id, { ticker: val, live: false })}
                  onPick={(sym) => { const s = (sym || h.ticker || "").toUpperCase(); if (s !== h.ticker) onUpdate(h.id, { ticker: s, live: false }); onAutoFill(h.id, s, h.type); }} />
              </div>
              <select value={h.type} onChange={(e) => { const t = e.target.value; onUpdate(h.id, { type: t, cur: t === "kr" ? "KRW" : "USD", sector: t === "crypto" ? "Crypto" : h.sector }); }} style={selStyle(th, 70)}><option value="us">미국</option><option value="kr">한국</option><option value="etf">ETF</option><option value="crypto">크립토</option></select>
              <button className="ph-btn" onClick={() => onRemove(h.id)} style={{ ...iconBtn(th), width: 30, height: 30, color: th.heatNeg }}><Trash2 size={14} /></button>
            </div>
            <input value={h.name} placeholder="이름 (자동)" onChange={(e) => onUpdate(h.id, { name: e.target.value })} style={{ ...inpStyle(th, 0), width: "100%", marginBottom: 8 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              {fld("섹터/테마", <input list="ph-sectors" value={h.sector} placeholder="섹터" onChange={(e) => onUpdate(h.id, { sector: e.target.value })} style={{ ...inpStyle(th, 0), width: "100%" }} />)}
              {fld("수량", <input type="number" value={h.qty || ""} placeholder="0" onChange={(e) => onUpdate(h.id, { qty: parseFloat(e.target.value) || 0 })} style={{ ...inpStyle(th, 0), width: "100%", textAlign: "right" }} className="num" />)}
              {fld(`평단가(${h.cur === "KRW" ? "₩" : "$"})`, <input type="number" value={h.avgCost ?? ""} placeholder="평단" onChange={(e) => onUpdate(h.id, { avgCost: e.target.value === "" ? null : parseFloat(e.target.value) })} style={{ ...inpStyle(th, 0), width: "100%", textAlign: "right" }} className="num" />)}
              {fld(`현재가(${h.cur === "KRW" ? "₩" : "$"})`, <input type="number" value={h.price ?? ""} placeholder="자동" onChange={(e) => onUpdate(h.id, { price: e.target.value === "" ? null : parseFloat(e.target.value), live: false })} style={{ ...inpStyle(th, 0), width: "100%", textAlign: "right", color: h.live ? th.accent : th.text }} className="num" />)}
              {fld("매수일", <input type="date" value={h.buyDate || ""} onChange={(e) => onUpdate(h.id, { buyDate: e.target.value || null })} style={{ ...inpStyle(th, 0), width: "100%" }} />)}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 9, borderTop: `1px solid ${th.border}` }}>
              {metric("일간", h.chg == null ? "—" : `${h.chg >= 0 ? "+" : ""}${fmt(h.chg)}%`, h.chg == null ? th.textFaint : h.chg >= 0 ? th.heatPos : th.heatNeg)}
              {metric("RSI", h.rsi == null ? "—" : fmt(h.rsi, 0), h.rsi == null ? th.textFaint : h.rsi >= 70 ? th.heatNeg : h.rsi <= 30 ? th.heatPos : th.text)}
              {metric("BB%", h.bbPos == null ? "—" : fmt(h.bbPos, 0) + "%", th.textDim)}
              {metric("수익률", ret == null ? "—" : `${ret >= 0 ? "+" : ""}${fmt(ret)}%`, ret == null ? th.textFaint : ret >= 0 ? th.heatPos : th.heatNeg)}
              {metric("평가액", fmtMoney(v, displayCur))}
              {metric("비중", `${fmt(wpct, 1)}%`, th.textDim)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  MVP: welcome banner + feedback/waitlist modal                      *
 * ------------------------------------------------------------------ */
function WelcomeBanner({ th, onSample, onAdd, onClose }) {
  return (
    <div style={{ position: "relative", borderRadius: 16, padding: "22px 22px", border: `1px solid ${th.border}`, background: `linear-gradient(120deg, ${th.panel}, ${th.panelAlt})`, overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -40, top: -40, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,156,219,.25), transparent 70%)" }} />
      <button className="ph-btn" onClick={onClose} style={{ ...iconBtn(th), position: "absolute", right: 12, top: 12 }}>✕</button>
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>내 모든 자산을 한 화면에 👋</div>
      <p style={{ fontSize: 13.5, color: th.textDim, lineHeight: 1.7, maxWidth: 620, margin: "0 0 16px" }}>
        미국·한국 주식과 코인을 넣으면 <b style={{ color: th.text }}>히트맵·섹터 비중·목표·벤치마크·RSI/볼린저</b>가 자동으로 그려져요.
        티커만 입력하면 이름·섹터·시세가 알아서 채워집니다. 처음이라면 예시로 먼저 둘러보세요.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="ph-btn ph-primary" onClick={onSample} style={primaryBtn(th)}>✨ 예시로 둘러보기</button>
        <button className="ph-btn" onClick={() => { onAdd(); onClose(); }} style={secondaryBtn(th)}><Plus size={15} /> 내 종목 추가</button>
      </div>
    </div>
  );
}

function FeedbackModal({ th, onClose }) {
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done
  const send = async () => {
    if (!msg.trim() && !email.trim()) { onClose(); return; }
    setState("sending");
    const meta = { url: typeof location !== "undefined" ? location.href : "", from: getSource(), ua: typeof navigator !== "undefined" ? navigator.userAgent : "" };
    const r = await submitFeedback({ type: email && !msg ? "waitlist" : "feedback", message: msg, email, meta });
    track("feedback_submit", { hasEmail: !!email });
    if (r.ok) { setState("done"); return; }
    // fallback: open the user's email client
    const subject = encodeURIComponent(`[${CONFIG.productName}] 의견`);
    const body = encodeURIComponent(`${msg}\n\n(연락처: ${email || "-"})`);
    window.location.href = `mailto:${CONFIG.feedbackEmail}?subject=${subject}&body=${body}`;
    setState("done");
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 90, display: "grid", placeItems: "center", padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} className="ph-card" style={{ width: "min(440px,100%)", background: th.panel, border: `1px solid ${th.border}`, borderRadius: 16, padding: 20, boxShadow: th.cardShadow }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>의견 보내기</span>
          <div style={{ flex: 1 }} />
          <button className="ph-btn" onClick={onClose} style={iconBtn(th)}>✕</button>
        </div>
        {state === "done" ? (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🙏</div>
            <div style={{ fontSize: 14, color: th.text, fontWeight: 700, marginBottom: 4 }}>의견 감사합니다!</div>
            <div style={{ fontSize: 12.5, color: th.textDim }}>보내주신 내용은 다음 업데이트에 큰 도움이 돼요.</div>
            <button className="ph-btn ph-primary" onClick={onClose} style={{ ...primaryBtn(th), margin: "16px auto 0" }}>닫기</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: th.textDim, lineHeight: 1.6, margin: "4px 0 12px" }}>
              필요한 기능, 불편한 점, 무엇이든 적어주세요. 이메일을 남기면 업데이트·정식 출시 소식을 알려드려요(선택).
            </p>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="예: 배당 캘린더가 있으면 좋겠어요 / 표가 모바일에서 좁아요 / 이런 기능 원해요…"
              style={{ width: "100%", minHeight: 110, background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 10, padding: 11, fontSize: 13, fontFamily: "inherit", resize: "vertical", marginBottom: 10 }} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 (선택 · 출시 알림 받기)" type="email"
              style={{ width: "100%", background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 10, padding: "10px 11px", fontSize: 13, marginBottom: 14 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="ph-btn" onClick={onClose} style={secondaryBtn(th)}>취소</button>
              <button className="ph-btn ph-primary" onClick={send} disabled={state === "sending"} style={{ ...primaryBtn(th), opacity: state === "sending" ? 0.6 : 1 }}>{state === "sending" ? "보내는 중…" : "보내기"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  PER-HOLDING WEIGHTS (cost vs value)  +  FX P&L                      *
 * ------------------------------------------------------------------ */
function WeightCard({ th, rows }) {
  if (!rows.length) return (
    <Panel th={th} title="종목별 비중" sub="원금 기준 · 평가액 기준">
      <div style={{ height: 90, display: "grid", placeItems: "center", color: th.textFaint, fontSize: 13 }}>종목과 수량·평단가를 입력하면 비중이 표시돼요.</div>
    </Panel>
  );
  return (
    <Panel th={th} title="종목별 비중" sub="원금(평단가) 기준 · 평가액(현재가) 기준">
      <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: th.textFaint, fontWeight: 700, padding: "0 2px 6px" }}>
        <span style={{ width: 88 }}>종목</span>
        <span style={{ flex: 1 }}>원금 비중</span>
        <span style={{ flex: 1 }}>평가액 비중</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, maxHeight: 280, overflowY: "auto" }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="num" style={{ width: 88, fontWeight: 700, fontSize: 12.5, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.name || r.ticker}>{bareCode(r.ticker)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, borderRadius: 4, background: th.inputBg, overflow: "hidden" }}><div style={{ width: `${r.costW}%`, height: "100%", background: th.textDim, opacity: 0.6 }} /></div>
              <span className="num" style={{ fontSize: 10.5, color: th.textDim }}>{fmt(r.costW, 1)}%</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, borderRadius: 4, background: th.inputBg, overflow: "hidden" }}><div style={{ width: `${r.valW}%`, height: "100%", background: th.accent }} /></div>
              <span className="num" style={{ fontSize: 10.5, color: th.accent, fontWeight: 700 }}>{fmt(r.valW, 1)}%</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: th.textFaint, marginTop: 10 }}>회색=내가 넣은 원금 기준, 파랑=현재 평가액 기준 비중이에요.</p>
    </Panel>
  );
}

function FxCard({ th, fx, displayCur }) {
  const has = fx.n > 0;
  const row = (label, v, strong) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: strong ? `1px solid ${th.border}` : "none" }}>
      <span style={{ fontSize: strong ? 13 : 12.5, fontWeight: strong ? 800 : 600, color: strong ? th.text : th.textDim }}>{label}</span>
      <span className="num" style={{ fontSize: strong ? 14.5 : 13, fontWeight: 800, color: v == null ? th.textFaint : v >= 0 ? th.heatPos : th.heatNeg }}>{v == null ? "—" : `${v >= 0 ? "+" : ""}${fmtMoney(v, displayCur)}`}</span>
    </div>
  );
  return (
    <Panel th={th} title="환차손익" sub={`해외 종목 손익을 주가 vs 환율로 분해 (${displayCur} 기준)`}>
      {has ? (
        <>
          {row("주가 손익", fx.priceP)}
          {row("환차 손익", fx.fxP)}
          {row("합계", fx.total, true)}
          <p style={{ fontSize: 11, color: th.textFaint, marginTop: 10, lineHeight: 1.6 }}>
            매수일·평단가가 입력된 해외 종목 <b style={{ color: th.textDim }}>{fx.n}개</b> 기준이에요.
            {fx.skipped > 0 && <> 매수일이 없는 {fx.skipped}개는 빠졌어요 — 표에서 <b style={{ color: th.textDim }}>매수일</b>을 넣으면 포함됩니다.</>}
          </p>
        </>
      ) : (
        <div style={{ height: 120, display: "grid", placeItems: "center", color: th.textFaint, fontSize: 12.5, textAlign: "center", lineHeight: 1.7 }}>
          해외 종목(예: 미국주식)에 <b style={{ color: th.textDim }}>매수일·평단가</b>를 넣으면<br />주가로 번 돈과 환율로 번 돈을 나눠서 보여드려요.
          {!fx.hasFxHist && <><br /><span style={{ color: th.textFaint }}>(환율 데이터 로딩 중일 수 있어요 — 새로고침 후 표시)</span></>}
        </div>
      )}
    </Panel>
  );
}
