import { motion } from 'framer-motion';
import { AlertTriangle, RotateCw } from 'lucide-react';
import ActionButton from './ActionButton';

/**
 * ErrorState — friendly error block with optional retry action.
 */
export default function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again. If the issue persists, refresh the page.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
  icon: Icon = AlertTriangle,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`glass-card border-error/30 flex flex-col items-center text-center py-10 px-6 ${className}`}
      role="alert"
    >
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-error/12 text-error ring-1 ring-error/25 mb-3">
        <Icon size={24} />
      </span>
      <h3 className="text-lg font-semibold text-text-main">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-text-muted">{description}</p>
      )}
      {onRetry && (
        <ActionButton variant="secondary" icon={RotateCw} onClick={onRetry} className="mt-5">
          {retryLabel}
        </ActionButton>
      )}
    </motion.div>
  );
}
