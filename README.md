# 1. Project Title And Tagline

## CareerPath

AI-powered career platform for students and fresh graduates.

![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)
![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB)
![React 18](https://img.shields.io/badge/React-18-61DAFB)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

## 2. One-Paragraph Summary

CareerPath runs a hybrid BM25 + dense retrieval pipeline over 436 IT career items (648 semantic chunks, 768-dimensional embeddings) sourced from HuggingFace, with a hallucination grounding check on every response. The explainability layer wraps every AI output in a confidence-rated envelope with typed signal factors. Face expression coaching uses lazy-loaded TinyFaceDetector at inputSize 160 for low-latency CPU inference. Generation, retrieval, scoring, and explainability are architecturally separated, making the system provider-agnostic by design.

## 3. Features

- Feature 1 — ReasoningCard: single explainability renderer for all AI outputs
- Feature 2 — Career DNA Radar: 5-axis skill scoring (Frontend/Backend/DevOps/AI-ML/Communication)
- Feature 3 — Readiness Score: weighted composite of DNA, profile completion, interview score
- Feature 4 — Skill Gap + Job Match: 60/20/20 weighted scoring with explainability factors
- Feature 5 — RAG-Grounded Chat: hybrid BM25 + dense retrieval, 436 items, grounding verified
- Feature 6 — Voice Interview Coach: Web Speech API with WPM, filler word, and pause metrics
- Feature 7 — What-If Career Simulator: client-side readiness recompute with Framer Motion
- Feature 8 — Achievement Badge + Certificate: client-side PDF credential generation via jsPDF
- Feature 9 — Knowledge Graph: @xyflow/react interactive skill dependency visualization

## 4. Tech Stack

| Frontend | Backend |
|----------|---------|
| React 18 | FastAPI (Python 3.11) |
| Vite | Gemini 2.0 Flash |
| Tailwind CSS | sentence-transformers |
| Firebase Auth + Firestore | ChromaDB (optional) |
| Framer Motion | HuggingFace Inference API (optional) |
| Chart.js | hybrid BM25 + dense retrieval |
| @xyflow/react | pure Python cosine similarity |
| face-api.js | |
| jsPDF | |

## 5. Corpus And RAG

- Source: NxtGenIntern/job_titles_and_descriptions (HuggingFace)
- Original seed: 157 items
- Enriched corpus: 436 items (279 new IT roles added)
- Chunks: 648 semantic chunks
- Embeddings: 768-dimensional, all-mpnet-base-v2
- Retrieval: hybrid_alpha_0.5 (BM25 + dense)
- Grounding: verified per response, zero hallucination warnings in smoke test
- Verified commit: c2d0a70

## 6. Explainability Layer

The ExplainabilityEnvelope is the shared contract for AI-facing results.

- Every AI output is wrapped in an envelope with: output, factors, confidence, basis
- Five signal types: rag_source, skill_match, weight_component, profile_field, interview_metric
- Confidence derived strictly from factor count and type, never freely assigned
- ReasoningCard is the only component that renders explanations
- Graceful degradation: empty factors = nothing rendered, no error

## 7. Local Setup

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Create `backend/.env`:

```env
GEMINI_API_KEY=...
HF_TOKEN=...
```

`GEMINI_API_KEY` is required. `HF_TOKEN` is optional and enables dense retrieval.

Note: ChromaDB and HF Inference are optional. The system runs fully on keyword fallback without them.

## 8. CI/CD

GitHub Actions runs on every push and pull request to main:

- backend-lint-and-import: Python import check
- backend-route-audit: verifies all frozen routes are present
- frontend-build: production build with artifact upload
- corpus-validation: asserts 436 items / 648 chunks / 648 embeddings

Badge already shown at top of README.

## 9. API Reference

| Method | Route | Purpose |
|--------|-------|---------|
| GET | / | Health check |
| POST | /summarize-cv | PDF upload -> structured CV JSON |
| POST | /generate-interview-question | Returns question + difficulty |
| POST | /evaluate-interview-answer | Returns score, feedback, strengths, improvements |
| POST | /chat | RAG-grounded chat with explainability envelope |
| POST | /career-dna | 5-axis skill scoring |
| POST | /readiness-score | Weighted readiness composite |
| POST | /explain-match | Job match explainability factors |

## 10. Architectural Rules

1. Additive only — no refactor, rename, or delete outside immediate task scope
2. ReasoningCard is the only renderer of explanations
3. Five signal types are a closed set
4. Frozen routes keep their exact request/response shape
5. Graceful degradation — never crash, always fallback
6. No numpy on the backend — pure Python math only
7. No new heavy dependencies without explicit approval
8. No backend writes from Feature 7 or Feature 9

## 11. Phase 2 Roadmap

| Priority | Item | Notes |
|----------|------|-------|
| 1 | llm_router.py + Groq on interview routes | Sub-200ms interview feedback |
| 2 | Redis cache replacing in-memory dict | Survive restarts, share across replicas |
| 3 | Confidence-gated generation | Block LLM call when retrieval_path=none |
| 4 | Mistral on CV summarization | Higher quality structured extraction |
| 5 | Lazy-load heavy frontend chunks | face-api and pdf bundles on demand |

## 12. Contributing

This is a personal project. Issues and pull requests are welcome. Before contributing, read the architectural rules in section 10. All changes must pass the CI pipeline before merge.
