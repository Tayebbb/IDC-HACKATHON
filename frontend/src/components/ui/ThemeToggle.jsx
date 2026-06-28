import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * ThemeToggle — compact dark/light switcher.
 */
export default function ThemeToggle({ className = '', size = 'md' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const sizeClass = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileTap={{ scale: 0.92 }}
      className={`btn-icon ${sizeClass} ${className}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -30, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="inline-flex"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </motion.span>
    </motion.button>
  );
}
