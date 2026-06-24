from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv
import json as _json
from pathlib import Path
from io import BytesIO
from PyPDF2 import PdfReader

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Configure CORS middleware FIRST (before routes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
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
# Interview question generation + answer evaluation: DELETED.
# The Mock Interview component now calls Hugging Face Mistral directly from
# the browser via frontend/src/services/interviewAI.js.
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
# All RAG / embedding / HF-inference / chat-generation logic is now in the
# browser bundle (frontend/src/services/ragPipeline.js + hfClient.js).
# The backend keeps only the static JSON caches consumed by the data routes
# /career-advice and /skill-roadmap, plus the seed_corpus path used by the
# /health/dependencies endpoint.
# ---------------------------------------------------------------------------
_DATA_DIR = Path(__file__).resolve().parent / "data"
_CORPUS_PATH = _DATA_DIR / "seed_corpus.json"
_ADVICE_PATH = _DATA_DIR / "career_advice.json"
_ROADMAPS_PATH = _DATA_DIR / "skill_roadmaps.json"


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


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "CareerPath RAG Chatbot API is running"}

@app.get("/health/dependencies")
async def health_dependencies():
    """Diagnostic dependency health check; never raises.

    NOTE: all AI inference (LLM, embeddings, vision) now runs from the
    browser directly against Hugging Face. The backend keeps only data
    routes (/career-dna, /readiness-score, /career-advice, /skill-roadmap,
    /summarize-cv PDF parser).
    """
    try:
        seed_loaded = False
        try:
            seed_loaded = _CORPUS_PATH.exists() and bool(
                _json.loads(_CORPUS_PATH.read_text(encoding="utf-8"))
            )
        except Exception:
            seed_loaded = False

        overall = "ready" if seed_loaded else "degraded"

        return {
            "seed_corpus_loaded": seed_loaded,
            "overall": overall,
        }
    except Exception:
        return {
            "seed_corpus_loaded": False,
            "overall": "critical",
        }

# ---------------------------------------------------------------------------
# /chat — DELETED. The chatbot now calls Hugging Face directly from the
# browser via frontend/src/services/interviewAI.js (careerChat).
# ---------------------------------------------------------------------------

@app.options("/summarize-cv")
async def options_summarize_cv():
    return {"message": "OK"}

@app.post("/summarize-cv")
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
        
        # Extract CV data using pure keyword matching (no LLM)
        parsed_data = _summarize_cv_no_llm(full_text)
        return {
            "data": parsed_data,
            "raw_text": full_text
        }
    
    except HTTPException:
        raise
    except Exception as e:
        error_message = f"Error processing CV: {str(e)}"
        raise HTTPException(status_code=500, detail=error_message)

# ---------------------------------------------------------------------------
# /generate-interview-question + /evaluate-interview-answer — DELETED.
# The Mock Interview component now calls Hugging Face Mistral directly
# via frontend/src/services/interviewAI.js.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Feature 2 — Career DNA
# ---------------------------------------------------------------------------
@app.options("/career-dna")
async def options_career_dna():
    return {"message": "OK"}


@app.post("/career-dna")
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


@app.post("/readiness-score")
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


@app.post("/explain-match")
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


@app.get("/career-advice")
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


@app.get("/skill-roadmap")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
