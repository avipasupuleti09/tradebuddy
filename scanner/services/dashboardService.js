import config from './config.js'
import { runFullScan } from './scannerService.js'

const datasetSheetMap = {
  allRanked: 'All_Ranked',
  strongBuy: 'Strong_Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  avoid: 'Avoid',
  breakout52w: 'Breakout_52W',
  volBreakout: 'Vol_Breakout',
  accumulation: 'Accumulation',
  aiPicks: 'AI_Picks',
  topGainers: 'Top_Gainers',
  topLosers: 'Top_Losers',
  sectorLeaderboard: 'Sector_Leaderboard',
  sectorSummary: 'Sector_Summary',
  sectorRotation: 'Sector_Rotation',
  marketBreadth: 'Market_Breadth',
  aiPortfolio: 'AI_Portfolio',
  liveMarket: 'Live_Market',
  errors: 'Errors',
}

function sliceRows(rows, limit) {
  if (!Array.isArray(rows)) return []
  if (!Number.isFinite(limit) || limit <= 0) return rows
  return rows.slice(0, limit)
}

function buildOverview(datasets) {
  const allRanked = datasets.allRanked || []
  const sectorSummary = datasets.sectorSummary || []
  const bestSector = sectorSummary.find((row) => isKnownSector(row?.Sector))?.Sector || '-'
  return {
    totalScanned: allRanked.length,
    strongBuy: (datasets.strongBuy || []).length,
    buy: (datasets.buy || []).length,
    sell: (datasets.sell || []).length,
    aiPicks: (datasets.aiPicks || []).length,
    accumulation: (datasets.accumulation || []).length,
    bestSector,
  }
}

function isKnownSector(value) {
  const sector = String(value || '').trim().toLowerCase()
  return Boolean(sector) && sector !== 'unknown' && sector !== '-'
}

let latestSheetRows = null

export function cacheDashboardSheets(sheetRows) {
  latestSheetRows = Object.fromEntries(
    Object.entries(sheetRows || {}).map(([sheetName, rows]) => [sheetName, Array.isArray(rows) ? rows : []])
  )
}

export function buildDashboardPayloadFromSheets(sheetRows, limit = null) {
  const datasets = Object.fromEntries(
    Object.entries(datasetSheetMap).map(([key, sheetName]) => [key, sliceRows(sheetRows[sheetName] || [], limit)])
  )

  const dataReady = (sheetRows.All_Ranked || []).length > 0

  return {
    overview: buildOverview(datasets),
    datasets,
    meta: {
      workbookAvailable: dataReady,
      dataReady,
      dataSourceMode: config.dataSourceMode,
      persistWorkbook: config.persistWorkbook,
      outputExcel: config.outputExcel,
      generatedAt: new Date().toISOString(),
    },
  }
}

export async function getDashboardPayload(limit = null) {
  if (!latestSheetRows && config.bootstrapScanOnRequest) {
    cacheDashboardSheets(await runFullScan(null))
  }

  return buildDashboardPayloadFromSheets(latestSheetRows || {}, limit)
}