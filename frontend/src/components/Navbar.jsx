/**
 * Navbar — glass top navigation.
 *
 * Preserves all existing behaviour:
 *  - Public links when logged out, private links when logged in
 *  - AI Tools dropdown
 *  - User menu with profile/logout
 *  - Notification button
 *  - Mobile menu
 *  - Scroll-based blur intensification
 *
 * Adds:
 *  - Dark / light theme toggle
 *  - Glass surface that adapts to theme tokens
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  LayoutDashboard,
  FileUp,
  Map,
  MessageSquare,
  Mic,
  PenLine,
  Network,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationButton from './NotificationButton';
import { MINDSPARKS_LOGO } from './branding';
import { ThemeToggle } from './ui';

const navLinksForAuth = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Jobs', href: '/jobs' },
  { name: 'Resources', href: '/resources' },
  { name: 'Contact', href: '/contact' },
];

const navLinksForPublic = [
  { name: 'Home', href: '/' },
  { name: 'Jobs', href: '/jobs' },
  { name: 'Resources', href: '/resources' },
  { name: 'Contact', href: '/contact' },
];

const aiFeatures = [
  { name: 'AI Assistance', href: '/chatassistance', icon: MessageSquare, hint: 'Career chat & guidance' },
  { name: 'CV Upload', href: '/cv-upload', icon: FileUp, hint: 'Analyze your CV' },
  { name: 'Career Roadmap', href: '/career-roadmap', icon: Map, hint: 'Plan your career' },
  { name: 'Mock Interview', href: '/mock-interview', icon: Mic, hint: 'Practice with AI' },
  { name: 'Application Generator', href: '/job-application-generator', icon: PenLine, hint: 'Tailor cover letters' },
  { name: 'Knowledge Graph', href: '/knowledge-graph', icon: Network, hint: 'Visualize your skills' },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const aiCloseTimer = useRef(null);
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    let rafId = null;
    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
        rafId = null;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsOpen(false);
    setShowUserMenu(false);
    setShowAIMenu(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const openAIMenu = () => {
    if (aiCloseTimer.current) clearTimeout(aiCloseTimer.current);
    setShowAIMenu(true);
  };
  const closeAIMenuDelayed = () => {
    aiCloseTimer.current = setTimeout(() => setShowAIMenu(false), 120);
  };

  const isActive = (href) => location.pathname === href;
  const links = currentUser ? navLinksForAuth : navLinksForPublic;

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 110, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: isScrolled
          ? 'rgb(var(--c-bg-base) / 0.72)'
          : 'rgb(var(--c-bg-base) / 0.30)',
        backdropFilter: isScrolled ? 'blur(16px) saturate(160%)' : 'blur(8px)',
        WebkitBackdropFilter: isScrolled ? 'blur(16px) saturate(160%)' : 'blur(8px)',
        borderBottom: isScrolled
          ? '1px solid rgb(var(--c-glass-border) / 0.14)'
          : '1px solid transparent',
        paddingTop: isScrolled ? '0.5rem' : '0.875rem',
        paddingBottom: isScrolled ? '0.5rem' : '0.875rem',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">

          {/* Logo */}
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link to="/" className="flex items-center gap-3 group">
              <div
                className="relative flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                  padding: '5px 10px',
                  boxShadow:
                    '0 0 18px rgba(245,158,11,0.22), inset 0 0 0 1px rgba(245,158,11,0.32)',
                  height: 40,
                }}
              >
                <img
                  src={MINDSPARKS_LOGO}
                  alt="Mindsparks IDC"
                  style={{ height: 24, width: 'auto', display: 'block' }}
                />
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    boxShadow:
                      '0 0 28px rgba(245,158,11,0.45), inset 0 0 0 1px rgba(245,158,11,0.5)',
                  }}
                />
              </div>
              <span className="text-2xl font-bold gradient-text glow-text">
                CareerPath
              </span>
            </Link>
          </motion.div>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={`relative px-4 py-2 rounded-xl font-medium transition-colors duration-200 ${
                  isActive(link.href)
                    ? 'text-primary-light'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <span className="relative z-10">{link.name}</span>
                {isActive(link.href) && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-primary/12 ring-1 ring-primary/30"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            ))}

            {/* AI Tools dropdown (only when authed) */}
            {currentUser && (
              <div
                className="relative"
                onMouseEnter={openAIMenu}
                onMouseLeave={closeAIMenuDelayed}
              >
                <button
                  type="button"
                  className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium transition-colors duration-200 ${
                    showAIMenu ? 'text-primary-light' : 'text-text-muted hover:text-text-main'
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={showAIMenu}
                >
                  <Sparkles size={16} />
                  <span>AI Tools</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${showAIMenu ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {showAIMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute top-full left-0 mt-2 w-72 rounded-2xl glass-panel py-2 z-50"
                      role="menu"
                    >
                      {aiFeatures.map((feature) => {
                        const Icon = feature.icon;
                        const active = isActive(feature.href);
                        return (
                          <Link
                            key={feature.name}
                            to={feature.href}
                            onClick={() => setShowAIMenu(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${
                              active
                                ? 'bg-primary/14 text-primary-light'
                                : 'hover:bg-primary/8 text-text-main'
                            }`}
                            role="menuitem"
                          >
                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/12 text-primary-light ring-1 ring-primary/25 flex-shrink-0">
                              <Icon size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{feature.name}</p>
                              <p className="text-xs text-text-muted truncate">{feature.hint}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-2">
            <ThemeToggle size="sm" />
            {currentUser ? (
              <>
                <NotificationButton />
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowUserMenu((s) => !s)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl glass-surface transition-shadow duration-200 hover:shadow-glass"
                    aria-haspopup="menu"
                    aria-expanded={showUserMenu}
                  >
                    <div className="w-8 h-8 rounded-full bg-card-gradient flex items-center justify-center text-white">
                      <User size={16} />
                    </div>
                    <span className="hidden xl:inline text-sm font-medium text-text-main max-w-[100px] truncate">
                      {currentUser.displayName?.split(' ')[0] || 'User'}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-text-muted transition-transform duration-200 ${
                        showUserMenu ? 'rotate-180' : ''
                      }`}
                    />
                  </motion.button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <>
                        <button
                          type="button"
                          aria-label="Close menu"
                          className="fixed inset-0 z-40"
                          onClick={() => setShowUserMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.96 }}
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute right-0 mt-2 w-64 rounded-2xl glass-panel z-50 overflow-hidden"
                          role="menu"
                        >
                          <div className="px-4 py-3 border-b border-glass-border/15 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-card-gradient flex items-center justify-center text-white">
                              <User size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-text-main truncate">
                                {currentUser.displayName || 'User'}
                              </p>
                              <p className="text-xs text-text-muted truncate">
                                {currentUser.email}
                              </p>
                            </div>
                          </div>
                          <div className="py-1.5">
                            <Link
                              to="/profile"
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/10 transition-colors duration-150 text-text-main"
                              role="menuitem"
                            >
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/12 text-primary-light">
                                <User size={14} />
                              </span>
                              <div className="text-left">
                                <p className="text-sm font-medium">Profile</p>
                                <p className="text-xs text-text-muted">Manage your account</p>
                              </div>
                            </Link>
                            <Link
                              to="/dashboard"
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/10 transition-colors duration-150 text-text-main"
                              role="menuitem"
                            >
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/12 text-primary-light">
                                <LayoutDashboard size={14} />
                              </span>
                              <div className="text-left">
                                <p className="text-sm font-medium">Dashboard</p>
                                <p className="text-xs text-text-muted">Your overview</p>
                              </div>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                handleLogout();
                                setShowUserMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-error/10 transition-colors duration-150 text-text-main"
                              role="menuitem"
                            >
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-error/12 text-error">
                                <LogOut size={14} />
                              </span>
                              <div className="text-left">
                                <p className="text-sm font-medium">Logout</p>
                                <p className="text-xs text-text-muted">Sign out</p>
                              </div>
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl font-medium text-text-muted hover:text-text-main transition-colors"
                >
                  Login
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button + theme toggle */}
          <div className="flex items-center gap-1 lg:hidden">
            <ThemeToggle size="sm" />
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsOpen(!isOpen)}
              className="btn-icon w-10 h-10"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="lg:hidden overflow-hidden"
            >
              <div className="py-3 space-y-1">
                {links.map((link) => (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-2.5 rounded-xl font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-primary/14 text-primary-light ring-1 ring-primary/25'
                        : 'text-text-muted hover:bg-primary/8 hover:text-text-main'
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}

                {currentUser && (
                  <>
                    <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-text-subtle">
                      <Sparkles size={12} />
                      AI Tools
                    </div>
                    {aiFeatures.map((feature) => {
                      const Icon = feature.icon;
                      return (
                        <Link
                          key={feature.name}
                          to={feature.href}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
                            isActive(feature.href)
                              ? 'bg-primary/14 text-primary-light ring-1 ring-primary/25'
                              : 'text-text-muted hover:bg-primary/8 hover:text-text-main'
                          }`}
                        >
                          <Icon size={16} />
                          <span className="font-medium">{feature.name}</span>
                        </Link>
                      );
                    })}
                    <Link
                      to="/profile"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-text-muted hover:bg-primary/8 hover:text-text-main transition-colors"
                    >
                      <User size={16} />
                      <span className="font-medium">Profile</span>
                    </Link>
                  </>
                )}

                <div className="pt-3 mt-3 border-t border-glass-border/15">
                  {currentUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-error hover:bg-error/8 transition-colors"
                    >
                      <LogOut size={16} />
                      <span className="font-medium">Logout</span>
                    </button>
                  ) : (
                    <div className="space-y-2 px-1">
                      <Link
                        to="/login"
                        onClick={() => setIsOpen(false)}
                        className="block btn-secondary btn-sm w-full text-center"
                      >
                        Login
                      </Link>
                      <Link
                        to="/register"
                        onClick={() => setIsOpen(false)}
                        className="block btn-primary btn-sm w-full text-center"
                      >
                        Get Started
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
};

export default Navbar;
