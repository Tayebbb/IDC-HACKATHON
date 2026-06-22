/**
 * Calculate job match score for a user
 * @param {Object} userProfile - User profile with skills, experienceLevel, preferredTrack
 * @param {Object} job - Job with skillsRequired, experienceRequired, track
 * @returns {Object} Match details including score, matched/missing skills, notes
 */
export const calculateMatchScore = (userProfile, job) => {
  if (!userProfile || !job) {
    return {
      score: 0,
      matchedSkills: [],
      missingSkills: job?.skillsRequired || [],
      experienceNote: 'Profile incomplete',
      trackNote: 'Profile incomplete'
    };
  }

  const userSkills = (userProfile.skills || []).map(s => s.toLowerCase().trim());
  const jobSkills = (job.skillsRequired || []).map(s => s.toLowerCase().trim());
  const userExp = userProfile.experienceLevel?.toLowerCase() || '';
  const jobExp = job.experienceRequired?.toLowerCase() || '';
  const userTrack = userProfile.preferredTrack?.toLowerCase().trim() || '';
  const jobTrack = job.track?.toLowerCase().trim() || '';

  // 1. SKILL MATCH (60%)
  const matchedSkills = jobSkills.filter(skill => 
    userSkills.some(userSkill => 
      userSkill.includes(skill) || skill.includes(userSkill)
    )
  );
  const missingSkills = jobSkills.filter(skill => !matchedSkills.includes(skill));
  
  const skillScore = jobSkills.length > 0 
    ? (matchedSkills.length / jobSkills.length) * 60 
    : 0;

  // 2. EXPERIENCE MATCH (20%)
  const experienceLevels = ['beginner', 'intermediate', 'advanced'];
  const userExpIndex = experienceLevels.indexOf(userExp);
  const jobExpIndex = experienceLevels.indexOf(jobExp);
  
  let expScore = 0;
  let experienceNote = '';
  
  if (userExpIndex === -1 || jobExpIndex === -1) {
    expScore = 0;
    experienceNote = 'Experience level not specified';
  } else if (userExpIndex === jobExpIndex) {
    expScore = 20;
    experienceNote = '✓ Perfect experience match';
  } else if (Math.abs(userExpIndex - jobExpIndex) === 1) {
    expScore = 10;
    if (userExpIndex > jobExpIndex) {
      experienceNote = '↑ You are overqualified';
    } else {
      experienceNote = '↓ Slightly underqualified';
    }
  } else {
    expScore = 0;
    if (userExpIndex > jobExpIndex) {
      experienceNote = '↑↑ Significantly overqualified';
    } else {
      experienceNote = '↓↓ Experience gap detected';
    }
  }

  // 3. TRACK MATCH (20%)
  const similarTracks = {
    'frontend': ['frontend', 'front-end', 'fullstack', 'full-stack', 'web'],
    'backend': ['backend', 'back-end', 'fullstack', 'full-stack', 'server'],
    'fullstack': ['fullstack', 'full-stack', 'frontend', 'backend', 'web'],
    'mobile': ['mobile', 'android', 'ios', 'react native', 'flutter'],
    'devops': ['devops', 'cloud', 'infrastructure', 'sre'],
    'data': ['data science', 'data', 'ml', 'machine learning', 'ai'],
    'qa': ['qa', 'quality assurance', 'testing', 'test automation']
  };

  let trackScore = 0;
  let trackNote = '';

  const findTrackCategory = (track) => {
    for (const [category, keywords] of Object.entries(similarTracks)) {
      if (keywords.some(keyword => track.includes(keyword))) {
        return category;
      }
    }
    return track;
  };

  const userCategory = findTrackCategory(userTrack);
  const jobCategory = findTrackCategory(jobTrack);

  if (userTrack === jobTrack) {
    trackScore = 20;
    trackNote = '✓ Perfect track match';
  } else if (userCategory === jobCategory) {
    trackScore = 20;
    trackNote = '✓ Track aligned';
  } else if (
    (userCategory === 'fullstack' && ['frontend', 'backend'].includes(jobCategory)) ||
    (jobCategory === 'fullstack' && ['frontend', 'backend'].includes(userCategory))
  ) {
    trackScore = 10;
    trackNote = '~ Related track';
  } else if (similarTracks[userCategory]?.includes(jobTrack) || similarTracks[jobCategory]?.includes(userTrack)) {
    trackScore = 10;
    trackNote = '~ Similar domain';
  } else {
    trackScore = 0;
    trackNote = '✗ Different track';
  }

  // FINAL SCORE
  const finalScore = Math.round(skillScore + expScore + trackScore);

  return {
    score: finalScore,
    matchedSkills: matchedSkills,
    missingSkills: missingSkills,
    experienceNote,
    trackNote,
    breakdown: {
      skillScore: Math.round(skillScore),
      expScore,
      trackScore
    }
  };
};

/**
 * Get match score level and color
 * @param {number} score 
 * @returns {Object} level and color info
 */
export const getMatchLevel = (score) => {
  if (score >= 80) {
    return {
      level: 'Excellent Match',
      color: 'from-green-500 to-emerald-500',
      textColor: 'text-green-400',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.5)]'
    };
  } else if (score >= 60) {
    return {
      level: 'Good Match',
      color: 'from-blue-500 to-cyan-500',
      textColor: 'text-blue-400',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]'
    };
  } else if (score >= 40) {
    return {
      level: 'Fair Match',
      color: 'from-yellow-500 to-orange-500',
      textColor: 'text-yellow-400',
      glow: 'shadow-[0_0_20px_rgba(234,179,8,0.5)]'
    };
  } else {
    return {
      level: 'Low Match',
      color: 'from-red-500 to-pink-500',
      textColor: 'text-red-400',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]'
    };
  }
};
