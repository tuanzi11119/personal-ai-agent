"""HTTP client helpers.

Building an httpx client can fail when proxy environment variables are malformed.
A common Windows case is a `NO_PROXY` list that contains `[::1]`: httpx rejects the
bracketed IPv6 literal with `InvalidURL: Invalid port: ':1]'`, which used to disable
proxy support entirely (every request then went direct and providers behind a proxy,
such as api.openai.com, were unreachable). We drop those bracketed entries and retry,
keeping the user's other proxy settings intact.
"""

from __future__ import annotations

import os

import httpx


def _sanitize_proxy_env() -> None:
    """Remove NO_PROXY entries httpx cannot parse (bracketed IPv6 literals)."""
    for name in ("NO_PROXY", "no_proxy"):
        raw = os.environ.get(name)
        if not raw:
            continue
        entries = [entry.strip() for entry in raw.split(",") if entry.strip()]
        cleaned = [entry for entry in entries if "[" not in entry and "]" not in entry]
        if cleaned != entries:
            os.environ[name] = ",".join(cleaned)


def new_client(timeout: float) -> httpx.Client:
    """Return an httpx client, honouring proxy env vars when they are usable."""
    _sanitize_proxy_env()
    try:
        return httpx.Client(timeout=timeout)
    except Exception:  # noqa: BLE001 - httpx raises InvalidURL for bad proxy settings
        return httpx.Client(timeout=timeout, trust_env=False)
