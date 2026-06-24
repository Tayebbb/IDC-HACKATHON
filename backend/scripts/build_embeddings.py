import json
import os
import time

USE_LOCAL = os.getenv("USE_LOCAL_EMBEDDINGS", "true").lower() == "true"
HF_TOKEN = os.getenv("HF_TOKEN", "")
HF_MODEL = "sentence-transformers/all-mpnet-base-v2"
HF_API_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{HF_MODEL}"


def get_embedding_local(text: str) -> list:
    """Generate embedding using local sentence-transformers model"""
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-mpnet-base-v2")
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


_local_model = None


def get_local_model():
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        print("Loading local sentence-transformers model...")
        _local_model = SentenceTransformer("all-mpnet-base-v2")
        print("Model loaded")
    return _local_model


def get_embedding_hf_api(text: str) -> list:
    """Generate embedding via HF Inference API"""
    import urllib.request
    import urllib.error
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    body = json.dumps({
        "inputs": text,
        "options": {"wait_for_model": True}
    }).encode()
    req = urllib.request.Request(HF_API_URL, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read())
        if isinstance(result[0], list):
            return result[0]
        return result


def get_embedding(text: str) -> list | None:
    if USE_LOCAL:
        try:
            model = get_local_model()
            emb = model.encode(text, normalize_embeddings=True)
            return emb.tolist()
        except Exception as e:
            print(f"Local embedding failed: {e}")
            return None
    else:
        if not HF_TOKEN:
            print("HF_TOKEN missing, skipping")
            return None
        try:
            return get_embedding_hf_api(text)
        except Exception as e:
            print(f"HF API error: {e}")
            return None


def main():
    chunks_path = "data/chunks.json"
    output_path = "data/corpus_embeddings.json"

    if not os.path.exists(chunks_path):
        print(f"ERROR: {chunks_path} not found. Run build_chunks.py first.")
        return

    with open(chunks_path) as f:
        chunks = json.load(f)

    print(f"Building embeddings for {len(chunks)} chunks")
    print(f"Mode: {'LOCAL sentence-transformers' if USE_LOCAL else 'HF Inference API'}")

    if USE_LOCAL:
        get_local_model()

    results = []
    failed = 0
    for i, chunk in enumerate(chunks):
        text = chunk.get("text", "")
        if not text.strip():
            chunk["embedding"] = None
            results.append(chunk)
            continue

        embedding = get_embedding(text)
        chunk["embedding"] = embedding
        if embedding is None:
            failed += 1
        results.append(chunk)

        if (i + 1) % 50 == 0:
            print(f"Progress: {i+1}/{len(chunks)} chunks embedded")

        if not USE_LOCAL and HF_TOKEN:
            time.sleep(0.3)

    with open(output_path, "w") as f:
        json.dump(results, f)

    success = len(chunks) - failed
    print(f"Done: {success}/{len(chunks)} chunks embedded successfully")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
