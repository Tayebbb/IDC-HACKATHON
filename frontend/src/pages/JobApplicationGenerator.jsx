import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Sparkles, FileText, Zap, CheckCircle, ArrowRight, Loader } from 'lucide-react';
import { AILoading } from '../components/branding';
import toast from 'react-hot-toast';
import API_URL from '../config';

export default function JobApplicationGenerator() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [targetJob, setTargetJob] = useState('');
  const [letterContent, setLetterContent] = useState('');
  const [step, setStep] = useState('input');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchUserData();
    }
  }, [currentUser]);

  const fetchUserData = async () => {
    try {
      setIsLoadingProfile(true);
      if (!currentUser?.email) {
        setUserData({ skills: [], experienceLevel: 'beginner', email: '' });
        setIsLoadingProfile(false);
        return;
      }

      let data = null;
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          data = userDocSnap.data();
        }
      } catch (uidErr) {
        console.log('UID query failed, trying email query', uidErr);
      }

      if (!data) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', currentUser.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          data = querySnapshot.docs[0].data();
        }
      }

      if (data) {
        setUserData({
          skills: Array.isArray(data.skills) ? data.skills : [],
          experienceLevel: data.experienceLevel || 'beginner',
          email: data.email || currentUser.email
        });
      } else {
        setUserData({ skills: [], experienceLevel: 'beginner', email: currentUser.email });
      }
      setIsLoadingProfile(false);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setUserData({ skills: [], experienceLevel: 'beginner', email: currentUser?.email || '' });
      setIsLoadingProfile(false);
    }
  };

  const generateLetter = async () => {
    if (!targetJob.trim()) {
      toast.error('Please enter the target job title');
      return;
    }

    setStep('loading');
    setLoading(true);
    setError(null);

    try {
      const apiUrl = API_URL.replace(/\/+$/, '');
      const res = await fetch(`${apiUrl}/generate-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetJob, profile: userData }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Generation request failed (${res.status})`);
      }
      const resData = await res.json();
      const content = resData.content || '';
      if (!content) throw new Error('No content returned from AI assistant');

      setLetterContent(content);
      setStep('display');
      toast.success('Job application letter generated!');
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to generate cover letter');
      setStep('input');
      toast.error(err.message || 'Failed to generate cover letter');
    } finally {
      setLoading(false);
    }
  };

  const resetGenerator = () => {
    setLetterContent('');
    setTargetJob('');
    setStep('input');
    setError(null);
  };

  const downloadLetter = () => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(letterContent));
    element.setAttribute('download', `application-letter-${targetJob.replace(/\s+/g, '-')}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Cover letter downloaded!');
  };

  return (
    <div style={styles.container}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={styles.header}
      >
        <div style={styles.headerIcon}>
          <FileText size={28} style={{ color: '#FFFFFF' }} />
        </div>
        <div>
          <h1 style={styles.title}>AI Job Application Generator</h1>
          <p style={styles.subtitle}>Generate RAG-customized application and cover letters instantly</p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {isLoadingProfile && (
          <motion.div
            key="profile-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.loadingContainer}
          >
            <div style={styles.loadingContent}>
              <Loader size={48} style={{ color: 'rgb(var(--c-primary))', animation: 'spin 2s linear infinite' }} />
              <h3 style={styles.loadingText}>Loading profile context...</h3>
            </div>
          </motion.div>
        )}

        {!isLoadingProfile && step === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={styles.content}
          >
            {userData && (
              <div style={styles.profileCard}>
                <h2 style={styles.sectionTitle}>Your Profile Insights</h2>
                <div style={styles.profileInfo}>
                  <div style={styles.profileItem}>
                    <span style={styles.label}>Experience Level:</span>
                    <span style={styles.value}>
                      {userData.experienceLevel?.charAt(0).toUpperCase() + userData.experienceLevel?.slice(1)}
                    </span>
                  </div>
                  <div style={styles.profileItem}>
                    <span style={styles.label}>Profile Skills:</span>
                    <div style={styles.skillsTags}>
                      {userData.skills?.length > 0 ? (
                        userData.skills.map((skill, idx) => (
                          <span key={idx} style={styles.skillTag}>{skill}</span>
                        ))
                      ) : (
                        <span style={styles.noSkills}>No profile skills detected</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={styles.inputCard}>
              <h2 style={styles.sectionTitle}>Target Job Information</h2>
              <p style={styles.inputDescription}>
                Enter the job title you are applying for to generate a custom matching application letter.
              </p>
              <div style={styles.inputGroup}>
                <Sparkles size={20} style={{ color: 'rgb(var(--c-primary))' }} />
                <input
                  type="text"
                  value={targetJob}
                  onChange={(e) => setTargetJob(e.target.value)}
                  placeholder="e.g., Associate QA Engineer, Frontend React Developer..."
                  style={styles.input}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') generateLetter();
                  }}
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateLetter}
                disabled={loading || !targetJob.trim()}
                style={{
                  ...styles.generateButton,
                  opacity: loading || !targetJob.trim() ? 0.5 : 1,
                  cursor: loading || !targetJob.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? (
                  <>
                    <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Analyzing Profile & Generating...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Generate Job Application
                  </>
                )}
              </motion.button>
            </div>

            {error && (
              <div style={styles.errorCard}>
                <p style={styles.errorText}>{error}</p>
              </div>
            )}
          </motion.div>
        )}

        {!isLoadingProfile && step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.loadingContainer}
          >
            <div style={styles.loadingContent}>
              <AILoading size={72} label="Tailoring cover letter using RAG database..." />
              <p style={styles.loadingSubtext}>Matching your technical skills to the job description requirements</p>
            </div>
          </motion.div>
        )}

        {!isLoadingProfile && step === 'display' && letterContent && (
          <motion.div
            key="display"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={styles.content}
          >
            <div style={styles.roadmapHeader}>
              <div>
                <h2 style={styles.roadmapTitle}>Custom Cover Letter</h2>
                <p style={styles.roadmapSubtitle}>Tailored specifically for: {targetJob}</p>
              </div>
              <CheckCircle size={32} style={{ color: '#10B981' }} />
            </div>

            <div style={styles.letterWrapper}>
              <pre style={styles.letterText}>{letterContent}</pre>
            </div>

            <div style={styles.actionButtons}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetGenerator}
                style={styles.secondaryButton}
              >
                Generate Another
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadLetter}
                style={styles.primaryButton}
              >
                Download Letter (.txt)
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '24px',
    fontFamily: 'Poppins, Inter, system-ui, sans-serif',
    minHeight: 'calc(100vh - 160px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '40px',
    padding: '24px',
    background: 'rgba(17,21,43,0.6)',
    borderRadius: '16px',
    border: '1px solid rgb(var(--c-primary) / 0.12)',
  },
  headerIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, rgb(var(--c-primary)), #7C3AED)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    color: '#FFFFFF',
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    background: 'linear-gradient(90deg, rgb(var(--c-primary)), rgb(var(--c-accent-pink)))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    margin: '4px 0 0 0',
    fontSize: '14px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  profileCard: {
    padding: '24px',
    background: 'rgba(17,21,43,0.4)',
    borderRadius: '16px',
    border: '1px solid rgb(var(--c-primary) / 0.08)',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 16px 0',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  profileItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '120px',
  },
  value: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '500',
  },
  skillsTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  skillTag: {
    display: 'inline-block',
    padding: '6px 12px',
    background: 'rgb(var(--c-primary) / 0.2)',
    color: 'rgb(var(--c-primary))',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid rgb(var(--c-primary) / 0.3)',
  },
  noSkills: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  inputCard: {
    padding: '24px',
    background: 'rgba(17,21,43,0.4)',
    borderRadius: '16px',
    border: '1px solid rgb(var(--c-primary) / 0.08)',
  },
  inputDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    margin: '0 0 16px 0',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    border: '1px solid rgb(var(--c-primary) / 0.15)',
    marginBottom: '16px',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '15px',
    outline: 'none',
    fontFamily: 'Poppins, Inter, system-ui, sans-serif',
  },
  generateButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, rgb(var(--c-primary)), #7C3AED)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgb(var(--c-primary) / 0.3)',
  },
  errorCard: {
    padding: '16px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '12px',
  },
  errorText: {
    color: '#FCA5A5',
    margin: 0,
    fontSize: '14px',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  loadingContent: {
    textAlign: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 8px 0',
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
    margin: 0,
  },
  roadmapHeader: {
    padding: '32px',
    background: 'linear-gradient(135deg, rgb(var(--c-primary) / 0.2), rgb(var(--c-accent-pink) / 0.1))',
    borderRadius: '20px',
    border: '1px solid rgb(var(--c-primary) / 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 8px 24px rgb(var(--c-primary) / 0.15)',
  },
  roadmapTitle: {
    color: '#FFFFFF',
    fontSize: '32px',
    fontWeight: '800',
    margin: '0 0 12px 0',
    background: 'linear-gradient(135deg, #E879F9, rgb(var(--c-primary)), rgb(var(--c-accent-pink)))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  roadmapSubtitle: {
    color: '#D1D5DB',
    fontSize: '16px',
    margin: 0,
    fontWeight: '500',
  },
  letterWrapper: {
    padding: '32px',
    background: 'rgba(17,21,43,0.8)',
    borderRadius: '16px',
    border: '1px solid rgb(var(--c-primary) / 0.2)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  letterText: {
    whiteSpace: 'pre-wrap',
    color: '#E0E7FF',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: 0
  },
  actionButtons: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '24px',
  },
  primaryButton: {
    padding: '14px 32px',
    background: 'linear-gradient(135deg, rgb(var(--c-primary)), #7C3AED)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgb(var(--c-primary) / 0.4)',
    transition: 'all 0.3s ease',
  },
  secondaryButton: {
    padding: '14px 32px',
    background: 'rgb(var(--c-primary) / 0.1)',
    color: '#E879F9',
    border: '2px solid rgb(var(--c-primary) / 0.4)',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
};
