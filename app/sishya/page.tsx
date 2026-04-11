'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatShivirDates, formatShivirLocation } from '@/lib/utils';
import { getShivirSamagri } from '@/lib/samagri';

export default function SishyaPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [samagriItems, setSamagriItems] = useState<any[]>([]);
  const [carryItems, setCarryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const q = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const snapshot = await getDocs(q);
      if (snapshot.empty || snapshot.docs[0].data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }
      const user = snapshot.docs[0].data();
      setUserData(user);

      // Get assigned Shivir
      const sishyaQ = query(collection(db, 'shivirSishya'), where('phone', '==', currentUser.phoneNumber));
      const sishyaSnap = await getDocs(sishyaQ);
      if (!sishyaSnap.empty) {
        const shivirId = sishyaSnap.docs[0].data().shivirId;
        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
        if (!shivirSnap.empty) {
          const shivirData = { id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() };
          setShivir(shivirData);

          const items = await getShivirSamagri(shivirId) as any[];
          const inStockItems = items.filter(i => i.quantityToSend > 0);
          setSamagriItems(inStockItems);

          const toCarry = items.filter(i =>
            i.assignedToSishyaId === currentUser.phoneNumber ||
            i.status === 'attention_required'
          );
          setCarryItems(toCarry);
        }
      }

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

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-orange-600">🕉️ Shivir App</h1>
            <p className="text-gray-500 text-sm">Sishya Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = '/notifications'}
              className="relative">
              <span className="text-2xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => { auth.signOut(); window.location.href = '/login'; }}
              className="text-red-400 text-sm font-medium">Logout</button>
          </div>
        </div>

        {/* Welcome Card */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-2xl">🙏</div>
            <div>
              <h2 className="text-xl font-bold text-gray-700">Jai Gurudev, {userData?.name} Ji!</h2>
              <p className="text-gray-500 text-sm">Welcome to your Shivir details</p>
            </div>
          </div>
        </div>

        {/* Assigned Shivir Card */}
        {shivir && (
          <div className="bg-orange-500 rounded-2xl shadow p-4 mb-4 text-white">
            <p className="text-orange-100 text-xs mb-1">Your Assigned Shivir</p>
            <h2 className="font-bold text-lg">{shivir.name}</h2>
            <p className="text-orange-100 text-sm mt-1">
              {shivir.city} · <span className="font-bold text-white">{formatShivirLocation(shivir.city, shivir.state)}</span>
            </p>
            <p className="text-orange-100 text-xs mt-1">
              {formatShivirDates(shivir.startDate, shivir.endDate)}
            </p>
          </div>
        )}

        {/* Carry Alert */}
        {carryItems.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚠️</span>
              <h3 className="font-bold text-red-600">Please Carry These Items</h3>
            </div>
            <p className="text-red-500 text-xs mb-3">
              These items are out of stock at Gurudham. Please bring them with you.
            </p>
            <div className="space-y-2">
              {carryItems.map((item: any) => (
                <div key={item.id} className="bg-white rounded-xl p-3">
                  <p className="font-medium text-gray-700">{item.itemName}</p>
                  <p className="text-gray-500 text-sm">{item.category}</p>
                  <p className="text-orange-600 text-sm font-medium">Qty: {item.quantityToSend}</p>
                  {item.assignedToSishyaNote && (
                    <p className="text-gray-400 text-xs mt-1">📝 {item.assignedToSishyaNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sishya Info Cards */}
        <div className="space-y-3">

          <button onClick={() => window.location.href = '/sishya/travel'}
            className="w-full bg-white rounded-2xl shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">✈️</span>
              <div className="text-left">
                <h3 className="font-bold text-gray-700">My Travel Details</h3>
                <p className="text-gray-400 text-sm">Update your travel itinerary</p>
              </div>
            </div>
            <span className="text-orange-500 text-lg">→</span>
          </button>

          <button onClick={() => window.location.href = '/sishya/stay'}
            className="w-full bg-white rounded-2xl shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🏨</span>
              <div className="text-left">
                <h3 className="font-bold text-gray-700">My Stay</h3>
                <p className="text-gray-400 text-sm">View your accommodation details</p>
              </div>
            </div>
            <span className="text-orange-500 text-lg">→</span>
          </button>

          <button onClick={() => window.location.href = '/sishya/food'}
            className="w-full bg-white rounded-2xl shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🍽️</span>
              <div className="text-left">
                <h3 className="font-bold text-gray-700">Food Schedule</h3>
                <p className="text-gray-400 text-sm">View meal timings and location</p>
              </div>
            </div>
            <span className="text-orange-500 text-lg">→</span>
          </button>

          <button onClick={() => window.location.href = '/sishya/transport'}
            className="w-full bg-white rounded-2xl shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🚗</span>
              <div className="text-left">
                <h3 className="font-bold text-gray-700">Transport</h3>
                <p className="text-gray-400 text-sm">View your transport arrangement</p>
              </div>
            </div>
            <span className="text-orange-500 text-lg">→</span>
          </button>

          <button onClick={() => window.location.href = '/sishya/contacts'}
            className="w-full bg-white rounded-2xl shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">📞</span>
              <div className="text-left">
                <h3 className="font-bold text-gray-700">My Contacts</h3>
                <p className="text-gray-400 text-sm">Assigned volunteer contact</p>
              </div>
            </div>
            <span className="text-orange-500 text-lg">→</span>
          </button>

          {/* Samagri Card */}
          {samagriItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-4">
              <button
                onClick={() => window.location.href = '/sishya/samagri'}
                className="w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">📦</span>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-700">Shivir Samagri</h3>
                    <p className="text-gray-400 text-sm">
                      {[...new Set(samagriItems.map(i => i.bundleNumber))].length} Bundles → tap to view
                    </p>
                  </div>
                </div>
                <span className="text-orange-500 text-lg">→</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}