/** @type {import('tailwindcss').Config} */
/**
 * CareerPath Tailwind config
 *
 * Colors resolve through CSS variables defined in `src/index.css`
 * so the entire app re-themes via `[data-theme="dark" | "light"]`.
 * `<alpha-value>` lets Tailwind opacity modifiers (e.g. `bg-base/80`) work.
 */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Surfaces — both naming conventions exposed so legacy `bg-bg-base`
        // and modern `bg-base` both work as native Tailwind utilities
        // (so opacity modifiers like `bg-section/80` resolve correctly).
        base: 'rgb(var(--c-bg-base) / <alpha-value>)',
        section: 'rgb(var(--c-bg-section) / <alpha-value>)',
        elevated: 'rgb(var(--c-bg-elevated) / <alpha-value>)',
        'bg-base': 'rgb(var(--c-bg-base) / <alpha-value>)',
        'bg-section': 'rgb(var(--c-bg-section) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--c-bg-elevated) / <alpha-value>)',

        // Glass surfaces
        'glass-surface': 'rgb(var(--c-glass-surface) / <alpha-value>)',
        'glass-border': 'rgb(var(--c-glass-border) / <alpha-value>)',
        'glass-strong': 'rgb(var(--c-glass-strong) / <alpha-value>)',

        // Brand
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'primary-light': 'rgb(var(--c-primary-light) / <alpha-value>)',
        'primary-dark': 'rgb(var(--c-primary-dark) / <alpha-value>)',
        'accent-pink': 'rgb(var(--c-accent-pink) / <alpha-value>)',
        'accent-blue': 'rgb(var(--c-accent-blue) / <alpha-value>)',

        // Text
        'text-main': 'rgb(var(--c-text-main) / <alpha-value>)',
        'text-muted': 'rgb(var(--c-text-muted) / <alpha-value>)',
        'text-subtle': 'rgb(var(--c-text-subtle) / <alpha-value>)',

        // Status
        success: 'rgb(var(--c-success) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        error: 'rgb(var(--c-error) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
      },
      backgroundImage: {
        'card-gradient':
          'linear-gradient(135deg, rgb(var(--c-primary)) 0%, rgb(var(--c-accent-pink)) 100%)',
        'section-gradient':
          'linear-gradient(180deg, rgb(var(--c-bg-base)) 0%, rgb(var(--c-bg-section)) 100%)',
        'aurora':
          'radial-gradient(60% 60% at 20% 10%, rgb(var(--c-primary) / 0.18) 0%, transparent 60%), radial-gradient(50% 50% at 80% 0%, rgb(var(--c-accent-blue) / 0.16) 0%, transparent 60%), radial-gradient(70% 70% at 50% 120%, rgb(var(--c-accent-pink) / 0.14) 0%, transparent 60%)',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        display: ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        h1: ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        h2: ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        h3: ['clamp(1.25rem, 2.4vw, 1.75rem)', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      borderRadius: {
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '28px',
      },
      boxShadow: {
        'glass-sm': '0 2px 10px rgb(var(--c-shadow) / 0.18)',
        'glass': '0 8px 28px rgb(var(--c-shadow) / 0.22), inset 0 1px 0 rgb(var(--c-glass-strong) / 0.08)',
        'glass-lg': '0 24px 60px rgb(var(--c-shadow) / 0.28), inset 0 1px 0 rgb(var(--c-glass-strong) / 0.12)',
        'glass-glow': '0 10px 40px rgb(var(--c-primary) / 0.18)',
        'neon-soft': '0 6px 30px rgb(var(--c-shadow) / 0.6)',
        'neon-glow': '0 0 30px rgb(var(--c-primary) / 0.18)',
        'focus-ring': '0 0 0 3px rgb(var(--c-primary) / 0.30)',
      },
      backdropBlur: {
        xs: '4px',
      },
      animation: {
        'fade-in': 'fadeIn 0.45s ease-out both',
        'slide-up': 'slideUp 0.5s ease-out both',
        'slide-down': 'slideDown 0.45s ease-out both',
        'scale-in': 'scaleIn 0.35s ease-out both',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.02)', opacity: '0.95' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      transitionTimingFunction: {
        'glass': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
