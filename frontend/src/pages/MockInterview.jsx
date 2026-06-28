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
import API_URL from '../config';

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
      icon: '',
      priority: 'high',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `You are speaking too slowly at ${wpm} WPM. Increase your pace — slow speech can signal low confidence to interviewers.`,
    });
  } else if (wpm < 110) {
    coaching.push({
      icon: '',
      priority: 'medium',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `Your pace at ${wpm} WPM is slightly slow. Aim for 110–160 WPM to sound more energetic and confident.`,
    });
  } else if (wpm > 180) {
    coaching.push({
      icon: '',
      priority: 'high',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `You are speaking too fast at ${wpm} WPM. Slow down so the interviewer can absorb your answer clearly.`,
    });
  } else if (wpm > 160) {
    coaching.push({
      icon: '',
      priority: 'medium',
      metric: 'Speaking Rate',
      current: `${wpm} WPM`,
      target: '110–160 WPM',
      tip: `Your pace at ${wpm} WPM is slightly fast. Take brief pauses between points to let your answer land.`,
    });
  } else {
    coaching.push({
      icon: '',
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
      icon: '',
      priority: 'high',
      metric: 'Filler Words',
      current: `${fillerCount} fillers`,
      target: '3 or fewer',
      tip: `You used ${fillerCount} filler words (um, uh, like, basically). Replace them with a 1-second pause — silence sounds far more confident than fillers.`,
    });
  } else if (fillerCount > 3) {
    coaching.push({
      icon: '',
      priority: 'medium',
      metric: 'Filler Words',
      current: `${fillerCount} fillers`,
      target: '3 or fewer',
      tip: `${fillerCount} filler words detected. Practice pausing silently instead of saying "um" or "uh" while you think.`,
    });
  } else {
    coaching.push({
      icon: '',
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
      icon: '⏸',
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
      icon: '',
      priority: 'good',
      metric: 'Pause Time',
      current: `${pauseSeconds}s paused`,
      target: 'Under 6s total',
      tip: `Good flow — only ${pauseSeconds}s of total pausing.`,
    });
  }

  return coaching;
}

// =====================================================================
// EXPRESSION_TIPS — 7 emotions × 3 confidence tiers × 3 rotating messages.
// Used by selectExpressionTip() to surface phase-aware coaching text
// from the live FaceExpressionOverlay feedback loop.
// =====================================================================
const EXPRESSION_TIPS = {
  happy: {
    high: [
      "Your face is radiating genuine confidence right now — interviewers notice this energy and it makes a strong positive impression. Keep sustaining it through your answer.",
      "That authentic expression signals warmth and enthusiasm. You look like someone who actually wants to be here — hiring managers remember that after the interview ends.",
      "Excellent expression! You are projecting exactly the kind of engaged confidence that top candidates show. This is what interviewers write down in their notes.",
    ],
    medium: [
      "Good positive energy showing on your face. Try to let it come through even more naturally as you speak — let your enthusiasm for this role show fully.",
      "Your expression shows engagement. Channel that into your voice too — let your excitement about this opportunity come through in both face and words simultaneously.",
      "Nice warmth in your expression. When you naturally smile while making a key point, it reinforces your confidence and makes your answer far more memorable.",
    ],
    low: [
      "A slight positive expression is emerging — good start. Let it develop more fully so the interviewer can clearly read your enthusiasm and genuine interest in this role.",
      "Your face is hinting at warmth. Do not hold back — genuine positive expression builds immediate rapport that carries through the entire interview.",
      "Mild positive cue detected. Lean into it — a fuller expression of enthusiasm will make your answer land with significantly more impact on the interviewer.",
    ],
  },
  neutral: {
    high: [
      "Your face is very flat and difficult to read right now. Even during a technical answer, try raising your eyebrows slightly or nodding — it shows active engagement rather than blankness to the interviewer.",
      "Sustained neutral expression can read as disinterest or concealed nerves to an interviewer who cannot hear your thoughts. Try adding subtle facial movement — a nod, a slight lean, a purposeful look that signals you are invested.",
      "You look composed but emotionally absent on camera. Interviewers form lasting impressions within seconds — vary your expression to signal that you are genuinely passionate about what you are saying.",
    ],
    medium: [
      "You look calm and composed — that is professionally strong. Just ensure your voice is carrying the engagement your face is not currently showing. Your tone and pacing need to compensate here.",
      "Neutral reads as professional but on camera it can feel flat to the interviewer. Try a subtle nod when making your strongest point — it signals conviction without being overdone or theatrical.",
      "You are holding steady composure. Good foundation. Now push slightly toward warmth — a small natural smile or raised brow when emphasizing your key point will make it truly stick.",
    ],
    low: [
      "Slightly neutral but perfectly fine mid-answer. Your voice and words are carrying the weight right now — make sure they are doing the job fully since your face is taking a rest.",
      "Mild neutrality is totally acceptable when you are focused on content. Just do not let it persist through the entire answer or it may begin to read as disengagement to a perceptive interviewer.",
      "Composed expression — good for technical precision. When you reach your conclusion, let a brief natural smile or confident nod signal that you stand firmly behind what you just said.",
    ],
  },
  fear: {
    high: [
      "Visible stress is showing on your face and interviewers can read it clearly. Pause for one full second right now, exhale slowly through your nose, and lower your shoulders — this physical reset will visibly calm your expression within moments.",
      "Your face is showing significant anxiety that any interviewer will immediately notice. Take a deliberate breath right now. Nervousness is universal but visibly controlling it is a rare skill that genuinely impresses hiring managers.",
      "Strong stress signals detected on your face. It is completely acceptable to say 'Let me gather my thoughts for a moment.' That brief pause actually makes you look more thoughtful and measured, not less prepared.",
    ],
    medium: [
      "Some nervousness is showing around your eyes and brow. Try slowing your speech by about twenty percent — when you speak more deliberately you naturally appear more confident and your facial muscles visibly relax.",
      "Mild stress expression detected. Make deliberate eye contact with the camera for two full seconds — this simple act resets your facial tension and projects renewed confidence to the interviewer.",
      "Slight anxiety visible on your face. Try unclenching your jaw and taking a quiet breath through your nose right now. Your face will visibly soften and your next sentence will sound far more controlled and assured.",
    ],
    low: [
      "Very mild tension detected — this is probably just intense focus. Ensure you are breathing regularly because holding your breath creates visible facial tension even when you feel completely calm inside.",
      "Slight stress cue showing. You are likely perfectly fine but check your posture — slouching amplifies facial tension significantly. Sit up straight and your expression will naturally open up and appear more confident.",
      "Minor tension detected. This is completely common when concentrating hard on a complex answer. A quiet deliberate exhale between sentences will keep your expression open, engaged, and professional throughout.",
    ],
  },
  sad: {
    high: [
      "Your expression looks deflated or disengaged right now, which can seriously undermine even an excellent answer. Lean forward slightly and raise your eyebrows — these two changes immediately signal energy and genuine investment to the interviewer.",
      "Low energy is showing very clearly on your face. Think actively about why you genuinely want this specific role and let that authentic motivation show through. Interviewers hire people who visibly look like they want to be there.",
      "Your face looks withdrawn and that is negatively affecting your overall presence. This often signals mental fatigue mid-interview. A small physical shift — sit up, take a breath, make purposeful eye contact — will reset your visible energy immediately.",
    ],
    medium: [
      "Slightly low energy expression detected. Try a subtle forward lean and make your next point with more deliberate, sustained eye contact — these two adjustments alone will shift how the interviewer perceives your engagement level.",
      "Your expression energy has dipped noticeably. Raise your eyebrows just slightly when making your next key statement — it instantly signals enthusiasm and keeps the interviewer actively engaged with you and your answer.",
      "Mild disengagement showing on your face. This commonly happens after a long complex answer. End your current point cleanly, take a visible breath, and begin your next sentence with clearly renewed facial energy and purpose.",
    ],
    low: [
      "Very slight energy dip detected — you may simply be thinking deeply. Ensure your face reflects your genuine engagement with the question so the interviewer reads active interest rather than fatigue or indifference.",
      "Minor low-energy cue. Quick effective fix: think right now of one specific thing you genuinely find exciting about this role. That authentic thought will naturally and visibly shift your expression within the next five seconds.",
      "Subtle expression drop detected. You are likely completely fine but stay consciously aware of keeping your face active — nod, vary your expression naturally, show the interviewer that you are fully present and invested in this conversation.",
    ],
  },
  angry: {
    high: [
      "Your expression looks tense or frustrated and this reads as aggression to an interviewer — even if you feel absolutely neither. Consciously unclench your jaw and deliberately soften your brow right now before continuing your answer.",
      "Strong tension detected in your facial expression. Interviewers cannot know what you are feeling internally — they only see and judge your face. Soften your expression deliberately and purposefully before your next sentence.",
      "Visible facial tension is showing throughout your face. Take a slow deliberate breath and consciously relax the muscles around your eyes and forehead. A visibly tense face undermines even the most perfectly structured, brilliant answer.",
    ],
    medium: [
      "A slight frown or brow tension is showing. This may genuinely just be deep concentration but it reads as frustration or irritation. Lift your brow slightly and soften your jaw — your entire expression will open up immediately.",
      "Mild tension detected around your brow area. When you make your next key point, pair it with a small genuine nod rather than a furrowed concentrated look — it projects confident conviction rather than visible strain.",
      "Some facial tightness detected. Between sentences, briefly release your jaw — let it drop slightly and then close naturally. This simple micro-reset keeps your expression open, professional, and approachable throughout your answer.",
    ],
    low: [
      "Very slight tension detected — almost certainly just deep focus. Stay aware of your jaw specifically; many people clench unconsciously when concentrating intensely. A quick deliberate release will keep your expression relaxed and open.",
      "Minor brow tension showing. Totally common when thinking through a complex answer. After your next sentence, take one breath and consciously soften your forehead before continuing — it takes less than two seconds.",
      "Mild expression tightness. You are probably completely fine — just stay consciously aware of keeping your face open and relaxed. Tension in the face amplifies noticeably under camera lighting that video interviews use.",
    ],
  },
  surprise: {
    high: [
      "You look visibly caught off guard by this question. It is entirely fine and even respected to say 'That is a great question — let me think for just a moment.' That composed response signals thoughtfulness and self-awareness, not weakness.",
      "Strong surprise expression detected on your face. Take a full breath and collect yourself before beginning your answer. An interviewer will respect a composed two-second pause far more than a rushed, visibly flustered response.",
      "Your face showed clear surprise. Own it gracefully by staying calm — allow a small natural smile, take a breath, and begin your answer deliberately. Recovering composure gracefully under pressure is itself a powerful interview signal.",
    ],
    medium: [
      "Eyebrow raise detected — this can read as uncertainty or being underprepared to an observant interviewer. Take one breath, let your expression settle into calm composure, then begin your answer with a steady, confident opening sentence.",
      "Mild surprise showing on your face. This is a natural reaction when a question lands differently than you expected. Pause briefly, let your expression return to neutral-confident, and then frame your answer clearly and deliberately.",
      "Surprise cue detected. Quick effective reset: exhale, consciously soften your expression, and start your answer with a brief framing sentence — this buys you a valuable moment of composure and reads as thoughtful rather than caught off guard.",
    ],
    low: [
      "Brief surprise expression — very minor and probably invisible to most human interviewers. Just ensure your very next sentence comes out completely steady and confident so there is absolutely no lingering uncertainty visible.",
      "Slight eyebrow raise detected. Natural reaction — just stay aware that in video interviews every micro-expression gets amplified by the camera. Move smoothly and deliberately into your answer with a composed, settled face.",
      "Very mild surprise cue detected. Completely fine — just take one breath before answering and begin with a calm, deliberate opening sentence. Composure recovers remarkably quickly when you are consciously aware of it.",
    ],
  },
  disgust: {
    high: [
      "Your expression may be reading as dismissive or closed-off to the interviewer, even if that is genuinely not your intention. Consciously relax your entire face into an open, engaged, neutral expression right now before continuing.",
      "Strong negative expression detected on your face. Regardless of what you are actually feeling inside, your face is the only signal the interviewer can see and judge. Reset to an open, engaged expression — it takes just one deliberate breath.",
      "Your facial expression appears closed or negative to an outside observer. This can seriously undermine even your strongest answer. Focus on keeping your face deliberately open and your brow visibly relaxed — let your words carry all the critical thinking.",
    ],
    medium: [
      "Slight negative expression showing on your face. This may simply be concentration but it reads as displeasure or dismissiveness on camera. Consciously lift your expression — a small nod or slight smile will counteract it immediately and effectively.",
      "Mild closed expression detected. Keep your face deliberately open and inviting when discussing complex or challenging topics — interviewers naturally read facial negativity as a personality and attitude signal, not merely a momentary reaction.",
      "Some expression tightness showing around your mouth or nose area. Quick effective fix: take a breath, slightly raise the corners of your mouth naturally, and your expression will shift to open and professional within seconds.",
    ],
    low: [
      "Very slight expression shift detected. You are almost certainly fine — just stay aware that camera environments significantly amplify even subtle expressions that would go unnoticed in person. Keep your face deliberately open and inviting.",
      "Minor expression cue detected. Probably just deep focus on your answer content. Stay consciously aware of keeping your face inviting and open, especially when answering questions that require careful critical or analytical thinking.",
      "Mild expression detected. Nothing serious at all — just a useful reminder to stay aware of your face as an active communication tool. Open, engaged expressions build genuine rapport even during the most technical or complex answers.",
    ],
  },
};

// Per-call rotating selector. `score` is a 0..1 fractional confidence
// from FaceExpressionOverlay's median-voted smoothed reading.
function selectExpressionTip(label, score) {
  if (!label || !EXPRESSION_TIPS[label]) return null;
  const tips = EXPRESSION_TIPS[label];
  let tier;
  if (score >= 0.78)      tier = 'high';
  else if (score >= 0.62) tier = 'medium';
  else                    tier = 'low';
  const pool = tips[tier];
  // Rotate through 3 messages so same tip never repeats back to back
  const idx = Math.floor(Date.now() / 25000) % pool.length;
  return pool[idx];
}

// Phase-aware prefix prepended to live coaching tips so the same emotion
// reads differently while listening vs. answering vs. between questions.
const PHASE_PREFIX = {
  listening:  'Stay focused \u2014 ',
  thinking:   'While you think \u2014 ',
  answering:  'As you answer \u2014 ',
  transition: 'Between questions \u2014 ',
  idle:       '',
};

// Bucket every accepted frame by its questionIndex and synthesise a
// per-question narrative + dominant emotion + stress percentage. Drives
// the post-interview "Emotional Journey Per Question" card.
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
    const total    = frames.length;
    const negCount = frames.filter((f) => NEGATIVE.has(f.label)).length;
    const posCount = frames.filter((f) => POSITIVE.has(f.label)).length;
    const negPct   = Math.round((negCount / total) * 100);
    const posPct   = Math.round((posCount / total) * 100);
    const freq     = {};
    for (const f of frames) freq[f.label] = (freq[f.label] || 0) + 1;
    const dominant = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])[0][0];
    let narrative = '';
    if (negPct >= 40)
      narrative = `High stress detected (${negPct}% tense expressions) \u2014 this topic challenged your composure. Practice it until your face matches your knowledge level.`;
    else if (negPct >= 20)
      narrative = `Some tension detected (${negPct}% negative expressions) \u2014 mostly composed with occasional nerves showing through. Good recovery overall.`;
    else if (posPct >= 50)
      narrative = `Strong confident delivery \u2014 positive and engaged throughout (${posPct}% confident expressions). This is your best answer in terms of presence.`;
    else
      narrative = 'Composed and steady delivery \u2014 good consistent emotional control maintained across this entire answer.';
    trends.push({ questionIndex: i, dominant, negPct, posPct, narrative, frameCount: total });
  }
  return trends;
}

// Roll the final emotion distribution + per-question trends into a single
// 0-100 "Interview Presence Score" with three subscores and an
// improvement-arc bonus that rewards candidates whose composure
// strengthened across the session.
function computePresenceScore(summary, questionTrends) {
  if (!summary) return null;
  const { negativePct = 0, distribution = {} } = summary;
  const happyPct   = distribution.happy   || 0;
  const neutralPct = distribution.neutral || 0;
  const confidenceScore = Math.min(100,
    Math.round(happyPct + neutralPct * 0.6));
  const composureScore = Math.min(100,
    Math.max(0, Math.round(100 - negativePct * 2.2)));
  const flatnessPenalty = neutralPct > 85 ? (neutralPct - 85) * 1.5 : 0;
  const engagementScore = Math.min(100,
    Math.max(0, Math.round(100 - flatnessPenalty + happyPct * 0.3)));
  let trendBonus = 0;
  if (questionTrends && questionTrends.length >= 3) {
    const valid = questionTrends.filter(Boolean);
    if (valid.length >= 3) {
      const third = Math.max(1, Math.floor(valid.length / 3));
      const firstThird = valid.slice(0, third);
      const lastThird  = valid.slice(-third);
      const avgFirst = firstThird.reduce((a, b) => a + b.negPct, 0) / firstThird.length;
      const avgLast  = lastThird.reduce((a, b) => a + b.negPct, 0) / lastThird.length;
      trendBonus = Math.round((avgFirst - avgLast) * 0.5);
    }
  }
  const presenceScore = Math.min(100, Math.max(0,
    Math.round(
      0.35 * confidenceScore +
      0.30 * composureScore +
      0.20 * engagementScore +
      0.15 * (50 + trendBonus)
    )
  ));
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

function generateSessionId() {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  const [interviewProfile, setInterviewProfile] = useState(null); // candidate profile snapshot for backend RAG
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const sessionIdRef = useRef(sessionId);
  const [skillsTested, setSkillsTested] = useState([]);
  const [conceptsCovered, setConceptsCovered] = useState([]);
  const [conceptsMissing, setConceptsMissing] = useState([]);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [coveragePct, setCoveragePct] = useState(null);
  const [missingConceptsFeedback, setMissingConceptsFeedback] = useState('');

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
  // Per-question emotional-journey trends + composite presence score —
  // populated by computePerQuestionTrend() / computePresenceScore() at
  // end-of-interview from FaceExpressionOverlay's rawLog.
  const [questionTrends, setQuestionTrends] = useState([]);
  const [presenceData,   setPresenceData]   = useState(null);
  // Phase-aware coaching: idle | listening | thinking | answering | transition
  const [interviewPhase, setInterviewPhase] = useState('idle');
  // Synced ref so FaceExpressionOverlay can tag every accepted frame with
  // the question it belongs to (drives the per-question trend card).
  const currentQuestionIndexRef = useRef(0);

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

  }, [interviewEnded]);

  const jobRoles = [
    { value: 'frontend', label: 'Frontend Developer', icon: '' },
    { value: 'backend', label: 'Backend Developer', icon: '' },
    { value: 'fullstack', label: 'Full Stack Developer', icon: '' },
    { value: 'data-science', label: 'Data Scientist', icon: '' },
    { value: 'mobile', label: 'Mobile Developer', icon: '' },
    { value: 'devops', label: 'DevOps Engineer', icon: '' },
    { value: 'ui-ux', label: 'UI/UX Designer', icon: '' },
    { value: 'product-manager', label: 'Product Manager', icon: '' },
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

  // Generate interview question via backend (server-side RAG + HF Llama)
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
      setSessionQuestions(prev => [...prev, question]);
      toast.success('New question generated!');
    } catch (error) {
      console.error('Error generating question:', error);
      toast.error('Failed to generate question. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, difficulty, questionNumber, sessionQuestions, interviewProfile, sessionId]);

  // Evaluate answer via backend (server-side RAG + HF Llama)
  const evaluateAnswer = useCallback(async () => {
    if (!userAnswer.trim()) {
      toast.error('Please provide an answer');
      return;
    }

    // Phase: answer submitted, switching to transition while feedback arrives.
    setInterviewPhase('transition');
    setLoading(true);
    try {
      const apiUrl = API_URL.replace(/\/+$/, '');
      // Emotion fields are passed through whenever they are available.
      // In the current pipeline these are populated only AFTER endInterview
      // runs finalize() on FaceExpressionOverlay, so per-question evals
      // here will see them as null — the backend gracefully ignores nulls
      // and the response’s expression_feedback comes back as null too.
      // The wiring is in place for a future per-question snapshot call.
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
          // Optional multimodal payload — all null during per-question evals.
          emotionSummary: emotionSummary ? {
            dominantEmotion: emotionSummary.dominant,
            negativePct:     emotionSummary.negativePct,
            dominantPct:     emotionSummary.dominantPct,
            totalFrames:     emotionSummary.totalFrames,
          } : null,
          presenceScore:    presenceData?.presenceScore  ?? null,
          dominantEmotion:  emotionSummary?.dominant     ?? null,
          negativePct:      emotionSummary?.negativePct  ?? null,
          // Per-question trend snapshot (if we ever get one before eval).
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
  ]);

  // Start interview — snapshot the user's profile so subsequent
  // question/evaluate calls can ground server-side RAG, then generate Q1.
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
    // ── CHANGE 5: Clear coaching state on restart ──
    setVoiceCoaching([]);
    setExpressionCoaching([]);
    setCoachingSummary(null);
    setInterviewEnded(false);
    liveEmotionsRef.current = null;
    // Reset per-question trend tracking + phase
    setQuestionTrends([]);
    setPresenceData(null);
    currentQuestionIndexRef.current = 0;
    setInterviewPhase('listening');

    // Fetch the candidate profile from Firestore and snapshot it so the
    // backend can use it for RAG retrieval on every /interview/* call.
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

  // Next question
  const nextQuestion = useCallback(() => {
    setQuestionNumber((prev) => {
      const next = prev + 1;
      // Keep the synced ref aligned so FaceExpressionOverlay tags every
      // future accepted frame with the right question index.
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
      // ── Per-question trends + composite presence score (Tasks 9-11) ──
      const log = summary.rawLog || [];
      const totalForTrend = Math.max(questionNumber + 1, 1);
      const trends = computePerQuestionTrend(log, totalForTrend);
      setQuestionTrends(trends);
      setPresenceData(computePresenceScore(summary, trends));
    }
    setInterviewPhase('idle');
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
      // Phase: candidate is now actively answering on camera.
      setInterviewPhase('answering');
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
                 Mock Interview Practice
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
                {/* Interview Presence Score \u2014 sits ABOVE the legacy emotion
                    summary so it leads the post-interview results section. */}
                {presenceData && (
                  <div className="neon-card p-5 mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <span>\ud83c\udfaf</span> Interview Presence Score
                      </h3>
                      <div className="text-right">
                        <span className="text-3xl font-bold text-purple-400">
                          {presenceData.presenceScore}
                        </span>
                        <span className="text-[#B3B3C7] text-sm">/100</span>
                        <div className={`text-xs font-semibold mt-0.5 ${
                          presenceData.grade === 'Excellent' ? 'text-green-400' :
                          presenceData.grade === 'Good'      ? 'text-purple-400' :
                          presenceData.grade === 'Developing'? 'text-yellow-400' :
                                                              'text-red-400'
                        }`}>{presenceData.grade}</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#B3B3C7]">\ud83d\ude0a Confidence Signal</span>
                          <span className="text-white font-semibold">
                            {presenceData.confidenceScore}/100
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-green-400 rounded-full transition-all duration-700"
                            style={{ width: `${presenceData.confidenceScore}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#B3B3C7]">\ud83e\udde0 Composure Under Pressure</span>
                          <span className="text-white font-semibold">
                            {presenceData.composureScore}/100
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-400 rounded-full transition-all duration-700"
                            style={{ width: `${presenceData.composureScore}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#B3B3C7]">\u26a1 Engagement Consistency</span>
                          <span className="text-white font-semibold">
                            {presenceData.engagementScore}/100
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full transition-all duration-700"
                            style={{ width: `${presenceData.engagementScore}%` }} />
                        </div>
                      </div>
                      {presenceData.trendBonus !== 0 && (
                        <div className={`text-xs rounded-lg px-3 py-2 mt-1 ${
                          presenceData.trendBonus > 0
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {presenceData.trendBonus > 0
                            ? `\ud83d\udcc8 Improvement Arc: +${presenceData.trendBonus} pts \u2014 your composure strengthened as the interview progressed. Excellent self-regulation under sustained pressure.`
                            : `\ud83d\udcc9 Fatigue Arc: ${presenceData.trendBonus} pts \u2014 stress increased toward the end. Practice sustaining calm composure across longer multi-question interviews.`
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

                {/* Per-question emotional-journey trends \u2014 sits directly
                    below the Expression Analysis card. */}
                {questionTrends.length > 0 && (
                  <div className="neon-card p-5 mt-4">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <span>\ud83d\udcca</span> Emotional Journey Per Question
                    </h3>
                    <div className="space-y-3">
                      {questionTrends.map((trend, i) => trend && (
                        <div key={i} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-purple-400 text-sm font-semibold">
                              Question {i + 1}
                            </span>
                            <span className="text-xs text-[#B3B3C7]">
                              {trend.frameCount} frame{trend.frameCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-white text-sm capitalize">
                              {trend.dominant === 'happy'    ? '\ud83d\ude0a' :
                               trend.dominant === 'neutral'  ? '\ud83d\ude10' :
                               trend.dominant === 'fear'     ? '\ud83d\ude28' :
                               trend.dominant === 'sad'      ? '\ud83d\ude22' :
                               trend.dominant === 'angry'    ? '\ud83d\ude20' :
                               trend.dominant === 'surprise' ? '\ud83d\ude2e' :
                               trend.dominant === 'disgust'  ? '\ud83e\udd22' : '\ud83d\ude10'
                              } {trend.dominant}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              trend.negPct >= 40
                                ? 'bg-red-500/20 text-red-400'
                                : trend.negPct >= 20
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-green-500/20 text-green-400'
                            }`}>
                              {trend.negPct >= 40 ? 'High stress' :
                               trend.negPct >= 20 ? 'Some tension' : 'Composed'}
                            </span>
                          </div>
                          <p className="text-[#B3B3C7] text-xs leading-relaxed">
                            {trend.narrative}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* \u2500\u2500 CHANGE 2: Expression Coaching on setup screen \u2500\u2500 */}
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
                       Interview Coaching Summary
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
                           Areas to Improve
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
                           Your Strengths
                        </p>
                        <ul className="space-y-1">
                          {coachingSummary.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[#B3B3C7]">
                              <span className="text-green-400 mt-0.5"></span>
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
                {skillsTested.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 pr-20">
                    {skillsTested.map((skill) => (
                      <span
                        key={skill}
                        className="text-[11px] px-2 py-1 rounded-md bg-purple-500/10 text-purple-200 border border-purple-500/20"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
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
                        {/* Multimodal expression insight — only renders when
                            the backend returned it (i.e. emotion data was sent). */}
                        {feedback.expression_feedback && (
                          <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <p className="text-xs font-semibold text-purple-400 mb-1">
                               Expression Insight
                            </p>
                            <p className="text-[#B3B3C7] text-sm leading-relaxed">
                              {feedback.expression_feedback}
                            </p>
                          </div>
                        )}
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

                    {scoreBreakdown && (
                      <div className="pt-2 border-t border-white/[0.06]">
                        <p className="text-[11px] text-white/40 uppercase tracking-widest mb-3">
                          Score Breakdown
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {[
                            ['Core concepts', scoreBreakdown.core_concepts, 40],
                            ['Technical depth', scoreBreakdown.technical_depth, 30],
                            ['Practical example', scoreBreakdown.practical_example, 20],
                            ['Clarity', scoreBreakdown.clarity, 10],
                          ].map(([label, value, max]) => {
                            const pct = Math.max(0, Math.min(100, Math.round(((value || 0) / max) * 100)));
                            return (
                              <div key={label} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-white/60">{label}</span>
                                  <span className="text-white/80">{value || 0}/{max}</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#A855F7]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(conceptsCovered.length > 0 || conceptsMissing.length > 0 || coveragePct !== null) && (
                      <div className="pt-2 border-t border-white/[0.06] space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-white/40 uppercase tracking-widest">
                            Concept Coverage
                          </p>
                          {coveragePct !== null && (
                            <span className="text-xs font-semibold text-purple-300">{coveragePct}%</span>
                          )}
                        </div>
                        {conceptsCovered.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {conceptsCovered.map((concept) => (
                              <span
                                key={`covered-${concept}`}
                                className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-200 border border-emerald-500/20"
                              >
                                {concept}
                              </span>
                            ))}
                          </div>
                        )}
                        {conceptsMissing.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {conceptsMissing.map((concept) => (
                              <span
                                key={`missing-${concept}`}
                                className="text-[11px] px-2 py-1 rounded-md bg-amber-500/10 text-amber-200 border border-amber-500/20"
                              >
                                {concept}
                              </span>
                            ))}
                          </div>
                        )}
                        {missingConceptsFeedback && (
                          <p className="text-xs text-white/60 leading-relaxed">
                            {missingConceptsFeedback}
                          </p>
                        )}
                      </div>
                    )}

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
                currentQuestionIndexRef={currentQuestionIndexRef}
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
