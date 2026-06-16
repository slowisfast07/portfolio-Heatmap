import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Plus, Trash2, RefreshCw, Sun, Moon, TrendingUp, TrendingDown, Wifi, WifiOff, Wallet,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 *  THEME  (Polymarket-inspired: slate #15191d + blue #2d9cdb)         *
 * ------------------------------------------------------------------ */
const THEMES = {
  dark: {
    name: "dark", bg: "#15191d", panel: "#1c2127", panelAlt: "#262d35", border: "#2c333c",
    text: "#eef1f4", textDim: "#9aa3ad", textFaint: "#69727d", accent: "#2d9cdb",
    inputBg: "#171b20", heatPos: "#27ae60", heatNeg: "#e5484d", heatNeu: "#2c333c",
    rowHover: "#222831", band: "#171b20",
    posBg: "rgba(39,174,96,.16)", negBg: "rgba(229,72,77,.16)",
  },
  light: {
    name: "light", bg: "#f5f7f9", panel: "#ffffff", panelAlt: "#eef1f5", border: "#e2e6ec",
    text: "#15191d", textDim: "#5b646d", textFaint: "#97a0aa", accent: "#1d83c6",
    inputBg: "#ffffff", heatPos: "#1c9d57", heatNeg: "#d83a40", heatNeu: "#dde2e8",
    rowHover: "#f4f6f9", band: "#eef1f5",
    posBg: "rgba(28,157,87,.13)", negBg: "rgba(216,58,64,.12)",
  },
};

const SECTORS = [
  "Technology", "Communication", "Consumer Cyclical", "Consumer Defensive", "Financial",
  "Healthcare", "Industrials", "Energy", "Real Estate", "Basic Materials", "Utilities", "Crypto", "Cash", "Other",
];
const SECTOR_COLORS = {
  Technology: "#2d9cdb", Communication: "#a78bfa", "Consumer Cyclical": "#f59e0b",
  "Consumer Defensive": "#34d399", Financial: "#60a5fa", Healthcare: "#f472b6",
  Industrials: "#fb923c", Energy: "#facc15", "Real Estate": "#4ade80",
  "Basic Materials": "#94a3b8", Utilities: "#818cf8", Crypto: "#fbbf24",
  Cash: "#8b98a6", Other: "#cbd5e1",
};

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

const hashHue = (s) => { let h = 0; for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
const sectorColor = (sector) => SECTOR_COLORS[sector] || `hsl(${hashHue(sector)},58%,60%)`;

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

const SEED = [
  { id: "s1", type: "us", ticker: "AAPL", name: "Apple Inc.", sector: "Technology", qty: 30, avgCost: 175, price: null, cur: "USD", chg: null, live: false },
  { id: "s2", type: "us", ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", qty: 25, avgCost: 90, price: null, cur: "USD", chg: null, live: false },
  { id: "s3", type: "us", ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", qty: 12, avgCost: 360, price: null, cur: "USD", chg: null, live: false },
  { id: "s4", type: "us", ticker: "GOOG", name: "Alphabet Inc.", sector: "Communication", qty: 15, avgCost: 140, price: null, cur: "USD", chg: null, live: false },
  { id: "s5", type: "kr", ticker: "005930.KS", name: "삼성전자", sector: "Technology", qty: 100, avgCost: 68000, price: null, cur: "KRW", chg: null, live: false },
  { id: "s6", type: "crypto", ticker: "BTC", name: "Bitcoin", sector: "Crypto", qty: 0.5, avgCost: 55000, price: null, cur: "USD", chg: null, live: false },
  { id: "s7", type: "crypto", ticker: "ETH", name: "Ethereum", sector: "Crypto", qty: 4, avgCost: 2800, price: null, cur: "USD", chg: null, live: false },
];
const SEED_CASH = [{ id: "c1", label: "원화 예수금", cur: "KRW", amount: 5000000 }];

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
      const y = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
      const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(y)}`);
      const j = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice != null) {
        const prev = meta.chartPreviousClose ?? meta.previousClose;
        const price = meta.regularMarketPrice;
        out[sym] = { price, chg: prev ? ((price - prev) / prev) * 100 : null, cur: meta.currency || null };
      }
    } catch { /* skip */ }
  }));
  return out;
}
async function lookupTicker(query) {
  try {
    const r = await fetch(`/api/lookup?symbols=${encodeURIComponent(query)}`);
    if (r.ok) { const j = await r.json(); if (j && j[query]) return j[query]; }
  } catch { /* fall through */ }
  try {
    const u = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`;
    const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
    const j = await r.json();
    const quotes = (j?.quotes || []).filter((x) => x.symbol);
    const hangul = /[\uAC00-\uD7A3]/.test(query);
    const q = (hangul
      ? quotes.find((x) => /\.(KS|KQ)$/i.test(x.symbol))
      : quotes.find((x) => x.symbol.toUpperCase() === query.toUpperCase())) || quotes[0];
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

  useEffect(() => {
    (async () => {
      const s = await loadSaved();
      if (s?.holdings?.length) setHoldings(s.holdings.map((h) => ({ avgCost: null, ...h })));
      if (s?.cash) setCash(s.cash);
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
    if (hydrated) persist({ holdings, cash, settings: { themeName, displayCur, heatMode, capChange, capReturn, showPct, labelMode } });
  }, [holdings, cash, themeName, displayCur, heatMode, capChange, capReturn, showPct, labelMode, hydrated]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const krw = await fetchFx();
    if (krw) { setFx(krw); setFxLive(true); } else { setFx((p) => p ?? 1380); setFxLive(false); }
    const cryptoSyms = holdings.filter((h) => h.type === "crypto").map((h) => h.ticker.toUpperCase());
    const stockSyms = [...new Set(holdings.filter((h) => h.type !== "crypto" && h.ticker).map((h) => h.ticker))];
    const [cryptoData, stockData] = await Promise.all([fetchCrypto(cryptoSyms), fetchStocks(stockSyms)]);
    setHoldings((prev) => prev.map((h) => {
      if (h.type === "crypto") { const d = cryptoData[h.ticker.toUpperCase()]; return d ? { ...h, price: d.price, chg: d.chg, cur: "USD", live: true } : h; }
      const d = stockData[h.ticker]; return d ? { ...h, price: d.price, chg: d.chg, cur: d.cur || h.cur, live: true } : h;
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
    if (info) {
      const patch = {};
      if (info.symbol) { sym = info.symbol.toUpperCase(); patch.ticker = sym; }
      if (info.name) patch.name = info.name;
      const theme = THEME_MAP[sym] || (info.sector ? mapSector(info.sector) : null);
      if (theme) patch.sector = theme;
      updateHolding(id, patch);
    } else if (THEME_MAP[sym]) {
      updateHolding(id, { sector: THEME_MAP[sym] });
    }
    const sd = await fetchStocks([sym]);
    if (sd[sym]) updateHolding(id, { price: sd[sym].price, chg: sd[sym].chg, ...(sd[sym].cur ? { cur: sd[sym].cur } : {}), live: true });
  }, []);

  const capNow = heatMode === "return" ? capReturn : capChange;

  return (
    <div style={{ background: th.bg, color: th.text, minHeight: "100vh", transition: "background .25s", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}
        input,select{outline:none;font-family:inherit;} input:focus,select:focus{border-color:${th.accent}!important;}
        .ph-btn{transition:all .15s;cursor:pointer;} .ph-btn:hover{filter:brightness(1.08);}
        .ph-row:hover{background:${th.rowHover};}
        ::-webkit-scrollbar{height:8px;width:8px;} ::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px;}
        @keyframes spin{to{transform:rotate(360deg);}} .spin{animation:spin 1s linear infinite;}
        input[type=range]{accent-color:${th.accent};}
        @media (max-width:900px){.ph-grid{grid-template-columns:1fr !important;}}
      `}</style>

      {/* HEADER */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 22px", borderBottom: `1px solid ${th.border}`, background: th.bg, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: th.accent, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17, color: "#fff" }}>P</div>
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
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, padding: 18, alignItems: "start" }} className="ph-grid">
        <Panel th={th} title="Heatmap"
          titleExtra={<Segmented th={th} value={heatMode} onChange={setHeatMode} options={[["change", "현재가"], ["return", "내 수익률"]]} />}
          right={<HeatControls th={th} mode={heatMode} cap={capNow} setCap={heatMode === "return" ? setCapReturn : setCapChange} showPct={showPct} setShowPct={setShowPct} labelMode={labelMode} setLabelMode={setLabelMode} />}>
          <Treemap leaves={leaves} th={th} cap={capNow} showPct={showPct} labelMode={labelMode} />
          <HeatLegend th={th} cap={capNow} mode={heatMode} />
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel th={th} title="섹터별 자산 비중" sub={`${sectorData.length}개 구성`}>
            <Donut data={sectorData} th={th} />
          </Panel>
          <CashCard th={th} cash={cash} displayCur={displayCur} conv={conv} cashValue={cashValue} cashPct={cashPct}
            investedValue={positionsValue} onAdd={addCash} onUpdate={updateCash} onRemove={removeCash} />
        </div>
      </div>

      {/* TABLE */}
      <div style={{ padding: "0 18px 36px" }}>
        <Panel th={th} title="내 포트폴리오" sub="티커만 넣으면 이름·섹터 자동 분류"
          right={<button className="ph-btn" onClick={addHolding} style={primaryBtn(th)}><Plus size={15} /> 종목 추가</button>}>
          <PortfolioTable holdings={holdings} th={th} displayCur={displayCur} valueOf={valueOf} totalAssets={totalAssets} onUpdate={updateHolding} onRemove={removeHolding} onAutoFill={autoFill} />
          <p style={{ fontSize: 11.5, color: th.textFaint, marginTop: 12, lineHeight: 1.6 }}>
            티커 입력 후 칸을 벗어나면 <b style={{ color: th.textDim }}>이름·섹터 자동</b> 입력. 한국주식 <b style={{ color: th.textDim }}>005930.KS</b>(코스닥 .KQ), 크립토 <b style={{ color: th.textDim }}>BTC</b>.
            <b style={{ color: th.textDim }}> 평단가</b>를 넣으면 "내 수익률" 히트맵이 켜집니다.
          </p>
        </Panel>
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
      right={<button className="ph-btn" onClick={onAdd} style={{ ...primaryBtn(th), padding: "6px 10px", fontSize: 12 }}><Plus size={14} /> 현금</button>}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span className="num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>{fmt(cashPct, 1)}%</span>
        <span style={{ fontSize: 12, color: th.textDim }}>현금 / 총자산</span>
      </div>
      <div className="num" style={{ fontSize: 13, color: th.textDim, marginBottom: 12 }}>{fmtMoney(cashValue, displayCur)}</div>

      {/* invested vs cash bar */}
      <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", background: th.inputBg, marginBottom: 6 }}>
        <div style={{ width: `${investedPct}%`, background: th.accent }} />
        <div style={{ width: `${cashPct}%`, background: SECTOR_COLORS.Cash }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: th.textDim, marginBottom: 14 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Dot c={th.accent} />투자 {fmt(investedPct, 1)}%</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Dot c={SECTOR_COLORS.Cash} />현금 {fmt(cashPct, 1)}%</span>
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
          <div key={leaf.data.id} title={`${leaf.data.name || leaf.data.ticker}  ${leaf.data.metric != null ? (leaf.data.metric >= 0 ? "+" : "") + fmt(leaf.data.metric) + "%" : ""}`}
            style={{ position: "absolute", left: leaf.x0, top: leaf.y0, width: bw, height: bh, background: color, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", color: tc, padding: 2 }}>
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
function Donut({ data, th }) {
  if (!data.length) return <div style={{ height: 220, display: "grid", placeItems: "center", color: th.textFaint, fontSize: 13 }}>데이터 없음</div>;
  const top = data[0];
  return (
    <div>
      <div style={{ position: "relative", height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="sector" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((d) => <Cell key={d.sector} fill={sectorColor(d.sector)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: sectorColor(top.sector) }}>{fmt(top.pct, 1)}%</div>
            <div style={{ fontSize: 11, color: th.textDim, maxWidth: 90, lineHeight: 1.2 }}>{top.sector}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
        {data.map((d) => (
          <div key={d.sector} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
            <Dot c={sectorColor(d.sector)} /><span style={{ flex: 1, color: th.text }}>{d.sector}</span>
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
                <td style={{ ...cell, textAlign: "right" }}><input type="number" value={h.qty} onChange={(e) => onUpdate(h.id, { qty: parseFloat(e.target.value) || 0 })} style={{ ...inpStyle(th, 66), textAlign: "right" }} className="num" /></td>
                <td style={{ ...cell, textAlign: "right" }}><div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}><input type="number" value={h.avgCost ?? ""} placeholder="평단" onChange={(e) => onUpdate(h.id, { avgCost: e.target.value === "" ? null : parseFloat(e.target.value) })} style={{ ...inpStyle(th, 76), textAlign: "right" }} className="num" /><span style={{ fontSize: 11, color: th.textFaint, width: 10 }}>{h.cur === "KRW" ? "₩" : "$"}</span></div></td>
                <td style={{ ...cell, textAlign: "right" }}><div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}><input type="number" value={h.price ?? ""} placeholder="자동" onChange={(e) => onUpdate(h.id, { price: e.target.value === "" ? null : parseFloat(e.target.value), live: false })} style={{ ...inpStyle(th, 84), textAlign: "right", color: h.live ? th.accent : th.text }} className="num" title={h.live ? "야후 실시간" : "직접 입력 가능"} /><span style={{ fontSize: 11, color: th.textFaint, width: 10 }}>{h.cur === "KRW" ? "₩" : "$"}</span></div></td>
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
function Panel({ th, title, sub, titleExtra, right, children }) {
  return (
    <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div><div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>{title}</div>{sub && <div style={{ fontSize: 11, color: th.textDim, marginTop: 1 }}>{sub}</div>}</div>
          {titleExtra}
        </div>
        <div style={{ flex: 1 }} />{right}
      </div>
      {children}
    </div>
  );
}
function Segmented({ th, value, onChange, options, small }) {
  return (
    <div style={{ display: "inline-flex", background: th.panelAlt, borderRadius: 999, padding: 3 }}>
      {options.map(([val, label]) => {
        const on = value === val;
        return (
          <button key={val} className="ph-btn" onClick={() => onChange(val)} style={{ border: "none", borderRadius: 999, padding: small ? "4px 10px" : "5px 13px", fontSize: small ? 11.5 : 12.5, fontWeight: 700, background: on ? th.accent : "transparent", color: on ? "#fff" : th.textDim, cursor: "pointer", transition: "all .15s" }}>{label}</button>
        );
      })}
    </div>
  );
}
const iconBtn = (th) => ({ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: th.panelAlt, border: `1px solid ${th.border}`, color: th.text, cursor: "pointer" });
const primaryBtn = (th) => ({ display: "flex", alignItems: "center", gap: 6, background: th.accent, color: "#fff", border: "none", padding: "8px 13px", borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: "pointer" });
const inpStyle = (th, w) => ({ width: w || undefined, background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 8, padding: "6px 9px", fontSize: 12.5 });
const selStyle = (th, w) => ({ width: w, background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 8, padding: "6px 7px", fontSize: 12, cursor: "pointer" });
