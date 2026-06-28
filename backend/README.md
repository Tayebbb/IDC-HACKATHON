---
title: CareerPath Backend
sdk: docker
app_port: 7860
---

# CareerPath Backend

FastAPI backend for CareerPath. Deploy this folder as the root of the Hugging Face Docker Space.

## Deployment

 Space secret:


HF_TOKEN=<your Hugging Face read token>
```

Recommended Space variables:

```text
USE_LOCAL_EMBEDDINGS=false
ENABLE_RERANKER=false
ENABLE_LLM_GENERATOR=false
```

Local run:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 7860
```

## Health Checks

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Basic API health |
| `/health/dependencies` | GET | Dependency and optional service status |
| `/docs` | GET | FastAPI Swagger docs |

## Main Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/summarize-cv` | POST | Parse and analyze a PDF CV |
| `/roadmap` | POST | Generate a career roadmap |
| `/interview/question` | POST | Generate one RAG-grounded mock interview question |
| `/interview/evaluate` | POST | Evaluate an interview answer with rubric and concept gaps |
| `/chat` | POST | RAG career chatbot |
| `/face-expression` | POST | Analyze facial expression when vision dependencies are available |
| `/job-recommendations` | POST | Generate job recommendations |

## Mock Interview RAG Notes

The mock interview flow supports optional `sessionId` and `questionNumber` fields. When provided, the backend stores an in-memory reference answer per generated question, then uses it during evaluation for deterministic scoring, concept coverage, and missing concept feedback. Calls without a session still work for backward compatibility.
