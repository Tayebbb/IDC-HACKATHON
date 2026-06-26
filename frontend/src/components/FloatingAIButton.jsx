import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AIMark } from './branding';

const FloatingAIButton = () => {
  const location = useLocation();

  // Hide button on chatassistance page and admin routes
  if (location.pathname === '/chatassistance' || location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
      className="fixed bottom-24 right-6 sm:right-8 z-50"
    >
      <Link to="/chatassistance" aria-label="Open Mindsparks AI Assistant">
        <motion.div
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          className="group relative"
        >
          {/* Soft purple glow halo */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-xl opacity-50 group-hover:opacity-90 transition-opacity" />
          {/* Pill button — real Mindsparks logo + label */}
          <div
            className="relative flex items-center gap-3 pl-3 pr-5 py-2.5 rounded-full shadow-2xl shadow-purple-500/40 group-hover:shadow-purple-500/70 transition-all"
            style={{
              background:
                'linear-gradient(135deg, rgba(106,0,245,0.95) 0%, rgba(213,0,249,0.95) 100%)',
            }}
          >
            <AIMark height={26} showRing={false} />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
                Mindsparks AI
              </span>
              <span className="text-sm font-semibold text-white">
                Ask Assistant
              </span>
            </div>
            <div className="absolute -top-1 -right-1">
              <Sparkles className="text-yellow-300 animate-pulse" size={16} />
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default FloatingAIButton;
