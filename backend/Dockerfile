# syntax=docker/dockerfile:1.7

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=7860 \
    HF_HOME=/home/appuser/.cache/huggingface \
    TRANSFORMERS_CACHE=/home/appuser/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/home/appuser/.cache/huggingface \
    ENABLE_LLM_GENERATOR=false

WORKDIR /app

# Build deps (gcc for native wheels) + curl for HEALTHCHECK
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only torch FIRST so the later `pip install -r requirements.txt`
# treats torch as already-satisfied and does NOT pull the ~5 GB CUDA wheels.
# This single change cuts the image from ~7 GB to ~2 GB and is mandatory
# for HF Spaces CPU Basic.
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch

COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# App source
COPY data/ /app/data/
COPY main.py /app/main.py

# Run as non-root for safer container surface
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /home/appuser/.cache/huggingface \
    && chown -R appuser:appuser /app /home/appuser
USER appuser

# Bake the sentence-transformers model AND the cross-encoder reranker into
# the image so neither the first /chat request nor the startup_event need
# to hit the HF Hub at runtime.
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; SentenceTransformer('all-mpnet-base-v2'); CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512)"

EXPOSE 7860

# Liveness probe against FastAPI root endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:7860/ || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
