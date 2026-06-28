/**
 * NotificationsContext — real-time, Firestore-backed notifications.
 *
 * - Subscribes to users/{uid}/notifications ordered by createdAt desc.
 * - Exposes: notifications, unreadCount, loading, plus action helpers
 *   (markRead, markAllRead, remove, clearAll).
 * - On new unread notification (after first snapshot), fires a toast
 *   so the user sees it even when the dropdown is closed.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import {
  markNotificationRead,
  markAllRead as svcMarkAllRead,
  deleteNotification,
  clearAllNotifications,
  seedWelcomeIfEmpty,
} from '../services/notificationsService';

const NotificationsContext = createContext(null);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    // Safe defaults so consumers don't crash when wrapped lazily.
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      markRead: () => {},
      markAllRead: () => {},
      remove: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
}

export function NotificationsProvider({ children }) {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const seenIdsRef = useRef(new Set());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([]);
      seenIdsRef.current = new Set();
      firstLoadRef.current = true;
      return undefined;
    }

    // Best-effort welcome seed
    seedWelcomeIfEmpty(currentUser.uid);

    setLoading(true);
    const col = collection(db, 'users', currentUser.uid, 'notifications');
    const q = query(col, orderBy('createdAt', 'desc'), limit(50));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type || 'info',
            title: data.title || '',
            body: data.body || '',
            link: data.link || null,
            icon: data.icon || null,
            read: !!data.read,
            createdAt: data.createdAt || null,
          };
        });
        setNotifications(list);
        setLoading(false);

        // Toast on truly new unread notifications (skip on initial snapshot).
        if (!firstLoadRef.current) {
          for (const n of list) {
            if (!n.read && !seenIdsRef.current.has(n.id)) {
              toast(n.title, {
                icon: n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : '🔔',
                duration: 4500,
              });
            }
          }
        }
        seenIdsRef.current = new Set(list.map((n) => n.id));
        firstLoadRef.current = false;
      },
      (err) => {
        console.warn('[notifications] subscription error', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUser?.uid]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const api = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      markRead: (id) => currentUser?.uid && markNotificationRead(currentUser.uid, id),
      markAllRead: () => currentUser?.uid && svcMarkAllRead(currentUser.uid),
      remove: (id) => currentUser?.uid && deleteNotification(currentUser.uid, id),
      clearAll: () => currentUser?.uid && clearAllNotifications(currentUser.uid),
    }),
    [notifications, unreadCount, loading, currentUser?.uid]
  );

  return (
    <NotificationsContext.Provider value={api}>
      {children}
    </NotificationsContext.Provider>
  );
}
