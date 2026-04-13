import { ResponsiveContainer, LineChart, Line } from "recharts";
import { useScannerContext } from "./ScannerContext";
import {
  TAB_CONFIG,
  ScannerDataTable,
  fmtProb,
  fmtNum,
  fmtSignedPct,
  signalClass,
  buildLiveProfile,
} from "./ScannerShared";

export default function ScannerDatasets() {
  const { activeTab, setActiveTab, tabRows, liveRowsToShow, liveHighlights, datasets, dataSource } = useScannerContext();

  return (
    <div className="scan-tabs-panel">
      <div className="scan-tabs-head">
        <div className="sth-overline">Scanner outputs</div>
        <h3>Ranked datasets</h3>
        <p>Explore live scanner output, conviction buckets, breakouts, sector rotation, and API-fed dataset views.</p>
      </div>
      <div className="scan-tab-bar">
        {TAB_CONFIG.map(([key, label]) => (
          <button
            key={key}
            className={`scan-tab-btn${activeTab === key ? " active" : ""}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="scan-tab-content">
        {activeTab === "liveScanner" ? (
          <>
            <div className="scan-live-highlights">
              {liveHighlights.map((row) => (
                <div className="scan-highlight-card" key={row.Ticker || Math.random()}>
                  <div className="hc-top">
                    <span className="hc-ticker">{row.Ticker}</span>
                    <span className={`hc-signal ${signalClass(row.Signal)}`}>{row.Signal || "N/A"}</span>
                  </div>
                  <div className="hc-value">{fmtProb(row.Combined_AI_Prob ?? row.Intraday_AI_Prob)}</div>
                  <div className="hc-meta">
                    Momentum {fmtNum(row.IntradayMomentumScore)} &bull; Change {fmtSignedPct(row["Change_%"])}
                  </div>
                  <div style={{ height: 40, marginTop: 8 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={buildLiveProfile(row)}>
                        <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
            <ScannerDataTable title="Live scanner feed" rows={liveRowsToShow} emptyMessage="No live market data available." />
          </>
        ) : (
          <ScannerDataTable
            title={TAB_CONFIG.find(([k]) => k === activeTab)?.[1] || "Dataset"}
            rows={tabRows}
            emptyMessage="No data available for this tab."
          />
        )}
      </div>
    </div>
  );
}
