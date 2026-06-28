"""
One-shot rewrite: convert dark-mode-locked inline-style color literals
in frontend page files to theme-aware CSS-variable references so the
existing dark UI auto-adapts to light mode.

Safe substitutions only — values whose dark-mode appearance is
preserved while flipping cleanly in light mode via tokens defined
in src/index.css (`--c-card`, `--c-on-card`, `--c-text-*`).
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src"

TARGETS = [
    # pages with inline-style theme leaks
    "pages/JobApplicationGenerator.jsx",
    "pages/CareerRoadmap.jsx",
    "pages/Chatassistance.jsx",
    "pages/CvUpload.jsx",
    "pages/KnowledgeGraph.jsx",
    "pages/Home.jsx",
    # pages with Tailwind arbitrary white-alpha classes
    "pages/Signup.jsx",
    "pages/Login.jsx",
    "pages/Register.jsx",
    "pages/ForgotPassword.jsx",
    "pages/Dashboard.jsx",
    "pages/Resources.jsx",
    "pages/LearningResources.jsx",
    "pages/JobMarketInsights.jsx",
    "pages/Profile.jsx",
    # components
    "components/FaceExpressionOverlay.jsx",
    "components/branding/index.jsx",
]

# Ordered list of (regex, replacement). Order matters — more specific first.
RULES: list[tuple[str, str]] = [
    # ── Dark panel backgrounds ────────────────────────────────────────
    (r"rgba\(\s*17\s*,\s*21\s*,\s*43\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-card) / \1)"),
    (r"rgba\(\s*11\s*,\s*14\s*,\s*28\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-card-2) / \1)"),
    (r"rgba\(\s*10\s*,\s*8\s*,\s*30\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-shadow) / \1)"),
    (r"rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-shadow) / \1)"),
    (r"rgba\(\s*26\s*,\s*27\s*,\s*46\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-card) / \1)"),
    (r"rgba\(\s*19\s*,\s*20\s*,\s*31\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-card-2) / \1)"),
    (r"rgba\(\s*30\s*,\s*41\s*,\s*59\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-card-2) / \1)"),
    (r"rgba\(\s*31\s*,\s*41\s*,\s*55\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-card-2) / \1)"),

    # ── Tailwind arbitrary classes (white-alpha bg / border) ─────────
    # bg-[rgba(255,255,255,0.05)] → bg-[rgb(var(--c-on-card)/0.05)]
    (r"\[rgba\(255,255,255,(0?\.\d+|1(?:\.0+)?)\)\]",
     r"[rgb(var(--c-on-card)/\1)]"),
    # bg-[rgba(0,0,0,0.2)] (dark overlay) → soft neutral tint
    (r"\[rgba\(0,0,0,(0?\.\d+|1(?:\.0+)?)\)\]",
     r"[rgb(var(--c-shadow)/\1)]"),

    # ── White-alpha CSS values (inline styles) ────────────────────────
    (r"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)",
     r"rgb(var(--c-on-card) / \1)"),

    # ── Hardcoded slate text (Tailwind arbitrary class) ──────────────
    (r"text-\[#B3B3C7\]", r"text-text-muted"),
    (r"text-\[#FCA5A5\]", r"text-error"),

    # ── Slate text hex literals in style props ───────────────────────
    (r"['\"]#94A3B8['\"]", r"'rgb(var(--c-text-muted))'"),
    (r"['\"]#9CA3AF['\"]", r"'rgb(var(--c-text-muted))'"),
    (r"['\"]#D1D5DB['\"]", r"'rgb(var(--c-text-muted))'"),
    (r"['\"]#E0E7FF['\"]", r"'rgb(var(--c-text-main))'"),
    (r"['\"]#FCA5A5['\"]", r"'rgb(var(--c-error))'"),

    # ── hover:text-white on neutral surfaces → theme-aware main text ─
    (r"hover:text-white(?=[\s\"'])", r"hover:text-text-main"),

    # ── Pure white in `color:` style-object entry (NOT JSX icon inline) ──
    (r"color:\s*['\"]#FFFFFF['\"]\s*,",
     r"color: 'rgb(var(--c-on-card))',"),
    (r"color:\s*['\"]#FFF['\"]\s*,",
     r"color: 'rgb(var(--c-on-card))',"),
]


def rewrite(path: Path) -> int:
    src = path.read_text(encoding="utf-8")
    out = src
    for pattern, repl in RULES:
        out = re.sub(pattern, repl, out)
    if out != src:
        path.write_text(out, encoding="utf-8")
        return out.count("\n") - src.count("\n")  # not meaningful, just bool-ish
    return 0


def main() -> None:
    for name in TARGETS:
        p = ROOT / name
        if not p.exists():
            print(f"SKIP (missing): {p}")
            continue
        before = p.read_text(encoding="utf-8")
        rewrite(p)
        after = p.read_text(encoding="utf-8")
        changed = sum(1 for a, b in zip(before.splitlines(), after.splitlines()) if a != b)
        print(f"{name}: {changed} line(s) changed")


if __name__ == "__main__":
    main()
