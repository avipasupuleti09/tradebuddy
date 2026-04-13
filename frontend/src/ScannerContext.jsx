import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getScannerDashboard, runScannerScan, getScannerLive } from "./api";
import {
  buildScanRequest,
  pickLeadRow,
  fmtPctTotal,
  buildSparklineData,
  seriesFromRows,
  firstNumericSeries,
  sectorCompositeSeries,
  topSectorSignals,
  IcRadar,
  IcBolt,
  IcTrend,
  IcHub,
} from "./ScannerShared";

const ScannerCtx = createContext(null);
export const useScannerContext = () => useContext(ScannerCtx);

export function ScannerProvider({ children }) {
  const [dashboard, setDashboard] = useState(null);
  const [liveData, setLiveData] = useState([]);
  const [activeTab, setActiveTab] = useState("liveScanner");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [loadStartTime, setLoadStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [dataSource, setDataSource] = useState("hybrid");
  const [liveFeed, setLiveFeed] = useState(false);
  const [liveInterval, setLiveInterval] = useState(60);
  const [liveRows, setLiveRows] = useState(25);
  const [filters, setFilters] = useState({ sector: "All", signal: "All", minAi: 0, minRs: 1 });
  const [symbolInput, setSymbolInput] = useState("");
  const [sectorOverridesInput, setSectorOverridesInput] = useState("");
  const [deliveryOverridesInput, setDeliveryOverridesInput] = useState("");
  const [activeScanRequest, setActiveScanRequest] = useState(null);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => { void refreshDashboard(); }, []);

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadStartTime) { setElapsed(0); return; }
    const tick = window.setInterval(() => setElapsed(Math.floor((Date.now() - loadStartTime) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [loadStartTime]);

  // ── Live polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (dataSource === "workbook") return undefined;
    if (activeTab !== "liveScanner" && dataSource !== "live") return undefined;
    void refreshLive();
    if (!liveFeed) return undefined;
    const timer = window.setInterval(() => { void refreshLive(); }, liveInterval * 1000);
    return () => window.clearInterval(timer);
  }, [activeTab, activeScanRequest, dataSource, liveFeed, liveInterval, liveRows]);

  async function refreshDashboard() {
    try {
      setLoading(true);
      setLoadStartTime(Date.now());
      setError("");
      const payload = await getScannerDashboard(300);
      setDashboard(payload);
    } catch (err) {
      setError(err.message || "Failed to load scanner dashboard");
    } finally {
      setLoading(false);
      setLoadStartTime(null);
    }
  }

  async function refreshLive() {
    try {
      const payload = await getScannerLive(liveRows, activeScanRequest);
      setLiveData(payload.rows || []);
    } catch (err) {
      setError(err.message || "Failed to load live data");
    }
  }

  async function handleRunScan() {
    try {
      setScanning(true);
      setLoadStartTime(Date.now());
      setError("");
      const requestPayload = buildScanRequest(symbolInput, sectorOverridesInput, deliveryOverridesInput);
      const payload = await runScannerScan(300, requestPayload);
      setActiveScanRequest(requestPayload);
      setDashboard(payload);
    } catch (err) {
      setError(err.message || "Failed to run scan");
    } finally {
      setScanning(false);
      setLoadStartTime(null);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const datasets = dashboard?.datasets || {};
  const overview = dashboard?.overview || {};
  const workbookAvailable = dashboard?.meta?.workbookAvailable;
  const allRanked = datasets.allRanked || [];
  const customUniverseCount = activeScanRequest?.watchlistSymbols?.length || 0;

  const filteredRows = allRanked.filter((row) => {
    if (filters.sector !== "All" && row.Sector !== filters.sector) return false;
    if (filters.signal !== "All" && row.Signal !== filters.signal) return false;
    if ((row.RS_rating_1_100 ?? 0) < filters.minRs) return false;
    if ((row.AI_Prob ?? 0) < filters.minAi) return false;
    return true;
  });

  const liveRowsToShow = dataSource === "workbook" ? (datasets.liveMarket || []) : liveData;
  const tabRows = activeTab === "liveScanner" ? liveRowsToShow : (datasets[activeTab] || []);
  const sectors = ["All", ...Array.from(new Set(allRanked.map((r) => r.Sector).filter(Boolean))).sort()];
  const filteredDisplayRows = dataSource === "live" ? liveRowsToShow : filteredRows;
  const liveHighlights = (liveRowsToShow || []).slice(0, 3);

  const topMovers = [
    pickLeadRow(datasets.topGainers, "Top gainer", "success"),
    pickLeadRow(datasets.topLosers, "Top loser", "danger"),
    pickLeadRow(datasets.aiPicks, "Lead AI pick", "secondary"),
  ].filter(Boolean);

  const pulseStrip = [
    { label: "Universe", value: `${overview.totalScanned ?? 0} names` },
    { label: "Strong buy", value: `${overview.strongBuy ?? 0}` },
    { label: "AI picks", value: `${overview.aiPicks ?? 0}` },
    { label: customUniverseCount ? "Custom list" : "Best sector", value: customUniverseCount ? `${customUniverseCount} symbols` : (overview.bestSector ?? "-") },
  ];

  const statusCards = [
    { label: "Active universe", value: overview.totalScanned ?? 0, sub: "symbols scored in the current run" },
    { label: "Live regime", value: liveFeed ? "Streaming" : "Snapshot", sub: `refresh cadence ${liveInterval}s` },
    { label: "Preferred source", value: dataSource === "workbook" ? "Snapshot" : dataSource === "live" ? "Live" : "Hybrid", sub: customUniverseCount ? "custom universe active" : (workbookAvailable ? "API snapshot ready" : "API snapshot pending") },
  ];

  const kpiItems = [
    { label: "Total scanned", value: overview.totalScanned ?? 0, sub: "latest ranked universe", tone: "primary", Icon: IcRadar, trendLabel: `${overview.strongBuy ?? 0} high-conviction names`, sparkData: buildSparklineData([overview.strongBuy ?? 0, overview.buy ?? 0, overview.hold ?? 0, overview.sell ?? 0, overview.avoid ?? 0]) },
    { label: "Strong buy", value: overview.strongBuy ?? 0, sub: "highest conviction signals", tone: "success", Icon: IcTrend, trendLabel: `${fmtPctTotal(overview.strongBuy, overview.totalScanned)} of universe`, sparkData: seriesFromRows(datasets.sectorSummary, "StrongBuy") },
    { label: "Buy", value: overview.buy ?? 0, sub: "positive momentum setups", tone: "primary", Icon: IcRadar, trendLabel: `${fmtPctTotal(overview.buy, overview.totalScanned)} participation`, sparkData: seriesFromRows(datasets.sectorSummary, "Buy") },
    { label: "Sell", value: overview.sell ?? 0, sub: "distribution or weakness", tone: "error", Icon: IcBolt, trendLabel: `${(overview.avoid ?? 0) + (overview.sell ?? 0)} weak signals`, sparkData: seriesFromRows(datasets.sectorSummary, "Sell") },
    { label: "AI picks", value: overview.aiPicks ?? 0, sub: "model-selected names", tone: "secondary", Icon: IcHub, trendLabel: `${Math.min((datasets.aiPicks || []).length, 5)} names highlighted`, sparkData: seriesFromRows(datasets.aiPicks, "AI_Prob") },
    { label: "Accumulation", value: overview.accumulation ?? 0, sub: "money-flow support", tone: "success", Icon: IcTrend, trendLabel: `${fmtPctTotal(overview.accumulation, overview.totalScanned)} showing inflow`, sparkData: firstNumericSeries(datasets.accumulation, ["AI_Prob", "RS_rating_1_100", "DayChange_%"]) },
    { label: "Top sector", value: overview.bestSector ?? "-", sub: "current leadership group", tone: "warning", Icon: IcRadar, trendLabel: `${topSectorSignals(datasets.sectorSummary, overview.bestSector)} positive signals`, sparkData: sectorCompositeSeries(datasets.sectorSummary) },
  ];

  const ctx = {
    dashboard, liveData, activeTab, setActiveTab,
    loading, scanning, error,
    loadStartTime, elapsed,
    dataSource, setDataSource,
    liveFeed, setLiveFeed,
    liveInterval, setLiveInterval,
    liveRows, setLiveRows,
    filters, setFilters,
    symbolInput, setSymbolInput,
    sectorOverridesInput, setSectorOverridesInput,
    deliveryOverridesInput, setDeliveryOverridesInput,
    activeScanRequest, setActiveScanRequest,
    refreshDashboard, handleRunScan,
    datasets, overview, workbookAvailable, allRanked, customUniverseCount,
    filteredRows, liveRowsToShow, tabRows, sectors, filteredDisplayRows,
    liveHighlights, topMovers, pulseStrip, statusCards, kpiItems,
  };

  return <ScannerCtx.Provider value={ctx}>{children}</ScannerCtx.Provider>;
}
