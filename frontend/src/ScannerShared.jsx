import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

// ── Tab config ──────────────────────────────────────────────────────────────
export const TAB_CONFIG = [
  ["liveScanner", "Live Scanner"],
  ["aiPortfolio", "AI Portfolio"],
  ["allRanked", "All Ranked"],
  ["strongBuy", "Strong Buy"],
  ["buy", "Buy"],
  ["hold", "Hold"],
  ["sell", "Sell"],
  ["avoid", "Avoid"],
  ["breakout52w", "52W Breakout"],
  ["volBreakout", "Volume Breakout"],
  ["accumulation", "Accumulation"],
  ["aiPicks", "AI Picks"],
  ["sectorSummary", "Sector Summary"],
  ["sectorRotation", "Sector Rotation"],
  ["marketBreadth", "Market Breadth"],
  ["errors", "Errors"],
];

export const PIE_COLORS = ["#5d87ff", "#13deb9", "#ffae1f", "#fa896b", "#7460ee", "#60a5fa"];

// ── SVG Icons ─────────────────────────────────────────────────────────────
const _I = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
export function IcCommand()  { return <svg {..._I}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
export function IcTune()     { return <svg {..._I}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>; }
export function IcChart()    { return <svg {..._I}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>; }
export function IcTable()    { return <svg {..._I}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>; }
export function IcFilter()   { return <svg {..._I}><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/></svg>; }
export function IcPlay()     { return <svg {..._I}><polygon points="5,3 19,12 5,21"/></svg>; }
export function IcRefresh()  { return <svg {..._I}><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>; }
export function IcRadar()    { return <svg {..._I}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
export function IcBolt()     { return <svg {..._I}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>; }
export function IcTrend()    { return <svg {..._I}><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/></svg>; }
export function IcHub()      { return <svg {..._I}><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><line x1="6" y1="7" x2="10" y2="10"/><line x1="18" y1="7" x2="14" y2="10"/><line x1="6" y1="17" x2="10" y2="14"/><line x1="18" y1="17" x2="14" y2="14"/></svg>; }

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const COLD_MSGS = [
  [0,  "Connecting to scanner backend..."],
  [3,  "First load fetches live data from Fyers API — this takes a moment."],
  [10, "Downloading daily price history for each symbol..."],
  [20, "Pulling intraday bars and benchmark data..."],
  [35, "Computing relative strength, signals, and AI scores..."],
  [50, "Building sector summaries and market breadth..."],
  [70, "Almost there — assembling final dashboard payload..."],
  [90, "Finalizing — the next page load will be instant."],
];

export function ColdStartOverlay({ elapsed, scanning }) {
  const msg = COLD_MSGS.reduce((acc, [sec, text]) => (elapsed >= sec ? text : acc), COLD_MSGS[0][1]);
  const pct = Math.min(elapsed * 1.1, 95);
  return (
    <div className="scan-cold-overlay">
      <div className="scan-cold-card">
        <div className="scan-cold-spinner" />
        <h3>{scanning ? "Running scan..." : "Loading scanner data..."}</h3>
        <p style={{ color: "var(--text-muted)", margin: "8px 0 16px" }}>{msg}</p>
        <div className="scan-cold-bar-track">
          <div className="scan-cold-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{elapsed}s elapsed</div>
      </div>
    </div>
  );
}

export function ScannerKpiGrid({ items }) {
  const heroItems = items.slice(0, 3);
  const compactItems = items.slice(3);
  return (
    <>
      <div className="scan-kpi-grid">
        {heroItems.map((item, idx) => (
          <div className={`scan-kpi-hero tone-${item.tone}`} key={item.label}>
            <div className="kh-top">
              <div className="kh-icon"><item.Icon /></div>
              <div className="kh-label">{item.label}</div>
            </div>
            <div className="kh-bottom">
              <div>
                <div className="kh-value">{item.value ?? "-"}</div>
                <div className="kh-sub">{item.sub}</div>
                <div className="kh-trend">{item.trendLabel}</div>
              </div>
              <div className="scan-kpi-sparkline">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={item.sparkData}>
                    <defs>
                      <linearGradient id={`kpi-fill-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="rgba(255,255,255,0.9)" fill={`url(#kpi-fill-${idx})`} strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="scan-kpi-compact">
        {compactItems.map((item) => (
          <div className="scan-kpi-card" key={item.label}>
            <div className={`kc-icon tone-${item.tone}`}><item.Icon /></div>
            <div>
              <div className="kc-label">{item.label}</div>
              <div className="kc-value">{item.value ?? "-"}</div>
              <div className="kc-sub">{item.sub}</div>
              <div className="kc-trend">{item.trendLabel}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function SectorBarChart({ rows }) {
  if (!rows?.length) return <div className="scan-chart-panel"><div className="scan-chart-empty">No sector summary data available.</div></div>;
  const data = rows.map((r) => ({ Sector: r.Sector, StrongBuy: r.StrongBuy ?? 0, Buy: r.Buy ?? 0, Sell: r.Sell ?? 0 }));
  return (
    <div className="scan-chart-panel">
      <div className="scp-overline">Visual block</div>
      <h3>Sector-wise Signals</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="Sector" stroke="var(--text-muted)" angle={-20} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
          <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="StrongBuy" fill="#13deb9" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Buy" fill="#5d87ff" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Sell" fill="#fa896b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BreadthPieChart({ rows }) {
  if (!rows?.length) return <div className="scan-chart-panel"><div className="scan-chart-empty">No market breadth data available.</div></div>;
  return (
    <div className="scan-chart-panel">
      <div className="scp-overline">Visual block</div>
      <h3>Market Breadth</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={rows} dataKey="Count" nameKey="Type" innerRadius={65} outerRadius={105} paddingAngle={4}>
            {rows.map((entry, i) => <Cell key={entry.Type} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopMoversBarChart({ title, rows, xKey, yKey, color }) {
  if (!rows?.length) return <div className="scan-chart-panel"><div className="scan-chart-empty">No data for {title}.</div></div>;
  return (
    <div className="scan-chart-panel">
      <div className="scp-overline">Visual block</div>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} layout="vertical" margin={{ top: 12, right: 32, left: 24, bottom: 8 }}>
          <CartesianGrid stroke="var(--border)" horizontal vertical={false} />
          <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey={yKey} width={100} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey={xKey} fill={color} radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScannerDataTable({ title, rows, emptyMessage = "No data available.", maxRows = 100 }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const safeRows = rows || [];
  const columns = Object.keys(safeRows[0] ?? {});

  if (safeRows.length === 0) {
    return <div className="scan-data-table"><div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{emptyMessage}</div></div>;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const searched = normalizedQuery
    ? safeRows.filter((r) => columns.some((c) => String(r[c] ?? "").toLowerCase().includes(normalizedQuery)))
    : safeRows;

  const sorted = sortKey
    ? [...searched].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const an = Number(av), bn = Number(bv);
        if (Number.isFinite(an) && Number.isFinite(bn)) return sortDir === "asc" ? an - bn : bn - an;
        return sortDir === "asc" ? String(av ?? "").localeCompare(String(bv ?? "")) : String(bv ?? "").localeCompare(String(av ?? ""));
      })
    : searched;

  const limited = sorted.slice(0, maxRows);

  function handleSort(col) {
    if (sortKey === col) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return; }
    setSortKey(col);
    setSortDir("desc");
  }

  return (
    <div className="scan-data-table">
      <div className="scan-dt-head">
        <div>
          <div className="dth-title">{title}</div>
          <div className="dth-count">Showing {limited.length} of {searched.length} ({safeRows.length} total)</div>
        </div>
        <div className="scan-dt-toolbar">
          <input className="scan-dt-search" placeholder="Search rows..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="scan-dt-table-wrap">
        <table className="scan-dt-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} className={sortKey === col ? "sorted" : ""} onClick={() => handleSort(col)}>
                  {col}
                  <span className="sort-arrow">{sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {limited.map((row, ri) => (
              <tr key={`${row.Ticker || "r"}-${ri}`}>
                {columns.map((col) => (
                  <td key={`${col}-${ri}`}>{formatCellValue(row[col], col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function buildScanRequest(symbolInput, sectorOverridesInput, deliveryOverridesInput) {
  const watchlistSymbols = String(symbolInput || "")
    .split(/[\r\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
  const sectorOverrides = parseJsonInput(sectorOverridesInput);
  const deliveryOverrides = parseJsonInput(deliveryOverridesInput);
  if (!watchlistSymbols.length && !Object.keys(sectorOverrides).length && !Object.keys(deliveryOverrides).length) return null;
  return {
    ...(watchlistSymbols.length ? { watchlistSymbols } : {}),
    ...(Object.keys(sectorOverrides).length ? { sectorOverrides } : {}),
    ...(Object.keys(deliveryOverrides).length ? { deliveryOverrides } : {}),
  };
}

function parseJsonInput(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function pickLeadRow(rows, label, tone) {
  const row = rows?.[0];
  if (!row) return null;
  const primary = row.Ticker || row.Sector || row.Type || label;
  const changeValue = row["DayChange_%"] ?? row["Change_%"] ?? row.AI_Prob ?? row.Count;
  const secondary = changeValue === undefined ? "waiting for fresh data" : `Lead metric ${fmtLeadValue(changeValue)}`;
  return { label, primary, secondary, tone };
}

function fmtLeadValue(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return String(v ?? "-");
  const n = Number(v);
  if (n <= 1 && n >= 0) return `${(n * 100).toFixed(2)}%`;
  return `${n.toFixed(2)}`;
}

export function fmtProb(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return `${(Number(v) * 100).toFixed(2)}%`;
}

export function fmtNum(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return Number(v).toFixed(1);
}

export function fmtSignedPct(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return `${Number(v).toFixed(2)}%`;
}

export function fmtPctTotal(v, total) {
  if (!total || !v) return "0.0%";
  return `${((Number(v) / Number(total)) * 100).toFixed(1)}%`;
}

export function signalClass(signal) {
  switch ((signal || "").toUpperCase()) {
    case "STRONG BUY":
    case "BUY": return "signal-buy";
    case "SELL":
    case "AVOID": return "signal-sell";
    case "HOLD": return "signal-hold";
    default: return "";
  }
}

export function buildSparklineData(values) {
  const cleaned = (values || []).map((v) => Number(v) || 0);
  if (cleaned.length === 0) return [{ index: 0, value: 0 }];
  return cleaned.map((v, i) => ({ index: i, value: v }));
}

export function seriesFromRows(rows, key, limit = 6) {
  const values = (rows || []).map((r) => Number(r?.[key])).filter((v) => Number.isFinite(v)).slice(0, limit);
  return buildSparklineData(values);
}

export function firstNumericSeries(rows, keys, limit = 6) {
  for (const key of keys) {
    const s = seriesFromRows(rows, key, limit);
    if (s.some((p) => p.value !== 0)) return s;
  }
  return buildSparklineData([]);
}

export function sectorCompositeSeries(rows, limit = 6) {
  const values = (rows || []).slice(0, limit).map((r) => (Number(r?.StrongBuy) || 0) + (Number(r?.Buy) || 0) - (Number(r?.Sell) || 0));
  return buildSparklineData(values);
}

export function topSectorSignals(rows, sectorName) {
  const match = (rows || []).find((r) => r.Sector === sectorName);
  return (Number(match?.StrongBuy) || 0) + (Number(match?.Buy) || 0);
}

export function buildLiveProfile(row) {
  return buildSparklineData([
    Number(row?.["Change_%"]) || 0,
    Number(row?.IntradayMomentumScore) || 0,
    (Number(row?.Combined_AI_Prob ?? row?.Intraday_AI_Prob) || 0) * 100,
    Number(row?.RS_rating_1_100 ?? row?.RS) || 0,
  ]);
}

function formatCellValue(value, column) {
  if (value === null || value === undefined) return "-";
  const col = column.toLowerCase();
  if (col === "signal") {
    const cls = signalClass(value);
    return <span className={`cell-signal ${cls}`}>{value}</span>;
  }
  if (col.includes("change") || col.includes("%") || col === "ai_prob" || col === "combined_ai_prob" || col === "intraday_ai_prob") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      const display = col.includes("prob") ? `${(n * 100).toFixed(2)}%` : `${n.toFixed(2)}%`;
      return <span className={n >= 0 ? "cell-positive" : "cell-negative"}>{display}</span>;
    }
  }
  const numValue = Number(value);
  if (Number.isFinite(numValue) && typeof value !== "string") {
    return numValue % 1 === 0 ? numValue : numValue.toFixed(2);
  }
  return String(value);
}
