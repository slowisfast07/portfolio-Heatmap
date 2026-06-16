import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Plus, Trash2, RefreshCw, Sun, Moon, TrendingUp, TrendingDown, Wifi, WifiOff,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 *  THEME TOKENS                                                        *
 * ------------------------------------------------------------------ */
const THEMES = {
  dark: {
    name: "dark", bg: "#0d1117", panel: "#161b22", panelAlt: "#1c2230", border: "#2a313c",
    text: "#e6edf3", textDim: "#8b949e", textFaint: "#5c6470", accent: "#22d3ee",
    inputBg: "#0d1117", heatNeg: "#e02d3c", heatNeu: "#39414e", heatPos: "#2bbd57",
    rowHover: "#1e2530", band: "#10151d",
  },
  light: {
    name: "light", bg: "#f6f8fa", panel: "#ffffff", panelAlt: "#f0f3f7", border: "#d8dee6",
    text: "#1a1f26", textDim: "#5c6670", textFaint: "#9aa4af", accent: "#0891b2",
    inputBg: "#ffffff", heatNeg: "#e0414e", heatNeu: "#c2c9d2", heatPos: "#28a85a",
    rowHover: "#eef2f6", band: "#e9edf2",
  },
};

const SECTORS = [
  "Technology", "Communication", "Consumer Cyclical", "Consumer Defensive", "Financial",
  "Healthcare", "Industrials", "Energy", "Real Estate", "Basic Materials", "Utilities", "Crypto", "Other",
];
const SECTOR_COLORS = {
  Technology: "#22d3ee", Communication: "#a78bfa", "Consumer Cyclical": "#f59e0b",
  "Consumer Defensive": "#34d399", Financial: "#60a5fa", Healthcare: "#f472b6",
  Industrials: "#fb923c", Energy: "#facc15", "Real Estate": "#4ade80",
  "Basic Materials": "#94a3b8", Utilities: "#818cf8", Crypto: "#fbbf24", Other: "#cbd5e1",
};
const CRYPTO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano",
  DOGE: "dogecoin", BNB: "binancecoin", AVAX: "avalanche-2", DOT: "polkadot",
  MATIC: "matic-network", LINK: "chainlink", TRX: "tron",
};

const SEED = [
  { id: "s1", type: "us", ticker: "AAPL", name: "Apple", sector: "Technology", qty: 30, price: null, cur: "USD", chg: null, live: false },
  { id: "s2", type: "us", ticker: "NVDA", name: "Nvidia", sector: "Technology", qty: 25, price: null, cur: "USD", chg: null, live: false },
  { id: "s3", type: "us", ticker: "MSFT", name: "Microsoft", sector: "Technology", qty: 12, price: null, cur: "USD", chg: null, live: false },
  { id: "s4", type: "us", ticker: "GOOG", name: "Alphabet", sector: "Communication", qty: 15, price: null, cur: "USD", chg: null, live: false },
  { id: "s5", type: "kr", ticker: "005930.KS", name: "삼성전자", sector: "Technology", qty: 100, price: null, cur: "KRW", chg: null, live: false },
  { id: "s6", type: "crypto", ticker: "BTC", name: "Bitcoin", sector: "Crypto", qty: 0.5, price: null, cur: "USD", chg: null, live: false },
  { id: "s7", type: "crypto", ticker: "ETH", name: "Ethereum", sector: "Crypto", qty: 4, price: null, cur: "USD", chg: null, live: false },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (n, d = 2) =>
  n == null || isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMoney = (n, cur) => {
  if (n == null || isNaN(n)) return "—";
  const sym = cur === "KRW" ? "₩" : "$";
  const d = cur === "KRW" ? 0 : 2;
  return sym + Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};

/* heat color — `cap` = the ±% at which the color reaches full saturation */
function heatColor(pct, th, cap = 3) {
  if (pct == null || isNaN(pct)) return th.heatNeu;
  const t = Math.max(-1, Math.min(1, pct / cap));
  if (t >= 0) return d3.interpolateRgb(th.heatNeu, th.heatPos)(t);
  return d3.interpolateRgb(th.heatNeu, th.heatNeg)(-t);
}

/* ------------------------------------------------------------------ *
 *  DATA FETCHERS                                                       *
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
    for (const sym of symbols) {
      const id = CRYPTO_IDS[sym];
      if (id && j[id]) out[sym] = { price: j[id].usd, chg: j[id].usd_24h_change, cur: "USD" };
    }
    return out;
  } catch { return {}; }
}

/* Stocks via our own /api/quote backend; falls back to a public proxy
   (so it still works during local `vite dev` when no function is running). */
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

/* ------------------------------------------------------------------ *
 *  PERSISTENCE  (localStorage — works on a real deployed site)        *
 * ------------------------------------------------------------------ */
const KEY = "portfolio_heatmap_v1";
function loadSaved() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function persist(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

/* ================================================================== *
 *  MAIN                                                                *
 * ================================================================== */
export default function App() {
  const [themeName, setThemeName] = useState("dark");
  const th = THEMES[themeName];
  const [displayCur, setDisplayCur] = useState("USD");
  const [holdings, setHoldings] = useState(SEED);
  const [fx, setFx] = useState(null);
  const [fxLive, setFxLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  /* heatmap display settings */
  const [satCap, setSatCap] = useState(3);     // ±% for full color
  const [showPct, setShowPct] = useState(true);
  const [labelMode, setLabelMode] = useState("ticker"); // ticker | name

  useEffect(() => {
    const s = loadSaved();
    if (s?.holdings?.length) setHoldings(s.holdings);
    if (s?.settings) {
      const x = s.settings;
      if (x.themeName) setThemeName(x.themeName);
      if (x.displayCur) setDisplayCur(x.displayCur);
      if (x.satCap != null) setSatCap(x.satCap);
      if (x.showPct != null) setShowPct(x.showPct);
      if (x.labelMode) setLabelMode(x.labelMode);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) persist({ holdings, settings: { themeName, displayCur, satCap, showPct, labelMode } });
  }, [holdings, themeName, displayCur, satCap, showPct, labelMode, hydrated]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const krw = await fetchFx();
    if (krw) { setFx(krw); setFxLive(true); } else { setFx((p) => p ?? 1380); setFxLive(false); }

    const cryptoSyms = holdings.filter((h) => h.type === "crypto").map((h) => h.ticker.toUpperCase());
    const stockSyms = [...new Set(holdings.filter((h) => h.type !== "crypto" && h.ticker).map((h) => h.ticker))];
    const [cryptoData, stockData] = await Promise.all([fetchCrypto(cryptoSyms), fetchStocks(stockSyms)]);

    setHoldings((prev) => prev.map((h) => {
      if (h.type === "crypto") {
        const d = cryptoData[h.ticker.toUpperCase()];
        return d ? { ...h, price: d.price, chg: d.chg, cur: "USD", live: true } : h;
      }
      const d = stockData[h.ticker];
      return d ? { ...h, price: d.price, chg: d.chg, cur: d.cur || h.cur, live: true } : h;
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
  const valueOf = useCallback((h) => {
    if (h.price == null || !h.qty) return 0;
    const native = h.price * h.qty;
    if (h.cur === displayCur) return native;
    return h.cur === "USD" ? native * rate : native / rate;
  }, [displayCur, rate]);

  const totalValue = useMemo(() => holdings.reduce((s, h) => s + valueOf(h), 0), [holdings, valueOf]);

  const dayChange = useMemo(() => {
    let w = 0, sum = 0;
    holdings.forEach((h) => { const v = valueOf(h); if (h.chg != null && v) { w += v; sum += v * h.chg; } });
    return w ? sum / w : null;
  }, [holdings, valueOf]);

  const sectorData = useMemo(() => {
    const map = {};
    holdings.forEach((h) => { const v = valueOf(h); if (v) map[h.sector] = (map[h.sector] || 0) + v; });
    return Object.entries(map)
      .map(([sector, value]) => ({ sector, value, pct: totalValue ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, valueOf, totalValue]);

  const addHolding = () =>
    setHoldings((p) => [...p, { id: uid(), type: "us", ticker: "", name: "", sector: "Technology", qty: 0, price: null, cur: "USD", chg: null, live: false }]);
  const updateHolding = (id, patch) => setHoldings((p) => p.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const removeHolding = (id) => setHoldings((p) => p.filter((h) => h.id !== id));

  return (
    <div style={{ background: th.bg, color: th.text, minHeight: "100vh", transition: "background .25s" }}>
      <style>{`
        .mono { font-variant-numeric: tabular-nums; font-feature-settings:"tnum"; font-family:"JetBrains Mono",ui-monospace,Menlo,monospace; }
        input,select{outline:none;} input:focus,select:focus{border-color:${th.accent}!important;}
        .ph-btn{transition:all .15s;cursor:pointer;} .ph-btn:hover{filter:brightness(1.15);}
        .ph-row:hover{background:${th.rowHover};}
        ::-webkit-scrollbar{height:8px;width:8px;}
        ::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px;}
        @keyframes spin{to{transform:rotate(360deg);}} .spin{animation:spin 1s linear infinite;}
        input[type=range]{accent-color:${th.accent};}
        @media (max-width:860px){.ph-grid{grid-template-columns:1fr !important;}}
      `}</style>

      {/* TOP BAR */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: `1px solid ${th.border}`, background: th.panel, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: `linear-gradient(135deg,${th.heatPos},${th.accent})`, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, color: "#031018" }}>P</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Portfolio Heatmap</div>
            <div style={{ fontSize: 11, color: th.textDim }}>색상 = 일간 변동 · 크기 = 보유 비중</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "right", marginRight: 4 }}>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{fmtMoney(totalValue, displayCur)}</div>
          <div className="mono" style={{ fontSize: 12, color: dayChange == null ? th.textDim : dayChange >= 0 ? th.heatPos : th.heatNeg, display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
            {dayChange != null && (dayChange >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}
            {dayChange == null ? "—" : `${dayChange >= 0 ? "+" : ""}${fmt(dayChange)}% 오늘`}
          </div>
        </div>
        <Segmented th={th} value={displayCur} onChange={setDisplayCur} options={[["USD", "$"], ["KRW", "₩"]]} />
        <button className="ph-btn" onClick={refresh} title="새로고침" style={{ ...iconBtn(th), color: th.accent }}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
        <button className="ph-btn" onClick={() => setThemeName(themeName === "dark" ? "light" : "dark")} title="테마" style={iconBtn(th)}>
          {themeName === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      {/* STATUS */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "6px 20px", fontSize: 11.5, color: th.textDim, borderBottom: `1px solid ${th.border}`, background: th.band }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {fxLive ? <Wifi size={12} color={th.heatPos} /> : <WifiOff size={12} color={th.textFaint} />}
          USD/KRW <b className="mono" style={{ color: th.text }}>{fmt(rate, 1)}</b>
          <span style={{ color: th.textFaint }}>{fxLive ? "실시간" : "추정치"}</span>
        </span>
        <span style={{ color: th.textFaint }}>·</span>
        <span>마지막 업데이트 {lastUpdate ? lastUpdate.toLocaleTimeString() : "—"} <span style={{ color: th.textFaint }}>(60초마다 자동)</span></span>
      </div>

      {/* BODY */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 16, padding: 16, alignItems: "start" }} className="ph-grid">
        <Panel th={th} title="Heatmap" sub="보유 종목 트리맵"
          right={<HeatControls th={th} satCap={satCap} setSatCap={setSatCap} showPct={showPct} setShowPct={setShowPct} labelMode={labelMode} setLabelMode={setLabelMode} />}>
          <Treemap holdings={holdings} valueOf={valueOf} th={th} satCap={satCap} showPct={showPct} labelMode={labelMode} />
          <HeatLegend th={th} satCap={satCap} />
        </Panel>

        <Panel th={th} title="섹터별 자산 비중" sub={`${sectorData.length}개 섹터`}>
          <Donut data={sectorData} th={th} />
        </Panel>
      </div>

      {/* TABLE */}
      <div style={{ padding: "0 16px 32px" }}>
        <Panel th={th} title="내 포트폴리오" sub="미국주식 · 한국주식 · 크립토 입력"
          right={
            <button className="ph-btn" onClick={addHolding} style={{ display: "flex", alignItems: "center", gap: 6, background: th.accent, color: "#031018", border: "none", padding: "7px 12px", borderRadius: 7, fontWeight: 700, fontSize: 12.5 }}>
              <Plus size={15} /> 종목 추가
            </button>
          }>
          <PortfolioTable holdings={holdings} th={th} displayCur={displayCur} valueOf={valueOf} totalValue={totalValue} onUpdate={updateHolding} onRemove={removeHolding} />
          <p style={{ fontSize: 11.5, color: th.textFaint, marginTop: 12, lineHeight: 1.6 }}>
            한국 주식은 야후 코드로 입력 (예: 삼성전자 <b style={{ color: th.textDim }}>005930.KS</b>, 코스닥은 <b style={{ color: th.textDim }}>.KQ</b>).
            크립토는 심볼만 (예: <b style={{ color: th.textDim }}>BTC, ETH, SOL</b>). 실시간 가격을 못 불러오면 <b style={{ color: th.textDim }}>가격 칸을 직접 입력</b>하세요.
          </p>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  HEATMAP CONTROLS                                                   *
 * ------------------------------------------------------------------ */
function HeatControls({ th, satCap, setSatCap, showPct, setShowPct, labelMode, setLabelMode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: th.textDim }}>
        최대 채도 <b className="mono" style={{ color: th.text }}>±{satCap}%</b>
        <input type="range" min={1} max={10} step={0.5} value={satCap} onChange={(e) => setSatCap(parseFloat(e.target.value))} style={{ width: 92 }} />
      </label>
      <Segmented th={th} small value={labelMode} onChange={setLabelMode} options={[["ticker", "티커"], ["name", "이름"]]} />
      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: th.textDim, cursor: "pointer" }}>
        <input type="checkbox" checked={showPct} onChange={(e) => setShowPct(e.target.checked)} /> % 표시
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  TREEMAP                                                            *
 * ------------------------------------------------------------------ */
function Treemap({ holdings, valueOf, th, satCap, showPct, labelMode }) {
  const ref = useRef(null);
  const [w, setW] = useState(800);
  const H = 420;

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const root = useMemo(() => {
    const bySector = {};
    holdings.forEach((h) => {
      const v = valueOf(h);
      if (v <= 0 || !h.ticker) return;
      (bySector[h.sector] = bySector[h.sector] || []).push({ ...h, value: v });
    });
    const children = Object.entries(bySector).map(([sector, items]) => ({ sector, children: items }));
    if (!children.length) return null;
    const r = d3.hierarchy({ children }).sum((d) => d.value).sort((a, b) => b.value - a.value);
    d3.treemap().size([w, H]).paddingInner(2).paddingTop(20).round(true)(r);
    return r;
  }, [holdings, valueOf, w]);

  if (!root) {
    return <div ref={ref} style={{ height: H, display: "grid", placeItems: "center", color: th.textFaint, border: `1px dashed ${th.border}`, borderRadius: 8, fontSize: 13 }}>종목을 추가하면 히트맵이 표시됩니다</div>;
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: H, borderRadius: 8, overflow: "hidden", background: th.band }}>
      {root.children.map((s, i) => (
        <div key={"sec" + i} style={{ position: "absolute", left: s.x0, top: s.y0, width: s.x1 - s.x0, height: 20, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, color: th.textDim, padding: "4px 6px 0", textTransform: "uppercase", overflow: "hidden", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {s.data.sector}
        </div>
      ))}
      {root.leaves().map((leaf) => {
        const bw = leaf.x1 - leaf.x0, bh = leaf.y1 - leaf.y0, area = bw * bh;
        const color = heatColor(leaf.data.chg, th, satCap);
        const showLabel = area > 1300, showPctHere = showPct && area > 4200;
        const fs = Math.max(8, Math.min(22, Math.sqrt(area) / 5.5));
        const dark = d3.hcl(color).l < 60;
        const tc = dark ? "#ffffff" : "#0b1015";
        const label = labelMode === "name" && leaf.data.name
          ? leaf.data.name
          : leaf.data.ticker.replace(".KS", "").replace(".KQ", "");
        return (
          <div key={leaf.data.id} title={`${leaf.data.name || leaf.data.ticker}  ${leaf.data.chg != null ? (leaf.data.chg >= 0 ? "+" : "") + fmt(leaf.data.chg) + "%" : ""}`}
            style={{ position: "absolute", left: leaf.x0, top: leaf.y0, width: bw, height: bh, background: color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", color: tc, padding: 2 }}>
            {showLabel && <div style={{ fontWeight: 700, fontSize: fs, lineHeight: 1.05, textAlign: "center", padding: "0 2px", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", whiteSpace: "nowrap" }}>{label}</div>}
            {showPctHere && leaf.data.chg != null && <div className="mono" style={{ fontSize: Math.max(8, fs * 0.6), opacity: 0.95 }}>{leaf.data.chg >= 0 ? "+" : ""}{fmt(leaf.data.chg)}%</div>}
          </div>
        );
      })}
    </div>
  );
}

function HeatLegend({ th, satCap }) {
  const stops = [-satCap * 1.6, -satCap, -satCap / 2, 0, satCap / 2, satCap, satCap * 1.6];
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "flex-end", marginTop: 10 }}>
      {stops.map((s, i) => (
        <div key={i} className="mono" style={{ background: heatColor(s, th, satCap), color: Math.abs(s) > satCap / 2 ? "#fff" : th.text, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", minWidth: 44, textAlign: "center", borderRadius: 3 }}>
          {s > 0 ? "+" : ""}{fmt(s, 1)}%
        </div>
      ))}
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
      <div style={{ position: "relative", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="sector" cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((d) => <Cell key={d.sector} fill={SECTOR_COLORS[d.sector] || "#888"} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: SECTOR_COLORS[top.sector] }}>{fmt(top.pct, 1)}%</div>
            <div style={{ fontSize: 11, color: th.textDim, maxWidth: 90, lineHeight: 1.2 }}>{top.sector}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
        {data.map((d) => (
          <div key={d.sector} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: SECTOR_COLORS[d.sector] || "#888", flexShrink: 0 }} />
            <span style={{ flex: 1, color: th.text }}>{d.sector}</span>
            <span className="mono" style={{ color: th.textDim, fontWeight: 600 }}>{fmt(d.pct, 1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  TABLE                                                              *
 * ------------------------------------------------------------------ */
function PortfolioTable({ holdings, th, displayCur, valueOf, totalValue, onUpdate, onRemove }) {
  const head = (t) => ({ textAlign: t || "left", fontSize: 10.5, fontWeight: 600, color: th.textFaint, padding: "8px 10px", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" });
  const cell = { padding: "6px 10px", fontSize: 12.5, borderTop: `1px solid ${th.border}` };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <thead>
          <tr>
            <th style={head()}>유형</th><th style={head()}>티커</th><th style={head()}>이름</th><th style={head()}>섹터</th>
            <th style={head("right")}>수량</th><th style={head("right")}>가격</th><th style={head("right")}>일간%</th>
            <th style={head("right")}>평가액 ({displayCur})</th><th style={head("right")}>비중</th><th style={head("center")}></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const v = valueOf(h);
            const wpct = totalValue ? (v / totalValue) * 100 : 0;
            return (
              <tr key={h.id} className="ph-row">
                <td style={cell}>
                  <select value={h.type} onChange={(e) => { const t = e.target.value; onUpdate(h.id, { type: t, cur: t === "kr" ? "KRW" : "USD", sector: t === "crypto" ? "Crypto" : h.sector }); }} style={selStyle(th, 64)}>
                    <option value="us">미국</option><option value="kr">한국</option><option value="crypto">크립토</option>
                  </select>
                </td>
                <td style={cell}>
                  <input value={h.ticker} placeholder={h.type === "kr" ? "005930.KS" : h.type === "crypto" ? "BTC" : "AAPL"} onChange={(e) => onUpdate(h.id, { ticker: e.target.value.toUpperCase(), live: false })} style={inpStyle(th, 96)} className="mono" />
                </td>
                <td style={cell}><input value={h.name} placeholder="이름" onChange={(e) => onUpdate(h.id, { name: e.target.value })} style={inpStyle(th, 110)} /></td>
                <td style={cell}>
                  <select value={h.sector} onChange={(e) => onUpdate(h.id, { sector: e.target.value })} style={selStyle(th, 130)}>
                    {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ ...cell, textAlign: "right" }}><input type="number" value={h.qty} onChange={(e) => onUpdate(h.id, { qty: parseFloat(e.target.value) || 0 })} style={{ ...inpStyle(th, 72), textAlign: "right" }} className="mono" /></td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                    <input type="number" value={h.price ?? ""} placeholder="자동" onChange={(e) => onUpdate(h.id, { price: e.target.value === "" ? null : parseFloat(e.target.value), live: false })} style={{ ...inpStyle(th, 82), textAlign: "right" }} className="mono" title={h.live ? "실시간" : "직접 입력 가능"} />
                    <select value={h.cur} onChange={(e) => onUpdate(h.id, { cur: e.target.value })} style={selStyle(th, 54)}><option value="USD">$</option><option value="KRW">₩</option></select>
                  </div>
                </td>
                <td className="mono" style={{ ...cell, textAlign: "right", color: h.chg == null ? th.textFaint : h.chg >= 0 ? th.heatPos : th.heatNeg, fontWeight: 600 }}>{h.chg == null ? "—" : `${h.chg >= 0 ? "+" : ""}${fmt(h.chg)}`}</td>
                <td className="mono" style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{fmtMoney(v, displayCur)}</td>
                <td className="mono" style={{ ...cell, textAlign: "right", color: th.textDim }}>{fmt(wpct, 1)}%</td>
                <td style={{ ...cell, textAlign: "center" }}><button className="ph-btn" onClick={() => onRemove(h.id)} style={{ ...iconBtn(th), width: 28, height: 28, color: th.heatNeg }} title="삭제"><Trash2 size={14} /></button></td>
              </tr>
            );
          })}
          {!holdings.length && <tr><td colSpan={10} style={{ ...cell, textAlign: "center", color: th.textFaint, padding: 28 }}>"종목 추가"를 눌러 포트폴리오를 입력하세요</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  PRIMITIVES                                                         *
 * ------------------------------------------------------------------ */
function Panel({ th, title, sub, right, children }) {
  return (
    <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 11, color: th.textDim, marginTop: 1 }}>{sub}</div>}</div>
        <div style={{ flex: 1 }} />{right}
      </div>
      {children}
    </div>
  );
}
function Segmented({ th, value, onChange, options, small }) {
  return (
    <div style={{ display: "inline-flex", background: th.panelAlt, border: `1px solid ${th.border}`, borderRadius: 8, padding: 2 }}>
      {options.map(([val, label]) => (
        <button key={val} className="ph-btn" onClick={() => onChange(val)} style={{ border: "none", borderRadius: 6, padding: small ? "4px 9px" : "5px 11px", fontSize: small ? 11.5 : 12.5, fontWeight: 700, background: value === val ? th.accent : "transparent", color: value === val ? "#031018" : th.textDim, cursor: "pointer" }}>
          {label}{!small && ` ${val}`}
        </button>
      ))}
    </div>
  );
}
const iconBtn = (th) => ({ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 8, background: th.panelAlt, border: `1px solid ${th.border}`, color: th.text, cursor: "pointer" });
const inpStyle = (th, w) => ({ width: w, background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 6, padding: "5px 8px", fontSize: 12.5 });
const selStyle = (th, w) => ({ width: w, background: th.inputBg, border: `1px solid ${th.border}`, color: th.text, borderRadius: 6, padding: "5px 6px", fontSize: 12, cursor: "pointer" });
