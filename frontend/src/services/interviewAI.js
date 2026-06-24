/**
 * interviewAI.js
 * ---------------------------------------------------------------
 * High-level AI calls used by Mock Interview, Chatassistance,
 * Career Roadmap, and CV Upload. All calls go directly from the
 * browser to Hugging Face via hfInference.
 */

import { hfInference } from './hfClient';
import { retrieve, buildContextPrompt } from './ragPipeline';

const LLM_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

const DEFAULT_PARAMS = {
  max_new_tokens: 512,
  temperature: 0.7,
  return_full_text: false,
};

function instruct(prompt, params = {}) {
  return hfInference(
    LLM_MODEL,
    {
      inputs: `[INST] ${prompt} [/INST]`,
      parameters: { ...DEFAULT_PARAMS, ...params },
      options: { wait_for_model: true },
    },
    'text-generation'
  );
}

function parseGenerated(out) {
  if (!out) return '';
  if (Array.isArray(out)) return out[0]?.generated_text || '';
  return out.generated_text || '';
}

function stripFences(text) {
  return text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

function safeJsonParse(text) {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf('{');
  const lastObj = cleaned.lastIndexOf('}');
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  let slice = cleaned;
  if (start !== -1 && lastObj !== -1 && (arrStart === -1 || start < arrStart)) {
    slice = cleaned.slice(start, lastObj + 1);
  } else if (arrStart !== -1 && arrEnd !== -1) {
    slice = cleaned.slice(arrStart, arrEnd + 1);
  }
  try { return JSON.parse(slice); } catch { return null; }
}

// =======================================================================
// 1. Interview question generation
// =======================================================================
export async function generateInterviewQuestion({
  role,
  difficulty,
  questionNumber,
  previousQuestions = [],
}) {
  const previousBlock = previousQuestions.length
    ? `\nAvoid repeating any of these previously-asked questions:\n- ${previousQuestions.join('\n- ')}`
    : '';

  const baseQuery = `${difficulty} ${role} interview question`;
  const retrieved = await retrieve(baseQuery, { topN: 5 });
  const promptCore = `You are an expert technical interviewer.
Generate exactly ONE ${difficulty}-level interview question (number ${questionNumber}) for a ${role} candidate.
Personalize the question to the candidate's background where possible.${previousBlock}

Respond with the question text ONLY — no preamble, no numbering, no markdown.`;

  const prompt = buildContextPrompt(retrieved, promptCore);
  const out = await instruct(prompt, { max_new_tokens: 256, temperature: 0.8 });
  const raw = parseGenerated(out).trim();

  // strip leading "Question:" / numbering / quotes
  return raw
    .replace(/^(question[:\s-]*|q[\s.:-]*)/i, '')
    .replace(/^[-*\d.)\s]+/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

// =======================================================================
// 2. Answer evaluation
// =======================================================================
export async function evaluateInterviewAnswer({
  question,
  answer,
  role,
  difficulty,
}) {
  const retrieved = await retrieve(`${question}\n\n${answer}`, { topN: 5 });
  const promptCore = `Evaluate the following interview answer on a 1-10 scale (clarity, relevance, technical depth).
Role: ${role} (${difficulty})
Question: ${question}
Candidate answer: """${answer}"""

Return ONLY valid minified JSON in this exact schema, nothing else:
{"score": <number 1-10>, "feedback": "<2-3 sentences>", "strengths": ["...","..."], "improvements": ["...","..."]}`;

  const prompt = buildContextPrompt(retrieved, promptCore);
  const out = await instruct(prompt, { max_new_tokens: 400, temperature: 0.3 });
  const raw = parseGenerated(out);

  const parsed = safeJsonParse(raw);
  if (parsed && typeof parsed.score === 'number') {
    return {
      score: Math.max(1, Math.min(10, Math.round(parsed.score))),
      feedback: String(parsed.feedback || ''),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5) : [],
    };
  }
  // Fallback: model returned prose. Wrap it.
  return {
    score: 5,
    feedback: raw.slice(0, 400) || 'Unable to parse model response.',
    strengths: [],
    improvements: ['Provide more specific examples in your answer.'],
  };
}

// =======================================================================
// 3. Career assistant chat
// =======================================================================
export async function careerChat({ message, history = [] }) {
  const retrieved = await retrieve(message, { topN: 5 });
  const recent = history.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
  const promptCore = `You are a friendly, concise career mentor for students and fresh graduates. Stay focused on careers, skills, jobs, and interview prep.

Conversation so far:
${recent || '(start of conversation)'}

User: ${message}
Assistant:`;
  const prompt = buildContextPrompt(retrieved, promptCore);
  const out = await instruct(prompt, { max_new_tokens: 512, temperature: 0.6 });
  return {
    reply: parseGenerated(out).trim(),
    sources: retrieved.map((r) => ({ id: r.id, source: r.chunk.source, section: r.chunk.section })),
  };
}

// =======================================================================
// 4. Roadmap generation
// =======================================================================
export async function generateCareerRoadmap({ goalJob, profile }) {
  const skills = (profile?.skills || []).join(', ') || 'none listed';
  const level = profile?.experienceLevel || 'beginner';
  const query = `${goalJob} skills roadmap for ${level} candidate`;
  const retrieved = await retrieve(query, { topN: 5 });

  const promptCore = `You are a career counselor. Produce a structured roadmap in clear markdown.

Candidate profile:
- Experience level: ${level}
- Current skills: ${skills}
- Goal role: ${goalJob}

Sections (use ## headers):
1. Current Assessment
2. Skills Gap (4-6 bullets)
3. Step-by-Step Path (5-7 numbered steps)
4. Timeline (per step)
5. Recommended Resources
6. Quick Wins (2-3 bullets)`;
  const prompt = buildContextPrompt(retrieved, promptCore);
  const out = await instruct(prompt, { max_new_tokens: 900, temperature: 0.65 });
  return parseGenerated(out).trim();
}

// =======================================================================
// 5. CV structuring
// =======================================================================
export async function structureCv(rawText) {
  const trimmed = (rawText || '').slice(0, 6000);
  const promptCore = `Extract structured information from this CV. Return ONLY minified JSON:
{"keySkills":["..."],"toolsTechnologies":["..."],"rolesAndDomains":["..."]}

CV TEXT:
"""${trimmed}"""`;
  const out = await instruct(promptCore, { max_new_tokens: 400, temperature: 0.2 });
  const parsed = safeJsonParse(parseGenerated(out));
  return parsed && typeof parsed === 'object'
    ? {
        keySkills: Array.isArray(parsed.keySkills) ? parsed.keySkills : [],
        toolsTechnologies: Array.isArray(parsed.toolsTechnologies) ? parsed.toolsTechnologies : [],
        rolesAndDomains: Array.isArray(parsed.rolesAndDomains) ? parsed.rolesAndDomains : [],
      }
    : { keySkills: [], toolsTechnologies: [], rolesAndDomains: [] };
}

// =======================================================================
// 6. Hot-skill suggestion (CV upload page)
// =======================================================================
export async function suggestHotSkills(cvAnalysis) {
  const prompt = `Based on this CV summary, name exactly 2 hot/trending skills the candidate is missing.
Current Skills: ${(cvAnalysis.keySkills || []).join(', ') || 'None'}
Tools: ${(cvAnalysis.toolsTechnologies || []).join(', ') || 'None'}
Roles: ${(cvAnalysis.rolesAndDomains || []).join(', ') || 'None'}

Respond in exactly 2 lines, each formatted: "Skill Name - one-sentence reason".`;
  const out = await instruct(prompt, { max_new_tokens: 180, temperature: 0.6 });
  return parseGenerated(out).trim();
}
