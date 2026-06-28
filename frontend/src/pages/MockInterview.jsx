/**
 * Mock Interview Practice — premium glass redesign
 *
 * Layout sections:
 *   TOP        Title · description · phase indicator · progress · history
 *   LEFT       Session controls · stats · tips · end-interview
 *   CENTER     Question card · answer input · recording · submit · feedback
 *   RIGHT      Live face/voice analysis · phase-aware AI insights
 *   RESULTS    Presence score · per-question journey · voice/expression coaching · final summary
 *
 * Functionality preserved 100% — only the layout, components, and styles change.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  StopCircle,
  Play,
  RotateCw,
  Send,
  Lightbulb,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Award,
  History,
  Brain,
  Camera,
  ChevronRight,
  Star,
  Quote,
  Target,
  Gauge,
  Sparkles,
  ArrowLeft,
  ListChecks,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import ReasoningCard from '../components/ReasoningCard';
import { buildEnvelope } from '../utils/explainability';
import FaceExpressionOverlay, { getExpressionCoaching } from '../components/FaceExpressionOverlay';
import API_URL from '../config';
import {
  GlassCard,
  PageContainer,
  ActionButton,
  IconButton,
  StatusBadge,
  Dialog,
  ProgressBar,
  EmptyState,
  LoadingSkeleton,
} from '../components/ui';

/* ==========================================================================
   Pure helpers — preserved from original implementation, behaviour unchanged
   ========================================================================== */

// ── Voice coaching ──
function getVoiceCoaching(wpm, fillerCount, pauseSeconds) {
  const coaching = [];

  // WPM
  if (wpm < 80) {
    coaching.push({ icon: '🐢', priority: 'high', metric: 'Speaking Rate', current: `${wpm} WPM`, target: '110–160 WPM',
      tip: `You are speaking too slowly at ${wpm} WPM. Increase your pace — slow speech can signal low confidence to interviewers.` });
  } else if (wpm < 110) {
    coaching.push({ icon: '🚶', priority: 'medium', metric: 'Speaking Rate', current: `${wpm} WPM`, target: '110–160 WPM',
      tip: `Your pace at ${wpm} WPM is slightly slow. Aim for 110–160 WPM to sound more energetic and confident.` });
  } else if (wpm > 180) {
    coaching.push({ icon: '🏃', priority: 'high', metric: 'Speaking Rate', current: `${wpm} WPM`, target: '110–160 WPM',
      tip: `You are speaking too fast at ${wpm} WPM. Slow down so the interviewer can absorb your answer clearly.` });
  } else if (wpm > 160) {
    coaching.push({ icon: '💨', priority: 'medium', metric: 'Speaking Rate', current: `${wpm} WPM`, target: '110–160 WPM',
      tip: `Your pace at ${wpm} WPM is slightly fast. Take brief pauses between points to let your answer land.` });
  } else {
    coaching.push({ icon: '✅', priority: 'good', metric: 'Speaking Rate', current: `${wpm} WPM`, target: '110–160 WPM',
      tip: `Great speaking pace at ${wpm} WPM — clear and confident.` });
  }

  // Filler
  if (fillerCount > 8) {
    coaching.push({ icon: '🗣', priority: 'high', metric: 'Filler Words', current: `${fillerCount} fillers`, target: '3 or fewer',
      tip: `You used ${fillerCount} filler words (um, uh, like, basically). Replace them with a 1-second pause — silence sounds far more confident than fillers.` });
  } else if (fillerCount > 3) {
    coaching.push({ icon: '🤔', priority: 'medium', metric: 'Filler Words', current: `${fillerCount} fillers`, target: '3 or fewer',
      tip: `${fillerCount} filler words detected. Practice pausing silently instead of saying "um" or "uh" while you think.` });
  } else {
    coaching.push({ icon: '✨', priority: 'good', metric: 'Filler Words', current: `${fillerCount} fillers`, target: '3 or fewer',
      tip: `Excellent — only ${fillerCount} filler words. Clean, professional speech.` });
  }

  // Pause
  if (pauseSeconds > 10) {
    coaching.push({ icon: '⏸', priority: 'high', metric: 'Pause Time', current: `${pauseSeconds}s paused`, target: 'Under 6s total',
      tip: `${pauseSeconds}s of silence detected. Long pauses suggest uncertainty. Structure your answer using STAR method before speaking.` });
  } else if (pauseSeconds > 6) {
    coaching.push({ icon: '⏳', priority: 'medium', metric: 'Pause Time', current: `${pauseSeconds}s paused`, target: 'Under 6s total',
      tip: `${pauseSeconds}s of pausing. Slightly high — brief pauses are fine but try to answer more fluidly.` });
  } else {
    coaching.push({ icon: '🎯', priority: 'good', metric: 'Pause Time', current: `${pauseSeconds}s paused`, target: 'Under 6s total',
      tip: `Good flow — only ${pauseSeconds}s of total pausing.` });
  }

  return coaching;
}

// ── Per-question trends ──
function computePerQuestionTrend(emotionLog, totalQuestions) {
  if (!emotionLog || emotionLog.length === 0) return [];
  const NEGATIVE = new Set(['fear', 'sad', 'angry', 'disgust']);
  const POSITIVE = new Set(['happy']);
  const byQuestion = {};
  for (const entry of emotionLog) {
    const q = entry.questionIndex ?? 0;
    if (!byQuestion[q]) byQuestion[q] = [];
    byQuestion[q].push(entry);
  }
  const trends = [];
  for (let i = 0; i < totalQuestions; i++) {
    const frames = byQuestion[i] || [];
    if (frames.length === 0) { trends.push(null); continue; }
    const total = frames.length;
    const negCount = frames.filter((f) => NEGATIVE.has(f.label)).length;
    const posCount = frames.filter((f) => POSITIVE.has(f.label)).length;
    const negPct = Math.round((negCount / total) * 100);
    const posPct = Math.round((posCount / total) * 100);
    const freq = {};
    for (const f of frames) freq[f.label] = (freq[f.label] || 0) + 1;
    const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    let narrative = '';
    if (negPct >= 40)
      narrative = `High stress detected (${negPct}% tense expressions) — this topic challenged your composure. Practice it until your face matches your knowledge level.`;
    else if (negPct >= 20)
      narrative = `Some tension detected (${negPct}% negative expressions) — mostly composed with occasional nerves showing through. Good recovery overall.`;
    else if (posPct >= 50)
      narrative = `Strong confident delivery — positive and engaged throughout (${posPct}% confident expressions). This is your best answer in terms of presence.`;
    else
      narrative = 'Composed and steady delivery — good consistent emotional control maintained across this entire answer.';
    trends.push({ questionIndex: i, dominant, negPct, posPct, narrative, frameCount: total });
  }
  return trends;
}

// ── Presence score ──
function computePresenceScore(summary, questionTrends) {
  if (!summary) return null;
  const { negativePct = 0, distribution = {} } = summary;
  const happyPct = distribution.happy || 0;
  const neutralPct = distribution.neutral || 0;
  const confidenceScore = Math.min(100, Math.round(happyPct + neutralPct * 0.6));
  const composureScore = Math.min(100, Math.max(0, Math.round(100 - negativePct * 2.2)));
  const flatnessPenalty = neutralPct > 85 ? (neutralPct - 85) * 1.5 : 0;
  const engagementScore = Math.min(100, Math.max(0, Math.round(100 - flatnessPenalty + happyPct * 0.3)));
  let trendBonus = 0;
  if (questionTrends && questionTrends.length >= 3) {
    const valid = questionTrends.filter(Boolean);
    if (valid.length >= 3) {
      const third = Math.max(1, Math.floor(valid.length / 3));
      const firstThird = valid.slice(0, third);
      const lastThird = valid.slice(-third);
      const avgFirst = firstThird.reduce((a, b) => a + b.negPct, 0) / firstThird.length;
      const avgLast = lastThird.reduce((a, b) => a + b.negPct, 0) / lastThird.length;
      trendBonus = Math.round((avgFirst - avgLast) * 0.5);
    }
  }
  const presenceScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        0.35 * confidenceScore +
          0.30 * composureScore +
          0.20 * engagementScore +
          0.15 * (50 + trendBonus),
      ),
    ),
  );
  return {
    presenceScore,
    confidenceScore,
    composureScore,
    engagementScore,
    trendBonus,
    grade:
      presenceScore >= 85 ? 'Excellent' :
      presenceScore >= 70 ? 'Good' :
      presenceScore >= 55 ? 'Developing' : 'Needs Work',
  };
}

// ── Overall coaching summary ──
function getOverallCoachingSummary(wpm, fillerCount, pauseSeconds, emotions) {
  const issues = [];
  const strengths = [];

  if (wpm < 110) issues.push('Increase speaking speed to 110–160 WPM');
  if (wpm > 160) issues.push('Slow down your speaking pace');
  if (fillerCount > 3) issues.push(`Reduce filler words — used ${fillerCount}`);
  if (pauseSeconds > 6) issues.push('Minimize long pauses between sentences');

  if (emotions) {
    const negPct = (emotions.sad || 0) + (emotions.fear || 0) + (emotions.angry || 0);
    if (negPct > 50) issues.push('Work on maintaining a calm confident expression');
    if ((emotions.fear || 0) > 25) issues.push('Practice to reduce visible nervousness');
    if ((emotions.happy || 0) > 30) strengths.push('Good positive energy in your expression');
  }

  if (wpm >= 110 && wpm <= 160) strengths.push('Speaking pace is perfect');
  if (fillerCount <= 3) strengths.push('Clean speech with minimal filler words');
  if (pauseSeconds <= 6) strengths.push('Good answer fluency with minimal pausing');

  let score = 100;
  if (wpm < 80 || wpm > 180) score -= 25;
  else if (wpm < 110 || wpm > 160) score -= 10;
  if (fillerCount > 8) score -= 20;
  else if (fillerCount > 3) score -= 10;
  if (pauseSeconds > 10) score -= 20;
  else if (pauseSeconds > 6) score -= 10;
  if (emotions) {
    const negPct = (emotions.sad || 0) + (emotions.fear || 0) + (emotions.angry || 0);
    if (negPct > 60) score -= 25;
    else if (negPct > 40) score -= 10;
  }
  score = Math.max(0, Math.min(100, score));

  let grade = '';
  let gradeColor = '';
  if (score >= 80) { grade = 'Excellent'; gradeColor = 'text-success'; }
  else if (score >= 60) { grade = 'Good'; gradeColor = 'text-primary-light'; }
  else if (score >= 40) { grade = 'Needs Work'; gradeColor = 'text-warning'; }
  else { grade = 'Keep Practicing'; gradeColor = 'text-error'; }

  return { score, grade, gradeColor, issues, strengths };
}

function generateSessionId() {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const JOB_ROLES = [
  { value: 'frontend', label: 'Frontend Developer', icon: '🎨' },
  { value: 'backend', label: 'Backend Developer', icon: '⚙️' },
  { value: 'fullstack', label: 'Full Stack Developer', icon: '🧩' },
  { value: 'data-science', label: 'Data Scientist', icon: '📊' },
  { value: 'mobile', label: 'Mobile Developer', icon: '📱' },
  { value: 'devops', label: 'DevOps Engineer', icon: '🛠️' },
  { value: 'ui-ux', label: 'UI/UX Designer', icon: '✏️' },
  { value: 'product-manager', label: 'Product Manager', icon: '🎯' },
];

const DIFFICULTY_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'Basic concepts and fundamentals', tone: 'success' },
  { value: 'intermediate', label: 'Intermediate', description: 'Practical experience questions', tone: 'warning' },
  { value: 'advanced', label: 'Advanced', description: 'Complex scenarios and system design', tone: 'error' },
];

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'literally'];

/* ==========================================================================
   Component
   ========================================================================== */

const MockInterview = () => {
  const { currentUser } = useAuth();

  // ── State (identical to original) ────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [interviewHistory, setInterviewHistory] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionAnswers, setSessionAnswers] = useState([]);
  const [sessionFeedbacks, setSessionFeedbacks] = useState([]);
  const [interviewProfile, setInterviewProfile] = useState(null);
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const sessionIdRef = useRef(sessionId);
  const [skillsTested, setSkillsTested] = useState([]);
  const [conceptsCovered, setConceptsCovered] = useState([]);
  const [conceptsMissing, setConceptsMissing] = useState([]);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [coveragePct, setCoveragePct] = useState(null);
  const [missingConceptsFeedback, setMissingConceptsFeedback] = useState('');

  const [voiceSupported, setVoiceSupported] = useState(true);
  const [metricsEnvelope, setMetricsEnvelope] = useState(null);
  const recognitionRef = useRef(null);
  const speechStartRef = useRef(null);
  const speechEndRef = useRef(null);
  const lastResultTimeRef = useRef(null);
  const pauseAccumRef = useRef(0);
  const faceOverlayRef = useRef(null);
  const [emotionSummary, setEmotionSummary] = useState(null);

  const [voiceCoaching, setVoiceCoaching] = useState([]);
  const [expressionCoaching, setExpressionCoaching] = useState([]);
  const [coachingSummary, setCoachingSummary] = useState(null);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const liveEmotionsRef = useRef(null);
  const [questionTrends, setQuestionTrends] = useState([]);
  const [presenceData, setPresenceData] = useState(null);
  const [interviewPhase, setInterviewPhase] = useState('idle');
  void interviewPhase; // intentionally tracked but not rendered
  const currentQuestionIndexRef = useRef(0);

  // ── Detect SpeechRecognition support once on mount ────────────────────────
  useEffect(() => {
    const SR = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setVoiceSupported(!!SR);
  }, []);

  // ── Compute overall coaching summary when interview ends ──────────────────
  useEffect(() => {
    if (!interviewEnded) return;
    const wpmFactor = metricsEnvelope?.factors?.find((f) => f.label?.includes('Speaking rate'));
    const fillerFactor = metricsEnvelope?.factors?.find((f) => f.label?.includes('Filler words'));
    const pauseFactor = metricsEnvelope?.factors?.find((f) => f.label?.includes('pause time'));
    const wpm = wpmFactor?.value ?? 0;
    const fillers = fillerFactor?.value ?? 0;
    const pauseSecs = pauseFactor?.value ?? 0;
    const emotions = liveEmotionsRef.current;
    setCoachingSummary(getOverallCoachingSummary(wpm, fillers, pauseSecs, emotions));
  }, [interviewEnded, metricsEnvelope]);

  // ── Load history ──────────────────────────────────────────────────────────
  const loadInterviewHistory = useCallback(async () => {
    try {
      const historyRef = collection(db, 'interviewHistory');
      const q = query(
        historyRef,
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
      }));
      setInterviewHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && showHistory) loadInterviewHistory();
  }, [currentUser, showHistory, loadInterviewHistory]);

  // ── Generate question ─────────────────────────────────────────────────────
  const generateQuestion = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = API_URL.replace(/\/+$/, '');
      const res = await fetch(`${apiUrl}/interview/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          difficulty,
          questionNumber: questionNumber + 1,
          sessionId: sessionIdRef.current || sessionId,
          previousQuestions: sessionQuestions,
          profile: interviewProfile || {},
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Question request failed (${res.status})`);
      }
      const data = await res.json();
      const question = data.question;
      if (!question) throw new Error('Empty question returned from model');
      setCurrentQuestion(question);
      setSkillsTested(Array.isArray(data.skills_tested) ? data.skills_tested : []);
      setSessionQuestions((prev) => [...prev, question]);
      toast.success('New question generated!');
    } catch (error) {
      console.error('Error generating question:', error);
      toast.error('Failed to generate question. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, difficulty, questionNumber, sessionQuestions, interviewProfile, sessionId]);

  // ── Evaluate answer ───────────────────────────────────────────────────────
  const computeMetricsEnvelope = useCallback((transcript) => {
    const text = (transcript || '').trim();
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean);
    const durationMs = (speechEndRef.current || Date.now()) - (speechStartRef.current || Date.now());
    const minutes = Math.max(durationMs / 60000, 1 / 60);
    const wpm = Math.round(words.length / minutes);

    const lower = ` ${text.toLowerCase()} `;
    let fillers = 0;
    FILLER_WORDS.forEach((f) => {
      const re = new RegExp(`\\b${f.replace(/ /g, '\\s+')}\\b`, 'g');
      const m = lower.match(re);
      if (m) fillers += m.length;
    });
    const pauseSecs = Math.round((pauseAccumRef.current || 0) / 100) / 10;

    const factors = [
      { label: `Speaking rate: ${wpm} WPM (interview_metric)`, positive: wpm >= 110 && wpm <= 160, signal_type: 'interview_metric', value: wpm },
      { label: `Filler words used: ${fillers} (interview_metric)`, positive: fillers <= 3, signal_type: 'interview_metric', value: fillers },
      { label: `Total pause time: ${pauseSecs}s (interview_metric)`, positive: pauseSecs <= 6, signal_type: 'interview_metric', value: pauseSecs },
    ];

    return buildEnvelope(
      `${words.length} words spoken`,
      factors,
      `Voice analysis · ${Math.round(durationMs / 1000)}s recorded`,
    );
  }, []);

  const evaluateAnswer = useCallback(async () => {
    if (!userAnswer.trim()) {
      toast.error('Please provide an answer');
      return;
    }
    setInterviewPhase('transition');
    setLoading(true);
    try {
      const apiUrl = API_URL.replace(/\/+$/, '');
      const curQTrend = (questionTrends && questionTrends[questionNumber]) || null;
      const res = await fetch(`${apiUrl}/interview/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          answer: userAnswer,
          role: selectedRole,
          difficulty,
          sessionId: sessionIdRef.current,
          questionNumber: questionNumber + 1,
          profile: interviewProfile || {},
          emotionSummary: emotionSummary
            ? {
                dominantEmotion: emotionSummary.dominant,
                negativePct: emotionSummary.negativePct,
                dominantPct: emotionSummary.dominantPct,
                totalFrames: emotionSummary.totalFrames,
              }
            : null,
          presenceScore: presenceData?.presenceScore ?? null,
          dominantEmotion: emotionSummary?.dominant ?? null,
          negativePct: emotionSummary?.negativePct ?? null,
          currentQuestionEmotion: curQTrend,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Evaluate request failed (${res.status})`);
      }
      const data = await res.json();
      setFeedback(data);
      setConceptsCovered(Array.isArray(data.concepts_covered) ? data.concepts_covered : []);
      setConceptsMissing(Array.isArray(data.concepts_missing) ? data.concepts_missing : []);
      setScoreBreakdown(data.score_breakdown || null);
      setCoveragePct(typeof data.coverage_pct === 'number' ? data.coverage_pct : null);
      setMissingConceptsFeedback(data.missingConceptsFeedback || '');

      try {
        const env = computeMetricsEnvelope(userAnswer);
        setMetricsEnvelope(env);
        if (env && env.factors) {
          const wpmFactor = env.factors.find((f) => f.label && f.label.includes('Speaking rate'));
          const fillerFactor = env.factors.find((f) => f.label && f.label.includes('Filler words'));
          const pauseFactor = env.factors.find((f) => f.label && f.label.includes('pause time'));
          const wpm = wpmFactor?.value ?? 0;
          const fillers = fillerFactor?.value ?? 0;
          const pauseSecs = pauseFactor?.value ?? 0;
          setVoiceCoaching(getVoiceCoaching(wpm, fillers, pauseSecs));
        }
      } catch {
        setMetricsEnvelope(null);
      }

      setSessionScore((prev) => prev + (data.score || 0));
      setSessionAnswers((prev) => [
        ...prev,
        {
          question: currentQuestion,
          answer: userAnswer,
          score: data.score,
          feedback: data.feedback,
          strengths: data.strengths,
          improvements: data.improvements,
          timestamp: new Date().toISOString(),
        },
      ]);
      setSessionFeedbacks((prev) => [...prev, data]);

      toast.success('Answer evaluated!');
    } catch (error) {
      console.error('Error evaluating answer:', error);
      toast.error('Failed to evaluate answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    userAnswer,
    currentQuestion,
    selectedRole,
    difficulty,
    interviewProfile,
    questionNumber,
    questionTrends,
    emotionSummary,
    presenceData,
    computeMetricsEnvelope,
  ]);

  // ── Start / Next / End ────────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    if (!selectedRole) {
      toast.error('Please select a job role');
      return;
    }
    setInterviewStarted(true);
    setQuestionNumber(0);
    setSessionQuestions([]);
    setSessionScore(0);
    setSessionAnswers([]);
    setSessionFeedbacks([]);
    const newSessionId = generateSessionId();
    sessionIdRef.current = newSessionId;
    setSessionId(newSessionId);
    setEmotionSummary(null);
    setMetricsEnvelope(null);
    setSkillsTested([]);
    setConceptsCovered([]);
    setConceptsMissing([]);
    setScoreBreakdown(null);
    setCoveragePct(null);
    setMissingConceptsFeedback('');
    setVoiceCoaching([]);
    setExpressionCoaching([]);
    setCoachingSummary(null);
    setInterviewEnded(false);
    liveEmotionsRef.current = null;
    setQuestionTrends([]);
    setPresenceData(null);
    currentQuestionIndexRef.current = 0;
    setInterviewPhase('listening');

    if (currentUser?.uid) {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) setInterviewProfile(snap.data());
      } catch (err) {
        console.warn('Profile fetch failed:', err?.message || err);
      }
    }

    generateQuestion();
  }, [selectedRole, currentUser, generateQuestion]);

  const nextQuestion = useCallback(() => {
    setQuestionNumber((prev) => {
      const next = prev + 1;
      currentQuestionIndexRef.current = next;
      return next;
    });
    setUserAnswer('');
    setFeedback(null);
    setSkillsTested([]);
    setConceptsCovered([]);
    setConceptsMissing([]);
    setScoreBreakdown(null);
    setCoveragePct(null);
    setMissingConceptsFeedback('');
    setInterviewPhase('listening');
    generateQuestion();
  }, [generateQuestion]);

  const endInterview = useCallback(async () => {
    const summary = faceOverlayRef.current?.finalize();
    if (summary) {
      setEmotionSummary(summary);
      const coaching = getExpressionCoaching(summary.distribution);
      setExpressionCoaching(coaching);
      liveEmotionsRef.current = summary.distribution;
      const log = summary.rawLog || [];
      const totalForTrend = Math.max(questionNumber + 1, 1);
      const trends = computePerQuestionTrend(log, totalForTrend);
      setQuestionTrends(trends);
      setPresenceData(computePresenceScore(summary, trends));
    }
    setInterviewPhase('idle');
    try {
      const totalQuestions = questionNumber + 1;
      const avgScore = sessionScore / Math.max(totalQuestions, 1);

      const sessionData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        role: selectedRole,
        difficulty,
        questionsAsked: totalQuestions,
        averageScore: avgScore,
        totalScore: sessionScore,
        questionsAndAnswers: sessionAnswers,
        sessionDuration: null,
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        scores: sessionFeedbacks.map((f) => f.score),
        summary: {
          totalQuestions,
          averageScore: parseFloat(avgScore.toFixed(2)),
          highestScore: Math.max(...sessionFeedbacks.map((f) => f.score || 0)),
          lowestScore: Math.min(...sessionFeedbacks.map((f) => f.score || 10)),
          passRate: ((sessionFeedbacks.filter((f) => f.score >= 6).length / totalQuestions) * 100).toFixed(1),
        },
      };

      const docRef = await addDoc(collection(db, 'interviewHistory'), sessionData);
      console.log('Interview session saved with ID:', docRef.id);
      toast.success(`Interview completed! Average score: ${avgScore.toFixed(1)}/10`);

      setInterviewStarted(false);
      setInterviewEnded(true);
      setCurrentQuestion(null);
      setUserAnswer('');
      setFeedback(null);
      setSessionAnswers([]);
      setSessionFeedbacks([]);
    } catch (error) {
      console.error('Error saving interview:', error);
      toast.error('Failed to save interview results');
    }
  }, [
    currentUser,
    selectedRole,
    difficulty,
    questionNumber,
    sessionScore,
    sessionAnswers,
    sessionFeedbacks,
  ]);

  // ── Voice recording ───────────────────────────────────────────────────────
  const toggleRecording = useCallback(() => {
    const SR = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setVoiceSupported(false);
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      speechStartRef.current = Date.now();
      speechEndRef.current = null;
      lastResultTimeRef.current = Date.now();
      pauseAccumRef.current = 0;
      let finalText = userAnswer ? `${userAnswer} ` : '';

      rec.onresult = (event) => {
        const now = Date.now();
        const gap = now - (lastResultTimeRef.current || now);
        if (gap > 1200) pauseAccumRef.current += gap;
        lastResultTimeRef.current = now;

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += `${r[0].transcript} `;
          else interim += `${r[0].transcript} `;
        }
        setUserAnswer((finalText + interim).trim());
      };

      rec.onerror = (e) => {
        if (e && e.error === 'not-allowed') {
          toast.error('Microphone permission denied — you can still type your answer.');
          setVoiceSupported(false);
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        speechEndRef.current = Date.now();
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
      setIsRecording(true);
      setInterviewPhase('answering');
      toast.success('Listening… speak your answer');
    } catch {
      setVoiceSupported(false);
      setIsRecording(false);
    }
  }, [isRecording, userAnswer]);

  // ── Derived UI helpers ────────────────────────────────────────────────────
  const sessionStats = useMemo(() => {
    const scores = sessionFeedbacks.map((f) => f?.score || 0).filter((s) => s > 0);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0.0';
    const best = scores.length ? Math.max(...scores).toFixed(1) : '0.0';
    return { avg, best, answered: scores.length };
  }, [sessionFeedbacks]);

  const phaseLabel = interviewEnded
    ? 'Results'
    : interviewStarted
      ? 'In Progress'
      : 'Setup';

  const roleLabel = JOB_ROLES.find((r) => r.value === selectedRole)?.label || 'Not selected';

  // ── Guarded render ────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <PageContainer>
        <EmptyState
          icon={AlertCircle}
          title="Authentication required"
          description="Please log in to practice interviews with AI-powered feedback."
        />
      </PageContainer>
    );
  }

  /* ====================== TOP / HEADER ====================== */
  const Header = (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-2 flex items-center gap-2">
            <Sparkles size={12} /> AI Mock Interview
          </p>
          <h1 className="text-h1 font-bold text-text-main">Interview Practice Studio</h1>
          <p className="mt-2 text-text-muted max-w-2xl">
            Role-specific questions, real-time voice & expression coaching, and AI-evaluated feedback so you walk into every interview with confidence.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge tone={interviewStarted ? 'primary' : interviewEnded ? 'success' : 'default'} pulse={interviewStarted}>
            {phaseLabel}
          </StatusBadge>
          <ActionButton variant="secondary" icon={History} onClick={() => setShowHistory(true)}>
            History
          </ActionButton>
          {interviewStarted && (
            <ActionButton variant="danger" icon={StopCircle} onClick={endInterview}>
              End Interview
            </ActionButton>
          )}
        </div>
      </div>

      {interviewStarted && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="glass-card p-4 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/14 text-primary-light ring-1 ring-primary/30">
              <Target size={18} />
            </span>
            <div>
              <p className="text-xs text-text-muted">Role</p>
              <p className="text-sm font-semibold text-text-main truncate">{roleLabel}</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-info/14 text-info ring-1 ring-info/30">
              <Gauge size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">Question</p>
              <p className="text-sm font-semibold text-text-main">
                {questionNumber + 1}
                <span className="text-text-muted font-normal"> · answered {sessionStats.answered}</span>
              </p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-success/14 text-success ring-1 ring-success/30">
              <TrendingUp size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">Avg score</p>
              <p className="text-sm font-semibold text-text-main">
                {sessionStats.avg}<span className="text-text-muted font-normal">/10</span>
                <span className="text-text-muted font-normal"> · best {sessionStats.best}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.header>
  );

  /* ====================== SETUP SCREEN ====================== */
  const SetupScreen = (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Role */}
      <GlassCard padding="lg" className="lg:col-span-3" animate>
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-text-main">Select job role</h2>
          <p className="text-sm text-text-muted">Tailors the question difficulty and topics.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {JOB_ROLES.map((role) => {
            const selected = selectedRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value)}
                className={[
                  'group rounded-2xl p-4 text-left transition-all border',
                  selected
                    ? 'border-primary/50 bg-primary/12 ring-1 ring-primary/30'
                    : 'border-glass-border/12 bg-glass-surface/5 hover:border-primary/40 hover:bg-primary/8',
                ].join(' ')}
                aria-pressed={selected}
              >
                <div className="text-2xl mb-2">{role.icon}</div>
                <div className="text-sm font-semibold text-text-main">{role.label}</div>
                {selected && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary-light">
                    <CheckCircle2 size={12} /> Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Difficulty + start */}
      <GlassCard padding="lg" className="lg:col-span-2" animate>
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-text-main">Select difficulty</h2>
          <p className="text-sm text-text-muted">How challenging should the questions be?</p>
        </div>
        <div className="space-y-2.5">
          {DIFFICULTY_LEVELS.map((level) => {
            const selected = difficulty === level.value;
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => setDifficulty(level.value)}
                className={[
                  'w-full rounded-2xl p-4 text-left transition-all border flex items-start gap-3',
                  selected
                    ? 'border-primary/50 bg-primary/12 ring-1 ring-primary/30'
                    : 'border-glass-border/12 bg-glass-surface/5 hover:border-primary/40',
                ].join(' ')}
                aria-pressed={selected}
              >
                <StatusBadge tone={level.tone} dot>
                  {level.label}
                </StatusBadge>
                <p className="text-sm text-text-muted">{level.description}</p>
              </button>
            );
          })}
        </div>

        <ActionButton
          variant="primary"
          icon={Play}
          size="lg"
          fullWidth
          disabled={!selectedRole}
          onClick={startInterview}
          className="mt-6"
        >
          Start Interview
        </ActionButton>
        {!selectedRole && (
          <p className="text-xs text-text-subtle mt-2 text-center">Pick a role to enable the start button.</p>
        )}
      </GlassCard>

      {/* Features / What to expect */}
      <GlassCard padding="lg" className="lg:col-span-5" animate>
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-text-main">What to expect</h2>
          <p className="text-sm text-text-muted">Every interview comes with multimodal coaching, not just a score.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: MessageSquare, title: 'AI-generated questions', desc: 'Role-specific questions powered by Hugging Face Llama.' },
            { icon: TrendingUp, title: 'Real-time feedback', desc: 'Instant per-answer evaluation with concept coverage.' },
            { icon: Award, title: 'Track progress', desc: 'Session history with averages, best scores, and trends.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-start gap-3 p-4 rounded-2xl bg-glass-surface/5 ring-1 ring-glass-border/10">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/14 text-primary-light ring-1 ring-primary/30 flex-shrink-0">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-main">{item.title}</p>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );

  /* ====================== ACTIVE INTERVIEW ====================== */
  const ActiveInterview = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: session controls */}
      <motion.aside
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="lg:col-span-3 space-y-4"
      >
        <GlassCard padding="md" animate={false}>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/14 text-primary-light ring-1 ring-primary/30">
              <Brain size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Mock Interview</p>
              <p className="text-sm font-semibold text-text-main truncate">{roleLabel}</p>
            </div>
          </div>
          <StatusBadge tone={DIFFICULTY_LEVELS.find((d) => d.value === difficulty)?.tone || 'default'}>
            {difficulty}
          </StatusBadge>
        </GlassCard>

        <GlassCard padding="md" animate={false}>
          <p className="text-[10px] uppercase tracking-widest text-text-subtle mb-3">Difficulty</p>
          <div className="grid grid-cols-3 gap-1.5">
            {DIFFICULTY_LEVELS.map((level) => {
              const sel = difficulty === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setDifficulty(level.value)}
                  className={[
                    'px-2 py-1.5 text-[11px] font-medium rounded-full transition-all',
                    sel
                      ? 'bg-primary text-white shadow-glass-glow'
                      : 'bg-glass-surface/5 text-text-muted hover:bg-primary/10 hover:text-text-main ring-1 ring-glass-border/15',
                  ].join(' ')}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard padding="md" animate={false} className="space-y-3">
          <ActionButton
            variant="secondary"
            size="sm"
            icon={RotateCw}
            fullWidth
            disabled={loading || feedback != null}
            onClick={generateQuestion}
          >
            New Question
          </ActionButton>
          <p className="text-xs text-text-subtle text-center">
            Question {questionNumber + 1}
          </p>
        </GlassCard>

        <div className="space-y-2">
          {[
            { label: 'Avg Score', value: `${sessionStats.avg}/10`, Icon: TrendingUp },
            { label: 'Answered', value: sessionStats.answered, Icon: MessageSquare },
            { label: 'Best Score', value: `${sessionStats.best}/10`, Icon: Star },
          ].map((c) => (
            <div
              key={c.label}
              className="glass-card p-3.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/12 text-primary-light flex-shrink-0">
                  <c.Icon size={14} />
                </span>
                <p className="text-xs text-text-muted truncate">{c.label}</p>
              </div>
              <p className="text-base font-bold text-primary-light tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>

        <GlassCard padding="md" animate={false}>
          <h4 className="text-sm font-semibold text-text-main flex items-center gap-2 mb-2">
            <Lightbulb size={14} className="text-primary-light" />
            Interview tips
          </h4>
          <ul className="space-y-1.5 text-xs text-text-muted">
            <li>• Pause before answering to gather thoughts</li>
            <li>• Use specific examples from your experience</li>
            <li>• Structure with STAR (Situation, Task, Action, Result)</li>
            <li>• Be honest about gaps; show how you&apos;d close them</li>
            <li>• Ask clarifying questions when needed</li>
          </ul>
        </GlassCard>

        <ActionButton
          variant="danger"
          icon={StopCircle}
          fullWidth
          onClick={endInterview}
        >
          End Interview
        </ActionButton>
      </motion.aside>

      {/* CENTER: question + answer + feedback */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="lg:col-span-6 space-y-5"
      >
        {/* Question card */}
        <motion.div
          key={questionNumber}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-card relative overflow-hidden p-6"
        >
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary-light to-accent-pink"
          />
          <p className="eyebrow mb-3">Question {questionNumber + 1}</p>
          {loading && !currentQuestion ? (
            <div className="space-y-3 min-h-[88px]">
              <LoadingSkeleton className="h-5 w-3/4" />
              <LoadingSkeleton className="h-5 w-full" />
              <LoadingSkeleton className="h-5 w-2/3" />
            </div>
          ) : (
            <h3 className="text-lg sm:text-xl font-medium text-text-main min-h-[80px] leading-relaxed pr-24">
              {currentQuestion || 'Click "New Question" to begin.'}
            </h3>
          )}
          {skillsTested.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 pr-20">
              {skillsTested.map((skill) => (
                <span key={skill} className="badge badge-primary">{skill}</span>
              ))}
            </div>
          )}
          <span className="absolute bottom-3 right-4 text-[10px] uppercase tracking-wider text-text-subtle">
            {difficulty}
          </span>
        </motion.div>

        {/* Answer area */}
        <GlassCard padding="lg" animate={false} className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-text-main flex items-center gap-2">
              <MessageSquare size={14} className="text-primary-light" />
              Your answer
            </p>
            <div className="flex items-center gap-2">
              {isRecording && (
                <StatusBadge tone="error" pulse>
                  Recording
                </StatusBadge>
              )}
              {voiceSupported && (
                <ActionButton
                  variant={isRecording ? 'danger' : 'secondary'}
                  size="sm"
                  icon={isRecording ? StopCircle : Mic}
                  onClick={toggleRecording}
                >
                  {isRecording ? 'Stop' : 'Record'}
                </ActionButton>
              )}
            </div>
          </div>
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Type your answer here, or use the mic to dictate…"
            disabled={loading}
            rows={6}
            className="input-field min-h-[160px] resize-y"
            aria-label="Answer to the current question"
          />
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {feedback && (
              <ActionButton variant="secondary" iconRight={ChevronRight} onClick={nextQuestion}>
                Next Question
              </ActionButton>
            )}
            <ActionButton
              variant="primary"
              icon={Send}
              loading={loading}
              disabled={loading || !userAnswer.trim()}
              onClick={evaluateAnswer}
            >
              {loading ? 'Evaluating…' : 'Submit Answer'}
            </ActionButton>
          </div>
        </GlassCard>

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="glass-card p-6 space-y-5"
            >
              {/* Score ring + summary */}
              <div className="flex items-center gap-6 flex-wrap sm:flex-nowrap">
                {(() => {
                  const pct = Math.max(0, Math.min(100, Math.round((feedback.score || 0) * 10)));
                  const R = 42;
                  const C = 2 * Math.PI * R;
                  return (
                    <div className="relative w-28 h-28 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(var(--c-glass-surface) / 0.08)" strokeWidth="8" />
                        <motion.circle
                          cx="50" cy="50" r={R}
                          fill="none" stroke="rgb(var(--c-primary))" strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={C}
                          initial={{ strokeDashoffset: C }}
                          animate={{ strokeDashoffset: C * (1 - pct / 100) }}
                          transition={{ duration: 1.1, ease: 'easeOut' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-text-main leading-none tabular-nums">{pct}</span>
                        <span className="text-[10px] text-text-subtle mt-1">/100</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <p className="eyebrow mb-2">AI Evaluation</p>
                  <p className="text-sm text-text-main leading-relaxed">{feedback.feedback}</p>
                  {feedback.expression_feedback && (
                    <div className="mt-3 glass-card p-3 ring-1 ring-primary/25 bg-primary/8">
                      <p className="text-xs font-semibold text-primary-light mb-1">Expression insight</p>
                      <p className="text-sm text-text-muted leading-relaxed">{feedback.expression_feedback}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Strengths / improvements */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-glass-border/15">
                <div>
                  <p className="text-xs font-semibold text-success uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Strengths
                  </p>
                  <ul className="space-y-1.5">
                    {(feedback.strengths || []).map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-text-main leading-relaxed">
                        <span className="text-success mt-1">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                    {(!feedback.strengths || !feedback.strengths.length) && (
                      <li className="text-sm text-text-subtle italic">No strengths recorded</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Areas to improve
                  </p>
                  <ul className="space-y-1.5">
                    {(feedback.improvements || []).map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-text-main leading-relaxed">
                        <span className="text-warning mt-1">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                    {(!feedback.improvements || !feedback.improvements.length) && (
                      <li className="text-sm text-text-subtle italic">Nothing flagged.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Score breakdown */}
              {scoreBreakdown && (
                <div className="pt-3 border-t border-glass-border/15">
                  <p className="eyebrow mb-3">Score breakdown</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      ['Core concepts', scoreBreakdown.core_concepts, 40],
                      ['Technical depth', scoreBreakdown.technical_depth, 30],
                      ['Practical example', scoreBreakdown.practical_example, 20],
                      ['Clarity', scoreBreakdown.clarity, 10],
                    ].map(([label, value, max]) => (
                      <ProgressBar
                        key={label}
                        label={label}
                        value={value || 0}
                        max={max}
                        showValue={false}
                        tone="primary"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Concept coverage */}
              {(conceptsCovered.length > 0 || conceptsMissing.length > 0 || coveragePct !== null) && (
                <div className="pt-3 border-t border-glass-border/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">Concept coverage</p>
                    {coveragePct !== null && (
                      <span className="text-xs font-semibold text-primary-light tabular-nums">{coveragePct}%</span>
                    )}
                  </div>
                  {conceptsCovered.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {conceptsCovered.map((concept) => (
                        <span key={`covered-${concept}`} className="badge badge-success">{concept}</span>
                      ))}
                    </div>
                  )}
                  {conceptsMissing.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {conceptsMissing.map((concept) => (
                        <span key={`missing-${concept}`} className="badge badge-warning">{concept}</span>
                      ))}
                    </div>
                  )}
                  {missingConceptsFeedback && (
                    <p className="text-xs text-text-muted leading-relaxed">{missingConceptsFeedback}</p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice coaching per-answer */}
        {voiceCoaching.length > 0 && (
          <GlassCard padding="lg" animate={false}>
            <p className="eyebrow mb-3">Voice coaching</p>
            <div className="space-y-2">
              {voiceCoaching.map((item, i) => (
                <div
                  key={i}
                  className={[
                    'rounded-2xl p-4 ring-1 bg-glass-surface/5',
                    item.priority === 'high' ? 'ring-error/40'
                      : item.priority === 'good' ? 'ring-success/40'
                      : 'ring-warning/40',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-base leading-none" aria-hidden>{item.icon}</span>
                    <span className="text-sm font-semibold text-text-main">{item.metric}</span>
                    <span className="ml-auto text-xs text-text-subtle">
                      {item.current} · target {item.target}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">{item.tip}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </motion.section>

      {/* RIGHT: live face/expression analysis */}
      <motion.aside
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="lg:col-span-3 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-primary-light" />
            <h3 className="text-sm font-semibold text-text-main">Expression Coach</h3>
          </div>
          <StatusBadge tone="success" pulse>live</StatusBadge>
        </div>

        <FaceExpressionOverlay
          ref={faceOverlayRef}
          active={interviewStarted}
          currentQuestionIndexRef={currentQuestionIndexRef}
        />

        {expressionCoaching.length > 0 && (
          <div className="space-y-2">
            <p className="eyebrow">Session coaching</p>
            {expressionCoaching.map((item, i) => (
              <div
                key={i}
                className="glass-card p-3 flex gap-2.5 ring-1 ring-primary/20"
              >
                <span className="text-base leading-none mt-0.5" aria-hidden>{item.icon}</span>
                <p className="text-xs text-text-main leading-relaxed">{item.tip}</p>
              </div>
            ))}
          </div>
        )}
      </motion.aside>
    </div>
  );

  /* ====================== RESULTS / LIVE ANALYSIS ====================== */
  const Results = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Presence score */}
      {presenceData && (
        <GlassCard padding="lg" className="lg:col-span-12" animate>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(var(--c-glass-surface) / 0.08)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(var(--c-primary))" strokeWidth="3"
                    strokeDasharray={`${presenceData.presenceScore} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-text-main">
                  {presenceData.presenceScore}
                </span>
              </div>
              <div>
                <p className="eyebrow mb-1 flex items-center gap-2">
                  <Target size={12} /> Interview Presence Score
                </p>
                <p className={`text-2xl font-bold ${
                  presenceData.grade === 'Excellent' ? 'text-success'
                  : presenceData.grade === 'Good' ? 'text-primary-light'
                  : presenceData.grade === 'Developing' ? 'text-warning'
                  : 'text-error'
                }`}>{presenceData.grade}</p>
                <p className="text-sm text-text-muted">Composite of confidence, composure, and engagement.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:max-w-md">
              <ProgressBar label="Confidence" value={presenceData.confidenceScore} max={100} tone="success" size="sm" />
              <ProgressBar label="Composure" value={presenceData.composureScore} max={100} tone="primary" size="sm" />
              <ProgressBar label="Engagement" value={presenceData.engagementScore} max={100} tone="info" size="sm" />
            </div>
          </div>
          {presenceData.trendBonus !== 0 && (
            <div className={`mt-4 text-xs rounded-xl px-3 py-2 ${
              presenceData.trendBonus > 0 ? 'bg-success/10 text-success'
              : 'bg-warning/10 text-warning'
            }`}>
              {presenceData.trendBonus > 0
                ? `Improvement arc: +${presenceData.trendBonus} pts — your composure strengthened as the interview progressed.`
                : `Fatigue arc: ${presenceData.trendBonus} pts — stress increased toward the end. Practice sustaining calm across longer interviews.`}
            </div>
          )}
        </GlassCard>
      )}

      {/* Voice analysis */}
      {metricsEnvelope && (
        <div className="lg:col-span-6">
          <ReasoningCard
            title="Voice analysis"
            factors={[
              ...metricsEnvelope.factors,
              ...(emotionSummary
                ? [
                    {
                      label: `Dominant expression: ${emotionSummary.dominant} (interview_metric)`,
                      positive: !['fear', 'sad', 'angry', 'disgust'].includes(emotionSummary.dominant),
                      signal_type: 'interview_metric',
                      value: emotionSummary.dominantPct,
                    },
                    {
                      label: `Negative expression rate: ${emotionSummary.negativePct}% (interview_metric)`,
                      positive: emotionSummary.negativePct <= 20,
                      signal_type: 'interview_metric',
                      value: emotionSummary.negativePct,
                    },
                  ]
                : []),
            ]}
            basis={metricsEnvelope.basis}
            confidence={metricsEnvelope.confidence}
          />
        </div>
      )}

      {!metricsEnvelope && emotionSummary && (
        <div className="lg:col-span-6">
          <ReasoningCard
            title="Expression analysis"
            factors={[
              {
                label: `Dominant expression: ${emotionSummary.dominant} (interview_metric)`,
                positive: !['fear', 'sad', 'angry', 'disgust'].includes(emotionSummary.dominant),
                signal_type: 'interview_metric',
                value: emotionSummary.dominantPct,
              },
              {
                label: `Negative expression rate: ${emotionSummary.negativePct}% (interview_metric)`,
                positive: emotionSummary.negativePct <= 20,
                signal_type: 'interview_metric',
                value: emotionSummary.negativePct,
              },
            ]}
            basis={`Expression sampled across ${emotionSummary.totalFrames} frame(s) during interview`}
            confidence={
              emotionSummary.totalFrames >= 3 ? 'High'
              : emotionSummary.totalFrames >= 1 ? 'Medium' : 'Low'
            }
          />
        </div>
      )}

      {/* Expression breakdown */}
      {emotionSummary && (
        <GlassCard padding="lg" className="lg:col-span-6" animate>
          <p className="eyebrow mb-3 flex items-center gap-2">
            <Camera size={12} /> Expression breakdown
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">Dominant expression</span>
            <span className="text-sm font-semibold text-text-main capitalize">
              {emotionSummary.dominant}
              <span className="text-primary-light ml-1 text-sm">{emotionSummary.dominantPct}%</span>
            </span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-muted">Negative rate</span>
            <span className={`font-semibold text-sm ${emotionSummary.negativePct > 30 ? 'text-error' : 'text-success'}`}>
              {emotionSummary.negativePct}%
            </span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(emotionSummary.distribution)
              .sort((a, b) => b[1] - a[1])
              .map(([label, pct]) => {
                const tone = ['fear', 'sad', 'angry', 'disgust'].includes(label)
                  ? 'error' : label === 'happy' ? 'success' : 'primary';
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-text-muted text-xs w-16 capitalize flex-shrink-0">{label}</span>
                    <ProgressBar
                      value={pct}
                      max={100}
                      tone={tone}
                      showLabel={false}
                      size="sm"
                      className="flex-1"
                    />
                    <span className="text-text-muted text-xs w-10 text-right tabular-nums">{pct}%</span>
                  </div>
                );
              })}
          </div>
          <p className="text-text-subtle text-xs mt-3 text-right">{emotionSummary.totalFrames} frames sampled</p>
        </GlassCard>
      )}

      {/* Per-question trends */}
      {questionTrends.length > 0 && (
        <GlassCard padding="lg" className="lg:col-span-12" animate>
          <p className="eyebrow mb-4 flex items-center gap-2"><ListChecks size={12} /> Emotional journey per question</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {questionTrends.map((trend, i) =>
              trend && (
                <div key={i} className="rounded-2xl p-4 bg-glass-surface/5 ring-1 ring-glass-border/12">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-primary-light text-sm font-semibold">Question {i + 1}</span>
                    <span className="text-xs text-text-subtle">{trend.frameCount} frame{trend.frameCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-text-main text-sm capitalize">{trend.dominant}</span>
                    <StatusBadge
                      tone={trend.negPct >= 40 ? 'error' : trend.negPct >= 20 ? 'warning' : 'success'}
                    >
                      {trend.negPct >= 40 ? 'High stress' : trend.negPct >= 20 ? 'Some tension' : 'Composed'}
                    </StatusBadge>
                  </div>
                  <p className="text-text-muted text-xs leading-relaxed">{trend.narrative}</p>
                </div>
              ),
            )}
          </div>
        </GlassCard>
      )}

      {/* Expression coaching */}
      {expressionCoaching.length > 0 && (
        <GlassCard padding="lg" className="lg:col-span-6" animate>
          <p className="eyebrow mb-3 flex items-center gap-2"><Camera size={12} /> Expression coaching</p>
          <div className="space-y-2">
            {expressionCoaching.map((item, i) => (
              <div
                key={i}
                className={[
                  'rounded-2xl p-3 ring-1 flex items-start gap-3',
                  item.priority === 'high' ? 'ring-error/30 bg-error/8'
                    : item.priority === 'good' ? 'ring-success/30 bg-success/8'
                    : 'ring-warning/30 bg-warning/8',
                ].join(' ')}
              >
                <span className="text-base mt-0.5" aria-hidden>{item.icon}</span>
                <p className="text-sm text-text-main leading-relaxed">{item.tip}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Voice coaching */}
      {voiceCoaching.length > 0 && (
        <GlassCard padding="lg" className="lg:col-span-6" animate>
          <p className="eyebrow mb-3 flex items-center gap-2"><Mic size={12} /> Voice coaching</p>
          <div className="space-y-2">
            {voiceCoaching.map((item, i) => (
              <div
                key={i}
                className={[
                  'rounded-2xl p-4 ring-1 bg-glass-surface/5',
                  item.priority === 'high' ? 'ring-error/40'
                    : item.priority === 'good' ? 'ring-success/40'
                    : 'ring-warning/40',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-base" aria-hidden>{item.icon}</span>
                  <span className="text-sm font-semibold text-text-main">{item.metric}</span>
                  <span className="ml-auto text-xs text-text-subtle">{item.current} · target {item.target}</span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{item.tip}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Final summary */}
      {coachingSummary && (
        <GlassCard padding="lg" className="lg:col-span-12" animate tone="primary">
          <p className="eyebrow mb-3 flex items-center gap-2"><Award size={12} /> Interview coaching summary</p>
          <div className="flex items-center gap-5 mb-5 flex-wrap">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(var(--c-glass-surface) / 0.08)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(var(--c-primary))" strokeWidth="3"
                  strokeDasharray={`${coachingSummary.score} 100`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-text-main tabular-nums">
                {coachingSummary.score}
              </span>
            </div>
            <div>
              <p className={`text-2xl font-bold ${coachingSummary.gradeColor}`}>{coachingSummary.grade}</p>
              <p className="text-sm text-text-muted">Overall interview performance</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {coachingSummary.issues.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-error mb-2 uppercase tracking-wider">Areas to improve</p>
                <ul className="space-y-1.5">
                  {coachingSummary.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                      <span className="text-error mt-0.5">→</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {coachingSummary.strengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-success mb-2 uppercase tracking-wider">Your strengths</p>
                <ul className="space-y-1.5">
                  {coachingSummary.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                      <span className="text-success mt-0.5">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="relative mt-6 rounded-2xl bg-primary/10 ring-1 ring-primary/25 p-5 italic">
            <Quote size={20} className="absolute top-3 left-3 text-primary/40" />
            <div className="pl-9">
              <p className={`text-base font-semibold not-italic mb-1 ${coachingSummary.gradeColor}`}>
                {coachingSummary.grade} — {coachingSummary.score}/100
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                {coachingSummary.strengths.slice(0, 2).join('. ')}
                {coachingSummary.issues.length > 0 && ` Focus next on: ${coachingSummary.issues[0]}.`}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* CTA */}
      <div className="lg:col-span-12 flex items-center justify-center gap-3 flex-wrap pt-2">
        <ActionButton
          variant="primary"
          icon={Play}
          size="lg"
          onClick={() => {
            setInterviewEnded(false);
            setEmotionSummary(null);
            setPresenceData(null);
            setQuestionTrends([]);
            setMetricsEnvelope(null);
            setVoiceCoaching([]);
            setExpressionCoaching([]);
            setCoachingSummary(null);
            setQuestionNumber(0);
            setUserAnswer('');
            setFeedback(null);
          }}
        >
          Start another interview
        </ActionButton>
        <ActionButton variant="secondary" icon={History} onClick={() => setShowHistory(true)}>
          See all past interviews
        </ActionButton>
      </div>
    </div>
  );

  /* ====================== RENDER ====================== */
  return (
    <PageContainer>
      {Header}

      <AnimatePresence mode="wait">
        {!interviewStarted && !interviewEnded && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {SetupScreen}
          </motion.div>
        )}

        {interviewStarted && (
          <motion.div
            key="interview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {ActiveInterview}
          </motion.div>
        )}

        {!interviewStarted && interviewEnded && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {Results}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History dialog */}
      <Dialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title="Interview history"
        description="Your most recent practice sessions"
        size="lg"
      >
        {interviewHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="No interview history yet"
            description="Complete an interview to see it here."
            action={{
              label: 'Start interview',
              icon: Play,
              onClick: () => {
                setShowHistory(false);
                if (!interviewStarted && selectedRole) startInterview();
              },
            }}
          />
        ) : (
          <div className="space-y-3">
            {interviewHistory.slice(0, 10).map((item) => (
              <div key={item.id} className="glass-card p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-main">
                      {JOB_ROLES.find((r) => r.value === item.role)?.label || item.role}
                    </p>
                    <p className="text-xs text-text-muted">
                      {item.questionsAsked} questions · Pass rate {item.summary?.passRate || 'N/A'}% · {item.createdAt?.toLocaleDateString?.() || ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-light tabular-nums">
                      {item.averageScore?.toFixed?.(1) || '0.0'}
                      <span className="text-text-muted text-sm font-normal">/10</span>
                    </p>
                    <StatusBadge tone={DIFFICULTY_LEVELS.find((d) => d.value === item.difficulty)?.tone || 'default'}>
                      {item.difficulty}
                    </StatusBadge>
                  </div>
                </div>
                {item.summary && (
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-glass-border/12">
                    <div className="text-center">
                      <p className="text-xs text-text-muted">Highest</p>
                      <p className="text-sm font-semibold text-success">{item.summary.highestScore?.toFixed?.(1) || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-muted">Lowest</p>
                      <p className="text-sm font-semibold text-error">{item.summary.lowestScore?.toFixed?.(1) || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-muted">Questions</p>
                      <p className="text-sm font-semibold text-text-main">{item.summary.totalQuestions}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </PageContainer>
  );
};

export default MockInterview;
