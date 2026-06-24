/**
 * hfClient.js
 * ---------------------------------------------------------------
 * Browser-side Hugging Face Inference API client.
 *
 * Pure fetch() — runs entirely in the React bundle. NO backend hop,
 * NO Node imports, NO model loaded locally. Every AI call in the
 * Mock Interview module (and the other migrated pages) goes through
 * this one function.
 *
 * Pattern:
 *   Browser  --fetch-->  api-inference.huggingface.co  --json-->  Browser
 *
 * Token: VITE_HF_API_TOKEN (public, baked into the client bundle).
 *
 * Features:
 *  - 503 cold-start retry (3x exponential backoff up to 20 s)
 *  - Typed HFError on terminal failure
 *  - In-memory concurrency gate (max 2 in-flight requests) to keep
 *    free-tier HF rate limits happy
 */

const HF_ENDPOINT = 'https://api-inference.huggingface.co/models';
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 3;
const COLD_START_DELAY_MS = 20000;

/** Tiny FIFO queue limiting concurrent HF requests. */
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
  // import.meta.env is replaced at build time by Vite.
  const token = import.meta.env.VITE_HF_API_TOKEN;
  if (!token) {
    console.warn(
      '[hfClient] VITE_HF_API_TOKEN is missing — public HF inference will rate-limit aggressively. Add it to frontend/.env.'
    );
  }
  return token || '';
}

/**
 * Call a Hugging Face Inference endpoint directly from the browser.
 *
 * @param {string} model     - HF model id, e.g. "mistralai/Mistral-7B-Instruct-v0.3"
 * @param {*}      payload   - JSON body, OR a Blob/ArrayBuffer for image models
 * @param {('text-generation'|'feature-extraction'|'image-classification'|'text-classification')} taskType
 * @returns {Promise<any>}
 */
export async function hfInference(model, payload, taskType) {
  const token = _getToken();
  const url = `${HF_ENDPOINT}/${model}`;
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

      // 503 → model is cold-loading. Wait then retry.
      if (resp.status === 503) {
        await _sleep(Math.min(COLD_START_DELAY_MS, 5000 * Math.pow(2, attempt)));
        continue;
      }
      if (resp.status === 429) {
        // rate-limited — back off and retry
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
