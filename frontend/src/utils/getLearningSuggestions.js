/**
 * Get learning resource suggestions for missing skills
 * @param {string[]} missingSkills - Array of skills the user is missing
 * @param {Object[]} allResources - All learning resources from Firestore
 * @returns {Object} Structured suggestions with resources per skill
 */
export const getLearningSuggestions = (missingSkills, allResources) => {
  if (!missingSkills || missingSkills.length === 0) {
    return {
      missing: [],
      suggestions: []
    };
  }

  if (!allResources || allResources.length === 0) {
    return {
      missing: missingSkills,
      suggestions: []
    };
  }

  const suggestions = [];

  // For each missing skill, find matching resources
  missingSkills.forEach(skill => {
    const skillLower = skill.toLowerCase().trim();
    
    // Find resources that match this skill
    const matchingResources = allResources.filter(resource => {
      if (!resource.relatedSkills || !Array.isArray(resource.relatedSkills)) {
        return false;
      }
      
      return resource.relatedSkills.some(relatedSkill => {
        const relatedLower = relatedSkill.toLowerCase().trim();
        return relatedLower.includes(skillLower) || skillLower.includes(relatedLower);
      });
    });

    if (matchingResources.length > 0) {
      // Separate free and paid resources
      const freeResources = matchingResources.filter(r => r.cost === 'Free');
      const paidResources = matchingResources.filter(r => r.cost === 'Paid');

      // Prioritize free resources, then paid
      const sortedResources = [...freeResources, ...paidResources];

      // Take top 3 resources for this skill
      const topResources = sortedResources.slice(0, 3).map(resource => ({
        id: resource.id,
        title: resource.title || 'Untitled Resource',
        platform: resource.platform || 'Unknown',
        url: resource.url || '#',
        cost: resource.cost || 'Free',
        relatedSkills: resource.relatedSkills || []
      }));

      suggestions.push({
        skill: skill,
        resources: topResources
      });
    }
  });

  // Limit to top 5 skills with most resources
  const sortedSuggestions = suggestions
    .sort((a, b) => b.resources.length - a.resources.length)
    .slice(0, 5);

  return {
    missing: missingSkills,
    suggestions: sortedSuggestions
  };
};
