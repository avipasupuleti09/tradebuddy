import { useCallback, useEffect, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from "lightweight-charts";
import {
  searchSymbols,
  fetchQuotes,
  fetchHistory,
  fetchWatchlists,
  createWatchlist,
  deleteWatchlist,
  addSymbolToWatchlist,
  removeSymbolFromWatchlist,
} from "./api";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function formatNum(v) {
  if (v == null) return "-";
  return Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}


/* ─── All time intervals, grouped like FYERS ──────────────────────────────── */
const ALL_INTERVALS = [
  {
    category: "SECONDS",
    items: [
      { value: "S5", label: "5 seconds" },
      { value: "S10", label: "10 seconds" },
      { value: "S15", label: "15 seconds" },
      { value: "S30", label: "30 seconds" },
      { value: "S45", label: "45 seconds" },
    ],
  },
  {
    category: "MINUTES",
    items: [
      { value: "1", label: "1 minute" },
      { value: "2", label: "2 minutes" },
      { value: "3", label: "3 minutes" },
      { value: "5", label: "5 minutes" },
      { value: "10", label: "10 minutes" },
      { value: "15", label: "15 minutes" },
      { value: "20", label: "20 minutes" },
      { value: "30", label: "30 minutes" },
      { value: "45", label: "45 minutes" },
      { value: "75", label: "75 minutes" },
    ],
  },
  {
    category: "HOURS",
    items: [
      { value: "60", label: "1 hour" },
      { value: "120", label: "2 hours" },
      { value: "180", label: "3 hours" },
      { value: "240", label: "4 hours" },
    ],
  },
  {
    category: "DAYS",
    items: [
      { value: "D", label: "1 day" },
    ],
  },
];

/** Flat ordered list of all interval values for sorting bookmarks ascending */
const INTERVAL_ORDER = ALL_INTERVALS.flatMap((g) => g.items.map((i) => i.value));

function sortBookmarks(bookmarks) {
  return [...bookmarks].sort((a, b) => INTERVAL_ORDER.indexOf(a) - INTERVAL_ORDER.indexOf(b));
}

const DEFAULT_BOOKMARKS = ["1", "5", "10", "30", "60", "D"];
const BOOKMARK_KEY = "tradebuddy_interval_bookmarks";

function loadBookmarks() {
  try {
    const saved = localStorage.getItem(BOOKMARK_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return DEFAULT_BOOKMARKS;
}

function saveBookmarks(bookmarks) {
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
}

/** Short label for the top bar buttons */
function shortLabel(value) {
  if (value === "D") return "D";
  if (value.startsWith("S")) return `${value.slice(1)}s`;
  const n = parseInt(value, 10);
  if (n >= 60) return `${n / 60}h`;
  return `${n}m`;
}

const DAYS_OPTIONS = [
  { days: 1, label: "1d" },
  { days: 5, label: "5d" },
  { days: 30, label: "1m" },
  { days: 90, label: "3m" },
  { days: 180, label: "6m" },
  { days: 365, label: "1y" },
  { days: 1825, label: "5y" },
  { days: 3650, label: "10y" },
  { days: 7300, label: "All" },
];

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function MarketsPage() {
  // Watchlists state
  const [watchlists, setWatchlists] = useState({});
  const [activeList, setActiveList] = useState(null);
  const [newListName, setNewListName] = useState("");

  // Symbol search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addToList, setAddToList] = useState(null); // which list a search result should be added to

  // Quotes for active watchlist
  const [quotes, setQuotes] = useState({});
  const quotesTimer = useRef(null);

  // selected row for chart
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  // Chart state
  const [chartSymbol, setChartSymbol] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [resolution, setResolution] = useState("5");
  const [days, setDays] = useState(5);
  const [logScale, setLogScale] = useState(false);
  const [percentScale, setPercentScale] = useState(false);
  const [autoScale, setAutoScale] = useState(true);

  // Interval bookmarks & dropdown
  const [bookmarkedIntervals, setBookmarkedIntervals] = useState(() => sortBookmarks(loadBookmarks()));
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false);
  const intervalDropdownRef = useRef(null);

  const [error, setError] = useState("");

  /* ── Load watchlists on mount ── */
  useEffect(() => {
    loadWatchlists();
  }, []);

  /* ── Close interval dropdown on outside click ── */
  useEffect(() => {
    function handleClickOutside(e) {
      if (intervalDropdownRef.current && !intervalDropdownRef.current.contains(e.target)) {
        setShowIntervalDropdown(false);
      }
    }
    if (showIntervalDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showIntervalDropdown]);

  function toggleBookmark(value) {
    setBookmarkedIntervals((prev) => {
      const next = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value];
      const sorted = sortBookmarks(next);
      saveBookmarks(sorted);
      return sorted;
    });
  }

  async function loadWatchlists() {
    try {
      const data = await fetchWatchlists();
      setWatchlists(data.watchlists || {});
      // Auto-select first list if nothing selected
      const keys = Object.keys(data.watchlists || {});
      if (keys.length && !activeList) {
        setActiveList(keys[0]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  /* ── Live quotes polling for active watchlist ── */
  useEffect(() => {
    if (quotesTimer.current) clearInterval(quotesTimer.current);
    if (!activeList || !watchlists[activeList]?.length) {
      setQuotes({});
      return;
    }

    const symbols = watchlists[activeList];
    const poll = async () => {
      try {
        const data = await fetchQuotes(symbols);
        const map = {};
        (data.d || []).forEach((item) => {
          const sym = item.n || item.v?.symbol;
          if (sym) map[sym] = item.v || {};
        });
        setQuotes(map);
      } catch {
        /* silently retry */
      }
    };

    poll();
    quotesTimer.current = setInterval(poll, 5000);
    return () => clearInterval(quotesTimer.current);
  }, [activeList, watchlists]);

  /* ── Debounced symbol search ── */
  const doSearch = useCallback(
    debounce(async (q) => {
      if (!q || q.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const data = await searchSymbols(q);
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    doSearch(searchQuery);
  }, [searchQuery, doSearch]);

  /* ── Chart loading ── */
  const [ohlcInfo, setOhlcInfo] = useState(null); // crosshair hover info
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const tickTimerRef = useRef(null);

  useEffect(() => {
    if (!chartSymbol) return;
    let cancelled = false;
    setChartLoading(true);
    fetchHistory(chartSymbol, resolution, days)
      .then((data) => {
        if (cancelled) return;
        const raw = data.candles || [];
        // lightweight-charts needs {time, open, high, low, close}
        const candles = raw.map((c) => ({
          time: c[0], // unix seconds
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5],
        }));
        setChartData(candles);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => { cancelled = true; };
  }, [chartSymbol, resolution, days]);

  /* ── Render lightweight-charts candlestick ── */
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    // Clean up previous chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 480,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#2a3547",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: { price: true, time: true }, mouseWheel: true, pinch: true },
      rightPriceScale: {
        borderColor: "#e0e0e0",
        autoScale: true,
        mode: 0, // Normal
      },
      timeScale: {
        borderColor: "#e0e0e0",
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartInstanceRef.current = chart;

    // --- Candlestick series ---
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#13deb9",
      downColor: "#fa896b",
      borderUpColor: "#13deb9",
      borderDownColor: "#fa896b",
      wickUpColor: "#13deb9",
      wickDownColor: "#fa896b",
    });
    candleSeriesRef.current = candleSeries;
    candleSeries.setData(chartData.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })));

    // --- Volume histogram ---
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#c8d6f7",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;
    volumeSeries.setData(chartData.map((c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(19,222,185,0.3)" : "rgba(250,137,107,0.3)",
    })));

    // --- Crosshair OHLC info ---
    const lastCandle = chartData[chartData.length - 1];
    setOhlcInfo(lastCandle);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setOhlcInfo(lastCandle);
        return;
      }
      const d = param.seriesData.get(candleSeries);
      if (d) setOhlcInfo(d);
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    ro.observe(container);

    chart.timeScale().fitContent();

    return () => {
      ro.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [chartData]);

  /* ── Live tick-by-tick updates (poll every 1s) ── */
  useEffect(() => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    if (!chartSymbol || !candleSeriesRef.current) return;

    const resSeconds = resolution === "D" ? 86400
      : resolution.startsWith("S") ? parseInt(resolution.slice(1), 10)
      : parseInt(resolution, 10) * 60;

    const pollTick = async () => {
      try {
        const data = await fetchQuotes([chartSymbol]);
        const items = data.d || [];
        if (!items.length) return;
        const q = items[0].v || {};
        const ltp = q.lp;
        if (ltp == null) return;

        // Compute the candle time bucket for the current tick
        const nowSec = Math.floor(Date.now() / 1000);
        const candleTime = Math.floor(nowSec / resSeconds) * resSeconds;

        // Update candlestick: .update() will either update current bar or add new one
        const tickCandle = {
          time: candleTime,
          open: q.open_price || ltp,
          high: q.high_price || ltp,
          low: q.low_price || ltp,
          close: ltp,
        };
        candleSeriesRef.current.update(tickCandle);

        // Update volume
        volumeSeriesRef.current.update({
          time: candleTime,
          value: q.volume || 0,
          color: ltp >= (q.open_price || ltp) ? "rgba(19,222,185,0.3)" : "rgba(250,137,107,0.3)",
        });

        // Update OHLC header with live values
        setOhlcInfo((prev) => ({
          ...prev,
          open: q.open_price || prev?.open,
          high: q.high_price || prev?.high,
          low: q.low_price || prev?.low,
          close: ltp,
        }));
      } catch {
        /* silently skip tick errors */
      }
    };

    pollTick();
    tickTimerRef.current = setInterval(pollTick, 1000);
    return () => clearInterval(tickTimerRef.current);
  }, [chartSymbol, resolution, chartData]);

  /* ── Handlers ── */
  async function handleCreateList() {
    const name = newListName.trim();
    if (!name) return;
    try {
      const data = await createWatchlist(name);
      setWatchlists(data.watchlists || {});
      setActiveList(name);
      setNewListName("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteList(name) {
    try {
      const data = await deleteWatchlist(name);
      setWatchlists(data.watchlists || {});
      if (activeList === name) {
        const keys = Object.keys(data.watchlists || {});
        setActiveList(keys[0] || null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddSymbol(symbol) {
    const target = addToList || activeList;
    if (!target) return;
    try {
      await addSymbolToWatchlist(target, symbol);
      await loadWatchlists();
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveSymbol(listName, symbol) {
    try {
      await removeSymbolFromWatchlist(listName, symbol);
      await loadWatchlists();
    } catch (err) {
      setError(err.message);
    }
  }

  const listNames = Object.keys(watchlists);
  const activeSymbols = activeList ? (watchlists[activeList] || []) : [];

  function handleRowClick(symbol) {
    setSelectedSymbol(symbol);
    setChartSymbol(symbol);
  }

  return (
    <div className="markets-page">
      {error && <p className="error-bar">{error}</p>}

      <div className="markets-layout">
        {/* ─── Left: FYERS-style compact watchlist ─── */}
        <div className="fwl-panel">
          {/* Header: watchlist selector + create */}
          <div className="fwl-header">
            <div className="fwl-select-row">
              <select
                className="fwl-select"
                value={activeList || ""}
                onChange={(e) => setActiveList(e.target.value)}
              >
                {listNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {activeList && (
                <button className="fwl-del-btn" title="Delete this watchlist" onClick={() => handleDeleteList(activeList)}>×</button>
              )}
              <button className="fwl-add-btn" title="Create new watchlist" onClick={() => {
                const name = newListName.trim() || prompt("Watchlist name:");
                if (name) { setNewListName(name); setTimeout(handleCreateList, 0); }
              }}>+</button>
            </div>
            <div className="fwl-create-inline">
              <input
                placeholder="New list name…"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
              />
              <button className="btn-primary btn-xs" onClick={handleCreateList} disabled={!newListName.trim()}>Create</button>
            </div>
          </div>

          {/* Column headers */}
          <div className="fwl-col-head">
            <span className="fwl-col-sym">Symbol</span>
            <span className="fwl-col-num">Last</span>
            <span className="fwl-col-num">Chg</span>
            <span className="fwl-col-num">Chg%</span>
          </div>

          {/* Rows */}
          <div className="fwl-rows">
            {activeSymbols.map((symbol) => {
              const q = quotes[symbol] || {};
              const chg = Number(q.ch || 0);
              const chgClass = chg > 0 ? "fwl-green" : chg < 0 ? "fwl-red" : "";
              const isSelected = selectedSymbol === symbol;
              return (
                <div
                  key={symbol}
                  className={`fwl-row${isSelected ? " fwl-row-selected" : ""}`}
                  onClick={() => handleRowClick(symbol)}
                >
                  <span className="fwl-row-sym">
                    {symbol.replace("NSE:", "")}
                    <span className="fwl-dot">●</span>
                  </span>
                  <span className="fwl-row-num">{formatNum(q.lp)}</span>
                  <span className={`fwl-row-num ${chgClass}`}>{formatNum(q.ch)}</span>
                  <span className={`fwl-row-num ${chgClass}`}>{formatNum(q.chp)}%</span>
                  <button
                    className="fwl-row-del"
                    title="Remove from watchlist"
                    onClick={(e) => { e.stopPropagation(); handleRemoveSymbol(activeList, symbol); }}
                  >×</button>
                </div>
              );
            })}
            {activeSymbols.length === 0 && (
              <p className="fwl-empty-msg">No symbols. Search below to add.</p>
            )}
          </div>

          {/* Search */}
          <div className="fwl-search">
            <input
              className="fwl-search-input"
              placeholder="Search NSE symbol or company…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchLoading && <p className="fwl-hint">Searching…</p>}
            {searchResults.length > 0 && (
              <div className="fwl-search-results">
                {searchResults.map((item) => (
                  <div key={item.symbol} className="fwl-sr-row" onClick={() => handleAddSymbol(item.symbol)}>
                    <div className="fwl-sr-info">
                      <span className="fwl-sr-sym">{item.symbol.replace("NSE:", "")}</span>
                      <span className="fwl-sr-name">{item.name}</span>
                    </div>
                    <span className="fwl-sr-plus">+</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: Chart ─── */}
        <div className="wl-main">
          {chartSymbol ? (
            <div className="panel chart-panel-full">
              {/* Top bar: bookmarked resolution buttons + dropdown like FYERS */}
              <div className="chart-top-bar">
                <span className="chart-symbol-label">{chartSymbol.replace("NSE:", "")}</span>
                <div className="chart-res-btns">
                  {bookmarkedIntervals.map((r) => (
                    <button
                      key={r}
                      className={`chart-period-btn${resolution === r ? " active" : ""}`}
                      onClick={() => setResolution(r)}
                    >
                      {shortLabel(r)}
                    </button>
                  ))}
                  {/* Dropdown toggle */}
                  <div className="interval-dropdown-wrap" ref={intervalDropdownRef}>
                    <button
                      className={`chart-period-btn interval-dropdown-toggle${showIntervalDropdown ? " active" : ""}`}
                      onClick={() => setShowIntervalDropdown((v) => !v)}
                      title="All intervals"
                    >
                      &#9662;
                    </button>
                    {showIntervalDropdown && (
                      <div className="interval-dropdown">
                        {ALL_INTERVALS.map((group) => (
                          <div key={group.category} className="interval-group">
                            <div className="interval-group-header">{group.category}</div>
                            {group.items.map((item) => {
                              const isBookmarked = bookmarkedIntervals.includes(item.value);
                              const isActive = resolution === item.value;
                              return (
                                <div
                                  key={item.value}
                                  className={`interval-item${isActive ? " interval-item-active" : ""}`}
                                  onClick={() => { setResolution(item.value); setShowIntervalDropdown(false); }}
                                >
                                  <span className="interval-item-label">{item.label}</span>
                                  <span
                                    className={`interval-star${isBookmarked ? " interval-star-active" : ""}`}
                                    onClick={(e) => { e.stopPropagation(); toggleBookmark(item.value); }}
                                    title={isBookmarked ? "Remove from top bar" : "Add to top bar"}
                                  >
                                    {isBookmarked ? "\u2605" : "\u2606"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn-secondary btn-sm chart-close-btn" onClick={() => { setChartSymbol(null); setSelectedSymbol(null); setOhlcInfo(null); }}>×</button>
              </div>

              {/* OHLC header like FYERS */}
              <div className="chart-ohlc-header">
                <div className="chart-title-row">
                  <span className="chart-symbol-name">{chartSymbol.replace("NSE:", "")} · {resolution === "D" ? "D" : resolution} · NSE</span>
                  {ohlcInfo && (
                    <span className="chart-ohlc-vals">
                      O<b>{formatNum(ohlcInfo.open)}</b>{" "}
                      H<b>{formatNum(ohlcInfo.high)}</b>{" "}
                      L<b>{formatNum(ohlcInfo.low)}</b>{" "}
                      C<b>{formatNum(ohlcInfo.close)}</b>
                      {ohlcInfo.close != null && ohlcInfo.open != null && (
                        <span className={ohlcInfo.close >= ohlcInfo.open ? "fwl-green" : "fwl-red"}>
                          {" "}{(ohlcInfo.close - ohlcInfo.open) >= 0 ? "+" : ""}{formatNum(ohlcInfo.close - ohlcInfo.open)}{" "}
                          ({formatNum(((ohlcInfo.close - ohlcInfo.open) / ohlcInfo.open) * 100)}%)
                        </span>
                      )}
                    </span>
                  )}
                </div>

              </div>

              {/* Chart container */}
              <div className="chart-box">
                {chartLoading ? (
                  <p className="fwl-hint" style={{ padding: 40 }}>Loading chart…</p>
                ) : chartData.length === 0 ? (
                  <p className="fwl-hint" style={{ padding: 40 }}>No data for this range.</p>
                ) : (
                  <div ref={chartContainerRef} className="lw-chart-container" />
                )}
              </div>

              {/* Bottom bar: period + scale controls like FYERS */}
              <div className="chart-bottom-bar">
                <div className="chart-period-btns">
                  {DAYS_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      className={`chart-period-btn${days === opt.days ? " active" : ""}`}
                      onClick={() => {
                        // Auto-switch to daily for long ranges (FYERS intraday limit ~100 days)
                        if (opt.days > 100 && resolution !== "D") {
                          setResolution("D");
                        }
                        setDays(opt.days);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="chart-scale-btns">
                  <span className="chart-time-display">{new Date().toLocaleTimeString("en-IN", { hour12: false })} UTC+5:30</span>
                  <button
                    className={`chart-period-btn${percentScale ? " active" : ""}`}
                    title="Percentage scale"
                    onClick={() => {
                      setPercentScale(!percentScale);
                      if (chartInstanceRef.current) {
                        chartInstanceRef.current.priceScale("right").applyOptions({ mode: !percentScale ? 1 : 0 });
                      }
                    }}
                  >%</button>
                  <button
                    className={`chart-period-btn${logScale ? " active" : ""}`}
                    title="Logarithmic scale"
                    onClick={() => {
                      setLogScale(!logScale);
                      if (chartInstanceRef.current) {
                        chartInstanceRef.current.priceScale("right").applyOptions({ mode: !logScale ? 2 : 0 });
                      }
                    }}
                  >log</button>
                  <button
                    className={`chart-period-btn${autoScale ? " active" : ""}`}
                    title="Auto-fit price scale"
                    onClick={() => {
                      setAutoScale(!autoScale);
                      if (chartInstanceRef.current) {
                        chartInstanceRef.current.priceScale("right").applyOptions({ autoScale: !autoScale });
                      }
                    }}
                  >auto</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ fontSize: 16 }}>Click on a symbol to view its live chart</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
