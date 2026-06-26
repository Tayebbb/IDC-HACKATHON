/**
 * FaceExpressionOverlay.jsx
 * ---------------------------------------------------------------
 * Live webcam → Hugging Face vit-face-expression (browser direct).
 *
 * UI no longer shows emotion labels (happy / sad / angry / surprise / …).
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
 *   default — the FaceExpressionOverlay component
 *   getExpressionCoaching(distribution) — kept for back-compat with
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
import { CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import API_URL from '../config';

const EXPRESSION_MODEL = 'trpakov/vit-face-expression';
const SAMPLE_INTERVAL_MS = 3000;
const TIP_FADE_AFTER_MS = 4000;
const NEGATIVE_EMOTIONS = new Set(['angry', 'disgust', 'fear', 'sad']);

// Smoothing window: 5 frames × 3 s = 15 s of context per decision.
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
  // Alias HF names → face-api.js names
  if ('fear' in out)     out.fearful   = out.fear;
  if ('surprise' in out) out.surprised = out.surprise;
  if ('disgust' in out)  out.disgusted = out.disgust;
  return out;
}

function _pickRealtimeTip(expressions) {
  if (!expressions || Object.keys(expressions).length === 0) {
    return { tip: 'Move closer to the camera — face not detected', type: 'warning', icon: 'Eye' };
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

  // Strong negative signal → always warn first.
  if (negativeTotal >= 0.55) {
    if (fearful >= 0.30 || surprised >= 0.45) {
      return { tip: 'Take a breath — slow down and speak with intention', type: 'warning', icon: 'AlertCircle' };
    }
    if (angry >= 0.30 || disgusted >= 0.25) {
      return { tip: 'Relax your jaw and brow — aim for an open, neutral face', type: 'warning', icon: 'AlertCircle' };
    }
    if (sad >= 0.30) {
      return { tip: 'Lift your chin slightly and maintain an upright posture', type: 'warning', icon: 'AlertCircle' };
    }
  }

  // Positive signals (checked BEFORE neutral so a smiling candidate isn't
  // overridden by a marginally higher neutral score).
  if (happy >= 0.50 || (happy >= 0.35 && happy >= neutral * 0.8)) {
    return { tip: 'Natural warmth showing — keep that confident energy', type: 'positive', icon: 'CheckCircle2' };
  }
  if (topLabel === 'neutral' && topScore >= 0.55 && negativeTotal < 0.25) {
    return { tip: 'Great composure — you look calm and professional', type: 'positive', icon: 'CheckCircle2' };
  }

  // Mild surprise (often a thinking expression) — informational, not a warning.
  if (surprised >= 0.30 && surprised > negativeTotal) {
    return { tip: 'Engaged and thinking — take a brief pause before answering', type: 'info', icon: 'CheckCircle2' };
  }

  // Mild negative tilt without crossing the strong-signal bar.
  if (negativeTotal >= 0.30) {
    return { tip: 'Soften your expression — relax the brow and breathe', type: 'warning', icon: 'AlertCircle' };
  }

  return { tip: 'Hold your position — looking good', type: 'positive', icon: 'CheckCircle2' };
}

// Smooth a rolling buffer of per-frame label→score maps into a single
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
// Legacy export — consumed by MockInterview.jsx at end-of-interview.
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
    coaching.push({ icon: '😟', priority: 'high',
      tip: 'You appeared tense for most of the interview. Practise slow breathing before answering and unclench your jaw between questions.' });
  }
  if (fear >= 25) {
    coaching.push({ icon: '🧘', priority: 'high',
      tip: 'Anxiety read on camera. Slow your speech, look at the lens, and take a deliberate pause before each answer.' });
  }
  if (sad >= 25) {
    coaching.push({ icon: '💪', priority: 'high',
      tip: 'Your face read low-energy at times. Lift the corners of your mouth slightly — a neutral-to-positive expression projects confidence.' });
  }
  if (angry >= 15 || disgust >= 12) {
    coaching.push({ icon: '😌', priority: 'medium',
      tip: 'Your expression read as intense or guarded. Soften the brow and keep an open, approachable face.' });
  }

  // === Positive patterns (only surfaced when negatives are under control) ==
  if (happy >= 30 && negativeTotal < 40) {
    coaching.push({ icon: '✅', priority: 'good',
      tip: 'Great positive energy — your warmth came through clearly. Keep that going.' });
  } else if (neutral >= 60 && negativeTotal < 25 && happy < 30) {
    coaching.push({ icon: '🧊', priority: 'medium',
      tip: 'Very composed but quite flat. A small, genuine smile when greeting and closing each answer would lift engagement.' });
  } else if (happy < 10 && negativeTotal < 30) {
    coaching.push({ icon: '😊', priority: 'medium',
      tip: 'Try to show more enthusiasm — a small smile when delivering your answer signals genuine interest.' });
  }

  // === Final reassurance card if nothing else fired ========================
  if (coaching.length === 0) {
    coaching.push({ icon: '👍', priority: 'good',
      tip: 'Balanced and professional on camera. No specific facial-expression concerns from this session.' });
  }
  return coaching;
}

// =====================================================================
// Canvas: subtle bounding-box overlay drawn in #A855F7 (no text).
// =====================================================================
function _drawBoundingBox(canvas, video) {
  if (!canvas || !video) return;
  const rect = video.getBoundingClientRect();
  canvas.width  = rect.width  || video.videoWidth  || 640;
  canvas.height = rect.height || video.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Estimated face area — centered, ~50% wide, ~75% tall.
  const x = canvas.width  * 0.25;
  const y = canvas.height * 0.10;
  const w = canvas.width  * 0.50;
  const h = canvas.height * 0.75;
  const r = 14;

  ctx.strokeStyle = '#A855F7';
  ctx.lineWidth   = 1.5;
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
// Component
// =====================================================================
const FaceExpressionOverlay = forwardRef(function FaceExpressionOverlay(
  { active, onCoachingUpdate },
  ref,
) {
  const videoRef         = useRef(null);
  const canvasRef        = useRef(null);   // hidden — used for HF capture
  const overlayCanvasRef = useRef(null);   // visible — bounding box
  const streamRef        = useRef(null);
  const intervalRef      = useRef(null);
  const inFlightRef      = useRef(false);
  const emotionLogRef    = useRef([]);     // every accepted frame's full score map
  const smoothBufferRef  = useRef([]);     // last SMOOTH_WINDOW frames for rolling avg
  const lastTipKeyRef    = useRef('');     // dedup onCoachingUpdate calls
  const lastTipAtRef     = useRef(0);      // ms timestamp of last emitted tip

  const [tipQueue,      setTipQueue]      = useState([]); // [{ tip, type, icon, addedAt }]
  const [, _setTick]    = useState(0);                    // ticker for fade re-render
  const [camError,      setCamError]      = useState(null);
  const [hfError,       setHfError]       = useState(null); // transient HF problem (non-blocking)
  const [updating,      setUpdating]      = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [faceVisible,   setFaceVisible]   = useState(false);
  const [httpsWarning]                    = useState(isInsecureContext());

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
      if (!resp.ok) {
        const detail = await resp.text();
        const err = new Error(detail || `face-expression ${resp.status}`);
        err.status = resp.status;
        throw err;
      }
      const data = await resp.json();
      const list = Array.isArray(data?.labels) ? data.labels : [];

      if (Array.isArray(list) && list.length) {
        setHfError(null); // clear any stale error indicator

        // Confidence gate: skip frames where the model is undecided. ViT's
        // top-1 score on a clean, well-lit face is usually 0.6+; anything
        // below MIN_FRAME_CONFIDENCE is almost certainly noise.
        const topScore = Math.max(...list.map((x) => x?.score ?? 0));
        if (topScore < MIN_FRAME_CONFIDENCE) {
          // Don't push a tip, don't pollute the log — just keep sampling.
          setFaceVisible(true);
          _drawBoundingBox(overlayCanvasRef.current, videoRef.current);
          return;
        }

        // Log the FULL score distribution for an accurate score-averaged
        // end-of-interview summary (powers MockInterview.jsx's ReasoningCard).
        const expressions = _normalizeScores(list);
        emotionLogRef.current.push({ scores: expressions, dominant: list[0] });

        // Maintain a rolling smoothing buffer so a single noisy frame can't
        // flip the live tip.
        smoothBufferRef.current.push(expressions);
        if (smoothBufferRef.current.length > SMOOTH_WINDOW) {
          smoothBufferRef.current.shift();
        }

        // Draw bounding box (no text per redesign spec).
        setFaceVisible(true);
        _drawBoundingBox(overlayCanvasRef.current, videoRef.current);

        if (smoothBufferRef.current.length < SMOOTH_MIN_FRAMES) {
          // Need at least 2 frames (~6 s) before we trust the average.
          _pushTip({ tip: 'Reading your expression… hold steady', type: 'info', icon: 'Eye' });
        } else {
          const smoothed = _averageDistribution(smoothBufferRef.current);
          const tip = _pickRealtimeTip(smoothed);
          _pushTip(tip);
        }
      } else {
        _pushTip({ tip: 'Move closer to the camera — face not detected',
                   type: 'warning', icon: 'Eye' });
      }
    } catch (err) {
      // Surface so the user knows something failed, but keep sampling.
      // Most are HF cold-starts (502 from our proxy) that resolve in a few seconds.
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
    smoothBufferRef.current = [];
    lastTipKeyRef.current = '';
    lastTipAtRef.current = 0;
    setTipQueue([]);
    setFaceVisible(false);

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
        await videoRef.current.play().catch(() => { /* autoplay race — ignore */ });
      }
      setCameraStarted(true);
      // Kick off the first capture quickly so the user sees a tip within ~1s.
      // The video element typically reaches readyState 2 within ~300-500ms.
      setTimeout(() => { captureAndAnalyze(); }, 600);
      intervalRef.current = setInterval(captureAndAnalyze, SAMPLE_INTERVAL_MS);
    } catch (err) {
      const name = err?.name || '';
      let msg = 'Camera access denied — please allow camera access in your browser settings and click Enable Camera again.';
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        msg = 'No webcam was detected. Connect a camera and try again.';
      } else if (name === 'NotReadableError') {
        msg = 'Your webcam is already in use by another application.';
      }
      setCamError(msg);
      setCameraStarted(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parent flagged inactive → stop the camera.
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
  }));

  function _computeSummary(log) {
    if (!log.length) return null;

    // Score-averaged distribution (each frame contributes its full label
    // distribution, not just its argmax). Far more robust than counting
    // dominant labels — single misclassifications no longer skew the result.
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
    };
  }

  // =====================================================================
  // Render
  // =====================================================================
  const now = Date.now();

  return (
    <div className="w-full space-y-3">
      {/* Webcam frame */}
      <div className="relative w-full rounded-xl overflow-hidden bg-[#11152B] border border-purple-900/40">
        {/* Hidden canvas — used for HF capture only */}
        <canvas ref={canvasRef} className="hidden" />

        {httpsWarning && (
          <div className="px-3 py-2 text-xs text-amber-300 bg-amber-950/40 border-b border-amber-900/40">
            ⚠ Camera requires HTTPS in production. On localhost this should work — check browser permissions.
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
            <p className="text-sm text-[#FCA5A5]">{camError}</p>
            <button
              onClick={startCamera}
              className="text-xs px-3 py-1.5 rounded-md border border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
            >
              Try Again
            </button>
          </div>
        ) : !cameraStarted ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center gap-3">
            <p className="text-sm text-[#B3B3C7]">Enable your webcam for live expression coaching.</p>
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
            {!active && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                <span className="text-[#B3B3C7] text-sm">Camera paused</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tip queue — under the camera, NOT overlaid */}
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
            <span className="text-purple-300/80">Analysing your expression…</span>
          ) : hfError ? (
            <span className="text-amber-300/90">
              Hugging Face is warming up the model — first tip can take up to 20s. ({hfError})
            </span>
          ) : (
            <span className="text-white/40">Waiting for the first frame…</span>
          )}
        </div>
      )}
    </div>
  );
});

export default FaceExpressionOverlay;
