import { motion } from 'framer-motion';

/**
 * PageContainer — standard outer wrapper for every route.
 * Provides max-width, horizontal padding, top spacing, and a fade-in animation.
 *
 * `tight` reduces top padding when the page already has a hero/header section.
 */
export default function PageContainer({
  children,
  className = '',
  tight = false,
  wide = false,
}) {
  const widthClass = wide ? 'max-w-[1440px]' : 'max-w-7xl';
  const padding = tight ? 'py-6 sm:py-8' : 'py-10 sm:py-14';

  return (
    <motion.main
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`${widthClass} mx-auto px-4 sm:px-6 lg:px-8 ${padding} ${className}`}
    >
      {children}
    </motion.main>
  );
}
