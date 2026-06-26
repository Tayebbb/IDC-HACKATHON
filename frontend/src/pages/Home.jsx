/**
 * Home Page
 * Landing page with hero section, features, and CTAs
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight, BookOpen, Users, Sparkles, TrendingUp, Award,
  Zap, Globe, Star, BarChart3,
} from 'lucide-react';
import { BrandStrip } from '../components/branding';

// ─── MilestoneCard ────────────────────────────────────────────────────────────
const MilestoneCard = ({ milestone }) => {
  const Icon = milestone.icon;
  return (
    <div
      className="group relative p-6 rounded-2xl transition-all duration-300 cursor-default"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(168,85,247,0.15)',
        boxShadow: '0 4px 24px rgba(10,8,30,0.45)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Hover border glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `0 0 28px ${milestone.glow}, inset 0 0 0 1px rgba(168,85,247,0.25)` }}
      />

      <div className="flex items-start gap-4">
        {/* Icon badge */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(213,0,249,0.08))',
            border: '1px solid rgba(168,85,247,0.25)',
          }}
        >
          <Icon size={22} style={{ color: milestone.color }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Big stat number */}
          <div
            className="font-heading text-3xl font-bold leading-none mb-1"
            style={{
              background: 'linear-gradient(135deg, #A855F7, #D500F9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {milestone.number}
          </div>
          {/* Label */}
          <div className="text-sm font-semibold text-white mb-2">{milestone.label}</div>
          {/* Description */}
          <p className="text-xs text-muted leading-relaxed">{milestone.description}</p>
        </div>
      </div>
    </div>
  );
};

// ─── TimelineCard ─────────────────────────────────────────────────────────────
const TimelineCard = ({ milestone, isLeft }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <div ref={ref} className="relative flex items-center">
      {/* ── Desktop layout (alternating sides) ─────────────────────────── */}
      <div
        className="hidden md:grid w-full"
        style={{ gridTemplateColumns: '1fr 56px 1fr', alignItems: 'center' }}
      >
        {/* Left slot */}
        <div className="flex justify-end pr-8">
          {isLeft && (
            <motion.div
              initial={{ opacity: 0, x: -64 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.12, ease: 'easeOut' }}
              className="w-full max-w-sm"
            >
              <MilestoneCard milestone={milestone} />
            </motion.div>
          )}
        </div>

        {/* Center node — dot + connector line */}
        <div className="flex items-center justify-center relative" style={{ height: 56 }}>
          {/* Horizontal connector toward the card */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.35, delay: 0.32 }}
            className="absolute"
            style={{
              top: '50%',
              marginTop: -1,
              [isLeft ? 'right' : 'left']: 28,
              width: 30,
              height: 2,
              background: `linear-gradient(${isLeft ? '270deg' : '90deg'}, ${milestone.color}, rgba(168,85,247,0))`,
              transformOrigin: isLeft ? 'right center' : 'left center',
            }}
          />
          {/* Glowing dot */}
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.2, type: 'spring', stiffness: 260 }}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #A855F7, #D500F9)',
              boxShadow: `0 0 18px ${milestone.glow}, 0 0 6px ${milestone.color}`,
              border: '2px solid rgba(255,255,255,0.18)',
              flexShrink: 0,
              zIndex: 2,
            }}
          />
        </div>

        {/* Right slot */}
        <div className="flex justify-start pl-8">
          {!isLeft && (
            <motion.div
              initial={{ opacity: 0, x: 64 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.12, ease: 'easeOut' }}
              className="w-full max-w-sm"
            >
              <MilestoneCard milestone={milestone} />
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Mobile layout (single column, left spine) ───────────────────── */}
      <div className="flex md:hidden w-full items-start gap-4 pl-14 relative">
        {/* Dot on mobile spine */}
        <motion.div
          initial={{ scale: 0 }}
          animate={isInView ? { scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.15, type: 'spring', stiffness: 260 }}
          className="absolute"
          style={{
            left: 16,
            top: 20,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #A855F7, #D500F9)',
            boxShadow: `0 0 14px ${milestone.glow}`,
            border: '2px solid rgba(255,255,255,0.15)',
            zIndex: 2,
          }}
        />
        <motion.div
          initial={{ opacity: 0, x: 28 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="flex-1"
        >
          <MilestoneCard milestone={milestone} />
        </motion.div>
      </div>
    </div>
  );
};

// ─── Home ─────────────────────────────────────────────────────────────────────
const Home = () => {
  const stats = [
    { number: '500+', label: 'Job Opportunities' },
    { number: '100+', label: 'Learning Resources' },
    { number: '1000+', label: 'Active Users' },
  ];

  const milestones = [
    {
      icon: Globe,
      number: '500+',
      label: 'Job Opportunities',
      description: 'Curated listings matched to your skills — from internships to full-time roles across top industries.',
      color: '#A855F7',
      glow: 'rgba(168,85,247,0.35)',
    },
    {
      icon: BookOpen,
      number: '100+',
      label: 'Learning Resources',
      description: 'Personalised courses, videos and reading lists aligned with every career track in our platform.',
      color: '#D500F9',
      glow: 'rgba(213,0,249,0.35)',
    },
    {
      icon: Users,
      number: '1,000+',
      label: 'Active Users',
      description: 'Students and fresh graduates already building their career roadmaps with CareerPath every day.',
      color: '#A855F7',
      glow: 'rgba(168,85,247,0.35)',
    },
    {
      icon: Zap,
      number: '98%',
      label: 'Skill-Match Accuracy',
      description: 'Our AI engine achieves near-perfect accuracy when pairing your profile with the right opportunities.',
      color: '#D500F9',
      glow: 'rgba(213,0,249,0.35)',
    },
    {
      icon: BarChart3,
      number: '6+',
      label: 'AI-Powered Tools',
      description: 'From CV analysis and mock interviews to career roadmaps — all powered by the Mindsparks intelligence layer.',
      color: '#A855F7',
      glow: 'rgba(168,85,247,0.35)',
    },
    {
      icon: Star,
      number: 'SDG 8',
      label: 'UN Goal Aligned',
      description: 'Driving decent work and economic growth for youth — purposefully built around the UN Sustainable Development Goals.',
      color: '#D500F9',
      glow: 'rgba(213,0,249,0.35)',
    },
  ];

  return (
    <div className="home-page bg-base min-h-screen">
      {/* Hero Section */}
      <section className="hero-section bg-section">
        <div className="relative overflow-hidden py-20 sm:py-28 lg:py-32">
          {/* Animated background shapes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
            />
            <motion.div
              animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
            />
          </div>

          <div className="section-container relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Text content */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full mb-6" style={{ background: 'rgba(168,85,247,0.06)' }}>
                  <Sparkles className="text-primary glow-icon" size={16} />
                  <span className="text-sm font-medium" style={{ color: '#C084FC' }}>Aligned with SDG 8</span>
                </div>

                <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight glow-text break-words">
                  Discover your path.
                  <br />
                  <span style={{ color: '#A855F7' }}>Shape your career.</span>
                </h1>

                <p className="text-base sm:text-lg text-muted mb-8 max-w-xl">
                  Match your skills to relevant jobs and learning resources — build a roadmap that leads to real opportunities.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/register" className="btn-primary flex items-center justify-center space-x-2">
                    <span>Get Started</span>
                    <ArrowRight size={18} />
                  </Link>
                  <Link to="/jobs" className="btn-outline-neon flex items-center justify-center space-x-2">
                    <span>Explore Jobs</span>
                  </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-8 sm:mt-12">
                  {stats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                    >
                      <div className="text-2xl sm:text-3xl font-heading font-bold" style={{ color: '#A855F7' }}>{stat.number}</div>
                      <div className="text-xs sm:text-sm text-muted">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Right: Illustration/Image */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="relative aspect-square max-w-lg mx-auto">
                  {/* Tech career illustration */}
                  <img
                    src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&h=600&fit=crop&q=80"
                    alt="Career growth illustration"
                    className="rounded-2xl shadow-lift object-cover w-full h-full"
                  />

                  {/* Floating card 1 */}
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute top-10 -left-6 bg-[#11152B] border-2 border-primary/30 rounded-xl p-4 shadow-2xl backdrop-blur-sm"
                    style={{ boxShadow: '0 0 30px rgba(168,85,247,0.3), 0 10px 40px rgba(0,0,0,0.5)' }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#A855F7] to-[#D500F9]">
                        <TrendingUp className="text-white" size={20} />
                      </div>
                      <div>
                        <div className="text-xs text-muted font-medium">Career Growth</div>
                        <div className="font-bold text-lg text-primary">85% Match</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Floating card 2 */}
                  <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                    className="absolute bottom-10 -right-6 bg-[#11152B] border-2 border-primary/30 rounded-xl p-4 shadow-2xl backdrop-blur-sm"
                    style={{ boxShadow: '0 0 30px rgba(168,85,247,0.3), 0 10px 40px rgba(0,0,0,0.5)' }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#A855F7] to-[#D500F9]">
                        <Award className="text-white" size={20} />
                      </div>
                      <div>
                        <div className="text-xs text-muted font-medium">Skills Gained</div>
                        <div className="font-bold text-lg text-primary">12 New</div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Milestone Timeline Section ─────────────────────────────────────── */}
      <section className="stats-section bg-base py-20 sm:py-28">
        <div className="section-container">
          {/* Brand strip */}
          <BrandStrip className="mb-14 sm:mb-20" />

          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16 sm:mb-24"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              <Sparkles size={14} style={{ color: '#C084FC' }} />
              <span className="text-sm font-medium" style={{ color: '#C084FC' }}>Our Impact at a Glance</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              The CareerPath{' '}
              <span style={{ color: '#A855F7' }}>Milestone Journey</span>
            </h2>
            <p className="text-lg text-muted max-w-2xl mx-auto">
              Every number tells a story. See how we&apos;ve grown — and how we&apos;re helping
              students and fresh graduates step confidently into their careers.
            </p>
          </motion.div>

          {/* Vertical timeline wrapper */}
          <div className="relative">
            {/* Desktop center spine */}
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: 'easeInOut' }}
              className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 origin-top hidden md:block"
              style={{
                width: 2,
                background: 'linear-gradient(180deg, rgba(168,85,247,0) 0%, #A855F7 6%, #D500F9 94%, rgba(213,0,249,0) 100%)',
                boxShadow: '0 0 14px rgba(168,85,247,0.55)',
              }}
            />

            {/* Mobile left spine */}
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: 'easeInOut' }}
              className="absolute top-0 bottom-0 origin-top md:hidden"
              style={{
                left: 24,
                width: 2,
                background: 'linear-gradient(180deg, rgba(168,85,247,0) 0%, #A855F7 6%, #D500F9 94%, rgba(213,0,249,0) 100%)',
                boxShadow: '0 0 10px rgba(168,85,247,0.45)',
              }}
            />

            {/* Cards */}
            <div className="flex flex-col gap-14 sm:gap-20">
              {milestones.map((m, idx) => (
                <TimelineCard
                  key={m.label}
                  milestone={m}
                  isLeft={idx % 2 === 0}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section bg-section py-16">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              What Our Users Say
            </h2>
            <p className="text-lg text-muted max-w-2xl mx-auto">
              Hear from students and graduates who have found success with CareerPath.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="neon-card p-6"
            >
              <p className="text-muted mb-4">
                &ldquo;CareerPath helped me discover my passion and land my dream job. The personalized recommendations are spot on!&rdquo;
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <img src="https://picsum.photos/40/40?random=1" alt="User avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-semibold">John Doe</div>
                  <div className="text-xs text-muted">Software Engineer, ABC Corp</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="neon-card p-6"
            >
              <p className="text-muted mb-4">
                &ldquo;The resources and job matches I received were incredibly helpful. I felt supported throughout my job search.&rdquo;
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <img src="https://picsum.photos/40/40?random=2" alt="User avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Jane Smith</div>
                  <div className="text-xs text-muted">Data Analyst, XYZ Inc</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section bg-section py-16">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-[#A855F7] to-[#7C3AED] rounded-2xl p-12 text-center text-white"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              Ready to Start Your Career Journey?
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Join thousands of students and fresh graduates discovering their perfect career path.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center space-x-2 px-8 py-4 btn-primary font-semibold active:scale-95"
            >
              <span>Get Started Free</span>
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
