# CareerPath

CareerPath is a full-stack AI career guidance platform for students and early-career candidates. It combines a React 18 frontend, a FastAPI backend, Firebase-backed user flows, and retrieval-augmented AI features for career advice, CV analysis, mock interviews, readiness scoring, and explainable recommendations.

## What It Does

- RAG career chat with hybrid retrieval over a curated career corpus.
- CV/resume upload, PDF parsing, skill extraction, and improvement suggestions.
- Career DNA and readiness scoring with transparent factor breakdowns.
- RAG-grounded mock interview question generation and rubric-based evaluation.
- Concept coverage, missing concept feedback, and score breakdowns for interview answers.
- Career roadmaps, learning resources, job insights, and application generation.
- Optional facial-expression analysis for interview delivery feedback.
- Admin dashboard for managing platform content.

## Architecture

```text
frontend/  React 18 + Vite app
backend/   FastAPI API used for local development and main backend source
careerpath-backend/  Hugging Face Space backend mirror/submodule
```

Core runtime flow:

```text
React frontend
  -> FastAPI backend
      -> Hybrid retrieval corpus
      -> Hugging Face inference APIs when configured
      -> Deterministic scoring and explainability helpers
  -> Firebase services for auth/data features
```

## Tech Stack

Frontend:

- React 18
- Vite 6
- React Router
- Firebase
- Tailwind CSS
- Chart.js
- React Flow
- Framer Motion
- lucide-react

Backend:

- Python 3.12
- FastAPI
- Uvicorn
- PyPDF2
- sentence-transformers
- chromadb-client
- Hugging Face inference integrations

## Key Backend Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | GET | API health check |
| `/health/dependencies` | GET | Dependency and optional service status |
| `/docs` | GET | Swagger API docs |
| `/chat` | POST | RAG career chatbot |
| `/summarize-cv` | POST | Parse and analyze a PDF CV |
| `/roadmap` | POST | Generate a career roadmap |
| `/interview/question` | POST | Generate a RAG-grounded mock interview question |
| `/interview/evaluate` | POST | Evaluate a mock interview answer |
| `/career-dna` | POST | Calculate Career DNA category scores |
| `/readiness-score` | POST | Calculate weighted career readiness |
| `/explain-match` | POST | Explain a job/profile match |
| `/face-expression` | POST | Analyze an uploaded expression frame |

Compatibility aliases are also kept for older frontend calls, including `/generate-interview-question`, `/evaluate-interview-answer`, and `/analyze-expression`.

## Mock Interview RAG

The mock interview flow supports optional `sessionId` and `questionNumber` fields. When a question is generated with those fields, the backend stores a reference answer in memory for that session/question pair. Evaluation then uses that reference to calculate:

- `concepts_covered`
- `concepts_missing`
- `coverage_pct`
- `score_breakdown`
- `rag_grounded`
- `skills_tested`

The deterministic rubric reports these score breakdown keys:

- `core_concepts`
- `technical_accuracy`
- `practical_example`
- `communication`

Calls without `sessionId` remain backward compatible.

## Local Setup

### Backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file:

```text
HF_TOKEN=your_hugging_face_token
USE_LOCAL_EMBEDDINGS=false
ENABLE_RERANKER=false
ENABLE_LLM_GENERATOR=false
```

Run the backend:

```bash
uvicorn main:app --reload --port 8000
```

Open API docs:

```text
http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server usually runs at:

```text
http://localhost:5173
```

## Build Checks

Backend import check:

```bash
cd backend
python -c "import main; print('OK')"
```

Frontend production build:

```bash
cd frontend
npm run build
```

On Windows PowerShell, if `npm.ps1` is blocked by execution policy, use:

```powershell
npm.cmd run build
```

## Deployment Notes

The `careerpath-backend/` directory is configured for Hugging Face Spaces Docker deployment. Required Space secret:

```text
HF_TOKEN=<your Hugging Face token>
```

Recommended Space variables for CPU-friendly deployment:

```text
USE_LOCAL_EMBEDDINGS=false
ENABLE_RERANKER=false
ENABLE_LLM_GENERATOR=false
```

The backend exposes `/health/dependencies` so deployment checks can verify corpus loading, optional generator/reranker state, and token availability.

## Git Notes

`careerpath-backend/` is tracked as a gitlink-style nested repository. When switching branches, the root repo may expect a different nested backend commit. If Git blocks a branch switch because of `careerpath-backend`, align the nested checkout to the commit expected by the target branch, then retry the root branch switch.

## License

This project was built for the IDC Hackathon as a CareerPath AI prototype.
