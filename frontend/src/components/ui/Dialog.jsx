import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Dialog — glass modal with focus trap basics and escape-to-close.
 *
 *   <Dialog open={open} onClose={close} title="…" description="…">
 *     <body>…</body>
 *     <footer>…</footer>
 *   </Dialog>
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  showClose = true,
  className = '',
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }[size] || 'max-w-xl';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'dialog-title' : undefined}
        >
          <div
            className="absolute inset-0 bg-bg-base/70 backdrop-blur-md"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={`relative w-full ${sizeClass} glass-panel max-h-[90vh] overflow-hidden flex flex-col ${className}`}
          >
            {(title || showClose) && (
              <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-glass-border/15">
                <div className="min-w-0">
                  {title && (
                    <h3 id="dialog-title" className="text-xl font-semibold text-text-main truncate">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-sm text-text-muted mt-1">{description}</p>
                  )}
                </div>
                {showClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-icon w-9 h-9 flex-shrink-0"
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                )}
              </header>
            )}
            <div className="px-6 py-5 overflow-y-auto">{children}</div>
            {footer && (
              <footer className="px-6 py-4 border-t border-glass-border/15 flex items-center justify-end gap-3 flex-wrap">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
