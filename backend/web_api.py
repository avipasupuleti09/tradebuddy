from __future__ import annotations

import json
import os
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlencode

from flask import Flask, jsonify, redirect, request
from flask_cors import CORS
from flask_sock import Sock

from .api import FyersApiService
from .auth import FyersAuthService
from .config import Settings
from .network import ensure_static_ip
from .symbols import SymbolMaster
from .token_store import TokenStore



def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    sock = Sock(app)

    settings = Settings.from_env()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    symbol_master = SymbolMaster()
    watchlist_file = Path(os.getenv("WATCHLIST_FILE", ".data/watchlists.json")).resolve()

    def load_api() -> FyersApiService:
        token_payload = TokenStore(settings.token_file).load()
        access_token = token_payload.get("access_token", "")
        if not access_token:
            raise RuntimeError("No access token found. Please login first.")
        return FyersApiService(client_id=settings.client_id, access_token=access_token)

    def map_side(raw: str) -> int:
        return 1 if raw.upper() == "BUY" else -1

    def map_order_type(raw: str) -> int:
        mapping = {
            "LIMIT": 1,
            "MARKET": 2,
            "SL-M": 3,
            "SL-L": 4,
        }
        return mapping[raw.upper()]

    def check_trigger(side: str, ltp: float, trigger_ltp: float) -> bool:
        if side.upper() == "BUY":
            return ltp >= trigger_ltp
        return ltp <= trigger_ltp

    def summarize_dashboard(holdings: dict, positions: dict, funds: dict) -> dict:
        holdings_rows = holdings.get("holdings", []) or []
        position_rows = positions.get("netPositions", []) or []
        fund_rows = funds.get("fund_limit", []) or []

        holdings_pnl = sum(float(item.get("pnl", 0) or 0) for item in holdings_rows)
        positions_pnl = sum(float(item.get("pl", 0) or item.get("pnl", 0) or 0) for item in position_rows)
        invested_value = sum(float(item.get("costPrice", 0) or 0) * float(item.get("quantity", 0) or 0) for item in holdings_rows)
        available_balance = float(fund_rows[0].get("equityAmount", 0) or 0) if fund_rows else 0

        return {
            "holdings_pnl": holdings_pnl,
            "positions_pnl": positions_pnl,
            "total_pnl": holdings_pnl + positions_pnl,
            "invested_value": invested_value,
            "available_balance": available_balance,
        }

    def build_dashboard_payload(api: FyersApiService) -> dict:
        profile = api.profile()
        holdings = api.holdings()
        positions = api.positions()
        funds = api.funds()
        orderbook = api.orderbook()
        tradebook = api.tradebook()
        summary = summarize_dashboard(holdings, positions, funds)

        return {
            "status": "ok",
            "profile": profile,
            "holdings": holdings,
            "positions": positions,
            "funds": funds,
            "orderbook": orderbook,
            "tradebook": tradebook,
            "summary": summary,
        }

    @app.get("/api/health")
    def health() -> tuple[dict, int]:
        return {"status": "ok"}, 200

    @app.post("/api/login")
    def login() -> tuple[dict, int]:
        auth_service = FyersAuthService(settings)
        try:
            result = auth_service.login_with_totp()
            TokenStore(settings.token_file).save(result.to_dict())
            return {"status": "ok", "mode": "totp"}, 200
        except Exception as exc:
            auth_url = auth_service.get_manual_auth_url()
            return {
                "status": "redirect_required",
                "message": str(exc),
                "auth_url": auth_url,
            }, 202

    @app.get("/api/auth-url")
    def auth_url() -> tuple[dict, int]:
        auth_service = FyersAuthService(settings)
        return {"auth_url": auth_service.get_manual_auth_url()}, 200

    @app.get("/api/auth/callback")
    def auth_callback():
        auth_code = request.args.get("auth_code", "")
        if not auth_code:
            return jsonify({"status": "error", "message": "auth_code missing"}), 400

        auth_service = FyersAuthService(settings)
        try:
            result = auth_service.exchange_auth_code(auth_code)
            TokenStore(settings.token_file).save(result.to_dict())
            query = urlencode({"login": "success"})
            return redirect(f"{frontend_url}/?{query}")
        except Exception as exc:
            query = urlencode({"login": "error", "reason": str(exc)})
            return redirect(f"{frontend_url}/?{query}")

    @app.get("/api/session")
    def session_status() -> tuple[dict, int]:
        try:
            api = load_api()
            profile = api.profile()
            return {
                "authenticated": str(profile.get("s", "")).lower() == "ok",
                "profile": profile.get("data", {}),
            }, 200
        except Exception:
            return {"authenticated": False}, 200

    @app.post("/api/logout")
    def logout() -> tuple[dict, int]:
        TokenStore(settings.token_file).delete()
        return {"status": "ok", "authenticated": False}, 200

    @app.get("/api/dashboard")
    def dashboard() -> tuple[dict, int]:
        try:
            api = load_api()
        except Exception as exc:
            return {"status": "error", "message": str(exc)}, 401

        return build_dashboard_payload(api), 200

    @sock.route("/api/live")
    def live(socket) -> None:
        try:
            api = load_api()
            query_symbols = request.args.get("symbols", "")
            symbols = [symbol.strip() for symbol in query_symbols.split(",") if symbol.strip()]
            if not symbols:
                symbols = ["NSE:NIFTY50-INDEX", "NSE:NIFTYBANK-INDEX", "NSE:SBIN-EQ", "NSE:RELIANCE-EQ"]

            while True:
                payload = build_dashboard_payload(api)
                payload["watchlist"] = api.quotes(symbols)
                socket.send(json.dumps(payload))
                time.sleep(5)
        except Exception as exc:
            try:
                socket.send(json.dumps({"status": "error", "message": str(exc)}))
            except Exception:
                pass

    @app.post("/api/orders")
    def place_order() -> tuple[dict, int]:
        try:
            validated_ip = ensure_static_ip(settings)
            api = load_api()
        except Exception as exc:
            return {"status": "error", "message": str(exc)}, 400

        payload = request.get_json(silent=True) or {}

        try:
            symbol = str(payload.get("symbol", "")).strip()
            qty = int(payload.get("qty", 0))
            side = str(payload.get("side", "BUY")).strip().upper()
            order_type = str(payload.get("orderType", "MARKET")).strip().upper()
            product_type = str(payload.get("productType", "INTRADAY")).strip()
            limit_price = float(payload.get("limitPrice", 0) or 0)
            stop_price = float(payload.get("stopPrice", 0) or 0)
            validity = str(payload.get("validity", "DAY")).strip()
            disclosed_qty = int(payload.get("disclosedQty", 0) or 0)
            offline_order = bool(payload.get("offlineOrder", False))
            stop_loss = float(payload.get("stopLoss", 0) or 0)
            take_profit = float(payload.get("takeProfit", 0) or 0)
            force_live = bool(payload.get("forceLive", False))
        except (TypeError, ValueError) as exc:
            return {"status": "error", "message": f"Invalid order payload: {exc}"}, 400

        if not symbol or qty < 1:
            return {"status": "error", "message": "symbol and qty are required."}, 400

        order_payload = {
            "symbol": symbol,
            "qty": qty,
            "type": map_order_type(order_type),
            "side": map_side(side),
            "productType": product_type,
            "limitPrice": limit_price,
            "stopPrice": stop_price,
            "validity": validity,
            "disclosedQty": disclosed_qty,
            "offlineOrder": offline_order,
            "stopLoss": stop_loss,
            "takeProfit": take_profit,
        }

        if order_type == "LIMIT" and limit_price <= 0:
            return {"status": "error", "message": "limitPrice must be > 0 for LIMIT orders."}, 400

        if settings.paper_trade_mode and not force_live:
            return {
                "status": "ok",
                "paper_trade": True,
                "validated_public_ip": validated_ip,
                "simulated_order": order_payload,
            }, 200

        response = api.place_order(order_payload)
        return {
            "status": "ok",
            "paper_trade": False,
            "validated_public_ip": validated_ip,
            "order_response": response,
        }, 200

    @app.post("/api/strategy/run")
    def run_strategy() -> tuple[dict, int]:
        try:
            validated_ip = ensure_static_ip(settings)
            api = load_api()
        except Exception as exc:
            return {"status": "error", "message": str(exc)}, 400

        payload = request.get_json(silent=True) or {}

        try:
            symbol = str(payload.get("symbol", "")).strip()
            qty = int(payload.get("qty", 0))
            side = str(payload.get("side", "BUY")).strip().upper()
            trigger_ltp = float(payload.get("triggerLtp", 0))
            product_type = str(payload.get("productType", "INTRADAY")).strip()
            validity = str(payload.get("validity", "DAY")).strip()
            force_live = bool(payload.get("forceLive", False))
        except (TypeError, ValueError) as exc:
            return {"status": "error", "message": f"Invalid strategy payload: {exc}"}, 400

        if not symbol or qty < 1 or trigger_ltp <= 0:
            return {"status": "error", "message": "symbol, qty, and triggerLtp are required."}, 400

        quotes_response = api.quotes([symbol])
        data = quotes_response.get("d", [])
        if not data:
            return {"status": "error", "message": f"No quote data returned for {symbol}."}, 400

        quote = data[0].get("v", {})
        ltp = quote.get("lp")
        if ltp is None:
            return {"status": "error", "message": "LTP missing in quote response."}, 400

        ltp_value = float(ltp)
        if not check_trigger(side, ltp_value, trigger_ltp):
            return {
                "status": "ok",
                "triggered": False,
                "validated_public_ip": validated_ip,
                "current_ltp": ltp_value,
                "trigger_ltp": trigger_ltp,
                "message": "Trigger condition not met. No order sent.",
            }, 200

        order_payload = {
            "symbol": symbol,
            "qty": qty,
            "type": map_order_type("MARKET"),
            "side": map_side(side),
            "productType": product_type,
            "limitPrice": 0,
            "stopPrice": 0,
            "validity": validity,
            "disclosedQty": 0,
            "offlineOrder": False,
            "stopLoss": 0,
            "takeProfit": 0,
        }

        if settings.paper_trade_mode and not force_live:
            return {
                "status": "ok",
                "triggered": True,
                "paper_trade": True,
                "validated_public_ip": validated_ip,
                "current_ltp": ltp_value,
                "simulated_order": order_payload,
            }, 200

        response = api.place_order(order_payload)
        return {
            "status": "ok",
            "triggered": True,
            "paper_trade": False,
            "validated_public_ip": validated_ip,
            "current_ltp": ltp_value,
            "order_response": response,
        }, 200

    # ── Symbol search ──────────────────────────────────────────────────────────
    @app.get("/api/symbols/search")
    def symbol_search() -> tuple[dict, int]:
        query = request.args.get("q", "").strip()
        limit = min(int(request.args.get("limit", "30")), 100)
        if not query:
            return {"results": []}, 200
        try:
            results = symbol_master.search(query, limit=limit)
            return {"results": results}, 200
        except Exception as exc:
            return {"status": "error", "message": str(exc)}, 500

    # ── Quotes for arbitrary symbols ───────────────────────────────────────────
    @app.get("/api/quotes")
    def get_quotes() -> tuple[dict, int]:
        raw = request.args.get("symbols", "").strip()
        if not raw:
            return {"d": []}, 200
        symbols = [s.strip() for s in raw.split(",") if s.strip()]
        try:
            api = load_api()
            data = api.quotes(symbols)
            return data, 200
        except Exception as exc:
            return {"status": "error", "message": str(exc)}, 400

    # ── History for chart ──────────────────────────────────────────────────────
    # FYERS API limits: intraday ~100 days, daily can go back years but
    # returns max ~2000 candles per request. We chunk and merge for large ranges.
    _MAX_INTRADAY_DAYS = 100   # FYERS intraday history limit
    _CHUNK_DAYS = 365          # fetch daily data in 1-year chunks

    @app.get("/api/history")
    def get_history() -> tuple[dict, int]:
        symbol = request.args.get("symbol", "").strip()
        resolution = request.args.get("resolution", "5")
        days = int(request.args.get("days", "5"))
        if not symbol:
            return {"status": "error", "message": "symbol is required"}, 400
        try:
            api = load_api()
            end_date = date.today()
            is_daily = resolution == "D"

            # Force daily for ranges that exceed intraday limits
            if not is_daily and days > _MAX_INTRADAY_DAYS:
                resolution = "D"
                is_daily = True

            start_date = end_date - timedelta(days=max(days, 1))

            # For daily resolution with large ranges, fetch in chunks and merge
            if is_daily and days > _CHUNK_DAYS:
                all_candles = []
                chunk_end = end_date
                while chunk_end > start_date:
                    chunk_start = max(start_date, chunk_end - timedelta(days=_CHUNK_DAYS))
                    data = api.history(symbol, resolution, chunk_start, chunk_end)
                    candles = data.get("candles") or []
                    all_candles = candles + all_candles  # prepend older data
                    chunk_end = chunk_start - timedelta(days=1)
                # Deduplicate by timestamp (first element of each candle)
                seen = set()
                unique = []
                for c in all_candles:
                    if c[0] not in seen:
                        seen.add(c[0])
                        unique.append(c)
                unique.sort(key=lambda c: c[0])
                return {"s": "ok", "candles": unique}, 200
            else:
                data = api.history(symbol, resolution, start_date, end_date)
                candles = data.get("candles")
                if not candles:
                    app.logger.warning(
                        "FYERS history empty: symbol=%s res=%s days=%d s=%s msg=%s",
                        symbol, resolution, days,
                        data.get("s", "?"), data.get("message", ""),
                    )
                return data, 200
        except Exception as exc:
            return {"status": "error", "message": str(exc)}, 400

    # ── Watchlist CRUD (persisted to JSON file) ────────────────────────────────
    def _load_watchlists() -> dict:
        if watchlist_file.exists():
            return json.loads(watchlist_file.read_text(encoding="utf-8"))
        return {}

    def _save_watchlists(data: dict) -> None:
        watchlist_file.parent.mkdir(parents=True, exist_ok=True)
        watchlist_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

    @app.get("/api/watchlists")
    def list_watchlists() -> tuple[dict, int]:
        wl = _load_watchlists()
        return {"watchlists": wl}, 200

    @app.post("/api/watchlists")
    def create_watchlist() -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", "")).strip()
        if not name:
            return {"status": "error", "message": "name is required"}, 400
        wl = _load_watchlists()
        if name in wl:
            return {"status": "error", "message": f"Watchlist '{name}' already exists"}, 409
        wl[name] = []
        _save_watchlists(wl)
        return {"status": "ok", "watchlists": wl}, 201

    @app.delete("/api/watchlists/<name>")
    def delete_watchlist(name: str) -> tuple[dict, int]:
        wl = _load_watchlists()
        if name not in wl:
            return {"status": "error", "message": "Watchlist not found"}, 404
        del wl[name]
        _save_watchlists(wl)
        return {"status": "ok", "watchlists": wl}, 200

    @app.post("/api/watchlists/<name>/symbols")
    def add_symbol_to_watchlist(name: str) -> tuple[dict, int]:
        payload = request.get_json(silent=True) or {}
        symbol = str(payload.get("symbol", "")).strip()
        if not symbol:
            return {"status": "error", "message": "symbol is required"}, 400
        wl = _load_watchlists()
        if name not in wl:
            return {"status": "error", "message": "Watchlist not found"}, 404
        if symbol not in wl[name]:
            wl[name].append(symbol)
            _save_watchlists(wl)
        return {"status": "ok", "symbols": wl[name]}, 200

    @app.delete("/api/watchlists/<name>/symbols/<path:symbol>")
    def remove_symbol_from_watchlist(name: str, symbol: str) -> tuple[dict, int]:
        wl = _load_watchlists()
        if name not in wl:
            return {"status": "error", "message": "Watchlist not found"}, 404
        wl[name] = [s for s in wl[name] if s != symbol]
        _save_watchlists(wl)
        return {"status": "ok", "symbols": wl[name]}, 200

    return app
