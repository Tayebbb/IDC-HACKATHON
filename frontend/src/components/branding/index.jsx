/**
 * Branding module — CodeFront × Mindsparks × AUST IDC integration.
 *
 * This file is the single source of truth for every visual touchpoint that
 * carries event branding. Components are intentionally compact and reusable
 * so we never duplicate logo markup across pages.
 *
 * Design rules (per competition brief):
 *   • CareerPath remains the primary brand. Event logos are accents only.
 *   • The Mindsparks "spark" represents the AI/intelligence layer of the
 *     product. It only appears beside AI-generated content, never beside
 *     user-entered data.
 *   • CodeFront / AUST IDC logos appear in attribution surfaces only
 *     (footer, brand strip, about credits).
 *   • A reserved accent colour (`--ms-accent`) is allowed on AI surfaces
 *     and nowhere else.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

// Public-folder paths. The folder on disk is `Code Front` (mixed case, with
// a space). Windows is case-insensitive, but Linux deploys (HF Spaces /
// Vercel) are NOT — so we MUST match the on-disk casing exactly. Spaces
// inside the URL are encoded by the browser at request time.
const BRAND_PATH = '/Code Front';
export const MINDSPARKS_LOGO = `${BRAND_PATH}/Mindsparks 26 Logo.png`;
export const CODEFRONT_LOGO  = `${BRAND_PATH}/Code front.png`;
export const AUST_IDC_WHITE  = `${BRAND_PATH}/AUST IDC - White.png`;
export const AUST_IDC_BLACK  = `${BRAND_PATH}/AUST IDC - Black.png`;

// Reserved Mindsparks accent colour (drawn from the lightning-bolt yellow
// + red in the official 26 logo). Only AI-generated surfaces may use it.
export const MS_ACCENT = '#F59E0B';        // amber spark
export const MS_ACCENT_SOFT = '#FCD34D';   // softer highlight
export const MS_ACCENT_DEEP = '#EF4444';   // 26 red

// =====================================================================
// AIMark — the OFFICIAL Mindsparks 26 logo presented as a compact badge.
// Use this on prominent AI surfaces (floating button, chat avatars,
// reasoning headers) where judges should recognise the actual asset.
//
// Renders the wide logo at proper aspect ratio inside a rounded card.
// Use `AIAvatar` only inside circular contexts where this won't fit
// (e.g. the spinning loader).
// =====================================================================
export function AIMark({
  height = 28,
  className = '',
  showRing = true,
  title = 'Mindsparks AI',
}) {
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 rounded-xl ${className}`}
      style={{
        background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
        padding: `${Math.max(3, Math.round(height * 0.18))}px ${Math.max(6, Math.round(height * 0.32))}px`,
        boxShadow: showRing
          ? `0 0 ${Math.round(height * 0.9)}px rgba(245,158,11,0.30), inset 0 0 0 1px rgba(245,158,11,0.40)`
          : 'inset 0 0 0 1px rgba(245,158,11,0.30)',
      }}
      aria-label={title}
      title={title}
    >
      <img
        src={MINDSPARKS_LOGO}
        alt={title}
        loading="lazy"
        decoding="async"
        style={{ height: `${height}px`, width: 'auto', display: 'block' }}
      />
    </span>
  );
}

// =====================================================================
// AIAvatar — circular SVG bolt badge. KEPT for the spinning loader and
// any other place where a circle is required by the visual context.
// For prominent AI surfaces (chat messages, floating button, reasoning
// header) use AIMark instead, which renders the real Mindsparks logo.
// =====================================================================
export function AIAvatar({ size = 36, glow = true, className = '' }) {
  const px = `${size}px`;
  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: px, height: px }}
      aria-label="Mindsparks AI"
      title="Mindsparks AI"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
          boxShadow: glow
            ? `0 0 ${Math.round(size * 0.45)}px rgba(245,158,11,0.35), inset 0 0 0 1px rgba(245,158,11,0.35)`
            : 'inset 0 0 0 1px rgba(245,158,11,0.35)',
        }}
      />
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 m-auto"
        style={{
          width: `${Math.round(size * 0.62)}px`,
          height: `${Math.round(size * 0.62)}px`,
        }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`ms-bolt-${size}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={MS_ACCENT_SOFT} />
            <stop offset="55%"  stopColor={MS_ACCENT} />
            <stop offset="100%" stopColor={MS_ACCENT_DEEP} />
          </linearGradient>
        </defs>
        <path
          d="M13.5 2 L4 13.5 H11 L9.5 22 L20 9.5 H13 Z"
          fill={`url(#ms-bolt-${size})`}
          stroke="rgb(var(--c-shadow) / 0.35)"
          strokeWidth="0.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// =====================================================================
// MindsparksMark — the actual Mindsparks logo at controlled aspect ratio,
// for use in card headers ("AI Insight", "AI Reasoning") and brand strips.
// =====================================================================
export function MindsparksMark({ height = 22, className = '' }) {
  return (
    <img
      src={MINDSPARKS_LOGO}
      alt="Mindsparks 26"
      loading="lazy"
      decoding="async"
      style={{ height: `${height}px`, width: 'auto' }}
      className={`select-none ${className}`}
    />
  );
}

// =====================================================================
// AIInsightBadge — header tag for AI-generated cards.
// Format:  [Mindsparks mark]   AI Insight
//
// Use anywhere the system produced something (recommendation, reasoning,
// summary). Don't use beside user-entered data.
// =====================================================================
export function AIInsightBadge({ label = 'AI Insight', className = '' }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${className}`}
      style={{
        background: 'rgba(245, 158, 11, 0.10)',
        border: '1px solid rgba(245, 158, 11, 0.28)',
      }}
    >
      <MindsparksMark height={14} />
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: MS_ACCENT_SOFT, letterSpacing: '0.08em' }}
      >
        {label}
      </span>
    </div>
  );
}

// =====================================================================
// AIReasoningHeader — used at the top of every explainability card.
// Replaces the previous plain "Why this answer?" header.
// =====================================================================
export function AIReasoningHeader({ title = 'AI Reasoning', className = '' }) {
  return (
    <div className={`flex items-center gap-3 mb-3 ${className}`}>
      <AIMark height={22} />
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: MS_ACCENT_SOFT }}
        >
          Mindsparks AI
        </div>
        <div className="text-sm font-heading font-bold text-white leading-tight">
          {title}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// AILoading — branded loading indicator. Replaces generic spinners
// wherever the system is producing AI output (roadmap generation,
// CV analysis, prediction, page-level Suspense fallback).
// =====================================================================
export function AILoading({
  label = 'Mindsparks AI is thinking…',
  size = 56,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className="relative"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {/* Pulsing ring */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 2px rgba(245,158,11,0.35), 0 0 ${size * 0.6}px rgba(245,158,11,0.25)`,
            animation: 'ms-pulse 1.6s ease-in-out infinite',
          }}
        />
        {/* Orbiting dot */}
        <span
          className="absolute"
          style={{
            top: '0%',
            left: '50%',
            width: '8px',
            height: '8px',
            marginLeft: '-4px',
            borderRadius: '50%',
            background: MS_ACCENT,
            boxShadow: `0 0 12px ${MS_ACCENT}`,
            transformOrigin: `0 ${size / 2}px`,
            animation: 'ms-orbit 2.2s linear infinite',
          }}
        />
        {/* Center mark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AIAvatar size={Math.round(size * 0.6)} />
        </div>
      </div>
      {label && (
        <div
          className="text-xs font-medium tracking-wide"
          style={{ color: MS_ACCENT_SOFT }}
        >
          {label}
        </div>
      )}
      <style>{`
        @keyframes ms-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.8; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
        @keyframes ms-orbit {
          from { transform: rotate(0deg)   translateY(-${size / 2}px) rotate(0deg); }
          to   { transform: rotate(360deg) translateY(-${size / 2}px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}

// =====================================================================
// BrandStrip — landing-page strip with "Built for / Powered by / Organized
// by" attribution. Elegant, premium, modern, and beautifully glassmorphic.
// =====================================================================
export function BrandStrip({ className = '' }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const austLogo = isLight ? AUST_IDC_BLACK : AUST_IDC_WHITE;

  const item = (label, logo, alt, height = 32, glowColor = 'rgba(168,85,247,0.2)', darkBg = false) => (
    <div 
      className="group relative flex flex-col items-center gap-3 py-4 px-6 sm:px-8 rounded-2xl transition-all duration-300 select-none overflow-hidden"
      style={{
        background: darkBg
          ? 'linear-gradient(180deg, #1F2937 0%, #0F172A 100%)'
          : 'linear-gradient(180deg, rgb(var(--c-on-card) / 0.04) 0%, rgb(var(--c-on-card) / 0.015) 100%)',
        border: darkBg
          ? '1px solid rgba(168, 85, 247, 0.35)'
          : '1px solid rgb(var(--c-on-card) / 0.08)',
        boxShadow: '0 4px 20px rgb(var(--c-shadow) / 0.18)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Dynamic background glow ring on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${glowColor} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      {/* Subtle border highlight on hover */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          border: '1px solid rgba(168, 85, 247, 0.25)',
          boxShadow: `0 0 16px ${glowColor}`,
        }}
      />

      <span
        className="text-[9px] font-bold uppercase tracking-[0.25em] transition-colors duration-300"
        style={{ color: darkBg ? 'rgba(255,255,255,0.75)' : 'rgb(var(--c-text-muted))' }}
      >
        {label}
      </span>
      <div className="relative flex items-center justify-center h-[60px] w-[180px]">
        <img
          src={logo}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{ height: `${height}px`, width: 'auto' }}
          className="object-contain opacity-100 group-hover:scale-105 transition-transform duration-300 filter drop-shadow-[0_2px_8px_rgb(var(--c-shadow)/0.35)]"
        />
      </div>
    </div>
  );

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-6 px-6 rounded-3xl border relative ${className}`}
      style={{
        background:
          'linear-gradient(135deg, rgb(var(--c-card) / 0.55) 0%, rgb(var(--c-card-2) / 0.85) 100%)',
        borderColor: 'rgb(var(--c-primary) / 0.18)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px 0 rgb(var(--c-shadow) / 0.22)',
      }}
    >
      {/* Top subtle decorative gradient border line */}
      <div 
        className="absolute top-0 left-10 right-10 h-[1px]" 
        style={{
          background: 'linear-gradient(90deg, rgba(168,85,247,0) 0%, rgba(168,85,247,0.3) 50%, rgba(168,85,247,0) 100%)'
        }}
      />
      
      {item('Built for',     CODEFRONT_LOGO,  'CodeFront', 44, 'rgba(168, 85, 247, 0.2)', isLight)}
      {item('Powered by',    MINDSPARKS_LOGO, 'Mindsparks 26', 52, 'rgba(245, 158, 11, 0.2)')}
      {item('Organized by',  austLogo,        'AUST IDC', 56, 'rgb(var(--c-on-card) / 0.15)')}
    </div>
  );
}

// =====================================================================
// CompetitionFooter — drop-in row that the main Footer wraps to add
// event attribution. Kept small, screen-bottom appropriate.
// =====================================================================
export function CompetitionFooter({ className = '' }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const austLogo = isLight ? AUST_IDC_BLACK : AUST_IDC_WHITE;
  const logoCls = 'h-9 sm:h-11 w-auto object-contain opacity-100 transition-transform hover:scale-105';
  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-6 border-t ${className}`}
      style={{ borderColor: 'rgb(var(--c-on-card) / 0.10)' }}
    >
      <div className="flex items-center gap-2 text-text-muted text-sm">
        <Link to="/" className="font-heading font-semibold text-text-main">
          CareerPath
        </Link>
        <span className="text-text-subtle">·</span>
        <span className="text-xs">Built for the CodeFront Challenge</span>
      </div>
      <div className="flex items-center gap-5 sm:gap-7">
        <img src={CODEFRONT_LOGO}  alt="CodeFront"     className={logoCls} loading="lazy" />
        <img src={MINDSPARKS_LOGO} alt="Mindsparks 26" className={logoCls} loading="lazy" />
        <img src={austLogo}        alt="AUST IDC"      className={`${logoCls} h-9 sm:h-10`} loading="lazy" />
      </div>
    </div>
  );
}

// =====================================================================
// CompetitionCredits — full credits block for the About page.
// =====================================================================
export function CompetitionCredits({ className = '' }) {
  return (
    <div
      className={`card p-8 ${className}`}
      style={{
        background: 'rgb(var(--c-card) / 0.7)',
        border: '1px solid rgba(245, 158, 11, 0.18)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <AIMark height={26} />
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: MS_ACCENT_SOFT }}
          >
            Competition
          </div>
          <h3 className="font-heading text-xl font-bold text-white">
            Developed for the CodeFront Challenge
          </h3>
        </div>
      </div>
      <p className="text-text-muted text-sm leading-relaxed mb-6">
        This project incorporates the official Mindsparks and CodeFront branding
        assets provided by the organizers. CareerPath was built end-to-end during
        the competition window, and the Mindsparks intelligence layer powers every
        AI-generated recommendation, explanation, and roadmap in the product.
      </p>
      <div className="flex flex-wrap items-center gap-8">
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            Challenge
          </span>
          <img src={CODEFRONT_LOGO} alt="CodeFront" className="h-7 w-auto" />
        </div>
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            Identity
          </span>
          <img src={MINDSPARKS_LOGO} alt="Mindsparks 26" className="h-10 w-auto" />
        </div>
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            Organizer
          </span>
          <img src={AUST_IDC_WHITE} alt="AUST IDC" className="h-12 w-auto" />
        </div>
      </div>
    </div>
  );
}
