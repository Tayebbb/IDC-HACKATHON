"""
build_embeddings_local.py — identical output to build_embeddings.py but uses
the local sentence-transformers library instead of the HF Inference API.

Use this when api-inference.huggingface.co is unreachable.

Run:
    cd backend
    python scripts/build_embeddings_local.py

Output: backend/data/corpus_embeddings.json
  Same schema as the HF-based script:
    { "model": "<model_name>", "items": [ { "id", "type", "title",
      "skills", "description", "embedding": [float, ...] }, ... ] }
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

ROOT = Path(__file__).resolve().parent.parent
CORPUS_PATH = ROOT / "data" / "seed_corpus.json"
OUT_PATH = ROOT / "data" / "corpus_embeddings.json"


def main() -> int:
    # --- dependency check ---------------------------------------------------
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print(
            "ERROR: sentence-transformers is not installed.\n"
            "Run:  pip install sentence-transformers",
            file=sys.stderr,
        )
        return 1

    # --- corpus check -------------------------------------------------------
    if not CORPUS_PATH.exists():
        print(f"ERROR: corpus not found at {CORPUS_PATH}", file=sys.stderr)
        return 1

    with CORPUS_PATH.open("r", encoding="utf-8") as f:
        corpus = json.load(f)

    print(f"Loaded {len(corpus)} items from {CORPUS_PATH.name}")
    print(f"Loading model: {HF_MODEL}  (downloads ~90 MB on first run)...")

    model = SentenceTransformer(HF_MODEL)

    # --- embed --------------------------------------------------------------
    texts = [
        f"{item.get('title', '')}. "
        f"Skills: {', '.join(item.get('skills', []))}. "
        f"{item.get('description', '')}"
        for item in corpus
    ]

    print(f"Embedding {len(texts)} texts...")
    vectors = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)

    out: list[dict] = []
    for item, vec in zip(corpus, vectors):
        out.append(
            {
                "id": item.get("id"),
                "type": item.get("type"),
                "title": item.get("title"),
                "skills": item.get("skills", []),
                "description": item.get("description", ""),
                "embedding": vec.tolist(),
            }
        )

    # --- write --------------------------------------------------------------
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump({"model": HF_MODEL, "items": out}, f)

    print(f"\n✅ Wrote {len(out)} embeddings to {OUT_PATH}")
    print(f"   Embedding dimension: {len(out[0]['embedding'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
