/**
 * Explainability utilities — single source of truth for the client-side
 * ExplainabilityEnvelope contract. Used by What-If Simulator, Voice
 * Interview Coach, and any other client-side envelope construction.
 *
 * Data contract (must match backend ExplainabilityEnvelope):
 *   {
 *     output: string | number,
 *     factors: Factor[],
 *     confidence: "High" | "Medium" | "Low",
 *     basis: string,
 *     signal_types_used: SignalType[]
 *   }
 *
 * Factor:
 *   { label: string, positive: boolean, signal_type: SignalType, value?: number }
 *
 * Allowed SignalType values (do not extend):
 *   "rag_source" | "skill_match" | "weight_component"
 *   | "profile_field" | "interview_metric"
 */

export const ALLOWED_SIGNAL_TYPES = [
  'rag_source',
  'skill_match',
  'weight_component',
  'profile_field',
  'interview_metric',
];

/**
 * Confidence derivation rule — MUST match backend exactly.
 *
 *  - "High":   >= 3 factors AND at least 1 rag_source or skill_match
 *              AND no retrieval fallback used
 *  - "Medium": 1-2 factors, OR retrieval fallback was used,
 *              OR only weight_component signals present
 *  - "Low":    0 factors, OR all signals are profile_field only,
 *              OR keyword fallback was used
 */
export function deriveConfidence(factors, opts = {}) {
  const usedFallback = typeof opts === 'boolean' ? opts : opts.usedFallback === true;
  const retrievalPath = typeof opts === 'object'
    ? opts.retrievalPath || opts.retrieval_path || null
    : null;
  const list = Array.isArray(factors) ? factors : [];
  if (list.length === 0) return 'Low';

  const types = new Set(list.map((f) => f && f.signal_type).filter(Boolean));
  const onlyProfileFields = types.size === 1 && types.has('profile_field');
  if (onlyProfileFields) return 'Low';

  const onlyWeightComponents = types.size === 1 && types.has('weight_component');
  if (onlyWeightComponents) return 'Medium';

  if (retrievalPath === 'keyword' || retrievalPath === 'none') return 'Low';
  if (usedFallback) return 'Medium';
  if (list.length < 3) return 'Medium';

  const hasStrongSignal = types.has('rag_source') || types.has('skill_match');
  if (hasStrongSignal) return 'High';

  return 'Medium';
}

/**
 * Format a factor label so the signal value and signal type are always
 * visible to the user. Examples:
 *   "Python detected (skill_match)"
 *   "Skills component: 68/100 × 40% weight (weight_component)"
 */
export function formatFactorLabel(label, signalType, value = null) {
  const safeLabel = (label || '').toString().trim();
  const tag = signalType ? ` (${signalType})` : '';
  if (value === null || value === undefined) {
    return `${safeLabel}${tag}`;
  }
  return `${safeLabel}: ${value}${tag}`;
}

/**
 * Build a valid ExplainabilityEnvelope from a factors array and the
 * primary output value. Filters out any factor with an unsupported
 * signal type so the contract cannot be silently violated.
 */
export function buildEnvelope(output, factors, basis, opts = {}) {
  const safeFactors = (Array.isArray(factors) ? factors : []).filter(
    (f) => f && ALLOWED_SIGNAL_TYPES.includes(f.signal_type)
  );

  const signalTypesUsed = Array.from(
    new Set(safeFactors.map((f) => f.signal_type))
  );

  const confidence = deriveConfidence(safeFactors, {
    usedFallback: opts.usedFallback === true,
    retrievalPath: opts.retrievalPath || opts.retrieval_path,
  });

  return {
    output,
    factors: safeFactors,
    confidence,
    basis: basis || `${safeFactors.length} factor(s) evaluated`,
    signal_types_used: signalTypesUsed,
  };
}
