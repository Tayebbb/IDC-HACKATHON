export const PROFILE_COMPLETION_FIELDS = [
  { key: 'bio', weight: 10 },
  { key: 'skills', weight: 20, check: (value) => Array.isArray(value) && value.length > 0 },
  { key: 'tools', weight: 20, check: (value) => Array.isArray(value) && value.length > 0 },
  { key: 'experienceLevel', weight: 15 },
  { key: 'preferredTrack', weight: 15 },
  { key: 'location', weight: 10 },
  { key: 'education', weight: 10 },
];

export const CAREER_INTELLIGENCE_REQUIRED_FIELDS = [
  { key: 'skills', label: 'Skills', check: (value) => Array.isArray(value) && value.length > 0 },
  { key: 'tools', label: 'Tools/Technologies', check: (value) => Array.isArray(value) && value.length > 0 },
  { key: 'experienceLevel', label: 'Experience Level' },
  { key: 'preferredTrack', label: 'Preferred Career Track' },
];

function isFieldComplete(field, data) {
  const value = data[field.key];
  return field.check
    ? field.check(value)
    : Boolean(value && value.toString().trim() !== '');
}

export function calculateProfileCompletion(data = {}) {
  return PROFILE_COMPLETION_FIELDS.reduce((completed, field) => {
    return isFieldComplete(field, data) ? completed + field.weight : completed;
  }, 0);
}

export function isProfileComplete(data = {}) {
  return calculateProfileCompletion(data) >= 100;
}

export function getMissingCareerIntelligenceFields(data = {}) {
  return CAREER_INTELLIGENCE_REQUIRED_FIELDS
    .filter((field) => !isFieldComplete(field, data))
    .map((field) => field.label);
}

export function hasCareerIntelligenceProfile(data = {}) {
  return getMissingCareerIntelligenceFields(data).length === 0;
}
