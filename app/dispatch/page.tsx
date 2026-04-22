'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatShivirDates, formatShivirLocation } from '@/lib/utils';

export default function DispatchDashboard() {
  const [userData, setUserData] = useState<any>(null);
  const [shivirs, setShivirs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'dispatch') {
        window.location.href = '/access-denied'; return;
      }
      setUserData({ id: userSnap.docs[0].id, ...userSnap.docs[0].data() });

      // Get all active/planning shivirs
      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const allShivirs = shivirSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Sort by start date
      allShivirs.sort((a: any, b: any) => {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });

      setShivirs(allShivirs);

      // Get unread notification count
      try {
        const notifSnap = await getDocs(collection(db, 'notifications'));
        const unread = notifSnap.docs.filter(d =>
          d.data().userPhone === currentUser.phoneNumber && !d.data().read
        ).length;
        setUnreadCount(unread);
      } catch (e) {}

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shivirDate = new Date(dateStr);
    shivirDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil((shivirDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getUrgencyColor = (days: number) => {
    if (days <= 7) return 'bg-red-100 text-red-600';
    if (days <= 10) return 'bg-orange-100 text-orange-600';
    if (days <= 15) return 'bg-yellow-100 text-yellow-600';
    return 'bg-green-100 text-green-600';
  };

  const getUrgencyLabel = (days: number) => {
    if (days < 0) return 'Shivir Passed';
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow!';
    if (days <= 7) return `${days} days — URGENT`;
    if (days <= 10) return `${days} days — Soon`;
    if (days <= 15) return `${days} days — Prepare`;
    return `${days} days`;
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  const upcomingShivirs = shivirs.filter((s: any) => getDaysUntil(s.startDate) >= 0);
  const pastShivirs = shivirs.filter((s: any) => getDaysUntil(s.startDate) < 0);

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-orange-600">📦 Dispatch Team</h1>
            <p className="text-gray-500 text-sm">Jai Gurudev, {userData?.name}!</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = '/profile'}
              className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
              {userData?.photoURL ? (
                <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-orange-100 flex items-center justify-center text-base">🙏</div>
              )}
            </button>
            <button onClick={() => window.location.href = '/notifications'}
              className="relative">
              <span className="text-2xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { auth.signOut(); window.location.href = '/login'; }}
              className="text-red-400 text-sm font-medium">
              Logout
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-orange-500 rounded-2xl p-3 text-white text-center">
            <p className="text-2xl font-bold">{upcomingShivirs.length}</p>
            <p className="text-orange-100 text-xs mt-1">Upcoming</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-3 text-center">
            <p className="text-2xl font-bold text-red-500">
              {upcomingShivirs.filter((s: any) => getDaysUntil(s.startDate) <= 7).length}
            </p>
            <p className="text-gray-400 text-xs mt-1">Urgent</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-3 text-center">
            <p className="text-2xl font-bold text-gray-400">{pastShivirs.length}</p>
            <p className="text-gray-400 text-xs mt-1">Completed</p>
          </div>
        </div>

        {/* Upcoming Shivirs */}
        <h2 className="font-bold text-gray-700 mb-3">Upcoming Shivirs</h2>
        {upcomingShivirs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center mb-4">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-gray-400">No upcoming Shivirs</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {upcomingShivirs.map((s: any) => {
              const days = getDaysUntil(s.startDate);
              return (
                <button
                  key={s.id}
                  onClick={() => window.location.href = `/dispatch/${s.id}`}
                  className="w-full bg-white rounded-2xl shadow p-4 text-left hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-700 flex-1">{s.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 whitespace-nowrap ${getUrgencyColor(days)}`}>
                      {getUrgencyLabel(days)}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">
                    📍 {s.name} · <span className="font-bold text-orange-500">{formatShivirLocation(s.city, s.state)}</span>
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {formatShivirDates(s.startDate, s.endDate)}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs bg-orange-50 text-orange-600 px-3 py-1 rounded-full">
                      Tap to manage dispatch →
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                      s.status === 'active' ? 'bg-green-100 text-green-600' :
                      s.status === 'planning' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Past Shivirs */}
        {pastShivirs.length > 0 && (
          <>
            <h2 className="font-bold text-gray-500 mb-3">Past Shivirs</h2>
            <div className="space-y-2">
              {pastShivirs.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => window.location.href = `/dispatch/${s.id}`}
                  className="w-full bg-white rounded-2xl shadow p-3 text-left opacity-60">
                  <p className="font-medium text-gray-600 text-sm">{s.name}</p>
                  <p className="text-gray-400 text-xs">{formatShivirDates(s.startDate, s.endDate)}</p>
                </button>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}