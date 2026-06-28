import { useState, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Tooltip — lightweight CSS-positioned tooltip.
 *
 *   <Tooltip content="Help text"><button>?</button></Tooltip>
 */
export default function Tooltip({
  content,
  children,
  side = 'top',
  delay = 100,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  let timer;

  const show = () => {
    timer = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer);
    setOpen(false);
  };

  const posClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      <AnimatePresence>
        {open && content && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={[
              'absolute z-50 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg pointer-events-none',
              'bg-bg-elevated text-text-main border border-glass-border/20 shadow-glass-sm',
              posClass,
              className,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
