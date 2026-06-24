/**
 * FaceExpressionOverlay.jsx
 * ---------------------------------------------------------------
 * Live webcam → Hugging Face vit-face-expression (browser direct).
 *
 * Architecture: getUserMedia (only after user gesture) → <video> →
 * canvas snapshot every 3 s → fetch HF Inference API directly →
 * render top-1 emotion badge + summary on finalize().
 *
 * NO backend hop. NO local model. The HF token is the public
 * VITE_HF_API_TOKEN baked into the client bundle.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { hfInference, HFError } from '../services/hfClient';

const EXPRESSION_MODEL = 'trpakov/vit-face-expression';
const SAMPLE_INTERVAL_MS = 3000;
const NEGATIVE_EMOTIONS = new Set(['angry', 'disgust', 'fear', 'sad']);

const EMOTION_META = {
  happy:    { emoji: '😊', color: '#22c55e' },
  neutral:  { emoji: '😐', color: '#a855f7' },
  surprise: { emoji: '😲', color: '#f59e0b' },
  fear:     { emoji: '😨', color: '#ef4444' },
  sad:      { emoji: '😢', color: '#60a5fa' },
  angry:    { emoji: '😠', color: '#ef4444' },
  disgust:  { emoji: '🤢', color: '#f97316' },
};

function isInsecureContext() {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  if (protocol === 'https:') return false;
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

const FaceExpressionOverlay = forwardRef(function FaceExpressionOverlay({ active }, ref) {
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const streamRef     = useRef(null);
  const intervalRef   = useRef(null);
  const inFlightRef   = useRef(false);
  const emotionLogRef = useRef([]);

  const [liveEmotion,   setLiveEmotion]   = useState(null);
  const [camError,      setCamError]      = useState(null);
  const [updating,      setUpdating]      = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [httpsWarning]                    = useState(isInsecureContext());

  const stopAll = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
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
      const buf = await blob.arrayBuffer();
      const raw = await hfInference(EXPRESSION_MODEL, buf, 'image-classification');
      const list = Array.isArray(raw?.[0]) ? raw[0] : raw;
      if (Array.isArray(list) && list.length) {
        const top = list[0];
        setLiveEmotion(top);
        emotionLogRef.current.push(top);
      }
    } catch (err) {
      if (err instanceof HFError && err.status === 401) {
        setCamError('Hugging Face token missing or invalid. Set VITE_HF_API_TOKEN.');
        stopAll();
        setCameraStarted(false);
      }
      // otherwise: silent — never interrupt the interview
    } finally {
      inFlightRef.current = false;
      setUpdating(false);
    }
  }

  const startCamera = useCallback(async () => {
    setCamError(null);
    emotionLogRef.current = [];
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
        await videoRef.current.play().catch(() => { /* autoplay race — ignore */ });
      }
      setCameraStarted(true);
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

  // Stop the camera when the parent flags the session inactive.
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
      return computeSummary(emotionLogRef.current);
    },
  }));

  function computeSummary(log) {
    if (!log.length) return null;
    const counts = {};
    let negCount = 0;
    for (const { label } of log) {
      counts[label] = (counts[label] || 0) + 1;
      if (NEGATIVE_EMOTIONS.has(label)) negCount++;
    }
    const total    = log.length;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const distribution = {};
    for (const [label, count] of Object.entries(counts))
      distribution[label] = Math.round((count / total) * 100);
    return {
      dominant,
      dominantPct: distribution[dominant],
      negativePct: Math.round((negCount / total) * 100),
      totalFrames: total,
      distribution,
    };
  }

  const meta = liveEmotion ? (EMOTION_META[liveEmotion.label] || { emoji: '🙂', color: '#a855f7' }) : null;

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-[#11152B] border border-purple-900/40">
      <canvas ref={canvasRef} className="hidden" />

      {httpsWarning && (
        <div className="px-3 py-2 text-xs text-amber-300 bg-amber-950/40 border-b border-amber-900/40">
          ⚠ Camera requires HTTPS in production. On localhost this should work — check browser permissions.
        </div>
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
          <p className="text-sm text-[#B3B3C7]">Enable your webcam for live expression analysis.</p>
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
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-xl object-cover"
            style={{ transform: 'scaleX(-1)', maxHeight: '280px' }}
          />
          {liveEmotion && meta && (
            <div
              className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur-sm"
              style={{
                background: 'rgba(11,14,28,0.75)',
                border: `1px solid ${meta.color}55`,
                color: meta.color,
              }}
            >
              <span className="text-base leading-none">{meta.emoji}</span>
              <span className="capitalize">{liveEmotion.label}</span>
              <span className="text-xs opacity-70">{Math.round(liveEmotion.score * 100)}%</span>
            </div>
          )}
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
  );
});

export default FaceExpressionOverlay;
