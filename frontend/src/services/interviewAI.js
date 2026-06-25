/**
 * interviewAI.js
 * ---------------------------------------------------------------
 * High-level AI calls used by Mock Interview, Chatassistance,
 * Career Roadmap, and CV Upload. Every call goes directly from the
 * browser to Hugging Face via hfInference — NO backend hop.
 *
 * LLM: meta-llama/Llama-3.1-8B-Instruct via the HF chat-completions
 * router (OpenAI-compatible). The only model verified to work on the
 * free hf-inference provider tier as of the migration.
 */

import { hfInference } from './hfClient';
import { retrieve, buildContextPrompt } from './ragPipeline';

const LLM_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';

const SYSTEM_PROMPT =
  'You are CareerPath Assistant — a concise, supportive expert in careers, ' +
  'technical interviews, and skill development for students and fresh graduates. ' +
  'Always ground your answers in the candidate context when provided.';

const DEFAULTS = {
  max_tokens: 512,
  temperature: 0.7,
};

async function chat(userContent, opts = {}) {
  const params = { ...DEFAULTS, ...opts };
  return hfInference(
    LLM_MODEL,
    {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: params.max_tokens,
      temperature: params.temperature,
      stream: false,
    },
    'chat-completions'
  );
}

function parseChat(resp) {
  if (!resp) return '';
  const msg = resp?.choices?.[0]?.message?.content;
  return (msg || '').trim();
}

function stripFences(text) {
  return (text || '')
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

  const retrieved = await retrieve(`${difficulty} ${role} interview question`, { topN: 5 });
  const core = `Generate exactly ONE ${difficulty}-level interview question (number ${questionNumber}) for a ${role} candidate.
Personalize the question to the candidate's background when possible.${previousBlock}

Respond with the question text ONLY — no preamble, no numbering, no markdown.`;

  const raw = parseChat(await chat(buildContextPrompt(retrieved, core), { max_tokens: 256, temperature: 0.8 }));
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
  const core = `Evaluate the following interview answer on a 1-10 scale (clarity, relevance, technical depth).
Role: ${role} (${difficulty})
Question: ${question}
Candidate answer: """${answer}"""

Return ONLY valid minified JSON in this exact schema, nothing else:
{"score": <number 1-10>, "feedback": "<2-3 sentences>", "strengths": ["...","..."], "improvements": ["...","..."]}`;

  const raw = parseChat(await chat(buildContextPrompt(retrieved, core), { max_tokens: 400, temperature: 0.3 }));
  const parsed = safeJsonParse(raw);
  if (parsed && typeof parsed.score === 'number') {
    return {
      score: Math.max(1, Math.min(10, Math.round(parsed.score))),
      feedback: String(parsed.feedback || ''),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5) : [],
    };
  }
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
  const retrieved = await retrieve(message, { topN: 4, rerankPool: 8 });
  const recent = history.slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  const core = `Conversation so far:
${recent || '(start of conversation)'}

User: ${message}
Reply concisely in plain prose (max 150 words).`;

  const reply = parseChat(await chat(buildContextPrompt(retrieved, core), { max_tokens: 320, temperature: 0.6 }));
  return {
    reply,
    sources: retrieved.map((r) => ({ id: r.id, source: r.chunk.source, section: r.chunk.section })),
  };
}

// =======================================================================
// 4. Roadmap generation
// =======================================================================
export async function generateCareerRoadmap({ goalJob, profile }) {
  const skills = (profile?.skills || []).join(', ') || 'none listed';
  const level = profile?.experienceLevel || 'beginner';
  const retrieved = await retrieve(`${goalJob} skills roadmap for ${level} candidate`, { topN: 5 });
  const core = `Produce a structured roadmap in clean markdown.

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
  return parseChat(await chat(buildContextPrompt(retrieved, core), { max_tokens: 900, temperature: 0.65 }));
}

// =======================================================================
// 5. CV structuring
// =======================================================================
export async function structureCv(rawText) {
  const trimmed = (rawText || '').slice(0, 6000);
  const core = `Extract structured information from this CV. Return ONLY minified JSON:
{"keySkills":["..."],"toolsTechnologies":["..."],"rolesAndDomains":["..."]}

CV TEXT:
"""${trimmed}"""`;
  const parsed = safeJsonParse(parseChat(await chat(core, { max_tokens: 400, temperature: 0.2 })));
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
  const core = `Based on this CV summary, name exactly 2 hot/trending skills the candidate is missing.
Current Skills: ${(cvAnalysis.keySkills || []).join(', ') || 'None'}
Tools: ${(cvAnalysis.toolsTechnologies || []).join(', ') || 'None'}
Roles: ${(cvAnalysis.rolesAndDomains || []).join(', ') || 'None'}

Respond in exactly 2 lines, each formatted: "Skill Name - one-sentence reason".`;
  return parseChat(await chat(core, { max_tokens: 180, temperature: 0.6 }));
}
