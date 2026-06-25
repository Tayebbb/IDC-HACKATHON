/**
 * Mock Interview Practice Page
 * AI-powered interview practice with real-time feedback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Video,
  MessageSquare,
  BookOpen,
  Award,
  History,
  Brain,
  Camera,
  ChevronRight,
  Star,
  Quote
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
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import ReasoningCard from '../components/ReasoningCard';
import { buildEnvelope } from '../utils/explainability';
import FaceExpressionOverlay, { getExpressionCoaching } from '../components/FaceExpressionOverlay';
import { indexProfile } from '../services/ragPipeline';
import { loadCorpus } from '../services/corpusLoader';
import {
  generateInterviewQuestion,
  evaluateInterviewAnswer,
} from '../services/interviewAI';

// ── CHANGE 3: Voice coaching pure function ──────────────────────────────────
function getVoiceCoaching(wpm, fillerCount, pauseSeconds) {
  /*
   WPM good range: 110-160
   Filler words good: <= 3
   Pause time good: <= 6s
   Returns array of coaching objects
  */
  const coaching = [];

  // WPM coaching
  if (wpm < 80) {
    coaching.push({
      icon: '🐢',
      priority: 'high',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `You are speaking too slowly at ${wpm} WPM. Increase your pace — slow speech can signal low confidence to interviewers.`,
    });
  } else if (wpm < 110) {
    coaching.push({
      icon: '⚡',
      priority: 'medium',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `Your pace at ${wpm} WPM is slightly slow. Aim for 110–160 WPM to sound more energetic and confident.`,
    });
  } else if (wpm > 180) {
    coaching.push({
      icon: '🐇',
      priority: 'high',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `You are speaking too fast at ${wpm} WPM. Slow down so the interviewer can absorb your answer clearly.`,
    });
  } else if (wpm > 160) {
    coaching.push({
      icon: '😮💨',
      priority: 'medium',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `Your pace at ${wpm} WPM is slightly fast. Take brief pauses between points to let your answer land.`,
    });
  } else {
    coaching.push({
      icon: '✅',
      priority: 'good',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `Great speaking pace at ${wpm} WPM — clear and confident.`,
    });
  }

  // Filler word coaching
  if (fillerCount > 8) {
    coaching.push({
      icon: '🚫',
      priority: 'high',
      metric: 'Filler Words',
      current: `${fillerCount} fillers`,
      target: '3 or fewer',
      tip: `You used ${fillerCount} filler words (um, uh, like, basically). Replace them with a 1-second pause — silence sounds far more confident than fillers.`,
    });
  } else if (fillerCount > 3) {
    coaching.push({
      icon: '⚠️',
      priority: 'medium',
      metric: 'Filler Words',
      current: `${fillerCount} fillers`,
      target: '3 or fewer',
      tip: `${fillerCount} filler words detected. Practice pausing silently instead of saying "um" or "uh" while you think.`,
    });
  } else {
    coaching.push({
      icon: '✅',
      priority: 'good',
      metric: 'Filler Words',
      current: `${fillerCount} fillers`,
      target: '3 or fewer',
      tip: `Excellent — only ${fillerCount} filler words. Clean, professional speech.`,
    });
  }

  // Pause coaching
  if (pauseSeconds > 10) {
    coaching.push({
      icon: '⏸️',
      priority: 'high',
      metric: 'Pause Time',
      current: `${pauseSeconds}s paused`,
      target: 'Under 6s total',
      tip: `${pauseSeconds}s of silence detected. Long pauses suggest uncertainty. Structure your answer using STAR method before speaking.`,
    });
  } else if (pauseSeconds > 6) {
    coaching.push({
      icon: '⏳',
      priority: 'medium',
      metric: 'Pause Time',
      current: `${pauseSeconds}s paused`,
      target: 'Under 6s total',
      tip: `${pauseSeconds}s of pausing. Slightly high — brief pauses are fine but try to answer more fluidly.`,
    });
  } else {
    coaching.push({
      icon: '✅',
      priority: 'good',
      metric: 'Pause Time',
      current: `${pauseSeconds}s paused`,
      target: 'Under 6s total',
      tip: `Good flow — only ${pauseSeconds}s of total pausing.`,
    });
  }

  return coaching;
}

// ── CHANGE 4: Overall coaching summary pure function ─────────────────────────
function getOverallCoachingSummary(wpm, fillerCount, pauseSeconds, emotions) {
  const issues = [];
  const strengths = [];

  // Voice issues
  if (wpm < 110) issues.push('Increase speaking speed to 110–160 WPM');
  if (wpm > 160) issues.push('Slow down your speaking pace');
  if (fillerCount > 3) issues.push(`Reduce filler words — used ${fillerCount}`);
  if (pauseSeconds > 6) issues.push('Minimize long pauses between sentences');

  // Expression issues
  if (emotions) {
    const negPct = (emotions.sad || 0) + (emotions.fear || 0) + (emotions.angry || 0);
    if (negPct > 50) issues.push('Work on maintaining a calm confident expression');
    if ((emotions.fear || 0) > 25) issues.push('Practice to reduce visible nervousness');
    if ((emotions.happy || 0) > 30) strengths.push('Good positive energy in your expression');
  }

  // Voice strengths
  if (wpm >= 110 && wpm <= 160) strengths.push('Speaking pace is perfect');
  if (fillerCount <= 3) strengths.push('Clean speech with minimal filler words');
  if (pauseSeconds <= 6) strengths.push('Good answer fluency with minimal pausing');

  // Overall score 0-100
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
  if (score >= 80) { grade = 'Excellent'; gradeColor = 'text-green-400'; }
  else if (score >= 60) { grade = 'Good'; gradeColor = 'text-primary'; }
  else if (score >= 40) { grade = 'Needs Work'; gradeColor = 'text-yellow-400'; }
  else { grade = 'Keep Practicing'; gradeColor = 'text-red-400'; }

  return { score, grade, gradeColor, issues, strengths };
}

const MockInterview = () => {
  const { currentUser } = useAuth();
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
  const [sessionAnswers, setSessionAnswers] = useState([]); // Store Q&A pairs
  const [sessionFeedbacks, setSessionFeedbacks] = useState([]); // Store all feedbacks

  // Feature 6 — Voice Interview Coach state
  // FALLBACK TEST (verified at implementation time):
  //   - When window.SpeechRecognition / webkitSpeechRecognition is
  //     undefined, voiceSupported is false and the Record button is
  //     hidden. The existing text input still works.
  //   - When the user denies mic permission, onerror fires with
  //     'not-allowed', we toast once, set voiceSupported=false, and
  //     fall back to text input silently. No exception thrown.
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [metricsEnvelope, setMetricsEnvelope] = useState(null);
  const recognitionRef = useRef(null);
  const speechStartRef = useRef(null);
  const speechEndRef = useRef(null);
  const lastResultTimeRef = useRef(null);
  const pauseAccumRef = useRef(0);
  const faceOverlayRef = useRef(null);
  const [emotionSummary, setEmotionSummary] = useState(null);

  // ── CHANGE 5: New coaching state ────────────────────────────────────────
  const [voiceCoaching, setVoiceCoaching] = useState([]);
  const [expressionCoaching, setExpressionCoaching] = useState([]);
  const [coachingSummary, setCoachingSummary] = useState(null);
  const [interviewEnded, setInterviewEnded] = useState(false);
  // Live emotions distribution accumulated from FaceExpressionOverlay updates
  const liveEmotionsRef = useRef(null);

  // Detect SpeechRecognition support once on mount (silent fallback).
  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setVoiceSupported(!!SR);
  }, []);

  // ── CHANGE 5: Compute overall coaching summary when interview ends ──────────
  useEffect(() => {
    if (!interviewEnded) return;
    // Extract raw metrics from the latest metricsEnvelope factors
    const wpmFactor    = metricsEnvelope?.factors?.find(f => f.label?.includes('Speaking rate'));
    const fillerFactor = metricsEnvelope?.factors?.find(f => f.label?.includes('Filler words'));
    const pauseFactor  = metricsEnvelope?.factors?.find(f => f.label?.includes('pause time'));
    const wpm       = wpmFactor?.value    ?? 0;
    const fillers   = fillerFactor?.value ?? 0;
    const pauseSecs = pauseFactor?.value  ?? 0;
    const emotions  = liveEmotionsRef.current;
    setCoachingSummary(getOverallCoachingSummary(wpm, fillers, pauseSecs, emotions));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewEnded]);

  const jobRoles = [
    { value: 'frontend', label: 'Frontend Developer', icon: '💻' },
    { value: 'backend', label: 'Backend Developer', icon: '⚙️' },
    { value: 'fullstack', label: 'Full Stack Developer', icon: '🚀' },
    { value: 'data-science', label: 'Data Scientist', icon: '📊' },
    { value: 'mobile', label: 'Mobile Developer', icon: '📱' },
    { value: 'devops', label: 'DevOps Engineer', icon: '🔧' },
    { value: 'ui-ux', label: 'UI/UX Designer', icon: '🎨' },
    { value: 'product-manager', label: 'Product Manager', icon: '📋' },
  ];

  const difficultyLevels = [
    { value: 'beginner', label: 'Beginner', description: 'Basic concepts and fundamentals' },
    { value: 'intermediate', label: 'Intermediate', description: 'Practical experience questions' },
    { value: 'advanced', label: 'Advanced', description: 'Complex scenarios and system design' },
  ];

  // Load interview history
  useEffect(() => {
    if (currentUser && showHistory) {
      loadInterviewHistory();
    }
  }, [currentUser, showHistory]);

  const loadInterviewHistory = useCallback(async () => {
    try {
      const historyRef = collection(db, 'interviewHistory');
      const q = query(
        historyRef,
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setInterviewHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }, [currentUser]);

  // Generate interview question via Hugging Face (browser direct, RAG-augmented)
  const generateQuestion = useCallback(async () => {
    setLoading(true);
    try {
      const question = await generateInterviewQuestion({
        role: selectedRole,
        difficulty,
        questionNumber: questionNumber + 1,
        previousQuestions: sessionQuestions,
      });
      if (!question) throw new Error('Empty question returned from model');
      setCurrentQuestion(question);
      setSessionQuestions(prev => [...prev, question]);
      toast.success('New question generated!');
    } catch (error) {
      console.error('Error generating question:', error);
      toast.error('Failed to generate question. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, difficulty, questionNumber, sessionQuestions]);

  // Evaluate answer via Hugging Face (browser direct, RAG-augmented)
  const evaluateAnswer = useCallback(async () => {
    if (!userAnswer.trim()) {
      toast.error('Please provide an answer');
      return;
    }

    setLoading(true);
    try {
      const data = await evaluateInterviewAnswer({
        question: currentQuestion,
        answer: userAnswer,
        role: selectedRole,
        difficulty,
      });
      setFeedback(data);

      // Feature 6 — build a client-side interview_metric envelope from
      // the captured voice session. Falls back to null if voice was
      // never used (no exception, no render).
      try {
        const env = computeMetricsEnvelope(userAnswer);
        setMetricsEnvelope(env);
        // ── CHANGE 5: Compute voice coaching from envelope factors ──
        if (env && env.factors) {
          const wpmFactor    = env.factors.find(f => f.label && f.label.includes('Speaking rate'));
          const fillerFactor = env.factors.find(f => f.label && f.label.includes('Filler words'));
          const pauseFactor  = env.factors.find(f => f.label && f.label.includes('pause time'));
          const wpm    = wpmFactor?.value    ?? 0;
          const fillers = fillerFactor?.value ?? 0;
          const pauseSecs = pauseFactor?.value ?? 0;
          setVoiceCoaching(getVoiceCoaching(wpm, fillers, pauseSecs));
        }
      } catch {
        setMetricsEnvelope(null);
      }

      // Update session score
      setSessionScore(prev => prev + data.score);

      // Store Q&A pair with feedback
      setSessionAnswers(prev => [...prev, {
        question: currentQuestion,
        answer: userAnswer,
        score: data.score,
        feedback: data.feedback,
        strengths: data.strengths,
        improvements: data.improvements,
        timestamp: new Date().toISOString()
      }]);
      
      setSessionFeedbacks(prev => [...prev, data]);

      toast.success('Answer evaluated!');
    } catch (error) {
      console.error('Error evaluating answer:', error);
      toast.error('Failed to evaluate answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userAnswer, currentQuestion, selectedRole, difficulty]);

  // Start interview — load the user's profile + general corpus into the
  // in-browser RAG store, then generate the first question.
  const startInterview = useCallback(async () => {
    if (!selectedRole) {
      toast.error('Please select a job role');
      return;
    }
    setInterviewStarted(true);
    setQuestionNumber(0);
    setSessionQuestions([]);
    setSessionScore(0);
    setSessionAnswers([]); // Reset Q&A pairs
    setSessionFeedbacks([]); // Reset feedbacks
    setEmotionSummary(null);
    setMetricsEnvelope(null);
    // ── CHANGE 5: Clear coaching state on restart ──
    setVoiceCoaching([]);
    setExpressionCoaching([]);
    setCoachingSummary(null);
    setInterviewEnded(false);
    liveEmotionsRef.current = null;

    // Fire-and-forget corpus load (cached after first run).
    loadCorpus().catch(() => { /* non-blocking */ });

    // Index user profile so retrieve() can ground answers in it.
    if (currentUser?.uid) {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) await indexProfile(snap.data());
      } catch (err) {
        console.warn('Profile indexing failed:', err?.message || err);
      }
    }

    generateQuestion();
  }, [selectedRole, currentUser, generateQuestion]);

  // Next question
  const nextQuestion = useCallback(() => {
    setQuestionNumber(prev => prev + 1);
    setUserAnswer('');
    setFeedback(null);
    generateQuestion();
  }, [generateQuestion]);

  // End interview and save to history
  const endInterview = useCallback(async () => {
    const summary = faceOverlayRef.current?.finalize();
    if (summary) {
      setEmotionSummary(summary);
      // ── CHANGE 5: Compute expression coaching from finalized summary ──
      const coaching = getExpressionCoaching(summary.distribution);
      setExpressionCoaching(coaching);
      // Store latest emotions for coaching summary
      liveEmotionsRef.current = summary.distribution;
    }
    try {
      const avgScore = sessionScore / Math.max(questionNumber + 1, 1);
      const totalQuestions = questionNumber + 1;
      
      // Prepare detailed session data
      const sessionData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        role: selectedRole,
        difficulty: difficulty,
        questionsAsked: totalQuestions,
        averageScore: avgScore,
        totalScore: sessionScore,
        
        // Store all Q&A pairs with feedback
        questionsAndAnswers: sessionAnswers,
        
        // Session metadata
        sessionDuration: null, // Can add timer if needed
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        
        // Individual scores for tracking
        scores: sessionFeedbacks.map(f => f.score),
        
        // Overall session summary
        summary: {
          totalQuestions: totalQuestions,
          averageScore: parseFloat(avgScore.toFixed(2)),
          highestScore: Math.max(...sessionFeedbacks.map(f => f.score || 0)),
          lowestScore: Math.min(...sessionFeedbacks.map(f => f.score || 10)),
          passRate: (sessionFeedbacks.filter(f => f.score >= 6).length / totalQuestions * 100).toFixed(1)
        }
      };

      // Save to Firebase
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
  }, [currentUser, selectedRole, difficulty, questionNumber, sessionScore, sessionAnswers, sessionFeedbacks]);

  // Voice recording — Feature 6: real Web Speech API integration
  const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'literally'];

  const computeMetricsEnvelope = useCallback((transcript) => {
    const text = (transcript || '').trim();
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean);
    const durationMs = (speechEndRef.current || Date.now()) - (speechStartRef.current || Date.now());
    const minutes = Math.max(durationMs / 60000, 1 / 60);
    const wpm = Math.round(words.length / minutes);

    const lower = ' ' + text.toLowerCase() + ' ';
    let fillers = 0;
    FILLER_WORDS.forEach((f) => {
      const re = new RegExp('\\b' + f.replace(/ /g, '\\s+') + '\\b', 'g');
      const m = lower.match(re);
      if (m) fillers += m.length;
    });
    const pauseSecs = Math.round((pauseAccumRef.current || 0) / 100) / 10;

    const factors = [
      {
        label: `Speaking rate: ${wpm} WPM (interview_metric)`,
        positive: wpm >= 110 && wpm <= 160,
        signal_type: 'interview_metric',
        value: wpm,
      },
      {
        label: `Filler words used: ${fillers} (interview_metric)`,
        positive: fillers <= 3,
        signal_type: 'interview_metric',
        value: fillers,
      },
      {
        label: `Total pause time: ${pauseSecs}s (interview_metric)`,
        positive: pauseSecs <= 6,
        signal_type: 'interview_metric',
        value: pauseSecs,
      },
    ];

    return buildEnvelope(
      `${words.length} words spoken`,
      factors,
      `Voice analysis \u00b7 ${Math.round(durationMs / 1000)}s recorded`
    );
  }, []);

  const toggleRecording = useCallback(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      // Silent fallback per Feature 6 requirements.
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
      let finalText = userAnswer ? userAnswer + ' ' : '';

      rec.onresult = (event) => {
        const now = Date.now();
        const gap = now - (lastResultTimeRef.current || now);
        // Count gaps longer than ~1.2s as pause time.
        if (gap > 1200) pauseAccumRef.current += gap;
        lastResultTimeRef.current = now;

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript + ' ';
          else interim += r[0].transcript + ' ';
        }
        setUserAnswer((finalText + interim).trim());
      };

      rec.onerror = (e) => {
        if (e && e.error === 'not-allowed') {
          toast.error('Microphone permission denied \u2014 you can still type your answer.');
          setVoiceSupported(false);
        }
        // Any other error: silent fallback, keep text input working.
        setIsRecording(false);
      };

      rec.onend = () => {
        speechEndRef.current = Date.now();
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
      setIsRecording(true);
      toast.success('Listening\u2026 speak your answer');
    } catch (err) {
      // Browser refused construction — silent fallback.
      setVoiceSupported(false);
      setIsRecording(false);
    }
  }, [isRecording, userAnswer]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto text-primary mb-4" size={48} />
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted">Please log in to practice interviews</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base py-8">
      <div className="section-container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                🎤 Mock Interview Practice
              </h1>
              <p className="text-muted">
                Practice with AI-powered interview questions and get real-time feedback
              </p>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="btn-outline-neon flex items-center space-x-2"
            >
              <History size={18} />
              <span>History</span>
            </button>
          </div>
        </motion.div>

        {/* Interview History Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card mb-8"
            >
              <h3 className="text-xl font-bold mb-4">Interview History</h3>
              {interviewHistory.length === 0 ? (
                <p className="text-muted">No interview history yet</p>
              ) : (
                <div className="space-y-3">
                  {interviewHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-border hover:border-primary/30 transition-all cursor-pointer"
                      style={{ background: 'rgba(168,85,247,0.05)' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-lg">
                            {jobRoles.find(r => r.value === item.role)?.label}
                          </p>
                          <p className="text-sm text-muted">
                            {item.questionsAsked} questions • Pass Rate: {item.summary?.passRate || 'N/A'}%
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {item.averageScore?.toFixed(1)}/10
                          </div>
                          <p className="text-xs text-muted">
                            {item.createdAt?.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Score breakdown */}
                      {item.summary && (
                        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border/50">
                          <div className="text-center">
                            <p className="text-xs text-muted">Highest</p>
                            <p className="text-sm font-semibold text-green-500">
                              {item.summary.highestScore?.toFixed(1)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted">Lowest</p>
                            <p className="text-sm font-semibold text-red-500">
                              {item.summary.lowestScore?.toFixed(1)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted">Difficulty</p>
                            <p className={`text-sm font-semibold capitalize ${
                              item.difficulty === 'advanced' ? 'text-red-500' : 
                              item.difficulty === 'intermediate' ? 'text-yellow-500' : 
                              'text-green-500'
                            }`}>
                              {item.difficulty}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!interviewStarted ? (
          /* Setup Screen */
          <div className="grid lg:grid-cols-2 gap-8">
            {emotionSummary && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 space-y-4"
              >
                {metricsEnvelope && (
                  <ReasoningCard
                    title="Voice analysis"
                    factors={[
                      ...metricsEnvelope.factors,
                      ...(emotionSummary ? [
                        {
                          label: `Dominant expression: ${emotionSummary.dominant} (interview_metric)`,
                          positive: !["fear","sad","angry","disgust"].includes(emotionSummary.dominant),
                          signal_type: "interview_metric",
                          value: emotionSummary.dominantPct,
                        },
                        {
                          label: `Negative expression rate: ${emotionSummary.negativePct}% (interview_metric)`,
                          positive: emotionSummary.negativePct <= 20,
                          signal_type: "interview_metric",
                          value: emotionSummary.negativePct,
                        },
                      ] : []),
                    ]}
                    basis={metricsEnvelope.basis}
                    confidence={metricsEnvelope.confidence}
                  />
                )}

                {!metricsEnvelope && (
                  <ReasoningCard
                    title="Expression Analysis"
                    factors={[
                      {
                        label: `Dominant expression: ${emotionSummary.dominant} (interview_metric)`,
                        positive: !["fear","sad","angry","disgust"].includes(emotionSummary.dominant),
                        signal_type: "interview_metric",
                        value: emotionSummary.dominantPct,
                      },
                      {
                        label: `Negative expression rate: ${emotionSummary.negativePct}% (interview_metric)`,
                        positive: emotionSummary.negativePct <= 20,
                        signal_type: "interview_metric",
                        value: emotionSummary.negativePct,
                      },
                    ]}
                    basis={`Expression sampled across ${emotionSummary.totalFrames} frame(s) during interview`}
                    confidence={
                      emotionSummary.totalFrames >= 3 ? "High" :
                      emotionSummary.totalFrames >= 1 ? "Medium" : "Low"
                    }
                  />
                )}

                <div className="neon-card p-5 rounded-xl">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span>Expression Analysis</span>
                  </h3>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[#B3B3C7] text-sm">Dominant Expression</span>
                    <span className="text-white font-semibold capitalize">
                      {emotionSummary.dominant}
                      <span className="text-purple-400 ml-1 text-sm">{emotionSummary.dominantPct}%</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[#B3B3C7] text-sm">Negative Expression Rate</span>
                    <span className={`font-semibold text-sm ${emotionSummary.negativePct > 30 ? "text-red-400" : "text-green-400"}`}>
                      {emotionSummary.negativePct}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(emotionSummary.distribution)
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, pct]) => (
                        <div key={label} className="flex items-center gap-3">
                          <span className="text-[#B3B3C7] text-xs w-16 capitalize">{label}</span>
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: ["fear","sad","angry","disgust"].includes(label)
                                  ? "#ef4444" : label === "happy" ? "#22c55e" : "#a855f7",
                              }}
                            />
                          </div>
                          <span className="text-[#B3B3C7] text-xs w-8 text-right">{pct}%</span>
                        </div>
                      ))}
                  </div>
                  <p className="text-[#B3B3C7] text-xs mt-3 text-right">
                    {emotionSummary.totalFrames} frames sampled
                  </p>
                </div>

                {/* ── CHANGE 2: Expression Coaching on setup screen ── */}
                {expressionCoaching.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[#B3B3C7] text-xs font-semibold uppercase tracking-wide">
                      Expression Coaching
                    </p>
                    {expressionCoaching.map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          item.priority === 'high'
                            ? 'border-red-500/30 bg-red-500/10'
                            : item.priority === 'good'
                            ? 'border-green-500/30 bg-green-500/10'
                            : 'border-yellow-500/30 bg-yellow-500/10'
                        }`}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <p className="text-sm text-white leading-relaxed">{item.tip}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── CHANGE 3: Voice Coaching on setup screen ── */}
                {voiceCoaching.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[#B3B3C7] text-xs font-semibold uppercase tracking-wide">
                      Voice Coaching
                    </p>
                    {voiceCoaching.map((item, i) => (
                      <div
                        key={i}
                        className={`neon-card p-4 rounded-xl border ${
                          item.priority === 'high'
                            ? 'border-red-500/40'
                            : item.priority === 'good'
                            ? 'border-green-500/40'
                            : 'border-yellow-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{item.icon}</span>
                          <span className="text-sm font-semibold text-white">
                            {item.metric}
                          </span>
                          <span className="ml-auto text-xs text-[#B3B3C7]">
                            {item.current} · target {item.target}
                          </span>
                        </div>
                        <p className="text-sm text-[#B3B3C7] leading-relaxed">
                          {item.tip}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── CHANGE 4: Overall Coaching Summary on setup screen ── */}
                {interviewEnded && coachingSummary && (
                  <div className="neon-card p-6 rounded-2xl border border-primary/30">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      🎯 Interview Coaching Summary
                    </h3>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15.9"
                            fill="none" stroke="#11152B" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9"
                            fill="none" stroke="#A855F7" strokeWidth="3"
                            strokeDasharray={`${coachingSummary.score} 100`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                          {coachingSummary.score}
                        </span>
                      </div>
                      <div>
                        <p className={`text-2xl font-bold ${coachingSummary.gradeColor}`}>
                          {coachingSummary.grade}
                        </p>
                        <p className="text-[#B3B3C7] text-sm">Overall interview performance</p>
                      </div>
                    </div>
                    {coachingSummary.issues.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wide">
                          🔧 Areas to Improve
                        </p>
                        <ul className="space-y-1">
                          {coachingSummary.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[#B3B3C7]">
                              <span className="text-red-400 mt-0.5">→</span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {coachingSummary.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wide">
                          ✨ Your Strengths
                        </p>
                        <ul className="space-y-1">
                          {coachingSummary.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[#B3B3C7]">
                              <span className="text-green-400 mt-0.5">✓</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}


            {/* Role Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card"
            >
              <h2 className="text-xl font-bold mb-4">Select Job Role</h2>
              <div className="grid grid-cols-2 gap-3">
                {jobRoles.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => setSelectedRole(role.value)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedRole === role.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-2">{role.icon}</div>
                    <div className="font-semibold text-sm">{role.label}</div>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Difficulty Selection */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card"
            >
              <h2 className="text-xl font-bold mb-4">Select Difficulty</h2>
              <div className="space-y-3">
                {difficultyLevels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setDifficulty(level.value)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      difficulty === level.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-semibold mb-1">{level.label}</div>
                    <div className="text-sm text-muted">{level.description}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={startInterview}
                disabled={!selectedRole}
                className="btn-primary w-full mt-6 flex items-center justify-center space-x-2"
              >
                <Play size={18} />
                <span>Start Interview</span>
              </button>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 card"
            >
              <h2 className="text-xl font-bold mb-4">What to Expect</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-start space-x-3">
                  <MessageSquare className="text-primary mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold mb-1">AI-Generated Questions</h3>
                    <p className="text-sm text-muted">
                      Role-specific questions powered by Hugging Face Mistral
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <TrendingUp className="text-primary mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold mb-1">Real-time Feedback</h3>
                    <p className="text-sm text-muted">
                      Get instant evaluation and improvement suggestions
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Award className="text-primary mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold mb-1">Track Progress</h3>
                    <p className="text-sm text-muted">
                      Monitor your improvement over multiple sessions
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          /* Interview Session — redesigned 3-column layout (25/50/25). */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* ════════════ LEFT COLUMN — Session controls ════════════ */}
            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0 }}
              className="lg:col-span-1 space-y-4"
            >
              {/* Session header */}
              <div className="rounded-xl p-5 bg-[#0D1117] border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={18} className="text-[#A855F7]" />
                  <h2 className="text-base font-semibold text-white">Mock Interview</h2>
                </div>
                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest ${
                  difficulty === 'beginner'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : difficulty === 'advanced'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}>
                  {difficulty}
                </span>
                <p className="text-xs text-white/40 mt-2">
                  {jobRoles.find(r => r.value === selectedRole)?.label || 'Role'}
                </p>
              </div>

              {/* Difficulty pills */}
              <div className="rounded-xl p-4 bg-[#0D1117] border border-white/[0.08]">
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">
                  Difficulty
                </p>
                <div className="flex gap-2">
                  {difficultyLevels.map(level => {
                    const sel = difficulty === level.value;
                    return (
                      <button
                        key={level.value}
                        onClick={() => setDifficulty(level.value)}
                        className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded-full transition-all ${
                          sel
                            ? 'bg-[#A855F7] text-white shadow-[0_0_18px_rgba(168,85,247,0.45)]'
                            : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.06] border border-white/10'
                        }`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* New Question */}
              <div className="space-y-2">
                <button
                  onClick={generateQuestion}
                  disabled={loading || feedback != null}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#A855F7]/40 text-[#A855F7] hover:bg-[#A855F7]/10 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <RotateCw size={16} />
                  <span>New Question</span>
                </button>
                <p className="text-xs text-white/40 text-center">
                  Question {questionNumber + 1}
                </p>
              </div>

              {/* Session stats */}
              <div className="space-y-2">
                {(() => {
                  const scores = sessionFeedbacks.map(f => f?.score || 0).filter(s => s > 0);
                  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0.0';
                  const best = scores.length ? Math.max(...scores).toFixed(1) : '0.0';
                  const cards = [
                    { label: 'Avg Score',       value: `${avg}/10`,       Icon: TrendingUp },
                    { label: 'Questions Asked', value: questionNumber,    Icon: MessageSquare },
                    { label: 'Best Score',      value: `${best}/10`,      Icon: Star },
                  ];
                  return cards.map(c => (
                    <div
                      key={c.label}
                      className="rounded-xl p-3.5 bg-[#0D1117] border border-white/[0.08] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 flex items-center justify-center">
                          <c.Icon size={14} className="text-[#A855F7]" />
                        </div>
                        <p className="text-xs text-white/50">{c.label}</p>
                      </div>
                      <p className="text-lg font-bold text-[#A855F7]">{c.value}</p>
                    </div>
                  ));
                })()}
              </div>

              {/* End interview */}
              <button
                onClick={endInterview}
                className="w-full px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 text-sm font-medium"
              >
                <StopCircle size={16} />
                End Interview
              </button>
            </motion.aside>

            {/* ════════════ CENTER COLUMN — Active interview ════════════ */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="lg:col-span-2 space-y-5"
            >
              {/* Question card */}
              <motion.div
                key={questionNumber}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl bg-[#0D1117] border-l-[3px] border-l-[#A855F7] border-y border-r border-white/[0.08] p-6 relative"
              >
                <p className="text-[11px] text-[#A855F7] uppercase tracking-widest font-semibold mb-3">
                  Question {questionNumber + 1}
                </p>
                {loading && !currentQuestion ? (
                  <div className="animate-pulse space-y-3 min-h-[80px]">
                    <div className="h-5 bg-white/5 rounded w-3/4" />
                    <div className="h-5 bg-white/5 rounded w-full" />
                    <div className="h-5 bg-white/5 rounded w-2/3" />
                  </div>
                ) : (
                  <h3 className="text-xl font-medium text-white min-h-[80px] leading-relaxed pr-24">
                    {currentQuestion || 'Click "New Question" to begin.'}
                  </h3>
                )}
                <span className="absolute bottom-3 right-4 text-[10px] text-white/40 uppercase tracking-wider">
                  {difficulty}
                </span>
              </motion.div>

              {/* Answer textarea */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/70 font-medium">Your Answer</p>
                  {voiceSupported && (
                    <button
                      onClick={toggleRecording}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
                        isRecording
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
                          : 'bg-white/[0.04] text-white/70 border border-white/10 hover:bg-white/[0.08]'
                      }`}
                    >
                      {isRecording ? <StopCircle size={14} /> : <Mic size={14} />}
                      {isRecording ? 'Stop' : 'Record'}
                    </button>
                  )}
                </div>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  disabled={loading}
                  className="w-full min-h-[180px] resize-none bg-transparent border border-white/10 rounded-xl p-4 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#A855F7]/60 focus:border-transparent transition-all"
                />
              </div>

              {/* Submit row */}
              <div className="flex items-center justify-end gap-3">
                {feedback && (
                  <button
                    onClick={nextQuestion}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 text-white/80 hover:bg-white/[0.04] transition-all text-sm font-medium"
                  >
                    <span>Next Question</span>
                    <ChevronRight size={16} />
                  </button>
                )}
                <button
                  onClick={evaluateAnswer}
                  disabled={loading || !userAnswer.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#A855F7] hover:bg-[#9333EA] text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(168,85,247,0.35)]"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span className="text-sm">Evaluating…</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span className="text-sm">Submit Answer</span>
                    </>
                  )}
                </button>
              </div>

              {/* Evaluation panel */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35 }}
                    className="rounded-2xl bg-[#0D1117] border border-white/[0.08] p-6 space-y-5"
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
                              <circle cx="50" cy="50" r={R}
                                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                              <motion.circle
                                cx="50" cy="50" r={R}
                                fill="none" stroke="#A855F7" strokeWidth="8" strokeLinecap="round"
                                strokeDasharray={C}
                                initial={{ strokeDashoffset: C }}
                                animate={{ strokeDashoffset: C * (1 - pct / 100) }}
                                transition={{ duration: 1.1, ease: 'easeOut' }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-2xl font-bold text-white leading-none">{pct}</span>
                              <span className="text-[10px] text-white/40 mt-1">/100</span>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[#A855F7] uppercase tracking-widest font-semibold mb-1.5">
                          AI Evaluation
                        </p>
                        <p className="text-sm text-white/80 leading-relaxed">
                          {feedback.feedback}
                        </p>
                      </div>
                    </div>

                    {/* Strengths / Areas to improve */}
                    <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
                      <div>
                        <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Strengths
                        </p>
                        <ul className="space-y-1.5">
                          {(feedback.strengths || []).map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm text-white/75 leading-relaxed">
                              <span className="text-emerald-400 mt-1">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                          {(!feedback.strengths || !feedback.strengths.length) && (
                            <li className="text-sm text-white/40 italic">No strengths recorded</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <AlertCircle size={14} /> Areas to Improve
                        </p>
                        <ul className="space-y-1.5">
                          {(feedback.improvements || []).map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm text-white/75 leading-relaxed">
                              <span className="text-amber-400 mt-1">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                          {(!feedback.improvements || !feedback.improvements.length) && (
                            <li className="text-sm text-white/40 italic">Nothing flagged.</li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Overall coaching summary block */}
                    {interviewEnded && coachingSummary && (
                      <div className="relative rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20 p-5 italic">
                        <Quote size={22} className="absolute top-3 left-3 text-[#A855F7]/40" />
                        <div className="pl-9">
                          <p className={`text-base font-semibold not-italic mb-1 ${coachingSummary.gradeColor}`}>
                            {coachingSummary.grade} — {coachingSummary.score}/100
                          </p>
                          <p className="text-sm text-white/75 leading-relaxed">
                            {coachingSummary.strengths.slice(0, 2).join('. ')}
                            {coachingSummary.issues.length > 0 &&
                              ` Focus next on: ${coachingSummary.issues[0]}.`}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Voice coaching cards (additive) */}
              {voiceCoaching.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">
                    Voice Coaching
                  </p>
                  {voiceCoaching.map((item, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-4 bg-[#0D1117] border-l-2 border-t border-r border-b border-white/[0.06] ${
                        item.priority === 'high'
                          ? 'border-l-red-400'
                          : item.priority === 'good'
                          ? 'border-l-emerald-400'
                          : 'border-l-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{item.icon}</span>
                        <span className="text-sm font-semibold text-white">{item.metric}</span>
                        <span className="ml-auto text-xs text-white/40">
                          {item.current} · target {item.target}
                        </span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed">{item.tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>

            {/* ════════════ RIGHT COLUMN — Expression Coach ════════════ */}
            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="lg:col-span-1 space-y-4"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera size={16} className="text-[#A855F7]" />
                  <h3 className="text-sm font-semibold text-white">Expression Coach</h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400">
                  <span className="relative flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400"></span>
                  </span>
                  live
                </div>
              </div>

              {/* Webcam overlay */}
              <FaceExpressionOverlay
                ref={faceOverlayRef}
                active={interviewStarted}
              />

              {/* End-of-session coaching summary — only renders after End Interview.
                  Live per-frame tips already render inside FaceExpressionOverlay above. */}
              {expressionCoaching.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">
                    Session Coaching
                  </p>
                  {expressionCoaching.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-[#0D1117] border-l-2 border-l-[#A855F7] border-t border-r border-b border-white/[0.06] p-3 flex gap-2.5"
                    >
                      <span className="text-base leading-none mt-0.5">{item.icon}</span>
                      <p className="text-xs text-white/80 leading-relaxed">{item.tip}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Interview tips */}
              <div className="rounded-xl bg-[#0D1117] border border-white/[0.08] p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm text-white">
                  <Lightbulb size={14} className="text-[#A855F7]" />
                  <span>Interview Tips</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-white/60">
                  <li>• Pause before answering to gather thoughts</li>
                  <li>• Use specific examples from your experience</li>
                  <li>• Structure with STAR (Situation, Task, Action, Result)</li>
                  <li>• Be honest about gaps; show how you'd close them</li>
                  <li>• Ask clarifying questions when needed</li>
                </ul>
              </div>
            </motion.aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default MockInterview;
