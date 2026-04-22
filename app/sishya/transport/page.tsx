'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function TransportPage() {
  const [shivirName, setShivirName] = useState('');
  const [transport, setTransport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const q = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const snap = await getDocs(q);
      if (snap.empty || snap.docs[0].data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }

      const phone = currentUser.phoneNumber!;

      const savedShivirId = localStorage.getItem('sishyaSelectedShivirId');
      const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
      const myShivirIds = sishyaSnap.docs
        .filter(d => d.data().phone === phone)
        .map(d => d.data().shivirId);

      if (myShivirIds.length > 0) {
        const sid = (savedShivirId && myShivirIds.includes(savedShivirId))
          ? savedShivirId : myShivirIds[0];

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) setShivirName(shivirSnap.docs[0].data().name);

        const tQ = query(
          collection(db, 'sishyaArrangements'),
          where('phone', '==', phone),
          where('shivirId', '==', sid)
        );
        const tSnap = await getDocs(tQ);
        if (!tSnap.empty) setTransport(tSnap.docs[0].data());
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

  const hasTransportData = transport && transport.pickupPoint;

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🚗 Transport</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {hasTransportData ? (
          <div className="space-y-4">

            {/* Pickup Details */}
            <div className="bg-white rounded-2xl shadow p-5 space-y-4">
              <p className="text-xs text-orange-500 font-semibold uppercase">Pickup Details</p>

              <div className="flex items-start gap-3">
                <span className="text-orange-400 text-xl">📍</span>
                <div>
                  <p className="text-xs text-gray-400">Pickup Point</p>
                  <p className="text-gray-800 font-bold text-base">{transport.pickupPoint}</p>
                </div>
              </div>

              {transport.pickupTime && (
                <div className="flex items-start gap-3">
                  <span className="text-orange-400 text-xl">🕐</span>
                  <div>
                    <p className="text-xs text-gray-400">Pickup Time</p>
                    <p className="text-gray-700 font-medium">{transport.pickupTime}</p>
                  </div>
                </div>
              )}

              {transport.vehicleDetails && (
                <div className="flex items-start gap-3">
                  <span className="text-orange-400 text-xl">🚗</span>
                  <div>
                    <p className="text-xs text-gray-400">Vehicle</p>
                    <p className="text-gray-700 font-medium">{transport.vehicleDetails}</p>
                  </div>
                </div>
              )}

              {transport.driverName && (
                <div className="flex items-start gap-3">
                  <span className="text-orange-400 text-xl">👤</span>
                  <div>
                    <p className="text-xs text-gray-400">Volunteer Name</p>
                    <p className="text-gray-700 font-medium">{transport.driverName}</p>
                  </div>
                </div>
              )}

              {transport.driverPhone && (
                <div className="flex items-start gap-3">
                  <span className="text-orange-400 text-xl">📞</span>
                  <div>
                    <p className="text-xs text-gray-400">Volunteer Phone</p>
                    <p className="text-gray-700 font-medium">{transport.driverPhone}</p>
                  </div>
                </div>
              )}

            </div>

            {/* Call Volunteer Button */}
            {transport.driverPhone && (
              <a href={`tel:${transport.driverPhone}`}
                className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2">
                <span>📞</span> Call Volunteer
              </a>
            )}

            {/* Transport Notes */}
            {transport.transportNotes && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-xs text-orange-500 font-semibold mb-1">📝 Notes from Aayojak</p>
                <p className="text-gray-600 text-sm">{transport.transportNotes}</p>
              </div>
            )}

          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">🚗</div>
            <h3 className="font-bold text-gray-600 text-lg mb-2">Not Arranged Yet</h3>
            <p className="text-gray-400 text-sm">
              Your transport details will appear here once the Aayojak arranges it.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}