'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createNotificationForMany } from '@/lib/notifications';

const TRAVEL_MODES = [
  { value: 'train', label: '🚂 Train' },
  { value: 'flight', label: '✈️ Flight' },
  { value: 'bus', label: '🚌 Bus' },
  { value: 'car', label: '🚗 Car' },
];

export default function TravelPage() {
  const [userPhone, setUserPhone] = useState('');
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [travelMode, setTravelMode] = useState('train');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [departureCity, setDepartureCity] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const q = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const snap = await getDocs(q);
      if (snap.empty || snap.docs[0].data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }

      const phone = currentUser.phoneNumber!;
      setUserPhone(phone);

      // Get assigned Shivir
      const sishyaQ = query(collection(db, 'shivirSishya'), where('phone', '==', phone));
      const sishyaSnap = await getDocs(sishyaQ);
      if (!sishyaSnap.empty) {
        const sid = sishyaSnap.docs[0].data().shivirId;
        setShivirId(sid);

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) setShivirName(shivirSnap.docs[0].data().name);

        // Load existing travel data if any
        const travelQ = query(
          collection(db, 'sishyaTravel'),
          where('phone', '==', phone),
          where('shivirId', '==', sid)
        );
        const travelSnap = await getDocs(travelQ);
        if (!travelSnap.empty) {
          const d = travelSnap.docs[0].data();
          setTravelMode(d.travelMode || 'train');
          setVehicleNumber(d.vehicleNumber || '');
          setDepartureCity(d.departureCity || '');
          setDepartureDate(d.departureDate || '');
          setDepartureTime(d.departureTime || '');
          setArrivalDate(d.arrivalDate || '');
          setArrivalTime(d.arrivalTime || '');
          setNotes(d.notes || '');
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!departureCity || !arrivalDate || !arrivalTime) {
      alert('Please fill in Departure City, Arrival Date and Arrival Time at minimum.');
      return;
    }
    setSaving(true);
    try {
      const docId = `${userPhone}_${shivirId}`;
      await setDoc(doc(db, 'sishyaTravel', docId), {
        phone: userPhone,
        shivirId,
        travelMode,
        vehicleNumber,
        departureCity,
        departureDate,
        departureTime,
        arrivalDate,
        arrivalTime,
        notes,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);

      // Notify all organisers of this Shivir
      try {
        const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
        const orgPhones = orgSnap.docs
          .filter(d => d.data().shivirId === shivirId)
          .map(d => d.data().phone);
        if (orgPhones.length > 0) {
          await createNotificationForMany({
            phones: orgPhones,
            title: '✈️ Sishya Travel Updated',
            body: `A Sishya updated their travel details for your Shivir.`,
            type: 'sishya_travel',
            shivirId,
          });
        }
      } catch (e) {}

      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Could not save. Please try again.');
    }
    setSaving(false);
  };

  const vehicleLabel = travelMode === 'train' ? 'Train Number'
    : travelMode === 'flight' ? 'Flight Number'
    : travelMode === 'bus' ? 'Bus Number (if known)'
    : 'Vehicle / Car Details';

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
            <h1 className="text-lg font-bold text-orange-600">✈️ My Travel Details</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow p-5 space-y-5">

          {/* Travel Mode */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Travel Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {TRAVEL_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setTravelMode(mode.value)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    travelMode === mode.value
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-gray-200 text-gray-500'
                  }`}>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">{vehicleLabel}</label>
            <input
              type="text"
              value={vehicleNumber}
              onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder={travelMode === 'train' ? 'e.g. 12345 Rajdhani Express' : travelMode === 'flight' ? 'e.g. 6E 204' : ''}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* Departure City */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Departure City *</label>
            <input
              type="text"
              value={departureCity}
              onChange={e => setDepartureCity(e.target.value)}
              placeholder="e.g. Delhi"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* Departure Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Departure Date</label>
              <input
                type="date"
                value={departureDate}
                onChange={e => setDepartureDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Departure Time</label>
              <input
                type="time"
                value={departureTime}
                onChange={e => setDepartureTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>

          {/* Arrival Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Arrival Date *</label>
              <input
                type="date"
                value={arrivalDate}
                onChange={e => setArrivalDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Arrival Time *</label>
              <input
                type="time"
                value={arrivalTime}
                onChange={e => setArrivalTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special instructions or requests..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl text-base disabled:opacity-50">
            {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Travel Details'}
          </button>

        </div>

        <p className="text-center text-gray-400 text-xs mt-4">
          You can update these details anytime before the Shivir.
        </p>
      </div>
    </div>
  );
}