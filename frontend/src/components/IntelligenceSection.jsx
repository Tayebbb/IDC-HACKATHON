/**
 * IntelligenceSection — Dashboard hero block for Features 2 and 3.
 *
 * Renders:
 *   - Career DNA radar chart (5 categories) + ReasoningCard
 *   - Career Readiness Score (0–100) + ReasoningCard with all three
 *     weight_component / profile_field / interview_metric factors
 *
 * Talks to backend POST /career-dna and POST /readiness-score.
 * If the backend is unreachable, renders nothing (primary dashboard
 * still works — per the "degrade gracefully" rule).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { motion } from 'framer-motion';
import { Sparkles, Gauge } from 'lucide-react';
import ReasoningCard from './ReasoningCard';
import MindsparksCredential from './MindsparksCredential';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const API_BASE = import.meta.env.VITE_API_BASE;

export default function IntelligenceSection({
  skills,
  profile = {},
  profileCompletion = 0,
  interviewScore = null,
  userName = '',
}) {
  const [dna, setDna] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState(null);

  const skillList = useMemo(
    () => (Array.isArray(skills) ? skills.filter(Boolean) : []),
    [skills]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (skillList.length === 0 && (!profile.skills || profile.skills.length === 0)) {
        setDna(null);
        setReadiness(null);
        return;
      }
      try {
        const dnaRes = await fetch(`${API_BASE}/career-dna`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skills: profile.skills ?? skillList ?? [],
            toolsTechnologies: profile.toolsTechnologies ?? []
          }),
        });
        if (!dnaRes.ok) throw new Error('career-dna failed');
        const dnaData = await dnaRes.json();
        if (cancelled) return;
        setDna(dnaData);

        const readyRes = await fetch(`${API_BASE}/readiness-score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skills: skillList,
            dnaScores: dnaData.scores,
            profileCompletion,
            interviewScore,
          }),
        });
        if (!readyRes.ok) throw new Error('readiness-score failed');
        const readyData = await readyRes.json();
        if (cancelled) return;
        setReadiness(readyData);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load intelligence');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [skillList, profileCompletion, interviewScore]);

  if (error || !dna || !readiness) return null;

  const labels = Object.keys(dna.scores || {});
  const values = Object.values(dna.scores || {});

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Career DNA',
        data: values,
        backgroundColor: 'rgba(168, 85, 247, 0.25)',
        borderColor: '#A855F7',
        borderWidth: 2,
        pointBackgroundColor: '#D500F9',
        pointBorderColor: '#fff',
        pointRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#11152B',
        borderColor: 'rgba(168,85,247,0.4)',
        borderWidth: 1,
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { display: false, stepSize: 20 },
        grid: { color: 'rgba(168, 85, 247, 0.15)' },
        angleLines: { color: 'rgba(168, 85, 247, 0.2)' },
        pointLabels: {
          color: '#B3B3C7',
          font: { size: 12, family: 'Poppins' },
        },
      },
    },
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12"
      data-testid="intelligence-section"
    >
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="text-primary glow-icon" size={28} />
        <h2 className="text-2xl font-bold glow-text">
          Career Intelligence
        </h2>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Career DNA */}
        <div className="neon-card p-6">
          <h3 className="text-lg font-heading font-bold text-text-main mb-4">
            Career DNA
          </h3>
          <div className="h-72">
            <Radar data={chartData} options={chartOptions} />
          </div>
          <ReasoningCard
            title="DNA Breakdown"
            factors={(dna.factors || []).slice(0, 8)}
            basis={dna.basis}
            confidence={dna.confidence}
          />
        </div>

        {/* Readiness Score */}
        <div className="neon-card p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <Gauge className="text-primary-light" size={24} />
            <h3 className="text-lg font-heading font-bold text-text-main">
              Career Readiness Score
            </h3>
          </div>

          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <div className="text-6xl sm:text-7xl font-extrabold text-primary-light glow-text">
                {Math.round(readiness.score || 0)}
                <span className="text-2xl text-text-muted font-medium ml-2">
                  /100
                </span>
              </div>
              <div className="text-sm text-text-muted mt-2">
                Confidence: {readiness.confidence}
              </div>
            </div>
          </div>

          <ReasoningCard
            title="How this score was built"
            score={readiness.score}
            factors={readiness.factors}
            basis={readiness.basis}
            confidence={readiness.confidence}
          />

          {/* Feature 8 — Mindsparks Badge + Certificate (renders only when score ≥ 80) */}
          <MindsparksCredential
            score={readiness.score}
            userName={userName}
            confidence={readiness.confidence}
          />
        </div>
      </div>
    </motion.section>
  );
}
