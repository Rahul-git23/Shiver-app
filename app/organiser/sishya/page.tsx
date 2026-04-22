'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function OrganiserSishyaPage() {
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [sishyaList, setSishyaList] = useState<any[]>([]);
  const [arrangements, setArrangements] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const phone = currentUser.phoneNumber!;

      // Check role
      const userQ = query(collection(db, 'users'), where('phone', '==', phone));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }

      // Get organiser's Shivir
      const savedShivirId = localStorage.getItem('selectedShivirId');
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const myShivirIds = orgSnap.docs
        .filter(d => d.data().phone === phone)
        .map(d => d.data().shivirId);

      if (myShivirIds.length === 0) { setLoading(false); return; }

      const sid = (savedShivirId && myShivirIds.includes(savedShivirId))
        ? savedShivirId : myShivirIds[0];

      setShivirId(sid);

      // Get Shivir name
      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const shivirDoc = shivirSnap.docs.find(d => d.id === sid);
      if (shivirDoc) setShivirName(shivirDoc.data().name);

      // Get all Sishya for this Shivir
      const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
      const list = sishyaSnap.docs
        .filter(d => d.data().shivirId === sid)
        .map(d => ({ ...d.data() }));
      setSishyaList(list);

      // Get existing arrangements
      try {
        const arrSnap = await getDocs(collection(db, 'sishyaArrangements'));
        const arrMap: any = {};
        arrSnap.docs
          .filter(d => d.data().shivirId === sid)
          .forEach(d => { arrMap[d.data().phone] = d.data(); });
        setArrangements(arrMap);
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
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/organiser'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🙏 Sishya Management</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {/* 4 Management Tabs */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => window.location.href = '/organiser/stay'}
            className="bg-white rounded-2xl shadow p-3 flex flex-col items-center gap-1 hover:bg-orange-50 transition-colors">
            <span className="text-xl">🏨</span>
            <span className="text-xs font-semibold text-gray-600">Stay</span>
          </button>
          <button
            onClick={() => window.location.href = '/organiser/food'}
            className="bg-white rounded-2xl shadow p-3 flex flex-col items-center gap-1 hover:bg-orange-50 transition-colors">
            <span className="text-xl">🍽️</span>
            <span className="text-xs font-semibold text-gray-600">Food</span>
          </button>
          <button
            onClick={() => window.location.href = '/organiser/transport'}
            className="bg-white rounded-2xl shadow p-3 flex flex-col items-center gap-1 hover:bg-orange-50 transition-colors">
            <span className="text-xl">🚗</span>
            <span className="text-xs font-semibold text-gray-600">Transport</span>
          </button>
          <button
            onClick={() => window.location.href = '/organiser/volunteer'}
            className="bg-white rounded-2xl shadow p-3 flex flex-col items-center gap-1 hover:bg-orange-50 transition-colors">
            <span className="text-xl">🤝</span>
            <span className="text-xs font-semibold text-gray-600">Volunteer</span>
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4">
          <p className="text-orange-600 text-sm">
            Use the tabs above to manage Stay, Food, Transport and Volunteer details for all Sishya.
          </p>
        </div>

        {/* Sishya List — read only, shows completion status */}
        {sishyaList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">🙏</div>
            <h3 className="font-bold text-gray-600 text-lg mb-2">No Sishya Assigned</h3>
            <p className="text-gray-400 text-sm">
              No Sishya have been assigned to this Shivir yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sishyaList.map((sishya) => {
              const arr = arrangements[sishya.phone];
              return (
                <div
                  key={sishya.phone}
                  className="w-full bg-white rounded-2xl shadow p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                    🙏
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-gray-700">{sishya.name} Ji</p>
                    <p className="text-gray-400 text-xs">{sishya.phone}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {['Stay', 'Food', 'Transport', 'Contact'].map((item, i) => {
                        const done = i === 0 ? arr?.hotelName
                          : i === 1 ? (arr?.breakfastTime || arr?.lunchTime || arr?.dinnerTime)
                          : i === 2 ? arr?.pickupPoint
                          : arr?.volunteers?.[0]?.name;
                        return (
                          <span key={item}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                            }`}>
                            {done ? '✓' : '·'} {item}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}