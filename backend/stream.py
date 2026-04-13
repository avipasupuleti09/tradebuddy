from __future__ import annotations

from fyers_apiv3.FyersWebsocket import data_ws


class FyersLiveFeed:
    def __init__(self, access_token: str, symbols: list[str], data_type: str = "SymbolUpdate") -> None:
        self.access_token = access_token
        self.symbols = symbols
        self.data_type = data_type

    def run(self) -> None:
        def on_message(message):
            print(message)

        def on_error(message):
            print(f"Stream error: {message}")

        def on_close(message):
            print(f"Stream closed: {message}")

        def on_open():
            ws.subscribe(symbols=self.symbols, data_type=self.data_type)
            ws.keep_running()

        ws = data_ws.FyersDataSocket(
            access_token=self.access_token,
            log_path="",
            litemode=False,
            write_to_file=False,
            reconnect=True,
            on_connect=on_open,
            on_close=on_close,
            on_error=on_error,
            on_message=on_message,
        )
        ws.connect()
