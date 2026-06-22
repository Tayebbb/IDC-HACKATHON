# Backend (FastAPI)

## Quick Start

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Endpoint

- `GET /health` returns `{ "status": "ok" }`
