/**
 * FaceExpressionOverlay.jsx
 * Samples webcam frames every 3 s, sends them to POST /analyze-expression,
 * shows a live emotion badge, and exposes ref.finalize() → EmotionSummary.
 *
 * EmotionSummary: { dominant, dominantPct, negativePct, totalFrames, distribution }
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const SAMPLE_INTERVAL_MS = 3000;
const NEGATIVE_EMOTIONS = new Set(["angry", "disgust", "fear", "sad"]);

const EMOTION_META = {
  happy:    { emoji: "😊", color: "#22c55e" },
  neutral:  { emoji: "😐", color: "#a855f7" },
  surprise: { emoji: "😲", color: "#f59e0b" },
  fear:     { emoji: "😨", color: "#ef4444" },
  sad:      { emoji: "😢", color: "#60a5fa" },
  angry:    { emoji: "😠", color: "#ef4444" },
  disgust:  { emoji: "🤢", color: "#f97316" },
};

const FaceExpressionOverlay = forwardRef(function FaceExpressionOverlay({ active }, ref) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const streamRef    = useRef(null);
  const intervalRef  = useRef(null);
  const emotionLogRef = useRef([]);

  const [liveEmotion, setLiveEmotion] = useState(null);
  const [camError,    setCamError]    = useState(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    if (!active) { stopAll(); return; }
    startCam();
    return () => stopAll();
  }, [active]);

  async function startCam() {
    emotionLogRef.current = [];
    setLiveEmotion(null);
    setLoading(false);
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startSampling();
    } catch {
      setCamError("Camera access denied. Expression analysis disabled.");
    }
  }

  function stopAll() {
    clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function startSampling() {
    intervalRef.current = setInterval(captureAndAnalyze, SAMPLE_INTERVAL_MS);
  }

  async function captureAndAnalyze() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/analyze-expression`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_b64: b64 }),
      });
      if (!res.ok) throw new Error("proxy error");
      const data = await res.json();
      const top  = data.emotions?.[0];
      if (top) { setLiveEmotion(top); emotionLogRef.current.push(top); }
    } catch { /* silent — never interrupt the interview */ }
    finally  { setLoading(false); }
  }

  useImperativeHandle(ref, () => ({
    finalize() {
      stopAll();
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
      dominantPct:  distribution[dominant],
      negativePct:  Math.round((negCount / total) * 100),
      totalFrames:  total,
      distribution,
    };
  }

  const meta = liveEmotion ? (EMOTION_META[liveEmotion.label] || { emoji: "🙂", color: "#a855f7" }) : null;

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-[#11152B] border border-purple-900/40">
      <canvas ref={canvasRef} className="hidden" />
      {camError ? (
        <div className="flex items-center justify-center h-48 text-sm text-[#B3B3C7] px-4 text-center">
          {camError}
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full rounded-xl object-cover"
            style={{ transform: "scaleX(-1)", maxHeight: "280px" }}
          />
          {liveEmotion && meta && (
            <div
              className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold backdrop-blur-sm"
              style={{ background: "rgba(11,14,28,0.75)", border: `1px solid ${meta.color}55`, color: meta.color }}
            >
              <span className="text-base leading-none">{meta.emoji}</span>
              <span className="capitalize">{liveEmotion.label}</span>
              <span className="text-xs opacity-70">{Math.round(liveEmotion.score * 100)}%</span>
            </div>
          )}
          {loading && (
            <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
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
