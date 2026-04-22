'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

const MEALS = [
  { key: 'breakfast', label: '🌅 Breakfast', timeKey: 'breakfastTime', locKey: 'breakfastLocation' },
  { key: 'lunch', label: '☀️ Lunch', timeKey: 'lunchTime', locKey: 'lunchLocation' },
  { key: 'dinner', label: '🌙 Dinner', timeKey: 'dinnerTime', locKey: 'dinnerLocation' },
];

export default function OrganiserFoodPage() {
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [sishyaList, setSishyaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');

  const [breakfastTime, setBreakfastTime] = useState('');
  const [breakfastLocation, setBreakfastLocation] = useState('');
  const [lunchTime, setLunchTime] = useState('');
  const [lunchLocation, setLunchLocation] = useState('');
  const [dinnerTime, setDinnerTime] = useState('');
  const [dinnerLocation, setDinnerLocation] = useState('');
  const [foodNotes, setFoodNotes] = useState('');

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
      setSishyaList(list);

      // Load existing food data from first sishya's arrangement (common schedule)
      if (list.length > 0) {
        const arrSnap = await getDocs(collection(db, 'sishyaArrangements'));
        const existing = arrSnap.docs.find(d => d.data().shivirId === sid && d.data().phone === list[0].phone);
        if (existing) {
          const data = existing.data();
          setBreakfastTime(data.breakfastTime || '');
          setBreakfastLocation(data.breakfastLocation || '');
          setLunchTime(data.lunchTime || '');
          setLunchLocation(data.lunchLocation || '');
          setDinnerTime(data.dinnerTime || '');
          setDinnerLocation(data.dinnerLocation || '');
          setFoodNotes(data.foodNotes || '');
        }
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveAll = async () => {
    if (sishyaList.length === 0) { setMessage('No Sishya assigned to this Shivir.'); return; }
    setSaving(true);
    setMessage('');
    try {
      const foodData = {
        shivirId,
        breakfastTime, breakfastLocation,
        lunchTime, lunchLocation,
        dinnerTime, dinnerLocation,
        foodNotes,
      };
      await Promise.all(sishyaList.map(s =>
        setDoc(doc(db, 'sishyaArrangements', `${shivirId}_${s.phone}`), {
          ...foodData,
          phone: s.phone,
          name: s.name,
        }, { merge: true })
      ));
      setSaved(true);
      setMessage(`✅ Food schedule saved for all ${sishyaList.length} Sishya!`);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setSaving(false);
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
            <h1 className="text-lg font-bold text-orange-600">🍽️ Food Schedule</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4">
          <p className="text-orange-600 text-sm">
            This schedule will be saved for all {sishyaList.length} Sishya. They can view it in their dashboard.
          </p>
        </div>

        {sishyaList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">🙏</div>
            <p className="text-gray-400">No Sishya assigned to this Shivir yet.</p>
          </div>
        ) : (
          <div className="space-y-4">

            {MEALS.map(meal => (
              <div key={meal.key} className="bg-white rounded-2xl shadow p-5">
                <p className="font-bold text-gray-700 mb-3">{meal.label}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Time</label>
                    <input
                      type="time"
                      value={meal.key === 'breakfast' ? breakfastTime : meal.key === 'lunch' ? lunchTime : dinnerTime}
                      onChange={e => {
                        if (meal.key === 'breakfast') setBreakfastTime(e.target.value);
                        else if (meal.key === 'lunch') setLunchTime(e.target.value);
                        else setDinnerTime(e.target.value);
                      }}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Location / Venue</label>
                    <input
                      type="text"
                      placeholder="e.g. Dining Hall, Block A"
                      value={meal.key === 'breakfast' ? breakfastLocation : meal.key === 'lunch' ? lunchLocation : dinnerLocation}
                      onChange={e => {
                        if (meal.key === 'breakfast') setBreakfastLocation(e.target.value);
                        else if (meal.key === 'lunch') setLunchLocation(e.target.value);
                        else setDinnerLocation(e.target.value);
                      }}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-2xl shadow p-5">
              <label className="block text-sm font-semibold text-gray-600 mb-2">📝 Notes for Sishya</label>
              <textarea
                placeholder="Any food-related instructions..."
                value={foodNotes}
                onChange={e => setFoodNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none"
              />
            </div>

            {message && (
              <p className={`text-sm text-center ${message.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                {message}
              </p>
            )}

            <button
              onClick={saveAll}
              disabled={saving}
              className={`w-full font-bold py-4 rounded-2xl text-base transition-colors ${
                saved ? 'bg-green-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'
              } disabled:opacity-50`}>
              {saving ? 'Saving...' : saved ? '✅ Saved!' : `🙏 Save for All ${sishyaList.length} Sishya`}
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
