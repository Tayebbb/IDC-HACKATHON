/**
 * StatusBadge — semantic pill for state communication.
 *
 *   <StatusBadge tone="success">Live</StatusBadge>
 *   <StatusBadge tone="warning" pulse>Recording</StatusBadge>
 */
const TONE_CLASS = {
  default: 'badge',
  primary: 'badge badge-primary',
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  error: 'badge badge-error',
  info: 'badge badge-info',
};

const DOT_CLASS = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  default: 'bg-text-muted',
};

export default function StatusBadge({
  tone = 'default',
  pulse = false,
  dot = true,
  children,
  className = '',
  icon: Icon,
}) {
  return (
    <span className={`${TONE_CLASS[tone] || TONE_CLASS.default} ${className}`}>
      {dot && !Icon && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${DOT_CLASS[tone] || DOT_CLASS.default} ${
            pulse ? 'animate-pulse-soft' : ''
          }`}
        />
      )}
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}
