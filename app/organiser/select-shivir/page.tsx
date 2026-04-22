'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { formatShivirDates, formatShivirLocation } from '@/lib/utils';

export default function SelectShivirPage() {
  const [shivirs, setShivirs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;

      // Check role
      const usersSnap = await getDocs(collection(db, 'users'));
      const userDoc = usersSnap.docs.find(d => d.data().phone === phone);
      if (!userDoc || userDoc.data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      setUserName(userDoc.data().name || '');

      // Get ALL Shivirs this Aayojak is assigned to
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const myShivirIds = orgSnap.docs
        .filter(d => d.data().phone === phone)
        .map(d => d.data().shivirId);

      if (myShivirIds.length === 0) {
        setLoading(false);
        return;
      }

      // If only one Shivir — auto select and go to dashboard
      if (myShivirIds.length === 1) {
        localStorage.setItem('selectedShivirId', myShivirIds[0]);
        sessionStorage.setItem('shivirSelected', 'true');
        window.location.href = '/organiser';
        return;
      }

      // Multiple Shivirs — load details for selection
      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const myShivirs = shivirSnap.docs
        .filter(d => myShivirIds.includes(d.id))
        .map(d => ({ id: d.id, ...d.data() }));

      setShivirs(myShivirs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const selectShivir = (shivirId: string) => {
    setSelecting(shivirId);
    localStorage.setItem('selectedShivirId', shivirId);
    sessionStorage.setItem('shivirSelected', 'true');
    window.location.href = '/organiser';
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
        <div className="bg-white rounded-2xl shadow p-5 mb-6 text-center">
          <div className="text-4xl mb-3">🙏</div>
          <h1 className="text-xl font-bold text-orange-600">Jai Gurudev</h1>
          {userName && (
            <p className="text-gray-700 font-semibold text-base mt-1">{userName} Ji</p>
          )}
          <p className="text-gray-500 text-sm mt-1">Select the Shivir you want to manage</p>
        </div>

        {shivirs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500">No Shivirs assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shivirs.map(shivir => (
              <button
                key={shivir.id}
                onClick={() => selectShivir(shivir.id)}
                disabled={selecting === shivir.id}
                className="w-full bg-white rounded-2xl shadow p-5 text-left hover:bg-orange-50 transition-colors border-2 border-transparent hover:border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="font-bold text-gray-800 text-base">{shivir.name}</h2>
                    <p className="text-gray-500 text-sm mt-1">
                      📍 {formatShivirLocation(shivir.city, shivir.state)}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      📅 {formatShivirDates(shivir.startDate, shivir.endDate)}
                    </p>
                    <div className="mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        shivir.status === 'active' ? 'bg-green-100 text-green-600' :
                        shivir.status === 'completed' ? 'bg-gray-100 text-gray-500' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        {shivir.status || 'planning'}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {selecting === shivir.id ? (
                      <div className="text-orange-500 text-sm">Loading...</div>
                    ) : (
                      <span className="text-orange-500 text-2xl">→</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}