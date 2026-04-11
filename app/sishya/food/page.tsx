'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function FoodPage() {
  const [shivirName, setShivirName] = useState('');
  const [food, setFood] = useState<any>(null);
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

      const sishyaQ = query(collection(db, 'shivirSishya'), where('phone', '==', phone));
      const sishyaSnap = await getDocs(sishyaQ);
      if (!sishyaSnap.empty) {
        const sid = sishyaSnap.docs[0].data().shivirId;

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) setShivirName(shivirSnap.docs[0].data().name);

        const foodQ = query(
          collection(db, 'sishyaArrangements'),
          where('phone', '==', phone),
          where('shivirId', '==', sid)
        );
        const foodSnap = await getDocs(foodQ);
        if (!foodSnap.empty) setFood(foodSnap.docs[0].data());
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

  const meals = [
    { key: 'breakfast', label: '🌅 Breakfast', time: food?.breakfastTime, location: food?.breakfastLocation },
    { key: 'lunch', label: '☀️ Lunch', time: food?.lunchTime, location: food?.lunchLocation },
    { key: 'dinner', label: '🌙 Dinner', time: food?.dinnerTime, location: food?.dinnerLocation },
  ];

  const hasFoodData = food && (food.breakfastTime || food.lunchTime || food.dinnerTime);

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🍽️ Food Schedule</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {hasFoodData ? (
          <div className="space-y-3">

            {meals.map(meal => (
              <div key={meal.key} className="bg-white rounded-2xl shadow p-5">
                <p className="font-bold text-gray-700 text-base mb-3">{meal.label}</p>

                {meal.time || meal.location ? (
                  <div className="space-y-2">
                    {meal.time && (
                      <div className="flex items-center gap-3">
                        <span className="text-orange-400">🕐</span>
                        <div>
                          <p className="text-xs text-gray-400">Time</p>
                          <p className="text-gray-700 font-medium">{meal.time}</p>
                        </div>
                      </div>
                    )}
                    {meal.location && (
                      <div className="flex items-center gap-3">
                        <span className="text-orange-400">📍</span>
                        <div>
                          <p className="text-xs text-gray-400">Location</p>
                          <p className="text-gray-700 font-medium">{meal.location}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Not scheduled yet</p>
                )}
              </div>
            ))}

            {/* General Food Notes */}
            {food?.foodNotes && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-xs text-orange-500 font-semibold mb-1">📝 Notes from Aayojak</p>
                <p className="text-gray-600 text-sm">{food.foodNotes}</p>
              </div>
            )}

          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">🍽️</div>
            <h3 className="font-bold text-gray-600 text-lg mb-2">Not Scheduled Yet</h3>
            <p className="text-gray-400 text-sm">
              Your stay details will appear here once the Aayojak assigns your accommodation.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}