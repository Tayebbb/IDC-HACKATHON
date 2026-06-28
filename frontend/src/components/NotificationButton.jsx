import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * NotificationButton — bell with dummy notifications dropdown.
 * Preserves existing behaviour; restyled to glass.
 */
export default function NotificationButton() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dummyNotifications = [
    { title: 'Welcome back!', meta: 'Just now' },
    { title: 'Your profile is 80% complete', meta: '2h ago' },
    { title: 'New course available', meta: 'Yesterday' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((s) => !s)}
        className="btn-icon w-10 h-10 relative"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full px-1 ring-2 ring-bg-base">
          3
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-2 w-72 glass-panel z-50 overflow-hidden"
            role="menu"
          >
            <div className="px-4 py-3 border-b border-glass-border/15 flex items-center justify-between">
              <p className="text-sm font-semibold text-text-main">Notifications</p>
              <span className="badge badge-primary">3 new</span>
            </div>
            <div className="py-1.5 max-h-96 overflow-auto">
              {dummyNotifications.map((n, i) => (
                <button
                  type="button"
                  key={i}
                  className="w-full text-left px-4 py-2.5 hover:bg-primary/10 transition-colors duration-150"
                  role="menuitem"
                >
                  <p className="text-sm text-text-main">{n.title}</p>
                  <p className="text-xs text-text-subtle mt-0.5">{n.meta}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
