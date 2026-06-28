import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import ActionButton from './ActionButton';

/**
 * EmptyState — icon + message + optional primary action.
 *
 *   <EmptyState title="No jobs yet" description="…" action={{ label: "Browse", onClick }} />
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
  secondaryAction,
  className = '',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`glass-card flex flex-col items-center text-center py-12 px-6 ${className}`}
    >
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/12 text-primary-light ring-1 ring-primary/25 mb-4">
        <Icon size={28} />
      </span>
      <h3 className="text-lg font-semibold text-text-main">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-text-muted">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-3 flex-wrap justify-center">
          {action && (
            <ActionButton variant="primary" icon={action.icon} onClick={action.onClick}>
              {action.label}
            </ActionButton>
          )}
          {secondaryAction && (
            <ActionButton variant="secondary" icon={secondaryAction.icon} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </ActionButton>
          )}
        </div>
      )}
    </motion.div>
  );
}
