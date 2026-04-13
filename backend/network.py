from __future__ import annotations

import requests

from .config import Settings


class StaticIpValidationError(RuntimeError):
    pass



def get_public_ip(url: str) -> str:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.text.strip()



def ensure_static_ip(settings: Settings) -> str:
    current_ip = get_public_ip(settings.ip_check_url)

    if not settings.enforce_static_ip_check:
        return current_ip

    expected_ip = settings.order_static_ip.strip()
    if not expected_ip:
        raise StaticIpValidationError(
            "Static IP check is enabled but FYERS_ORDER_STATIC_IP is not configured."
        )

    if current_ip != expected_ip:
        raise StaticIpValidationError(
            f"Order blocked: current public IP {current_ip} does not match configured static IP {expected_ip}."
        )

    return current_ip
