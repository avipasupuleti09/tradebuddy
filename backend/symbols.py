"""NSE symbol master – download, cache, and search."""
from __future__ import annotations

import csv
import io
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List

import requests

SYMBOL_MASTER_URL = "https://public.fyers.in/sym_details/NSE_CM.csv"
CACHE_TTL_SECONDS = 86400  # re-download once per day


@dataclass(frozen=True)
class NseSymbol:
    fyers_symbol: str   # e.g. "NSE:SBIN-EQ"
    company_name: str   # e.g. "STATE BANK OF INDIA"
    short_name: str     # e.g. "SBIN"
    isin: str           # e.g. "INE062A01020"


class SymbolMaster:
    def __init__(self, cache_dir: str = ".cache") -> None:
        self._cache_path = Path(cache_dir) / "nse_cm_symbols.csv"
        self._cache_path.parent.mkdir(parents=True, exist_ok=True)
        self._symbols: list[NseSymbol] = []
        self._loaded_at: float = 0

    def _needs_refresh(self) -> bool:
        if not self._symbols:
            return True
        if time.time() - self._loaded_at > CACHE_TTL_SECONDS:
            return True
        return False

    def _download(self) -> str:
        resp = requests.get(SYMBOL_MASTER_URL, timeout=15)
        resp.raise_for_status()
        text = resp.text
        self._cache_path.write_text(text, encoding="utf-8")
        return text

    def _load_from_cache(self) -> str | None:
        if not self._cache_path.exists():
            return None
        stat = self._cache_path.stat()
        if time.time() - stat.st_mtime > CACHE_TTL_SECONDS:
            return None
        return self._cache_path.read_text(encoding="utf-8")

    def _parse(self, raw: str) -> list[NseSymbol]:
        symbols: list[NseSymbol] = []
        reader = csv.reader(io.StringIO(raw))
        for row in reader:
            if len(row) < 15:
                continue
            fyers_symbol = row[9].strip() if len(row) > 9 else ""
            company_name = row[1].strip() if len(row) > 1 else ""
            short_name = row[13].strip() if len(row) > 13 else ""
            isin = row[5].strip() if len(row) > 5 else ""
            if fyers_symbol and company_name:
                symbols.append(NseSymbol(
                    fyers_symbol=fyers_symbol,
                    company_name=company_name,
                    short_name=short_name,
                    isin=isin,
                ))
        return symbols

    def ensure_loaded(self) -> None:
        if not self._needs_refresh():
            return
        raw = self._load_from_cache()
        if raw is None:
            raw = self._download()
        self._symbols = self._parse(raw)
        self._loaded_at = time.time()

    def search(self, query: str, limit: int = 30) -> list[dict]:
        self.ensure_loaded()
        q = query.upper()
        results: list[dict] = []
        # Exact prefix on short_name first, then company name contains
        for sym in self._symbols:
            if sym.short_name.upper().startswith(q) or sym.fyers_symbol.upper().startswith(f"NSE:{q}"):
                results.append(self._to_dict(sym))
                if len(results) >= limit:
                    return results
        # Broader match on company name
        for sym in self._symbols:
            if q in sym.company_name.upper() and self._to_dict(sym) not in results:
                results.append(self._to_dict(sym))
                if len(results) >= limit:
                    return results
        return results

    def all_symbols(self) -> list[dict]:
        self.ensure_loaded()
        return [self._to_dict(s) for s in self._symbols]

    @staticmethod
    def _to_dict(sym: NseSymbol) -> dict:
        return {
            "symbol": sym.fyers_symbol,
            "name": sym.company_name,
            "short": sym.short_name,
            "isin": sym.isin,
        }
