from __future__ import annotations

import json
from pathlib import Path

from datasets import load_dataset


DATASET_NAME = "NxtGenIntern/job_titles_and_descriptions"
MAX_NEW_ITEMS = 500
START_JOB_ID = 158

ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "seed_corpus.json"
OUTPUT_PATH = ROOT / "data" / "seed_corpus_enriched.json"


def _title_case(value: str) -> str:
    text = " ".join(str(value or "").strip().split())
    if text.isupper():
        return text.title()
    return text


def _split_skills(value: str) -> list[str]:
    return [skill.strip() for skill in str(value or "").split(", ") if skill.strip()]


def _load_seed() -> list[dict]:
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def _convert_dataset(existing_titles: set[str]) -> tuple[list[dict], dict[str, int]]:
    ds = load_dataset(DATASET_NAME, split="train")
    new_items: list[dict] = []
    seen_dataset_titles: set[str] = set()
    skipped_existing_duplicate = 0
    skipped_dataset_duplicate = 0
    skipped_missing_required = 0
    next_job_id = START_JOB_ID

    for row in ds:
        raw_title = str(row.get("Job Title", "")).strip()
        raw_skills = str(row.get("Skills", "")).strip()
        raw_description = str(row.get("Job Description", "")).strip()

        if not raw_title or not raw_skills or not raw_description:
            skipped_missing_required += 1
            continue

        normalized_title = raw_title.lower()
        if normalized_title in existing_titles:
            skipped_existing_duplicate += 1
            continue
        if normalized_title in seen_dataset_titles:
            skipped_dataset_duplicate += 1
            continue

        seen_dataset_titles.add(normalized_title)
        title = _title_case(raw_title)
        skills = _split_skills(raw_skills)
        skills_comma_separated = ", ".join(skills)
        description = f"{title}. Skills: {skills_comma_separated}. {raw_description}"

        new_items.append(
            {
                "id": f"job_{next_job_id:03d}",
                "type": "job",
                "title": title,
                "skills": skills,
                "description": description,
            }
        )
        next_job_id += 1

        if len(new_items) >= MAX_NEW_ITEMS:
            break

    return new_items, {
        "dataset_rows": len(ds),
        "items_added": len(new_items),
        "skipped_existing_duplicate": skipped_existing_duplicate,
        "skipped_dataset_duplicate": skipped_dataset_duplicate,
        "skipped_missing_required": skipped_missing_required,
    }


def _validate(items: list[dict]) -> dict:
    ids = [item.get("id") for item in items]
    duplicate_ids = sorted({item_id for item_id in ids if ids.count(item_id) > 1})
    empty_required = []

    for index, item in enumerate(items):
        missing = []
        if not str(item.get("id", "")).strip():
            missing.append("id")
        if not str(item.get("title", "")).strip():
            missing.append("title")
        if not str(item.get("description", "")).strip():
            missing.append("description")
        skills = item.get("skills")
        if not isinstance(skills, list) or not skills:
            missing.append("skills")
        if missing:
            empty_required.append(
                {
                    "index": index,
                    "id": item.get("id"),
                    "missing_or_empty": missing,
                }
            )

    return {
        "valid_json": True,
        "total_items": len(items),
        "jobs": sum(1 for item in items if item.get("type") == "job"),
        "courses": sum(1 for item in items if item.get("type") == "course"),
        "empty_required_items": empty_required,
        "duplicate_ids": duplicate_ids,
    }


def main() -> None:
    seed = _load_seed()
    existing_titles = {
        str(item.get("title", "")).strip().lower()
        for item in seed
        if str(item.get("title", "")).strip()
    }
    new_items, summary = _convert_dataset(existing_titles)
    merged = seed + new_items

    OUTPUT_PATH.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    validation = _validate(merged)
    print("ENRICHMENT_SUMMARY")
    print(json.dumps({**summary, "final_count": len(merged)}, indent=2))
    print("VALIDATION_SUMMARY")
    print(json.dumps(validation, indent=2))


if __name__ == "__main__":
    main()
