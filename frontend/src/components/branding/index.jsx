/**
 * CareerPath branding module.
 *
 * This file is the single source of truth for neutral product marks used by
 * AI surfaces, explainability cards, footer attribution, and landing-page
 * proof points. It intentionally uses CSS/SVG marks instead of external event
 * logos so the product identity stays portable.
 */
import React from 'react';
import { Link } from 'react-router-dom';

export const AI_ACCENT = '#F59E0B';
export const AI_ACCENT_SOFT = '#FCD34D';
export const AI_ACCENT_DEEP = '#EF4444';

function CareerPathGlyph({ size = 24 }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`cp-glyph-${size}`} x1="6" y1="6" x2="42" y2="42">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="48%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill="rgba(15, 23, 42, 0.96)" />
      <path
        d="M14 31c4.5-9.5 10.2-14.4 19-15.5"
        fill="none"
        stroke={`url(#cp-glyph-${size})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M31 11l6 4.5-5.2 5.4"
        fill="none"
        stroke="#FCD34D"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="32" r="3.2" fill="#38BDF8" />
    </svg>
  );
}

export function AIMark({
  height = 28,
  className = '',
  showRing = true,
  title = 'CareerPath AI',
}) {
  const iconSize = Math.max(18, Math.round(height * 0.78));
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 rounded-xl ${className}`}
      style={{
        background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
        padding: `${Math.max(4, Math.round(height * 0.18))}px ${Math.max(8, Math.round(height * 0.32))}px`,
        boxShadow: showRing
          ? `0 0 ${Math.round(height * 0.9)}px rgba(168,85,247,0.28), inset 0 0 0 1px rgba(245,158,11,0.35)`
          : 'inset 0 0 0 1px rgba(245,158,11,0.28)',
      }}
      aria-label={title}
      title={title}
    >
      <CareerPathGlyph size={iconSize} />
    </span>
  );
}

export function AIAvatar({ size = 36, glow = true, className = '' }) {
  const px = `${size}px`;
  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: px, height: px }}
      aria-label="CareerPath AI"
      title="CareerPath AI"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
          boxShadow: glow
            ? `0 0 ${Math.round(size * 0.45)}px rgba(168,85,247,0.35), inset 0 0 0 1px rgba(245,158,11,0.35)`
            : 'inset 0 0 0 1px rgba(245,158,11,0.35)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <CareerPathGlyph size={Math.round(size * 0.72)} />
      </div>
    </div>
  );
}

export function CareerPathMark({ height = 22, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg ${className}`}
      style={{
        width: `${Math.round(height * 1.6)}px`,
        height: `${height}px`,
        background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(56,189,248,0.16))',
        border: '1px solid rgba(245,158,11,0.28)',
      }}
      aria-label="CareerPath"
      title="CareerPath"
    >
      <CareerPathGlyph size={Math.max(16, Math.round(height * 0.8))} />
    </span>
  );
}

export function AIInsightBadge({ label = 'AI Insight', className = '' }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${className}`}
      style={{
        background: 'rgba(245, 158, 11, 0.10)',
        border: '1px solid rgba(245, 158, 11, 0.28)',
      }}
    >
      <CareerPathMark height={18} />
      <span
        className="text-[11px] font-semibold uppercase"
        style={{ color: AI_ACCENT_SOFT }}
      >
        {label}
      </span>
    </div>
  );
}

export function AIReasoningHeader({ title = 'AI Reasoning', className = '' }) {
  return (
    <div className={`flex items-center gap-3 mb-3 ${className}`}>
      <AIMark height={22} />
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold uppercase"
          style={{ color: AI_ACCENT_SOFT }}
        >
          CareerPath AI
        </div>
        <div className="text-sm font-heading font-bold text-white leading-tight">
          {title}
        </div>
      </div>
    </div>
  );
}

export function AILoading({
  label = 'CareerPath AI is thinking...',
  size = 56,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className="relative"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 2px rgba(245,158,11,0.35), 0 0 ${size * 0.6}px rgba(168,85,247,0.22)`,
            animation: 'cp-pulse 1.6s ease-in-out infinite',
          }}
        />
        <span
          className="absolute"
          style={{
            top: '0%',
            left: '50%',
            width: '8px',
            height: '8px',
            marginLeft: '-4px',
            borderRadius: '50%',
            background: AI_ACCENT,
            boxShadow: `0 0 12px ${AI_ACCENT}`,
            transformOrigin: `0 ${size / 2}px`,
            animation: 'cp-orbit 2.2s linear infinite',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <AIAvatar size={Math.round(size * 0.6)} />
        </div>
      </div>
      {label && (
        <div
          className="text-xs font-medium"
          style={{ color: AI_ACCENT_SOFT }}
        >
          {label}
        </div>
      )}
      <style>{`
        @keyframes cp-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes cp-orbit {
          from { transform: rotate(0deg) translateY(-${size / 2}px) rotate(0deg); }
          to { transform: rotate(360deg) translateY(-${size / 2}px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}

export function BrandStrip({ className = '' }) {
  const items = [
    {
      label: 'Grounded Guidance',
      title: 'Hybrid RAG',
      detail: 'BM25 plus dense retrieval over career knowledge',
      color: '#A855F7',
    },
    {
      label: 'Interview Coaching',
      title: 'Multimodal Signals',
      detail: 'Content, delivery, and composure in one score',
      color: '#F59E0B',
    },
    {
      label: 'Transparent Results',
      title: 'Explainability',
      detail: 'Confidence, evidence, and source factors',
      color: '#38BDF8',
    },
  ];

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 py-6 px-6 rounded-3xl border relative ${className}`}
      style={{
        background:
          'linear-gradient(135deg, rgb(var(--c-card) / 0.55) 0%, rgb(var(--c-card-2) / 0.85) 100%)',
        borderColor: 'rgb(var(--c-primary) / 0.18)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px 0 rgb(var(--c-shadow) / 0.22)',
      }}
    >
      {items.map((item) => (
        <div
          key={item.title}
          className="group relative flex flex-col items-center gap-3 py-5 px-5 rounded-2xl transition-all duration-300 select-none overflow-hidden text-center"
          style={{
            background: 'linear-gradient(180deg, rgb(var(--c-on-card) / 0.04) 0%, rgb(var(--c-on-card) / 0.015) 100%)',
            border: `1px solid ${item.color}44`,
            boxShadow: '0 4px 20px rgb(var(--c-shadow) / 0.18)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${item.color}22 0%, rgba(0,0,0,0) 70%)`,
            }}
          />
          <AIMark height={30} showRing={false} />
          <span
            className="text-[10px] font-bold uppercase"
            style={{ color: item.color }}
          >
            {item.label}
          </span>
          <div className="font-heading text-lg font-bold text-text-main">
            {item.title}
          </div>
          <p className="text-xs text-text-muted leading-relaxed max-w-[220px]">
            {item.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ProjectFooter({ className = '' }) {
  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-6 border-t ${className}`}
      style={{ borderColor: 'rgb(var(--c-on-card) / 0.10)' }}
    >
      <div className="flex items-center gap-2 text-text-muted text-sm">
        <Link to="/" className="font-heading font-semibold text-text-main">
          CareerPath
        </Link>
        <span className="text-text-subtle">|</span>
        <span className="text-xs">AI-powered career development platform</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <CareerPathMark height={24} />
        <span>Built for transparent career guidance</span>
      </div>
    </div>
  );
}

export function ProjectCredits({ className = '' }) {
  return (
    <div
      className={`card p-8 ${className}`}
      style={{
        background: 'rgb(var(--c-card) / 0.7)',
        border: '1px solid rgba(245, 158, 11, 0.18)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <AIMark height={28} />
        <div>
          <div
            className="text-[10px] font-semibold uppercase"
            style={{ color: AI_ACCENT_SOFT }}
          >
            Project Identity
          </div>
          <h3 className="font-heading text-xl font-bold text-text-main">
            Built as CareerPath
          </h3>
        </div>
      </div>
      <p className="text-text-muted text-sm leading-relaxed mb-6">
        CareerPath uses a neutral product identity across its AI assistant,
        explainability cards, certificates, and footer surfaces. The platform
        focuses on grounded career guidance, readiness scoring, and transparent
        reasoning for students and fresh graduates.
      </p>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          ['Retrieval', 'Hybrid RAG over career knowledge'],
          ['Coaching', 'Mock interviews with multimodal feedback'],
          ['Trust', 'Cited sources and confidence factors'],
        ].map(([label, detail]) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{
              background: 'rgb(var(--c-on-card) / 0.04)',
              border: '1px solid rgb(var(--c-on-card) / 0.08)',
            }}
          >
            <div className="text-xs uppercase text-text-muted mb-2">
              {label}
            </div>
            <div className="text-sm font-semibold text-text-main">
              {detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
