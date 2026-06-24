"""Connectivity checks for Docker deployment readiness.

Run from backend/:
    python scripts/test_connectivity.py
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dependency is in requirements.txt
    load_dotenv = None


def _load_env() -> None:
    if load_dotenv:
        load_dotenv()


def _check_head(name: str, url: str, headers: dict[str, str] | None = None) -> bool:
    req = urllib.request.Request(url, headers=headers or {}, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"PASS {name}: HTTP {resp.status}")
            return True
    except urllib.error.HTTPError as exc:
        if 200 <= exc.code < 500:
            print(f"PASS {name}: HTTP {exc.code}")
            return True
        print(f"FAIL {name}: HTTP {exc.code}")
        return False
    except Exception as exc:
        print(f"FAIL {name}: {exc}")
        return False


def main() -> int:
    _load_env()

    hf_token = (os.getenv("HF_TOKEN") or "").strip()

    checks: list[bool] = []
    checks.append(
        _check_head(
            "HF Inference API",
            "https://api-inference.huggingface.co/models/trpakov/vit-face-expression",
            {"Authorization": f"Bearer {hf_token}"} if hf_token else {},
        )
    )

    if hf_token:
        print("PASS HF_TOKEN: set (server-side, optional; frontend uses VITE_HF_API_TOKEN)")
        checks.append(True)
    else:
        print("INFO HF_TOKEN: missing (only required if backend ever needs HF; frontend handles AI now)")

    return 0 if all(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
