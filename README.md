# Full-Stack Starter: React Frontend + Python Backend

## Project Structure

- `frontend/` - React app (Vite)
- `backend/` - FastAPI backend

## Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on the URL shown in terminal (typically http://localhost:5173).

## Backend Setup (Python + FastAPI)

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check endpoint:

- http://127.0.0.1:8000/health

## Run Both Together

Open two terminals:

1. Run frontend dev server from `frontend/`
2. Run backend server from `backend/`
