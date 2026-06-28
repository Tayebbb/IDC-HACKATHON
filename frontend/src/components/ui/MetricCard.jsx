import { motion } from 'framer-motion';

const TREND_COLOR = {
  up: 'text-success',
  down: 'text-error',
  flat: 'text-text-muted',
};

const TONE = {
  default: '',
  primary: 'before:bg-primary/15',
  success: 'before:bg-success/15',
  warning: 'before:bg-warning/15',
  error: 'before:bg-error/15',
  info: 'before:bg-info/15',
};

/**
 * MetricCard — translucent KPI tile.
 *
 *   <MetricCard label="Confidence" value="82%" trend="up" delta="+6" icon={Sparkles} />
 */
export default function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  delta,
  hint,
  tone = 'default',
  className = '',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={[
        'glass-card relative overflow-hidden p-5',
        'before:content-[""] before:absolute before:-top-10 before:-right-10 before:w-36 before:h-36 before:rounded-full before:blur-2xl before:opacity-60',
        TONE[tone] ?? '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-text-muted truncate">{label}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-text-main truncate">{value}</p>
        </div>
        {Icon && (
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/14 text-primary-light ring-1 ring-primary/30 flex-shrink-0">
            <Icon size={18} />
          </span>
        )}
      </div>
      {(delta || hint) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta && (
            <span className={`${TREND_COLOR[trend] || TREND_COLOR.flat} font-semibold`}>
              {delta}
            </span>
          )}
          {hint && <span className="text-text-subtle">{hint}</span>}
        </div>
      )}
    </motion.div>
  );
}
