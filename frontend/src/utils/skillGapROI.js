import { calculateMatchScore } from './matchScore';

export const calculateSkillGapROI = (userProfile, jobs) => {
  if (!userProfile?.skills || !jobs || jobs.length === 0) return [];

  // Track metrics per missing skill
  const skillMetrics = {};

  // For each job, see what the user is missing
  jobs.forEach(job => {
    const match = calculateMatchScore(userProfile, job);
    
    // Only process jobs where the user is missing some skills
    if (match.missingSkills.length > 0) {
      match.missingSkills.forEach(skill => {
        const normalizedSkill = skill.toLowerCase().trim();
        
        if (!skillMetrics[normalizedSkill]) {
          skillMetrics[normalizedSkill] = {
            originalSkill: skill,
            jobsImpacted: 0,
            demandCount: 0,
            relatedTracks: new Set()
          };
        }
        
        // This job demands this skill
        skillMetrics[normalizedSkill].demandCount++;
        
        // Use track or default to 'General'
        if (job.track) {
          // Capitalize track for display
          const capitalizedTrack = job.track.charAt(0).toUpperCase() + job.track.slice(1);
          skillMetrics[normalizedSkill].relatedTracks.add(capitalizedTrack);
        }

        // Increment impact count
        skillMetrics[normalizedSkill].jobsImpacted++;
      });
    }
  });

  // Calculate learning time estimates based on heuristics
  const getLearningTime = (skill) => {
    const s = skill.toLowerCase();
    if (s.includes('docker') || s.includes('kubernetes') || s.includes('k8s')) return 3;
    if (s.includes('react') || s.includes('angular') || s.includes('vue') || s.includes('next.js')) return 4;
    if (s.includes('python') || s.includes('java') || s.includes('node') || s.includes('c++') || s.includes('c#')) return 5;
    if (s.includes('sql') || s.includes('mongodb') || s.includes('database') || s.includes('postgres')) return 2;
    if (s.includes('aws') || s.includes('cloud') || s.includes('azure') || s.includes('gcp')) return 4;
    if (s.includes('git') || s.includes('github') || s.includes('gitlab')) return 1;
    if (s.includes('html') || s.includes('css')) return 2;
    if (s.includes('javascript') || s.includes('typescript')) return 4;
    return 3; // default weeks
  };

  const formatTracks = (tracksSet) => {
    const arr = Array.from(tracksSet);
    if (arr.length === 0) return 'General Technical roles';
    if (arr.length === 1) return `${arr[0]} roles`;
    return `${arr.slice(0, 2).join(' and ')} roles`;
  };

  // Compute raw ROI
  const priorities = Object.values(skillMetrics).map(metric => {
    const weeks = getLearningTime(metric.originalSkill);
    const rawRoi = metric.jobsImpacted / weeks;
    
    return {
      skill: metric.originalSkill,
      jobsImpacted: metric.jobsImpacted,
      demand: metric.demandCount,
      learningTimeWeeks: weeks,
      learningTimeText: `${weeks}-${weeks + 1} weeks`,
      tracksDescription: formatTracks(metric.relatedTracks),
      rawRoi
    };
  });

  // Normalize ROI to 10
  const maxRawRoi = Math.max(...priorities.map(p => p.rawRoi), 0);
  
  return priorities.map(p => ({
    ...p,
    roiScore: maxRawRoi > 0 ? Number(((p.rawRoi / maxRawRoi) * 10).toFixed(1)) : 0
  })).sort((a, b) => b.roiScore - a.roiScore).slice(0, 5); // top 5
};
