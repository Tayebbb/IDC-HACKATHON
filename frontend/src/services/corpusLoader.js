/**
 * corpusLoader.js
 * ---------------------------------------------------------------
 * Fetches the static career corpus from /corpus.json (served from
 * frontend/public/) and indexes it into the in-browser RAG store.
 * Idempotent: the index runs at most once per session.
 */

import { chunkText, indexChunks, indexSize } from './ragPipeline';

let _loadPromise = null;

export function loadCorpus() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const resp = await fetch('/corpus.json');
      if (!resp.ok) throw new Error(`corpus fetch failed: ${resp.status}`);
      const items = await resp.json();
      if (!Array.isArray(items)) throw new Error('corpus payload is not an array');

      const allChunks = [];
      items.forEach((item, idx) => {
        const text = _itemToText(item);
        const section = item.type || item.category || 'general';
        const idPrefix = `corpus-${idx}`;
        const chunks = chunkText(text, { source: 'general', section, idPrefix });
        allChunks.push(...chunks);
      });
      await indexChunks(allChunks);
      return { items: items.length, chunks: indexSize() };
    } catch (err) {
      console.warn('[corpusLoader] failed to load corpus:', err.message);
      _loadPromise = null; // allow a future retry
      throw err;
    }
  })();
  return _loadPromise;
}

function _itemToText(item) {
  if (typeof item === 'string') return item;
  // common shapes: { title, description }, { question, answer }, { name, summary, skills }
  const parts = [];
  for (const key of ['title', 'name', 'role', 'question']) {
    if (item[key]) parts.push(String(item[key]));
  }
  for (const key of ['description', 'summary', 'answer', 'content', 'body', 'detail']) {
    if (item[key]) parts.push(String(item[key]));
  }
  if (Array.isArray(item.skills) && item.skills.length) {
    parts.push('Skills: ' + item.skills.join(', '));
  }
  if (Array.isArray(item.tags) && item.tags.length) {
    parts.push('Tags: ' + item.tags.join(', '));
  }
  if (!parts.length) return JSON.stringify(item);
  return parts.join('. ');
}
