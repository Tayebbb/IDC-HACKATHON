/**
 * Switch — accessible toggle. Controlled via `checked` / `onChange(boolean)`.
 */
export default function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  id,
  size = 'md',
  className = '',
}) {
  const trackSize = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const thumbSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const thumbTranslate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  const button = (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      id={id}
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={[
        'relative inline-flex items-center rounded-full border transition-colors duration-200',
        trackSize,
        checked
          ? 'bg-primary/80 border-primary/60'
          : 'bg-glass-surface/10 border-glass-border/20',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'inline-block rounded-full bg-white shadow transform transition-transform duration-200',
          thumbSize,
          checked ? thumbTranslate : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );

  if (!label && !description) return button;

  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'} ${className}`}
    >
      {button}
      <span className="min-w-0">
        {label && <span className="block text-sm font-medium text-text-main">{label}</span>}
        {description && <span className="block text-xs text-text-muted mt-0.5">{description}</span>}
      </span>
    </label>
  );
}
