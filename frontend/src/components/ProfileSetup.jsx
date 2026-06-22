import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

/**
 * ProfileSetup Component
 * Helps users configure their job matching profile (skills, experience, track)
 * 
 * Usage: Import this into your Profile.jsx or create a separate setup page
 */
const ProfileSetup = ({ initialData = null, onUpdate = null }) => {
  const { currentUser } = useAuth();
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState(initialData?.skills || []);
  const [experienceLevel, setExperienceLevel] = useState(initialData?.experienceLevel || 'beginner');
  const [preferredTrack, setPreferredTrack] = useState(initialData?.preferredTrack || 'fullstack');
  const [saving, setSaving] = useState(false);

  const addSkill = () => {
    const trimmed = skillInput.trim().toLowerCase();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  const saveProfile = async () => {
    if (!currentUser) {
      toast.error('Please sign in first');
      return;
    }

    if (skills.length === 0) {
      toast.error('Please add at least one skill');
      return;
    }

    try {
      setSaving(true);
      const userRef = doc(db, 'users', currentUser.uid);
      
      const profileData = {
        skills,
        experienceLevel,
        preferredTrack
      };

      await updateDoc(userRef, profileData);
      
      toast.success('Profile updated successfully!');
      
      if (onUpdate) {
        onUpdate(profileData);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const experienceLevels = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];

  const tracks = [
    { value: 'frontend', label: 'Frontend Development' },
    { value: 'backend', label: 'Backend Development' },
    { value: 'fullstack', label: 'Full Stack Development' },
    { value: 'mobile', label: 'Mobile Development' },
    { value: 'devops', label: 'DevOps / Cloud' },
    { value: 'data science', label: 'Data Science / ML' },
    { value: 'qa', label: 'QA / Testing' },
    { value: 'ui/ux', label: 'UI/UX Design' }
  ];

  const suggestedSkills = [
    'React', 'JavaScript', 'TypeScript', 'Node.js', 'Python',
    'HTML', 'CSS', 'Tailwind', 'MongoDB', 'Firebase',
    'Git', 'Docker', 'AWS', 'Vue.js', 'Angular',
    'Express', 'Django', 'PostgreSQL', 'MySQL', 'Redis'
  ];

  return (
    <div className="neon-card p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-main mb-6 flex items-center gap-2">
        <span className="text-3xl">🎯</span>
        Job Matching Profile
      </h2>

      {/* Skills Section */}
      <div className="mb-6">
        <label className="block text-main font-semibold mb-2">
          Skills <span className="text-red-400">*</span>
        </label>
        <p className="text-sm text-muted mb-3">
          Add your technical skills (press Enter or click Add after typing each skill)
        </p>
        
        {/* Skill Input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., React, JavaScript, Python..."
            className="input-field flex-1"
          />
          <button
            onClick={addSkill}
            className="btn-primary px-6"
          >
            Add
          </button>
        </div>

        {/* Current Skills */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {skills.map((skill, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-primary/20 border border-primary/40 rounded-full text-sm text-primary flex items-center gap-2"
              >
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  className="hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Suggested Skills */}
        <details className="text-sm">
          <summary className="text-muted cursor-pointer hover:text-primary transition-colors">
            💡 Show suggested skills
          </summary>
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestedSkills.map((skill, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const lower = skill.toLowerCase();
                  if (!skills.includes(lower)) {
                    setSkills([...skills, lower]);
                  }
                }}
                className="px-2 py-1 bg-[#11152B] border border-primary/20 rounded text-xs text-muted hover:text-primary hover:border-primary/40 transition-all"
              >
                + {skill}
              </button>
            ))}
          </div>
        </details>
      </div>

      {/* Experience Level */}
      <div className="mb-6">
        <label className="block text-main font-semibold mb-2">
          Experience Level <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {experienceLevels.map((level) => (
            <button
              key={level.value}
              onClick={() => setExperienceLevel(level.value)}
              className={`p-4 rounded-lg border-2 transition-all ${
                experienceLevel === level.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/20 bg-[#11152B] text-muted hover:border-primary/40'
              }`}
            >
              <div className="font-semibold">{level.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Track */}
      <div className="mb-6">
        <label className="block text-main font-semibold mb-2">
          Preferred Career Track <span className="text-red-400">*</span>
        </label>
        <select
          value={preferredTrack}
          onChange={(e) => setPreferredTrack(e.target.value)}
          className="input-field w-full"
        >
          {tracks.map((track) => (
            <option key={track.value} value={track.value}>
              {track.label}
            </option>
          ))}
        </select>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={saveProfile}
          disabled={saving || skills.length === 0}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-300">
          ℹ️ <strong>Note:</strong> This information will be used to calculate job match scores on the Job Matches page. 
          The more accurate your profile, the better job recommendations you'll receive!
        </p>
      </div>
    </div>
  );
};

export default ProfileSetup;
