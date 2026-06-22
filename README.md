# CareerPath — AI-Powered Career Development Platform

CareerPath is a full-stack career development platform for students and fresh graduates. It combines **React + Vite**, **FastAPI**, **Firebase**, and **Gemini AI** with a unified **Explainability Layer** that transforms every AI output — scores, recommendations, and conversational replies — into traceable, factor-driven explanations backed by concrete signals.

This is the single README for the whole project. It covers both the frontend and backend, and documents the nine features that make up the Explainability Layer.

## What the platform does

CareerPath helps users:

- discover jobs and compare match scores
- identify missing skills for a target role
- find learning resources to close skill gaps
- generate AI-powered career roadmaps
- chat with an AI career assistant grounded in a real corpus
- upload a CV and extract structured career data
- practise interviews with generated questions, answer evaluation, and voice analysis
- visualise their Career DNA, readiness score, and the knowledge graph of their career path
- earn a verifiable "Mindsparks Career Ready" badge and downloadable certificate

Every visible AI answer ships with a **ReasoningCard** that explains the factors, signal types, and confidence behind it.

## The Explainability Layer

### Envelope contract

Every explainable output uses the same shape on the frontend and the backend:

```ts
ExplainabilityEnvelope = {
  output: any,                         // score, text, or value being explained
  factors: Factor[],                   // ordered list of contributing signals
  confidence: "High" | "Medium" | "Low",
  basis: string,                       // short human-readable derivation summary
  signal_types_used: SignalType[]
}

Factor = {
  label: string,
  positive: boolean,
  signal_type: SignalType,
  value?: number | string
}

SignalType = "rag_source" | "skill_match" | "weight_component"
           | "profile_field" | "interview_metric"
```

Confidence is derived identically on both sides:

- **High** — ≥ 3 factors, at least one `rag_source` or `skill_match`, no fallback used.
- **Medium** — 1–2 factors, fallback used, or only `weight_component` signals.
- **Low** — 0 factors, only `profile_field` signals, or keyword-only fallback.

### Features 1 – 9

| # | Feature | Where it lives |
|---|---|---|
| 1 | **ReasoningCard** — the single component that renders every explanation | `frontend/src/components/ReasoningCard.jsx` |
| 2 | **Career DNA** radar chart (5 categories) + reasoning | backend `/career-dna` · `frontend/src/components/IntelligenceSection.jsx` |
| 3 | **Career Readiness Score** (40 % skills · 30 % profile · 30 % interview) | backend `/readiness-score` · `IntelligenceSection.jsx` |
| 4 | **Explainability wrapper** on skill-gap & job-match cards | `JobCard.jsx`, `SkillGapCard.jsx`, `Jobs.jsx` |
| 5 | **RAG-grounded `/chat`** with a 57-item seed corpus (HF embeddings + keyword fallback) | `backend/main.py`, `backend/data/seed_corpus.json`, `backend/scripts/build_embeddings.py` |
| 6 | **Voice Interview Coach** — Web Speech API + client-side WPM, filler, and pause metrics | `frontend/src/pages/MockInterview.jsx` |
| 7 | **What-If Career Simulator** — live client-side recompute with spring-animated readiness | `frontend/src/components/WhatIfSimulator.jsx`, mounted in `CareerRoadmap.jsx` |
| 8 | **Mindsparks Badge + Certificate** — gated at score ≥ 80, jsPDF export with logos | `frontend/src/components/MindsparksCredential.jsx` |
| 9 | **Knowledge Graph** — react-flow map: User → Skills → Missing Skills → Target Job → Courses | `frontend/src/pages/KnowledgeGraph.jsx` |

## Tech Stack

### Frontend

- React 18, Vite, React Router
- Firebase Authentication and Firestore
- Tailwind CSS (dark neon theme, primary `#A855F7`)
- Framer Motion (spring physics for the What-If simulator)
- Chart.js + react-chartjs-2 (Career DNA radar)
- @xyflow/react (Knowledge Graph)
- lucide-react, react-hot-toast, react-markdown
- jsPDF (certificate export)
- Web Speech API (browser-native, no extra dep)

### Backend

- Python 3.12, FastAPI, Uvicorn
- google-genai SDK (`gemini-2.0-flash`)
- PyPDF2, python-dotenv, pydantic ≥ 2
- Pure-Python cosine similarity for RAG (no numpy added)
- Hugging Face Inference API for embeddings (`sentence-transformers/all-MiniLM-L6-v2`)

## Project Structure

```text
IDC HACKATHON/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ReasoningCard.jsx          # Feature 1
│   │   │   ├── IntelligenceSection.jsx    # Features 2 + 3
│   │   │   ├── JobCard.jsx                # Feature 4
│   │   │   ├── SkillGapCard.jsx           # Feature 4
│   │   │   ├── WhatIfSimulator.jsx        # Feature 7
│   │   │   ├── MindsparksCredential.jsx   # Feature 8
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Jobs.jsx
│   │   │   ├── Chatassistance.jsx
│   │   │   ├── CareerRoadmap.jsx
│   │   │   ├── MockInterview.jsx          # Feature 6
│   │   │   ├── KnowledgeGraph.jsx         # Feature 9
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── explainability.js          # envelope contract source of truth
│   │   │   ├── matchScore.js
│   │   │   └── getLearningSuggestions.js
│   │   ├── assets/credential/             # logo assets for the certificate
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── main.py                            # FastAPI app + envelope helpers
│   ├── scripts/
│   │   └── build_embeddings.py            # offline RAG embeddings builder
│   ├── data/
│   │   ├── seed_corpus.json               # 32 jobs + 25 courses (Feature 5)
│   │   └── corpus_embeddings.json         # generated by build_embeddings.py
│   └── requirements.txt
├── Code Front/                            # source logos for the certificate
│   ├── AUST IDC - White.png
│   ├── Code front.png
│   └── Mindsparks 26 Logo.png
└── README.md
```

## Backend API

The FastAPI app exposes these routes. Frozen routes keep their original request/response shape; `/chat` was internally extended (new fields added, none removed).

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/` | Health check |
| `POST` | `/chat` | RAG-grounded chat assistant (returns `sources`, `factors`, `confidence`, `basis`, `retrieval_path`, `signal_types_used` alongside the original reply) |
| `POST` | `/summarize-cv` | Extract structured data from a PDF CV |
| `POST` | `/generate-interview-question` | Generate a new interview question |
| `POST` | `/evaluate-interview-answer` | Score and review an interview answer |
| `POST` | `/career-dna` | Score 5 career categories and explain each factor |
| `POST` | `/readiness-score` | Compute readiness with 40/30/30 weights and an envelope |
| `POST` | `/explain-match` | Wrap an existing job-match result in an envelope |

OpenAPI docs are available at `/docs` and `/redoc`.

## Setup

### 1) Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

### 2) Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1                 # Windows PowerShell
pip install -r requirements.txt
uvicorn main:app --reload --port 8000        # http://127.0.0.1:8000
```

### 3) (Optional) Build RAG embeddings

The RAG pipeline auto-degrades to keyword search if embeddings are missing — chat still works but `confidence` will be `Medium` instead of `High`. To get the high-confidence path:

```powershell
$env:HF_TOKEN = "<your_huggingface_token>"
cd backend
.\.venv\Scripts\python.exe scripts\build_embeddings.py
# writes backend/data/corpus_embeddings.json
```

## Environment Variables

`backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
HF_TOKEN=your_huggingface_token        # optional, only for high-confidence RAG
```

Frontend Firebase config lives in `frontend/.env` (see `frontend/src/firebase.js` for the variable names). Keep real secrets out of version control.

## Scoring formulas (reference)

- **Career DNA per category** — `min(100, round(matched_skills_in_category / total_skills_in_category * 100))`.
- **Job match** — `60 % skills + 20 % experience + 20 % track` (existing `matchScore.js`, surfaced as `weight_component` factors).
- **Readiness Score** — `0.40 × dna_avg + 0.30 × profile_completion + 0.30 × interview_score`.
- **What-If Simulator** — same readiness formula client-side; each toggled skill adds `+8` to its mapped DNA category (capped at 100), animated with a Framer Motion spring (`stiffness 120, damping 18`).
- **Voice metrics** — WPM = words / minutes (good band 110–160), filler matches against `["um","uh","like","you know","basically","literally"]`, pause = sum of result gaps > 1.2 s.

## Notes

- Permissive CORS in dev so the Vite server can hit FastAPI directly.
- CV upload expects PDF files.
- The interview endpoints return structured JSON designed for the React UI.
- The badge and certificate render only when `readinessScore ≥ 80`.
- The Knowledge Graph and ReasoningCard both render placeholder / nothing instead of an error state when their data is missing — the rest of the app stays usable.
- No file outside the documented scope is modified by the Explainability Layer.

## Running the Full App

Open two terminals:

1. **Backend**

   ```powershell
   cd backend
   .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
   ```

2. **Frontend**

   ```powershell
   cd frontend
   npm run dev
   ```

Then open <http://localhost:5173> and walk through Dashboard → Jobs → Chat → Mock Interview → Career Roadmap (What-If) → Knowledge Graph to see every explainability feature in action.
