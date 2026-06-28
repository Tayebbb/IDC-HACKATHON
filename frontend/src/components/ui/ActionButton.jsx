import { forwardRef } from 'react';
import { motion } from 'framer-motion';

const VARIANT = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

/**
 * ActionButton — single canonical button used across the app.
 * Wraps `motion.button` for tap/hover micro-feedback.
 *
 *   <ActionButton variant="primary" icon={Mic} onClick={...}>Start</ActionButton>
 */
const ActionButton = forwardRef(function ActionButton(
  {
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    type = 'button',
    onClick,
    ...rest
  },
  ref,
) {
  const cls = [
    VARIANT[variant] || VARIANT.primary,
    SIZE[size] || '',
    fullWidth ? 'w-full' : '',
    loading ? 'opacity-80 cursor-progress' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      disabled={disabled || loading}
      onClick={onClick}
      className={cls}
      {...rest}
    >
      {loading && (
        <span
          className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
          aria-hidden
        />
      )}
      {!loading && Icon && <Icon size={size === 'lg' ? 20 : 18} aria-hidden />}
      <span className="truncate">{children}</span>
      {!loading && IconRight && <IconRight size={size === 'lg' ? 20 : 18} aria-hidden />}
    </motion.button>
  );
});

export default ActionButton;
