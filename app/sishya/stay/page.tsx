'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function StayPage() {
  const [shivirName, setShivirName] = useState('');
  const [stay, setStay] = useState<any>(null);
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

      // Get assigned Shivir
      const sishyaQ = query(collection(db, 'shivirSishya'), where('phone', '==', phone));
      const sishyaSnap = await getDocs(sishyaQ);
      if (!sishyaSnap.empty) {
        const sid = sishyaSnap.docs[0].data().shivirId;

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) setShivirName(shivirSnap.docs[0].data().name);

        // Load stay arrangement set by Organiser
        const stayQ = query(
          collection(db, 'sishyaArrangements'),
          where('phone', '==', phone),
          where('shivirId', '==', sid)
        );
        const staySnap = await getDocs(stayQ);
        if (!staySnap.empty) {
          setStay(staySnap.docs[0].data());
        }
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
          <button onClick={() => window.location.href = '/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🏨 My Stay</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {stay && stay.hotelName ? (
          <div className="space-y-4">

            {/* Hotel Card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xs text-orange-500 font-semibold uppercase mb-3">Accommodation</p>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400">Hotel / Place Name</p>
                  <p className="text-gray-800 font-bold text-lg">{stay.hotelName}</p>
                </div>

                {stay.hotelAddress && (
                  <div>
                    <p className="text-xs text-gray-400">Address</p>
                    <p className="text-gray-700 text-sm">{stay.hotelAddress}</p>
                  </div>
                )}

                {stay.roomDetails && (
                  <div>
                    <p className="text-xs text-gray-400">Room Details</p>
                    <p className="text-gray-700 text-sm">{stay.roomDetails}</p>
                  </div>
                )}

                {stay.checkInTime && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Check-in</p>
                      <p className="text-gray-700 font-medium">{stay.checkInTime}</p>
                    </div>
                    {stay.checkOutTime && (
                      <div>
                        <p className="text-xs text-gray-400">Check-out</p>
                        <p className="text-gray-700 font-medium">{stay.checkOutTime}</p>
                      </div>
                    )}
                  </div>
                )}

                {stay.stayNotes && (
                  <div className="bg-orange-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Notes</p>
                    <p className="text-gray-600 text-sm">{stay.stayNotes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Maps Button */}
            {(stay.mapsUrl || stay.hotelAddress) && (
              <button
                onClick={() => window.open(stay.mapsUrl || `https://maps.google.com?q=${encodeURIComponent(stay.hotelAddress)}`, '_blank')}
                className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base">
                📍 Open in Google Maps
              </button>
            )}

          </div>
        ) : (
          /* Not yet assigned */
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">🏨</div>
            <h3 className="font-bold text-gray-600 text-lg mb-2">Not Assigned Yet</h3>
            <p className="text-gray-400 text-sm">
              Your stay details will appear here once the Aayojak assigns your accommodation.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}