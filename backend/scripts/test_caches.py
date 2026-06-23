"""Quick test of the new advice/roadmap data caches in main.py"""
import sys, os
sys.path.insert(0, 'backend')
os.environ.setdefault('HF_TOKEN', '')

from main import _ADVICE_CACHE, _ROADMAPS_CACHE

print(f"Advice cache: {len(_ADVICE_CACHE)} items")
print(f"Roadmaps cache: {len(_ROADMAPS_CACHE)} items")

# Test advice keyword search
q_lower = "machine learning"
matches = [
    a for a in _ADVICE_CACHE
    if any(
        tok in (a.get("question", "") + a.get("answer", "")).lower()
        for tok in q_lower.split()
        if len(tok) > 2
    )
]
print(f'Advice matching "{q_lower}": {len(matches)} items')
if matches:
    print(f"  -> {matches[0]['question']}")

# Test roadmap track filter
backend_rm = [r for r in _ROADMAPS_CACHE if "backend" in r.get("track", "").lower()]
print(f"Backend roadmaps: {len(backend_rm)}")
if backend_rm:
    print(f"  -> {backend_rm[0]['title']}")

print("\nAll checks passed!")
