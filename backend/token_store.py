from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class TokenStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def save(self, payload: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            raise FileNotFoundError(f"Token file not found: {self.path}")
        raw = self.path.read_text(encoding="utf-8")
        return json.loads(raw)

    def delete(self) -> None:
        if self.path.exists():
            self.path.unlink()
