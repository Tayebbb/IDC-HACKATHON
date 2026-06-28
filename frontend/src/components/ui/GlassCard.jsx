import { forwardRef } from 'react';
import { motion } from 'framer-motion';

/**
 * GlassCard — translucent card with backdrop blur.
 *
 * Props:
 *   - as: HTML tag or motion component (defaults to motion.div)
 *   - interactive: adds hover lift + glow
 *   - padding: 'none' | 'sm' | 'md' | 'lg'
 *   - tone: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
 *   - animate: enable mount fade-in (default: true)
 */
const PADDING = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

const TONE_RING = {
  default: '',
  primary: 'ring-1 ring-primary/30',
  success: 'ring-1 ring-success/30',
  warning: 'ring-1 ring-warning/30',
  error: 'ring-1 ring-error/30',
  info: 'ring-1 ring-info/30',
};

const GlassCard = forwardRef(function GlassCard(
  {
    as: As = motion.div,
    children,
    className = '',
    interactive = false,
    padding = 'md',
    tone = 'default',
    animate = true,
    style,
    ...rest
  },
  ref,
) {
  const baseClass = [
    'glass-card',
    PADDING[padding] ?? PADDING.md,
    TONE_RING[tone] ?? '',
    interactive ? 'is-interactive cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const motionProps =
    animate && As === motion.div
      ? {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        }
      : {};

  return (
    <As ref={ref} className={baseClass} style={style} {...motionProps} {...rest}>
      {children}
    </As>
  );
});

export default GlassCard;
