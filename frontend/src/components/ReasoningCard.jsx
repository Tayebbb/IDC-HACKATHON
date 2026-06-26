/**
 * ReasoningCard — the ONLY rendering component for explainability output.
 *
 * Renders the mandatory three-tier breakdown:
 *   Tier 1 — Factors:    individual typed signals
 *   Tier 2 — Evidence:   each factor label carries its source/value
 *   Tier 3 — Confidence: derived confidence badge + basis line
 *
 * Render rules:
 *   - Title + score prominently (score is optional — degrade gracefully)
 *   - ✓ green for positive factors, ✗ muted/red for negative
 *   - If `factors` is empty or missing, render NOTHING (do not show shell)
 */
import React from 'react';
import { Check, X, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { AIReasoningHeader } from './branding';

const CONFIDENCE_STYLES = {
  High: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    Icon: ShieldCheck,
  },
  Medium: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    Icon: Shield,
  },
  Low: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
    Icon: ShieldAlert,
  },
};

export default function ReasoningCard({
  title,
  score,
  factors,
  basis,
  confidence,
}) {
  const list = Array.isArray(factors) ? factors : [];
  if (list.length === 0) return null;

  const conf = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.Medium;
  const ConfIcon = conf.Icon;
  const hasScore = score !== undefined && score !== null && !Number.isNaN(Number(score));

  return (
    <div className="neon-card mt-4">
      {/* Mindsparks AI attribution — marks this card as AI-generated */}
      <AIReasoningHeader title={title ? `Why: ${title}` : 'AI Reasoning'} />

      {/* Header: title + optional score + confidence badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          {title && (
            <h3 className="text-base sm:text-lg font-heading font-bold text-text-main glow-text truncate">
              {title}
            </h3>
          )}
          {hasScore && (
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-primary-light">
              {Math.round(Number(score))}
              <span className="text-sm text-text-muted font-medium ml-1">/100</span>
            </div>
          )}
        </div>

        {confidence && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${conf.badge}`}
            title={`Confidence: ${confidence}`}
          >
            <ConfIcon size={14} />
            {confidence}
          </span>
        )}
      </div>

      {/* Tier 1 + Tier 2 — Factors with embedded evidence */}
      <ul className="space-y-2">
        {list.map((f, idx) => {
          const positive = !!f.positive;
          const label = f.label || '';
          return (
            <li
              key={idx}
              className="flex items-start gap-2 text-sm leading-snug"
            >
              <span
                className={`mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  positive
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-rose-500/15 text-rose-300'
                }`}
                aria-hidden="true"
              >
                {positive ? <Check size={12} /> : <X size={12} />}
              </span>
              <span
                className={
                  positive ? 'text-text-main' : 'text-text-muted'
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Tier 3 — Basis line (confidence already shown as badge above) */}
      {basis && (
        <p className="mt-3 text-xs text-text-muted">
          <span className="font-semibold text-text-muted">Basis:</span> {basis}
        </p>
      )}
    </div>
  );
}
