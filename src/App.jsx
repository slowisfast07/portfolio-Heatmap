import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import {
  Plus, Trash2, RefreshCw, Sun, Moon, TrendingUp, TrendingDown, Wifi, WifiOff, Wallet, Upload, Target,
  Image as ImageIcon, FileText,
} from "lucide-react";

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

/* famous investors + representative holdings (참고용 / illustrative) */
const WHALES = [
  { name: "워런 버핏", fund: "버크셔 해서웨이", holdings: ["AAPL", "AXP", "KO", "BAC"], hue: "#e8453c" },
  { name: "빌 애크먼", fund: "퍼싱 스퀘어", holdings: ["GOOG", "CMG", "HLT", "QSR"], hue: "#16c784" },
  { name: "캐시 우드", fund: "ARK Invest", holdings: ["TSLA", "COIN", "ROKU", "PLTR"], hue: "#8b5cf6" },
  { name: "스탠리 드러켄밀러", fund: "듀케인", holdings: ["NVDA", "MSFT", "CPNG"], hue: "#f5a623" },
  { name: "테리 스미스", fund: "펀드스미스", holdings: ["MSFT", "META", "NVO"], hue: "#ec4899" },
  { name: "체이스 콜먼", fund: "타이거 글로벌", holdings: ["META", "NVDA", "SE"], hue: "#0fb9b1" },
  { name: "데이비드 테퍼", fund: "아팔루사", holdings: ["NVDA", "BABA", "AMZN"], hue: "#3b82f6" },
  { name: "마이클 버리", fund: "사이언", holdings: ["EL", "BABA", "JD"], hue: "#fc6e51" },
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
  { id: "s1", type: "us", ticker: "", name: "", sector: "", qty: 0, avgCost: null, price: null, cur: "USD", chg: null, live: false },
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

const BENCH = [{ sym: "^GSPC", label: "S&P 500" }, { sym: "^IXIC", label: "나스닥" }, { sym: "^KS11", label: "코스피" }];

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
  const [hydrated, setHydrated] = useState(false);

  const [heatMode, setHeatMode] = useState("change");
  const [capChange, setCapChange] = useState(3);
  const [capReturn, setCapReturn] = useState(25);
  const [showPct, setShowPct] = useState(true);
  const [labelMode, setLabelMode] = useState("ticker");
  const [goal, setGoal] = useState(null);          // { amount, cur }
  const [snapshots, setSnapshots] = useState([]);   // [{ t: 'YYYY-MM-DD', v: USD }]
  const [benchmarks, setBenchmarks] = useState({}); // { '^GSPC': {chg}, ... }
  const [showImport, setShowImport] = useState(false);

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
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (hydrated) persist({ holdings, cash, goal, snapshots, settings: { themeName, displayCur, heatMode, capChange, capReturn, showPct, labelMode } });
  }, [holdings, cash, goal, snapshots, themeName, displayCur, heatMode, capChange, capReturn, showPct, labelMode, hydrated]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const krw = await fetchFx();
    if (krw) { setFx(krw); setFxLive(true); } else { setFx((p) => p ?? 1380); setFxLive(false); }
    const cryptoSyms = holdings.filter((h) => h.type === "crypto").map((h) => h.ticker.toUpperCase());
    const stockSyms = [...new Set(holdings.filter((h) => h.type !== "crypto" && h.ticker).map((h) => h.ticker))];
    const [cryptoData, stockData, bench] = await Promise.all([
      fetchCrypto(cryptoSyms), fetchStocks(stockSyms), fetchStocks(["^GSPC", "^IXIC", "^KS11"]),
    ]);
    setBenchmarks(bench || {});
    setHoldings((prev) => prev.map((h) => {
      if (h.type === "crypto") { const d = cryptoData[h.ticker.toUpperCase()]; return d ? { ...h, price: d.price, chg: d.chg, cur: "USD", live: true } : h; }
      const d = stockData[h.ticker]; return d ? { ...h, price: d.price, chg: d.chg, cur: d.cur || h.cur, mkt: d.mkt, live: true } : h;
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

  const addHolding = () => setHoldings((p) => [...p, { id: uid(), type: "us", ticker: "", name: "", sector: "Technology", qty: 0, avgCost: null, price: null, cur: "USD", chg: null, live: false }]);
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

  const addAndFill = useCallback((ticker) => {
    const t = (ticker || "").toUpperCase();
    if (!t || heldSet.has(t)) return;
    const type = /\.(KS|KQ)$/i.test(t) ? "kr" : (CRYPTO_IDS[t] ? "crypto" : "us");
    const id = uid();
    setHoldings((p) => [...p, { id, type, ticker: t, name: "", sector: "", qty: 0, avgCost: null, price: null, cur: type === "kr" ? "KRW" : "USD", chg: null, live: false }]);
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
      setHoldings((p) => [...p, { id, type, ticker: type === "crypto" ? t : raw, name: "", sector: "", qty: Number(row.qty) || 0, avgCost: row.avgCost != null && row.avgCost !== "" ? Number(row.avgCost) : null, price: null, cur, chg: null, live: false }]);
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
        .mq:hover .mq-track{animation-play-state:paused;}
        ::-webkit-scrollbar{height:8px;width:8px;} ::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px;}
        @keyframes spin{to{transform:rotate(360deg);}} .spin{animation:spin 1s linear infinite;}
        input[type=range]{accent-color:${th.accent};}
        @media (max-width:900px){.ph-grid{grid-template-columns:1fr !important;}}
      `}</style>

      {/* HEADER */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 22px", borderBottom: `1px solid ${th.border}`, background: th.bg, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#2d9cdb,#9b5de5)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17, color: "#fff", boxShadow: "0 2px 10px rgba(45,156,219,.4)" }}>P</div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>Portfolio</div>
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
      </div>

      {/* BODY */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Heatmap — full width */}
        <Panel th={th} title="Heatmap" glow
          titleExtra={<Segmented th={th} value={heatMode} onChange={setHeatMode} options={[["change", "현재가"], ["return", "내 수익률"]]} />}
          right={<HeatControls th={th} mode={heatMode} cap={capNow} setCap={heatMode === "return" ? setCapReturn : setCapChange} showPct={showPct} setShowPct={setShowPct} labelMode={labelMode} setLabelMode={setLabelMode} />}>
          <Treemap leaves={leaves} th={th} cap={capNow} showPct={showPct} labelMode={labelMode} />
          <HeatLegend th={th} cap={capNow} mode={heatMode} />
        </Panel>

        {/* My portfolio */}
        <Panel th={th} title="내 포트폴리오" sub="티커만 넣으면 이름·섹터 자동 분류"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ph-btn" onClick={() => setShowImport((v) => !v)} style={{ ...secondaryBtn(th) }}><Upload size={14} /> 가져오기</button>
              <button className="ph-btn ph-primary" onClick={addHolding} style={primaryBtn(th)}><Plus size={15} /> 종목 추가</button>
            </div>
          }>
          {showImport && <ImportPanel th={th} onImport={(rows) => { const n = importHoldings(rows); if (n) setShowImport(false); }} />}
          <PortfolioTable holdings={holdings} th={th} displayCur={displayCur} valueOf={valueOf} totalAssets={totalAssets} onUpdate={updateHolding} onRemove={removeHolding} onAutoFill={autoFill} />
          <p style={{ fontSize: 11.5, color: th.textFaint, marginTop: 12, lineHeight: 1.6 }}>
            티커 입력 후 칸을 벗어나면 <b style={{ color: th.textDim }}>이름·섹터 자동</b> 입력. 한국주식은 <b style={{ color: th.textDim }}>삼성전자</b>처럼 이름으로 넣어도 됩니다. 크립토 <b style={{ color: th.textDim }}>BTC</b>.
            <b style={{ color: th.textDim }}> 평단가</b>를 넣으면 "내 수익률" 히트맵이 켜집니다.
          </p>
        </Panel>

        {/* cash + sector donut */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }} className="ph-grid">
          <CashCard th={th} cash={cash} displayCur={displayCur} conv={conv} cashValue={cashValue} cashPct={cashPct}
            investedValue={positionsValue} onAdd={addCash} onUpdate={updateCash} onRemove={removeCash} />
          <Panel th={th} title="섹터별 자산 비중" sub={`${sectorData.length}개 구성`}>
            <Donut data={sectorData} th={th} colorMap={colorMap} />
          </Panel>
        </div>

        {/* goal + benchmark */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }} className="ph-grid">
          <GoalCard th={th} goal={goal} setGoal={setGoal} totalAssets={totalAssets} displayCur={displayCur} conv={conv} />
          <BenchmarkCard th={th} dayChange={dayChange} benchmarks={benchmarks} />
        </div>

        {/* net-worth trend */}
        <TrendCard th={th} snapshots={snapshots} displayCur={displayCur} rate={rate} />

        {/* recommendations */}
        <ThemeIdeas th={th} ideas={ideas} onPick={addAndFill} />
        <WhalePortfolios th={th} onPick={addAndFill} />
      </div>
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
function Treemap({ leaves, th, cap, showPct, labelMode }) {
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
          <div key={leaf.data.id} className="ph-tile" title={`${leaf.data.name || leaf.data.ticker}  ${leaf.data.metric != null ? (leaf.data.metric >= 0 ? "+" : "") + fmt(leaf.data.metric) + "%" : ""}`}
            style={{ position: "absolute", left: leaf.x0, top: leaf.y0, width: bw, height: bh, background: color, borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", color: tc, padding: 2 }}>
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
  const head = (t) => ({ textAlign: t || "left", fontSize: 10.5, fontWeight: 600, color: th.textFaint, padding: "8px 8px", textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" });
  const cell = { padding: "6px 8px", fontSize: 12.5, borderTop: `1px solid ${th.border}` };
  return (
    <div style={{ overflowX: "auto" }}>
      <datalist id="ph-sectors">{SECTOR_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
        <thead><tr>
          <th style={head()}>유형</th><th style={head()}>티커</th><th style={head()}>이름</th><th style={head()}>섹터</th>
          <th style={head("right")}>수량</th><th style={head("right")}>평단가</th><th style={head("right")}>현재 주가</th>
          <th style={head("right")}>일간%</th><th style={head("right")}>수익률%</th><th style={head("right")}>평가액 ({displayCur})</th><th style={head("right")}>비중</th><th style={head("center")}></th>
        </tr></thead>
        <tbody>
          {holdings.map((h) => {
            const v = valueOf(h), wpct = totalAssets ? (v / totalAssets) * 100 : 0, ret = returnPct(h);
            return (
              <tr key={h.id} className="ph-row">
                <td style={cell}><select value={h.type} onChange={(e) => { const t = e.target.value; onUpdate(h.id, { type: t, cur: t === "kr" ? "KRW" : "USD", sector: t === "crypto" ? "Crypto" : h.sector }); }} style={selStyle(th, 62)}><option value="us">미국</option><option value="kr">한국</option><option value="crypto">크립토</option></select></td>
                <td style={cell}><input value={h.ticker} placeholder={h.type === "kr" ? "005930.KS" : h.type === "crypto" ? "BTC" : "AAPL"} onChange={(e) => onUpdate(h.id, { ticker: e.target.value.toUpperCase(), live: false })} onBlur={(e) => onAutoFill(h.id, e.target.value.toUpperCase(), h.type)} onKeyDown={(e) => { if (e.key === "Enter") onAutoFill(h.id, e.target.value.toUpperCase(), h.type); }} style={inpStyle(th, 92)} className="num" /></td>
                <td style={cell}><input value={h.name} placeholder="자동" onChange={(e) => onUpdate(h.id, { name: e.target.value })} style={inpStyle(th, 120)} /></td>
                <td style={cell}><input list="ph-sectors" value={h.sector} placeholder="섹터/테마" onChange={(e) => onUpdate(h.id, { sector: e.target.value })} style={inpStyle(th, 132)} /></td>
                <td style={{ ...cell, textAlign: "right" }}><input type="number" value={h.qty || ""} placeholder="0" onChange={(e) => onUpdate(h.id, { qty: parseFloat(e.target.value) || 0 })} style={{ ...inpStyle(th, 66), textAlign: "right" }} className="num" /></td>
                <td style={{ ...cell, textAlign: "right" }}><div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}><input type="number" value={h.avgCost ?? ""} placeholder="평단" onChange={(e) => onUpdate(h.id, { avgCost: e.target.value === "" ? null : parseFloat(e.target.value) })} style={{ ...inpStyle(th, 76), textAlign: "right" }} className="num" /><span style={{ fontSize: 11, color: th.textFaint, width: 10 }}>{h.cur === "KRW" ? "₩" : "$"}</span></div></td>
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
                <td className="num" style={{ ...cell, textAlign: "right", color: ret == null ? th.textFaint : ret >= 0 ? th.heatPos : th.heatNeg, fontWeight: 700 }}>{ret == null ? "—" : `${ret >= 0 ? "+" : ""}${fmt(ret)}`}</td>
                <td className="num" style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{fmtMoney(v, displayCur)}</td>
                <td className="num" style={{ ...cell, textAlign: "right", color: th.textDim }}>{fmt(wpct, 1)}%</td>
                <td style={{ ...cell, textAlign: "center" }}><button className="ph-btn" onClick={() => onRemove(h.id)} style={{ ...iconBtn(th), width: 28, height: 28, color: th.heatNeg }}><Trash2 size={14} /></button></td>
              </tr>
            );
          })}
          {!holdings.length && <tr><td colSpan={12} style={{ ...cell, textAlign: "center", color: th.textFaint, padding: 28 }}>"종목 추가"를 눌러 입력하세요</td></tr>}
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
function Marquee({ children, duration = 40 }) {
  return (
    <div className="mq" style={{ overflow: "hidden", position: "relative", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)" }}>
      <div className="mq-track" style={{ display: "flex", gap: 12, width: "max-content", animationDuration: `${duration}s` }}>
        {children}{children}
      </div>
    </div>
  );
}

function ThemeIdeas({ th, ideas, onPick }) {
  if (!ideas.length) return null;
  return (
    <Panel th={th} title="투자 아이디어" sub="나에게 맞는 테마주는? · 클릭하면 내 포트폴리오에 추가">
      <Marquee duration={46}>
        {ideas.map((it, i) => {
          const grad = i % 4 === 3;
          return (
            <button key={i} className="ph-btn" onClick={() => onPick(it.ticker)}
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 156, padding: "12px 18px", borderRadius: 999, border: `1px solid ${grad ? "transparent" : th.border}`, background: grad ? "linear-gradient(100deg,#7c4dff,#2d9cdb)" : th.panelAlt, color: grad ? "#fff" : th.text, cursor: "pointer", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 10.5, opacity: 0.78, fontWeight: 600 }}>{it.kind === "diversify" ? "다양화 · " : "+ 추가 · "}{it.theme}</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{(it.ticker || "").replace(".KS", "").replace(".KQ", "")}</span>
            </button>
          );
        })}
      </Marquee>
    </Panel>
  );
}

function WhaleCard({ th, w, onPick }) {
  return (
    <div className="ph-card" style={{ width: 234, padding: 16, borderRadius: 14, border: `1px solid ${th.border}`, background: th.panel }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${w.hue},${th.panelAlt})`, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16, color: "#fff", flexShrink: 0 }}>{w.name.slice(0, 1)}</div>
        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap" }}>{w.name}</div><div style={{ fontSize: 11, color: th.textDim, whiteSpace: "nowrap" }}>{w.fund}</div></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {w.holdings.map((t) => (
          <button key={t} className="ph-btn" onClick={() => onPick(t)} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 7, border: `1px solid ${th.border}`, background: th.panelAlt, color: th.text, cursor: "pointer" }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function WhalePortfolios({ th, onPick }) {
  return (
    <Panel th={th} title="부자들의 포트폴리오" sub="유명 투자자 대표 종목 (참고용) · 종목 클릭 시 추가">
      <Marquee duration={62}>
        {WHALES.map((w, i) => <div key={i}><WhaleCard th={th} w={w} onPick={onPick} /></div>)}
      </Marquee>
    </Panel>
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
function BenchmarkCard({ th, dayChange, benchmarks }) {
  const rows = [{ label: "내 포트폴리오", v: dayChange, me: true }, ...BENCH.map((b) => ({ label: b.label, v: benchmarks[b.sym]?.chg ?? null }))];
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.v || 0)));
  return (
    <Panel th={th} title="벤치마크 대비" sub="오늘 변동률 비교">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r, i) => {
          const v = r.v, w = v == null ? 0 : (Math.abs(v) / maxAbs) * 50;
          const c = v == null ? th.textFaint : v >= 0 ? th.heatPos : th.heatNeg;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 92, fontSize: 12.5, fontWeight: r.me ? 800 : 500, color: r.me ? th.text : th.textDim, flexShrink: 0 }}>{r.label}</span>
              <div style={{ flex: 1, position: "relative", height: 18, background: th.inputBg, borderRadius: 5 }}>
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: th.border }} />
                {v != null && <div style={{ position: "absolute", top: 3, bottom: 3, borderRadius: 3, background: c, ...(v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }) }} />}
              </div>
              <span className="num" style={{ width: 58, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: c }}>{v == null ? "—" : `${v >= 0 ? "+" : ""}${fmt(v)}%`}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
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
