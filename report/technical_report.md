# 1. Title Page

**Project Name:** CareerPath: AI-Powered Career Intelligence Platform

**Team Name:** CareerPath Team

**Hackathon:** IIUC National Hackathon / DS2CS Hackathon

**Tagline:** Personalized career guidance, interview practice, and job-readiness intelligence for students and fresh graduates.

# 2. Abstract

CareerPath is a full-stack AI career guidance platform for students and fresh graduates, with a strong focus on the Bangladesh early-career market. The system combines authenticated user profiles, CV analysis, RAG-powered career chat, roadmap generation, job application drafting, mock interview evaluation, and live expression coaching. Its novelty is the integration of career-domain retrieval, explainable readiness scoring, role-specific interview rubrics, and hybrid computer-vision feedback in one deployable product. The backend uses FastAPI, a local seed corpus, BM25 plus dense retrieval, HuggingFace Inference API calls, and CPU-safe fallbacks. The frontend uses React 18, Vite, Firebase Auth/Firestore, React Flow, Chart.js, and local face-api models. The result is a practical, low-cost coaching system that can run on free or CPU-only hosting while still providing source-grounded and personalized guidance.

# 3. Problem Statement

Students and fresh graduates in Bangladesh often face a gap between academic preparation and the expectations of software, data, AI, and technology employers. Many learners know individual tools or courses but struggle to connect those skills to concrete career tracks, interview expectations, job descriptions, and application materials. Access to personalized career mentors is limited, and generic online advice rarely reflects a student's actual CV, experience level, target role, or communication readiness.

CareerPath addresses this gap by turning fragmented preparation into a single guided workflow. It reads a learner profile and CV, retrieves relevant jobs and courses from a curated corpus, generates career roadmaps and application letters, and simulates technical interviews. The platform also adds live expression coaching so candidates can practice delivery, confidence, and interview presence alongside technical answers. The system is designed for low-cost deployment, making it realistic for student communities and hackathon-scale production.

# 4. Objectives

1. Provide authenticated student access with persistent profiles, chat threads, job applications, and interview history using Firebase Auth and Firestore.
2. Generate career chat answers, roadmaps, and application letters using RAG with cited sources, metadata filtering, and grounding checks.
3. Analyze uploaded PDF CVs up to 10 MB and extract skills, tools, roles, and improvement suggestions for profile enrichment.
4. Run role- and difficulty-aware mock interviews with generated reference answers, concept coverage scoring, and per-question feedback.
5. Deliver live expression coaching through local face-api detection plus a backend HuggingFace expression proxy, with retry, local-only fallback, and privacy notice.
6. Expose explainability and observability signals, including source IDs, retrieval scores, confidence bands, readiness components, and a gated `/debug/rag` endpoint.
7. Keep deployment feasible on free or CPU-only infrastructure such as Vercel and HuggingFace Spaces.

# 5. System Architecture

The inspected codebase has three main runtime layers: a React frontend, a FastAPI AI backend, and external managed services for authentication, persistence, and inference. The prompt mentioned Supabase, but no Supabase client, environment variable, or integration was found in the repository; the implemented persistence layer is Firebase Auth and Firestore, with JSON files for backend corpus/reference data and optional ChromaDB support.

```text
User Browser
  |
  v
React 18 + Vite Frontend
  - Firebase Auth login/register/reset
  - Firestore profiles, chat threads, jobs, applications, interview history
  - face-api local expression detection
  |
  | HTTP via VITE_API_URL
  v
FastAPI Backend
  - /chat
  - /roadmap
  - /generate-application
  - /summarize-cv
  - /interview/question
  - /interview/evaluate
  - /face-expression
  - /career-dna and /readiness-score
  |
  +--> Hybrid RAG
  |      seed_corpus.json
  |      query expansion
  |      metadata filters
  |      BM25 scoring
  |      dense semantic scoring
  |      context window
  |      citations and verifier
  |
  +--> HuggingFace Inference API
  |      Llama chat completion
  |      feature extraction embeddings
  |      trpakov/vit-face-expression
  |
  +--> Local backend data
         seed_corpus.json
         interview_references.json
         optional ChromaDB dependency/legacy vector path

Deployment
  - Frontend: Vercel, output directory `build`
  - Backend: HuggingFace Spaces Docker, port 7860
  - Local compose: frontend, backend, optional Chroma service
```

# 6. Technologies Used

| Area | Technologies found in code |
| --- | --- |
| Frontend | React 18.2.0, Vite 6.4.3, Tailwind tooling, Firebase 12.6.0, React Router, Framer Motion, lucide-react, `@xyflow/react` 12.11.1, Chart.js 4.5.1, `@vladmandic/face-api` 1.7.15 |
| Backend | FastAPI 0.121.2 in `backend/requirements.txt`, Pydantic 2.x, uvicorn 0.38.0, PyPDF2 3.0.1, python-multipart, httpx |
| AI/ML | BM25 implementation, sentence-transformers 5.6.0, HuggingFace Inference API, CPU torch package, transformers, optional cross-encoder reranker, local face-api models, `trpakov/vit-face-expression` |
| Database and storage | Firebase Auth, Firestore, `backend/data/seed_corpus.json`, `backend/data/interview_references.json`, optional ChromaDB client/service. Supabase was not found in implementation. |
| Deployment | Vercel for frontend, HuggingFace Spaces Docker for backend mirror, Docker Compose for local multi-service runs. The Spaces mirror uses `python:3.12-slim`; the root backend Dockerfile currently uses `python:3.11-slim`, which should be reconciled before final release. |

# 7. Key Features

1. **RAG-powered career chat.** The chat endpoint retrieves relevant corpus entries using BM25 and dense semantic scoring, then returns grounded answers with source citations. This matters because students receive guidance tied to real project corpus data instead of only generic language-model output.

2. **Career roadmap generation.** The roadmap page sends the target job and user profile to the backend, which combines profile context with RAG and HuggingFace generation. This gives learners a structured path from current skills to a target role.

3. **PDF CV analysis.** The backend accepts PDF resumes, extracts text with PyPDF2, identifies skills/tools/roles, and can ask the model for structured improvements. The frontend can merge extracted skills into the user profile, reducing manual setup effort.

4. **Job application letter generator.** The application generator uses profile data and target job context to produce a tailored letter. This helps fresh graduates convert their profile into a professional artifact quickly.

5. **Mock interview system.** The app generates role-specific interview questions, stores reference answers, evaluates user responses against concept coverage, and returns rubric-based feedback. This supports repeated practice for both technical accuracy and communication quality.

6. **Live expression coaching.** The frontend detects faces locally, crops the face region, sends sampled frames to the backend expression proxy, and ensembles local plus HF scores. Candidates get coaching signals about presence and delivery without streaming full video continuously.

7. **Career DNA and readiness scoring.** The backend computes category scores across Frontend, Backend, DevOps, AI/ML, and Communication, then combines profile, DNA, and interview data into readiness scores. The UI visualizes these signals with explainability factors.

8. **Persistent student workflow.** Firebase Auth and Firestore support saved profiles, job applications, chat threads, contacts, resources, and interview history. This turns the project from a one-off AI demo into a continuing preparation workspace.

# 8. Implementation Details

## RAG Pipeline

The primary RAG code lives in `backend/main.py`. `_load_hybrid_corpus()` loads `backend/data/seed_corpus.json`, normalizes skills and metadata, tokenizes documents, and prepares BM25 document statistics. `_expand_query()` adds role and skill synonyms, while `_filter_corpus()` applies preferred track, experience level, and source-type filtering. Retrieval is handled by `_hybrid_retrieve()`, which combines BM25 and dense semantic scores using the tunable `RAG_ALPHA` environment value. Dense scoring uses HuggingFace feature extraction when available and can fall back to local sentence-transformers if enabled; failures degrade to zero dense scores instead of breaking the request.

After retrieval, `_build_context_window()` orders selected chunks to reduce lost-in-the-middle effects. `build_rag_answer()` produces concise answers with source markers such as `[S1]`, and source objects include `why_this_source` explanations. `_verify_grounding()` provides a lightweight lexical grounding verifier. `/debug/rag` is gated by `ENABLE_RAG_DEBUG` and returns retrieval path, top source IDs, scores, filters, alpha, and latency for inspection. ChromaDB exists as a dependency and legacy/health path but is not the primary retrieval path for `/chat`.

## Mock Interview

The mock interview flow is split between `frontend/src/pages/MockInterview.jsx`, `frontend/src/components/FaceExpressionOverlay.jsx`, and backend endpoints in `backend/main.py`. `/interview/question` accepts role, difficulty, session ID, previous questions, and profile context. It calls `_get_interview_rag_context()` to retrieve relevant role material, then uses `_generate_reference_answer()` to create a structured reference answer that may include `must_mention`, bonus points, red flags, and weights.

Reference answers are no longer only in memory in the inspected backend; they are loaded and persisted through `backend/data/interview_references.json`. The backend also maintains per-role anti-repeat question history through helper functions such as `_role_question_key()`, `_recent_role_questions()`, and `_store_role_question()`. `/interview/evaluate` compares the user answer with the stored or regenerated reference answer, extracts concepts with `_answer_concepts_for_question()`, computes semantic gaps, and returns a rubric with core concepts, technical accuracy, practical example, and communication scores. The frontend adds speech metrics and optional expression feedback before saving interview history.

## Expression Coaching

`FaceExpressionOverlay.jsx` implements the live computer-vision flow. It requests webcam access, loads `@vladmandic/face-api` models from `frontend/public/models/`, checks whether frames contain usable content, detects a face, and crops the detected bounding box before sending a JPEG to `/face-expression`. The backend endpoint enforces image type and size limits, proxies the cropped image to HuggingFace model `trpakov/vit-face-expression`, normalizes labels, and returns a stable response envelope even on failure.

The frontend includes retry with exponential backoff for the backend expression call, a local-only toggle that skips HF analysis, a one-time privacy notice, visible model state badges, expression normalization helpers, ensemble scoring, rolling median smoothing, baseline calibration, and hysteresis for coaching tips. This design reduces bandwidth, improves reliability, and keeps the experience usable when HF inference is unavailable.

## CV Analysis

The CV upload flow is implemented by `frontend/src/pages/CvUpload.jsx` and backend `/summarize-cv`. The backend accepts PDF uploads only, limits size to 10 MB, extracts text with PyPDF2, and identifies skills, tools, and roles using keyword dictionaries. It can ask the LLM to structure CV information and recommend hot skills, but has deterministic fallbacks when AI calls fail. The frontend presents extracted skills/tools/roles and can merge selected skills into the Firestore user profile, connecting CV analysis to later roadmap, chat, and readiness features.

# 9. Results and Evaluation

The implemented backend supports the required AI API surface: chat, roadmap, application generation, CV summarization, interview question generation, interview evaluation, expression analysis, career DNA, readiness scoring, and RAG debugging. Prior validation work for this codebase included Python AST checks and a backend runtime import check, confirming the patched backend can at least parse and import without starting a full server. During the earlier Vite build-path fix, the Windows space-path issue was investigated and the frontend output path was changed to the no-space `build` directory used by Vercel; no build was rerun during this report task because the request explicitly prohibited builds.

Retrieval quality is observable but not yet benchmarked. The strongest indicators present in code are tunable alpha, query expansion, metadata filtering, source citations, `why_this_source`, grounding verification, retrieval path logging, top source IDs, scores, latency, and a gated `/debug/rag` endpoint. There is no retrieval test set or numeric Recall@K/MRR result in the repository, so this report does not claim retrieval accuracy.

Expression coaching signal quality is improved through local face detection, frame-content checks, face cropping before backend upload, retry/backoff, ensemble normalization, smoothing, baseline calibration, and local-only fallback. However, no automated test results or model accuracy metrics were found for expression recognition, so the feature should be presented as coaching support rather than a medical or psychological assessment.

# 10. Challenges and Limitations

HuggingFace Spaces free hosting is CPU-only and may have cold starts, limited memory, and ephemeral filesystem behavior. The file-backed interview reference store is better than an in-memory dictionary, but it is still not as durable as Firestore, Supabase, or another managed database during redeployments.

The RAG pipeline is strong for a hackathon project but lacks a formal retrieval evaluation set. ChromaDB is present as a dependency and legacy/health path, while `/chat` primarily uses the custom hybrid BM25 plus dense retriever. Some documentation appears stale, including README statements that still describe interview references as in-memory.

Computer-vision coaching has natural accuracy caveats. Lighting, camera quality, occlusion, model bias, and cultural differences in expression can affect predictions. The app mitigates this with local-only mode, privacy notice, cropped frames, and graceful degradation, but it should not claim emotion certainty.

There are deployment consistency issues to clean up before judging. The root backend Dockerfile uses Python 3.11 while the Spaces mirror uses Python 3.12, and the mirror appears to lag some backend RAG improvements such as tunable alpha usage. Supabase was mentioned in the project context, but no Supabase implementation was found in the inspected code; Firebase/Firestore is the actual implemented persistence layer.

# 11. Future Scope

1. Add a small retrieval evaluation dataset with known good source IDs for common student questions, then report Recall@K, MRR, and citation-grounding failures in CI.
2. Decide the final ChromaDB role: either wire it into the documented retrieval fallback chain or remove it from product claims and keep it as an optional dependency only.
3. Move interview references and anti-repeat question history from local JSON into durable cloud storage so HF Spaces redeployments do not risk losing session context.
4. Add Vitest unit tests for expression normalization, ensemble merging, and mocked `/face-expression` response handling, plus backend tests for RAG filtering and debug output.
5. Improve the computer-vision coaching roadmap with device/lighting calibration, clearer confidence thresholds, privacy-first local-only defaults where needed, and explicit wording that expression feedback is supportive coaching, not definitive emotion detection.
