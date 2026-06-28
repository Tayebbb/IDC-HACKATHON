from __future__ import annotations

import asyncio as _asyncio
import json as _json
import logging
import math
import os as _os
import re
import time as _time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PyPDF2 import PdfReader

# ---------------------------------------------------------------------------
# Logging — structured, timestamped, visible in HF Space build logs
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("careerpath")

# Load environment variables
load_dotenv()

_STARTUP_TIME: datetime = datetime.now(timezone.utc)


def _check_st_installed() -> bool:
    try:
        import importlib.util
        return importlib.util.find_spec('sentence_transformers') is not None
    except Exception:
        return False

# ---------------------------------------------------------------------------
# FastAPI app — rich OpenAPI metadata for Swagger UI and judge review
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CareerPath AI — Backend API",
    description=(
        "**CareerPath AI** is a full-stack career guidance platform for "
        "students and fresh graduates.\n\n"
        "This backend powers:\n"
        "- 🤖 **Hybrid RAG Chatbot** — BM25 + dense cosine retrieval, "
        "cross-encoder re-ranking, Phi-3-mini generation\n"
        "- 📄 **CV Analysis** — PDF parsing, skill extraction, LLM structuring\n"
        "- 🗺️ **Career Roadmaps** — LLM-generated, RAG-grounded markdown roadmaps\n"
        "- 🎤 **Mock Interviews** — question generation + answer evaluation via Llama-3.1-8B\n"
        "- 😊 **Face Expression Analysis** — ViT-based emotion classification per frame\n"
        "- 🧬 **Career DNA Scoring** — 5-category interpretable skill scoring\n"
        "- 📊 **Readiness Score** — weighted aggregate: DNA 40% + Profile 30% + Interview 30%\n\n"
        "All AI outputs carry an **ExplainabilityEnvelope** with factors, "
        "confidence level, and signal types for full transparency."
    ),
    version="2.0.0",
    contact={
        "name": "CareerPath Team",
        "url": "https://github.com/Tayebbb/IDC-HACKATHON",
    },
    license_info={
        "name": "MIT",
    },
    openapi_tags=[
        {"name": "health",    "description": "Liveness and dependency status endpoints"},
        {"name": "cv",        "description": "CV / résumé upload, parsing and analysis"},
        {"name": "chat",      "description": "Hybrid RAG career Q&A chatbot"},
        {"name": "roadmap",   "description": "LLM-generated personalised career roadmaps"},
        {"name": "interview", "description": "Mock interview question generation and evaluation"},
        {"name": "face",      "description": "Real-time facial expression / emotion analysis"},
        {"name": "analytics", "description": "Career DNA, readiness score, and job-match explainability"},
        {"name": "data",      "description": "Career advice Q&A and skill roadmap data endpoints"},
    ],
)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    # No hard cap on history length — old Firestore conversations can be very
    # long; we clip to the most recent 50 turns inside the /chat handler
    # instead of rejecting the request with 422.
    history: list[dict] = Field(default_factory=list)
    preferred_track: str | None = Field(None, max_length=64)
    experience_level: str | None = Field(None, max_length=32)
    source_type: str | None = Field(None, max_length=32)
    preferredTrack: str | None = Field(None, max_length=64)
    experienceLevel: str | None = Field(None, max_length=32)
    sourceType: str | None = Field(None, max_length=32)


class SourceItem(BaseModel):
    id: str
    type: str
    title: str
    snippet: str
    score: float
    why_this_source: str | None = None


class ChatResponse(BaseModel):
    response: str
    reply: str
    sources: list[SourceItem]
    factors: list[dict]
    confidence: str
    basis: str
    retrieval_path: str
    signal_types_used: list[str]
    generation_model: str
    grounding_verification: dict | None = None

# Configure CORS middleware FIRST (before routes)
# Defaults to wildcard for local dev / hackathon demos. In production set
# `CORS_ORIGINS` to a comma-separated allowlist (e.g.
#   CORS_ORIGINS="https://careerpath.vercel.app,https://www.careerpath.app").
# allow_credentials stays False because we do not send cookies cross-origin;
# the only auth header used is HF_TOKEN, which lives entirely server-side.
_cors_origins_env = _os.getenv("CORS_ORIGINS", "*").strip()
_cors_origins = (
    ["*"]
    if _cors_origins_env in ("", "*")
    else [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# CV analysis helpers (no LLM — pure text extraction)
# ---------------------------------------------------------------------------

def _extract_skills_from_text(text: str) -> List[str]:
    """Match known skills against raw CV text (case-insensitive)."""
    known_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Vue", "Angular",
        "Next.js", "Node.js", "Express", "FastAPI", "Django", "Flask",
        "HTML", "CSS", "TailwindCSS", "SQL", "PostgreSQL", "MongoDB",
        "Redis", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git",
        "Firebase", "GraphQL", "REST", "TensorFlow", "PyTorch", "Figma",
        "Linux", "CI/CD", "Jenkins", "Terraform", "Pandas", "NumPy",
        "scikit-learn", "Machine Learning", "Deep Learning", "NLP",
        "Communication", "Leadership", "Teamwork", "Problem Solving",
    ]
    text_lower = text.lower()
    return [s for s in known_skills if s.lower() in text_lower]


def _extract_tools_from_text(text: str) -> List[str]:
    """Alias that also catches tool/platform keywords."""
    tools = [
        "VS Code", "IntelliJ", "PyCharm", "Postman", "Jira", "Confluence",
        "Slack", "Notion", "Trello", "GitHub", "GitLab", "Bitbucket",
        "Heroku", "Vercel", "Netlify", "Nginx", "Apache", "RabbitMQ",
        "Kafka", "Elasticsearch", "Celery", "FastAPI", "Streamlit",
    ]
    text_lower = text.lower()
    return [t for t in tools if t.lower() in text_lower]


def _extract_roles_from_text(text: str) -> List[str]:
    """Detect job titles / domain keywords in CV text."""
    roles = [
        "Software Engineer", "Frontend Developer", "Backend Developer",
        "Full Stack Developer", "Data Scientist", "Data Analyst",
        "Machine Learning Engineer", "DevOps Engineer", "Site Reliability Engineer",
        "UI/UX Designer", "Product Manager", "Mobile Developer",
        "Cloud Architect", "Security Engineer", "QA Engineer",
        "Web Development", "Data Engineering", "Artificial Intelligence",
        "Healthcare", "FinTech", "E-commerce",
    ]
    text_lower = text.lower()
    return [r for r in roles if r.lower() in text_lower]


def _summarize_cv_no_llm(full_text: str) -> dict:
    """Return a structured CV dict without any LLM call."""
    return {
        "keySkills": _extract_skills_from_text(full_text),
        "toolsTechnologies": _extract_tools_from_text(full_text),
        "rolesAndDomains": _extract_roles_from_text(full_text),
    }


# ---------------------------------------------------------------------------
# Interview question generation + answer evaluation moved to:
#   POST /interview/question  and  POST /interview/evaluate
# (HF Llama-3.1-8B-Instruct via _hf_chat, server-side RAG via _rag_context).
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Explainability Layer (additive)
# ---------------------------------------------------------------------------
# Data contract — every AI output produced by this backend MUST be wrappable
# in this envelope shape (see README + frontend ReasoningCard):
#
#   ExplainabilityEnvelope = {
#     "output": str | float,
#     "factors": list[Factor],
#     "confidence": "High" | "Medium" | "Low",
#     "basis": str,
#     "signal_types_used": list[SignalType],
#   }
#   Factor = { "label": str, "positive": bool,
#              "signal_type": SignalType, "value"?: float }
#
# Allowed SignalType (do NOT extend):
ALLOWED_SIGNAL_TYPES = {
    "rag_source", "skill_match", "weight_component",
    "profile_field", "interview_metric",
}


def _derive_confidence(factors: List[Dict[str, Any]], used_fallback: bool = False) -> str:
    """Confidence derivation rule (MUST match frontend explainability.js).

    - High:   >= 3 factors AND at least one rag_source or skill_match AND
              no retrieval fallback was used.
    - Medium: 1-2 factors, OR retrieval fallback used, OR only
              weight_component signals present.
    - Low:    0 factors, OR all signals are profile_field only, OR
              keyword fallback was used.
    """
    if not factors:
        return "Low"
    types = {f.get("signal_type") for f in factors if f and f.get("signal_type")}
    if types == {"profile_field"}:
        return "Low"
    if types == {"weight_component"}:
        return "Medium"
    if used_fallback:
        return "Medium"
    if len(factors) < 3:
        return "Medium"
    if "rag_source" in types or "skill_match" in types:
        return "High"
    return "Medium"


def _build_envelope(output: Any, factors: List[Dict[str, Any]], basis: str,
                    used_fallback: bool = False) -> Dict[str, Any]:
    safe = [f for f in (factors or []) if f and f.get("signal_type") in ALLOWED_SIGNAL_TYPES]
    return {
        "output": output,
        "factors": safe,
        "confidence": _derive_confidence(safe, used_fallback),
        "basis": basis or f"{len(safe)} factor(s) evaluated",
        "signal_types_used": sorted({f["signal_type"] for f in safe}),
    }


# ---------------------------------------------------------------------------
# Career DNA category mapping (Feature 2 — documented for judges)
# ---------------------------------------------------------------------------
# Each category lists the skills that map to it. Detection is a simple
# case-insensitive substring match against the user's declared skills.
# Heuristic scoring per category:
#   matched_in_category / total_in_category * 100, clamped to [0, 100]
# This is a deliberately interpretable baseline so every signal is
# traceable to a named skill (signal_type = "skill_match").
CAREER_DNA_CATEGORIES: Dict[str, List[str]] = {
    "Frontend": [
        "javascript", "typescript", "react", "vue", "angular", "html",
        "css", "tailwindcss", "tailwind", "redux", "next.js", "vite",
    ],
    "Backend": [
        "python", "fastapi", "django", "flask", "node.js", "express",
        "java", "spring", "go", "rest", "graphql", "sql", "postgresql",
        "mongodb",
    ],
    "DevOps": [
        "docker", "kubernetes", "terraform", "aws", "gcp", "azure",
        "linux", "ci/cd", "jenkins", "prometheus", "grafana",
    ],
    "AI/ML": [
        "python", "pytorch", "tensorflow", "scikit-learn", "pandas",
        "numpy", "machine learning", "deep learning", "nlp",
        "transformers", "llms", "computer vision",
    ],
    "Communication": [
        "communication", "writing", "presentation", "leadership",
        "teamwork", "mentoring", "public speaking", "documentation",
    ],
}


def _normalize_skill(s: str) -> str:
    return (s or "").strip().lower()


def _score_career_dna(user_skills: List[str]) -> Tuple[Dict[str, int], List[Dict[str, Any]]]:
    user_norm = {_normalize_skill(s) for s in (user_skills or []) if s}
    scores: Dict[str, int] = {}
    factors: List[Dict[str, Any]] = []
    for category, skills in CAREER_DNA_CATEGORIES.items():
        matched = [s for s in skills if any(s in u or u in s for u in user_norm)]
        total = max(len(skills), 1)
        pct = int(round(len(matched) / total * 100))
        scores[category] = min(pct, 100)
        for s in matched:
            factors.append({
                "label": f"{s.title()} detected in {category} (skill_match)",
                "positive": True,
                "signal_type": "skill_match",
            })
        missing_sample = [s for s in skills if s not in matched][:2]
        for s in missing_sample:
            factors.append({
                "label": f"{s.title()} missing for {category} (skill_match)",
                "positive": False,
                "signal_type": "skill_match",
            })
    return scores, factors


# ---------------------------------------------------------------------------
# Static data caches (career_advice + skill_roadmaps)
# ---------------------------------------------------------------------------
# RAG / embedding / chat-generation runs server-side again (see _hf_chat,
# _rag_context, /chat, /roadmap, /interview/*). The static JSON caches below
# back the data routes /career-advice and /skill-roadmap, plus the
# seed_corpus path used by /health/dependencies.
# ---------------------------------------------------------------------------
_DATA_DIR = Path(__file__).resolve().parent / "data"
_CORPUS_PATH = _DATA_DIR / "seed_corpus.json"
_ADVICE_PATH = _DATA_DIR / "career_advice.json"
_ROADMAPS_PATH = _DATA_DIR / "skill_roadmaps.json"
_CHUNKS_PATH = _DATA_DIR / "chunks.json"
_EMBEDDINGS_PATH = _DATA_DIR / "corpus_embeddings.json"


def _load_json(path: Path) -> "List[Dict[str, Any]]":
    if not path.exists():
        return []
    try:
        data = _json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


_ADVICE_CACHE: "List[Dict[str, Any]]" = _load_json(_ADVICE_PATH)
_ROADMAPS_CACHE: "List[Dict[str, Any]]" = _load_json(_ROADMAPS_PATH)


@app.get(
    "/",
    tags=["health"],
    summary="API liveness check",
    response_description="Running status, version and uptime",
)
async def root():
    """Returns a liveness message, API version, and uptime in seconds.

    Guaranteed to return **HTTP 200** as long as uvicorn is running;
    used by the Dockerfile HEALTHCHECK and HF Spaces health probe.
    """
    uptime_s = round((datetime.now(timezone.utc) - _STARTUP_TIME).total_seconds())
    return {
        "status": "ok",
        "message": "CareerPath AI Backend is running",
        "version": app.version,
        "uptime_seconds": uptime_s,
    }

@app.get(
    "/health/dependencies",
    tags=["health"],
    summary="Dependency readiness check",
    response_description="Status of corpus, embeddings, HF token, optional ChromaDB dependency, and AI routes",
)
async def health_dependencies():
    hf_token_set = bool(_os.getenv('HF_TOKEN', ''))
    embeddings_loaded = False
    if isinstance(_CORPUS_EMBEDDINGS, list):
        embeddings_loaded = len([
            c for c in _CORPUS_EMBEDDINGS if isinstance(c, dict) and c.get('embedding')
        ]) > 0


    hf_reachable = False
    try:
        import urllib.request
        urllib.request.urlopen(
            'https://api-inference.huggingface.co',
            timeout=3
        )
        hf_reachable = True
    except Exception:
        pass

    chroma_ok = _CHROMA_COLLECTION is not None
    corpus_ok = len(_CORPUS_EMBEDDINGS) > 0

    # AI routes (/roadmap, /interview/*, /face-expression) require a working
    # HF token AND reachable inference endpoint. Report 'degraded' when either
    # is absent so callers know AI-heavy endpoints will return 502.
    ai_ready = hf_token_set and hf_reachable

    if corpus_ok and embeddings_loaded and ai_ready:
        overall = 'ok'
    elif corpus_ok and embeddings_loaded:
        # Core RAG / chat is functional; LLM-backed routes may 502
        overall = 'degraded'
    elif corpus_ok:
        overall = 'degraded'
    else:
        overall = 'critical'

    chroma_chunks = 0
    if chroma_ok:
        try:
            chroma_chunks = _CHROMA_COLLECTION.count()
        except Exception as e:
            log.warning('Chroma count unavailable: %s', e)
            chroma_ok = False

    return {
        'seed_corpus_loaded': corpus_ok,
        'embeddings_loaded': embeddings_loaded,
        'hf_token': 'set' if hf_token_set else 'missing',
        'hf_inference_reachable': hf_reachable,
        'ai_routes_ready': ai_ready,
        'chroma_connected': chroma_ok,
        'chroma_chunks': chroma_chunks,
        'chroma_role': 'dependency_only_not_primary_retrieval_path',
        'use_local_embeddings': _USE_LOCAL_EMBEDDINGS,
        'enable_reranker': _ENABLE_RERANKER,
        'sentence_transformers_installed': _check_st_installed(),
        'hybrid_ready': _HYBRID_READY,
        'corpus_count': len(_HYBRID_CORPUS),
        'reranker_ready': _RERANKER_READY,
        'generator_ready': _GENERATOR_READY,
        'hf_token_present': bool(_os.getenv('HF_TOKEN', '')),
        'overall': overall
    }


@app.options("/summarize-cv")
async def options_summarize_cv():
    return {"message": "OK"}

@app.post(
    "/summarize-cv",
    tags=["cv"],
    summary="Parse and analyse a PDF CV",
    response_description="Extracted skills, tools, roles, raw text, and hot-skill suggestions",
)
async def summarize_cv(file: UploadFile = File(...)):
    MAX_CV_BYTES = 10 * 1024 * 1024  # 10 MB hard cap (Vercel function memory ~512 MB)
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("application/pdf"):
            raise HTTPException(status_code=400, detail="Please upload a PDF file.")

        # Read file content (bounded)
        content = await file.read()
        if len(content) > MAX_CV_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_CV_BYTES // (1024 * 1024)} MB.",
            )

        # Extract text from PDF
        pdf_file = BytesIO(content)
        try:
            reader = PdfReader(pdf_file)
        except Exception:
            raise HTTPException(status_code=400, detail="Could not read PDF. The file may be corrupted or password-protected.")

        full_text = ""

        for page in reader.pages:
            try:
                page_text = page.extract_text()
            except Exception:
                # Skip unreadable pages instead of failing the whole upload
                continue
            if page_text:
                full_text += page_text + "\n"
        
        # Check if text was extracted
        if not full_text.strip():
            raise HTTPException(status_code=400, detail="No text found in PDF.")
        
        # Step 1: regex/keyword extraction (always runs, never fails)
        parsed_data = _summarize_cv_no_llm(full_text)

        # Step 2: best-effort LLM structuring server-side (additive). Falls
        # back silently to keyword-only output if HF_TOKEN is missing or HF
        # request fails — the frontend never sees a partial failure here.
        try:
            llm_struct = await _llm_structure_cv(full_text)
            for key in ('keySkills', 'toolsTechnologies', 'rolesAndDomains'):
                merged = list(dict.fromkeys(
                    [s for s in parsed_data.get(key, []) if s]
                    + [s for s in llm_struct.get(key, []) if s]
                ))
                parsed_data[key] = merged
        except Exception as merge_err:
            log.warning('[summarize-cv] LLM merge skipped: %s', merge_err)

        # Step 3: best-effort hot-skill suggestion (also server-side).
        try:
            hot_skills_suggestion = await _llm_hot_skills(parsed_data)
        except Exception as hs_err:
            log.warning('[summarize-cv] hot-skills skipped: %s', hs_err)
            hot_skills_suggestion = ''

        return {
            "data": parsed_data,
            "raw_text": full_text,
            "hotSkillsSuggestion": hot_skills_suggestion,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        error_message = f"Error processing CV: {str(e)}"
        raise HTTPException(status_code=500, detail=error_message)

# ---------------------------------------------------------------------------
# Interview routes live further down: POST /interview/question and
# POST /interview/evaluate (HF Llama via _hf_chat, server-side RAG).
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Feature 2 — Career DNA
# ---------------------------------------------------------------------------
@app.options("/career-dna")
async def options_career_dna():
    return {"message": "OK"}


@app.post(
    "/career-dna",
    tags=["analytics"],
    summary="Score skills across 5 Career DNA categories",
    response_description="ExplainabilityEnvelope with per-category scores, factors, and confidence",
)
async def career_dna(req: Dict[str, Any]):
    """Score the user across 5 DNA categories and return a full envelope.

    Accepted request shape (loose — accepts both raw lists and the
    shape returned by /summarize-cv):
      {
        "keySkills":          ["Python", ...],     # optional
        "toolsTechnologies":  ["Docker", ...],     # optional
        "skills":             ["..."]              # optional alias
      }
    """
    skills: List[str] = []
    for key in ("keySkills", "toolsTechnologies", "skills"):
        vals = req.get(key)
        if isinstance(vals, list):
            skills.extend([str(v) for v in vals if v])

    scores, factors = _score_career_dna(skills)

    basis = f"{len(scores)} categories scored \u00b7 {len(skills)} skills evaluated"
    envelope = _build_envelope(scores, factors, basis)
    envelope["scores"] = scores
    return envelope


# ---------------------------------------------------------------------------
# Feature 3 — Career Readiness Score
# ---------------------------------------------------------------------------
# Weighted aggregate (0-100). Weights are documented and MUST appear as
# weight_component / profile_field / interview_metric factors:
#   * Career DNA category average     -> 40% (weight_component)
#   * Profile completion percentage   -> 30% (profile_field)
#   * Latest mock interview score     -> 30% (interview_metric)
READINESS_WEIGHTS = {"dna": 0.40, "profile": 0.30, "interview": 0.30}


@app.options("/readiness-score")
async def options_readiness_score():
    return {"message": "OK"}


@app.post(
    "/readiness-score",
    tags=["analytics"],
    summary="Compute a 0–100 career readiness score",
    response_description="Weighted aggregate score: DNA 40% + Profile 30% + Interview 30%",
)
async def readiness_score(req: Dict[str, Any]):
    """Compute a 0-100 readiness score and return a full envelope.

    Request shape:
      {
        "skills":              ["..."]            # used to score DNA
        "dnaScores":           { "Frontend": 82 } # optional override
        "profileCompletion":   0-100              # required
        "interviewScore":      0-100 | null       # optional
      }
    """
    skills: List[str] = []
    for key in ("keySkills", "toolsTechnologies", "skills"):
        vals = req.get(key)
        if isinstance(vals, list):
            skills.extend([str(v) for v in vals if v])

    dna_scores = req.get("dnaScores")
    if not isinstance(dna_scores, dict) or not dna_scores:
        dna_scores, _ = _score_career_dna(skills)
    dna_avg = (sum(dna_scores.values()) / len(dna_scores)) if dna_scores else 0

    try:
        profile_completion = float(req.get("profileCompletion") or 0)
    except (TypeError, ValueError):
        profile_completion = 0.0
    profile_completion = max(0.0, min(100.0, profile_completion))

    interview_raw = req.get("interviewScore")
    try:
        interview = float(interview_raw) if interview_raw is not None else 0.0
    except (TypeError, ValueError):
        interview = 0.0
    interview = max(0.0, min(100.0, interview))
    has_interview = interview_raw is not None

    w = READINESS_WEIGHTS
    score = round(
        dna_avg * w["dna"]
        + profile_completion * w["profile"]
        + interview * w["interview"]
    )

    factors: List[Dict[str, Any]] = [
        {
            "label": f"Skills component: {round(dna_avg)}/100 \u00d7 {int(w['dna']*100)}% (weight_component)",
            "positive": dna_avg >= 50,
            "signal_type": "weight_component",
            "value": round(dna_avg, 1),
        },
        {
            "label": f"Profile {round(profile_completion)}% complete \u00d7 {int(w['profile']*100)}% (profile_field)",
            "positive": profile_completion >= 70,
            "signal_type": "profile_field",
            "value": round(profile_completion, 1),
        },
        {
            "label": (
                f"Interview score: {round(interview)}/100 \u00d7 {int(w['interview']*100)}% (interview_metric)"
                if has_interview
                else f"No interview score yet \u00d7 {int(w['interview']*100)}% (interview_metric)"
            ),
            "positive": has_interview and interview >= 60,
            "signal_type": "interview_metric",
            "value": round(interview, 1),
        },
    ]

    basis = "3 components scored \u00b7 weights: 40/30/30"
    envelope = _build_envelope(score, factors, basis)
    envelope["score"] = score
    envelope["components"] = {
        "dna": round(dna_avg, 1),
        "profileCompletion": round(profile_completion, 1),
        "interview": round(interview, 1),
    }
    return envelope


# ---------------------------------------------------------------------------
# Feature 4 — Explainability wrapper for skill gap + job match
# ---------------------------------------------------------------------------
# These endpoints DO NOT recompute scores — the frontend already does so
# in matchScore.js. They simply take a precomputed match result and wrap
# it into a valid ExplainabilityEnvelope so the same ReasoningCard can
# render it.
@app.options("/explain-match")
async def options_explain_match():
    return {"message": "OK"}


@app.post(
    "/explain-match",
    tags=["analytics"],
    summary="Wrap a job-match result in an ExplainabilityEnvelope",
    response_description="Factors, confidence, and signal types for a precomputed match score",
)
async def explain_match(req: Dict[str, Any]):
    """Wrap an existing job match result into an ExplainabilityEnvelope.

    Request shape:
      {
        "jobTitle": "...",
        "score": 0-100,
        "matchedSkills": ["..."],
        "missingSkills": ["..."],
        "breakdown": { "skillScore": 0-60,
                       "expScore":   0-20,
                       "trackScore": 0-20 }   # optional
      }
    """
    matched = [str(s) for s in (req.get("matchedSkills") or [])]
    missing = [str(s) for s in (req.get("missingSkills") or [])]
    breakdown = req.get("breakdown") or {}
    try:
        score = float(req.get("score") or 0)
    except (TypeError, ValueError):
        score = 0.0

    factors: List[Dict[str, Any]] = []
    for s in matched:
        factors.append({
            "label": f"{s} detected (skill_match)",
            "positive": True,
            "signal_type": "skill_match",
        })
    for s in missing:
        factors.append({
            "label": f"{s} missing (skill_match)",
            "positive": False,
            "signal_type": "skill_match",
        })

    if breakdown:
        weight_labels = {
            "skillScore": ("Skills component", 60),
            "expScore":   ("Experience component", 20),
            "trackScore": ("Track component", 20),
        }
        for key, (name, w) in weight_labels.items():
            if key in breakdown and breakdown[key] is not None:
                try:
                    val = float(breakdown[key])
                except (TypeError, ValueError):
                    continue
                factors.append({
                    "label": f"{name}: {round(val)}/{w} \u00d7 {w}% (weight_component)",
                    "positive": val >= (w / 2),
                    "signal_type": "weight_component",
                    "value": round(val, 1),
                })

    basis = (
        f"{len(matched)} skill(s) matched \u00b7 {len(missing)} skill(s) missing"
    )
    envelope = _build_envelope(score, factors, basis)
    envelope["score"] = score
    return envelope


# ---------------------------------------------------------------------------
# Feature 7 — Facial Expression Analysis: DELETED.
# Camera capture + emotion classification runs in the browser. Frontend
# calls trpakov/vit-face-expression on Hugging Face directly from
# frontend/src/components/FaceExpressionOverlay.jsx.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Feature 5 — Career Advice Q&A
# ---------------------------------------------------------------------------
@app.options("/career-advice")
async def options_career_advice():
    return {"message": "OK"}


@app.get(
    "/career-advice",
    tags=["data"],
    summary="Search career advice Q&A items",
    response_description="Matching advice items with optional keyword and tag filters",
)
async def career_advice(q: str = "", tag: str = "", limit: int = 5):
    """Return matching career advice items.

    Query params:
      q     - free-text keyword search against question + answer + tags
      tag   - filter by a specific tag (exact match, case-insensitive)
      limit - max results (default 5, max 20)
    """
    limit = max(1, min(limit, 20))
    items = _ADVICE_CACHE
    if not items:
        raise HTTPException(status_code=503, detail="Career advice data not loaded.")

    results = []
    q_lower = (q or "").lower().strip()
    tag_lower = (tag or "").lower().strip()

    for item in items:
        # Tag filter
        if tag_lower:
            item_tags = [t.lower() for t in item.get("tags", [])]
            if tag_lower not in item_tags:
                continue
        # Keyword filter
        if q_lower:
            haystack = " ".join([
                item.get("question", ""),
                item.get("answer", ""),
                " ".join(item.get("tags", [])),
                " ".join(item.get("related_skills", [])),
            ]).lower()
            if not any(token in haystack for token in q_lower.split() if len(token) > 2):
                continue
        results.append(item)
        if len(results) >= limit:
            break

    return {
        "items": results,
        "total": len(results),
        "query": q,
        "tag": tag,
    }


@app.post("/career-advice")
async def career_advice_post(req: Dict[str, Any]):
    """POST alias for /career-advice — accepts {q, tag, limit} JSON body."""
    q = req.get("q", "")
    tag = req.get("tag", "")
    limit = int(req.get("limit", 5))
    return await career_advice(q=q, tag=tag, limit=limit)


# ---------------------------------------------------------------------------
# Feature 6 — Skill Roadmaps
# ---------------------------------------------------------------------------
@app.options("/skill-roadmap")
async def options_skill_roadmap():
    return {"message": "OK"}


@app.get(
    "/skill-roadmap",
    tags=["data"],
    summary="Retrieve skill roadmaps by career track",
    response_description="Roadmap items optionally filtered by track (Frontend, Backend, DevOps, AI/ML)",
)
async def skill_roadmap(track: str = ""):
    """Return skill roadmaps, optionally filtered by track.

    Query params:
      track - filter by career track (e.g. Frontend, Backend, DevOps, AI/ML, Communication)
    """
    items = _ROADMAPS_CACHE
    if not items:
        raise HTTPException(status_code=503, detail="Skill roadmap data not loaded.")

    if track:
        track_lower = track.lower()
        items = [r for r in items if track_lower in r.get("track", "").lower()]

    return {
        "roadmaps": items,
        "total": len(items),
        "track_filter": track,
    }


@app.post("/skill-roadmap")
async def skill_roadmap_post(req: Dict[str, Any]):
    """POST alias for /skill-roadmap — accepts {track} JSON body."""
    track = req.get("track", "")
    return await skill_roadmap(track=track)


# ---------------------------------------------------------------------------
# Legacy /generate-interview-question and /evaluate-interview-answer routes
# (keyword-based heuristic stubs) were removed during the RAG → backend
# migration. The replacements are LLM-backed: see /interview/question and
# /interview/evaluate further down in this file.
# ---------------------------------------------------------------------------

# ── RAG GLOBALS ──────────────────────────────────────────────
# (stdlib imports: asyncio, math, os, re are all hoisted to top of file)

_CORPUS_EMBEDDINGS = []          # flat file fallback (kept for /health/dependencies)
_CORPUS_CHUNKS = []
_CHROMA_CLIENT = None
_CHROMA_COLLECTION = None
_LOCAL_EMBED_MODEL = None
_USE_LOCAL_EMBEDDINGS = _os.getenv('USE_LOCAL_EMBEDDINGS', 'true').lower() == 'true'
_ENABLE_RERANKER = _os.getenv('ENABLE_RERANKER', 'false').lower() == 'true'
_HF_TOKEN = _os.getenv('HF_TOKEN', '')
_QUERY_CACHE = {}                # query -> (sources, retrieval_path)
_LAST_EMBED_PATH = 'none'


def _clamped_env_float(name: str, default: float, lo: float, hi: float) -> float:
    try:
        return max(lo, min(hi, float(_os.getenv(name, str(default)))))
    except (TypeError, ValueError):
        return default


_RAG_ALPHA = _clamped_env_float('RAG_ALPHA', 0.5, 0.0, 1.0)
_RAG_DEBUG_ENABLED = _os.getenv('ENABLE_RAG_DEBUG', 'false').lower() == 'true'
_REFERENCE_STORE_PATH = _DATA_DIR / 'interview_references.json'

_ROLE_QUERY_EXPANSIONS: Dict[str, List[str]] = {
    'backend': ['api', 'rest', 'database', 'sql', 'server', 'fastapi'],
    'frontend': ['react', 'javascript', 'ui', 'html', 'css', 'browser'],
    'devops': ['docker', 'kubernetes', 'ci cd', 'cloud', 'linux'],
    'ai/ml': ['machine learning', 'python', 'pytorch', 'nlp', 'rag', 'embeddings'],
    'communication': ['product', 'leadership', 'writing', 'presentation', 'stakeholders'],
}

# ── Hybrid Search Globals (Tasks 1-5) ────────────────────────
_HYBRID_CORPUS: List[Dict] = []      # 157 raw items from seed_corpus.json
_HYBRID_READY: bool = False
_DF_CACHE: Dict[str, int] = {}       # token -> document frequency
_AVG_DOC_LEN: float = 0.0
_DOC_LENS: List[int] = []            # token count per item (parallel to _HYBRID_CORPUS)
_ITEM_EMBED_CACHE: Dict[str, List[float]] = {}  # item id -> embedding
_RERANKER_MODEL = None
_RERANKER_READY: bool = False
_GENERATOR_PIPELINE = None
_GENERATOR_READY: bool = False
_GENERATOR_MODEL_NAME = "microsoft/Phi-3-mini-4k-instruct"

# ── Track filter skill sets (closed, not imported) ───────────
FRONTEND_SKILLS = {
    "react", "vue", "angular", "html", "css", "javascript",
    "typescript", "tailwind", "nextjs", "vite", "svelte",
}
BACKEND_SKILLS = {
    "python", "node", "fastapi", "django", "flask", "express",
    "java", "spring", "postgresql", "mysql", "mongodb", "redis",
}
DEVOPS_SKILLS = {
    "docker", "kubernetes", "ci/cd", "terraform", "aws", "gcp",
    "azure", "nginx", "linux", "bash", "ansible", "github actions",
}
AIML_SKILLS = {
    "pytorch", "tensorflow", "scikit-learn", "pandas", "numpy",
    "hugging face", "transformers", "llm", "nlp", "computer vision",
    "ml", "ai", "langchain", "rag", "embeddings",
}

# ── Load corpus embeddings on startup (kept for /health/dependencies) ───
def _load_corpus():
    global _CORPUS_EMBEDDINGS, _CORPUS_CHUNKS
    try:
        if _EMBEDDINGS_PATH.exists():
            _CORPUS_EMBEDDINGS = _load_json(_EMBEDDINGS_PATH)
            count = len([c for c in _CORPUS_EMBEDDINGS if c.get('embedding')])
            log.info('Corpus embeddings loaded: %d chunks with embeddings', count)
        else:
            _CORPUS_EMBEDDINGS = []
            log.warning("corpus_embeddings.json not found at %s - keyword fallback only", _EMBEDDINGS_PATH)

        if _CHUNKS_PATH.exists():
            _CORPUS_CHUNKS = _load_json(_CHUNKS_PATH)
            log.info('Corpus chunks loaded: %d chunks', len(_CORPUS_CHUNKS))
        else:
            _CORPUS_CHUNKS = []
            log.warning('chunks.json not found at %s', _CHUNKS_PATH)
    except Exception as e:
        log.error('Corpus load error: %s', e)


# ── TASK 1 — Hybrid corpus loader ────────────────────────────
def _tokenize(text: str) -> List[str]:
    """Shared tokenizer: lowercase, strip non-alphanum, split."""
    return re.sub(r'[^a-z0-9 ]', ' ', text.lower()).split()


def _load_hybrid_corpus():
    """Load seed_corpus.json into _HYBRID_CORPUS and pre-compute BM25 stats."""
    global _HYBRID_CORPUS, _HYBRID_READY, _DF_CACHE, _AVG_DOC_LEN, _DOC_LENS
    try:
        seed_path = Path(__file__).resolve().parent / 'data' / 'seed_corpus.json'
        raw = _json.loads(seed_path.read_text(encoding='utf-8'))
        if not isinstance(raw, list):
            raise ValueError('seed_corpus.json is not a JSON array')

        _HYBRID_CORPUS = []
        for item in raw:
            # Normalise skills: jobs use skillsRequired, courses use relatedSkills
            skills = (
                item.get('skillsRequired')
                or item.get('relatedSkills')
                or item.get('skills')
                or []
            )
            item = dict(item)           # shallow copy so we don't mutate the source
            item['skills'] = [str(s) for s in skills if s]

            # Pre-compute token set for BM25
            token_text = (
                item.get('title', '') + ' ' +
                ' '.join(item['skills']) + ' ' +
                item.get('description', '')
            )
            item['_tokens'] = set(_tokenize(token_text))
            item['_token_list'] = _tokenize(token_text)   # list for TF counting
            _HYBRID_CORPUS.append(item)

        # Pre-compute per-item document lengths
        _DOC_LENS = [len(item['_token_list']) for item in _HYBRID_CORPUS]
        _AVG_DOC_LEN = sum(_DOC_LENS) / max(len(_DOC_LENS), 1)

        # Pre-compute document-frequency cache
        _DF_CACHE = {}
        for item in _HYBRID_CORPUS:
            for tok in item['_tokens']:
                _DF_CACHE[tok] = _DF_CACHE.get(tok, 0) + 1

        _HYBRID_READY = True
        log.info('[RAG] Hybrid corpus loaded: %d items', len(_HYBRID_CORPUS))
        log.info('[RAG] BM25 index: %d unique tokens, avg_doc_len=%.1f', len(_DF_CACHE), _AVG_DOC_LEN)

    except Exception as e:
        log.error('[RAG] Hybrid corpus load error: %s', e)
        _HYBRID_READY = False


# ── Local embedding model ─────────────────────────────────────
def _get_local_model():
    global _LOCAL_EMBED_MODEL
    if _LOCAL_EMBED_MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer
            _LOCAL_EMBED_MODEL = SentenceTransformer('all-mpnet-base-v2')
            log.info('Local embedding model loaded')
        except Exception as e:
            log.error('Local model load failed: %s', e)
    return _LOCAL_EMBED_MODEL


def _get_reranker():
    global _RERANKER_MODEL, _RERANKER_READY
    if not _ENABLE_RERANKER:
        _RERANKER_READY = False
        return None
    if _RERANKER_MODEL is None:
        try:
            from sentence_transformers import CrossEncoder
            _RERANKER_MODEL = CrossEncoder(
                "cross-encoder/ms-marco-MiniLM-L-6-v2",
                max_length=512,
            )
            _RERANKER_READY = True
            log.info("[RAG] Reranker loaded: cross-encoder/ms-marco-MiniLM-L-6-v2")
        except Exception as e:
            log.error("[RAG] Reranker load failed: %s", e)
            _RERANKER_READY = False
    return _RERANKER_MODEL


def _rerank(query: str, candidates: list[dict], top_n: int = 5) -> list[dict]:
    """
    Cross-encoder reranking of hybrid retrieval candidates.
    Falls back to hybrid score ordering if reranker unavailable.
    """
    reranker = _get_reranker()
    if not _RERANKER_READY or reranker is None or not candidates:
        return candidates[:top_n]
    try:
        pairs = []
        for c in candidates:
            passage = (
                c.get("title", "") + " " +
                " ".join(c.get("skills", c.get("skillsRequired", []))) + " " +
                c.get("description", "")[:400]
            )
            pairs.append((query, passage))
        scores = reranker.predict(pairs)
        for i, c in enumerate(candidates):
            c["_rerank_score"] = float(scores[i])
        reranked = sorted(candidates, key=lambda x: x["_rerank_score"], reverse=True)
        return reranked[:top_n]
    except Exception as e:
        log.warning("[RAG] Reranker inference failed: %s", e)
        return candidates[:top_n]


# LEGACY: replaced by _dense_score_all
def _hf_embed(text: str):
    """HF Inference API embedding. Returns None on failure."""
    global _LAST_EMBED_PATH
    if not _HF_TOKEN:
        return None
    try:
        import urllib.request
        url = (
            'https://api-inference.huggingface.co/pipeline/'
            'feature-extraction/sentence-transformers/all-mpnet-base-v2'
        )
        body = _json.dumps({
            'inputs': text,
            'options': {'wait_for_model': True}
        }).encode()
        req = urllib.request.Request(url, data=body, headers={
            'Authorization': f'Bearer {_HF_TOKEN}',
            'Content-Type': 'application/json',
            'X-Wait-For-Model': 'true',
        })
        with urllib.request.urlopen(req, timeout=5) as r:
            result = _json.loads(r.read())
        _LAST_EMBED_PATH = 'hf'
        return result[0] if isinstance(result[0], list) else result
    except Exception as e:
        log.warning('HF API embed failed: %s', e)
        return None


def _embed(text: str):
    """Get embedding vector for text. Returns None on failure."""
    global _LAST_EMBED_PATH
    _LAST_EMBED_PATH = 'none'

    # Try local model first
    if _USE_LOCAL_EMBEDDINGS or not _HF_TOKEN:
        try:
            m = _get_local_model()
            if m:
                _LAST_EMBED_PATH = 'local'
                return m.encode(text, normalize_embeddings=True).tolist()
        except Exception as e:
            log.warning('Local embed failed: %s', e)

    # Try HF API fallback
    if _HF_TOKEN:
        try:
            import urllib.request
            url = (
                'https://api-inference.huggingface.co/pipeline/'
                'feature-extraction/sentence-transformers/all-mpnet-base-v2'
            )
            body = _json.dumps({
                'inputs': text,
                'options': {'wait_for_model': True}
            }).encode()
            req = urllib.request.Request(url, data=body, headers={
                'Authorization': f'Bearer {_HF_TOKEN}',
                'Content-Type': 'application/json'
            })
            with urllib.request.urlopen(req, timeout=5) as r:
                result = _json.loads(r.read())
            _LAST_EMBED_PATH = 'hf'
            return result[0] if isinstance(result[0], list) else result
        except Exception as e:
            log.warning('HF API embed failed: %s', e)

    return None


# ── Warm the dense embedding cache (background thread at startup) ─
def _warm_embed_cache():
    """Embed all corpus items once and cache by item id. Non-blocking."""
    if not _HYBRID_CORPUS:
        return
    model = _get_local_model()
    if model is None:
        log.info("[RAG] Embedding cache warm skipped - local model unavailable")
        return
    warmed = 0
    for item in _HYBRID_CORPUS:
        item_id = item.get('id') or item.get('title', '')
        if item_id and item_id not in _ITEM_EMBED_CACHE:
            try:
                text = (
                    item.get('title', '') + '. ' +
                    ', '.join(item.get('skills', [])) + '. ' +
                    item.get('description', '')[:200]
                )
                emb = model.encode(text, normalize_embeddings=True).tolist()
                _ITEM_EMBED_CACHE[item_id] = emb
                warmed += 1
            except Exception as e:
                log.warning('[RAG] Embed warm error for %s: %s', item_id, e)
    log.info('[RAG] Embedding cache warmed: %d items', warmed)


# ── Cosine similarity (pure Python, no numpy) ─────────────────
def _cosine(a, b):
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# LEGACY: _keyword_search — used by old retrieve_sources only
def _keyword_search(query: str, top_k: int = 3):
    query_words = set(query.lower().split())
    scored = []
    for chunk in _CORPUS_EMBEDDINGS:
        text = (chunk.get('text', '') + ' ' + chunk.get('title', '')).lower()
        text_words = set(text.split())
        overlap = len(query_words & text_words)
        if overlap > 0:
            scored.append((overlap, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    seen, results = set(), []
    for _, chunk in scored:
        pid = chunk.get('parent_id', '')
        if pid not in seen:
            seen.add(pid)
            results.append(chunk)
        if len(results) == top_k:
            break
    return results


# ── TASK 2 — Profile-aware metadata filter ───────────────────
def _skill_overlaps(item_skills: List[str], skill_set: set) -> bool:
    """Case-insensitive skill overlap against a track skill set."""
    for skill in item_skills:
        norm = re.sub(r'[^a-z0-9 ]', ' ', (skill or '').lower()).strip()
        norm_compact = norm.replace(' ', '')
        tokens = set(norm.split())
        for sk in skill_set:
            sk_norm = re.sub(r'[^a-z0-9 ]', ' ', sk.lower()).strip()
            sk_compact = sk_norm.replace(' ', '')
            if sk_norm in norm or norm in sk_norm:
                return True
            if sk_compact and (sk_compact in norm_compact or norm_compact in sk_compact):
                return True
            if sk_norm in tokens or any(sk_norm == t for t in tokens):
                return True
    return False


def _filter_corpus(
    corpus: List[Dict],
    preferred_track: 'str | None' = None,
    experience_level: 'str | None' = None,
    source_type: 'str | None' = None,
) -> List[Dict]:
    """Narrow corpus by track and experience before scoring."""
    MIN_ITEMS = 10
    filtered = corpus

    allowed_types = _normalise_source_types(source_type)
    if allowed_types:
        candidate = [i for i in filtered if str(i.get('type', '')).lower() in allowed_types]
        if candidate:
            filtered = candidate

    if preferred_track and preferred_track.strip().lower() not in ('', 'general'):
        track_key = preferred_track.strip().lower()
        skill_map = {
            'frontend': FRONTEND_SKILLS,
            'backend': BACKEND_SKILLS,
            'devops': DEVOPS_SKILLS,
            'ai/ml': AIML_SKILLS,
        }
        skill_set = skill_map.get(track_key)
        if skill_set:
            candidate = [
                item for item in corpus
                if item.get('type') in ('job', 'course')
                and _skill_overlaps(item.get('skills', []), skill_set)
            ]
            if len(candidate) >= MIN_ITEMS:
                filtered = candidate

    if experience_level:
        lvl = experience_level.strip().lower()
        if lvl == 'beginner':
            filtered = (
                [i for i in filtered if i.get('type') == 'course'] +
                [i for i in filtered if i.get('type') != 'course']
            )
        elif lvl == 'advanced':
            filtered = (
                [i for i in filtered if i.get('type') == 'job'] +
                [i for i in filtered if i.get('type') != 'job']
            )

    return filtered


def _normalise_source_types(source_type: 'str | None') -> set[str]:
    if not source_type:
        return set()
    aliases = {
        'jobs': 'job',
        'roles': 'job',
        'courses': 'course',
        'resources': 'course',
        'advice': 'advice',
        'roadmaps': 'roadmap',
    }
    raw = re.split(r'[,| ]+', source_type.lower())
    allowed = {'job', 'course', 'advice', 'roadmap'}
    normalised = {aliases.get(item.strip(), item.strip()) for item in raw if item.strip()}
    return {item for item in normalised if item in allowed}


def _expand_query(query: str, preferred_track: 'str | None' = None) -> str:
    """Small synonym expansion; keeps BM25/dense queries CPU-cheap and deterministic."""
    base = (query or '').strip()
    q_l = base.lower()
    expansions: List[str] = []
    track = (preferred_track or '').strip().lower()
    if track in _ROLE_QUERY_EXPANSIONS:
        expansions.extend(_ROLE_QUERY_EXPANSIONS[track])
    for key, terms in _ROLE_QUERY_EXPANSIONS.items():
        if key in q_l or any(term in q_l for term in terms[:3]):
            expansions.extend(terms)
    if 'full stack' in q_l or 'fullstack' in q_l:
        expansions.extend(_ROLE_QUERY_EXPANSIONS['frontend'][:3])
        expansions.extend(_ROLE_QUERY_EXPANSIONS['backend'][:4])
    deduped = []
    for term in expansions:
        if term not in q_l and term not in deduped:
            deduped.append(term)
    return (base + ' ' + ' '.join(deduped[:10])).strip()


def _source_reason(source: Dict[str, Any], query: str) -> str:
    title = str(source.get('title') or 'this source')
    source_type = str(source.get('type') or 'source')
    skills = _source_meta(source).get('skills') or source.get('skills') or []
    query_tokens = set(_tokenize(query or ''))
    skill_hits = [
        str(skill) for skill in skills
        if query_tokens & set(_tokenize(str(skill)))
    ][:3]
    score = source.get('_hybrid_score', source.get('score', 0.0))
    if skill_hits:
        return f"Matched {source_type} '{title}' via skills: {', '.join(skill_hits)}."
    return f"Matched {source_type} '{title}' with retrieval score {score}."


def _with_source_reasons(sources: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    enriched = []
    for source in sources:
        item = dict(source)
        item['why_this_source'] = _source_reason(item, query)
        enriched.append(item)
    return enriched


def _retrieval_trace(
    retrieval_path: str,
    sources: List[Dict[str, Any]],
    started_at: float,
) -> Dict[str, Any]:
    return {
        'retrieval_path': retrieval_path,
        'top_source_ids': [
            str(s.get('id') or s.get('parent_id') or s.get('chunk_id') or s.get('title') or '')
            for s in sources[:8]
        ],
        'scores': [
            float(s.get('_hybrid_score', s.get('score', 0.0)) or 0.0)
            for s in sources[:8]
        ],
        'latency_ms': round((_time.perf_counter() - started_at) * 1000, 2),
    }


# ── TASK 3 — Pure-Python BM25 scorer ─────────────────────────
def _bm25_score(
    query_tokens: 'set[str]',
    item: Dict,
    item_idx: int,
    k1: float = 1.5,
    b: float = 0.75,
) -> float:
    """BM25 score for one item given a query token set."""
    N = len(_HYBRID_CORPUS)
    if N == 0:
        return 0.0
    token_list = item.get('_token_list', [])
    doc_len = _DOC_LENS[item_idx] if item_idx < len(_DOC_LENS) else len(token_list)
    avdl = _AVG_DOC_LEN or 1.0

    score = 0.0
    for tok in query_tokens:
        if tok not in item.get('_tokens', set()):
            continue
        # IDF
        df = _DF_CACHE.get(tok, 0)
        idf = math.log((N - df + 0.5) / (df + 0.5) + 1)
        # TF (exact count from token list)
        tf_raw = token_list.count(tok)
        tf = (tf_raw * (k1 + 1)) / (tf_raw + k1 * (1 - b + b * (doc_len / avdl)))
        score += idf * tf
    return score


# ── TASK 4 — Neutral dense scorer for fast corpus-only chat ───
async def _dense_score_all(
    query: str,
    corpus: List[Dict],
) -> List[float]:
    """
    Embeds the query and computes cosine similarity against
    each corpus item's cached embedding. Falls back to zeros
    if embedding fails so hybrid scoring degrades gracefully.
    """
    if not corpus:
        return []

    q_emb: list[float] = []
    try:
        hf_token = _os.getenv("HF_TOKEN", "")
        if hf_token:
            import httpx as _httpx
            async with _httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.post(
                    "https://api-inference.huggingface.co/pipeline/feature-extraction/"
                    "sentence-transformers/all-mpnet-base-v2",
                    headers={
                        "Authorization": f"Bearer {hf_token}",
                        "X-Wait-For-Model": "true",
                    },
                    json={"inputs": query, "options": {"wait_for_model": True}},
                )
                if resp.status_code == 200:
                    raw = resp.json()
                    q_emb = raw[0] if isinstance(raw[0], list) else raw
    except Exception:
        pass

    if not q_emb and _USE_LOCAL_EMBEDDINGS:
        try:
            model = _get_local_model()
            if model is not None:
                q_emb = model.encode(query, normalize_embeddings=True).tolist()
        except Exception as e:
            log.warning('[RAG] Dense embed failed: %s', e)
            return [0.0] * len(corpus)

    if not q_emb:
        return [0.0] * len(corpus)

    scores: list[float] = []
    for item in corpus:
        item_id = item.get("id", item.get("title", ""))
        item_emb = _ITEM_EMBED_CACHE.get(item_id)
        if item_emb:
            scores.append(_cosine(q_emb, item_emb))
        else:
            try:
                model = _get_local_model() if _USE_LOCAL_EMBEDDINGS else None
                if model is not None:
                    text = (
                        item.get("title", "") + " " +
                        " ".join(item.get("skills", item.get("skillsRequired", []))) + " " +
                        item.get("description", "")[:300]
                    )
                    emb = model.encode(text, normalize_embeddings=True).tolist()
                    _ITEM_EMBED_CACHE[item_id] = emb
                    scores.append(_cosine(q_emb, emb))
                else:
                    scores.append(0.0)
            except Exception:
                scores.append(0.0)
    return scores


# ── TASK 5 — Hybrid scorer with alpha weighting ───────────────
async def _hybrid_retrieve(
    query: str,
    corpus: List[Dict],
    top_k: int = 4,
    alpha: float = 0.5,
) -> List[Dict]:
    """BM25 + dense cosine hybrid retrieval. Returns top_k items."""
    if not corpus:
        return []

    # BM25 scores
    query_tokens = set(_tokenize(query))
    bm25_scores = [
        _bm25_score(query_tokens, item, idx)
        for idx, item in enumerate(corpus)
    ]
    max_bm25 = max(bm25_scores) if bm25_scores else 1.0
    if max_bm25 == 0:
        max_bm25 = 1.0
    bm25_norm = [s / max_bm25 for s in bm25_scores]

    # Dense scores
    dense_scores = await _dense_score_all(query, corpus)
    min_d = min(dense_scores) if dense_scores else 0.0
    max_d = max(dense_scores) if dense_scores else 1.0
    range_d = (max_d - min_d) or 1.0
    dense_norm = [(s - min_d) / range_d for s in dense_scores]

    # Hybrid combination
    combined = []
    for i, item in enumerate(corpus):
        h_score = alpha * dense_norm[i] + (1 - alpha) * bm25_norm[i]
        entry = dict(item)   # shallow copy; don't mutate the global corpus
        entry['_hybrid_score'] = round(h_score, 4)
        entry['_dense_score']  = round(dense_norm[i], 4)
        entry['_bm25_score']   = round(bm25_norm[i], 4)
        combined.append((h_score, entry))

    combined.sort(key=lambda x: x[0], reverse=True)
    sorted_items = [item for _, item in combined]
    top_candidates = sorted_items[:20]
    reranked = _rerank(query, top_candidates, top_n=top_k)
    return reranked


# ── TASK 6 — Lost-in-the-middle context window layout ─────────
def _build_context_window(chunks: List[Dict]) -> str:
    """Reorder chunks to place highest-scored items at top and bottom."""
    if not chunks:
        return ''

    # Reorder: [rank1, rank3, rank4, ..., rank2] so highest is at top,
    # second-highest is at bottom (lost-in-the-middle mitigation)
    if len(chunks) >= 2:
        reordered = [chunks[0]] + chunks[2:] + [chunks[1]]
    else:
        reordered = chunks[:]

    parts = [
        'CAREER GUIDANCE CONTEXT (use these sources to ground your answer):\n'
    ]
    for n, item in enumerate(reordered, start=1):
        item_type  = item.get('type', 'item').upper()
        item_title = item.get('title', 'Untitled')
        skills_str = ', '.join(item.get('skills', []))
        desc       = item.get('description', '')[:300]
        h_score    = item.get('_hybrid_score', 0.0)
        block = (
            f'=== SOURCE {n}: {item_type} \u2014 {item_title} ===\n'
            f'Skills: {skills_str}\n'
            f'Description: {desc}\n'
            f'Relevance score: {h_score}\n'
            f'---'
        )
        parts.append(block)

    return '\n\n'.join(parts)


# ── ChromaDB init (kept — used by /health/dependencies) ──────
def _init_chroma():
    global _CHROMA_CLIENT, _CHROMA_COLLECTION
    try:
        import chromadb
        host = _os.getenv('CHROMA_HOST', 'localhost')
        port = int(_os.getenv('CHROMA_PORT', '8001'))
        _CHROMA_CLIENT = chromadb.HttpClient(host=host, port=port)
        _CHROMA_COLLECTION = _CHROMA_CLIENT.get_or_create_collection(
            name='careerpath_chunks',
            metadata={'hnsw:space': 'cosine'}
        )
        if _CHROMA_COLLECTION.count() == 0:
            _populate_chroma()
        log.info('ChromaDB ready: %d chunks', _CHROMA_COLLECTION.count())
    except Exception as e:
        log.warning("ChromaDB unavailable (%s) - flat file fallback active", str(e))
        _CHROMA_CLIENT = None
        _CHROMA_COLLECTION = None


def _populate_chroma():
    if not _CORPUS_EMBEDDINGS:
        return
    ids, embeddings, docs, metas = [], [], [], []
    for c in _CORPUS_EMBEDDINGS:
        if not c.get('embedding'):
            continue
        ids.append(str(c['chunk_id']))
        embeddings.append(c['embedding'])
        docs.append(str(c.get('text', '')))
        metas.append({
            'parent_id': str(c.get('parent_id', '')),
            'type': str(c.get('type', '')),
            'title': str(c.get('title', '')),
            'source_type': str(c.get('metadata', {}).get('source_type', '')),
            'track': str(c.get('metadata', {}).get('track', '')),
            'level': str(c.get('metadata', {}).get('level', ''))
        })
    for i in range(0, len(ids), 500):
        _CHROMA_COLLECTION.add(
            ids=ids[i:i+500],
            embeddings=embeddings[i:i+500],
            documents=docs[i:i+500],
            metadatas=metas[i:i+500]
        )
    log.info('ChromaDB populated: %d chunks', len(ids))


# LEGACY: extract_search_query — kept for compatibility
def extract_search_query(message: str) -> str:
    stop_words = {
        'i', 'me', 'my', 'we', 'you', 'the', 'a', 'an', 'is', 'are', 'was', 'were',
        'be', 'been', 'have', 'has', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'can', 'may', 'might', 'how', 'what', 'when', 'where', 'who',
        'why', 'which', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
        'want', 'need', 'like', 'get', 'know', 'tell', 'help', 'please', 'about',
        'some', 'this', 'that', 'these', 'those', 'it', 'its', 'am', 'or', 'and'
    }
    words = message.lower().split()
    keywords = [w.strip('?,!.') for w in words if w.strip('?,!.') not in stop_words]
    result = ' '.join(keywords[:8])
    return result if result else message


# LEGACY: grade_sources — kept for compatibility
def grade_sources(query: str, sources: list) -> bool:
    if not sources:
        return False
    query_words = set(query.lower().split())
    for s in sources:
        combined = set(
            (s.get('title', '') + ' ' + s.get('text', '')).lower().split()
        )
        if query_words & combined:
            return True
    return False


# LEGACY: retrieve_sources — replaced by _hybrid_retrieve in /chat
# Kept here for any external references; /chat no longer calls this.
def retrieve_sources(query: str, top_k: int = 3):
    """
    LEGACY retrieval chain: cache -> chroma -> flat file cosine -> keyword.
    /chat now uses _hybrid_retrieve instead.
    Returns (sources_list, retrieval_path_string)
    """
    cache_key = query.lower().strip()
    if cache_key in _QUERY_CACHE:
        return _QUERY_CACHE[cache_key]

    # LEGACY ChromaDB semantic search
    if _CHROMA_COLLECTION is not None:
        try:
            q_emb = _embed(query)
            if q_emb:
                results = _CHROMA_COLLECTION.query(
                    query_embeddings=[q_emb],
                    n_results=top_k,
                    include=['documents', 'metadatas', 'distances']
                )
                sources = []
                seen = set()
                for i, doc in enumerate(results['documents'][0]):
                    meta = results['metadatas'][0][i]
                    pid = meta.get('parent_id', '')
                    if pid not in seen:
                        seen.add(pid)
                        sources.append({
                            'chunk_id': results['ids'][0][i],
                            'parent_id': pid,
                            'type': meta.get('type', ''),
                            'title': meta.get('title', ''),
                            'text': doc,
                            'score': round(1 - results['distances'][0][i], 3)
                        })
                if sources:
                    _QUERY_CACHE[cache_key] = (sources, 'chroma')
                    return sources, 'chroma'
        except Exception as e:
            log.warning('ChromaDB query failed: %s', e)

    # LEGACY flat file cosine search
    if _CORPUS_EMBEDDINGS:
        try:
            q_emb = _embed(query)
            if q_emb:
                scored = []
                for chunk in _CORPUS_EMBEDDINGS:
                    emb = chunk.get('embedding')
                    if emb:
                        scored.append((_cosine(q_emb, emb), chunk))
                scored.sort(key=lambda x: x[0], reverse=True)
                seen, sources = set(), []
                for score, chunk in scored:
                    pid = chunk.get('parent_id', '')
                    if pid not in seen:
                        seen.add(pid)
                        sources.append({**chunk, 'score': round(score, 3)})
                    if len(sources) == top_k:
                        break
                if sources:
                    path = _LAST_EMBED_PATH if _LAST_EMBED_PATH in ('local', 'hf') else 'local'
                    _QUERY_CACHE[cache_key] = (sources, path)
                    return sources, path
        except Exception as e:
            log.warning('Flat cosine search failed: %s', e)

    # LEGACY keyword fallback
    sources = _keyword_search(query, top_k)
    if sources:
        _QUERY_CACHE[cache_key] = (sources, 'keyword')
        return sources, 'keyword'

    return [], 'none'


# Chat answer builder
def _source_text(source: Dict[str, Any]) -> str:
    return str(source.get('text') or source.get('description') or source.get('snippet') or '')


def _source_meta(source: Dict[str, Any]) -> Dict[str, Any]:
    meta = source.get('metadata') or {}
    if not isinstance(meta, dict):
        meta = {}
    if not meta.get('skills') and source.get('skills'):
        meta = {**meta, 'skills': source.get('skills')}
    return meta


def _preview(text: str, limit: int) -> str:
    cleaned = ' '.join((text or '').split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit].rstrip() + '...'


def build_rag_answer(query: str, sources: list) -> str:
    """
    Build a rich conversational answer from RAG sources.
    Never apologizes or blocks by topic; it always provides useful guidance.
    """
    if isinstance(sources, str):
        sources = [{"type": "roadmap", "title": "Context Window", "text": sources}]
    if not sources:
        return _generate_general_answer(query)

    parts = []
    source_types = set(s.get('type', '') for s in sources)

    query_lower = query.lower()
    if any(w in query_lower for w in ['how', 'learn', 'start', 'begin', 'become']):
        opener = "Here's what you need to know:"
    elif any(w in query_lower for w in ['what', 'explain', 'define', 'tell']):
        opener = "Here's a breakdown:"
    elif any(w in query_lower for w in ['job', 'role', 'position', 'hire']):
        opener = "Based on available opportunities:"
    elif any(w in query_lower for w in ['course', 'learn', 'study', 'resource']):
        opener = "Here are the best learning resources:"
    elif any(w in query_lower for w in ['roadmap', 'path', 'plan', 'timeline']):
        opener = "Here's a structured path forward:"
    else:
        opener = "Here's what I found:"

    parts.append(opener)
    parts.append('')

    for idx, s in enumerate(sources[:3], start=1):
        s_type = s.get('type', '')
        s_title = s.get('title', '') or 'Source'
        s_text = _source_text(s)
        meta = _source_meta(s)
        citation = f"[S{idx}]"
        why = s.get('why_this_source')

        if s_type == 'job':
            skills = meta.get('skills', [])
            skills_mention = f" key skills: {', '.join(skills[:5])}" if skills else ''
            parts.append(f"- {citation} **{s_title}** (job) -{skills_mention}")
            parts.append(f"  {_preview(s_text, 200)}")
        elif s_type == 'course':
            skills = meta.get('skills', [])
            platform = meta.get('platform', '')
            cost = meta.get('cost', '')
            skills_mention = f" key skills: {', '.join(skills[:4])}" if skills else ''
            label = ' - '.join(str(x) for x in [platform, cost] if x)
            parts.append(f"- {citation} **{s_title}** (course){' - ' + label if label else ''}{skills_mention}")
            parts.append(f"  {_preview(s_text, 180)}")
        elif s_type == 'advice':
            clean = _preview(s_text, 300).replace('Q: ', '').replace(' A: ', '\n  ')
            parts.append(f"- {citation} {clean}")
        elif s_type == 'roadmap':
            parts.append(f"- {citation} **{s_title}**")
            parts.append(f"  {_preview(s_text, 250)}")
        else:
            parts.append(f"- {citation} **{s_title}**: {_preview(s_text, 200)}")
        if why:
            parts.append(f"  Why: {why}")

    parts.append('')
    parts.append('Citations: ' + ', '.join(
        f"[S{i}] {s.get('title', 'Source')}" for i, s in enumerate(sources[:3], start=1)
    ))
    parts.append('')
    parts.append(_get_followup_tip(query, source_types))

    return '\n'.join(parts)


def _verify_grounding(answer: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Cheap verifier stub: no model call, flags unsupported-looking answers."""
    if not sources:
        return {'grounded': False, 'warnings': ['No sources were retrieved.']}
    answer_l = (answer or '').lower()
    source_text = ' '.join(
        [str(s.get('title', '')) + ' ' + _source_text(s) for s in sources]
    ).lower()
    source_terms = {
        tok for tok in _tokenize(source_text)
        if len(tok) > 4 and tok not in {'source', 'skills', 'description'}
    }
    answer_terms = {
        tok for tok in _tokenize(answer_l)
        if len(tok) > 4 and tok not in {'career', 'skills', 'learn'}
    }
    overlap = len(answer_terms & source_terms)
    return {
        'grounded': overlap >= 2 or any(str(s.get('title', '')).lower() in answer_l for s in sources[:3]),
        'overlap_terms': overlap,
        'warnings': [] if overlap >= 2 else ['Low lexical overlap with retrieved sources.'],
    }


def _generate_general_answer(query: str) -> str:
    """Give a helpful career-domain answer when no source is retrieved."""
    query_lower = query.lower()

    if any(w in query_lower for w in ['frontend', 'react', 'css', 'html', 'javascript', 'vue', 'angular']):
        return (
            "For frontend development, start with HTML, CSS, and JavaScript fundamentals. "
            "React is a highly requested framework, so learn hooks, state management, and REST API integration. "
            "Build 3-5 portfolio projects and deploy them on Vercel or Netlify. "
            "Ask about specific frontend roles or React courses for more targeted advice."
        )
    if any(w in query_lower for w in ['backend', 'python', 'node', 'api', 'django', 'fastapi', 'express']):
        return (
            "For backend development, Python with FastAPI or Django is a strong path. "
            "Learn REST API design, database management with PostgreSQL, and authentication with JWT. "
            "Docker is useful for deployment and team workflows. "
            "Ask about specific backend roles or Python courses for detailed guidance."
        )
    if any(w in query_lower for w in ['devops', 'docker', 'kubernetes', 'aws', 'ci', 'cd', 'cloud']):
        return (
            "DevOps starts with Linux and Docker fundamentals. "
            "Learn CI/CD with GitHub Actions, infrastructure as code with Terraform, and container orchestration with Kubernetes. "
            "AWS certification can be valuable when paired with hands-on projects. "
            "Ask about specific DevOps roles or Docker courses for more detail."
        )
    if any(w in query_lower for w in ['machine learning', 'ml', 'ai', 'data science', 'pytorch', 'tensorflow']):
        return (
            "For AI/ML, start with Python, pandas, and scikit-learn. "
            "Then move into deep learning with PyTorch and NLP workflows with Hugging Face tools. "
            "Build small projects that show data cleaning, training, evaluation, and deployment. "
            "Ask about specific ML roles or courses for a detailed learning path."
        )
    if any(w in query_lower for w in ['salary', 'negotiate', 'pay', 'compensation']):
        return (
            "Tech salaries vary by role, experience, and location. "
            "Research market rates on LinkedIn Jobs and local job boards before interviews. "
            "Multiple offers improve negotiation leverage, and specialized skills usually raise compensation. "
            "Ask about a specific role to get more targeted salary insight."
        )
    if any(w in query_lower for w in ['interview', 'prepare', 'question', 'technical', 'hiring']):
        return (
            "Technical interview preparation has three pillars: data structures and algorithms, system design for senior roles, "
            "and project-based discussions about your portfolio work. "
            "Practice mock interviews and research the company's tech stack beforehand. "
            "Ask about interview questions by difficulty to practice."
        )
    if any(w in query_lower for w in ['portfolio', 'project', 'github', 'build']):
        return (
            "A strong portfolio has 3-5 projects that solve real problems. "
            "Include a fullstack web app, a REST API project, and ideally one AI or data project. "
            "Deploy everything to live URLs and write clear READMEs with screenshots and setup instructions. "
            "Quality beats quantity: one impressive project is better than many tutorial clones."
        )
    return (
        "CareerPath covers frontend, backend, DevOps, AI/ML, and communication career tracks. "
        "You can explore job roles, learning resources, career roadmaps, interview preparation, salary guidance, "
        "and skill development. "
        "Good starting questions include: 'How do I become a React developer?' or "
        "'What skills do I need for machine learning?'"
    )


def _get_followup_tip(query: str, source_types: set) -> str:
    """Generate a contextual follow-up suggestion."""
    query_lower = query.lower()
    if 'job' in source_types and 'course' not in source_types:
        return "Next step: ask about courses or learning resources to build these skills."
    if 'course' in source_types and 'job' not in source_types:
        return "Next step: ask about job roles that use these skills to see career opportunities."
    if 'roadmap' in source_types:
        return "Next step: ask about a specific stage or skill in this roadmap for more detail."
    if 'advice' in source_types:
        return "Next step: ask about courses or job roles related to this topic."
    if any(w in query_lower for w in ['how', 'learn', 'start']):
        return "Next step: ask about job roles in this area to see what employers expect."
    return "Next step: ask a follow-up question to dive deeper into any of these topics."


@app.options('/chat')
async def options_chat():
    return {'message': 'OK'}


@app.post(
    '/chat',
    response_model=ChatResponse,
    tags=["chat"],
    summary="Hybrid RAG career Q&A",
    response_description="Answer, sources, explainability factors, confidence, and retrieval path",
)
async def chat(body: ChatRequest):
    """Hybrid RAG career assistant."""
    try:
        started_at = _time.perf_counter()
        user_message = (body.message or '').strip()
        # Clip absurdly long client-side histories defensively (Firestore can
        # accumulate 100+ turns across sessions).
        history = (body.history or [])[-50:]
        if not user_message:
            raise HTTPException(status_code=400, detail='message field is required')

        preferred_track = body.preferred_track or body.preferredTrack
        experience_level = body.experience_level or body.experienceLevel
        source_type = body.source_type or body.sourceType
        query = extract_search_query(user_message)
        expanded_query = _expand_query(query, preferred_track)

        if _HYBRID_READY:
            filtered = _filter_corpus(
                _HYBRID_CORPUS,
                preferred_track=preferred_track,
                experience_level=experience_level,
                source_type=source_type,
            )
            top_chunks = await _hybrid_retrieve(expanded_query, filtered, top_k=20, alpha=_RAG_ALPHA)
            retrieval_path = f'hybrid_alpha_{_RAG_ALPHA:g}'
            sources = [
                {
                    'id': c.get('id', c.get('title', '')),
                    'parent_id': c.get('id', c.get('title', '')),
                    'type': c.get('type', ''),
                    'title': c.get('title', ''),
                    'text': c.get('description', ''),
                    'description': c.get('description', ''),
                    'metadata': {
                        'skills': c.get('skills', []),
                        'track': c.get('track', ''),
                        'level': c.get('level', ''),
                    },
                    'score': c.get('_hybrid_score', 0),
                }
                for c in top_chunks
            ]
        else:
            top_chunks = []
            retrieval_path = 'none'
            sources = []

        sources = _with_source_reasons(sources, query)
        if not grade_sources(query, sources):
            fallback_sources = _keyword_search(user_message, top_k=4)
            fallback_path = 'keyword'
            if fallback_sources:
                sources = _with_source_reasons(fallback_sources, query)
                retrieval_path = fallback_path

        factors = [
            {
                'label': f"{s.get('title', 'Source')} (rag_source)",
                'positive': True,
                'signal_type': 'rag_source',
                'value': s.get('score', s.get('type', '')),
            }
            for s in sources
        ]

        response_text = build_rag_answer(query, sources)
        used_fallback = retrieval_path in ('keyword', 'none')
        has_strong = any(
            f['signal_type'] in ('rag_source', 'skill_match')
            for f in factors
        )
        if len(factors) >= 3 and has_strong and not used_fallback:
            confidence = 'High'
        elif len(factors) >= 1 and not used_fallback:
            confidence = 'Medium'
        else:
            confidence = 'Low'

        response_sources = [
            {
                'id': s.get('parent_id', s.get('chunk_id', s.get('id', ''))),
                'type': s.get('type', ''),
                'title': s.get('title', ''),
                'snippet': _source_text(s)[:120],
                'score': float(s.get('score', 0.0) or 0.0),
                'why_this_source': s.get('why_this_source'),
            }
            for s in sources
        ]

        basis = f"RAG retrieval via {retrieval_path}. Query: '{query}'. Expanded: '{expanded_query}'"
        context_window = _build_context_window(top_chunks) if _HYBRID_READY else ''
        profile_hints = []
        if preferred_track:
            profile_hints.append(f"Target track: {preferred_track}")
        if experience_level:
            profile_hints.append(f"Experience: {experience_level}")
        profile_summary = "; ".join(profile_hints)

        answer_text = _generate_rag_answer(
            query=query,
            context_window=context_window,
            profile_summary=profile_summary,
            max_new_tokens=400,
            sources=sources,
        )
        grounding = _verify_grounding(answer_text, sources)
        trace = _retrieval_trace(retrieval_path, sources, started_at)
        log.info(
            '[RAG] path=%s top_source_ids=%s scores=%s latency_ms=%s',
            trace['retrieval_path'], trace['top_source_ids'], trace['scores'], trace['latency_ms'],
        )
        return {
            'response': answer_text,
            'reply': answer_text,
            'sources': response_sources,
            'factors': factors,
            'confidence': confidence,
            'basis': basis,
            'retrieval_path': retrieval_path,
            'signal_types_used': ['rag_source'] if factors else [],
            'generation_model': _GENERATOR_MODEL_NAME if _GENERATOR_READY else 'template',
            'grounding_verification': grounding,
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error('Error in chat endpoint: %s', e)
        raise HTTPException(status_code=500, detail=f'Chat error: {e}')


def _load_generator():
    """
    Loads Phi-3-mini in a background thread.
    Sets _GENERATOR_READY = True when done.
    Falls back gracefully to template generation if unavailable.

    Disabled by default on resource-constrained deploys (HF Spaces Free Tier
    has only 16 GB RAM and Phi-3 needs ~4-8 GB at inference plus a ~4 GB
    one-time download). Flip ENABLE_LLM_GENERATOR=true to opt in.
    """
    global _GENERATOR_PIPELINE, _GENERATOR_READY
    if _os.getenv("ENABLE_LLM_GENERATOR", "false").lower() != "true":
        log.info("[GEN] ENABLE_LLM_GENERATOR is not 'true' - using template fallback.")
        _GENERATOR_READY = False
        return
    try:
        import torch
        from transformers import pipeline as hf_pipeline
        log.info("[GEN] Loading %s ...", _GENERATOR_MODEL_NAME)
        _GENERATOR_PIPELINE = hf_pipeline(
            "text-generation",
            model=_GENERATOR_MODEL_NAME,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto",
            trust_remote_code=True,
        )
        _GENERATOR_READY = True
        log.info("[GEN] %s ready.", _GENERATOR_MODEL_NAME)
    except Exception as e:
        log.error("[GEN] Generator load failed (template fallback active): %s", e)
        _GENERATOR_READY = False


def _generate_rag_answer(
    query: str,
    context_window: str,
    profile_summary: str = "",
    max_new_tokens: int = 400,
    sources: 'list | None' = None,
) -> str:
    """
    Generates a grounded answer using Phi-3-mini.
    Falls back to build_rag_answer() template if generator not ready.
    """
    fallback_sources = sources or []
    if not _GENERATOR_READY or _GENERATOR_PIPELINE is None:
        return build_rag_answer(query, fallback_sources) if callable(
            globals().get("build_rag_answer")
        ) else "I'm still loading. Please try again in a moment."

    prompt = (
        "<|system|>\n"
        "You are CareerPath AI, a career guidance assistant for students and fresh graduates. "
        "Answer ONLY using the context provided. Be specific, cite sources as [S1], [S2], etc., and keep your answer under 200 words.\n"
        "<|end|>\n"
        f"<|user|>\nCONTEXT:\n{context_window}\n\n"
        + (f"USER PROFILE:\n{profile_summary}\n\n" if profile_summary else "")
        + f"QUESTION: {query}\n"
        "<|end|>\n<|assistant|>\n"
    )
    try:
        result = _GENERATOR_PIPELINE(
            prompt,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            temperature=1.0,
            repetition_penalty=1.1,
            return_full_text=False,
        )
        return result[0]["generated_text"].strip()
    except Exception as e:
        log.error("[GEN] Generation failed: %s", e)
        return build_rag_answer(query, fallback_sources) if callable(
            globals().get("build_rag_answer")
        ) else "Generation failed. Please try again."


# ===========================================================================
# RAG → BACKEND MIGRATION (server-side HF LLM endpoints)
# ---------------------------------------------------------------------------
# These routes replace the browser-direct HF calls that previously lived in
# frontend/src/services/{ragPipeline,interviewAI,corpusLoader}.js.
# The frontend now POSTs structured payloads and the backend handles HF
# retrieval + generation. Token lives ONLY in backend/.env as HF_TOKEN.
# ===========================================================================
# (_asyncio already imported at module top)

_HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions'
_HF_CHAT_MODEL = 'meta-llama/Llama-3.1-8B-Instruct'
_HF_CHAT_TIMEOUT = 30
_HF_CHAT_MAX_RETRIES = 3

_LLM_SYSTEM_PROMPT = (
    'You are CareerPath Assistant — a highly professional, objective career consultant '
    'and technical interview expert. Maintain a formal, authoritative, and direct tone. '
    'Provide actionable, high-impact advice without unnecessary colloquialisms. '
    'Always ground your answers in the candidate context when provided.'
)


def _hf_chat_sync(
    user_content: str,
    max_tokens: int = 512,
    temperature: float = 0.7,
) -> str:
    """Blocking POST to HF chat-completions router. Returns assistant text.

    Raises RuntimeError on token-missing or all-retries-exhausted.
    """
    if not _HF_TOKEN:
        raise RuntimeError('HF_TOKEN is not set on the backend.')

    import urllib.request
    import urllib.error
    import time

    body = _json.dumps({
        'model': _HF_CHAT_MODEL,
        'messages': [
            {'role': 'system', 'content': _LLM_SYSTEM_PROMPT},
            {'role': 'user', 'content': user_content},
        ],
        'max_tokens': max_tokens,
        'temperature': temperature,
        'stream': False,
    }).encode('utf-8')

    headers = {
        'Authorization': f'Bearer {_HF_TOKEN}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Wait-For-Model': 'true',
    }

    last_err = None
    for attempt in range(_HF_CHAT_MAX_RETRIES):
        try:
            req = urllib.request.Request(_HF_CHAT_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, timeout=_HF_CHAT_TIMEOUT) as r:
                payload = _json.loads(r.read())
            try:
                return (payload['choices'][0]['message']['content'] or '').strip()
            except (KeyError, IndexError, TypeError):
                raise RuntimeError(f'Unexpected HF chat payload: {payload}')
        except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
            last_err = e
            if e.code in (429, 503):
                time.sleep(min(5 * (2 ** attempt), 20))
                continue
            try:
                detail = e.read().decode('utf-8', errors='ignore')[:300]
            except Exception:
                detail = ''
            raise RuntimeError(f'HF chat HTTP {e.code}: {detail}')
        except Exception as e:
            last_err = e
            time.sleep(1.0 * (2 ** attempt))
    raise RuntimeError(f'HF chat exhausted retries: {last_err}')


async def _hf_chat(
    user_content: str,
    max_tokens: int = 512,
    temperature: float = 0.7,
) -> str:
    """Async wrapper — runs blocking HF call in a worker thread."""
    return await _asyncio.to_thread(
        _hf_chat_sync, user_content, max_tokens, temperature
    )


def _profile_summary(profile: 'Dict[str, Any] | None') -> str:
    """Compact one-liner describing the candidate; safe on missing fields."""
    if not isinstance(profile, dict):
        return ''
    skills = profile.get('skills') or []
    if isinstance(skills, list):
        skills_s = ', '.join(str(s) for s in skills if s)[:300]
    else:
        skills_s = str(skills)[:300]
    tools = profile.get('toolsTechnologies') or []
    if isinstance(tools, list):
        tools_s = ', '.join(str(t) for t in tools if t)[:300]
    else:
        tools_s = str(tools)[:300]
    parts = []
    if skills_s:
        parts.append(f'Skills: {skills_s}')
    if tools_s:
        parts.append(f'Tools: {tools_s}')
    level = profile.get('experienceLevel') or profile.get('level')
    if level:
        parts.append(f'Experience level: {level}')
    track = profile.get('preferredTrack') or profile.get('track')
    if track:
        parts.append(f'Preferred track: {track}')
    return ' \u00b7 '.join(parts)


async def _rag_context(
    query: str,
    profile: 'Dict[str, Any] | None' = None,
    top_k: int = 4,
) -> str:
    """Server-side RAG: filter corpus by profile, hybrid-retrieve, format."""
    if not _HYBRID_READY or not _HYBRID_CORPUS:
        return ''
    preferred_track = None
    experience_level = None
    if isinstance(profile, dict):
        preferred_track = profile.get('preferredTrack') or profile.get('track')
        experience_level = (
            profile.get('experienceLevel') or profile.get('level')
        )
        source_type = profile.get('sourceType') or profile.get('source_type')
    else:
        source_type = None
    expanded_query = _expand_query(query, preferred_track)
    filtered = _filter_corpus(
        _HYBRID_CORPUS,
        preferred_track=preferred_track,
        experience_level=experience_level,
        source_type=source_type,
    )
    try:
        top = await _hybrid_retrieve(expanded_query, filtered, top_k=top_k, alpha=_RAG_ALPHA)
    except Exception as e:
        log.warning('[rag_context] retrieve failed: %s', e)
        return ''
    return _build_context_window(top)


@app.get(
    '/debug/rag',
    tags=['health'],
    summary='Inspect RAG retrieval for a test query',
    response_description='Dev-only retrieval trace with source ids, scores, and latency',
)
async def debug_rag(
    query: str,
    preferredTrack: str | None = None,
    experienceLevel: str | None = None,
    sourceType: str | None = None,
    top_k: int = 5,
):
    if not _RAG_DEBUG_ENABLED:
        raise HTTPException(status_code=404, detail='RAG debug disabled')
    if not _HYBRID_CORPUS:
        _load_hybrid_corpus()

    started_at = _time.perf_counter()
    safe_top_k = max(1, min(int(top_k or 5), 20))
    expanded_query = _expand_query(query, preferredTrack)
    filtered = _filter_corpus(
        _HYBRID_CORPUS,
        preferred_track=preferredTrack,
        experience_level=experienceLevel,
        source_type=sourceType,
    ) if _HYBRID_READY else []

    top: List[Dict[str, Any]] = []
    retrieval_path = f'hybrid_alpha_{_RAG_ALPHA:g}' if filtered else 'none'
    if filtered:
        try:
            top = await _hybrid_retrieve(
                expanded_query,
                filtered,
                top_k=safe_top_k,
                alpha=_RAG_ALPHA,
            )
        except Exception as e:
            log.warning('[debug-rag] retrieve failed: %s', e)
            retrieval_path = 'retrieve_error'

    sources = _with_source_reasons([_source_summary(item) for item in top], query)
    trace = _retrieval_trace(retrieval_path, sources, started_at)
    return {
        'enabled': True,
        'query': query,
        'expanded_query': expanded_query,
        'alpha': _RAG_ALPHA,
        'filters': {
            'preferredTrack': preferredTrack,
            'experienceLevel': experienceLevel,
            'sourceType': sourceType,
        },
        'retrieval_path': trace['retrieval_path'],
        'top_source_ids': trace['top_source_ids'],
        'scores': trace['scores'],
        'latency_ms': trace['latency_ms'],
        'sources': sources,
    }


def _strip_code_fences(text: str) -> str:
    return (
        re.sub(r'```(?:json)?', '', text or '', flags=re.IGNORECASE)
        .replace('```', '')
        .strip()
    )


def _safe_json_parse(text: str):
    """Extract the first JSON object or array from a model response."""
    if not text:
        return None
    cleaned = _strip_code_fences(text)
    starts = [(cleaned.find('{'), cleaned.rfind('}'))]
    starts.append((cleaned.find('['), cleaned.rfind(']')))
    for start, end in starts:
        if start != -1 and end != -1 and end > start:
            try:
                return _json.loads(cleaned[start:end + 1])
            except Exception:
                continue
    try:
        return _json.loads(cleaned)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# POST /roadmap — replaces frontend generateCareerRoadmap()
# ---------------------------------------------------------------------------
@app.options('/roadmap')
async def options_roadmap():
    return {'message': 'OK'}


@app.post(
    '/roadmap',
    tags=["roadmap"],
    summary="Generate a personalised career roadmap",
    response_description="Markdown roadmap with assessment, skills gap, step-by-step path, and resources",
)
async def roadmap(req: Dict[str, Any]):
    goal_job = (req.get('goalJob') or '').strip()
    if not goal_job:
        raise HTTPException(status_code=400, detail='goalJob is required')
    profile = req.get('profile') or {}
    level = (
        profile.get('experienceLevel') or profile.get('level') or 'beginner'
    )
    skills_list = profile.get('skills') if isinstance(profile, dict) else None
    if isinstance(skills_list, list) and skills_list:
        skills_s = ', '.join(str(s) for s in skills_list if s)
    else:
        skills_s = 'none listed'

    context = await _rag_context(
        f'{goal_job} skills roadmap for {level} candidate', profile, top_k=5,
    )

    user_prompt = (
        (f'{context}\n\n---\n\n' if context else '')
        + 'Produce a structured roadmap in clean markdown.\n\n'
        + f'Candidate profile:\n- Experience level: {level}\n'
        + f'- Current skills: {skills_s}\n- Goal role: {goal_job}\n\n'
        + 'Sections (use ## headers):\n'
        + '1. Current Assessment\n2. Skills Gap (4-6 bullets)\n'
        + '3. Step-by-Step Path (5-7 numbered steps)\n4. Timeline (per step)\n'
        + '5. Recommended Resources\n6. Quick Wins (2-3 bullets)'
    )

    try:
        content = await _hf_chat(user_prompt, max_tokens=900, temperature=0.65)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f'Roadmap generation failed: {e}')

    return {'content': content}


# ---------------------------------------------------------------------------
# POST /interview/question — replaces frontend generateInterviewQuestion()
# ---------------------------------------------------------------------------
_REFERENCE_STORE: Dict[str, Dict[str, Any]] = {}


def _load_reference_store() -> None:
    global _REFERENCE_STORE
    if not _REFERENCE_STORE and _REFERENCE_STORE_PATH.exists():
        try:
            data = _json.loads(_REFERENCE_STORE_PATH.read_text(encoding='utf-8'))
            if isinstance(data, dict):
                _REFERENCE_STORE = {
                    str(k): v for k, v in data.items()
                    if isinstance(v, dict)
                }
        except Exception as e:
            log.warning('[interview-rag] reference store load skipped: %s', e)


def _persist_reference_store() -> None:
    try:
        _REFERENCE_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _REFERENCE_STORE_PATH.write_text(
            _json.dumps(_REFERENCE_STORE, ensure_ascii=False),
            encoding='utf-8',
        )
    except Exception as e:
        log.warning('[interview-rag] reference store persist skipped: %s', e)


def _role_question_key(role: str, difficulty: str) -> str:
    role_key = re.sub(r'[^a-z0-9]+', '-', (role or 'role').lower()).strip('-')
    diff_key = re.sub(r'[^a-z0-9]+', '-', (difficulty or 'medium').lower()).strip('-')
    return f'role-history:{role_key}:{diff_key}'


def _recent_role_questions(role: str, difficulty: str, limit: int = 8) -> List[str]:
    _load_reference_store()
    payload = _REFERENCE_STORE.get(_role_question_key(role, difficulty)) or {}
    questions = payload.get('questions') if isinstance(payload, dict) else []
    return [str(q)[:300] for q in questions if q][-limit:] if isinstance(questions, list) else []


def _store_role_question(role: str, difficulty: str, question: str) -> None:
    if not question:
        return
    key = _role_question_key(role, difficulty)
    existing = _recent_role_questions(role, difficulty, limit=20)
    questions = [q for q in existing if q != question]
    questions.append(question[:300])
    _REFERENCE_STORE[key] = {'questions': questions[-20:]}
    _persist_reference_store()


def _infer_track_from_role(role: str) -> str:
    """Map a free-form interview role to a corpus track."""
    text = (role or '').lower()
    if any(k in text for k in ('frontend', 'front-end', 'react', 'ui', 'ux', 'mobile')):
        return 'Frontend'
    if any(k in text for k in ('backend', 'back-end', 'api', 'server', 'full stack', 'fullstack')):
        return 'Backend'
    if any(k in text for k in ('devops', 'cloud', 'sre', 'site reliability', 'platform')):
        return 'DevOps'
    if any(k in text for k in ('data', 'machine learning', 'ml', 'ai', 'scientist')):
        return 'AI/ML'
    if any(k in text for k in ('product', 'manager', 'writer', 'success')):
        return 'Communication'
    return 'Backend'


def _source_summary(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'id': str(item.get('id') or item.get('parent_id') or item.get('title') or '')[:80],
        'type': str(item.get('type') or '')[:40],
        'title': str(item.get('title') or 'Career source')[:120],
        'snippet': _source_text(item)[:180],
        'score': float(item.get('_hybrid_score', item.get('score', 0.0)) or 0.0),
    }


async def _get_interview_rag_context(
    role: str,
    difficulty: str,
    profile: Dict[str, Any] | None = None,
    top_k: int = 4,
) -> Dict[str, Any]:
    """Retrieve interview-relevant context, sources, and skills."""
    if not _HYBRID_CORPUS:
        _load_hybrid_corpus()
    track = _infer_track_from_role(role)
    query = f'{difficulty} {role} interview skills project APIs databases examples'
    expanded_query = _expand_query(query, track)
    filtered = _filter_corpus(
        _HYBRID_CORPUS,
        preferred_track=track,
        experience_level=(difficulty or '').lower(),
    ) if _HYBRID_READY and _HYBRID_CORPUS else []
    top: List[Dict[str, Any]] = []
    if filtered:
        try:
            top = await _hybrid_retrieve(expanded_query, filtered, top_k=top_k, alpha=_RAG_ALPHA)
        except Exception as e:
            log.warning('[interview-rag] retrieve failed: %s', e)
            top = []
    if not top:
        top = [
            i for i in (_HYBRID_CORPUS or [])
            if str(i.get('track', '')).lower() == track.lower()
        ][:top_k]
    skills: List[str] = []
    for item in top:
        raw_skills = item.get('skills') or item.get('skillsRequired') or item.get('relatedSkills') or []
        for skill in raw_skills:
            s = str(skill).strip()
            if s and s not in skills:
                skills.append(s)
    if not skills:
        skills = {
            'Frontend': ['React', 'JavaScript', 'HTML', 'CSS'],
            'Backend': ['REST APIs', 'SQL', 'FastAPI', 'Docker'],
            'DevOps': ['Docker', 'CI/CD', 'Linux', 'Cloud'],
            'AI/ML': ['Python', 'ML', 'Data analysis', 'Model evaluation'],
            'Communication': ['Communication', 'Product thinking', 'User research'],
        }.get(track, ['Problem solving'])
    return {
        'track': track,
        'context': _build_context_window(top) if top else '',
        'sources': _with_source_reasons([_source_summary(i) for i in top], query),
        'skills_tested': skills[:6],
        'rag_grounded': bool(top),
    }


async def _generate_reference_answer(
    question: str,
    role: str,
    difficulty: str,
    skills_tested: List[str],
    context: str = '',
) -> str:
    """Generate or synthesize a reference answer for rubric anchoring."""
    skill_line = ', '.join(skills_tested[:5]) or 'role fundamentals'
    fallback = (
        f'A strong {role or "candidate"} answer should define the core concept, '
        f'connect it to {skill_line}, describe implementation choices, mention '
        'trade-offs or failure modes, and include a concrete project example.'
    )
    job_context = context
    prompt = (
        f"You are a senior {role} interviewer.\n\n"
        f"INTERVIEW QUESTION: {question}\n"
        f"ROLE: {role}\n"
        f"DIFFICULTY: {difficulty}\n"
        + (
            f"JOB CONTEXT (background reference only - "
            f"do NOT use job skills as must_mention):\n"
            f"{job_context[:300]}\n\n"
            if job_context else "\n"
        )
        + "TASK: Generate the ideal answer and scoring rubric "
        "for the interview question above.\n\n"
        "CRITICAL RULE FOR must_mention:\n"
        "must_mention items MUST be answer concepts - the theoretical "
        "or practical ideas that a correct answer to THIS SPECIFIC "
        "QUESTION needs to explain or demonstrate.\n"
        "must_mention items MUST NOT be job skills, tools, or "
        "technologies from the job description.\n\n"
        "CORRECT must_mention examples for a REST API question:\n"
        "  statelessness, HTTP verbs, resource-based URLs, "
        "status codes, client-server separation\n"
        "WRONG must_mention examples (never use these patterns):\n"
        "  Python, SQL, Git, Docker, FastAPI, JavaScript, "
        "Node.js, any tool or language name\n\n"
        "CORRECT must_mention examples for a database question:\n"
        "  ACID properties, normalization, indexing, "
        "query optimization, transactions\n"
        "WRONG must_mention examples for a database question:\n"
        "  PostgreSQL, MySQL, MongoDB, Redis\n\n"
        "Return ONLY valid JSON with no markdown fences, "
        "no explanation, no preamble:\n"
        "{\n"
        '  "ideal_answer": "<150-200 word model answer that directly '
        'answers the question>",\n'
        '  "must_mention": [\n'
        '    "<core concept 1 specific to answering this question>",\n'
        '    "<core concept 2 specific to answering this question>",\n'
        '    "<core concept 3 specific to answering this question>"\n'
        "  ],\n"
        '  "bonus_points": [\n'
        '    "<advanced concept that earns extra credit>",\n'
        '    "<second advanced concept>"\n'
        "  ],\n"
        '  "red_flags": [\n'
        '    "<common mistake or misconception to penalize>",\n'
        '    "<second common mistake>"\n'
        "  ],\n"
        '  "scoring_weights": {\n'
        '    "core_concepts": 40,\n'
        '    "technical_accuracy": 30,\n'
        '    "practical_example": 20,\n'
        '    "communication": 10\n'
        "  }\n"
        "}"
    )
    try:
        return (await _hf_chat(prompt, max_tokens=320, temperature=0.2)).strip() or fallback
    except Exception as e:
        log.warning('[interview-rag] reference generation fallback: %s', e)
        return fallback


def _reference_key(session_id: str, question_number: int) -> str:
    return f'{session_id}:{question_number}'


def _store_reference(
    session_id: str | None,
    question_number: int,
    payload: Dict[str, Any],
) -> None:
    if not session_id:
        return
    _load_reference_store()
    _REFERENCE_STORE[_reference_key(str(session_id), question_number)] = payload
    if len(_REFERENCE_STORE) > 500:
        for key in list(_REFERENCE_STORE.keys())[:100]:
            _REFERENCE_STORE.pop(key, None)
    _persist_reference_store()


def _get_reference(session_id: str | None, question_number: int) -> Dict[str, Any] | None:
    if not session_id:
        return None
    _load_reference_store()
    return _REFERENCE_STORE.get(_reference_key(str(session_id), question_number))


def _has_practical_example(answer: str) -> bool:
    text = (answer or '').lower()
    markers = ('for example', 'in my project', 'i built', 'i used', 'we used', 'implemented', 'created')
    return any(m in text for m in markers)


def _answer_concepts_for_question(
    question: str,
    reference: str,
    fallback_items: List[str],
) -> List[str]:
    parsed = _safe_json_parse(reference or '')
    if isinstance(parsed, dict) and isinstance(parsed.get('must_mention'), list):
        concepts = [
            str(item).strip()
            for item in parsed.get('must_mention') or []
            if str(item).strip()
        ]
        if concepts:
            return concepts[:6]

    haystack = ' '.join(
        [question or '', reference or ''] + [str(item) for item in fallback_items or []]
    ).lower()
    if any(term in haystack for term in ('rest', 'api', 'http')):
        return [
            'statelessness',
            'HTTP verbs',
            'resource-based URLs',
            'status codes',
            'client-server separation',
        ]
    if any(term in haystack for term in ('database', 'sql', 'query')):
        return [
            'ACID properties',
            'normalization',
            'indexing',
            'query optimization',
            'transactions',
        ]
    return [str(item).strip() for item in fallback_items or [] if str(item).strip()][:6]


def _concept_is_covered(answer_l: str, concept: str) -> bool:
    token = re.sub(r'[^a-z0-9]+', ' ', concept.lower()).strip()
    if token and token in answer_l:
        return True
    aliases = {
        'statelessness': ['stateless', 'no client session state', 'no session state'],
        'http verbs': ['http verbs', 'get', 'post', 'put', 'delete'],
        'resource-based urls': ['resources are identified by urls', 'resource urls', 'urls'],
        'status codes': ['status codes', '200 ok', '201 created', '404 not found'],
        'client-server separation': ['client server', 'client-server', 'server stores no client'],
        'acid properties': ['acid'],
        'query optimization': ['query optimization', 'optimize queries'],
    }
    return any(alias in answer_l for alias in aliases.get(concept.lower(), []))


def _semantic_gap_analysis(
    answer: str,
    reference: str,
    skills_tested: List[str],
) -> Dict[str, Any]:
    answer_l = (answer or '').lower()
    concepts = _answer_concepts_for_question(reference, reference, skills_tested)
    covered: List[str] = []
    for concept in concepts or []:
        name = str(concept).strip()
        if not name:
            continue
        if _concept_is_covered(answer_l, name):
            covered.append(name)
    if not covered:
        ref_words = [
            w for w in re.findall(r'[a-zA-Z][a-zA-Z0-9+#.-]{2,}', reference or '')
            if w.lower() not in {'the', 'and', 'for', 'with', 'should', 'answer'}
        ][:8]
        covered = [w for w in ref_words if w.lower() in answer_l]
    covered = list(dict.fromkeys(covered))
    missing = [s for s in (concepts or []) if s not in covered][:6]
    denominator = max(len(concepts or []), 1)
    coverage_pct = int(round((len(covered) / denominator) * 100))
    return {
        'concepts_covered': covered,
        'concepts_missing': missing,
        'coverage_pct': max(0, min(100, coverage_pct)),
    }


def _compute_rubric_score(
    answer: str,
    gap: Dict[str, Any],
    has_example: bool,
) -> Dict[str, Any]:
    words = re.findall(r'\w+', answer or '')
    coverage = int(gap.get('coverage_pct') or 0)
    core = round(40 * coverage / 100)
    technical = min(30, 8 + len(set(w.lower() for w in words if len(w) > 5)) * 2)
    example = 20 if has_example else 6
    clarity = 10 if 20 <= len(words) <= 220 else 6
    total = max(0, min(100, core + technical + example + clarity))
    return {
        'score': max(1, min(100, total)),
        'score_breakdown': {
            'core_concepts': core,
            'technical_accuracy': technical,
            'practical_example': example,
            'communication': clarity,
        },
    }


def _build_evaluation_prompt(
    question: str,
    answer: str,
    reference: str,
    role: str,
    difficulty: str,
    gap: Dict[str, Any],
    rubric: Dict[str, Any],
    emotion_context: str = '',
) -> str:
    return (
        f'Role: {role or "Candidate"} ({difficulty or "intermediate"})\n'
        f'Question: {question}\n'
        f'Reference answer: {reference}\n'
        f'Candidate answer: """{answer}"""\n'
        f'Covered concepts: {", ".join(gap.get("concepts_covered") or []) or "none"}\n'
        f'Missing concepts: {", ".join(gap.get("concepts_missing") or []) or "none"}\n'
        f'Rubric score anchor: {rubric.get("score")}/100\n'
        + emotion_context
        + '\nReturn ONLY minified JSON: {"feedback":"...", "strengths":["..."], "improvements":["..."]}'
    )


@app.options('/interview/question')
async def options_interview_question():
    return {'message': 'OK'}


@app.post(
    '/interview/question',
    tags=["interview"],
    summary="Generate a personalised interview question",
    response_description="One interview question tailored to the candidate role, level, and profile",
)
async def interview_question(req: Dict[str, Any]):
    role = (req.get('role') or '').strip()
    difficulty = (req.get('difficulty') or 'intermediate').strip()
    if not role:
        raise HTTPException(status_code=400, detail='role is required')

    try:
        question_number = int(req.get('questionNumber') or 1)
    except (TypeError, ValueError):
        question_number = 1
    question_number = max(1, min(question_number, 50))

    previous = req.get('previousQuestions') or []
    if not isinstance(previous, list):
        previous = []
    previous = [str(p)[:300] for p in previous if p][-10:]
    previous = list(dict.fromkeys(previous + _recent_role_questions(role, difficulty)))[-12:]
    previous_block = (
        '\nAvoid repeating any of these previously-asked questions:\n- '
        + '\n- '.join(previous)
        if previous else ''
    )

    profile = req.get('profile') or {}
    profile_line = _profile_summary(profile)
    session_id = req.get('sessionId') or req.get('session_id')
    rag = await _get_interview_rag_context(role, difficulty, profile, top_k=4)
    context = rag.get('context') or ''
    skills_tested = rag.get('skills_tested') or []
    skill_block = (
        '\nSkills this question should test: ' + ', '.join(skills_tested[:5]) + '\n'
        if skills_tested else ''
    )

    user_prompt = (
        (f'{context}\n\n---\n\n' if context else '')
        + (f'Candidate context: {profile_line}\n\n' if profile_line else '')
        + f'Generate exactly ONE {difficulty}-level interview question '
        + f'(number {question_number}) for a {role} candidate.\n'
        + 'Personalize the question to the candidate background when possible.'
        + skill_block
        + previous_block + '\n\n'
        + 'Respond with the question text ONLY — no preamble, no numbering, '
        + 'no markdown.'
    )

    try:
        raw = await _hf_chat(user_prompt, max_tokens=256, temperature=0.8)
    except Exception as e:
        log.warning('[interview-question] HF fallback: %s', e)
        primary_skill = next(
            (s for s in skills_tested if 'rest' in str(s).lower() or 'api' in str(s).lower()),
            skills_tested[0] if skills_tested else _infer_track_from_role(role),
        )
        raw = (
            f'Tell me about a time you used {primary_skill} in a {role} project. '
            'What design choices did you make, what trade-offs did you consider, '
            'and how did you validate the result?'
        )

    # Conservative cleanup: only strip 'Question:'/'Q:' style prefixes when
    # followed by an actual separator, and only strip leading bullets/numbers,
    # never a leading letter of the real question.
    cleaned = re.sub(r'^(question|q)\s*[:.\-]\s*', '', raw, flags=re.IGNORECASE)
    cleaned = re.sub(r'^\s*\d+\s*[\.\)]\s*', '', cleaned)
    cleaned = re.sub(r'^\s*[\-\*\u2022\u00b7]+\s*', '', cleaned)
    cleaned = cleaned.strip().strip('"').strip("'")
    if not cleaned:
        cleaned = raw.strip()  # never return empty string

    reference = await _generate_reference_answer(
        cleaned,
        role,
        difficulty,
        skills_tested,
        context,
    )
    _store_reference(session_id, question_number, {
        'question': cleaned,
        'reference_answer': reference,
        'skills_tested': skills_tested,
        'sources': rag.get('sources') or [],
        'rag_grounded': bool(rag.get('rag_grounded')),
    })
    _store_role_question(role, difficulty, cleaned)
    return {
        'question': cleaned,
        'rag_grounded': bool(rag.get('rag_grounded')),
        'skills_tested': skills_tested,
        'sources': rag.get('sources') or [],
    }


@app.post("/generate-interview-question")
async def generate_interview_question_alias(request: Request):
    """Alias for /interview/question — contract compatibility."""
    return await interview_question(await request.json())


# ---------------------------------------------------------------------------
# POST /interview/evaluate — replaces frontend evaluateInterviewAnswer()
# ---------------------------------------------------------------------------
@app.options('/interview/evaluate')
async def options_interview_evaluate():
    return {'message': 'OK'}


@app.post(
    '/interview/evaluate',
    tags=["interview"],
    summary="Evaluate a mock interview answer",
    response_description="Score 1–10, feedback, strengths, improvements, and optional expression feedback",
)
async def interview_evaluate(req: Dict[str, Any]):
    question = (req.get('question') or '').strip()
    answer = (req.get('answer') or '').strip()
    if not question or not answer:
        raise HTTPException(status_code=400, detail='question and answer are required')

    # Hard caps so we never ship a megaprompt to HF
    question = question[:2000]
    answer = answer[:4000]

    role = (req.get('role') or '').strip()
    difficulty = (req.get('difficulty') or 'intermediate').strip()
    profile = req.get('profile') or {}

    # Optional multimodal signals from FaceExpressionOverlay. All four are
    # optional — when absent the route behaves exactly as before.
    emotion_summary  = req.get('emotionSummary')  or req.get('emotion_summary')
    presence_score   = req.get('presenceScore')   or req.get('presence_score')
    dominant_emotion = req.get('dominantEmotion') or req.get('dominant_emotion')
    negative_pct_raw = req.get('negativePct')     or req.get('negative_pct')
    try:
        negative_pct = float(negative_pct_raw) if negative_pct_raw is not None else None
    except (TypeError, ValueError):
        negative_pct = None
    has_emotion = bool(emotion_summary) and presence_score is not None

    emotion_context = ''
    if has_emotion:
        neg = negative_pct or 0
        if neg >= 40:
            interpretation = 'High stress detected during delivery'
        elif neg >= 20:
            interpretation = 'Moderate nervousness'
        else:
            interpretation = 'Composed and confident delivery'
        emotion_context = (
            '\nCANDIDATE EXPRESSION ANALYSIS:\n'
            f'- Presence Score: {presence_score}/100\n'
            f"- Dominant Expression: {dominant_emotion or 'neutral'}\n"
            f'- Stress/Negative Expression Rate: {neg}%\n'
            f'- Interpretation: {interpretation}\n'
        )

    session_id = req.get('sessionId') or req.get('session_id')
    try:
        question_number = int(req.get('questionNumber') or 1)
    except (TypeError, ValueError):
        question_number = 1
    question_number = max(1, min(question_number, 50))

    reference_payload = _get_reference(session_id, question_number)
    rag_grounded = bool(reference_payload)
    if reference_payload:
        reference_answer = str(reference_payload.get('reference_answer') or '')
        skills_tested = list(reference_payload.get('skills_tested') or [])
        sources = list(reference_payload.get('sources') or [])
    else:
        rag = await _get_interview_rag_context(role, difficulty, profile, top_k=4)
        reference_answer = await _generate_reference_answer(
            question,
            role,
            difficulty,
            rag.get('skills_tested') or [],
            rag.get('context') or '',
        )
        skills_tested = list(rag.get('skills_tested') or [])
        sources = list(rag.get('sources') or [])

    gap = _semantic_gap_analysis(answer, reference_answer, skills_tested)
    has_example = _has_practical_example(answer)
    rubric = _compute_rubric_score(answer, gap, has_example)
    user_prompt = _build_evaluation_prompt(
        question,
        answer,
        reference_answer,
        role,
        difficulty,
        gap,
        rubric,
        emotion_context,
    )

    try:
        raw = await _hf_chat(user_prompt, max_tokens=400, temperature=0.3)
    except Exception as e:
        log.warning('[interview-evaluate] HF fallback: %s', e)
        raw = ''

    parsed = _safe_json_parse(raw)
    if isinstance(parsed, dict):
        score = int(rubric['score'])
        raw_strengths = parsed.get('strengths')
        raw_improvements = parsed.get('improvements')
        strengths = raw_strengths if isinstance(raw_strengths, list) else []
        improvements = raw_improvements if isinstance(raw_improvements, list) else []
        missing = gap.get('concepts_missing') or []
        out: Dict[str, Any] = {
            'score': score,
            'feedback': str(parsed.get('feedback') or 'Rubric-based evaluation completed.')[:1000],
            'strengths': [str(s)[:200] for s in strengths][:5] or ['Answer was evaluated against the stored rubric.'],
            'improvements': [str(s)[:200] for s in improvements][:5] or [
                f'Add more detail on {missing[0]}.' if missing else 'Keep tying answers to concrete implementation details.'
            ],
            'concepts_covered': gap.get('concepts_covered') or [],
            'concepts_missing': missing,
            'coverage_pct': gap.get('coverage_pct') or 0,
            'score_breakdown': rubric.get('score_breakdown') or {},
            'rag_grounded': rag_grounded,
            'skills_tested': skills_tested,
            'sources': sources,
            'missingConceptsFeedback': (
                'Review: ' + ', '.join(missing[:3])
                if missing else 'No major rubric concepts missing.'
            ),
        }
        if has_emotion:
            out['expression_feedback'] = _build_expression_feedback(
                negative_pct, dominant_emotion, presence_score,
            )
        return out

    # Model failed to return parseable JSON — degrade gracefully.
    missing = gap.get('concepts_missing') or []
    out = {
        'score': int(rubric['score']),
        'feedback': (
            'Your answer was scored with the deterministic interview rubric. '
            f'Concept coverage is {gap.get("coverage_pct", 0)}%.'
        ),
        'strengths': ['Includes a practical example.' if has_example else 'Answer submitted clearly.'],
        'improvements': [
            f'Add more detail on {missing[0]}.' if missing else 'Add more trade-offs and validation details.'
        ],
        'concepts_covered': gap.get('concepts_covered') or [],
        'concepts_missing': missing,
        'coverage_pct': gap.get('coverage_pct') or 0,
        'score_breakdown': rubric.get('score_breakdown') or {},
        'rag_grounded': rag_grounded,
        'skills_tested': skills_tested,
        'sources': sources,
        'missingConceptsFeedback': (
            'Review: ' + ', '.join(missing[:3])
            if missing else 'No major rubric concepts missing.'
        ),
    }
    if has_emotion:
        out['expression_feedback'] = _build_expression_feedback(
            negative_pct, dominant_emotion, presence_score,
        )
    return out


def _build_expression_feedback(
    negative_pct: 'float | None',
    dominant_emotion: 'str | None',
    presence_score: 'float | None',
) -> 'str | None':
    """Three-tier multimodal feedback string.

    Tiers (matches the matrix in the spec):
      * High stress      \u2014 negativePct >= 40
      * Moderate         \u2014 negativePct >= 20
      * Excellent        \u2014 happy dominant OR presence >= 75 (low stress)
    Returns None when no tier matches (composed but unremarkable session).
    """
    neg = negative_pct or 0
    pres = presence_score or 0
    if neg >= 40:
        return (
            f'Your answer showed solid knowledge but your expression '
            f'indicated high stress ({int(neg)}% tense frames). Practice '
            f'this topic until your face reflects the same confidence '
            f'your words convey \u2014 composure under pressure is itself a '
            f'valued skill interviewers assess.'
        )
    if neg >= 20:
        return (
            f'Good answer with mostly composed delivery. Mild tension '
            f'showed in {int(neg)}% of frames \u2014 common for this type of '
            f'question. A few more practice sessions on similar topics '
            f'will bring your expression fully in line with your strong '
            f'content.'
        )
    if dominant_emotion == 'happy' or pres >= 75:
        return (
            f'Excellent multimodal performance \u2014 your confident '
            f'expression reinforced your answer content. A presence score '
            f'of {int(pres)}/100 signals strong nonverbal communication '
            f'that interviewers respond to positively and remember after '
            f'the interview ends.'
        )
    return None



@app.post("/evaluate-interview-answer")
async def evaluate_interview_answer_alias(request: Request):
    """Alias for /interview/evaluate — contract compatibility."""
    return await interview_evaluate(await request.json())


# ---------------------------------------------------------------------------
# Helpers reused by the extended /summarize-cv route
# ---------------------------------------------------------------------------
async def _llm_structure_cv(raw_text: str) -> Dict[str, List[str]]:
    trimmed = (raw_text or '')[:6000]
    prompt = (
        'Extract structured information from this CV. Return ONLY '
        'minified JSON:\n'
        '{"keySkills":["..."],"toolsTechnologies":["..."],'
        '"rolesAndDomains":["..."]}\n\nCV TEXT:\n"""' + trimmed + '"""'
    )
    try:
        raw = await _hf_chat(prompt, max_tokens=400, temperature=0.2)
    except Exception as e:
        log.warning('[cv-structure] HF chat failed: %s', e)
        return {'keySkills': [], 'toolsTechnologies': [], 'rolesAndDomains': []}
    parsed = _safe_json_parse(raw)
    if not isinstance(parsed, dict):
        return {'keySkills': [], 'toolsTechnologies': [], 'rolesAndDomains': []}
    def _coerce(key: str) -> List[str]:
        val = parsed.get(key)
        return [str(x)[:80] for x in val if x] if isinstance(val, list) else []
    return {
        'keySkills': _coerce('keySkills'),
        'toolsTechnologies': _coerce('toolsTechnologies'),
        'rolesAndDomains': _coerce('rolesAndDomains'),
    }


async def _llm_hot_skills(cv_analysis: Dict[str, List[str]]) -> str:
    key_skills = ', '.join(cv_analysis.get('keySkills') or []) or 'None'
    tools = ', '.join(cv_analysis.get('toolsTechnologies') or []) or 'None'
    roles = ', '.join(cv_analysis.get('rolesAndDomains') or []) or 'None'
    prompt = (
        'Based on this CV summary, name exactly 2 hot/trending skills the '
        'candidate is missing.\n'
        f'Current Skills: {key_skills}\nTools: {tools}\nRoles: {roles}\n\n'
        'Respond in exactly 2 lines, each formatted: '
        '"Skill Name - one-sentence reason".'
    )
    try:
        return await _hf_chat(prompt, max_tokens=180, temperature=0.6)
    except Exception as e:
        log.warning('[hot-skills] HF chat failed: %s', e)
        return ''


# ---------------------------------------------------------------------------
# POST /face-expression — proxy for trpakov/vit-face-expression
# ---------------------------------------------------------------------------
# Receives cropped proxy calls from FaceExpressionOverlay.jsx.
# Browser POSTs a cropped face JPEG as multipart; backend forwards the bytes
# to the HF image-classification endpoint and returns the label list. The
# uploaded image bytes are not persisted.
_HF_FACE_MODEL = 'trpakov/vit-face-expression'
_HF_FACE_URL = f'https://router.huggingface.co/hf-inference/models/{_HF_FACE_MODEL}'


def _hf_face_classify_sync(image_bytes: bytes) -> List[Dict[str, Any]]:
    """Blocking POST of a JPEG to the HF image-classification endpoint.

    Returns a list of {"label": <lowercase>, "score": <float>} dicts sorted
    by score descending. Returns [] on ANY failure (missing token, network
    error, unexpected payload, exhausted retries) so the /face-expression
    route can always degrade to HTTP 200 instead of surfacing a 502.
    """
    try:
        if not _HF_TOKEN:
            log.warning('[FACE] HF classify failed: HF_TOKEN is not set on the backend.')
            return []

        import urllib.request
        import urllib.error
        import time

        headers = {
            'Authorization': f'Bearer {_HF_TOKEN}',
            'Content-Type': 'image/jpeg',
            'Accept': 'application/json',
            'X-Wait-For-Model': 'true',
        }

        raw = None
        last_err = None
        for attempt in range(_HF_CHAT_MAX_RETRIES):
            try:
                req = urllib.request.Request(_HF_FACE_URL, data=image_bytes, headers=headers)
                with urllib.request.urlopen(req, timeout=_HF_CHAT_TIMEOUT) as r:
                    payload = _json.loads(r.read())
                if isinstance(payload, list) and payload and isinstance(payload[0], list):
                    payload = payload[0]
                if not isinstance(payload, list):
                    last_err = RuntimeError(f'Unexpected HF face payload: {payload}')
                    break
                raw = payload
                break
            except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
                last_err = e
                if e.code in (429, 503):
                    time.sleep(min(5 * (2 ** attempt), 20))
                    continue
                try:
                    detail = e.read().decode('utf-8', errors='ignore')[:300]
                except Exception:
                    detail = ''
                last_err = RuntimeError(f'HF face HTTP {e.code}: {detail}')
                break
            except Exception as e:
                last_err = e
                time.sleep(1.0 * (2 ** attempt))

        if raw is None:
            log.warning('[FACE] HF classify failed: %s', last_err)
            return []

        # Normalise: lowercase labels (HF returns "Happy"/"Sad"/..., frontend
        # expects "happy"/"sad"/...) and sort by score descending.
        normalised: List[Dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            label = item.get('label')
            score = item.get('score')
            if label is None or score is None:
                continue
            try:
                normalised.append({'label': str(label).lower(), 'score': float(score)})
            except (TypeError, ValueError):
                continue
        normalised.sort(key=lambda x: x['score'], reverse=True)
        return normalised
    except Exception as e:
        log.error('[FACE] HF classify failed: %s', e)
        return []


@app.options('/face-expression')
async def options_face_expression():
    return {'message': 'OK'}


@app.post(
    '/face-expression',
    tags=["face"],
    summary="Classify facial expression from a cropped webcam face image",
    response_description="Sorted emotion labels with scores; always HTTP 200 with graceful degradation",
)
async def face_expression(file: UploadFile = File(...)):
    """Forward a cropped webcam face JPEG to the HF expression classifier.

    Always returns HTTP 200 with a graceful-degradation envelope:
      { labels, top_label, top_score, retrieval_path, success }
    The route never surfaces an HF 502 to the frontend; failure paths
    return success=False and an empty labels list so the live coaching
    layer can keep sampling.
    """
    MAX_BYTES = 2 * 1024 * 1024  # 2 MB hard cap per frame
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail='Please upload an image.')
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail='Empty image upload.')
    if len(image_bytes) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f'Frame too large. Max {MAX_BYTES // (1024 * 1024)} MB.',
        )
    try:
        labels = await _asyncio.to_thread(_hf_face_classify_sync, image_bytes)
    except Exception as e:
        # Belt-and-suspenders: _hf_face_classify_sync already swallows its
        # own errors and returns []. This guards against an unexpected
        # raise from the to_thread wrapper itself.
        log.error('[FACE] Route error: %s', e)
        labels = []

    if not isinstance(labels, list):
        labels = []

    return {
        'labels': labels,
        'top_label': labels[0]['label'] if labels else None,
        'top_score': labels[0]['score'] if labels else None,
        'retrieval_path': 'hf' if labels else 'error',
        'success': bool(labels),
    }


@app.post("/analyze-expression")
async def analyze_expression_alias(file: UploadFile = File(...)):
    """Alias for /face-expression — contract compatibility."""
    return await face_expression(file)


@app.options("/generate-application")
async def options_generate_application():
    return {"message": "OK"}


@app.post(
    "/generate-application",
    tags=["application"],
    summary="Generate a personalised job application letter",
    response_description="A tailored cover letter / job application based on user profile and target job using RAG context",
)
async def generate_application(req: Dict[str, Any]):
    target_job = (req.get('targetJob') or '').strip()
    if not target_job:
        raise HTTPException(status_code=400, detail='targetJob is required')
    profile = req.get('profile') or {}
    level = (
        profile.get('experienceLevel') or profile.get('level') or 'beginner'
    )
    skills_list = profile.get('skills') if isinstance(profile, dict) else None
    if isinstance(skills_list, list) and skills_list:
        skills_s = ', '.join(str(s) for s in skills_list if s)
    else:
        skills_s = 'none listed'

    context = await _rag_context(
        f'Job description, requirements and details for {target_job}', profile, top_k=5,
    )

    user_prompt = (
        (f'{context}\n\n---\n\n' if context else '')
        + 'Generate a highly professional, tailored job application cover letter in plain text.\n\n'
        + f'Applicant Profile:\n- Experience Level: {level}\n'
        + f'- Core Skills: {skills_s}\n- Target Position: {target_job}\n\n'
        + 'Requirements:\n'
        + '1. Keep it structured with a salutation, introductory paragraph, body paragraphs highlighting how the applicant\'s skills match the target job, and a professional closing.\n'
        + '2. Sound enthusiastic, confident, and professional.\n'
        + '3. Focus on matching the core skills and level of the candidate to the target role requirements using the RAG context details.'
    )

    try:
        content = await _hf_chat(user_prompt, max_tokens=1000, temperature=0.7)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f'Application letter generation failed: {e}')

    return {'content': content}


@app.on_event("startup")
async def startup_event():
    _load_hybrid_corpus()
    _load_reference_store()
    _load_generator()
    log.info("[GEN] Optional reranker/local embeddings load lazily on first use.")
    _load_corpus()
    _init_chroma()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(_os.getenv("PORT", "7860")))
