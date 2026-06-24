# CareerPath — Project Context Brief

> **Purpose of this document:** This README is written as a complete context dump that you can paste into any LLM (Claude, GPT, etc.) so it understands the project before answering questions or making changes. It is intentionally verbose, opinionated, and exhaustive.

---

## 1. One-paragraph summary

CareerPath is a full-stack AI career platform for students and fresh graduates. The stack is **React 18 + Vite** on the frontend, **FastAPI (Python 3.12)** on the backend, and **Firebase Auth + Firestore** for identity and persistence. As of June 2026 the entire AI inference layer runs **directly in the browser against the Hugging Face Inference API** — `mistralai/Mistral-7B-Instruct-v0.3` for text generation, `sentence-transformers/all-MiniLM-L6-v2` for embeddings, `cross-encoder/ms-marco-MiniLM-L-6-v2` for reranking, and `trpakov/vit-face-expression` for facial-expression analysis. The backend no longer proxies any AI request; it serves only static-data routes (`/career-dna`, `/readiness-score`, `/explain-match`, `/career-advice`, `/skill-roadmap`) and the PDF text-extraction route `/summarize-cv`. The product's defining feature is a unified **Explainability Layer**: every visible AI output — readiness score, job match, skill gap, chat reply, interview evaluation, simulated what-if score — is wrapped in a common `ExplainabilityEnvelope` and rendered through a single `ReasoningCard` component.

---

## 2. Repository layout

```text
IDC HACKATHON/
├── frontend/                          # React + Vite app
│   ├── src/
│   │   ├── App.jsx                    # routes + layout shell
│   │   ├── main.jsx                   # Vite entry point
│   │   ├── firebase.js                # Firebase init (Auth + Firestore)
│   │   ├── index.css                  # Tailwind directives + global classes
│   │   ├── assets/
│   │   │   └── credential/            # Logos bundled for the PDF certificate
│   │   │       ├── aust-idc.png
│   │   │       ├── codefront.png
│   │   │       └── mindsparks.png
│   │   ├── contexts/                  # AuthContext
│   │   ├── constants/                 # static lookups (job roles etc.)
│   │   ├── data/                      # static seed data shipped with the UI
│   │   ├── services/                  # Firestore helpers
│   │   ├── utils/
│   │   │   ├── explainability.js      # KEY: envelope contract (client side)
│   │   │   ├── matchScore.js          # job-match scoring (60/20/20)
│   │   │   └── getLearningSuggestions.js
│   │   ├── components/
│   │   │   ├── ReasoningCard.jsx          # Feature 1 — the ONLY explainability renderer
│   │   │   ├── IntelligenceSection.jsx    # Features 2 + 3 mounted on Dashboard
│   │   │   ├── JobCard.jsx                # Feature 4 wrapper
│   │   │   ├── SkillGapCard.jsx           # Feature 4 wrapper
│   │   │   ├── WhatIfSimulator.jsx        # Feature 7
│   │   │   ├── MindsparksCredential.jsx   # Feature 8 (badge + PDF cert)
│   │   │   ├── Navbar.jsx                 # Nav incl. "Knowledge Graph" entry
│   │   │   └── (Footer, ProtectedRoute, AdminProtectedRoute, FloatingAIButton,
│   │   │       ProfileSetup, LearningSuggestionCard, NotificationButton,
│   │   │       AdminLayout, AnalyticsModal, ProfilePDFDocument, ProfilePDFDownload)
│   │   └── pages/
│   │       ├── Home.jsx, About.jsx, Contact.jsx, Community.jsx
│   │       ├── Login.jsx, Register.jsx, Signup.jsx, ForgotPassword.jsx
│   │       ├── Profile.jsx
│   │       ├── Dashboard.jsx              # mounts IntelligenceSection
│   │       ├── Jobs.jsx, JobDetails.jsx
│   │       ├── Resources.jsx, LearningResources.jsx
│   │       ├── Chatassistance.jsx         # uses ReasoningCard for /chat replies
│   │       ├── CareerRoadmap.jsx          # mounts WhatIfSimulator (Feature 7)
│   │       ├── CvUpload.jsx
│   │       ├── MockInterview.jsx          # Feature 6 (Voice Coach)
│   │       ├── JobMarketInsights.jsx
│   │       ├── KnowledgeGraph.jsx         # Feature 9 (@xyflow/react)
│   │       └── AdminLogin.jsx, AdminDashboard.jsx, AdminPanel.jsx, AdminCourses.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/                           # FastAPI app
│   ├── main.py                        # ALL routes + envelope helpers + RAG
│   ├── requirements.txt
│   ├── vercel.json                    # serverless deploy config (optional)
│   ├── scripts/
│   │   └── build_embeddings.py        # offline RAG embedding builder
│   ├── data/
│   │   ├── seed_corpus.json           # 32 jobs + 25 courses (Feature 5)
│   │   └── corpus_embeddings.json     # generated; optional
│   ├── .env                           # (empty in dev; FRONTEND_URL optional)
│   ├── .env.example
│   └── .venv/                         # local Python venv
├── Code Front/                        # raw logo source files for branding
│   ├── AUST IDC - White.png
│   ├── AUST IDC - Black.png
│   ├── Code front.png
│   └── Mindsparks 26 Logo.png
└── README.md                          # this file
```

---

## 3. Dependencies (locked)

### Frontend (`frontend/package.json`)

```jsonc
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.8.1",
  "vite": "^5.4.11",
  "tailwindcss": "^3.4.14",
  "firebase": "^12.6.0",
  "framer-motion": "^10.16.16",
  "chart.js": "^4.5.1",
  "react-chartjs-2": "^5.3.1",
  "@xyflow/react": "^12.11.1", // Knowledge Graph (Feature 9)
  "jspdf": "^4.2.1", // Certificate PDF (Feature 8)
  "react-pdf": "^10.2.0",
  "@react-pdf/renderer": "^4.3.1",
  "pdfjs-dist": "^5.4.394",
  "react-markdown": "^10.1.0",
  "react-hot-toast": "^2.4.1",
  "lucide-react": "^0.263.1",
  "gsap": "^3.13.0",
}
```

### Backend (`backend/requirements.txt`)

```text
fastapi
uvicorn[standard]
python-dotenv
google-genai
pydantic>=2.0.0
PyPDF2
python-multipart
```

> **No numpy.** RAG cosine similarity is pure-Python by design.

---

## 4. Theme & design tokens

Tailwind config + utility classes used everywhere. **Do not deviate from these names.**

| Token           | Value     | Usage                   |
| --------------- | --------- | ----------------------- |
| `bg-base`       | `#0B0E1C` | page background         |
| `bg-section`    | `#11152B` | card / panel background |
| `primary`       | `#A855F7` | main neon purple        |
| `primary-light` | `#C084FC` | hover / accent          |
| `accent-pink`   | `#D500F9` | gradient end stop       |
| `text-main`     | `#FFFFFF` | body text               |
| `text-muted`    | `#B3B3C7` | secondary text          |

Reusable classes defined in `index.css`: `neon-card`, `neon-border`, `glow-text`, `glow-icon`, `btn-primary`, `btn-outline-neon`, `input-field`. Font: **Poppins**.

---

## 5. The Explainability Layer

### 5.1 The envelope contract (frozen)

Source of truth: `frontend/src/utils/explainability.js` and the helpers in `backend/main.py` (`_build_envelope`, `_derive_confidence`).

```ts
type SignalType =
  | "rag_source" // doc retrieved from the seed corpus
  | "skill_match" // matched/missing skill
  | "weight_component" // a weighted sub-score component
  | "profile_field" // raw profile attribute (weakest signal)
  | "interview_metric"; // WPM / fillers / pause / answer score

type Factor = {
  label: string; // human-readable, ends with "(signal_type)"
  positive: boolean; // check vs cross in the UI
  signal_type: SignalType;
  value?: number | string;
};

type ExplainabilityEnvelope = {
  output: any; // the score/text/value being explained
  factors: Factor[];
  confidence: "High" | "Medium" | "Low";
  basis: string; // short derivation summary
  signal_types_used: SignalType[];
};
```

### 5.2 Confidence rules (identical on FE and BE)

- **High** — `factors.length >= 3` AND at least one `rag_source` or `skill_match` AND no fallback was used.
- **Medium** — 1–2 factors, OR fallback was used, OR only `weight_component` signals.
- **Low** — 0 factors, OR only `profile_field` signals, OR keyword-only fallback.

### 5.3 Rendering rule

The **only** component that may render explanations is `ReasoningCard`. If `factors` is empty or missing, it renders **nothing** (no empty card shell). This is intentional — graceful degradation is the default.

---

## 6. Feature map (1–9)

| #   | Name                           | Frontend home                                                   | Backend route                              |
| --- | ------------------------------ | --------------------------------------------------------------- | ------------------------------------------ |
| 1   | ReasoningCard                  | `components/ReasoningCard.jsx`                                  | —                                          |
| 2   | Career DNA radar               | `IntelligenceSection.jsx` → mounted in `Dashboard.jsx`          | `POST /career-dna`                         |
| 3   | Readiness Score                | `IntelligenceSection.jsx`                                       | `POST /readiness-score`                    |
| 4   | Skill-gap + Job-match wrappers | `SkillGapCard.jsx`, `JobCard.jsx`, `Jobs.jsx`                   | `POST /explain-match`                      |
| 5   | Career chat (HF + browser RAG) | `Chatassistance.jsx` → `services/interviewAI.careerChat`        | none (browser calls HF directly)           |
| 6   | Mock Interview (HF + RAG)      | `MockInterview.jsx` + `FaceExpressionOverlay.jsx`               | none (browser calls HF directly)           |
| 7   | What-If Career Simulator       | `WhatIfSimulator.jsx` mounted in `CareerRoadmap.jsx`            | none (pure client)                         |
| 8   | Mindsparks Badge + Certificate | `MindsparksCredential.jsx` mounted in `IntelligenceSection.jsx` | none (jsPDF client)                        |
| 9   | Knowledge Graph                | `pages/KnowledgeGraph.jsx` (`@xyflow/react`)                    | none (uses existing data)                  |

---

## 7. Backend API surface

Base URL in dev: `http://127.0.0.1:8000`. OpenAPI at `/docs` and `/redoc`.

The backend no longer performs any AI inference — all LLM / embedding / vision
calls happen in the browser against the Hugging Face Inference API. The
remaining backend routes serve static data and a PDF text extractor.

| Method | Path                  | Purpose                                                                 |
| ------ | --------------------- | ----------------------------------------------------------------------- |
| `GET`  | `/`                   | Health check returning `{ "message": "CareerPath RAG Chatbot API is running" }` |
| `GET`  | `/health/dependencies`| Static data readiness check (seed_corpus presence)                       |
| `POST` | `/summarize-cv`       | Multipart PDF upload → raw text + keyword-extracted CV JSON (no LLM)     |
| `POST` | `/career-dna`         | Score the user across 5 DNA categories (envelope)                        |
| `POST` | `/readiness-score`    | Composite readiness score (envelope)                                     |
| `POST` | `/explain-match`      | Per-job match breakdown (envelope)                                       |
| `GET`  | `/career-advice`      | Search the static career-advice JSON                                     |
| `POST` | `/career-advice`      | Same as GET, body form (legacy)                                          |
| `GET`  | `/skill-roadmap`      | Search the static roadmaps JSON                                          |
| `POST` | `/skill-roadmap`      | Same as GET, body form (legacy)                                          |

### Routes removed in the June 2026 overhaul

- `POST /chat` — chat replies now come from `frontend/src/services/interviewAI.careerChat` (HF Mistral + in-browser RAG).
- `POST /generate-interview-question` and `POST /evaluate-interview-answer` — replaced by browser-side calls in `MockInterview.jsx`.
- `POST /analyze-expression` — webcam frames now POST directly to `trpakov/vit-face-expression` on HF from `FaceExpressionOverlay.jsx`.

### New explainability routes

- `POST /career-dna`
  - Body: `{ skills: string[] }` (also accepts `keySkills` / `toolsTechnologies`)
  - Returns `ExplainabilityEnvelope` where `output` = the 5-category score map; also has top-level `scores: { Frontend, Backend, "DevOps", "AI/ML", Communication }`.
- `POST /readiness-score`
  - Body: `{ skills, dnaScores, profileCompletion, interviewScore }`
  - Returns `ExplainabilityEnvelope` with `score: number` and three weighted factors.
- `POST /explain-match`
  - Body: a job-match result `{ matchedSkills, missingSkills, breakdown: { skillScore, expScore, trackScore } }`
  - Returns `ExplainabilityEnvelope` with `skill_match` + `weight_component` factors.

---

## 8. Scoring formulas (canonical)

### Career DNA (per category)

```
score = min(100, round(matched_skills_in_category / total_listed_skills_in_category * 100))
```

Category → skills mapping lives in `CAREER_DNA_CATEGORIES` in `backend/main.py` (Frontend / Backend / DevOps / AI/ML / Communication).

### Job match (in `frontend/src/utils/matchScore.js`)

```
total = 60 * skillScore + 20 * experienceScore + 20 * trackScore     // out of 100
skillScore       = matched / required
experienceScore  = 1.0 if exact level, 0.5 if +/- 1 level, else 0
trackScore       = 1.0 if exact track, 0.5 if similar family, else 0
```

### Career Readiness Score

```
readiness = round( 0.40 * dnaAvg + 0.30 * profileCompletion + 0.30 * interviewScore )
```

`dnaAvg` is the mean of the 5 Career DNA category scores. `interviewScore` is `null`-safe and counts as 0 if absent.

### What-If Simulator

Same readiness formula, computed client-side. Each toggled skill adds **+8** to its mapped DNA category (cap 100). Animated with Framer Motion spring (`stiffness: 120, damping: 18` → ~400 ms settle).

### Voice metrics (Feature 6)

- WPM = `words / minutes`; "good" band is **110–160 WPM**.
- Filler words matched as whole-word regex: `["um", "uh", "like", "you know", "basically", "literally"]`. Good <= 3.
- Pause time = sum of inter-result gaps > **1200 ms**. Good <= 6 s.

---

## 9. RAG pipeline (Feature 5)

### Corpus

- File: `backend/data/seed_corpus.json`
- Shape: array of `{ id, type: "job" | "course", title, skills: string[], description }`
- Size: 32 jobs + 25 courses = **57 items**.

### Embeddings

- Model: `sentence-transformers/all-MiniLM-L6-v2` via the Hugging Face Inference API, called **directly from the browser** (`frontend/src/services/ragPipeline.js`).
- Backend embedding generation is no longer used.
- Cosine similarity is implemented in pure JS in the frontend RAG service.

### Retrieval order (in `frontend/src/services/ragPipeline.js`)

1. **dense**   — HF embedding of query → in-memory cosine vs indexed chunks (top-20).
2. **sparse**  — inline BM25 (k1=1.5, b=0.75) over the same chunks (top-20).
3. **fuse**    — Reciprocal Rank Fusion (k=60) of dense + sparse → top-20.
4. **rerank**  — HF cross-encoder `ms-marco-MiniLM-L-6-v2` → top-5.
5. The single best profile chunk is force-injected so candidate context always reaches the LLM.

### Augmenting the chat / interview prompts

The retrieved chunks are prefixed to the user prompt as a labelled `[Profile · ...]` / `[general · ...]` block before being sent to `mistralai/Mistral-7B-Instruct-v0.3` via the same browser HF client.

---

## 10. Frontend routing & navigation

Defined in `frontend/src/App.jsx`. All AI features are behind `ProtectedRoute` (which checks `useAuth().currentUser`). Admin features are behind `AdminProtectedRoute`.

| Path                                                                | Page                                       | Auth                  |
| ------------------------------------------------------------------- | ------------------------------------------ | --------------------- |
| `/`                                                                 | `Home`                                     | public                |
| `/jobs`                                                             | `Jobs`                                     | protected             |
| `/jobs/:id`                                                         | `JobDetails`                               | public                |
| `/resources`                                                        | `Resources`                                | public                |
| `/learning-resources`                                               | `LearningResources`                        | protected             |
| `/contact`                                                          | `Contact`                                  | public                |
| `/login`, `/register`, `/signup`                                    | auth pages                                 | public                |
| `/profile`                                                          | `Profile`                                  | protected             |
| `/dashboard`                                                        | `Dashboard` (mounts `IntelligenceSection`) | protected             |
| `/chatassistance`                                                   | `Chatassistance`                           | protected             |
| `/cv-upload`                                                        | `CvUpload`                                 | protected             |
| `/career-roadmap`                                                   | `CareerRoadmap` (mounts `WhatIfSimulator`) | protected             |
| `/mock-interview`                                                   | `MockInterview` (Voice Coach)              | protected             |
| `/knowledge-graph`                                                  | `KnowledgeGraph`                           | protected             |
| `/job-market-insights`                                              | `JobMarketInsights`                        | public, navbar hidden |
| `/admin-login`, `/admin-dashboard`, `/admin/jobs`, `/admin/courses` | admin                                      | admin-only            |

Navbar uses a dropdown labelled **AI Tools** that contains: AI Assistance, CV Upload, Career Roadmap, Mock Interview, Knowledge Graph.

---

## 11. Firestore collections

- `users/{uid}` — user profile. Fields used by the app:
  - `name`, `email`, `skills: string[]`, `toolsTechnologies: string[]`, `experienceLevel: "beginner" | "intermediate" | "advanced"`, `preferredTrack`, `location`, plus arbitrary extras.
- `jobs/{jobId}` — job postings. Shape:
  - `title`, `company`, `track`, `experienceRequired`, `skillsRequired: string[]`, etc.
- `learningResources/{resourceId}` — courses / articles. Shape:
  - `title`, `platform`, `url`, `cost: "Free" | "Paid"`, `relatedSkills: string[]`.
- `interviewHistory/{sessionId}` — written by `MockInterview.jsx` on End Interview.
- Admin collections — managed via `AdminPanel.jsx` / `AdminCourses.jsx`.

`getLearningSuggestions(missingSkills, allResources)` (in `frontend/src/utils/getLearningSuggestions.js`) is the canonical helper used by both `Jobs.jsx` and the Knowledge Graph.

---

## 12. Key client-side contracts

### `utils/explainability.js`

```ts
ALLOWED_SIGNAL_TYPES: SignalType[]
deriveConfidence(factors, usedFallback = false): "High" | "Medium" | "Low"
formatFactorLabel(label, signalType, value = null): string
buildEnvelope(output, factors, basis, opts = {}): ExplainabilityEnvelope
```

`buildEnvelope` silently **filters out** factors whose `signal_type` isn't in `ALLOWED_SIGNAL_TYPES` so the contract cannot be violated by mistake.

### `components/ReasoningCard.jsx`

Props: `{ title, score?, factors, basis, confidence }`.

- Renders nothing if `factors` is empty.
- Each factor row shows a `Check` or `X` icon depending on `factor.positive`.
- Confidence badge uses `ShieldCheck` / `Shield` / `ShieldAlert` for High / Medium / Low.

---

## 13. Architectural rules (DO NOT VIOLATE)

1. **Additive only.** Don't refactor, rename, or "improve" code outside the immediate task.
2. **ReasoningCard is the only renderer of explanations.** Don't make ad-hoc factor lists or inline "why?" UI elsewhere.
3. **The five signal types are closed.** Adding a new one requires changing both `explainability.js` and `_derive_confidence` in `main.py` in lockstep.
4. **Frozen backend routes** keep their existing request/response shape. `/chat` may gain new response fields; nothing may be removed or renamed.
5. **Degrade gracefully.** When a fetch fails, the impacted card or page should render nothing (or a placeholder), never an error stack.
6. **No new heavy dependencies** without explicit approval. Approved adds for the Explainability Layer were: `@xyflow/react`, `jspdf`. Everything else was already present.
7. **No backend writes from Feature 7 or 9.** They are pure client recomputes over existing data.
8. **No numpy** on the backend. Pure-Python math only.

---

## 14. Environment variables

### `backend/.env`

```env
# All AI inference now runs from the browser. No backend secret is required
# for AI calls. The file may be empty in development.
FRONTEND_URL=http://localhost:5173    # optional, used by CORS allowlist
```

### `frontend/.env`

Variables follow the Vite `VITE_` prefix convention.

```env
VITE_API_URL=http://localhost:8000    # FastAPI base for the static-data routes
VITE_HF_API_TOKEN=hf_...              # Hugging Face Inference token (Read role)
# Plus the standard VITE_FIREBASE_* keys consumed by frontend/src/firebase.js
```

> The HF token is **bundled into the client**. Use a Read-only token scoped to inference only.

---

## 15. Local setup (Windows / PowerShell)

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev    # http://localhost:5173
```

Optional: build embeddings for the high-confidence RAG path.

```powershell
$env:HF_TOKEN = "<your_huggingface_token>"
cd backend
.\.venv\Scripts\python.exe scripts\build_embeddings.py
```

Validation commands:

```powershell
# Production build (catches all Vite/JSX errors)
cd frontend; npm run build

# Import-check the backend
cd backend; .\.venv\Scripts\python.exe -c "import main; print('OK')"
```

---

## 16. Verified state (last full run)

- `npm run build` → 2554 modules transformed, **0 errors**, all 3 logos bundled, `KnowledgeGraph` + `MockInterview` chunks present.
- `uvicorn main:app` → all routes registered (frozen + 3 new). Smoke-tested `GET /` and `POST /career-dna` returning correct envelopes.
- `corpus_embeddings.json` — optional; system runs without it (keyword fallback).
- Voice fallback tested: when `SpeechRecognition` is unsupported, the Record button is hidden; text input still works. When mic is denied, a single toast is shown then text input continues.

---

## 17. How to ask an LLM for help (recommended prompt structure)

When prompting an LLM with this README, also include:

1. **Goal** — what you want changed.
2. **Scope** — exact file paths the LLM is allowed to touch.
3. **Stop conditions** — situations where the LLM must ask before continuing (e.g. adding a dependency, touching a frozen route, deleting a file).
4. **Acceptance criteria** — verifiable checks the change must pass.

Example prompt:

> Read README.md for full context. Goal: add a tooltip to ReasoningCard explaining each signal_type. Scope: `frontend/src/components/ReasoningCard.jsx` only. Stop and ask before: adding a dependency, changing the envelope contract. Accept when: each factor row has a hover tooltip, all 5 signal types are documented, no other file changes.

---

## 18. Glossary

- **Envelope** — short for `ExplainabilityEnvelope`. The standard shape for any AI output.
- **Factor** — one bullet inside an envelope. Always tagged with its `signal_type`.
- **Signal type** — the _kind_ of evidence a factor is. One of 5 values, closed set.
- **Confidence** — derived strictly from factor types + count + fallback flag. Never freely chosen.
- **Retrieval path** — which source `/chat` used for grounding: `cache`, `hf`, `keyword`, or `none`.
- **Frozen route** — a backend endpoint whose request/response shape cannot change.
- **DNA category** — one of Frontend, Backend, DevOps, AI/ML, Communication.
- **Readiness score** — the 0–100 number combining DNA, profile completion, and interview score with 40/30/30 weights.
