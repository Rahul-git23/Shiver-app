'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

interface SishyaTransport {
  phone: string;
  name: string;
  pickupPoint: string;
  pickupTime: string;
  vehicleDetails: string;
  driverName: string;
  driverPhone: string;
  transportNotes: string;
}

export default function OrganiserTransportPage() {
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [sishyaTransport, setSishyaTransport] = useState<SishyaTransport[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPhone, setSavingPhone] = useState<string | null>(null);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;

      const usersSnap = await getDocs(collection(db, 'users'));
      const userDoc = usersSnap.docs.find(d => d.data().phone === phone);
      if (!userDoc || userDoc.data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }

      const savedShivirId = localStorage.getItem('selectedShivirId');
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const myShivirIds = orgSnap.docs.filter(d => d.data().phone === phone).map(d => d.data().shivirId);
      if (myShivirIds.length === 0) { setLoading(false); return; }

      const sid = (savedShivirId && myShivirIds.includes(savedShivirId)) ? savedShivirId : myShivirIds[0];
      setShivirId(sid);

      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const shivirDoc = shivirSnap.docs.find(d => d.id === sid);
      if (shivirDoc) setShivirName(shivirDoc.data().name);

      const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
      const list = sishyaSnap.docs.filter(d => d.data().shivirId === sid).map(d => d.data());

      const arrSnap = await getDocs(collection(db, 'sishyaArrangements'));
      const arrMap: any = {};
      arrSnap.docs.filter(d => d.data().shivirId === sid).forEach(d => {
        arrMap[d.data().phone] = d.data();
      });

      setSishyaTransport(list.map(s => ({
        phone: s.phone,
        name: s.name,
        pickupPoint: arrMap[s.phone]?.pickupPoint || '',
        pickupTime: arrMap[s.phone]?.pickupTime || '',
        vehicleDetails: arrMap[s.phone]?.vehicleDetails || '',
        driverName: arrMap[s.phone]?.driverName || '',
        driverPhone: arrMap[s.phone]?.driverPhone || '',
        transportNotes: arrMap[s.phone]?.transportNotes || '',
      })));

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateField = (phone: string, field: keyof SishyaTransport, value: string) => {
    setSishyaTransport(prev => prev.map(s => s.phone === phone ? { ...s, [field]: value } : s));
  };

  const saveSishya = async (s: SishyaTransport) => {
    setSavingPhone(s.phone);
    try {
      await setDoc(doc(db, 'sishyaArrangements', `${shivirId}_${s.phone}`), {
        shivirId,
        phone: s.phone,
        name: s.name,
        pickupPoint: s.pickupPoint,
        pickupTime: s.pickupTime,
        vehicleDetails: s.vehicleDetails,
        driverName: s.driverName,
        driverPhone: s.driverPhone,
        transportNotes: s.transportNotes,
      }, { merge: true });
      setSavedPhone(s.phone);
      setTimeout(() => setSavedPhone(null), 2500);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSavingPhone(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/organiser/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🚗 Transport Arrangements</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {sishyaTransport.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">🙏</div>
            <p className="text-gray-400">No Sishya assigned to this Shivir yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sishyaTransport.map(s => {
              const isSaving = savingPhone === s.phone;
              const isSaved = savedPhone === s.phone;
              return (
                <div key={s.phone} className="bg-white rounded-2xl shadow p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">🙏</div>
                    <div>
                      <p className="font-bold text-gray-700">{s.name} Ji</p>
                      <p className="text-gray-400 text-xs">{s.phone}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pickup Point *</label>
                      <input type="text" placeholder="e.g. Airport Terminal 1"
                        value={s.pickupPoint}
                        onChange={e => updateField(s.phone, 'pickupPoint', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Pickup Time</label>
                        <input type="time" value={s.pickupTime}
                          onChange={e => updateField(s.phone, 'pickupTime', e.target.value)}
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Vehicle Details</label>
                        <input type="text" placeholder="e.g. White Innova"
                          value={s.vehicleDetails}
                          onChange={e => updateField(s.phone, 'vehicleDetails', e.target.value)}
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Volunteer Name</label>
                        <input type="text" placeholder="Volunteer name"
                          value={s.driverName}
                          onChange={e => updateField(s.phone, 'driverName', e.target.value)}
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Volunteer Phone</label>
                        <input type="tel" placeholder="+91..."
                          value={s.driverPhone}
                          onChange={e => updateField(s.phone, 'driverPhone', e.target.value)}
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Notes</label>
                      <textarea placeholder="Any special instructions..."
                        value={s.transportNotes}
                        onChange={e => updateField(s.phone, 'transportNotes', e.target.value)}
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
                    </div>
                  </div>

                  <button
                    onClick={() => saveSishya(s)}
                    disabled={isSaving}
                    className={`w-full font-bold py-3 rounded-xl text-sm mt-4 transition-colors ${
                      isSaved ? 'bg-green-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'
                    } disabled:opacity-50`}>
                    {isSaving ? 'Saving...' : isSaved ? '✅ Saved!' : 'Save Transport'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
