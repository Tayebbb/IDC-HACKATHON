/**
 * WhatIfSimulator — Feature 7
 *
 * Loads readiness score once from the backend, then lets the user toggle
 * a checkbox list of common missing skills and recomputes readiness
 * CLIENT-SIDE in real time using the SAME 40/30/30 weights as Feature 3.
 *
 * Rules toggled skills follow (documented for judges):
 *   - Each toggled skill increments its mapped DNA category by +8,
 *     capped at 100. (Mapping mirrors backend CAREER_DNA_CATEGORIES.)
 *   - Readiness = dnaAvg*0.40 + profileCompletion*0.30 + interview*0.30
 *
 * Animation:
 *   - Framer Motion useSpring on the displayed score
 *   - stiffness 120, damping 18 → ~400ms settle, smooth at rapid toggles
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Sparkles, Wand2 } from 'lucide-react';
import ReasoningCard from './ReasoningCard';
import { buildEnvelope } from '../utils/explainability';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

// Mirror of backend CAREER_DNA_CATEGORIES (lowercase) — keep in sync.
const SKILL_TO_CATEGORY = {
  // Frontend
  typescript: 'Frontend', react: 'Frontend', vue: 'Frontend',
  tailwindcss: 'Frontend', 'next.js': 'Frontend',
  // Backend
  python: 'Backend', fastapi: 'Backend', sql: 'Backend',
  postgresql: 'Backend', 'node.js': 'Backend',
  // DevOps
  docker: 'DevOps', kubernetes: 'DevOps', terraform: 'DevOps',
  aws: 'DevOps', linux: 'DevOps',
  // AI/ML
  pytorch: 'AI/ML', 'scikit-learn': 'AI/ML', nlp: 'AI/ML',
  transformers: 'AI/ML',
  // Communication
  communication: 'Communication', documentation: 'Communication',
  presentation: 'Communication',
};

const COMMON_MISSING = Object.keys(SKILL_TO_CATEGORY);

export default function WhatIfSimulator({
  skills = [],
  profileCompletion = 0,
  interviewScore = null,
}) {
  const [baseDna, setBaseDna] = useState(null);
  const [baseEnvelope, setBaseEnvelope] = useState(null);
  const [toggled, setToggled] = useState({});

  // Load base readiness + DNA once. No polling.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const dnaRes = await fetch(`${API_BASE}/career-dna`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skills }),
        });
        const dna = await dnaRes.json();
        if (cancelled) return;
        setBaseDna(dna.scores || {});

        const readyRes = await fetch(`${API_BASE}/readiness-score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skills,
            dnaScores: dna.scores,
            profileCompletion,
            interviewScore,
          }),
        });
        const ready = await readyRes.json();
        if (cancelled) return;
        setBaseEnvelope(ready);
      } catch {
        // Silent degrade — render nothing.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute the simulated DNA scores based on toggled skills.
  const simulated = useMemo(() => {
    if (!baseDna) return null;
    const next = { ...baseDna };
    Object.entries(toggled).forEach(([skill, on]) => {
      if (!on) return;
      const cat = SKILL_TO_CATEGORY[skill];
      if (!cat || !(cat in next)) return;
      next[cat] = Math.min(100, (next[cat] || 0) + 8);
    });
    const dnaAvg = Object.values(next).reduce((a, b) => a + b, 0) /
      Math.max(Object.values(next).length, 1);
    const interview = typeof interviewScore === 'number' ? interviewScore : 0;
    const score = Math.round(
      dnaAvg * 0.4 + profileCompletion * 0.3 + interview * 0.3
    );

    const factors = [
      {
        label: `Skills component: ${Math.round(dnaAvg)}/100 \u00d7 40% (weight_component)`,
        positive: dnaAvg >= 50,
        signal_type: 'weight_component',
        value: Math.round(dnaAvg),
      },
      {
        label: `Profile ${Math.round(profileCompletion)}% complete \u00d7 30% (profile_field)`,
        positive: profileCompletion >= 70,
        signal_type: 'profile_field',
        value: Math.round(profileCompletion),
      },
      {
        label:
          typeof interviewScore === 'number'
            ? `Interview score: ${Math.round(interview)}/100 \u00d7 30% (interview_metric)`
            : 'No interview score yet \u00d7 30% (interview_metric)',
        positive: typeof interviewScore === 'number' && interview >= 60,
        signal_type: 'interview_metric',
        value: Math.round(interview),
      },
    ];

    Object.entries(toggled)
      .filter(([, on]) => on)
      .forEach(([skill]) => {
        factors.push({
          label: `Simulated: +${skill} (skill_match)`,
          positive: true,
          signal_type: 'skill_match',
        });
      });

    return {
      score,
      envelope: buildEnvelope(
        score,
        factors,
        `3 components scored \u00b7 weights: 40/30/30 \u00b7 ${Object.values(toggled).filter(Boolean).length} skills toggled`
      ),
    };
  }, [baseDna, toggled, profileCompletion, interviewScore]);

  // Framer Motion spring on the displayed score.
  const target = simulated?.score ?? baseEnvelope?.score ?? 0;
  const spring = useSpring(target, { stiffness: 120, damping: 18 });
  useEffect(() => {
    spring.set(target);
  }, [target, spring]);
  const display = useTransform(spring, (v) => Math.round(v));

  if (!baseEnvelope || !simulated) return null;

  const toggle = (skill) =>
    setToggled((prev) => ({ ...prev, [skill]: !prev[skill] }));

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8"
    >
      <div className="flex items-center gap-3 mb-4">
        <Wand2 className="text-primary glow-icon" size={26} />
        <h2 className="text-2xl font-bold glow-text">What-If Simulator</h2>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Toggles */}
        <div className="neon-card p-6">
          <p className="text-sm text-text-muted mb-4 flex items-center gap-2">
            <Sparkles size={14} />
            Toggle skills to see how your readiness would change.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {COMMON_MISSING.map((skill) => {
              const on = !!toggled[skill];
              return (
                <label
                  key={skill}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors text-sm ${
                    on
                      ? 'bg-primary/20 border-primary text-text-main'
                      : 'bg-bg-section border-white/5 text-text-muted hover:border-primary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(skill)}
                    className="accent-primary"
                  />
                  <span className="truncate">{skill}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Live score + ReasoningCard */}
        <div className="neon-card p-6 flex flex-col">
          <p className="text-sm text-text-muted mb-2">
            Simulated Readiness Score
          </p>
          <div className="flex items-baseline gap-2">
            <motion.span className="text-6xl font-extrabold text-primary-light glow-text">
              {display}
            </motion.span>
            <span className="text-2xl text-text-muted font-medium">/100</span>
          </div>
          <ReasoningCard
            title="What's behind this simulation"
            score={simulated.score}
            factors={simulated.envelope.factors}
            basis={simulated.envelope.basis}
            confidence={simulated.envelope.confidence}
          />
        </div>
      </div>
    </motion.section>
  );
}
