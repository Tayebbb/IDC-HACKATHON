/**
 * Mock Interview Practice Page
 * AI-powered interview practice with real-time feedback
 */

import { useState, useEffect, useCallback } from 'react';
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
  AlertCircle,
  Video,
  MessageSquare,
  BookOpen,
  Award,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

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

  // Generate interview question using Gemini AI
  const generateQuestion = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/generate-interview-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          difficulty: difficulty,
          questionNumber: questionNumber + 1,
          previousQuestions: sessionQuestions // Send previous questions to avoid duplicates
        })
      });

      if (!response.ok) throw new Error('Failed to generate question');

      const data = await response.json();
      setCurrentQuestion(data.question);
      setSessionQuestions(prev => [...prev, data.question]);
      
      toast.success('New question generated!');
    } catch (error) {
      console.error('Error generating question:', error);
      toast.error('Failed to generate question. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, difficulty, questionNumber, sessionQuestions]);

  // Evaluate answer using Gemini AI
  const evaluateAnswer = useCallback(async () => {
    if (!userAnswer.trim()) {
      toast.error('Please provide an answer');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/evaluate-interview-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          answer: userAnswer,
          role: selectedRole,
          difficulty: difficulty
        })
      });

      if (!response.ok) throw new Error('Failed to evaluate answer');

      const data = await response.json();
      setFeedback(data);
      
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

  // Start interview
  const startInterview = useCallback(() => {
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
    generateQuestion();
  }, [selectedRole, generateQuestion]);

  // Next question
  const nextQuestion = useCallback(() => {
    setQuestionNumber(prev => prev + 1);
    setUserAnswer('');
    setFeedback(null);
    generateQuestion();
  }, [generateQuestion]);

  // End interview and save to history
  const endInterview = useCallback(async () => {
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

  // Voice recording (placeholder for future implementation)
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      toast.success('Recording stopped');
    } else {
      setIsRecording(true);
      toast.success('Recording started');
    }
  }, [isRecording]);

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
                      Role-specific questions powered by Google Gemini AI
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
          /* Interview Session */
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Question Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Progress */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Question {questionNumber + 1}
                    </h3>
                    <p className="text-sm text-muted">
                      {jobRoles.find(r => r.value === selectedRole)?.label} • {difficulty}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {(sessionScore / Math.max(questionNumber, 1)).toFixed(1)}/10
                    </div>
                    <p className="text-sm text-muted">Avg Score</p>
                  </div>
                </div>
              </motion.div>

              {/* Current Question */}
              <motion.div
                key={questionNumber}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="card"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <BookOpen className="text-primary mt-1" size={24} />
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">Interview Question</h3>
                      {loading && !currentQuestion ? (
                        <div className="animate-pulse space-y-2">
                          <div className="h-4 bg-border rounded w-3/4"></div>
                          <div className="h-4 bg-border rounded w-full"></div>
                        </div>
                      ) : (
                        <p className="text-lg">{currentQuestion}</p>
                      )}
                    </div>
                  </div>
                  {!loading && currentQuestion && !feedback && (
                    <button
                      onClick={generateQuestion}
                      className="btn-outline-neon btn-sm flex items-center space-x-2 ml-2"
                      title="Generate a different question"
                    >
                      <RotateCw size={16} />
                      <span>New Question</span>
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Answer Input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Your Answer</h3>
                  <button
                    onClick={toggleRecording}
                    className={`btn-sm flex items-center space-x-2 ${
                      isRecording ? 'bg-red-500 hover:bg-red-600' : 'btn-outline-neon'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <StopCircle size={16} />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Mic size={16} />
                        <span>Record</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={8}
                  className="input-field w-full mb-4"
                  disabled={loading}
                />

                <div className="flex space-x-3">
                  <button
                    onClick={evaluateAnswer}
                    disabled={loading || !userAnswer.trim()}
                    className="btn-primary flex-1 flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Evaluating...</span>
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        <span>Submit Answer</span>
                      </>
                    )}
                  </button>
                  {feedback && (
                    <button
                      onClick={nextQuestion}
                      className="btn-outline-neon flex items-center space-x-2"
                    >
                      <span>Next Question</span>
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Feedback */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="card border-2 border-primary/30"
                  >
                    <div className="flex items-start space-x-3 mb-4">
                      <Lightbulb className="text-primary mt-1" size={24} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg">AI Feedback</h3>
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl font-bold text-primary">
                              {feedback.score}/10
                            </span>
                          </div>
                        </div>
                        <p className="mb-4">{feedback.feedback}</p>
                        
                        {feedback.strengths && feedback.strengths.length > 0 && (
                          <div className="mb-3">
                            <h4 className="font-semibold text-green-500 mb-2 flex items-center space-x-2">
                              <CheckCircle size={16} />
                              <span>Strengths</span>
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                              {feedback.strengths.map((strength, idx) => (
                                <li key={idx}>{strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {feedback.improvements && feedback.improvements.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-yellow-500 mb-2 flex items-center space-x-2">
                              <TrendingUp size={16} />
                              <span>Areas for Improvement</span>
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                              {feedback.improvements.map((improvement, idx) => (
                                <li key={idx}>{improvement}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Session Info Panel */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="card"
              >
                <h3 className="font-semibold mb-4">Session Stats</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Questions Completed</span>
                    <span className="font-bold">{questionNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Average Score</span>
                    <span className="font-bold text-primary">
                      {questionNumber > 0 ? (sessionScore / questionNumber).toFixed(1) : '0.0'}/10
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Total Score</span>
                    <span className="font-bold">{sessionScore}</span>
                  </div>
                </div>

                <button
                  onClick={endInterview}
                  className="btn-outline-neon w-full mt-6 flex items-center justify-center space-x-2"
                >
                  <StopCircle size={18} />
                  <span>End Interview</span>
                </button>
              </motion.div>

              {/* Tips */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="card"
                style={{ background: 'rgba(168,85,247,0.05)' }}
              >
                <h3 className="font-semibold mb-3 flex items-center space-x-2">
                  <Lightbulb className="text-primary" size={20} />
                  <span>Interview Tips</span>
                </h3>
                <ul className="space-y-2 text-sm text-muted">
                  <li>• Take your time to think before answering</li>
                  <li>• Use specific examples from your experience</li>
                  <li>• Structure your answers (STAR method)</li>
                  <li>• Be honest about what you don't know</li>
                  <li>• Ask clarifying questions if needed</li>
                </ul>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MockInterview;
