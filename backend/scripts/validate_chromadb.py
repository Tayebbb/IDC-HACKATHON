"""Quick validation script for the ChromaDB career_corpus collection."""
from pathlib import Path
import chromadb
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parent.parent
CHROMA_PATH = ROOT / "data" / "chromadb"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

client = chromadb.PersistentClient(path=str(CHROMA_PATH))
col = client.get_collection("career_corpus")
print(f"ChromaDB vectors: {col.count()}")

model = SentenceTransformer(MODEL_NAME)

queries = [
    ("how to start frontend career", "advice"),
    ("DevOps kubernetes docker learning path", "roadmap"),
    ("machine learning AI job course", "job/course"),
]

for query, expected_type in queries:
    qvec = model.encode([query])[0].tolist()
    results = col.query(query_embeddings=[qvec], n_results=3, include=["metadatas", "documents"])
    metas = results["metadatas"][0]
    print(f"\n--- Query: {query} (expecting {expected_type}) ---")
    for m in metas:
        src = m.get("source_type", m.get("type", "?"))
        title = m.get("title", "?")[:65]
        print(f"  [{src}] {title}")

print("\nAll checks done!")
