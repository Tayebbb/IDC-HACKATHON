/**
 * Footer — site-wide footer.
 * Styled with the glass design system, theme-aware.
 */

import { Link } from 'react-router-dom';
import { Github, Linkedin, Twitter, Mail, Heart } from 'lucide-react';
import { CompetitionFooter } from './branding';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    platform: [
      { label: 'About Us', to: '/about' },
      { label: 'Jobs', to: '/jobs' },
      { label: 'Resources', to: '/resources' },
      { label: 'Contact', to: '/contact' },
      { label: 'Stratify', to: 'https://stratifyai-gray.vercel.app/', external: true },
    ],
    support: [
      { label: 'Help Center', to: '#' },
      { label: 'Privacy Policy', to: '#' },
      { label: 'Terms of Service', to: '#' },
    ],
  };

  const socialLinks = [
    { icon: Github, href: 'https://github.com', label: 'GitHub' },
    { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Mail, href: 'mailto:support@careerpath.com', label: 'Email' },
  ];

  return (
    <footer className="relative mt-12 border-t border-glass-border/15 bg-bg-base/40">
      <div className="section-container py-12 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-card-gradient flex items-center justify-center text-white font-bold text-lg shadow-glass-glow">
                C
              </div>
              <span className="font-heading text-xl font-bold gradient-text">CareerPath</span>
            </div>
            <p className="text-text-muted text-sm leading-relaxed">
              Empowering youth with career opportunities and personalized learning paths aligned with SDG 8.
            </p>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-icon w-9 h-9"
                    aria-label={social.label}
                  >
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="font-heading font-semibold text-text-main mb-4">Platform</h3>
            <ul className="space-y-2">
              {footerLinks.platform.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-text-muted hover:text-primary-light transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.to}
                      className="text-sm text-text-muted hover:text-primary-light transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="font-heading font-semibold text-text-main mb-4">Support</h3>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-text-muted hover:text-primary-light transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-heading font-semibold text-text-main mb-4">Stay updated</h3>
            <p className="text-sm text-text-muted mb-3">
              Get new job opportunities and resources in your inbox.
            </p>
            <form
              className="flex items-stretch gap-2"
              onSubmit={(e) => e.preventDefault()}
              aria-label="Subscribe to newsletter"
            >
              <input
                type="email"
                placeholder="you@example.com"
                className="input-field flex-1 text-sm py-2"
                aria-label="Email for newsletter"
              />
              <button type="submit" className="btn-primary btn-sm whitespace-nowrap">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-glass-border/12 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-text-muted text-sm inline-flex items-center flex-wrap gap-1">
            © {currentYear} CareerPath. Built with
            <Heart size={14} className="text-accent-pink" aria-hidden />
            for youth employment.
          </p>
          <p className="text-text-muted text-sm">
            Aligned with{' '}
            <span className="font-semibold text-primary-light">SDG 8</span> — Decent Work & Economic Growth
          </p>
        </div>

        <CompetitionFooter />
      </div>
    </footer>
  );
};

export default Footer;
