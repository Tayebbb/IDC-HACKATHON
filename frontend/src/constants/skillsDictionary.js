/**
 * Skills dictionary and search functionality
 */

export const SKILL_CATEGORIES = {
  'Frontend': [
    'React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js',
    'HTML', 'CSS', 'JavaScript', 'TypeScript', 'Sass', 'Tailwind CSS',
    'Bootstrap', 'Material UI', 'Chakra UI', 'Redux', 'MobX', 'Zustand',
    'Webpack', 'Vite', 'Babel', 'jQuery', 'Alpine.js'
  ],
  'Backend': [
    'Node.js', 'Express', 'NestJS', 'Python', 'Django', 'Flask', 'FastAPI',
    'Java', 'Spring Boot', 'PHP', 'Laravel', 'Ruby', 'Rails',
    'Go', 'Rust', 'C#', '.NET', 'ASP.NET', 'GraphQL', 'REST API',
    'Microservices', 'gRPC', 'WebSockets'
  ],
  'Database': [
    'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Cassandra', 'DynamoDB',
    'Firebase', 'Supabase', 'SQLite', 'Oracle', 'SQL Server', 'MariaDB',
    'Elasticsearch', 'Neo4j', 'CouchDB'
  ],
  'DevOps': [
    'Docker', 'Kubernetes', 'Jenkins', 'GitLab CI', 'GitHub Actions',
    'AWS', 'Azure', 'Google Cloud', 'Terraform', 'Ansible', 'Chef',
    'Puppet', 'Nginx', 'Apache', 'Linux', 'Bash', 'CI/CD', 'Monitoring'
  ],
  'Mobile': [
    'React Native', 'Flutter', 'Swift', 'Kotlin', 'Java', 'Objective-C',
    'Ionic', 'Xamarin', 'Android', 'iOS', 'Mobile UI', 'App Development'
  ],
  'Data Science': [
    'Python', 'R', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'Scikit-learn',
    'TensorFlow', 'PyTorch', 'Keras', 'SQL', 'Tableau', 'Power BI',
    'Jupyter', 'Data Analysis', 'Statistics', 'Machine Learning', 'Deep Learning'
  ],
  'Testing': [
    'Jest', 'Mocha', 'Cypress', 'Selenium', 'Playwright', 'Puppeteer',
    'JUnit', 'TestNG', 'PyTest', 'Unit Testing', 'Integration Testing',
    'E2E Testing', 'TDD', 'BDD', 'Test Automation'
  ],
  'Design': [
    'Figma', 'Adobe XD', 'Sketch', 'InVision', 'Photoshop', 'Illustrator',
    'UI Design', 'UX Design', 'Prototyping', 'Wireframing', 'User Research',
    'Design Systems', 'Responsive Design'
  ],
  'Other': [
    'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Agile', 'Scrum', 'JIRA',
    'Communication', 'Problem Solving', 'Team Collaboration', 'Project Management',
    'Documentation', 'Code Review', 'Leadership'
  ]
};

// Flatten all skills for searching
const ALL_SKILLS = Object.values(SKILL_CATEGORIES).flat();

/**
 * Search for skills matching the query
 * @param {string} query - Search query
 * @returns {string[]} - Array of matching skills
 */
export const searchSkills = (query) => {
  if (!query || query.length < 1) return [];
  
  const lowerQuery = query.toLowerCase();
  return ALL_SKILLS.filter(skill => 
    skill.toLowerCase().includes(lowerQuery)
  ).slice(0, 10); // Limit to 10 suggestions
};

/**
 * Get all skills in a category
 * @param {string} category - Category name
 * @returns {string[]} - Array of skills
 */
export const getSkillsByCategory = (category) => {
  return SKILL_CATEGORIES[category] || [];
};

/**
 * Get all unique skills
 * @returns {string[]} - Array of all skills
 */
export const getAllSkills = () => {
  return [...new Set(ALL_SKILLS)].sort();
};
