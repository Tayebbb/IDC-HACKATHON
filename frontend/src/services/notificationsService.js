/**
 * notificationsService — Firestore-backed user notifications.
 *
 * Document shape (users/{uid}/notifications/{id}):
 *   {
 *     type: 'info' | 'success' | 'warning' | 'error' | 'feature',
 *     title: string,
 *     body?: string,
 *     link?: string,        // internal route, opened on click
 *     icon?: string,        // lucide icon name (resolved at render)
 *     read: boolean,
 *     createdAt: serverTimestamp,
 *   }
 *
 * Public API:
 *   notifyUser(uid, payload)        — create
 *   markNotificationRead(uid, id)   — flip read=true
 *   markAllRead(uid)                — bulk
 *   deleteNotification(uid, id)     — single delete
 *   clearAllNotifications(uid)      — wipe
 *   seedWelcomeIfEmpty(uid)         — best-effort first-run greeting
 */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';

function notifCol(uid) {
  return collection(db, 'users', uid, 'notifications');
}

export async function notifyUser(uid, payload) {
  if (!uid || !payload?.title) return null;
  try {
    const ref = await addDoc(notifCol(uid), {
      type: payload.type || 'info',
      title: String(payload.title).slice(0, 120),
      body: payload.body ? String(payload.body).slice(0, 400) : '',
      link: payload.link || null,
      icon: payload.icon || null,
      read: false,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    console.warn('[notifications] create failed', e);
    return null;
  }
}

export async function markNotificationRead(uid, id) {
  if (!uid || !id) return;
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true });
  } catch (e) {
    console.warn('[notifications] mark read failed', e);
  }
}

export async function markAllRead(uid) {
  if (!uid) return;
  try {
    const snap = await getDocs(query(notifCol(uid), where('read', '==', false)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (e) {
    console.warn('[notifications] mark all read failed', e);
  }
}

export async function deleteNotification(uid, id) {
  if (!uid || !id) return;
  try {
    await deleteDoc(doc(db, 'users', uid, 'notifications', id));
  } catch (e) {
    console.warn('[notifications] delete failed', e);
  }
}

export async function clearAllNotifications(uid) {
  if (!uid) return;
  try {
    const snap = await getDocs(notifCol(uid));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.warn('[notifications] clear all failed', e);
  }
}

export async function seedWelcomeIfEmpty(uid) {
  if (!uid) return;
  try {
    const snap = await getDocs(query(notifCol(uid), limit(1)));
    if (!snap.empty) return;
    await notifyUser(uid, {
      type: 'feature',
      title: 'Welcome to CareerPath!',
      body: 'Complete your profile to unlock personalised job matches and a Career DNA score.',
      icon: 'Sparkles',
      link: '/profile',
    });
    await notifyUser(uid, {
      type: 'info',
      title: 'Try the AI Career Assistant',
      body: 'Get instant answers about jobs, skills and interview prep.',
      icon: 'MessageSquare',
      link: '/chatassistance',
    });
  } catch (e) {
    console.warn('[notifications] seed failed', e);
  }
}
