import { motion } from 'framer-motion';

const TONE = {
  primary: 'from-primary to-primary-dark',
  success: 'from-success to-emerald-600',
  warning: 'from-warning to-amber-600',
  error: 'from-error to-red-600',
  info: 'from-info to-blue-600',
};

/**
 * ProgressBar — animated track with optional label.
 *   <ProgressBar value={42} max={100} label="Confidence" tone="success" />
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  showValue = true,
  tone = 'primary',
  className = '',
  size = 'md',
  showLabel = true,
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className={className}>
      {(label || showValue) && showLabel && (
        <div className="flex items-baseline justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-text-muted">{label}</span>}
          {showValue && (
            <span className="text-xs font-semibold text-text-main tabular-nums">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full ${heightClass} rounded-full overflow-hidden bg-glass-surface/10 ring-1 ring-glass-border/15`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full bg-gradient-to-r ${TONE[tone] || TONE.primary} rounded-full`}
        />
      </div>
    </div>
  );
}
