import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { API_BASE, fetchDashboard, fetchSession, login, logout, placeOrder, runStrategy } from "./api";

const MarketsPage = lazy(() => import("./MarketsPage"));
const ScannerLayout = lazy(() => import("./ScannerLayout"));
const ScannerCommandDeck = lazy(() => import("./ScannerCommandDeck"));
const ScannerExecution = lazy(() => import("./ScannerExecution"));
const ScannerVisuals = lazy(() => import("./ScannerVisuals"));
const ScannerDatasets = lazy(() => import("./ScannerDatasets"));
const ScannerFilterLab = lazy(() => import("./ScannerFilterLab"));

function PageLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
      <div className="scan-cold-spinner" />
    </div>
  );
}

const THEME_KEY = "tradebuddy-theme";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const SETTINGS_KEY = "tradebuddy-ui-settings";
const AUTO_CAP_KEY = "tradebuddy-auto-cap";
const DEFAULT_SETTINGS = {
  watchlistSymbols: "NSE:NIFTY50-INDEX,NSE:NIFTYBANK-INDEX,NSE:SBIN-EQ,NSE:RELIANCE-EQ",
  liveUpdatesEnabled: true,
  reconnectSeconds: 3,
  strategyAutoInterval: 15,
  strategyAutoMaxRuns: 2,
  strategyDailyCap: 5,
};

const CHART_COLORS = ["#5d87ff", "#13deb9", "#ffae1f", "#fa896b", "#7460ee", "#2a3547"];

// ─── SVG Icon helpers ─────────────────────────────────────────────────────────
const _S = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
function IcoMenu()      { return <svg {..._S}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>; }
function IcoDashboard() { return <svg {..._S}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function IcoBriefcase() { return <svg {..._S}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>; }
function IcoOrders()    { return <svg {..._S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>; }
function IcoStrategy()  { return <svg {..._S}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>; }
function IcoSettings()  { return <svg {..._S}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function IcoLogout()    { return <svg {..._S}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function IcoBalance()   { return <svg {..._S}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>; }
function IcoPositions() { return <svg {..._S}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>; }
function IcoMarkets()   { return <svg {..._S}><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/></svg>; }
function IcoScanner()   { return <svg {..._S}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>; }
function IcoCommand()   { return <svg {..._S}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function IcoTune()      { return <svg {..._S}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>; }
function IcoChart()     { return <svg {..._S}><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>; }
function IcoTable()     { return <svg {..._S}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>; }
function IcoFilter()    { return <svg {..._S}><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/></svg>; }
function IcoSun()       { return <svg {..._S}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function IcoMoon()      { return <svg {..._S}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>; }

function normalizeSymbols(raw) {
  return raw
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyAutoState() {
  try {
    const raw = window.localStorage.getItem(AUTO_CAP_KEY);
    if (!raw) {
      return { date: getTodayKey(), count: 0 };
    }
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayKey()) {
      return { date: getTodayKey(), count: 0 };
    }
    return parsed;
  } catch {
    return { date: getTodayKey(), count: 0 };
  }
}

function saveDailyAutoState(state) {
  window.localStorage.setItem(AUTO_CAP_KEY, JSON.stringify(state));
}

function exportRowsToCsv(filename, rows, columns) {
  const header = columns.map((column) => column.label);
  const body = rows.map((row) =>
    columns.map((column) => {
      const value = column.exportValue ? column.exportValue(row) : column.render ? column.render(row) : row[column.key] ?? "";
      return `"${String(value).replaceAll('"', '""')}"`;
    })
  );
  const csv = [header, ...body].map((line) => line.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({ title, value, subtitle }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="value">{value}</p>
      {subtitle ? <p className="sub">{subtitle}</p> : null}
    </div>
  );
}

function formatCurrency(value) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(number);
}

function SmartChartsBoard({ pnlSeries, watchSeries, holdings }) {
  const allocation = holdings
    .map((item) => {
      const value = Number(item.marketVal ?? Number(item.quantity || 0) * Number(item.ltp || 0));
      return {
        name: item.symbol,
        value,
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const topPnl = holdings
    .map((item) => ({
      symbol: item.symbol,
      pnl: Number(item.pnl || 0),
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 6);

  const watchKeys = watchSeries.length
    ? Object.keys(watchSeries[watchSeries.length - 1]).filter((key) => key !== "time")
    : [];

  return (
    <section className="smartcharts-grid">
      <div className="chart-panel">
        <div className="section-head">
          <div>
            <h2>Portfolio P&amp;L Trend</h2>
            <p>Streaming over websocket.</p>
          </div>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={pnlSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece8f8" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#2b0f8a" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-panel">
        <div className="section-head">
          <div>
            <h2>Holdings vs Positions</h2>
            <p>Component breakdown over time.</p>
          </div>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={pnlSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece8f8" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="holdings" stroke="#7f55d9" fill="#d9c8ff" fillOpacity={0.7} />
              <Area type="monotone" dataKey="positions" stroke="#2b0f8a" fill="#bfb0ef" fillOpacity={0.7} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-panel">
        <div className="section-head">
          <div>
            <h2>Allocation Donut</h2>
            <p>Top holdings by market value.</p>
          </div>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                {allocation.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-panel">
        <div className="section-head">
          <div>
            <h2>Top Holding P&amp;L</h2>
            <p>Largest movers right now.</p>
          </div>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topPnl}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece8f8" />
              <XAxis dataKey="symbol" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="pnl" fill="#2b0f8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-panel chart-panel-wide">
        <div className="section-head">
          <div>
            <h2>Watchlist Live Trend</h2>
            <p>Selected symbols from your chip list.</p>
          </div>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={watchSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ece8f8" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {watchKeys.map((key, index) => (
                <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[index % CHART_COLORS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function HistoryTable({ title, subtitle, rows, columns, emptyText, exportName }) {
  return (
    <section className="table-wrap">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => exportRowsToCsv(exportName, rows, columns)} disabled={!rows.length}>
          Export CSV
        </button>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${title}-${row.id || row.orderNumStatus || row.symbol || index}`}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? "-"}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

function loadStoredSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [pnlSeries, setPnlSeries] = useState([]);
  const [watchSeries, setWatchSeries] = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("offline");
  const [refreshing, setRefreshing] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState("");
  const [strategySubmitting, setStrategySubmitting] = useState(false);
  const [strategyResult, setStrategyResult] = useState("");
  const [strategyAutoEnabled, setStrategyAutoEnabled] = useState(false);
  const [strategyAutoRuns, setStrategyAutoRuns] = useState(0);
  const [strategyAutoChecks, setStrategyAutoChecks] = useState(0);
  const [dailyAutoState, setDailyAutoState] = useState(() => loadDailyAutoState());
  const [watchlistDraft, setWatchlistDraft] = useState("");
  const [settings, setSettings] = useState(() => loadStoredSettings());
  const [themeMode, setThemeMode] = useState(() => {
    try { return window.localStorage.getItem(THEME_KEY) || "light"; } catch { return "light"; }
  });
  const [orderForm, setOrderForm] = useState({
    symbol: "NSE:SBIN-EQ",
    qty: 1,
    side: "BUY",
    orderType: "MARKET",
    productType: "INTRADAY",
    limitPrice: 0,
    forceLive: false,
  });
  const [strategyForm, setStrategyForm] = useState({
    symbol: "NSE:SBIN-EQ",
    qty: 1,
    side: "BUY",
    triggerLtp: 900,
    productType: "INTRADAY",
    validity: "DAY",
    forceLive: false,
  });

  const search = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    try { window.localStorage.setItem(THEME_KEY, themeMode); } catch { /* noop */ }
  }, [themeMode]);

  function toggleTheme() {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  }

  useEffect(() => {
    const loginResult = search.get("login");
    if (loginResult === "error") {
      setError(search.get("reason") || "Login failed");
    }

    initialize();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    saveDailyAutoState(dailyAutoState);
  }, [dailyAutoState]);

  useEffect(() => {
    if (dailyAutoState.date !== getTodayKey()) {
      setDailyAutoState({ date: getTodayKey(), count: 0 });
    }
  }, [dailyAutoState]);

  useEffect(() => {
    if (!authenticated) {
      setConnectionStatus("offline");
      return undefined;
    }

    if (!settings.liveUpdatesEnabled) {
      setConnectionStatus("offline");
      return undefined;
    }

    let socket;
    let reconnectTimer;
    let cancelled = false;

    const connect = () => {
      if (cancelled) {
        return;
      }

      setConnectionStatus("connecting");
      const wsBase = API_BASE
        ? API_BASE.replace("http://", "ws://").replace("https://", "wss://")
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
      socket = new WebSocket(`${wsBase}/api/live?symbols=${encodeURIComponent(settings.watchlistSymbols)}`);

      socket.onopen = () => {
        setConnectionStatus("live");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === "error") {
            setError(data.message || "Live update failed");
            return;
          }
          setDashboard(data);
          const rows = data.watchlist?.d || [];
          setWatchlist(rows);

          const timeLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const summary = data.summary || {};
          setPnlSeries((current) => {
            const next = [
              ...current.slice(-39),
              {
                time: timeLabel,
                total: Number(summary.total_pnl || 0),
                holdings: Number(summary.holdings_pnl || 0),
                positions: Number(summary.positions_pnl || 0),
              },
            ];
            return next;
          });

          const watchPoint = { time: timeLabel };
          rows.slice(0, 4).forEach((row) => {
            const key = row.n || row.v?.symbol;
            if (key) {
              watchPoint[key] = Number(row.v?.lp || 0);
            }
          });
          setWatchSeries((current) => [...current.slice(-39), watchPoint]);
        } catch (err) {
          setError(err.message);
        }
      };

      socket.onerror = () => {
        setConnectionStatus("reconnecting");
      };

      socket.onclose = () => {
        if (!cancelled) {
          setConnectionStatus("reconnecting");
          reconnectTimer = window.setTimeout(connect, Number(settings.reconnectSeconds) * 1000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [authenticated, settings.liveUpdatesEnabled, settings.watchlistSymbols, settings.reconnectSeconds]);

  useEffect(() => {
    if (!authenticated || !strategyAutoEnabled) {
      return undefined;
    }

    if (dailyAutoState.count >= Number(settings.strategyDailyCap)) {
      setStrategyAutoEnabled(false);
      setStrategyResult("Daily auto-run cap reached. Auto-run stopped.");
      return undefined;
    }

    if (strategyAutoRuns >= Number(settings.strategyAutoMaxRuns)) {
      setStrategyAutoEnabled(false);
      return undefined;
    }

    const timer = window.setInterval(async () => {
      setStrategyAutoChecks((current) => current + 1);
      try {
        const result = await runStrategy({
          ...strategyForm,
          qty: Number(strategyForm.qty),
          triggerLtp: Number(strategyForm.triggerLtp),
        });

        if (result.triggered) {
          setDailyAutoState((current) => ({ date: getTodayKey(), count: current.count + 1 }));
          setStrategyAutoRuns((current) => {
            const next = current + 1;
            if (next >= Number(settings.strategyAutoMaxRuns)) {
              setStrategyAutoEnabled(false);
            }
            return next;
          });
          setStrategyResult(result.paper_trade ? "Auto strategy triggered in paper mode." : "Auto strategy sent live order.");
          refreshDashboard(true);
        }
      } catch (err) {
        setError(err.message);
        setStrategyAutoEnabled(false);
      }
    }, Number(settings.strategyAutoInterval) * 1000);

    return () => window.clearInterval(timer);
  }, [authenticated, strategyAutoEnabled, strategyForm, settings.strategyAutoInterval, settings.strategyAutoMaxRuns, settings.strategyDailyCap, dailyAutoState.count]);

  async function initialize() {
    try {
      setLoading(true);
      const session = await fetchSession();
      setAuthenticated(Boolean(session.authenticated));
      if (session.authenticated) {
        const data = await fetchDashboard();
        setDashboard(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard(silent = false) {
    try {
      if (!silent) {
        setRefreshing(true);
      }
      const data = await fetchDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) {
        setRefreshing(false);
      }
    }
  }

  async function handleLogin() {
    setError("");
    setAuthenticating(true);
    try {
      const result = await login();
      if (result?.redirected) {
        return;
      }
      await initialize();
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthenticating(false);
    }
  }

  function handleOrderChange(event) {
    const { name, value, type, checked } = event.target;
    setOrderForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleStrategyChange(event) {
    const { name, value, type, checked } = event.target;
    setStrategyForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleSettingsChange(event) {
    const { name, value, type, checked } = event.target;
    setSettings((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleWatchlistDraftChange(event) {
    setWatchlistDraft(event.target.value);
  }

  function addWatchlistSymbol() {
    const nextSymbol = watchlistDraft.trim();
    if (!nextSymbol) {
      return;
    }
    const symbols = normalizeSymbols(settings.watchlistSymbols);
    if (!symbols.includes(nextSymbol)) {
      setSettings((current) => ({
        ...current,
        watchlistSymbols: [...symbols, nextSymbol].join(","),
      }));
    }
    setWatchlistDraft("");
  }

  function removeWatchlistSymbol(symbolToRemove) {
    const nextSymbols = normalizeSymbols(settings.watchlistSymbols).filter((symbol) => symbol !== symbolToRemove);
    setSettings((current) => ({
      ...current,
      watchlistSymbols: nextSymbols.join(","),
    }));
  }

  async function handleOrderSubmit(event) {
    event.preventDefault();
    setOrderResult("");
    setError("");
    setOrderSubmitting(true);
    try {
      const result = await placeOrder({
        ...orderForm,
        qty: Number(orderForm.qty),
        limitPrice: Number(orderForm.limitPrice || 0),
      });
      setOrderResult(result.paper_trade ? "Paper order simulated successfully." : "Live order submitted successfully.");
      await refreshDashboard(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setOrderSubmitting(false);
    }
  }

  async function handleStrategySubmit(event) {
    event.preventDefault();
    setStrategyResult("");
    setError("");
    setStrategySubmitting(true);
    try {
      const result = await runStrategy({
        ...strategyForm,
        qty: Number(strategyForm.qty),
        triggerLtp: Number(strategyForm.triggerLtp),
      });

      if (!result.triggered) {
        setStrategyResult(`No trade sent. Current LTP: ${result.current_ltp}`);
      } else if (result.paper_trade) {
        setStrategyResult("Strategy triggered in paper mode.");
      } else {
        setStrategyResult("Strategy triggered and live order submitted.");
      }

      await refreshDashboard(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setStrategySubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");
    try {
      await logout();
      setAuthenticated(false);
      setDashboard(null);
      setWatchlist([]);
      setOrderResult("");
      setStrategyResult("");
      setConnectionStatus("offline");
      setStrategyAutoEnabled(false);
      setStrategyAutoRuns(0);
      setStrategyAutoChecks(0);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleStrategyAuto() {
    if (!strategyAutoEnabled && dailyAutoState.count >= Number(settings.strategyDailyCap)) {
      setStrategyResult("Daily auto-run cap already reached. Reset tomorrow or lower usage.");
      return;
    }
    setStrategyAutoRuns(0);
    setStrategyAutoChecks(0);
    setStrategyAutoEnabled((current) => !current);
  }

  if (loading) {
    return (
      <div className="login-fullpage">
        <div className="login-card">
          <div className="login-brand-icon">TB</div>
          <h1>TradeBuddy</h1>
          <p>Loading your trading workspace&hellip;</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="login-fullpage">
        <div className="login-card">
          <div className="login-brand-icon">TB</div>
          <h1>TradeBuddy</h1>
          <p>Securely access your FYERS portfolio dashboard.</p>
          <button
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "14px", marginTop: 4 }}
            onClick={handleLogin}
            disabled={authenticating}
          >
            {authenticating ? "Connecting…" : "Login with FYERS"}
          </button>
          {error ? <p className="error-text" style={{ marginTop: 14 }}>{error}</p> : null}
        </div>
      </div>
    );
  }

  const profile = dashboard?.profile?.data || {};
  const funds = dashboard?.funds?.fund_limit?.[0] || {};
  const holdings = dashboard?.holdings?.holdings || [];
  const positions = dashboard?.positions?.netPositions || [];
  const orders = dashboard?.orderbook?.orderBook || dashboard?.orderbook?.orderbook || [];
  const trades = dashboard?.tradebook?.tradeBook || dashboard?.tradebook?.tradebook || [];
  const watchlistSymbols = normalizeSymbols(settings.watchlistSymbols);
  const summary = dashboard?.summary || {};

  const PAGE_TITLES = {
    "/dashboard": "Dashboard",
    "/portfolio": "Portfolio",
    "/markets":   "Markets & Watchlists",
    "/scanner":   "Command Deck",
    "/scanner/execution": "Execution",
    "/scanner/visuals":   "Visuals",
    "/scanner/datasets":  "Datasets",
    "/scanner/filters":   "Filter Lab",
    "/orders":    "Orders & Trades",
    "/strategy":  "Strategy",
    "/settings":  "Settings",
  };
  const pageTitle = PAGE_TITLES[location.pathname] || "Dashboard";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const MAIN_NAV_ITEMS = [
    { to: "/dashboard", label: "Dashboard", Icon: IcoDashboard },
    { to: "/portfolio", label: "Portfolio",  Icon: IcoBriefcase },
    { to: "/markets",   label: "Markets",    Icon: IcoMarkets },
    { to: "/orders",    label: "Orders",     Icon: IcoOrders },
    { to: "/strategy",  label: "Strategy",   Icon: IcoStrategy },
    { to: "/settings",  label: "Settings",   Icon: IcoSettings },
  ];

  const SCANNER_NAV_ITEMS = [
    { to: "/scanner",            label: "Command Deck", Icon: IcoCommand, end: true },
    { to: "/scanner/execution",  label: "Execution",    Icon: IcoTune },
    { to: "/scanner/visuals",    label: "Visuals",      Icon: IcoChart },
    { to: "/scanner/datasets",   label: "Datasets",     Icon: IcoTable },
    { to: "/scanner/filters",    label: "Filter Lab",   Icon: IcoFilter },
  ];

  return (
    <div className={`na-shell${sidebarExpanded ? "" : " sidebar-mini"}`}>
      {/* ── Mini Sidebar ── */}
      <aside className="na-sidebar">
        <div className="na-brand">
          <div className="na-brand-icon">TB</div>
          <div className="na-brand-text">
            <h2>TradeBuddy</h2>
            <p>{profile.name || profile.display_name || "Trader"}</p>
          </div>
        </div>

        <nav className="na-nav">
          <div className="na-nav-section">Main</div>
          {MAIN_NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => `na-nav-item${isActive ? " active" : ""}`}
            >
              <Icon />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
          <div className="na-nav-section">Scanner</div>
          {SCANNER_NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) => `na-nav-item${isActive ? " active" : ""}`}
            >
              <Icon />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="na-sidebar-footer">
          <button className="na-nav-item logout-item" style={{ width: "100%" }} title="Logout" onClick={handleLogout}>
            <IcoLogout />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="na-main">
        {/* Topbar */}
        <header className="na-topbar">
          <button className="topbar-toggle" title="Toggle sidebar" onClick={() => setSidebarExpanded((v) => !v)}>
            <IcoMenu />
          </button>
          <div className="topbar-page-title">
            <h2>{pageTitle}</h2>
          </div>
          <div className="topbar-actions">
            <button className="theme-toggle-btn" title={themeMode === "dark" ? "Switch to light" : "Switch to dark"} onClick={toggleTheme}>
              {themeMode === "dark" ? <IcoSun /> : <IcoMoon />}
            </button>
            <span className={`status-pill status-${connectionStatus}`}>{connectionStatus}</span>
            <button className="btn-secondary" onClick={() => refreshDashboard()} disabled={refreshing}>
              {refreshing ? "…" : "Refresh"}
            </button>
          </div>
        </header>

        {/* Page wrapper */}
        <div className="na-page">
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/dashboard"
            element={(
              <>
                {/* Greeting */}
                <div className="greeting-banner">
                  <div>
                    <h2>{greeting}, {profile.name || profile.display_name || "Trader"}!</h2>
                    <p>Stay updated with your portfolio&rsquo;s performance today.</p>
                  </div>
                  <span className="greeting-tag">Live Market</span>
                </div>

                {/* KPI cards */}
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-icon c-primary"><IcoBalance /></div>
                    <div>
                      <div className="kpi-label">Available Balance</div>
                      <div className="kpi-value">{formatCurrency(funds.equityAmount ?? summary.available_balance ?? 0)}</div>
                      <div className="kpi-sub">Equity segment</div>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-icon c-success"><IcoBriefcase /></div>
                    <div>
                      <div className="kpi-label">Holdings</div>
                      <div className="kpi-value">{holdings.length}</div>
                      <div className="kpi-sub">Long-term positions</div>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-icon c-warning"><IcoPositions /></div>
                    <div>
                      <div className="kpi-label">Open Positions</div>
                      <div className="kpi-value">{positions.length}</div>
                      <div className="kpi-sub">Net positions today</div>
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className={`kpi-icon ${Number(summary.total_pnl ?? 0) >= 0 ? "c-success" : "c-danger"}`}><IcoStrategy /></div>
                    <div>
                      <div className="kpi-label">Total P&amp;L</div>
                      <div className="kpi-value">{formatCurrency(summary.total_pnl ?? 0)}</div>
                      <div className="kpi-sub">Live portfolio pulse</div>
                    </div>
                  </div>
                </div>

                {/* Watchlist */}
                <div className="watchlist-row">
                  {watchlist.map((item) => {
                    const v = item.v || {};
                    const chg = Number(v.chp ?? 0);
                    return (
                      <div className="watch-card" key={item.n || v.symbol || Math.random()}>
                        <div className="sym">{item.n || v.symbol}</div>
                        <div className="ltp">{v.lp ?? "–"}</div>
                        <div className={`chg ${chg >= 0 ? "up" : "dn"}`}>
                          {chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Charts */}
                <SmartChartsBoard pnlSeries={pnlSeries} watchSeries={watchSeries} holdings={holdings} />
              </>
            )}
          />

          <Route
            path="/portfolio"
            element={(
              <>
                <div className="table-panel">
                  <div className="table-panel-head">
                    <div>
                      <h3>Holdings</h3>
                      <p>Live from FYERS snapshot and websocket stream.</p>
                    </div>
                  </div>
                  <table>
                    <thead><tr><th>Symbol</th><th>Qty</th><th>LTP</th><th>P&amp;L</th></tr></thead>
                    <tbody>
                      {holdings.map((item) => (
                        <tr key={item.symbol}>
                          <td><strong>{item.symbol}</strong></td>
                          <td>{item.quantity}</td>
                          <td>{item.ltp}</td>
                          <td style={{ color: Number(item.pnl || 0) >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>{formatCurrency(item.pnl)}</td>
                        </tr>
                      ))}
                      {holdings.length === 0 ? <tr><td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>No holdings available.</td></tr> : null}
                    </tbody>
                  </table>
                </div>

                <div className="table-panel">
                  <div className="table-panel-head">
                    <div>
                      <h3>Positions</h3>
                      <p>Live net positions from FYERS.</p>
                    </div>
                  </div>
                  <table>
                    <thead><tr><th>Symbol</th><th>Qty</th><th>Avg Price</th><th>P&amp;L</th></tr></thead>
                    <tbody>
                      {positions.map((item, idx) => (
                        <tr key={item.symbol || idx}>
                          <td><strong>{item.symbol}</strong></td>
                          <td>{item.netQty}</td>
                          <td>{item.buyAvg || item.sellAvg || "–"}</td>
                          <td style={{ color: Number(item.pl || item.pnl || 0) >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>{formatCurrency(item.pl || item.pnl || 0)}</td>
                        </tr>
                      ))}
                      {positions.length === 0 ? <tr><td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>No open positions.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          />

          <Route
            path="/orders"
            element={(
              <>
                <div className="panel" style={{ maxWidth: 680 }}>
                  <div className="panel-head">
                    <div><h3>Place Order</h3><p>Uses backend paper or live mode safeguards.</p></div>
                  </div>
                  <form className="form-grid" onSubmit={handleOrderSubmit}>
                    <div className="form-row-2">
                      <label>Symbol<input name="symbol" value={orderForm.symbol} onChange={handleOrderChange} /></label>
                      <label>Quantity<input name="qty" type="number" min="1" value={orderForm.qty} onChange={handleOrderChange} /></label>
                    </div>
                    <div className="form-row-2">
                      <label>Side<select name="side" value={orderForm.side} onChange={handleOrderChange}><option>BUY</option><option>SELL</option></select></label>
                      <label>Order Type<select name="orderType" value={orderForm.orderType} onChange={handleOrderChange}><option value="MARKET">MARKET</option><option value="LIMIT">LIMIT</option><option value="SL-M">SL-M</option><option value="SL-L">SL-L</option></select></label>
                    </div>
                    <div className="form-row-2">
                      <label>Product Type<select name="productType" value={orderForm.productType} onChange={handleOrderChange}><option value="INTRADAY">INTRADAY</option><option value="CNC">CNC</option><option value="MARGIN">MARGIN</option></select></label>
                      <label>Limit Price<input name="limitPrice" type="number" step="0.05" value={orderForm.limitPrice} onChange={handleOrderChange} /></label>
                    </div>
                    <label style={{ flexDirection: "row", alignItems: "center", gap: 8, fontWeight: 500 }}>
                      <input name="forceLive" type="checkbox" style={{ width: "auto" }} checked={orderForm.forceLive} onChange={handleOrderChange} />
                      Force live order
                    </label>
                    <div><button type="submit" className="btn-primary" disabled={orderSubmitting}>{orderSubmitting ? "Submitting…" : "Place Order"}</button></div>
                  </form>
                  {orderResult ? <p className="success-text">{orderResult}</p> : null}
                </div>

                <div className="table-panel">
                  <div className="table-panel-head">
                    <div><h3>Order History</h3><p>Latest orderbook entries from FYERS.</p></div>
                    <button className="btn-secondary" type="button" disabled={!orders.length}
                      onClick={() => exportRowsToCsv("order-history.csv", orders, [
                        {key:"symbol",label:"Symbol"},{key:"qty",label:"Qty",exportValue:r=>r.qty??r.orderQty??""},{key:"type",label:"Type",exportValue:r=>r.type??r.orderType??""},{key:"status",label:"Status",exportValue:r=>r.status??r.orderNumStatus??""},{key:"time",label:"Time",exportValue:r=>r.orderDateTime??r.orderValidity??""}
                      ])}>
                      Export CSV
                    </button>
                  </div>
                  <table>
                    <thead><tr><th>Symbol</th><th>Qty</th><th>Type</th><th>Status</th><th>Time</th></tr></thead>
                    <tbody>
                      {orders.map((row, i) => <tr key={row.id||row.orderNumStatus||i}><td><strong>{row.symbol}</strong></td><td>{row.qty??row.orderQty??"-"}</td><td>{row.type??row.orderType??"-"}</td><td>{row.status??row.orderNumStatus??"-"}</td><td>{row.orderDateTime??row.orderValidity??"-"}</td></tr>)}
                      {orders.length===0?<tr><td colSpan="5" style={{textAlign:"center",color:"var(--text-muted)",padding:"24px"}}>No orders available.</td></tr>:null}
                    </tbody>
                  </table>
                </div>

                <div className="table-panel">
                  <div className="table-panel-head">
                    <div><h3>Trade History</h3><p>Latest executed trades from FYERS.</p></div>
                    <button className="btn-secondary" type="button" disabled={!trades.length}
                      onClick={() => exportRowsToCsv("trade-history.csv", trades, [
                        {key:"symbol",label:"Symbol"},{key:"qty",label:"Qty",exportValue:r=>r.tradedQty??r.qty??""},{key:"price",label:"Price",exportValue:r=>r.tradePrice??r.price??""},{key:"side",label:"Side",exportValue:r=>r.side??r.orderSide??""},{key:"time",label:"Time",exportValue:r=>r.tradeDateTime??r.dateTime??""}
                      ])}>
                      Export CSV
                    </button>
                  </div>
                  <table>
                    <thead><tr><th>Symbol</th><th>Qty</th><th>Price</th><th>Side</th><th>Time</th></tr></thead>
                    <tbody>
                      {trades.map((row, i) => <tr key={row.id||i}><td><strong>{row.symbol}</strong></td><td>{row.tradedQty??row.qty??"-"}</td><td>{row.tradePrice??row.price??"-"}</td><td>{row.side??row.orderSide??"-"}</td><td>{row.tradeDateTime??row.dateTime??"-"}</td></tr>)}
                      {trades.length===0?<tr><td colSpan="5" style={{textAlign:"center",color:"var(--text-muted)",padding:"24px"}}>No trades available.</td></tr>:null}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          />

          <Route
            path="/strategy"
            element={(
              <div className="panel" style={{ maxWidth: 680 }}>
                <div className="panel-head">
                  <div><h3>Strategy Controls</h3><p>Run one-shot or auto-run trigger strategy from UI.</p></div>
                </div>
                <form className="form-grid" onSubmit={handleStrategySubmit}>
                  <div className="form-row-2">
                    <label>Symbol<input name="symbol" value={strategyForm.symbol} onChange={handleStrategyChange} /></label>
                    <label>Quantity<input name="qty" type="number" min="1" value={strategyForm.qty} onChange={handleStrategyChange} /></label>
                  </div>
                  <div className="form-row-2">
                    <label>Side<select name="side" value={strategyForm.side} onChange={handleStrategyChange}><option>BUY</option><option>SELL</option></select></label>
                    <label>Trigger LTP<input name="triggerLtp" type="number" step="0.05" value={strategyForm.triggerLtp} onChange={handleStrategyChange} /></label>
                  </div>
                  <div className="form-row-2">
                    <label>Product Type<select name="productType" value={strategyForm.productType} onChange={handleStrategyChange}><option value="INTRADAY">INTRADAY</option><option value="CNC">CNC</option><option value="MARGIN">MARGIN</option></select></label>
                    <label>Validity<select name="validity" value={strategyForm.validity} onChange={handleStrategyChange}><option value="DAY">DAY</option><option value="IOC">IOC</option></select></label>
                  </div>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: 8, fontWeight: 500 }}>
                    <input name="forceLive" type="checkbox" style={{ width: "auto" }} checked={strategyForm.forceLive} onChange={handleStrategyChange} />
                    Force live strategy order
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" className="btn-primary" disabled={strategySubmitting}>{strategySubmitting ? "Running…" : "Run Strategy"}</button>
                    <button type="button" className={strategyAutoEnabled ? "btn-danger" : "btn-success"} onClick={toggleStrategyAuto}>
                      {strategyAutoEnabled ? "Stop Auto" : "Start Auto"}
                    </button>
                  </div>
                </form>
                <p className="strategy-status">
                  Auto: {strategyAutoEnabled ? "active" : "idle"} &nbsp;&bull;&nbsp; Checks: {strategyAutoChecks} &nbsp;&bull;&nbsp; Triggers: {strategyAutoRuns} &nbsp;&bull;&nbsp; Daily cap: {dailyAutoState.count}/{settings.strategyDailyCap}
                </p>
                {strategyResult ? <p className="success-text">{strategyResult}</p> : null}
              </div>
            )}
          />

          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/scanner" element={<ScannerLayout />}>
            <Route index element={<ScannerCommandDeck />} />
            <Route path="execution" element={<ScannerExecution />} />
            <Route path="visuals" element={<ScannerVisuals />} />
            <Route path="datasets" element={<ScannerDatasets />} />
            <Route path="filters" element={<ScannerFilterLab />} />
          </Route>

          <Route
            path="/settings"
            element={(
              <div className="panel">
                <div className="panel-head">
                  <div><h3>Workspace Settings</h3><p>Persisted in your browser.</p></div>
                </div>
                <div className="form-grid">
                  <label>
                    Add Watchlist Symbol
                    <div className="chip-input-row">
                      <input value={watchlistDraft} onChange={handleWatchlistDraftChange} placeholder="e.g. NSE:SBIN-EQ" />
                      <button type="button" className="btn-primary" onClick={addWatchlistSymbol}>Add</button>
                    </div>
                  </label>
                  <div className="chip-list">
                    {watchlistSymbols.map((s) => (
                      <button key={s} type="button" className="chip" onClick={() => removeWatchlistSymbol(s)}>{s} ×</button>
                    ))}
                  </div>
                  <div className="form-row-2">
                    <label>Reconnect Seconds<input name="reconnectSeconds" type="number" min="1" value={settings.reconnectSeconds} onChange={handleSettingsChange} /></label>
                    <label>Auto Strategy Interval (s)<input name="strategyAutoInterval" type="number" min="5" value={settings.strategyAutoInterval} onChange={handleSettingsChange} /></label>
                  </div>
                  <div className="form-row-2">
                    <label>Max Auto Runs<input name="strategyAutoMaxRuns" type="number" min="1" value={settings.strategyAutoMaxRuns} onChange={handleSettingsChange} /></label>
                    <label>Daily Strategy Cap<input name="strategyDailyCap" type="number" min="1" value={settings.strategyDailyCap} onChange={handleSettingsChange} /></label>
                  </div>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: 8, fontWeight: 500 }}>
                    <input name="liveUpdatesEnabled" type="checkbox" style={{ width: "auto" }} checked={settings.liveUpdatesEnabled} onChange={handleSettingsChange} />
                    Enable live websocket updates
                  </label>
                </div>
              </div>
            )}
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>

        {error ? <p className="error-bar">{error}</p> : null}
        </div>{/* end na-page */}
      </main>
    </div>
  );
}
