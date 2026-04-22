'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState('');
  const [userRole, setUserRole] = useState('');
  const [shivirMap, setShivirMap] = useState<{ [id: string]: string }>({});
  const [userNameMap, setUserNameMap] = useState<{ [phone: string]: string }>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const phone = currentUser.phoneNumber!;
      setUserPhone(phone);

      const superAdminPhone = process.env.NEXT_PUBLIC_SUPER_ADMIN_PHONE;
      const isSuperAdmin = phone === superAdminPhone;

      if (isSuperAdmin) {
        setUserRole('superadmin');
        // Fetch shivir names and user names for context
        const [shivirSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'shivirs')),
          getDocs(collection(db, 'users')),
        ]);
        const sMap: { [id: string]: string } = {};
        shivirSnap.docs.forEach(d => { sMap[d.id] = d.data().name || d.id; });
        setShivirMap(sMap);

        const uMap: { [phone: string]: string } = {};
        usersSnap.docs.forEach(d => {
          const p = d.data().phone;
          const name = d.data().name;
          if (p && name) uMap[p] = name;
        });
        setUserNameMap(uMap);
      } else {
        const roleSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', phone)));
        if (!roleSnap.empty) setUserRole(roleSnap.docs[0].data().role);
      }

      await loadNotifications(phone);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadNotifications = async (phone: string) => {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      const superAdminPhone = process.env.NEXT_PUBLIC_SUPER_ADMIN_PHONE;
      const isSuperAdmin = phone === superAdminPhone;
      const all = snap.docs
        .filter(d => isSuperAdmin ? d.data().shivirId : d.data().userPhone === phone)
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
      setNotifications(all);
    } catch (e) {
      console.log('Error loading notifications:', e);
    }
  };

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, read: true } : n)
      );
    } catch (e) {
      console.log('Error marking as read:', e);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => markAsRead(n.id)));
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'expense_vote': return '🗳️';
      case 'expense_approved': return '✅';
      case 'expense_rejected': return '❌';
      case 'task_assigned': return '✅';
      case 'task_deadline': return '⏰';
      case 'samagri_dispatch': return '📦';
      case 'sishya_travel': return '✈️';
      case 'organiser_added': return '👤';
      case 'collection_added': return '💰';
      default: return '🔔';
    }
  };

  const goBack = () => {
    if (userRole === 'organiser') window.location.href = '/organiser';
    else if (userRole === 'sishya') window.location.href = '/sishya';
    else if (userRole === 'gurudev') window.location.href = '/super-admin';
    else if (userRole === 'dispatch') window.location.href = '/dispatch';
    else if (userRole === 'superadmin') window.location.href = '/super-admin';
    else window.location.href = '/super-admin';
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  const unreadCount = notifications.filter(n => !n.read).length;
  const isSuperAdmin = userRole === 'superadmin';

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goBack}
              className="text-orange-500 text-xl font-bold">←</button>
            <div>
              <h1 className="text-lg font-bold text-orange-600">🔔 Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-gray-400 text-xs">{unreadCount} unread</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}
              className="text-orange-500 text-sm font-medium">
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">🔔</div>
            <h3 className="font-bold text-gray-600 text-lg mb-2">No Notifications</h3>
            <p className="text-gray-400 text-sm">
              You are all caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const shivirName = shivirMap[notif.shivirId];
              const recipientName = userNameMap[notif.userPhone];
              const recipientLabel = recipientName
                ? `${recipientName} Ji`
                : notif.userPhone
                  ? notif.userPhone.replace('+91', '')
                  : null;

              return (
                <button
                  key={notif.id}
                  onClick={() => {
                    markAsRead(notif.id);
                    if (isSuperAdmin) return;
                    if (notif.type === 'room_share_approval') {
                      window.location.href = '/sishya/stay/room-approval';
                    } else if (notif.type === 'room_share_rejected') {
                      window.location.href = '/sishya/stay/self-book';
                    } else if (notif.type === 'stay_remark') {
                      window.location.href = '/organiser/stay';
                    } else if (notif.type === 'samagri_handover_to_sishya' || notif.type === 'samagri_sishya_receipt_confirmed' || notif.type === 'samagri_receipt_mismatch') {
                      window.location.href = '/sishya/samagri';
                    } else if (notif.type === 'samagri_return_from_sishya' || notif.type === 'samagri_return_confirmed' || notif.type === 'samagri_receipt_confirmed') {
                      window.location.href = '/organiser/gurudham';
                    } else if (notif.type === 'samagri_return_to_gurudham' || notif.type === 'samagri_gurudham_confirmed') {
                      window.location.href = userRole === 'dispatch' ? '/dispatch' : '/organiser/gurudham';
                    }
                  }}
                  className={`w-full text-left rounded-2xl shadow p-4 flex items-start gap-3 transition-all ${
                    notif.read ? 'bg-white' : 'bg-orange-50 border border-orange-200'
                  }`}>
                  <div className="text-2xl mt-0.5">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${
                        notif.read ? 'text-gray-600' : 'text-gray-800'
                      }`}>
                        {notif.title}
                      </p>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{notif.body}</p>

                    {/* Superadmin context row */}
                    {isSuperAdmin && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {shivirName && (
                          <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            🏕 {shivirName}
                          </span>
                        )}
                        {recipientLabel && (
                          <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                            → {recipientLabel}
                          </span>
                        )}
                      </div>
                    )}

                    {!notif.read && (
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
