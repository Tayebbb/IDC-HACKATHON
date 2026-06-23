from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import TypedDict, List, Dict, Any, Optional, Tuple
from typing import Literal
from dotenv import load_dotenv
import os
import json as _json
import math
import time
import urllib.request
import urllib.error
from pathlib import Path
from io import BytesIO
from PyPDF2 import PdfReader
from pydantic import BaseModel, Field  # noqa: F401 — used by existing interview request models below

# ---------------------------------------------------------------------------
# Optional ChromaDB + sentence-transformers (installed by build_chromadb.py)
# Gracefully degraded if not installed — falls back to HF API / keyword search.
# ---------------------------------------------------------------------------
try:
    import chromadb as _chromadb  # type: ignore
    _CHROMADB_AVAILABLE = True
except ImportError:
    _CHROMADB_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer as _SentenceTransformer  # type: ignore
    _ST_AVAILABLE = True
except ImportError:
    _ST_AVAILABLE = False

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
# Interview question bank (no LLM)
# ---------------------------------------------------------------------------
import random as _random

_INTERVIEW_QUESTIONS: Dict[str, Dict[str, List[str]]] = {
    "frontend": {
        "beginner": [
            "What is the difference between HTML, CSS, and JavaScript?",
            "What is the box model in CSS?",
            "Explain the difference between block and inline elements.",
            "What is a media query and how is it used?",
            "What does the DOM stand for?",
        ],
        "intermediate": [
            "How does React's virtual DOM work?",
            "Explain the difference between props and state in React.",
            "What is event delegation in JavaScript?",
            "How do you handle API errors in a React app?",
            "What is the difference between `==` and `===` in JavaScript?",
        ],
        "advanced": [
            "How do you optimize a React app with performance bottlenecks?",
            "Explain code-splitting and lazy loading in React.",
            "What are micro-frontends and when would you use them?",
            "How would you implement server-side rendering in Next.js?",
            "Explain the reconciliation algorithm in React.",
        ],
    },
    "backend": {
        "beginner": [
            "What is REST and what are its principles?",
            "What is the difference between SQL and NoSQL?",
            "What is an HTTP status code and name a few common ones?",
            "What is version control and why is it important?",
            "What is an API?",
        ],
        "intermediate": [
            "What is database indexing and when should you use it?",
            "Explain the difference between authentication and authorization.",
            "What is Docker and why is it used?",
            "How does connection pooling work in databases?",
            "What is middleware in the context of web frameworks?",
        ],
        "advanced": [
            "How would you design a scalable microservices architecture?",
            "Explain CAP theorem and its implications for distributed systems.",
            "What are the trade-offs between SQL and NoSQL at scale?",
            "How would you implement rate limiting in an API?",
            "Explain eventual consistency and how to handle it.",
        ],
    },
    "fullstack": {
        "beginner": [
            "What is the role of a full-stack developer?",
            "What is the difference between a frontend and backend?",
            "What is a database and how does it relate to a web app?",
            "Explain what version control is and why it matters.",
            "What is an HTTP request?",
        ],
        "intermediate": [
            "How do you connect a React frontend to a FastAPI backend?",
            "Explain CORS and how to configure it.",
            "What is JWT and how is it used for authentication?",
            "How do you handle form validation on both client and server?",
            "What is a monorepo and what are its advantages?",
        ],
        "advanced": [
            "How would you architect a full-stack app for 1 million users?",
            "Explain the trade-offs between SSR, SSG, and CSR.",
            "How would you implement real-time features using WebSockets?",
            "Describe your approach to CI/CD for a full-stack project.",
            "How do you handle database migrations in a live system?",
        ],
    },
    "data-science": {
        "beginner": [
            "What is the difference between supervised and unsupervised learning?",
            "What is a confusion matrix?",
            "Explain what overfitting means.",
            "What is Pandas and what is it used for?",
            "What is a train/test split and why is it used?",
        ],
        "intermediate": [
            "How does gradient descent work?",
            "Explain the bias-variance trade-off.",
            "What is cross-validation and why is it important?",
            "What are the key differences between Random Forest and XGBoost?",
            "How do you handle missing data in a dataset?",
        ],
        "advanced": [
            "Explain how a transformer model works.",
            "How would you design an end-to-end MLOps pipeline?",
            "What is the difference between batch and online learning?",
            "How do you detect and handle data drift in production?",
            "Explain how a RAG pipeline works.",
        ],
    },
    "devops": {
        "beginner": [
            "What is Docker and what problem does it solve?",
            "What is CI/CD?",
            "What is the difference between a VM and a container?",
            "What is version control and why is it used in DevOps?",
            "What is a deployment pipeline?",
        ],
        "intermediate": [
            "What is Kubernetes and what problems does it solve?",
            "How does a load balancer work?",
            "Explain blue-green deployment.",
            "What is infrastructure as code and why is it valuable?",
            "How do you monitor a production service?",
        ],
        "advanced": [
            "How would you design a zero-downtime deployment strategy?",
            "Explain how Kubernetes handles pod scheduling.",
            "What is a service mesh and when would you use one?",
            "How do you handle secrets management at scale?",
            "Describe your approach to multi-region high availability.",
        ],
    },
    "mobile": {
        "beginner": [
            "What is the difference between native and cross-platform mobile development?",
            "What is React Native?",
            "What is the difference between iOS and Android development?",
            "What is a mobile app lifecycle?",
            "What is responsive design in mobile context?",
        ],
        "intermediate": [
            "How do you handle state management in React Native?",
            "Explain the difference between Expo and bare React Native.",
            "How do you handle offline data in a mobile app?",
            "What are push notifications and how do you implement them?",
            "How do you optimize performance in a React Native app?",
        ],
        "advanced": [
            "How would you architect a cross-platform mobile app for 1M users?",
            "Explain how the React Native bridge works.",
            "How do you implement deep linking in a mobile app?",
            "How do you approach A/B testing in a mobile app?",
            "What is code-push and how does it enable OTA updates?",
        ],
    },
    "ui-ux": {
        "beginner": [
            "What is the difference between UI and UX?",
            "What is a wireframe?",
            "What tools do you use for UI design?",
            "What is a design system?",
            "What is accessibility in web design?",
        ],
        "intermediate": [
            "How do you conduct user research?",
            "What is usability testing and how do you run it?",
            "Explain the concept of information architecture.",
            "How do you hand off designs to developers?",
            "What is the difference between a prototype and a mockup?",
        ],
        "advanced": [
            "How do you measure the success of a design change?",
            "Describe your process for redesigning a complex product.",
            "How do you design for accessibility (WCAG standards)?",
            "How do you handle conflicting stakeholder feedback?",
            "Explain design tokens and how they scale across platforms.",
        ],
    },
    "product-manager": {
        "beginner": [
            "What does a product manager do?",
            "What is a user story?",
            "What is the difference between a roadmap and a backlog?",
            "What is MVP and why is it important?",
            "How do you prioritize features?",
        ],
        "intermediate": [
            "How do you write a product requirements document?",
            "Explain the RICE scoring model.",
            "How do you handle disagreement between engineering and stakeholders?",
            "What metrics would you track for a new feature launch?",
            "How do you run an effective sprint review?",
        ],
        "advanced": [
            "How would you define a go-to-market strategy for a new product?",
            "How do you balance technical debt against new feature development?",
            "How do you make data-driven product decisions?",
            "Describe a time you killed a feature and why.",
            "How do you align a product vision across multiple teams?",
        ],
    },
}

# Fallback bucket for unknown roles
_INTERVIEW_QUESTIONS_FALLBACK: Dict[str, List[str]] = {
    "beginner": [
        "Tell me about yourself and your background.",
        "What are your strongest technical skills?",
        "What is version control and why is it important?",
        "What is the difference between SQL and NoSQL?",
        "Explain what REST API means.",
    ],
    "intermediate": [
        "Explain the concept of closures in programming.",
        "What is the difference between authentication and authorization?",
        "What is Docker and why is it used?",
        "Explain database indexing and when to use it.",
        "How do you ensure code quality in a team?",
    ],
    "advanced": [
        "How would you design a scalable microservices architecture?",
        "Explain CAP theorem and its implications.",
        "What are the trade-offs between SQL and NoSQL at scale?",
        "Explain how you would implement a RAG pipeline.",
        "How do you handle database migrations in a live production system?",
    ],
}


def _pick_interview_question(
    role: str,
    difficulty: str,
    previous_questions: List[str],
    question_number: int,
) -> str:
    """Pick a question from the static bank, avoiding repeats."""
    role_key = role.lower().strip()
    diff_key = difficulty.lower().strip()
    if diff_key not in ("beginner", "intermediate", "advanced"):
        diff_key = "intermediate"

    role_bank = _INTERVIEW_QUESTIONS.get(role_key, {})
    bucket: List[str] = role_bank.get(diff_key) or _INTERVIEW_QUESTIONS_FALLBACK.get(diff_key, [])

    prev_set = {q.strip().lower() for q in previous_questions}
    candidates = [q for q in bucket if q.strip().lower() not in prev_set]
    if not candidates:
        candidates = bucket  # all already asked — allow repeats

    # Use question_number as a deterministic-but-varied seed
    _random.seed(question_number)
    return _random.choice(candidates) if candidates else "Tell me about your experience in this field."


# ---------------------------------------------------------------------------
# Interview answer evaluator (keyword-based, no LLM)
# ---------------------------------------------------------------------------

def _evaluate_answer_no_llm(question: str, answer: str, role: str, difficulty: str) -> dict:
    """Score an interview answer using length, keyword overlap, and structure.

    Returns the same shape as before:
      { score: float(0-10), feedback: str, strengths: list, improvements: list }
    """
    word_count = len(answer.split())
    answer_lower = answer.lower()
    question_lower = question.lower()

    # --- Length score (0-100) ---
    if word_count < 20:
        length_score = 30
        length_fb = "Answer is very short. Aim for at least 50 words to show understanding."
    elif word_count < 50:
        length_score = 65
        length_fb = "Good start. Elaborating further would strengthen your answer."
    elif word_count < 150:
        length_score = 85
        length_fb = "Well-paced answer with solid detail."
    else:
        length_score = 100
        length_fb = "Comprehensive answer with strong depth."

    # --- Keyword overlap (0-100) ---
    q_words = {w.strip(".,!?") for w in question_lower.split() if len(w) > 3}
    a_words = {w.strip(".,!?") for w in answer_lower.split()}
    overlap = len(q_words & a_words)
    keyword_score = min(100, overlap * 12)

    # --- Structure check (0-100) ---
    example_markers = ["example", "for instance", "such as", "like", "e.g.", "specifically", "in my experience"]
    has_example = any(m in answer_lower for m in example_markers)
    structure_score = 100 if has_example else 55

    # --- Difficulty multiplier ---
    diff_mult = {"beginner": 1.05, "intermediate": 1.0, "advanced": 0.95}.get(difficulty.lower(), 1.0)

    raw_score = (length_score * 0.40 + keyword_score * 0.40 + structure_score * 0.20) * diff_mult
    # Scale to 0-10
    final_score = round(min(10.0, max(0.0, raw_score / 10)), 1)

    # --- Strengths and improvements ---
    strengths: List[str] = []
    improvements: List[str] = []

    if word_count >= 50:
        strengths.append("Detailed and well-elaborated response")
    else:
        improvements.append("Provide a more detailed and thorough answer")

    if has_example:
        strengths.append("Good use of concrete examples")
    else:
        improvements.append("Include a specific, concrete example to illustrate your point")

    if overlap >= 2:
        strengths.append("Answer is relevant and directly addresses the question")
    else:
        improvements.append("Make sure to directly address all parts of the question")

    # Ensure non-empty lists
    if not strengths:
        strengths = ["You attempted the question"]
    if not improvements:
        improvements = ["Consider adding more depth to further impress the interviewer"]

    return {
        "score": final_score,
        "feedback": length_fb,
        "strengths": strengths,
        "improvements": improvements,
    }

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
# RAG retrieval — ChromaDB-first pipeline
# ---------------------------------------------------------------------------
_DATA_DIR = Path(__file__).resolve().parent / "data"
_CORPUS_PATH = _DATA_DIR / "seed_corpus.json"
_EMBEDDINGS_PATH = _DATA_DIR / "corpus_embeddings.json"
_CHROMA_PATH = _DATA_DIR / "chromadb"
_CHROMA_COLLECTION_NAME = "career_corpus"
_ADVICE_PATH = _DATA_DIR / "career_advice.json"
_ROADMAPS_PATH = _DATA_DIR / "skill_roadmaps.json"
_ST_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# Hugging Face Inference Router (fallback when local ST model unavailable)
HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
HF_URL = (
    "https://router.huggingface.co/hf-inference/models/"
    f"{HF_MODEL}/pipeline/feature-extraction"
)
_HF_TIMEOUT_SECS = 10.0

# Text-generation model for /chat replies
HF_GEN_MODEL = "HuggingFaceH4/zephyr-7b-beta"
HF_GEN_URL = "https://router.huggingface.co/v1/chat/completions"
_HF_GEN_TIMEOUT_SECS = 30.0
_EMBED_CACHE: Dict[str, List[float]] = {}

# Lazy-loaded singletons (initialised on first retrieval call)
_chroma_collection: Any = None
_st_model: Any = None


def _get_chroma_collection() -> Any:
    """Return the ChromaDB collection, or None if unavailable."""
    global _chroma_collection
    if _chroma_collection is not None:
        return _chroma_collection
    if not _CHROMADB_AVAILABLE:
        return None
    chroma_db_dir = _CHROMA_PATH
    if not chroma_db_dir.exists():
        return None
    try:
        client = _chromadb.PersistentClient(path=str(chroma_db_dir))
        col = client.get_collection(_CHROMA_COLLECTION_NAME)
        _chroma_collection = col
        return col
    except Exception:
        return None


def _get_st_model() -> Any:
    """Return a sentence-transformers model, or None if unavailable."""
    global _st_model
    if _st_model is not None:
        return _st_model
    if not _ST_AVAILABLE:
        return None
    try:
        _st_model = _SentenceTransformer(_ST_MODEL_NAME)
        return _st_model
    except Exception:
        return None


def _load_corpus() -> List[Dict[str, Any]]:
    if not _CORPUS_PATH.exists():
        return []
    try:
        return _json.loads(_CORPUS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def _load_embeddings() -> List[Dict[str, Any]]:
    if not _EMBEDDINGS_PATH.exists():
        return []
    try:
        data = _json.loads(_EMBEDDINGS_PATH.read_text(encoding="utf-8"))
        return data.get("items", []) if isinstance(data, dict) else []
    except Exception:
        return []


_CORPUS_CACHE = _load_corpus()
_EMBED_INDEX = _load_embeddings()


def _load_advice() -> List[Dict[str, Any]]:
    if not _ADVICE_PATH.exists():
        return []
    try:
        return _json.loads(_ADVICE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def _load_roadmaps() -> List[Dict[str, Any]]:
    if not _ROADMAPS_PATH.exists():
        return []
    try:
        return _json.loads(_ROADMAPS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


_ADVICE_CACHE: List[Dict[str, Any]] = _load_advice()
_ROADMAPS_CACHE: List[Dict[str, Any]] = _load_roadmaps()


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _hf_embed(query: str, token: str) -> List[float]:
    payload = _json.dumps({"inputs": query, "options": {"wait_for_model": False}}).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(HF_URL, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=_HF_TIMEOUT_SECS) as resp:
        data = _json.loads(resp.read().decode("utf-8"))
    if isinstance(data, list) and data and isinstance(data[0], (int, float)):
        return [float(x) for x in data]
    if isinstance(data, list) and data and isinstance(data[0], list):
        return [float(x) for x in data[0]]
    raise RuntimeError("Unexpected HF response shape")


def _hf_generate(prompt: str, token: str, max_new_tokens: int = 320) -> str:
    """Call HF Inference Router chat-completions endpoint and return the reply.

    Uses the OpenAI-compatible `/v1/chat/completions` schema. Raises on any
    network / API error so the caller can fall back to extractive mode.
    """
    payload = _json.dumps({
        "model": HF_GEN_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_new_tokens,
        "temperature": 0.7,
        "top_p": 0.95,
        "stream": False,
    }).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(HF_GEN_URL, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=_HF_GEN_TIMEOUT_SECS) as resp:
        data = _json.loads(resp.read().decode("utf-8"))
    # OpenAI-compatible response shape
    if isinstance(data, dict) and "choices" in data and data["choices"]:
        msg = data["choices"][0].get("message", {})
        content = msg.get("content", "")
        if isinstance(content, str) and content.strip():
            return content.strip()
    if isinstance(data, dict) and "error" in data:
        raise RuntimeError(f"HF error: {data['error']}")
    raise RuntimeError(f"Unexpected HF generation response shape: {str(data)[:200]}")


def _extractive_reply(question: str, sources: List[Dict[str, Any]]) -> str:
    """Deterministic fallback reply built from retrieved corpus sources.

    Used when HF generation is unavailable so the chatbot ALWAYS returns
    something useful (instead of erroring out).
    """
    if not sources:
        return (
            "I couldn't find anything in our corpus that directly matches your question. "
            "Try asking about specific skills, roles, or technologies \u2014 for example: "
            "\"What does a backend developer do?\" or \"How do I learn Docker?\""
        )
    lines = ["Here are the most relevant items I found in our corpus:", ""]
    for s in sources[:3]:
        title = s.get("title", "Resource")
        kind = s.get("type", "item")
        desc = (s.get("description", "") or "").strip()
        skills = s.get("skills") or []
        skills_str = ", ".join(skills[:6]) if skills else ""
        bullet = f"\u2022 **{title}** ({kind})"
        if skills_str:
            bullet += f" \u2014 key skills: _{skills_str}_"
        if desc:
            bullet += f"\n  {desc[:240]}{'\u2026' if len(desc) > 240 else ''}"
        lines.append(bullet)
    lines.append("")
    lines.append("_Tip: ask about a specific skill or role for a more focused answer._")
    return "\n".join(lines)


def _keyword_search(query: str, k: int = 3) -> List[Dict[str, Any]]:
    if not _CORPUS_CACHE:
        return []
    q_tokens = {t for t in (query or "").lower().split() if len(t) > 2}
    if not q_tokens:
        return []
    scored: List[Tuple[int, Dict[str, Any]]] = []
    for item in _CORPUS_CACHE:
        # Support both old schema (skills) and new schema (skillsRequired/relatedSkills)
        skills_list = (
            item.get("skillsRequired")
            or item.get("relatedSkills")
            or item.get("skills")
            or []
        )
        haystack = " ".join([
            str(item.get("title", "")),
            " ".join(skills_list),
            str(item.get("description", "")),
            str(item.get("track", "")),
            str(item.get("company", "")),
        ]).lower()
        overlap = sum(1 for t in q_tokens if t in haystack)
        if overlap > 0:
            scored.append((overlap, item))
    scored.sort(key=lambda p: p[0], reverse=True)
    return [item for _, item in scored[:k]]


def _chroma_result_to_source(meta: Dict[str, Any], doc: str) -> Dict[str, Any]:
    """Convert a ChromaDB result metadata dict into the source shape the rest of the code expects."""
    skills_raw = meta.get("skills", "")
    skills_list = [s.strip() for s in skills_raw.split(",")] if skills_raw else []
    return {
        "id": meta.get("parent_id", ""),
        "type": meta.get("type", ""),
        "title": meta.get("title", ""),
        "description": doc,
        "skills": skills_list,
        "track": meta.get("track", ""),
        "level": meta.get("level", ""),
        "platform": meta.get("platform", ""),
        "cost": meta.get("cost", ""),
        "company": meta.get("company", ""),
        "url": meta.get("url", ""),
    }


def retrieve_sources(query: str, k: int = 3) -> Tuple[List[Dict[str, Any]], str]:
    """Return (sources, path_used).

    Retrieval order:
      1. chromadb  -> local ChromaDB + local sentence-transformers (best quality)
      2. cache     -> embedding cosine search (in-memory, if chroma unavailable)
      3. hf        -> HF Inference API + cosine over corpus_embeddings.json
      4. keyword   -> token-overlap fallback over seed_corpus.json
      5. none      -> empty list; caller continues without retrieval
    """
    if not query:
        return [], "none"

    # ── 1. ChromaDB (primary path) ──────────────────────────────────────────
    col = _get_chroma_collection()
    if col is not None:
        st = _get_st_model()
        if st is not None:
            try:
                qvec = st.encode([query])[0].tolist()
                results = col.query(
                    query_embeddings=[qvec],
                    n_results=k,
                    include=["metadatas", "documents"],
                )
                metas = results.get("metadatas", [[]])[0]
                docs = results.get("documents", [[]])[0]
                sources = [
                    _chroma_result_to_source(m, d)
                    for m, d in zip(metas, docs)
                ]
                # De-duplicate by parent_id (keep first/highest-ranked chunk per doc)
                seen: set = set()
                unique: List[Dict[str, Any]] = []
                for s in sources:
                    pid = s.get("id", "")
                    if pid not in seen:
                        seen.add(pid)
                        unique.append(s)
                if unique:
                    return unique[:k], "chromadb"
            except Exception:
                pass  # fall through

    token = os.getenv("HF_TOKEN")

    # ── 2. Cache check ───────────────────────────────────────────────────────
    if _EMBED_INDEX and query in _EMBED_CACHE:
        qvec = _EMBED_CACHE[query]
        ranked = sorted(
            _EMBED_INDEX,
            key=lambda item: _cosine(qvec, item.get("embedding", [])),
            reverse=True,
        )
        return ranked[:k], "cache"

    # ── 3. HF retrieval ──────────────────────────────────────────────────────
    if token and _EMBED_INDEX:
        try:
            qvec = _hf_embed(query, token)
            _EMBED_CACHE[query] = qvec
            ranked = sorted(
                _EMBED_INDEX,
                key=lambda item: _cosine(qvec, item.get("embedding", [])),
                reverse=True,
            )
            return ranked[:k], "hf"
        except Exception:
            pass  # fall through to keyword

    # ── 4. Keyword fallback ──────────────────────────────────────────────────
    kw = _keyword_search(query, k=k)
    if kw:
        return kw, "keyword"

    return [], "none"


def _sources_to_factors(sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "label": f"Matched: {s.get('title', 'corpus item')} (rag_source)",
            "positive": True,
            "signal_type": "rag_source",
        }
        for s in sources
    ]


# ---------------------------------------------------------------------------
# Retrieval path notes:
#   1. chromadb  — local ChromaDB + sentence-transformers (fastest, best quality)
#   2. cache     — in-memory cosine over corpus_embeddings.json
#   3. hf        — HF Inference API (requires HF_TOKEN)
#   4. keyword   — token-overlap fallback (always works, no deps)
#   5. none      — empty; caller produces templated reply
# ---------------------------------------------------------------------------

# Simple type hints to avoid a runtime dependency on pydantic
class Message(TypedDict, total=False):
    role: Literal["user", "model"]
    content: str

# Endpoints will accept plain dicts (JSON) for requests and return plain dicts for responses.
# Expected shapes:
#   Chat request JSON: {"message": "<text>", "history": [{"role":"user","content":"..."}, ...]}
#   Chat response JSON: {"reply": "<text>"}

class InterviewQuestionRequest(BaseModel):
    role: str = Field(..., max_length=64)
    difficulty: str = Field(..., max_length=32)
    questionNumber: int = Field(..., ge=0, le=200)
    # Cap previous-questions list to avoid token explosion
    previousQuestions: list[str] = Field(default_factory=list, max_length=50)

class InterviewAnswerRequest(BaseModel):
    question: str = Field(..., max_length=5000)
    answer: str = Field(..., max_length=10000)
    role: str = Field(..., max_length=64)
    difficulty: str = Field(..., max_length=32)

class InterviewQuestionResponse(BaseModel):
    question: str

class InterviewFeedbackResponse(BaseModel):
    score: float
    feedback: str
    strengths: list[str]
    improvements: list[str]

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "CareerPath RAG Chatbot API is running"}

@app.options("/chat")
async def options_chat():
    return {"message": "OK"}

@app.post("/chat")
async def chat(req: Dict[str, Any]):
    """Pure HF + RAG chatbot.

    Pipeline:
      1. HF retrieval (cache → HF embeddings → keyword fallback)
      2. HF text-generation (zephyr-7b-beta) with the retrieved context
      3. Fallback: extractive templated reply built from sources
    """
    try:
        user_message = (req.get("message", "") or "").strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="message field is required")

        # --- Step 1: retrieval ---------------------------------------------
        try:
            sources, retrieval_path = retrieve_sources(user_message, k=3)
        except Exception:
            sources, retrieval_path = [], "none"

        # --- Step 2: build prompt + try HF generation ---------------------
        hf_token = os.getenv("HF_TOKEN")

        # Compact context block (truncate descriptions to keep prompt small)
        if sources:
            ctx_lines = []
            for s in sources:
                title = s.get("title", "")
                desc = (s.get("description", "") or "")[:200]
                skills = s.get("skills") or []
                skills_str = (", ".join(skills[:6])) if skills else ""
                if skills_str:
                    ctx_lines.append(f"- {title} | skills: {skills_str} | {desc}")
                else:
                    ctx_lines.append(f"- {title}: {desc}")
            context_text = "\n".join(ctx_lines)
        else:
            context_text = "(no relevant context found)"

        # Short, recent conversation history (keep prompt size bounded)
        history_lines = []
        for item in (req.get("history") or [])[-4:]:
            role = item.get("role", "user")
            content = (item.get("content", "") or "").strip()[:300]
            if content:
                history_lines.append(f"{'User' if role == 'user' else 'Assistant'}: {content}")
        history_block = ("\n".join(history_lines) + "\n") if history_lines else ""

        # Zephyr instruction format works well with this plain template too
        prompt = (
            "You are CareerPath Assistant, a concise and helpful career guide for students "
            "and fresh graduates. Use only the CONTEXT below to ground specifics about jobs "
            "and courses. If the context does not cover the user's question, answer briefly "
            "from general career knowledge and say so. Keep replies under 180 words.\n\n"
            f"CONTEXT:\n{context_text}\n\n"
            f"{history_block}"
            f"User: {user_message}\n"
            "Assistant:"
        )

        reply_text = ""
        generation_path = "none"
        if hf_token:
            try:
                gen = _hf_generate(prompt, hf_token, max_new_tokens=320)
                # Strip any echoed "Assistant:" prefix the model may emit
                gen = gen.split("User:")[0].strip()
                if gen.lower().startswith("assistant:"):
                    gen = gen[len("assistant:"):].strip()
                if gen:
                    reply_text = gen
                    generation_path = "hf"
            except Exception as e:
                print(f"HF generation failed: {e}")

        if not reply_text:
            reply_text = _extractive_reply(user_message, sources)
            generation_path = "extractive"

        # --- Step 3: build explainability envelope ------------------------
        factors = _sources_to_factors(sources)
        used_fallback = (
            retrieval_path in ("keyword", "none") or generation_path == "extractive"
        )
        if retrieval_path == "hf" and generation_path == "hf" and len(sources) >= 2:
            confidence = "High"
        elif generation_path == "extractive" and not sources:
            confidence = "Low"
        elif used_fallback:
            confidence = "Medium"
        else:
            confidence = _derive_confidence(factors, used_fallback)

        basis_parts = []
        if sources:
            basis_parts.append(f"{len(sources)} source(s) via {retrieval_path}")
        else:
            basis_parts.append("no corpus sources retrieved")
        basis_parts.append(f"generation={generation_path}")
        basis = "; ".join(basis_parts)

        return {
            "reply": reply_text,
            "sources": [
                {"id": s.get("id"), "title": s.get("title"), "type": s.get("type")}
                for s in sources
            ],
            "factors": factors,
            "confidence": confidence,
            "basis": basis,
            "retrieval_path": retrieval_path,
            "generation_path": generation_path,
            "signal_types_used": ["rag_source"] if factors else [],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

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

@app.options("/generate-interview-question")
async def options_generate_question():
    return {"message": "OK"}

@app.post("/generate-interview-question", response_model=InterviewQuestionResponse)
async def generate_interview_question(req: InterviewQuestionRequest):
    try:
        # Map role to readable name
        role_names = {
            'frontend': 'Frontend Developer',
            'backend': 'Backend Developer',
            'fullstack': 'Full Stack Developer',
            'data-science': 'Data Scientist',
            'mobile': 'Mobile Developer',
            'devops': 'DevOps Engineer',
            'ui-ux': 'UI/UX Designer',
            'product-manager': 'Product Manager'
        }
        
        role_name = role_names.get(req.role, req.role)
        
        # Pick a question from the static bank (no LLM)
        question_text = _pick_interview_question(
            role=req.role,
            difficulty=req.difficulty,
            previous_questions=req.previousQuestions,
            question_number=req.questionNumber,
        )
        return InterviewQuestionResponse(question=question_text)
    
    except Exception as e:
        error_message = f"Error generating interview question: {str(e)}"
        raise HTTPException(status_code=500, detail=error_message)

@app.options("/evaluate-interview-answer")
async def options_evaluate_answer():
    return {"message": "OK"}

@app.post("/evaluate-interview-answer", response_model=InterviewFeedbackResponse)
async def evaluate_interview_answer(req: InterviewAnswerRequest):
    try:
        # Evaluate using keyword-based scoring (no LLM)
        result = _evaluate_answer_no_llm(
            question=req.question,
            answer=req.answer,
            role=req.role,
            difficulty=req.difficulty,
        )
        return InterviewFeedbackResponse(
            score=result["score"],
            feedback=result["feedback"],
            strengths=result["strengths"],
            improvements=result["improvements"],
        )
    except Exception as e:
        error_message = f"Error evaluating answer: {str(e)}"
        raise HTTPException(status_code=500, detail=error_message)

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
