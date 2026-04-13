from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fyers_apiv3 import fyersModel


class FyersApiService:
    def __init__(self, client_id: str, access_token: str) -> None:
        self.client = fyersModel.FyersModel(
            client_id=client_id,
            is_async=False,
            token=access_token,
            log_path="",
        )

    def profile(self) -> dict[str, Any]:
        return self.client.get_profile()

    def funds(self) -> dict[str, Any]:
        return self.client.funds()

    def holdings(self) -> dict[str, Any]:
        return self.client.holdings()

    def positions(self) -> dict[str, Any]:
        return self.client.positions()

    def quotes(self, symbols: list[str]) -> dict[str, Any]:
        payload = {"symbols": ",".join(symbols)}
        return self.client.quotes(payload)

    def history(
        self,
        symbol: str,
        resolution: str,
        start_date: date,
        end_date: date,
    ) -> dict[str, Any]:
        range_from = int(datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc).timestamp())
        range_to = int(datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc).timestamp())
        payload = {
            "symbol": symbol,
            "resolution": resolution,
            "date_format": "0",
            "range_from": str(range_from),
            "range_to": str(range_to),
            "cont_flag": "1",
        }
        return self.client.history(payload)

    def place_order(self, order_data: dict[str, Any]) -> dict[str, Any]:
        return self.client.place_order(order_data)

    def orderbook(self) -> dict[str, Any]:
        return self.client.orderbook()

    def tradebook(self) -> dict[str, Any]:
        return self.client.tradebook()
