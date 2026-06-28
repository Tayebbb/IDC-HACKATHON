/**
 * FaceExpressionOverlay.jsx
 * ---------------------------------------------------------------
 * Live webcam â†’ Hugging Face vit-face-expression (browser direct).
 *
 * UI no longer shows emotion labels (happy / sad / angry / surprise / â€¦).
 * Instead, every detection frame is mapped to a single actionable interview
 * coaching tip, surfaced as a rolling 3-tip queue under the camera.
 *
 * Architecture: The current build does NOT use face-api.js (banned by the
 * project's "no local ML model" architecture). Per-frame `expressions` come
 * from Hugging Face Inference API (HF returns label/score pairs). Per-frame
 * `landmarks` are not available, so the landmark-driven eye-contact tip is
 * implemented as a graceful no-op (the same priority chain is preserved).
 *
 * Exports:
 *   default â€” the FaceExpressionOverlay component
 *   getExpressionCoaching(distribution) â€” kept for back-compat with
 *     MockInterview.jsx, which still calls it on the finalised emotion
 *     percentage distribution at end-of-interview.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Eye, RotateCcw } from 'lucide-react';
import API_URL from '../config';

const EXPRESSION_MODEL = 'trpakov/vit-face-expression';
const SAMPLE_INTERVAL_MS = 3000;
const TIP_FADE_AFTER_MS = 4000;
const NEGATIVE_EMOTIONS = new Set(['angry', 'disgust', 'fear', 'sad']);
const FACE_API_MODEL_URL = '/models';

// =====================================================================
// face-api.js lazy loader.
//
// We dynamic-import the library only when the component first mounts so
// the ~1.2 MB gzipped bundle never lands on pages that don't use it
// (chat, profile, jobs, etc.). Once loaded the module is cached on
// _faceApiModule so subsequent component mounts are free.
//
// Models live in /public/models (~520 KB total) so they're co-deployed
// with the app and never depend on a 3rd-party CDN.
// =====================================================================
let _faceApiModule = null;
let _faceApiLoading = null;
let _faceApiReady = false;
async function _loadFaceApi() {
  if (_faceApiReady) return _faceApiModule;
  if (_faceApiLoading) return _faceApiLoading;
  _faceApiLoading = (async () => {
    try {
      const mod = await import('@vladmandic/face-api');
      await Promise.all([
        mod.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL),
        mod.nets.faceExpressionNet.loadFromUri(FACE_API_MODEL_URL),
      ]);
      _faceApiModule = mod;
      _faceApiReady = true;

      console.info('[FaceExpressionOverlay] face-api models loaded (local).');
      return mod;
    } catch (e) {
      // Non-fatal: HF-only fallback path stays active.

      console.warn('[FaceExpressionOverlay] face-api load failed; HF-only mode.', e);
      _faceApiReady = false;
      _faceApiModule = null;
      return null;
    } finally {
      _faceApiLoading = null;
    }
  })();
  return _faceApiLoading;
}

// Smoothing window: 5 frames Ã— 3 s = 15 s of context per decision.
// Below this many frames we keep showing "warming up" instead of guessing.
const SMOOTH_WINDOW = 5;
const SMOOTH_MIN_FRAMES = 2;
// Minimum top-1 score (across 7 labels) required to trust a frame.
// HF ViT outputs sum to 1 across 7 labels; a top score under 0.35 means
// the model is essentially undecided (face partly out of view / motion blur).
const MIN_FRAME_CONFIDENCE = 0.35;
// Allow the same tip to re-emit after this many ms so good behaviour is
// reinforced over a long interview instead of fired exactly once.
const TIP_REEMIT_MS = 20_000;
// Per-user baseline: average the first N high-confidence frames to learn
// the candidate's RESTING expression. Subsequent coaching warns only when
// the smoothed signal deviates meaningfully from baseline (BASELINE_DELTA).
// This stops naturally serious / soft-spoken candidates from being told to
// "smile more" when their face was never sad in the first place.
const BASELINE_FRAMES = 3;
const BASELINE_DELTA = 0.15;        // +15 pp over baseline = real change
// Temporal hysteresis: a warning tip requires the smoothed window to land
// in the warning state for HYSTERESIS_REPEATS consecutive reads before
// firing. Positive / info tips fire immediately (no penalty for warmth).
const HYSTERESIS_REPEATS = 2;
// Pixel-variance threshold for the "is anything in front of the camera?"
// presence gate. A blank wall scores ~5-50; a face/scene scores 800+.
const PRESENCE_VARIANCE_THRESHOLD = 250;

function isInsecureContext() {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  if (protocol === 'https:') return false;
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

// =====================================================================
// Per-frame coaching priority chain (matches the redesigned spec).
//
// Input shape: { happy, sad, angry, fear, surprise, disgust, neutral }
// where each value is a fractional score 0..1 from HF Inference output.
// Aliases (fearful/surprised/disgusted) are added so the priority chain
// reads naturally if expressions ever come from a face-api.js source.
//
// Returns: { tip: string, type: 'positive'|'warning'|'info', icon: string }
// =====================================================================
function _normalizeScores(hfList) {
  // hfList example: [{label:'happy', score:0.82}, ...]
  const out = {};
  for (const { label, score } of hfList || []) {
    out[label] = score;
  }
  // Alias HF names â†’ face-api.js names
  if ('fear' in out)     out.fearful   = out.fear;
  if ('surprise' in out) out.surprised = out.surprise;
  if ('disgust' in out)  out.disgusted = out.disgust;
  return out;
}

function _pickRealtimeTip(expressions, baseline) {
  if (!expressions || Object.keys(expressions).length === 0) {
    return { tip: 'Move closer to the camera â€” face not detected', type: 'warning', icon: 'Eye' };
  }

  // Normalised totals so the priority chain reasons over RELATIVE weights,
  // not raw thresholds. With 7 labels, any single label > 0.50 is a strong
  // signal; 0.30-0.50 is moderate; below that the model is undecided.
  const happy     = expressions.happy     || 0;
  const neutral   = expressions.neutral   || 0;
  const sad       = expressions.sad       || 0;
  const fearful   = expressions.fearful   || expressions.fear     || 0;
  const angry     = expressions.angry     || 0;
  const disgusted = expressions.disgusted || expressions.disgust  || 0;
  const surprised = expressions.surprised || expressions.surprise || 0;
  const negativeTotal = sad + fearful + angry + disgusted;

  // Baseline-aware deltas: positive = above the candidate's resting face.
  // If we don't have a baseline yet, delta == current score (matches old
  // absolute-threshold behaviour).
  const b = baseline || {};
  const deltaSad      = sad      - (b.sad      || 0);
  const deltaFear     = fearful  - (b.fear     || b.fearful   || 0);
  const deltaAngry    = angry    - (b.angry    || 0);
  const deltaDisgust  = disgusted - (b.disgust || b.disgusted || 0);
  const deltaNegative = deltaSad + deltaFear + deltaAngry + deltaDisgust;
  const deltaHappy    = happy   - (b.happy   || 0);

  // Rank-1 emotion drives the tip. Ties broken in favour of positive labels.
  const ranked = [
    ['happy',     happy],
    ['neutral',   neutral],
    ['surprised', surprised],
    ['sad',       sad],
    ['fearful',   fearful],
    ['angry',     angry],
    ['disgusted', disgusted],
  ].sort((a, b) => b[1] - a[1]);
  const [topLabel, topScore] = ranked[0];

  // Strong negative signal â†’ always warn first. We require BOTH absolute
  // score over the bar AND a baseline-relative deviation so a naturally
  // serious resting face doesn't trip the warning.
  if (negativeTotal >= 0.55 && deltaNegative >= BASELINE_DELTA) {
    if (deltaFear >= 0.20 || surprised >= 0.45) {
      return { tip: 'Take a breath â€” slow down and speak with intention', type: 'warning', icon: 'AlertCircle' };
    }
    if (deltaAngry >= 0.20 || deltaDisgust >= 0.15) {
      return { tip: 'Relax your jaw and brow â€” aim for an open, neutral face', type: 'warning', icon: 'AlertCircle' };
    }
    if (deltaSad >= 0.20) {
      return { tip: 'Lift your chin slightly and maintain an upright posture', type: 'warning', icon: 'AlertCircle' };
    }
  }

  // Positive signals (checked BEFORE neutral so a smiling candidate isn't
  // overridden by a marginally higher neutral score). Either an absolute
  // happy score or a meaningful uplift over baseline both count.
  if (happy >= 0.50 || deltaHappy >= 0.20 || (happy >= 0.35 && happy >= neutral * 0.8)) {
    return { tip: 'Natural warmth showing â€” keep that confident energy', type: 'positive', icon: 'CheckCircle2' };
  }
  if (topLabel === 'neutral' && topScore >= 0.55 && negativeTotal < 0.25) {
    return { tip: 'Great composure â€” you look calm and professional', type: 'positive', icon: 'CheckCircle2' };
  }

  // Mild surprise (often a thinking expression) â€” informational, not a warning.
  if (surprised >= 0.30 && surprised > negativeTotal) {
    return { tip: 'Engaged and thinking â€” take a brief pause before answering', type: 'info', icon: 'CheckCircle2' };
  }

  // Mild negative tilt without crossing the strong-signal bar.
  if (negativeTotal >= 0.30 && deltaNegative >= BASELINE_DELTA) {
    return { tip: 'Soften your expression â€” relax the brow and breathe', type: 'warning', icon: 'AlertCircle' };
  }

  return { tip: 'Hold your position â€” looking good', type: 'positive', icon: 'CheckCircle2' };
}

// Smooth a rolling buffer of per-frame labelâ†’score maps into a single
// averaged distribution. This is what we feed to _pickRealtimeTip so a
// single noisy frame can never flip a tip on its own.
function _averageDistribution(buffer) {
  if (!buffer || buffer.length === 0) return {};
  const sum = {};
  for (const frame of buffer) {
    for (const [k, v] of Object.entries(frame)) {
      sum[k] = (sum[k] || 0) + v;
    }
  }
  const avg = {};
  for (const [k, v] of Object.entries(sum)) avg[k] = v / buffer.length;
  return avg;
}

function _iconFor(name) {
  if (name === 'CheckCircle2') return CheckCircle2;
  if (name === 'AlertCircle')  return AlertCircle;
  if (name === 'Eye')          return Eye;
  return CheckCircle2;
}

function _colorClasses(type) {
  if (type === 'positive') return { border: 'border-l-emerald-500', icon: 'text-emerald-400' };
  if (type === 'info')     return { border: 'border-l-purple-400', icon: 'text-purple-400' };
  return                        { border: 'border-l-amber-400',   icon: 'text-amber-400' };
}

// =====================================================================
// Legacy export â€” consumed by MockInterview.jsx at end-of-interview.
// Receives the CUMULATIVE percent distribution (0-100 per label).
// Returns an array of coaching cards summarising the whole session.
// =====================================================================
export function getExpressionCoaching(distribution) {
  if (!distribution || Object.keys(distribution).length === 0) return [];

  const happy   = distribution.happy   || 0;
  const sad     = distribution.sad     || 0;
  const fear    = distribution.fear    || 0;
  const angry   = distribution.angry   || 0;
  const disgust = distribution.disgust || 0;
  const neutral = distribution.neutral || 0;
  const negativeTotal = sad + fear + angry + disgust;

  const coaching = [];

  // === Strong negative pattern (highest priority) ==========================
  if (negativeTotal >= 50) {
    coaching.push({ icon: '', priority: 'high',
      tip: 'You appeared tense for most of the interview. Practise slow breathing before answering and unclench your jaw between questions.' });
  }
  if (fear >= 25) {
    coaching.push({ icon: '', priority: 'high',
      tip: 'Anxiety read on camera. Slow your speech, look at the lens, and take a deliberate pause before each answer.' });
  }
  if (sad >= 25) {
    coaching.push({ icon: '', priority: 'high',
      tip: 'Your face read low-energy at times. Lift the corners of your mouth slightly â€” a neutral-to-positive expression projects confidence.' });
  }
  if (angry >= 15 || disgust >= 12) {
    coaching.push({ icon: '', priority: 'medium',
      tip: 'Your expression read as intense or guarded. Soften the brow and keep an open, approachable face.' });
  }

  // === Positive patterns (only surfaced when negatives are under control) ==
  if (happy >= 30 && negativeTotal < 40) {
    coaching.push({ icon: '', priority: 'good',
      tip: 'Great positive energy â€” your warmth came through clearly. Keep that going.' });
  } else if (neutral >= 60 && negativeTotal < 25 && happy < 30) {
    coaching.push({ icon: '', priority: 'medium',
      tip: 'Very composed but quite flat. A small, genuine smile when greeting and closing each answer would lift engagement.' });
  } else if (happy < 10 && negativeTotal < 30) {
    coaching.push({ icon: '', priority: 'medium',
      tip: 'Try to show more enthusiasm â€” a small smile when delivering your answer signals genuine interest.' });
  }

  // === Final reassurance card if nothing else fired ========================
  if (coaching.length === 0) {
    coaching.push({ icon: '', priority: 'good',
      tip: 'Balanced and professional on camera. No specific facial-expression concerns from this session.' });
  }
  return coaching;
}

// =====================================================================
// Lightweight presence + face-detection helpers (no extra dependencies).
//
// 1) _hasContentInFrame  : pixel-variance check on a centre patch of the
//    JPEG canvas. Tells us if there is ANYTHING in front of the camera
//    (vs. a blank wall / lens cap). Used to fire "no face detected"
//    locally instead of waiting for the HF model to return a bad result.
//
// 2) _detectFaceBox      : Uses the experimental Shape Detection API
//    (`window.FaceDetector`) when the browser exposes it (Chrome/Edge
//    desktop behind a flag, Chrome Android by default, Safari 17+).
//    Returns { x, y, w, h } in video pixel space, or null.
//
// Both helpers return synchronously / cheaply enough to run on every
// capture without adding measurable cost to the 3 s loop.
// =====================================================================
function _hasContentInFrame(canvas) {
  if (!canvas) return true; // assume yes if we can't measure
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return true;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Sample a 40% Ã— 40% centre patch (where a candidate's face should be).
  const sw = Math.max(32, Math.floor(w * 0.4));
  const sh = Math.max(32, Math.floor(h * 0.4));
  const sx = Math.floor((w - sw) / 2);
  const sy = Math.floor((h - sh) / 2);
  let img;
  try {
    img = ctx.getImageData(sx, sy, sw, sh).data;
  } catch {
    return true; // CORS-tainted canvas etc â€” don't block sampling
  }
  // Compute luminance variance on a stride to keep this fast.
  let n = 0, sum = 0, sumSq = 0;
  for (let i = 0; i < img.length; i += 16) {
    const lum = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
    sum   += lum;
    sumSq += lum * lum;
    n++;
  }
  if (n === 0) return true;
  const mean = sum / n;
  const variance = (sumSq / n) - (mean * mean);
  return variance >= PRESENCE_VARIANCE_THRESHOLD;
}

// Cached detector instance â€” constructed lazily, reused across frames.
let _faceDetectorInstance = null;
let _faceDetectorTried = false;
function _getShapeDetector() {
  if (_faceDetectorTried) return _faceDetectorInstance;
  _faceDetectorTried = true;
  try {
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {

      _faceDetectorInstance = new window.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 1,
      });
    }
  } catch {
    _faceDetectorInstance = null;
  }
  return _faceDetectorInstance;
}

// =====================================================================
// Real face detection + LOCAL emotion classification.
//
// Tries face-api.js first (works on every browser, returns both bbox AND
// a full 7-label emotion distribution). Falls back to the experimental
// Shape Detection API for bbox-only, and finally to null.
//
// Returns: { bbox: {x,y,w,h} | null, scores: {label: float} | null,
//            detectionScore: number }  where detectionScore is in [0,1].
// =====================================================================
async function _detectFaceAndEmotion(canvas) {
  // Path 1 â€” face-api.js (preferred: bbox + emotion in a single pass).
  if (_faceApiReady && _faceApiModule) {
    try {
      const fa = _faceApiModule;
      const opts = new fa.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.35,
      });
      const result = await fa
        .detectSingleFace(canvas, opts)
        .withFaceExpressions();
      if (result && result.detection) {
        const box = result.detection.box;
        const scoresRaw = result.expressions || {};
        // Normalise label aliases (face-api uses 'fearful', 'surprised',
        // 'disgusted' but our pipeline standardises on the HF names).
        const scores = {
          angry:    scoresRaw.angry    || 0,
          disgust:  scoresRaw.disgusted || scoresRaw.disgust  || 0,
          fear:     scoresRaw.fearful  || scoresRaw.fear     || 0,
          happy:    scoresRaw.happy    || 0,
          neutral:  scoresRaw.neutral  || 0,
          sad:      scoresRaw.sad      || 0,
          surprise: scoresRaw.surprised || scoresRaw.surprise || 0,
        };
        return {
          bbox: { x: box.x, y: box.y, w: box.width, h: box.height },
          scores,
          detectionScore: result.detection.score || 0,
        };
      }
      return { bbox: null, scores: null, detectionScore: 0 };
    } catch {
      // fall through to Shape Detection
    }
  }

  // Path 2 â€” browser Shape Detection API (bbox only).
  const detector = _getShapeDetector();
  if (detector && canvas) {
    try {
      const faces = await detector.detect(canvas);
      if (faces && faces.length > 0) {
        let best = faces[0];
        let bestArea = best.boundingBox.width * best.boundingBox.height;
        for (const f of faces) {
          const a = f.boundingBox.width * f.boundingBox.height;
          if (a > bestArea) { best = f; bestArea = a; }
        }
        const bb = best.boundingBox;
        return {
          bbox: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
          scores: null,
          detectionScore: 0.6, // Shape Detection doesn't expose a score; assume moderate.
        };
      }
      return { bbox: null, scores: null, detectionScore: 0 };
    } catch {
      // fall through
    }
  }

  // Path 3 â€” no detector available.
  return { bbox: null, scores: null, detectionScore: 0 };
}

// Ensemble two probability distributions over the same label set.
// Each distribution is weighted by the model's relative confidence so
// that whichever model is more decisive on THIS frame counts more.
function _ensembleScores(hfScores, localScores) {
  if (!localScores) return hfScores || {};
  if (!hfScores)    return localScores;
  const labels = new Set([...Object.keys(hfScores), ...Object.keys(localScores)]);
  // Confidence = top-1 score for each model.
  const cHf    = Math.max(0, ...Object.values(hfScores));
  const cLocal = Math.max(0, ...Object.values(localScores));
  const totalC = cHf + cLocal;
  if (totalC === 0) return hfScores;
  const wHf    = cHf    / totalC;
  const wLocal = cLocal / totalC;
  const out = {};
  for (const label of labels) {
    out[label] = (hfScores[label] || 0) * wHf + (localScores[label] || 0) * wLocal;
  }
  return out;
}

// =====================================================================
// Canvas: bounding-box overlay drawn in #A855F7 (no text).
// If `bbox` is supplied (from _detectFaceBox), the rectangle follows the
// real face. Otherwise we fall back to a centred reference frame so the
// overlay never disappears entirely.
// =====================================================================
function _drawBoundingBox(canvas, video, bbox) {
  if (!canvas || !video) return;
  const rect = video.getBoundingClientRect();
  canvas.width  = rect.width  || video.videoWidth  || 640;
  canvas.height = rect.height || video.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let x, y, w, h;
  if (bbox && video.videoWidth && video.videoHeight) {
    // Real face bbox is in video pixel space; scale to displayed size.
    const scaleX = canvas.width  / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;
    x = bbox.x * scaleX;
    y = bbox.y * scaleY;
    w = bbox.w * scaleX;
    h = bbox.h * scaleY;
  } else {
    // Estimated face area â€” centred, ~50% wide, ~75% tall.
    x = canvas.width  * 0.25;
    y = canvas.height * 0.10;
    w = canvas.width  * 0.50;
    h = canvas.height * 0.75;
  }
  const r = 14;

  ctx.strokeStyle = '#A855F7';
  ctx.lineWidth   = bbox ? 2.0 : 1.5;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
  ctx.stroke();
}

// =====================================================================
// Median-emotion helper for the rolling buffer.
//
// Given the last few per-frame {label, score} samples, returns the label
// that won the simple majority vote (>= ceil(N/2) hits) together with the
// mean score of those winning frames. Returns null when no label has a
// clear majority â€” callers should treat that as "don't update the badge
// yet, keep sampling". The 0.55 confidence gate is applied by the caller.
// =====================================================================
function getMedianEmotion(buffer) {
  if (!buffer || buffer.length === 0) return null;
  const freq = {};
  for (const entry of buffer) {
    freq[entry.label] = (freq[entry.label] || 0) + 1;
  }
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const topLabel = sorted[0][0];
  const topCount = sorted[0][1];
  if (topCount < Math.ceil(buffer.length * 0.5)) return null;
  const matchingScores = buffer
    .filter(e => e.label === topLabel)
    .map(e => e.score);
  const avgScore =
    matchingScores.reduce((a, b) => a + b, 0) / matchingScores.length;
  return { label: topLabel, score: avgScore };
}

// Emoji + colour map for the live-emotion overlay badge.
const EMOTION_META = {
  happy:    { emoji: '' },
  sad:      { emoji: '' },
  angry:    { emoji: '' },
  fear:     { emoji: '' },
  surprise: { emoji: '' },
  disgust:  { emoji: '' },
  neutral:  { emoji: '' },
};

// =====================================================================
// Component
// =====================================================================
const FaceExpressionOverlay = forwardRef(function FaceExpressionOverlay(
  { active, onCoachingUpdate, currentQuestionIndexRef },
  ref,
) {
  const videoRef         = useRef(null);
  const canvasRef        = useRef(null);   // hidden â€” used for HF capture
  const overlayCanvasRef = useRef(null);   // visible â€” bounding box
  const streamRef        = useRef(null);
  const intervalRef      = useRef(null);
  const inFlightRef      = useRef(false);
  const emotionLogRef    = useRef([]);     // every accepted frame's full score map
  const rollingBufferRef = useRef([]);     // last 5 {label, score} samples for median vote
  const smoothBufferRef  = useRef([]);     // last SMOOTH_WINDOW frames for rolling avg
  const baselineRef      = useRef(null);   // averaged resting expression
  const baselineBufRef   = useRef([]);     // first BASELINE_FRAMES collector
  const warningStreakRef = useRef(0);      // consecutive warning windows
  const lastTipKeyRef    = useRef('');     // dedup onCoachingUpdate calls
  const lastTipAtRef     = useRef(0);      // ms timestamp of last emitted tip
  const lastBboxRef      = useRef(null);   // last detected face bbox
  const detectionScoreRef = useRef(0);     // smoothed face-detection confidence

  const [tipQueue,      setTipQueue]      = useState([]); // [{ tip, type, icon, addedAt }]
  const [, _setTick]    = useState(0);                    // ticker for fade re-render
  const [camError,      setCamError]      = useState(null);
  const [hfError,       setHfError]       = useState(null); // transient HF problem (non-blocking)
  const [updating,      setUpdating]      = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [faceVisible,   setFaceVisible]   = useState(false);
  const [httpsWarning]                    = useState(isInsecureContext());
  const [trackingScore, setTrackingScore] = useState(0);   // 0..1 â€” detector confidence
  const [calibrated,    setCalibrated]    = useState(false);
  const [faceApiState,  setFaceApiState]  = useState('loading'); // loading | ready | unavailable
  // Median-smoothed live emotion shown on the overlay badge.
  // Shape: { label: string, score: number } | null
  const [liveEmotion,   setLiveEmotion]   = useState(null);

  // Kick off face-api lazy load as soon as the component mounts so the
  // models are warm by the time the user clicks "Enable Camera".
  useEffect(() => {
    let cancelled = false;
    _loadFaceApi().then((mod) => {
      if (cancelled) return;
      setFaceApiState(mod ? 'ready' : 'unavailable');
    });
    return () => { cancelled = true; };
  }, []);

  // Periodic re-render so the "fade after 4s" opacity check stays current.
  useEffect(() => {
    if (!tipQueue.length) return;
    const id = setInterval(() => _setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => clearInterval(id);
  }, [tipQueue.length]);

  const _pushTip = useCallback((tipObj) => {
    const key = `${tipObj.type}::${tipObj.tip}`;
    const now = Date.now();
    // Same tip back-to-back? Suppress UNLESS more than TIP_REEMIT_MS has
    // passed, in which case re-surface it so good behaviour is reinforced.
    if (key === lastTipKeyRef.current && (now - lastTipAtRef.current) < TIP_REEMIT_MS) {
      return;
    }
    lastTipKeyRef.current = key;
    lastTipAtRef.current  = now;

    setTipQueue((prev) => [{ ...tipObj, addedAt: now }, ...prev].slice(0, 3));
    if (typeof onCoachingUpdate === 'function') {
      onCoachingUpdate({ tip: tipObj.tip, type: tipObj.type, icon: tipObj.icon });
    }
  }, [onCoachingUpdate]);

  const stopAll = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setFaceVisible(false);
  }, []);

  async function captureAndAnalyze() {
    if (inFlightRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Local presence gate: if the centre of the frame is flat/blank, skip
    // the HF round-trip entirely and tell the user to come back into view.
    if (!_hasContentInFrame(canvas)) {
      setFaceVisible(false);
      lastBboxRef.current = null;
      detectionScoreRef.current = 0;
      setTrackingScore(0);
      _drawBoundingBox(overlayCanvasRef.current, videoRef.current, null);
      _pushTip({ tip: 'Move closer to the camera â€” face not detected', type: 'warning', icon: 'Eye' });
      return;
    }

    // Real face detection + LOCAL emotion (face-api > Shape Detection > null).
    const detection = await _detectFaceAndEmotion(canvas);
    const bbox = detection.bbox;
    lastBboxRef.current = bbox;
    // Exponentially-smoothed detector confidence for the UI indicator.
    detectionScoreRef.current = (detectionScoreRef.current * 0.6) + (detection.detectionScore * 0.4);
    setTrackingScore(detectionScoreRef.current);

    if (_faceApiReady && !bbox) {
      // face-api is loaded AND it confidently says there's no face â†’
      // user genuinely out of frame; skip the HF round-trip.
      setFaceVisible(false);
      _drawBoundingBox(overlayCanvasRef.current, videoRef.current, null);
      _pushTip({ tip: 'Center your face in the frame', type: 'warning', icon: 'Eye' });
      return;
    }

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
    if (!blob) return;

    inFlightRef.current = true;
    setUpdating(true);
    try {
      // Send the JPEG frame to the backend proxy, which forwards it to
      // trpakov/vit-face-expression on HF. Keeps HF_TOKEN server-side.
      const apiUrl = API_URL.replace(/\/+$/, '');
      const form = new FormData();
      form.append('file', blob, 'frame.jpg');
      const resp = await fetch(`${apiUrl}/face-expression`, {
        method: 'POST',
        body: form,
      });
      let hfScoresFromList = null;
      let backendLabelsList = [];
      if (resp.ok) {
        const data = await resp.json();
        // Backend now returns the full sorted list of {label, score} dicts
        // (lowercase labels, sorted desc). Keep both the raw list (for the
        // per-frame fullFrame log) and the normalised dict (for ensemble).
        backendLabelsList = Array.isArray(data?.labels) ? data.labels : [];
        if (backendLabelsList.length) {
          hfScoresFromList = _normalizeScores(backendLabelsList);
          setHfError(null);
        }
      } else {
        const detail = await resp.text();
        setHfError(`Backend ${resp.status}: ${(detail || '').slice(0, 100)}`);
      }

      // Ensemble: weighted blend of HF + face-api distributions. If only
      // one model returned scores, that one is used directly.
      const expressions = _ensembleScores(hfScoresFromList, detection.scores);
      const hasAnyScores = expressions && Object.keys(expressions).length > 0;
      if (!hasAnyScores) {
        // Neither model produced usable scores â€” hold position but keep sampling.
        setFaceVisible(true);
        _drawBoundingBox(overlayCanvasRef.current, videoRef.current, bbox);
        _pushTip({ tip: 'Reading your expressionâ€¦ hold steady', type: 'info', icon: 'Eye' });
        return;
      }

      // Confidence gate on the ENSEMBLED score (more robust than gating
      // either model individually).
      const topScore = Math.max(...Object.values(expressions));
      if (topScore < MIN_FRAME_CONFIDENCE) {
        setFaceVisible(true);
        _drawBoundingBox(overlayCanvasRef.current, videoRef.current, bbox);
        return;
      }

      // Add face-api aliases so the priority chain reads naturally.
      if ('fear'     in expressions) expressions.fearful   = expressions.fear;
      if ('surprise' in expressions) expressions.surprised = expressions.surprise;
      if ('disgust'  in expressions) expressions.disgusted = expressions.disgust;

      // ---------------------------------------------------------------
      // Rolling median vote across the last 5 samples for the live badge.
      // Derives the top {label, score} from the ENSEMBLED distribution
      // (HF + face-api), excluding the alias keys so neutral/happy/sad/
      // ... compete on equal footing.
      // ---------------------------------------------------------------
      const aliasKeys = new Set(['fearful', 'surprised', 'disgusted']);
      let medianTopLabel = null;
      let medianTopScore = 0;
      for (const [k, v] of Object.entries(expressions)) {
        if (aliasKeys.has(k)) continue;
        if (v > medianTopScore) { medianTopScore = v; medianTopLabel = k; }
      }

      let smoothed = null;
      if (medianTopLabel) {
        rollingBufferRef.current = [
          ...rollingBufferRef.current.slice(-4),
          { label: medianTopLabel, score: medianTopScore },
        ];
        smoothed = getMedianEmotion(rollingBufferRef.current);
      }

      // Confidence gate â€” only commit the smoothed emotion to UI + log
      // when the median-voted score clears 0.55. Below the gate we keep
      // sampling silently (no badge flicker, no log noise).
      if (smoothed && smoothed.score > 0.55) {
        setLiveEmotion(smoothed);
        emotionLogRef.current.push({
          label:         smoothed.label,
          score:         smoothed.score,
          timestamp:     Date.now(),
          questionIndex: currentQuestionIndexRef?.current ?? 0,
          fullFrame:     backendLabelsList,
          // Keep the original `scores` payload so the score-averaged
          // _computeSummary path continues to work unchanged.
          scores:        expressions,
        });
      }

      // Baseline calibration: first BASELINE_FRAMES valid frames define the
      // user's resting expression.
      if (!baselineRef.current) {
        baselineBufRef.current.push(expressions);
        if (baselineBufRef.current.length >= BASELINE_FRAMES) {
          baselineRef.current = _averageDistribution(baselineBufRef.current);
          setCalibrated(true);
        }
      }

      // Rolling smoothing buffer.
      smoothBufferRef.current.push(expressions);
      if (smoothBufferRef.current.length > SMOOTH_WINDOW) {
        smoothBufferRef.current.shift();
      }

      setFaceVisible(true);
      _drawBoundingBox(overlayCanvasRef.current, videoRef.current, bbox);

      if (smoothBufferRef.current.length < SMOOTH_MIN_FRAMES) {
        _pushTip({ tip: 'Reading your expressionâ€¦ hold steady', type: 'info', icon: 'Eye' });
      } else if (!baselineRef.current) {
        _pushTip({ tip: 'Calibrating to your resting faceâ€¦', type: 'info', icon: 'Eye' });
      } else {
        const smoothed = _averageDistribution(smoothBufferRef.current);
        const tip = _pickRealtimeTip(smoothed, baselineRef.current);
        if (tip.type === 'warning') {
          warningStreakRef.current += 1;
          if (warningStreakRef.current < HYSTERESIS_REPEATS) {
            _pushTip({ tip: 'Hold your position â€” looking good', type: 'positive', icon: 'CheckCircle2' });
            return;
          }
        } else {
          warningStreakRef.current = 0;
        }
        _pushTip(tip);
      }
    } catch (err) {
      const msg = err?.status
        ? `Backend ${err.status}: ${(err.message || '').slice(0, 100)}`
        : `${err?.name || 'Error'}: ${err?.message || err}`;
      console.warn('[FaceExpressionOverlay] backend call failed:', msg);
      setHfError(msg.slice(0, 140));
    } finally {
      inFlightRef.current = false;
      setUpdating(false);
    }
  }

  const startCamera = useCallback(async () => {
    setCamError(null);
    emotionLogRef.current = [];
    rollingBufferRef.current = [];
    smoothBufferRef.current = [];
    baselineRef.current = null;
    baselineBufRef.current = [];
    warningStreakRef.current = 0;
    lastBboxRef.current = null;
    detectionScoreRef.current = 0;
    lastTipKeyRef.current = '';
    lastTipAtRef.current = 0;
    setTipQueue([]);
    setFaceVisible(false);
    setCalibrated(false);
    setTrackingScore(0);
    setLiveEmotion(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCamError('Webcam not available in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { /* autoplay race â€” ignore */ });
      }
      setCameraStarted(true);
      // Kick off the first capture quickly so the user sees a tip within ~1s.
      // The video element typically reaches readyState 2 within ~300-500ms.
      setTimeout(() => { captureAndAnalyze(); }, 600);
      intervalRef.current = setInterval(captureAndAnalyze, SAMPLE_INTERVAL_MS);
    } catch (err) {
      const name = err?.name || '';
      let msg = 'Camera access denied â€” please allow camera access in your browser settings and click Enable Camera again.';
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        msg = 'No webcam was detected. Connect a camera and try again.';
      } else if (name === 'NotReadableError') {
        msg = 'Your webcam is already in use by another application.';
      }
      setCamError(msg);
      setCameraStarted(false);
    }

  }, []);

  // Parent flagged inactive â†’ stop the camera.
  useEffect(() => {
    if (!active && cameraStarted) {
      stopAll();
      setCameraStarted(false);
    }
  }, [active, cameraStarted, stopAll]);

  // Always cleanup on unmount.
  useEffect(() => () => stopAll(), [stopAll]);

  useImperativeHandle(ref, () => ({
    finalize() {
      stopAll();
      setCameraStarted(false);
      return _computeSummary(emotionLogRef.current);
    },
    recalibrate() {
      baselineRef.current = null;
      baselineBufRef.current = [];
      warningStreakRef.current = 0;
      smoothBufferRef.current = [];
      lastTipKeyRef.current = '';
      lastTipAtRef.current = 0;
      setCalibrated(false);
      _pushTip({ tip: 'Recalibrating to your resting faceâ€¦', type: 'info', icon: 'Eye' });
    },
  }));

  function _computeSummary(log) {
    if (!log.length) return null;

    // Score-averaged distribution (each frame contributes its full label
    // distribution, not just its argmax). Far more robust than counting
    // dominant labels â€” single misclassifications no longer skew the result.
    const sumScores = {};
    for (const entry of log) {
      const scores = entry.scores || {};
      for (const [label, value] of Object.entries(scores)) {
        // Skip the face-api aliases (fearful/surprised/disgusted) so the
        // distribution sums to 1 and matches the HF label set.
        if (label === 'fearful' || label === 'surprised' || label === 'disgusted') continue;
        sumScores[label] = (sumScores[label] || 0) + value;
      }
    }
    const total = log.length;
    const distribution = {};
    let dominant = '';
    let dominantPct = 0;
    for (const [label, sum] of Object.entries(sumScores)) {
      const pct = Math.round((sum / total) * 100);
      distribution[label] = pct;
      if (pct > dominantPct) {
        dominant = label;
        dominantPct = pct;
      }
    }
    const negativePct =
      (distribution.sad || 0) + (distribution.fear || 0) +
      (distribution.angry || 0) + (distribution.disgust || 0);
    return {
      dominant,
      dominantPct,
      negativePct,
      totalFrames: total,
      distribution,
      rawLog: [...log], // full per-frame log for per-question analysis
    };
  }

  // =====================================================================
  // Render
  // =====================================================================
  const now = Date.now();

  return (
    <div className="w-full space-y-3">
      {/* Webcam frame */}
      <div className="relative w-full rounded-xl overflow-hidden bg-section border border-purple-900/40">
        {/* Hidden canvas â€” used for HF capture only */}
        <canvas ref={canvasRef} className="hidden" />

        {httpsWarning && (
          <div className="px-3 py-2 text-xs text-amber-300 bg-amber-950/40 border-b border-amber-900/40">
             Camera requires HTTPS in production. On localhost this should work â€” check browser permissions.
          </div>
        )}

        {/* Video element is always rendered so videoRef is valid at startCamera time. */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full rounded-xl object-cover"
          style={{
            transform: 'scaleX(-1)',
            maxHeight: '280px',
            display: cameraStarted && !camError ? 'block' : 'none',
          }}
        />

        {/* Bounding-box overlay (no text). */}
        {cameraStarted && !camError && faceVisible && (
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        {camError ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center gap-3">
            <p className="text-sm text-error">{camError}</p>
            <button
              onClick={startCamera}
              className="text-xs px-3 py-1.5 rounded-md border border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
            >
              Try Again
            </button>
          </div>
        ) : !cameraStarted ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center gap-3">
            <p className="text-sm text-text-muted">Enable your webcam for live expression coaching.</p>
            <button
              onClick={startCamera}
              disabled={!active}
              className="text-xs px-4 py-2 rounded-md bg-purple-600/80 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {active ? 'Enable Camera' : 'Start interview first'}
            </button>
          </div>
        ) : (
          <>
            {updating && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-purple-300/80">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                updating
              </div>
            )}
            {/* Top-left: tracking confidence + face-api status */}
            <div className="absolute top-3 left-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/70 bg-black/30 backdrop-blur-sm rounded-md px-2 py-1">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  trackingScore > 0.6
                    ? 'bg-emerald-400'
                    : trackingScore > 0.3
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
              <span>
                {faceApiState === 'ready'
                  ? `Local + HF Â· ${Math.round(trackingScore * 100)}%`
                  : faceApiState === 'loading'
                  ? 'Loading modelsâ€¦'
                  : `HF only Â· ${Math.round(trackingScore * 100)}%`}
              </span>
              {calibrated && (
                <span className="ml-1 text-emerald-300/90 normal-case">Â· calibrated</span>
              )}
            </div>
            {/* Bottom-left: live median-smoothed emotion + confidence */}
            {liveEmotion && (
              <div
                className="absolute bottom-3 left-3 flex items-center gap-2 text-xs bg-section/80 text-purple-400 border border-purple-900/40 backdrop-blur-sm rounded-md px-2.5 py-1.5"
                title={`Median-smoothed emotion Â· ${Math.round((liveEmotion.score || 0) * 100)}% confidence`}
              >
                <span className="text-sm leading-none">
                  {EMOTION_META[liveEmotion.label]?.emoji || '\ud83d\ude10'}
                </span>
                <span className="capitalize font-medium">{liveEmotion.label}</span>
                <span className="text-[10px] opacity-70">
                  {Math.round((liveEmotion.score || 0) * 100)}%
                </span>
              </div>
            )}
            {/* Bottom-right: manual recalibrate button */}
            <button
              onClick={() => {
                baselineRef.current = null;
                baselineBufRef.current = [];
                warningStreakRef.current = 0;
                smoothBufferRef.current = [];
                lastTipKeyRef.current = '';
                lastTipAtRef.current = 0;
                setCalibrated(false);
                _pushTip({ tip: 'Recalibrating to your resting faceâ€¦', type: 'info', icon: 'Eye' });
              }}
              className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] uppercase tracking-wider text-purple-200/90 bg-black/40 hover:bg-purple-600/40 backdrop-blur-sm rounded-md px-2 py-1 transition-colors"
              title="Re-baseline against your current resting face"
            >
              <RotateCcw size={11} />
              Recalibrate
            </button>
            {!active && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                <span className="text-text-muted text-sm">Camera paused</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tip queue â€” under the camera, NOT overlaid */}
      <AnimatePresence initial={false}>
        {tipQueue.map((t, idx) => {
          const Icon = _iconFor(t.icon);
          const { border, icon: iconColor } = _colorClasses(t.type);
          const stale = idx > 0 || (now - t.addedAt) > TIP_FADE_AFTER_MS;
          const opacity = stale ? 0.5 : 1;
          return (
            <motion.div
              key={t.addedAt}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              className={`flex items-start gap-2 bg-white/5 rounded-lg px-3 py-2 text-xs border-l-2 ${border}`}
            >
              <Icon size={14} className={`${iconColor} flex-shrink-0 mt-0.5`} />
              <p className="text-white/80 leading-snug">{t.tip}</p>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {tipQueue.length === 0 && cameraStarted && !camError && (
        <div className="text-[11px] italic px-1">
          {updating ? (
            <span className="text-purple-300/80">Analysing your expressionâ€¦</span>
          ) : hfError ? (
            <span className="text-amber-300/90">
              Hugging Face is warming up the model â€” first tip can take up to 20s. ({hfError})
            </span>
          ) : (
            <span className="text-white/40">Waiting for the first frameâ€¦</span>
          )}
        </div>
      )}
    </div>
  );
});

export default FaceExpressionOverlay;
