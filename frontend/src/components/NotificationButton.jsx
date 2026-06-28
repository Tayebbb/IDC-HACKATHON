/**
 * NotificationButton — bell with real-time Firestore-backed notifications.
 *
 * Consumes NotificationsContext. Shows unread count badge, animated bell
 * shake on new unread, dropdown with grouped items (Today / Earlier),
 * per-item actions (open link / mark read / delete), and bulk actions
 * (mark all read / clear all).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, BellRing, Check, CheckCheck, Trash2, ExternalLink,
  Sparkles, MessageSquare, Briefcase, GraduationCap, Target,
  Info, AlertTriangle, CheckCircle2, XCircle, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationsContext';

const ICON_MAP = {
  Sparkles, MessageSquare, Briefcase, GraduationCap, Target, Bell,
  Info, AlertTriangle, CheckCircle2, XCircle,
};

const TYPE_STYLES = {
  info:    { color: '#38bdf8', Icon: Info },
  success: { color: '#22c55e', Icon: CheckCircle2 },
  warning: { color: '#f59e0b', Icon: AlertTriangle },
  error:   { color: '#ef4444', Icon: XCircle },
  feature: { color: '#A855F7', Icon: Sparkles },
};

function relativeTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7)     return `${days}d ago`;
  return d.toLocaleDateString();
}

function isToday(ts) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export default function NotificationButton() {
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const dropdownRef = useRef(null);
  const prevUnreadRef = useRef(unreadCount);
  const navigate = useNavigate();

  // Click-outside close
  useEffect(() => {
    function onClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Bell shake when unread grows
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 900);
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
    return undefined;
  }, [unreadCount]);

  const { today, earlier } = useMemo(() => {
    const today = [];
    const earlier = [];
    for (const n of notifications) {
      (isToday(n.createdAt) ? today : earlier).push(n);
    }
    return { today, earlier };
  }, [notifications]);

  const handleOpen = (n) => {
    if (!n.read) markRead(n.id);
    if (n.link) {
      setIsOpen(false);
      navigate(n.link);
    }
  };

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);
  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        type="button"
        onClick={() => setIsOpen((s) => !s)}
        className="btn-icon w-10 h-10 relative"
        aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        animate={shake ? { rotate: [0, -14, 12, -10, 8, -6, 4, 0] } : { rotate: 0 }}
        transition={shake ? { duration: 0.9 } : { duration: 0.2 }}
      >
        {hasUnread ? <BellRing size={18} /> : <Bell size={18} />}
        {hasUnread && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full px-1 ring-2 ring-bg-base"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {badgeText}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-32px)] glass-panel z-50 overflow-hidden"
            role="menu"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-glass-border/15 flex items-center gap-2">
              <p className="text-sm font-semibold text-text-main">Notifications</p>
              {hasUnread && <span className="badge badge-primary">{badgeText} new</span>}
              <div className="ml-auto flex items-center gap-1">
                {hasUnread && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-text-muted hover:text-text-main hover:bg-text-main/5"
                    title="Mark all as read"
                  >
                    <CheckCheck size={12} /> Mark all
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear all notifications?')) clearAll();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-text-muted hover:text-error hover:bg-error/10"
                    title="Clear all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[440px] overflow-auto">
              {notifications.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  {today.length > 0 && (
                    <Section title="Today">
                      {today.map((n) => (
                        <Item
                          key={n.id}
                          n={n}
                          onOpen={() => handleOpen(n)}
                          onMarkRead={() => markRead(n.id)}
                          onRemove={() => remove(n.id)}
                        />
                      ))}
                    </Section>
                  )}
                  {earlier.length > 0 && (
                    <Section title="Earlier">
                      {earlier.map((n) => (
                        <Item
                          key={n.id}
                          n={n}
                          onOpen={() => handleOpen(n)}
                          onMarkRead={() => markRead(n.id)}
                          onRemove={() => remove(n.id)}
                        />
                      ))}
                    </Section>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
        {title}
      </p>
      <div className="py-0.5">{children}</div>
    </div>
  );
}

function Item({ n, onOpen, onMarkRead, onRemove }) {
  const { color, Icon: TypeIcon } = TYPE_STYLES[n.type] || TYPE_STYLES.info;
  const CustomIcon = n.icon && ICON_MAP[n.icon];
  const Icon = CustomIcon || TypeIcon;

  return (
    <div
      className={[
        'group relative px-4 py-2.5 transition-colors duration-150 cursor-pointer',
        'hover:bg-primary/10',
        !n.read ? 'bg-primary/[0.045]' : '',
      ].join(' ')}
      role="menuitem"
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <span
          className={[
            'mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0',
            !n.read ? 'bg-primary' : 'bg-transparent',
          ].join(' ')}
        />
        {/* Type icon */}
        <span
          className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg"
          style={{
            background: `${color}1f`,
            color,
            border: `1px solid ${color}44`,
          }}
        >
          <Icon size={14} />
        </span>
        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium text-text-main truncate">{n.title}</p>
            {n.link && <ExternalLink size={11} className="text-text-subtle flex-shrink-0" />}
          </div>
          {n.body && (
            <p className="text-[11.5px] text-text-muted line-clamp-2 mt-0.5">
              {n.body}
            </p>
          )}
          <p className="text-[10.5px] text-text-subtle mt-1">{relativeTime(n.createdAt)}</p>
        </div>
        {/* Actions (hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 flex-shrink-0">
          {!n.read && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
              title="Mark as read"
              className="inline-flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text-main hover:bg-text-main/10"
            >
              <Check size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Dismiss"
            className="inline-flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-error hover:bg-error/10"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 inline-flex items-center justify-center mb-3">
        <Bell size={20} className="text-primary" />
      </div>
      <p className="text-sm font-medium text-text-main">You're all caught up</p>
      <p className="text-[12px] text-text-muted mt-1">
        New activity will show up here in real time.
      </p>
    </div>
  );
}
