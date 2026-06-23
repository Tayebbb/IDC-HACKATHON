"""
build_chunks.py — Reads seed_corpus.json, career_advice.json, and
skill_roadmaps.json and writes a unified chunks.json.

Chunking strategy per type:
  job / course  - chunk_0: skills summary  |  chunk_1+: description (150-word sliding window)
  advice        - chunk_0: question text   |  chunk_1+: answer text (150-word sliding window)
  roadmap       - chunk_0: overview        |  chunk_1: description  |  stage_N: per-stage detail

Run from backend/ directory:
    python scripts/build_chunks.py
"""

from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHUNKS_PATH = ROOT / "data" / "chunks.json"

CHUNK_SIZE = 150   # words
OVERLAP = 30       # words


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = OVERLAP) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunks.append(" ".join(words[start:end]))
        if end >= len(words):
            break
        start += chunk_size - overlap
    return chunks


def _load_json(path: Path) -> list[dict]:
    if not path.exists():
        print(f"  WARNING: {path} not found, skipping.")
        return []
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _chunks_for_job_course(doc: dict) -> list[dict]:
    skills = doc.get("skillsRequired", doc.get("relatedSkills", []))
    base = {
        "parent_id": doc["id"],
        "type": doc["type"],
        "title": doc["title"],
        "metadata": {
            "source_type": doc["type"],
            "track": doc.get("track", ""),
            "level": doc.get("experienceRequired", ""),
            "skills": skills,
            "platform": doc.get("platform", ""),
            "cost": doc.get("cost", ""),
            "company": doc.get("company", ""),
            "url": doc.get("url", ""),
        },
    }
    result = [{
        **base,
        "chunk_id": f"{doc['id']}_chunk_0",
        "text": f"{doc['title']} skills: {', '.join(skills)}",
    }]
    desc = doc.get("description", "")
    if desc:
        for i, text in enumerate(chunk_text(desc)):
            result.append({**base, "chunk_id": f"{doc['id']}_chunk_{i + 1}", "text": text})
    return result


def _chunks_for_advice(item: dict) -> list[dict]:
    skills = item.get("related_skills", [])
    tags = item.get("tags", [])
    base = {
        "parent_id": item["id"],
        "type": "advice",
        "title": item.get("question", item["id"]),
        "metadata": {
            "source_type": "advice",
            "track": ", ".join(tags),
            "level": "",
            "skills": skills,
            "platform": "",
            "cost": "",
            "company": "",
            "url": "",
        },
    }
    result = [{
        **base,
        "chunk_id": f"{item['id']}_chunk_0",
        "text": item.get("question", ""),
    }]
    answer = item.get("answer", "")
    if answer:
        for i, text in enumerate(chunk_text(answer)):
            result.append({**base, "chunk_id": f"{item['id']}_chunk_{i + 1}", "text": text})
    return result


def _chunks_for_roadmap(item: dict) -> list[dict]:
    track = item.get("track", "")
    all_skills: list[str] = []
    for stage in item.get("stages", []):
        all_skills.extend(stage.get("skills", []))
    deduped_skills = list(dict.fromkeys(all_skills))
    base = {
        "parent_id": item["id"],
        "type": "roadmap",
        "title": item.get("title", item["id"]),
        "metadata": {
            "source_type": "roadmap",
            "track": track,
            "level": "",
            "skills": deduped_skills,
            "platform": "",
            "cost": "",
            "company": "",
            "url": "",
        },
    }
    result = [{
        **base,
        "chunk_id": f"{item['id']}_chunk_0",
        "text": f"{item.get('title', '')} roadmap skills: {', '.join(deduped_skills[:12])}",
    }]
    desc = item.get("description", "")
    if desc:
        result.append({**base, "chunk_id": f"{item['id']}_chunk_1", "text": desc})
    for j, stage in enumerate(item.get("stages", [])):
        level = stage.get("level", "")
        duration = stage.get("duration", "")
        stage_skills = stage.get("skills", [])
        milestone = stage.get("milestone", "")
        stage_text = (
            f"{level.title()} stage ({duration}): skills: {', '.join(stage_skills)}. "
            f"Milestone: {milestone}"
        )
        result.append({**base, "chunk_id": f"{item['id']}_stage_{j}", "text": stage_text})
    return result


def main() -> int:
    chunks: list[dict] = []

    # ── 1. Jobs and courses from seed_corpus.json ────────────────────────────
    corpus = _load_json(ROOT / "data" / "seed_corpus.json")
    for doc in corpus:
        chunks.extend(_chunks_for_job_course(doc))
    print(f"  seed_corpus:    {len(corpus)} docs -> {sum(1 for c in chunks)} chunks so far")

    # ── 2. Career advice Q&A ─────────────────────────────────────────────────
    before = len(chunks)
    advice_items = _load_json(ROOT / "data" / "career_advice.json")
    for item in advice_items:
        chunks.extend(_chunks_for_advice(item))
    print(f"  career_advice:  {len(advice_items)} docs -> {len(chunks) - before} new chunks")

    # ── 3. Skill roadmaps ────────────────────────────────────────────────────
    before = len(chunks)
    roadmap_items = _load_json(ROOT / "data" / "skill_roadmaps.json")
    for item in roadmap_items:
        chunks.extend(_chunks_for_roadmap(item))
    print(f"  skill_roadmaps: {len(roadmap_items)} docs -> {len(chunks) - before} new chunks")

    # ── Validate unique chunk IDs ─────────────────────────────────────────────
    ids = [c["chunk_id"] for c in chunks]
    if len(ids) != len(set(ids)):
        print("ERROR: duplicate chunk_ids detected!")
        return 1

    CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CHUNKS_PATH.open("w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)

    total_docs = len(corpus) + len(advice_items) + len(roadmap_items)
    print(f"\nBuilt {len(chunks)} total chunks from {total_docs} source docs -> {CHUNKS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
