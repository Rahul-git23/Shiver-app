'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function StayPage() {
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [aayojakStay, setAayojakStay] = useState<any>(null);
  const [remark, setRemark] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkSaved, setRemarkSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const phone = currentUser.phoneNumber!;
      setUserPhone(phone);

      // Check role
      const usersSnap = await getDocs(collection(db, 'users'));
      const userDoc = usersSnap.docs.find(d => d.data().phone === phone);
      if (!userDoc || userDoc.data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }

      // Get assigned Shivir
      const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
      const sishyaDoc = sishyaSnap.docs.find(d => d.data().phone === phone);
      if (!sishyaDoc) { setLoading(false); return; }

      const sid = sishyaDoc.data().shivirId;
      setShivirId(sid);

      // Get Shivir name
      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const shivirDoc = shivirSnap.docs.find(d => d.id === sid);
      if (shivirDoc) setShivirName(shivirDoc.data().name);

      // Find Aayojak-assigned hotel group that includes this Sishya's phone
      const stayGroupsSnap = await getDocs(collection(db, 'sishyaStayGroups'));
      const myGroup = stayGroupsSnap.docs.find(d => {
        const data = d.data();
        return data.shivirId === sid && Array.isArray(data.sishyaPhones) && data.sishyaPhones.includes(phone);
      });

      if (myGroup) {
        const data = myGroup.data();
        // Load existing remark if any
        const remarkSnap = await getDocs(collection(db, 'sishyaStayRemarks'));
        const myRemark = remarkSnap.docs.find(d =>
          d.data().phone === phone && d.data().shivirId === sid
        );
        if (myRemark) setRemark(myRemark.data().remark || '');

        setAayojakStay({ id: myGroup.id, ...data });
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveRemark = async () => {
    if (!remark.trim()) return;
    setRemarkSaving(true);
    try {
      const docId = `${userPhone}_${shivirId}`;
      await setDoc(doc(db, 'sishyaStayRemarks', docId), {
        phone: userPhone,
        shivirId,
        stayGroupId: aayojakStay?.id || '',
        remark: remark.trim(),
        updatedAt: serverTimestamp(),
      });

      // Notify Aayojak — get all organisers for this Shivir
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const orgPhones = orgSnap.docs
        .filter(d => d.data().shivirId === shivirId)
        .map(d => d.data().phone);

      if (orgPhones.length > 0) {
        const { createNotificationForMany } = await import('@/lib/notifications');
        await createNotificationForMany({
          phones: orgPhones,
          title: '🏨 Stay Remark from Sishya',
          body: `A Sishya has added a remark about their stay arrangement.`,
          type: 'stay_remark',
          shivirId,
        });
      }

      setRemarkSaved(true);
      setTimeout(() => setRemarkSaved(false), 2500);
    } catch (e) {
      alert('Could not save remark. Please try again.');
    }
    setRemarkSaving(false);
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

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

        {/* Aayojak-assigned stay card */}
        {aayojakStay ? (
          <div className="bg-white rounded-2xl shadow p-5 mb-4 border-l-4 border-green-400">

            {/* Badge */}
            <div className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              ✓ Aayojak has booked your stay
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400">Hotel / Place Name</p>
                <p className="text-gray-800 font-bold text-lg">{aayojakStay.hotelName}</p>
              </div>

              {aayojakStay.address && (
                <div>
                  <p className="text-xs text-gray-400">Address</p>
                  <p className="text-gray-700 text-sm">{aayojakStay.address}</p>
                </div>
              )}

              {(aayojakStay.checkIn || aayojakStay.checkOut) && (
                <div className="grid grid-cols-2 gap-4">
                  {aayojakStay.checkIn && (
                    <div>
                      <p className="text-xs text-gray-400">Check-in</p>
                      <p className="text-gray-700 font-medium">{formatTime(aayojakStay.checkIn)}</p>
                    </div>
                  )}
                  {aayojakStay.checkOut && (
                    <div>
                      <p className="text-xs text-gray-400">Check-out</p>
                      <p className="text-gray-700 font-medium">{formatTime(aayojakStay.checkOut)}</p>
                    </div>
                  )}
                </div>
              )}

              {aayojakStay.rooms > 0 && (
                <div>
                  <p className="text-xs text-gray-400">Rooms booked</p>
                  <p className="text-gray-700 font-medium">{aayojakStay.rooms} Room{aayojakStay.rooms > 1 ? 's' : ''}</p>
                </div>
              )}

              {aayojakStay.notes && (
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Notes from Aayojak</p>
                  <p className="text-gray-600 text-sm">{aayojakStay.notes}</p>
                </div>
              )}
            </div>

            {/* Maps button */}
            {(aayojakStay.mapsUrl || aayojakStay.address) && (
              <button
                onClick={() => window.open(
                  aayojakStay.mapsUrl || `https://maps.google.com?q=${encodeURIComponent(aayojakStay.address)}`,
                  '_blank'
                )}
                className="w-full bg-orange-500 text-white font-bold py-3 rounded-2xl text-sm mt-4">
                📍 Open in Google Maps
              </button>
            )}

            {/* Remark section */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs text-orange-500 font-semibold uppercase mb-2">Add a Remark</p>
              <p className="text-xs text-gray-400 mb-2">
                Have a concern or request about this arrangement? Aayojak will be notified.
              </p>
              <textarea
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="e.g. Need a ground floor room, have knee issues..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none mb-2" />
              <button
                onClick={saveRemark}
                disabled={remarkSaving || !remark.trim()}
                className={`w-full font-semibold py-3 rounded-xl text-sm transition-colors ${
                  remarkSaved
                    ? 'bg-green-500 text-white'
                    : 'bg-orange-100 text-orange-600 hover:bg-orange-200 disabled:opacity-40'
                }`}>
                {remarkSaving ? 'Sending...' : remarkSaved ? '✅ Remark Sent!' : 'Send Remark to Aayojak'}
              </button>
            </div>

          </div>
        ) : (
          /* Not yet assigned by Aayojak */
          <div className="bg-white rounded-2xl shadow p-6 mb-4 text-center">
            <div className="text-5xl mb-3">🏨</div>
            <h3 className="font-bold text-gray-600 text-base mb-1">Not Assigned Yet</h3>
            <p className="text-gray-400 text-sm">
              Your stay details will appear here once the Aayojak assigns your accommodation.
            </p>
          </div>
        )}

        {/* Book My Own Stay — always visible */}
        <button
          onClick={() => window.location.href = '/sishya/stay/self-book'}
          className="w-full border-2 border-dashed border-orange-300 rounded-2xl p-4 text-orange-500 font-semibold text-sm hover:bg-orange-50 flex items-center justify-center gap-2">
          <span className="text-lg">🏠</span>
          Book My Own Stay
        </button>
        <p className="text-center text-xs text-gray-400 mt-2 mb-6">
          Booked your own hotel? Add details here and notify Aayojak.
        </p>

      </div>
    </div>
  );
}