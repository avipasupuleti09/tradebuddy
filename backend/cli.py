from __future__ import annotations

import argparse
import json
import time
from datetime import date
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, urlparse

from .api import FyersApiService
from .auth import FyersAuthService
from .config import Settings
from .network import ensure_static_ip, get_public_ip
from .stream import FyersLiveFeed
from .token_store import TokenStore



def _parse_date(raw: str) -> date:
    return date.fromisoformat(raw)



def _load_api_service(settings: Settings) -> FyersApiService:
    token_store = TokenStore(settings.token_file)
    token_payload = token_store.load()
    access_token = token_payload.get("access_token")
    if not access_token:
        raise RuntimeError("No access_token found in token file. Run auth first.")
    return FyersApiService(client_id=settings.client_id, access_token=access_token)



def command_auth(settings: Settings) -> None:
    auth_service = FyersAuthService(settings)
    result = auth_service.login_with_totp()
    TokenStore(settings.token_file).save(result.to_dict())
    print(f"Token generated and saved to: {settings.token_file}")


def command_auth_url(settings: Settings) -> None:
    auth_service = FyersAuthService(settings)
    url = auth_service.get_manual_auth_url()
    print(json.dumps({"auth_url": url}, indent=2))


def command_auth_code(settings: Settings, auth_code: str | None, callback_url: str | None) -> None:
    code = auth_code
    if not code and callback_url:
        code = parse_qs(urlparse(callback_url).query).get("auth_code", [""])[0]

    if not code:
        raise ValueError("Provide --auth-code or --callback-url containing auth_code.")

    auth_service = FyersAuthService(settings)
    result = auth_service.exchange_auth_code(code)
    TokenStore(settings.token_file).save(result.to_dict())
    print(f"Token generated and saved to: {settings.token_file}")


def command_import_token(settings: Settings, access_token: str, expires_at: str | None) -> None:
    payload = {
        "access_token": access_token,
        "refresh_token": None,
        "expires_at": expires_at,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "client_id": settings.client_id,
        "source": "manual_import",
    }
    TokenStore(settings.token_file).save(payload)
    print(f"Token imported and saved to: {settings.token_file}")



def command_profile(settings: Settings) -> None:
    data = _load_api_service(settings).profile()
    print(json.dumps(data, indent=2))



def command_quotes(settings: Settings, symbols: list[str]) -> None:
    data = _load_api_service(settings).quotes(symbols)
    print(json.dumps(data, indent=2))



def command_history(
    settings: Settings,
    symbol: str,
    resolution: str,
    start: date,
    end: date,
) -> None:
    data = _load_api_service(settings).history(symbol, resolution, start, end)
    print(json.dumps(data, indent=2))



def command_stream(settings: Settings, symbols: list[str], data_type: str) -> None:
    token_store = TokenStore(settings.token_file)
    token_payload = token_store.load()
    access_token = token_payload.get("access_token")
    if not access_token:
        raise RuntimeError("No access_token found in token file. Run auth first.")

    feed = FyersLiveFeed(access_token=access_token, symbols=symbols, data_type=data_type)
    feed.run()


def _fyers_side(raw: str) -> int:
    return 1 if raw.upper() == "BUY" else -1


def _fyers_type(raw: str) -> int:
    mapping = {
        "LIMIT": 1,
        "MARKET": 2,
        "SL-M": 3,
        "SL-L": 4,
    }
    return mapping[raw.upper()]


def command_public_ip(settings: Settings) -> None:
    current_ip = get_public_ip(settings.ip_check_url)
    print(json.dumps({"public_ip": current_ip}, indent=2))


def command_preflight(settings: Settings) -> None:
    result: dict[str, Any] = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "token_file": {"ok": False},
            "static_ip": {"ok": False},
            "api_profile": {"ok": False},
            "order_endpoint": {"ok": False},
        },
        "overall_ok": False,
    }

    try:
        api = _load_api_service(settings)
        result["checks"]["token_file"] = {"ok": True, "message": "Access token loaded."}
    except Exception as exc:
        result["checks"]["token_file"] = {"ok": False, "error": str(exc)}
        print(json.dumps(result, indent=2))
        return

    try:
        validated_ip = ensure_static_ip(settings)
        result["checks"]["static_ip"] = {
            "ok": True,
            "current_public_ip": validated_ip,
            "expected_static_ip": settings.order_static_ip,
            "enforced": settings.enforce_static_ip_check,
        }
    except Exception as exc:
        result["checks"]["static_ip"] = {"ok": False, "error": str(exc)}

    try:
        profile_response = api.profile()
        result["checks"]["api_profile"] = {
            "ok": True,
            "status": profile_response.get("s", "unknown"),
        }
    except Exception as exc:
        result["checks"]["api_profile"] = {"ok": False, "error": str(exc)}

    try:
        orderbook_response = api.orderbook()
        result["checks"]["order_endpoint"] = {
            "ok": True,
            "status": orderbook_response.get("s", "unknown"),
            "message": "Order endpoint reachable via orderbook API.",
        }
    except Exception as exc:
        result["checks"]["order_endpoint"] = {"ok": False, "error": str(exc)}

    checks = result["checks"]
    result["overall_ok"] = bool(
        checks["token_file"]["ok"]
        and checks["static_ip"]["ok"]
        and checks["api_profile"]["ok"]
        and checks["order_endpoint"]["ok"]
    )
    print(json.dumps(result, indent=2))


def _execute_order(
    settings: Settings,
    api: FyersApiService,
    payload: dict[str, Any],
    force_live: bool,
    validated_ip: str,
    context: str,
) -> dict[str, Any]:
    if settings.paper_trade_mode and not force_live:
        simulated = {
            "executed": True,
            "paper_trade": True,
            "message": "Paper trade mode enabled. Live order not sent.",
            "context": context,
            "simulated_order": payload,
            "validated_public_ip": validated_ip,
        }
        print(json.dumps(simulated, indent=2))
        return simulated

    response = api.place_order(payload)
    output = {
        "executed": True,
        "paper_trade": False,
        "context": context,
        "validated_public_ip": validated_ip,
        "order_response": response,
    }
    print(json.dumps(output, indent=2))
    return output


def command_place_order(
    settings: Settings,
    symbol: str,
    qty: int,
    side: str,
    order_type: str,
    product_type: str,
    limit_price: float,
    stop_price: float,
    validity: str,
    disclosed_qty: int,
    offline_order: bool,
    stop_loss: float,
    take_profit: float,
    force_live: bool,
) -> None:
    current_ip = ensure_static_ip(settings)
    api = _load_api_service(settings)

    payload: dict[str, Any] = {
        "symbol": symbol,
        "qty": qty,
        "type": _fyers_type(order_type),
        "side": _fyers_side(side),
        "productType": product_type,
        "limitPrice": limit_price,
        "stopPrice": stop_price,
        "validity": validity,
        "disclosedQty": disclosed_qty,
        "offlineOrder": offline_order,
        "stopLoss": stop_loss,
        "takeProfit": take_profit,
    }

    if order_type.upper() == "LIMIT" and limit_price <= 0:
        raise ValueError("--limit-price must be > 0 for LIMIT orders.")

    _execute_order(settings, api, payload, force_live, current_ip, "manual")


def command_strategy_run(
    settings: Settings,
    symbol: str,
    qty: int,
    side: str,
    trigger_ltp: float,
    product_type: str,
    validity: str,
    force_live: bool,
) -> None:
    current_ip = ensure_static_ip(settings)
    api = _load_api_service(settings)

    quotes_response = api.quotes([symbol])
    data = quotes_response.get("d", [])
    if not data:
        raise RuntimeError(f"No quote data returned for symbol: {symbol}")

    quote = data[0].get("v", {})
    ltp = quote.get("lp")
    if ltp is None:
        raise RuntimeError(f"LTP not available in quote response: {quotes_response}")

    should_trade = (side.upper() == "BUY" and float(ltp) >= trigger_ltp) or (
        side.upper() == "SELL" and float(ltp) <= trigger_ltp
    )

    if not should_trade:
        print(
            json.dumps(
                {
                    "triggered": False,
                    "symbol": symbol,
                    "side": side.upper(),
                    "trigger_ltp": trigger_ltp,
                    "current_ltp": ltp,
                    "message": "Trigger condition not met. No order sent.",
                },
                indent=2,
            )
        )
        return

    payload: dict[str, Any] = {
        "symbol": symbol,
        "qty": qty,
        "type": _fyers_type("MARKET"),
        "side": _fyers_side(side),
        "productType": product_type,
        "limitPrice": 0,
        "stopPrice": 0,
        "validity": validity,
        "disclosedQty": 0,
        "offlineOrder": False,
        "stopLoss": 0,
        "takeProfit": 0,
    }

    _execute_order(settings, api, payload, force_live, current_ip, "strategy-run")


def _check_trigger(side: str, ltp: float, trigger_ltp: float) -> bool:
    if side.upper() == "BUY":
        return ltp >= trigger_ltp
    return ltp <= trigger_ltp


def command_strategy_watch(
    settings: Settings,
    symbol: str,
    qty: int,
    side: str,
    trigger_ltp: float,
    product_type: str,
    validity: str,
    poll_seconds: int,
    max_trades: int,
    max_checks: int,
    force_live: bool,
) -> None:
    if poll_seconds < 1:
        raise ValueError("--poll-seconds must be >= 1")
    if max_trades < 1:
        raise ValueError("--max-trades must be >= 1")
    if max_checks < 1:
        raise ValueError("--max-checks must be >= 1")

    current_ip = ensure_static_ip(settings)
    api = _load_api_service(settings)

    summary: dict[str, Any] = {
        "mode": "strategy-watch",
        "symbol": symbol,
        "side": side.upper(),
        "trigger_ltp": trigger_ltp,
        "poll_seconds": poll_seconds,
        "max_trades": max_trades,
        "max_checks": max_checks,
        "checks_done": 0,
        "trades_executed": 0,
        "validated_public_ip": current_ip,
        "paper_trade_mode": settings.paper_trade_mode and not force_live,
        "events": [],
    }

    while summary["checks_done"] < max_checks and summary["trades_executed"] < max_trades:
        summary["checks_done"] += 1

        quotes_response = api.quotes([symbol])
        data = quotes_response.get("d", [])
        if not data:
            summary["events"].append(
                {
                    "check": summary["checks_done"],
                    "status": "no_data",
                    "message": "No quote data returned.",
                }
            )
            time.sleep(poll_seconds)
            continue

        quote = data[0].get("v", {})
        ltp_raw = quote.get("lp")
        if ltp_raw is None:
            summary["events"].append(
                {
                    "check": summary["checks_done"],
                    "status": "no_ltp",
                    "message": "LTP missing in quote response.",
                }
            )
            time.sleep(poll_seconds)
            continue

        ltp = float(ltp_raw)
        triggered = _check_trigger(side, ltp, trigger_ltp)

        summary["events"].append(
            {
                "check": summary["checks_done"],
                "status": "triggered" if triggered else "waiting",
                "ltp": ltp,
            }
        )

        if triggered:
            payload: dict[str, Any] = {
                "symbol": symbol,
                "qty": qty,
                "type": _fyers_type("MARKET"),
                "side": _fyers_side(side),
                "productType": product_type,
                "limitPrice": 0,
                "stopPrice": 0,
                "validity": validity,
                "disclosedQty": 0,
                "offlineOrder": False,
                "stopLoss": 0,
                "takeProfit": 0,
            }
            _execute_order(settings, api, payload, force_live, current_ip, "strategy-watch")
            summary["trades_executed"] += 1

        if summary["checks_done"] < max_checks and summary["trades_executed"] < max_trades:
            time.sleep(poll_seconds)

    summary["completed"] = True
    print(json.dumps(summary, indent=2))



def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TradeBuddy FYERS backend CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("auth", help="Authenticate with FYERS using TOTP and save token")
    subparsers.add_parser("auth-url", help="Generate FYERS login URL for manual auth-code flow")
    auth_code_parser = subparsers.add_parser("auth-code", help="Exchange auth code and save token")
    auth_code_parser.add_argument("--auth-code", default=None, help="auth_code value from FYERS redirect URL")
    auth_code_parser.add_argument("--callback-url", default=None, help="Full callback URL containing auth_code")

    token_parser = subparsers.add_parser("import-token", help="Import access token manually and save locally")
    token_parser.add_argument("--access-token", required=True, help="FYERS access token to store locally")
    token_parser.add_argument("--expires-at", default=None, help="Optional expiry timestamp for tracking")

    subparsers.add_parser("profile", help="Fetch account profile")
    subparsers.add_parser("public-ip", help="Print current public IP used for static-IP checks")
    subparsers.add_parser("preflight", help="Run token, static IP, and FYERS endpoint readiness checks")

    quotes_parser = subparsers.add_parser("quotes", help="Fetch quotes")
    quotes_parser.add_argument("symbols", nargs="+", help="Symbols like NSE:SBIN-EQ")

    history_parser = subparsers.add_parser("history", help="Fetch historical candles")
    history_parser.add_argument("symbol", help="Symbol like NSE:SBIN-EQ")
    history_parser.add_argument("--resolution", default="1", help="Candle resolution")
    history_parser.add_argument("--start", required=True, type=_parse_date, help="Start date YYYY-MM-DD")
    history_parser.add_argument("--end", required=True, type=_parse_date, help="End date YYYY-MM-DD")

    stream_parser = subparsers.add_parser("stream", help="Start websocket market data stream")
    stream_parser.add_argument("symbols", nargs="+", help="Symbols like NSE:SBIN-EQ")
    stream_parser.add_argument(
        "--data-type",
        default="SymbolUpdate",
        choices=["SymbolUpdate", "DepthUpdate"],
        help="Fyers websocket data type",
    )

    order_parser = subparsers.add_parser("place-order", help="Place order with static IP enforcement")
    order_parser.add_argument("--symbol", required=True, help="Symbol like NSE:SBIN-EQ")
    order_parser.add_argument("--qty", required=True, type=int, help="Order quantity")
    order_parser.add_argument("--side", required=True, choices=["BUY", "SELL"], help="Order side")
    order_parser.add_argument(
        "--order-type",
        default="MARKET",
        choices=["MARKET", "LIMIT", "SL-M", "SL-L"],
        help="Fyers order type",
    )
    order_parser.add_argument("--product-type", default="INTRADAY", help="INTRADAY/CNC/MARGIN/BO/CO")
    order_parser.add_argument("--limit-price", type=float, default=0.0, help="Limit price")
    order_parser.add_argument("--stop-price", type=float, default=0.0, help="Stop trigger price")
    order_parser.add_argument("--validity", default="DAY", help="Order validity")
    order_parser.add_argument("--disclosed-qty", type=int, default=0, help="Disclosed quantity")
    order_parser.add_argument("--offline-order", action="store_true", help="Set offlineOrder=true")
    order_parser.add_argument("--stop-loss", type=float, default=0.0, help="Stop loss value")
    order_parser.add_argument("--take-profit", type=float, default=0.0, help="Take profit value")
    order_parser.add_argument(
        "--force-live",
        action="store_true",
        help="Bypass FYERS_PAPER_TRADE_MODE for this command and place a real order",
    )

    strategy_parser = subparsers.add_parser("strategy-run", help="Run basic trigger strategy with paper/live guard")
    strategy_parser.add_argument("--symbol", required=True, help="Symbol like NSE:SBIN-EQ")
    strategy_parser.add_argument("--qty", required=True, type=int, help="Order quantity")
    strategy_parser.add_argument("--side", required=True, choices=["BUY", "SELL"], help="Trade side")
    strategy_parser.add_argument(
        "--trigger-ltp",
        required=True,
        type=float,
        help="BUY triggers when LTP >= trigger; SELL triggers when LTP <= trigger",
    )
    strategy_parser.add_argument("--product-type", default="INTRADAY", help="INTRADAY/CNC/MARGIN/BO/CO")
    strategy_parser.add_argument("--validity", default="DAY", help="Order validity")
    strategy_parser.add_argument(
        "--force-live",
        action="store_true",
        help="Bypass FYERS_PAPER_TRADE_MODE for this command and place a real order",
    )

    watch_parser = subparsers.add_parser("strategy-watch", help="Poll LTP and execute strategy with caps")
    watch_parser.add_argument("--symbol", required=True, help="Symbol like NSE:SBIN-EQ")
    watch_parser.add_argument("--qty", required=True, type=int, help="Order quantity")
    watch_parser.add_argument("--side", required=True, choices=["BUY", "SELL"], help="Trade side")
    watch_parser.add_argument(
        "--trigger-ltp",
        required=True,
        type=float,
        help="BUY triggers when LTP >= trigger; SELL triggers when LTP <= trigger",
    )
    watch_parser.add_argument("--product-type", default="INTRADAY", help="INTRADAY/CNC/MARGIN/BO/CO")
    watch_parser.add_argument("--validity", default="DAY", help="Order validity")
    watch_parser.add_argument("--poll-seconds", type=int, default=5, help="Polling interval in seconds")
    watch_parser.add_argument("--max-trades", type=int, default=1, help="Maximum strategy trades to execute")
    watch_parser.add_argument("--max-checks", type=int, default=120, help="Maximum quote polls before exit")
    watch_parser.add_argument(
        "--force-live",
        action="store_true",
        help="Bypass FYERS_PAPER_TRADE_MODE for this command and place a real order",
    )

    return parser



def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    settings = Settings.from_env()

    if args.command == "auth":
        command_auth(settings)
    elif args.command == "auth-url":
        command_auth_url(settings)
    elif args.command == "auth-code":
        command_auth_code(settings, args.auth_code, args.callback_url)
    elif args.command == "import-token":
        command_import_token(settings, args.access_token, args.expires_at)
    elif args.command == "profile":
        command_profile(settings)
    elif args.command == "public-ip":
        command_public_ip(settings)
    elif args.command == "preflight":
        command_preflight(settings)
    elif args.command == "quotes":
        command_quotes(settings, args.symbols)
    elif args.command == "history":
        command_history(settings, args.symbol, args.resolution, args.start, args.end)
    elif args.command == "stream":
        command_stream(settings, args.symbols, args.data_type)
    elif args.command == "place-order":
        command_place_order(
            settings,
            args.symbol,
            args.qty,
            args.side,
            args.order_type,
            args.product_type,
            args.limit_price,
            args.stop_price,
            args.validity,
            args.disclosed_qty,
            args.offline_order,
            args.stop_loss,
            args.take_profit,
            args.force_live,
        )
    elif args.command == "strategy-run":
        command_strategy_run(
            settings,
            args.symbol,
            args.qty,
            args.side,
            args.trigger_ltp,
            args.product_type,
            args.validity,
            args.force_live,
        )
    elif args.command == "strategy-watch":
        command_strategy_watch(
            settings,
            args.symbol,
            args.qty,
            args.side,
            args.trigger_ltp,
            args.product_type,
            args.validity,
            args.poll_seconds,
            args.max_trades,
            args.max_checks,
            args.force_live,
        )


if __name__ == "__main__":
    main()
