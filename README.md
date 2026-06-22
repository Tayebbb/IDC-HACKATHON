# CareerPath - AI-Powered Career Development Platform

CareerPath is a full-stack career development platform for students and fresh graduates. It combines React, FastAPI, Firebase, and Gemini AI to help users explore jobs, analyze skill gaps, build career roadmaps, upload CVs, and prepare for interviews.

This is the single README for the entire project, covering both the frontend and backend.

## What the platform does

CareerPath helps users:

- discover jobs and compare match scores
- identify missing skills for a target role
- find learning resources to close skill gaps
- generate AI-powered career roadmaps
- chat with an AI career assistant
- upload a CV and extract structured career data
- practice interviews with generated questions and answer evaluation
- track profile progress, applications, and learning activity

## Features

### User-facing features

- Authentication with email/password and Google sign-in
- Profile management with skills, tools, experience level, career track, and location
- Dashboard with profile completion and career progress
- Job browsing with match scoring and job detail pages
- Learning resources catalog with filtering and recommendations
- Skill gap analysis for job and learning planning
- Career roadmap generation powered by Gemini
- AI career chat assistant
- CV upload and analysis from PDF files
- Mock interview practice with question generation and answer feedback
- Job market insights page
- Contact and community pages
- Password reset and sign-in / sign-up flows

### Admin features

- Admin login
- Admin dashboard
- Job management
- Course management
- User monitoring and application tracking

### Backend features

- FastAPI REST API
- CORS support for frontend integration
- Gemini AI integration
- PDF text extraction for CV analysis
- Interview question generation
- Interview answer evaluation with structured scoring
- Health endpoint for service checks

## Tech Stack

### Frontend

- React 18
- Vite
- React Router
- Firebase Authentication and Firestore
- Framer Motion
- React Hot Toast
- Lucide React icons
- Chart.js and React Chart.js 2
- React PDF / PDF.js

### Backend

- Python
- FastAPI
- Uvicorn
- Google Generative AI SDK
- PyPDF2
- python-dotenv

## Project Structure

```text
e:\IDC HACKATHON
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── firebase.js
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── main.py
│   └── requirements.txt
├── README.md
└── .gitignore
```

## Frontend Pages

The React app includes these pages:

- Home
- Jobs
- JobDetails
- Resources
- LearningResources
- Contact
- Login
- Register
- Signup
- ForgotPassword
- Profile
- Dashboard
- Chatassistance
- CareerRoadmap
- CvUpload
- MockInterview
- JobMarketInsights
- Community
- AdminLogin
- AdminDashboard
- AdminPanel
- AdminCourses

## Backend API

The FastAPI backend exposes these routes:

- `GET /` - service health message
- `POST /chat` - AI chat assistant
- `POST /summarize-cv` - upload a PDF CV and extract structured data
- `POST /generate-interview-question` - generate a new interview question
- `POST /evaluate-interview-answer` - score and review an interview answer

An automatic OpenAPI docs page is also available at `/docs`.

## Setup

### 1) Frontend

```bash
cd frontend
npm install
npm run dev
```

Available scripts:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

### 2) Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Environment Variables

Create a backend `.env` file inside `backend/` with your Gemini key:

```env
GEMINI_API_KEY=your_gemini_api_key
```

If the frontend uses Firebase and/or Gemini-related values, store them in a frontend `.env` file. Keep real secrets out of version control.

## Notes

- The backend currently uses permissive CORS so the frontend can call it during development.
- CV upload expects PDF files.
- The interview endpoints return structured responses designed for the frontend UI.
- The app is intended to run with the frontend and backend as separate processes.

## Running the Full App

Open two terminals:

1. Start the backend from `backend/`
2. Start the frontend from `frontend/`

Then use the frontend to access the CareerPath experience and connect it to the FastAPI API.
