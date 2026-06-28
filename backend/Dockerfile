# syntax=docker/dockerfile:1.7

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/home/appuser \
    PATH=/home/appuser/.local/bin:$PATH \
    PORT=7860 \
    HF_HOME=/home/appuser/.cache/huggingface \
    TRANSFORMERS_CACHE=/home/appuser/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/home/appuser/.cache/huggingface \
    ENABLE_LLM_GENERATOR=false \
    USE_LOCAL_EMBEDDINGS=false \
    ENABLE_RERANKER=false

WORKDIR /app

RUN useradd --create-home --uid 1000 --shell /bin/bash appuser

# Build deps (gcc for native wheels) + curl for HEALTHCHECK
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only torch FIRST so the later `pip install -r requirements.txt`
# treats torch as already-satisfied and does NOT pull the ~5 GB CUDA wheels.
# This single change cuts the image from ~7 GB to ~2 GB and is mandatory
# for HF Spaces CPU Basic.
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.12.1

COPY --chown=appuser:appuser requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# App source
COPY --chown=appuser:appuser data/ /app/data/
COPY --chown=appuser:appuser main.py /app/main.py

# Run as non-root for safer container surface
RUN mkdir -p /home/appuser/.cache/huggingface \
    && chown -R appuser:appuser /home/appuser
USER appuser

EXPOSE 7860

# Liveness probe against FastAPI root endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:7860/ || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
