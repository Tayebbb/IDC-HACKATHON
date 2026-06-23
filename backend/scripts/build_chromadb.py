"""
build_chromadb.py — Embeds chunks.json and loads them into a local ChromaDB collection.

Uses sentence-transformers/all-MiniLM-L6-v2 locally (no API key required).

Run from backend/ directory AFTER build_chunks.py:
    python scripts/build_chromadb.py

What it does:
1. Loads backend/data/chunks.json
2. Embeds each chunk locally via sentence-transformers (all-MiniLM-L6-v2)
3. Upserts all vectors + metadata into a persistent ChromaDB collection
   stored at backend/data/chromadb/

The runtime backend reads from this ChromaDB collection for semantic retrieval.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHUNKS_PATH = ROOT / "data" / "chunks.json"
CHROMA_PATH = ROOT / "data" / "chromadb"
COLLECTION_NAME = "career_corpus"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def main() -> int:
    # ── 1. Load chunks ──────────────────────────────────────────────────────
    if not CHUNKS_PATH.exists():
        print(f"ERROR: chunks.json not found at {CHUNKS_PATH}")
        print("Run: python scripts/build_chunks.py first")
        return 1

    with CHUNKS_PATH.open("r", encoding="utf-8") as f:
        chunks: list[dict] = json.load(f)
    print(f"Loaded {len(chunks)} chunks from {CHUNKS_PATH}")

    # ── 2. Load embedding model ──────────────────────────────────────────────
    print(f"Loading embedding model: {MODEL_NAME} ...")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(MODEL_NAME)
    print("Model loaded.")

    # ── 3. Embed all chunks ──────────────────────────────────────────────────
    texts = [c["text"] for c in chunks]
    print(f"Embedding {len(texts)} chunks ...")
    embeddings = model.encode(texts, batch_size=64, show_progress_bar=True)
    print(f"Embeddings done. Shape: {embeddings.shape}")

    # ── 4. Init ChromaDB ─────────────────────────────────────────────────────
    import chromadb
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))

    # Delete existing collection to rebuild clean
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"Deleted existing collection '{COLLECTION_NAME}'")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    print(f"Created collection '{COLLECTION_NAME}'")

    # ── 5. Upsert in batches ─────────────────────────────────────────────────
    BATCH = 500
    total = 0
    for start in range(0, len(chunks), BATCH):
        batch_chunks = chunks[start : start + BATCH]
        batch_embeddings = embeddings[start : start + BATCH].tolist()

        ids = [c["chunk_id"] for c in batch_chunks]
        docs = [c["text"] for c in batch_chunks]
        metas = []
        for c in batch_chunks:
            m = dict(c.get("metadata", {}))
            # ChromaDB metadata values must be str/int/float/bool
            if isinstance(m.get("skills"), list):
                m["skills"] = ", ".join(m["skills"])
            m["parent_id"] = c["parent_id"]
            m["title"] = c["title"]
            m["type"] = c["type"]
            metas.append(m)

        collection.upsert(
            ids=ids,
            embeddings=batch_embeddings,
            documents=docs,
            metadatas=metas,
        )
        total += len(batch_chunks)
        print(f"  Upserted {total}/{len(chunks)} chunks")

    print(f"\nDone! ChromaDB collection '{COLLECTION_NAME}' at {CHROMA_PATH}")
    print(f"Total vectors: {collection.count()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
