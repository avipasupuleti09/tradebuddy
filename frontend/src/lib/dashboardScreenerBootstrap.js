import { filterSymbolsByNseGroup } from "../nseGroups";

export const DEFAULT_DIRECT_GROUP_IDS = [
  "nifty-50",
  "niftynxt50",
  "nifty-midcap-50",
  "nifty-bank",
  "fin-nifty",
  "nifty-it",
  "nifty-pharma",
  "nifty-auto",
  "nifty-fmcg",
  "nifty-metals",
  "nifty-commodities",
  "nifty-energy",
  "nifty-oil-and-gas",
  "nifty-healthcare",
  "gold-silver",
  "bse-sensex",
];

const CACHE_KEYS = {
  marketSymbols: "tradebuddy-dashboard-market-symbols-v1",
  watchlistCatalog: "tradebuddy-dashboard-watchlist-catalog-v1",
  defaultPayload: "tradebuddy-dashboard-default-screener-payload-v1",
};

const CACHE_TTL_MS = {
  marketSymbols: 6 * 60 * 60 * 1000,
  watchlistCatalog: 2 * 60 * 1000,
  defaultPayload: 2 * 60 * 1000,
};

function readSessionCache(key, maxAgeMs) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (maxAgeMs > 0 && Number.isFinite(parsed.savedAt) && Date.now() - parsed.savedAt > maxAgeMs) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    return null;
  }
}

function writeSessionCache(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Ignore quota and serialization failures.
  }
}

function compactCatalogTicker(symbol) {
  return normalizeUniverseSymbol(symbol)
    .replace(/^[A-Z]+:/, "")
    .replace(/-(EQ|INDEX)$/, "");
}

function screenerFingerprint(symbols) {
  return normalizeUniverseSymbols(symbols).slice(0, 350).join("|");
}

export function normalizeUniverseSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

export function normalizeUniverseSymbols(symbols) {
  return (symbols || [])
    .map((symbol) => normalizeUniverseSymbol(symbol))
    .filter(Boolean);
}

export function normalizeMarketCatalogRows(symbolRows, fallbackRows = []) {
  if (Array.isArray(symbolRows) && symbolRows.length) {
    return symbolRows.map((row) => ({
      symbol: row.symbol || row.Symbol || row.ticker || row.Ticker || "",
      short: row.short || row.Short || compactCatalogTicker(row.symbol || row.Symbol || row.ticker || row.Ticker || ""),
      name: row.name || row.Name || row.description || row.Description || "",
    }));
  }

  return (fallbackRows || []).map((row) => ({
    symbol: row.Ticker || row.Symbol || row.symbol || "",
    short: compactCatalogTicker(row.Ticker || row.Symbol || row.symbol || ""),
    name: row.Company || row.Name || row.Sector || compactCatalogTicker(row.Ticker || row.Symbol || row.symbol || ""),
  }));
}

export function buildDefaultDirectUniverseSymbols(symbolRows) {
  const catalogRows = normalizeMarketCatalogRows(symbolRows, []);
  if (!catalogRows.length) {
    return [];
  }

  const symbols = new Set();
  DEFAULT_DIRECT_GROUP_IDS.forEach((groupId) => {
    filterSymbolsByNseGroup(catalogRows, groupId).forEach((row) => {
      const symbol = normalizeUniverseSymbol(row.symbol || row.Symbol || row.ticker || row.Ticker);
      if (symbol) {
        symbols.add(symbol);
      }
    });
  });

  if (symbols.size) {
    return Array.from(symbols).slice(0, 350);
  }

  return normalizeUniverseSymbols(catalogRows.slice(0, 250).map((row) => row.symbol));
}

export function getCachedMarketSymbolRows() {
  const cached = readSessionCache(CACHE_KEYS.marketSymbols, CACHE_TTL_MS.marketSymbols);
  return Array.isArray(cached) ? cached : [];
}

export function setCachedMarketSymbolRows(rows) {
  const nextRows = Array.isArray(rows) ? rows : [];
  writeSessionCache(CACHE_KEYS.marketSymbols, nextRows);
  return nextRows;
}

export function getCachedWatchlistCatalog() {
  return readSessionCache(CACHE_KEYS.watchlistCatalog, CACHE_TTL_MS.watchlistCatalog);
}

export function setCachedWatchlistCatalog(payload) {
  if (payload) {
    writeSessionCache(CACHE_KEYS.watchlistCatalog, payload);
  }
  return payload;
}

export function getCachedDefaultScreenerPayload(symbols) {
  const cached = readSessionCache(CACHE_KEYS.defaultPayload, CACHE_TTL_MS.defaultPayload);
  if (!cached || cached.fingerprint !== screenerFingerprint(symbols)) {
    return null;
  }
  return cached.payload ?? null;
}

export function setCachedDefaultScreenerPayload(symbols, payload) {
  const fingerprint = screenerFingerprint(symbols);
  if (!fingerprint || !payload) {
    return payload;
  }

  writeSessionCache(CACHE_KEYS.defaultPayload, { fingerprint, payload });
  return payload;
}

export function isDefaultUniverse(symbols, defaultSymbols) {
  return Boolean(screenerFingerprint(symbols)) && screenerFingerprint(symbols) === screenerFingerprint(defaultSymbols);
}
