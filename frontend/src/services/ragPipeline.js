/**
 * ragPipeline.js
 * ---------------------------------------------------------------
 * In-browser Retrieval-Augmented Generation pipeline.
 *
 *  chunk  ->  embed (HF) ->  BM25 + cosine merge (RRF)
 *         ->  rerank (HF cross-encoder) ->  inject context
 *
 * Everything runs in the React bundle. The ONLY outbound calls are
 * to api-inference.huggingface.co via hfClient.hfInference.
 *
 * Public surface:
 *   indexChunks(items)            -> embed + cache an array of chunks
 *   indexProfile(profileObj)      -> chunk + embed user profile sections
 *   retrieve(query, opts)         -> top-N chunks with RRF + rerank
 *   buildContextPrompt(retrieved, question)
 *   clearIndex()                  -> wipe in-memory state
 */

import { hfInference } from './hfClient';

// ---------- model ids ----------------------------------------------------
const EMBED_MODEL  = 'sentence-transformers/all-MiniLM-L6-v2';
const RERANK_MODEL = 'cross-encoder/ms-marco-MiniLM-L-6-v2';

// ---------- chunking parameters -----------------------------------------
const CHUNK_TOKENS = 512;   // approximated as words
const CHUNK_OVERLAP = 64;

// ---------- in-memory store ---------------------------------------------
/** chunkId -> { id, source, section, text } */
const _chunks = new Map();
/** chunkId -> Float32Array (384-dim) */
const _vectors = new Map();

let _profileChunkIds = new Set();

// ---------- BM25 state (lazy) -------------------------------------------
let _bm25 = null;

// =======================================================================
// 1. CHUNKING
// =======================================================================
const SENTENCE_RE = /(?<=[.!?])\s+(?=[A-Z0-9"'])|\n+/g;

export function chunkText(text, { source = 'general', section = '', idPrefix = '' } = {}) {
  if (!text || typeof text !== 'string') return [];
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const sentences = cleaned.split(SENTENCE_RE).map((s) => s.trim()).filter(Boolean);

  const chunks = [];
  let buffer = [];
  let bufferWords = 0;
  let chunkIndex = 0;

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.join(' ').trim();
    if (!text) return;
    chunks.push({
      id: `${idPrefix || source}#${section || 'main'}#${chunkIndex++}`,
      source,
      section,
      text,
    });
  };

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    if (bufferWords + words.length > CHUNK_TOKENS && bufferWords > 0) {
      flush();
      // build overlap tail
      const joined = buffer.join(' ').split(/\s+/);
      const tail = joined.slice(Math.max(0, joined.length - CHUNK_OVERLAP));
      buffer = [tail.join(' ')];
      bufferWords = tail.length;
    }
    buffer.push(sentence);
    bufferWords += words.length;
  }
  flush();
  return chunks;
}

// =======================================================================
// 2. EMBEDDING (HF — frontend direct)
// =======================================================================
async function embedTexts(texts) {
  if (!texts.length) return [];
  const out = await hfInference(
    EMBED_MODEL,
    { inputs: texts, options: { wait_for_model: true } },
    'feature-extraction'
  );
  // HF returns float[][] for batched inputs.
  // For a single input it sometimes returns float[]. Normalize.
  const arrays = Array.isArray(out[0]) ? out : [out];
  return arrays.map((vec) => new Float32Array(vec));
}

// =======================================================================
// 3. INDEX
// =======================================================================
export async function indexChunks(items) {
  // items: [{ id, source, section, text }, ...]
  const fresh = items.filter((c) => !_vectors.has(c.id));
  if (!fresh.length) return;

  // batch in groups of 32 to keep payload small
  for (let i = 0; i < fresh.length; i += 32) {
    const batch = fresh.slice(i, i + 32);
    const vectors = await embedTexts(batch.map((c) => c.text));
    batch.forEach((c, j) => {
      _chunks.set(c.id, c);
      _vectors.set(c.id, vectors[j]);
    });
  }
  _bm25 = null; // invalidate sparse index
}

export async function indexProfile(profile) {
  if (!profile) return;
  // drop old profile chunks first
  for (const id of _profileChunkIds) {
    _chunks.delete(id);
    _vectors.delete(id);
  }
  _profileChunkIds = new Set();
  _bm25 = null;

  const sections = _profileSections(profile);
  const all = [];
  for (const { section, text } of sections) {
    const chunks = chunkText(text, { source: 'profile', section, idPrefix: 'profile' });
    all.push(...chunks);
  }
  if (!all.length) return;
  await indexChunks(all);
  all.forEach((c) => _profileChunkIds.add(c.id));
}

function _profileSections(p) {
  const out = [];
  const push = (section, value) => {
    if (!value) return;
    const text = Array.isArray(value)
      ? value.filter(Boolean).join('. ')
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
    if (text.trim()) out.push({ section, text });
  };

  push('skills', p.skills);
  push('toolsTechnologies', p.toolsTechnologies);
  push('experienceLevel', p.experienceLevel);
  push('experience', p.experience || p.workExperience);
  push('education', p.education);
  push('projects', p.projects);
  push('rolesAndDomains', p.rolesAndDomains);
  push('preferredTrack', p.preferredTrack);
  push('bio', p.bio || p.about || p.summary);
  return out;
}

export function clearIndex() {
  _chunks.clear();
  _vectors.clear();
  _profileChunkIds = new Set();
  _bm25 = null;
}

export function indexSize() {
  return _chunks.size;
}

// =======================================================================
// 4. DENSE RETRIEVAL — cosine similarity
// =======================================================================
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function denseSearch(query, k = 20) {
  if (_vectors.size === 0) return [];
  const [qVec] = await embedTexts([query]);
  const scored = [];
  for (const [id, vec] of _vectors.entries()) {
    scored.push({ id, score: cosineSim(qVec, vec) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// =======================================================================
// 5. SPARSE RETRIEVAL — minimal inline BM25
// =======================================================================
function _buildBm25() {
  const docs = [];
  const df = new Map();
  for (const [id, chunk] of _chunks.entries()) {
    const tokens = _tokenize(chunk.text);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    docs.push({ id, tf, len: tokens.length });
  }
  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(N, 1);
  const idf = new Map();
  for (const [term, n] of df.entries()) {
    idf.set(term, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  }
  return { docs, idf, avgLen };
}

function _tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s+#./-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function sparseSearch(query, k = 20) {
  if (!_bm25) _bm25 = _buildBm25();
  const { docs, idf, avgLen } = _bm25;
  if (!docs.length) return [];
  const k1 = 1.5, b = 0.75;
  const qTokens = _tokenize(query);

  const scored = docs.map((doc) => {
    let score = 0;
    for (const term of qTokens) {
      const tf = doc.tf.get(term);
      if (!tf) continue;
      const termIdf = idf.get(term) || 0;
      const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * (doc.len / avgLen)));
      score += termIdf * norm;
    }
    return { id: doc.id, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// =======================================================================
// 6. HYBRID MERGE — Reciprocal Rank Fusion
// =======================================================================
function rrfMerge(dense, sparse, k = 60) {
  const acc = new Map();
  dense.forEach(({ id }, rank)  => acc.set(id, (acc.get(id) || 0) + 1 / (k + rank + 1)));
  sparse.forEach(({ id }, rank) => acc.set(id, (acc.get(id) || 0) + 1 / (k + rank + 1)));
  return Array.from(acc.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

// =======================================================================
// 7. RERANK (HF cross-encoder)
// =======================================================================
async function rerank(query, candidates, topN = 5) {
  if (!candidates.length) return [];
  try {
    const inputs = candidates.map((c) => ({
      text: query,
      text_pair: _chunks.get(c.id)?.text || '',
    }));
    const scores = await hfInference(
      RERANK_MODEL,
      { inputs, options: { wait_for_model: true } },
      'text-classification'
    );
    // Response is [{ label, score }] or [[{ label, score }]] per input.
    const flat = scores.map((s) => (Array.isArray(s) ? s[0]?.score ?? 0 : s?.score ?? 0));
    return candidates
      .map((c, i) => ({ ...c, rerankScore: flat[i] ?? 0 }))
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topN);
  } catch (err) {
    console.warn('[ragPipeline] rerank failed, falling back to RRF order:', err.message);
    return candidates.slice(0, topN);
  }
}

// =======================================================================
// 8. PUBLIC retrieve()
// =======================================================================
export async function retrieve(query, { topN = 5 } = {}) {
  if (!query || _chunks.size === 0) return [];
  const [dense, sparse] = await Promise.all([
    denseSearch(query, 20),
    Promise.resolve(sparseSearch(query, 20)),
  ]);
  const merged = rrfMerge(dense, sparse).slice(0, 20);
  const top = await rerank(query, merged, topN);

  // Force-include the best profile chunk so candidate context always
  // reaches the LLM, even when the question is generic.
  if (_profileChunkIds.size) {
    const alreadyHasProfile = top.some((c) => _profileChunkIds.has(c.id));
    if (!alreadyHasProfile) {
      const bestProfile = merged.find((c) => _profileChunkIds.has(c.id))
        || Array.from(_profileChunkIds).map((id) => ({ id, score: 0 }))[0];
      if (bestProfile) top.push({ ...bestProfile, forcedProfile: true });
    }
  }

  return top.map((c) => ({
    id: c.id,
    chunk: _chunks.get(c.id),
    score: c.rerankScore ?? c.score ?? 0,
    forcedProfile: !!c.forcedProfile,
  }));
}

// =======================================================================
// 9. CONTEXT INJECTION
// =======================================================================
const MAX_PROMPT_TOKENS = 2048;

export function buildContextPrompt(retrieved, question) {
  const profile = retrieved.filter((r) => r.chunk?.source === 'profile');
  const general = retrieved.filter((r) => r.chunk?.source !== 'profile');

  // Token budget: trim oldest general chunks first, preserve all profile chunks.
  const lines = [];
  let words = _wordCount(question);

  const acceptable = (text) => {
    const w = _wordCount(text);
    if (words + w > MAX_PROMPT_TOKENS) return false;
    words += w;
    return true;
  };

  for (const r of profile) {
    const label = `[Profile · ${r.chunk.section}]`;
    lines.push(`${label}\n${r.chunk.text}`);
    words += _wordCount(r.chunk.text);
  }
  for (const r of general) {
    const label = `[${r.chunk.source}${r.chunk.section ? ' · ' + r.chunk.section : ''}]`;
    const block = `${label}\n${r.chunk.text}`;
    if (!acceptable(block)) break;
    lines.push(block);
  }

  const context = lines.join('\n\n') || '(no candidate context available)';
  return `Use the following candidate context to personalize your response:\n\n${context}\n\n---\n\n${question}`;
}

function _wordCount(s) {
  return (s || '').split(/\s+/).filter(Boolean).length;
}
