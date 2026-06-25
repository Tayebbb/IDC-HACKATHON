/**
 * hfClient.js
 * ---------------------------------------------------------------
 * Browser-side Hugging Face Inference client.
 *
 * Pure fetch() — runs entirely in the React bundle. NO backend hop,
 * NO Node imports, NO local model loaded. Every AI call in the
 * Mock Interview / chat / roadmap / CV modules goes through this
 * one function.
 *
 * Endpoints (HF 2025 unified router):
 *   chat-completions    → POST /v1/chat/completions          (OpenAI-compatible)
 *   feature-extraction  → POST /hf-inference/models/{m}/pipeline/feature-extraction
 *   text-classification → POST /hf-inference/models/{m}      (reranker pair scoring)
 *   image-classification→ POST /hf-inference/models/{m}      (raw image bytes)
 *
 * Token: VITE_HF_API_TOKEN (fine-grained token with the "Inference
 * Providers" permission enabled — pasted into frontend/.env).
 */

const ROUTER = 'https://router.huggingface.co';
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 3;
const COLD_START_DELAY_MS = 20000;

// ---------- concurrency gate -------------------------------------------
let _inFlight = 0;
const _pending = [];
function _acquire() {
  if (_inFlight < MAX_CONCURRENT) {
    _inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => _pending.push(resolve));
}
function _release() {
  _inFlight--;
  const next = _pending.shift();
  if (next) {
    _inFlight++;
    next();
  }
}

export class HFError extends Error {
  constructor({ status, model, message }) {
    super(`[HF ${status}] ${model}: ${message}`);
    this.name = 'HFError';
    this.status = status;
    this.model = model;
  }
}

function _getToken() {
  const token = import.meta.env.VITE_HF_API_TOKEN;
  if (!token) {
    console.warn(
      '[hfClient] VITE_HF_API_TOKEN is missing — inference will return 401. Add a fine-grained token to frontend/.env.'
    );
  }
  return token || '';
}

function _endpointFor(model, taskType) {
  if (taskType === 'chat-completions') return `${ROUTER}/v1/chat/completions`;
  if (taskType === 'feature-extraction')
    return `${ROUTER}/hf-inference/models/${model}/pipeline/feature-extraction`;
  return `${ROUTER}/hf-inference/models/${model}`;
}

/**
 * Call a Hugging Face Inference endpoint directly from the browser.
 *
 * @param {string} model     - HF model id (ignored for chat-completions; pass id in payload.model).
 * @param {*}      payload   - JSON body, OR a Blob/ArrayBuffer for image models.
 * @param {('chat-completions'|'text-generation'|'feature-extraction'|'image-classification'|'text-classification')} taskType
 * @returns {Promise<any>}
 */
export async function hfInference(model, payload, taskType) {
  const token = _getToken();
  // Legacy alias: callers using 'text-generation' get auto-routed to chat-completions.
  if (taskType === 'text-generation') taskType = 'chat-completions';
  const url = _endpointFor(model, taskType);
  const isBinary = payload instanceof Blob || payload instanceof ArrayBuffer;

  const headers = {
    Accept: 'application/json',
    'X-Wait-For-Model': 'true',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isBinary) headers['Content-Type'] = 'application/json';
  else if (taskType === 'image-classification') headers['Content-Type'] = 'image/jpeg';

  const body = isBinary ? payload : JSON.stringify(payload);

  await _acquire();
  try {
    let lastError = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let resp;
      try {
        resp = await fetch(url, { method: 'POST', headers, body });
      } catch (netErr) {
        lastError = netErr;
        await _sleep(1000 * Math.pow(2, attempt));
        continue;
      }

      if (resp.status === 503) {
        await _sleep(Math.min(COLD_START_DELAY_MS, 5000 * Math.pow(2, attempt)));
        continue;
      }
      if (resp.status === 429) {
        await _sleep(2000 * Math.pow(2, attempt));
        continue;
      }
      if (!resp.ok) {
        let text = '';
        try { text = await resp.text(); } catch { /* ignore */ }
        throw new HFError({ status: resp.status, model, message: text || resp.statusText });
      }
      return await resp.json();
    }
    throw new HFError({
      status: 503,
      model,
      message: lastError ? `network: ${lastError.message}` : 'model cold-start exceeded retries',
    });
  } finally {
    _release();
  }
}

function _sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
