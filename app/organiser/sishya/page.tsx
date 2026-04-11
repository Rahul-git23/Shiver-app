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
      console.log('Logged in phone:', phone);

      // Check role
      const userQ = query(collection(db, 'users'), where('phone', '==', phone));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }

      // Get organiser's Shivir — search by phone field
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const orgDoc = orgSnap.docs.find(d => d.data().phone === phone);

      if (!orgDoc) {
        console.log('No shivirOrganiser doc found for phone:', phone);
        setLoading(false);
        return;
      }

      const sid = orgDoc.data().shivirId;
      console.log('Found shivirId:', sid);
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

      console.log('Sishya found:', list.length);
      setSishyaList(list);

      // Get existing arrangements (collection may not exist yet)
      try {
        const arrSnap = await getDocs(collection(db, 'sishyaArrangements'));
        const arrMap: any = {};
        arrSnap.docs
          .filter(d => d.data().shivirId === sid)
          .forEach(d => { arrMap[d.data().phone] = d.data(); });
        setArrangements(arrMap);
      } catch (e) {
        console.log('No arrangements yet:', e);
      }

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

        {/* Info Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4">
          <p className="text-orange-600 text-sm">
            Tap any Sishya to assign their Stay, Food, Transport and Contact details.
          </p>
        </div>

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
                <button
                  key={sishya.phone}
                  onClick={() => window.location.href = `/organiser/sishya/${encodeURIComponent(sishya.phone)}`}
                  className="w-full bg-white rounded-2xl shadow p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                      🙏
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-700">{sishya.name} Ji</p>
                      <p className="text-gray-400 text-xs">{sishya.phone}</p>
                      <div className="flex gap-1 mt-1">
                        {['Stay', 'Food', 'Transport', 'Contact'].map((item, i) => {
                          const done = i === 0 ? arr?.hotelName
                            : i === 1 ? (arr?.breakfastTime || arr?.lunchTime || arr?.dinnerTime)
                            : i === 2 ? arr?.pickupPoint
                            : arr?.volunteer1Name;
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
                  <span className="text-orange-500 text-lg">→</span>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}