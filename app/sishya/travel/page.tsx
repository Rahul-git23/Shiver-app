'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { createNotificationForMany } from '@/lib/notifications';

const TRAVEL_MODES = [
  { value: 'train', label: '🚂 Train' },
  { value: 'flight', label: '✈️ Flight' },
  { value: 'bus', label: '🚌 Bus' },
  { value: 'car', label: '🚗 Car' },
];

const AIRLINES = [
  { code: 'AI', name: 'Air India', color: '#E23A21' },
  { code: '6E', name: 'IndiGo', color: '#003876' },
  { code: 'SG', name: 'SpiceJet', color: '#FF6B00' },
  { code: 'QP', name: 'Akasa Air', color: '#6B21A8' },
  { code: 'IX', name: 'Air India Express', color: '#D97706' },  
  { code: 'OT', name: 'Other', color: '#9CA3AF' },
];

export default function TravelPage() {
  const [userPhone, setUserPhone] = useState('');
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [shivirData, setShivirData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Onward journey
  const [travelMode, setTravelMode] = useState('train');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [arrivalCity, setArrivalCity] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [notes, setNotes] = useState('');

  // Flight-specific onward
  const [airline, setAirline] = useState('');
  const [departureCity, setDepartureCity] = useState('');
  const [departureTime, setDepartureTime] = useState('');

  // Return journey
  const [showReturn, setShowReturn] = useState(false);
  const [returnTravelMode, setReturnTravelMode] = useState('train');
  const [returnVehicleNumber, setReturnVehicleNumber] = useState('');
  const [returnArrivalCity, setReturnArrivalCity] = useState('');
  const [returnArrivalDate, setReturnArrivalDate] = useState('');
  const [returnArrivalTime, setReturnArrivalTime] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnAirline, setReturnAirline] = useState('');
  const [returnDepartureCity, setReturnDepartureCity] = useState('');
  const [returnDepartureTime, setReturnDepartureTime] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);
  const [savedReturn, setSavedReturn] = useState(false);

  // Aayojak sharing for return
  const [aayojakList, setAayojakList] = useState<any[]>([]);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [showSharePanel, setShowSharePanel] = useState(false);

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

      const sishyaQ = query(collection(db, 'shivirSishya'), where('phone', '==', phone));
      const sishyaSnap = await getDocs(sishyaQ);
      if (!sishyaSnap.empty) {
        const sid = sishyaSnap.docs[0].data().shivirId;
        setShivirId(sid);

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) {
          const sData = { id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() } as any;
          setShivirName(sData.name);
          setShivirData(sData);
        }

        // Load existing onward travel
        const travelQ = query(collection(db, 'sishyaTravel'), where('phone', '==', phone), where('shivirId', '==', sid));
        const travelSnap = await getDocs(travelQ);
        if (!travelSnap.empty) {
          const d = travelSnap.docs[0].data();
          setTravelMode(d.travelMode || 'train');
          setVehicleNumber(d.vehicleNumber || '');
          setArrivalCity(d.arrivalCity || d.departureCity || '');
          setArrivalDate(d.arrivalDate || '');
          setArrivalTime(d.arrivalTime || '');
          setNotes(d.notes || '');
          setAirline(d.airline || '');
          setDepartureCity(d.departureCity || '');
          setDepartureTime(d.departureTime || '');
        }

        // Load existing return travel
        try {
          const returnDoc = await getDoc(doc(db, 'sishyaReturnTravel', `${phone}_${sid}`));
          if (returnDoc.exists()) {
            const r = returnDoc.data();
            setShowReturn(true);
            setReturnTravelMode(r.travelMode || 'train');
            setReturnVehicleNumber(r.vehicleNumber || '');
            setReturnArrivalCity(r.arrivalCity || '');
            setReturnArrivalDate(r.arrivalDate || '');
            setReturnArrivalTime(r.arrivalTime || '');
            setReturnNotes(r.notes || '');
            setReturnAirline(r.airline || '');
            setReturnDepartureCity(r.departureCity || '');
            setReturnDepartureTime(r.departureTime || '');
            setSharedWith(r.sharedWith || []);
          }
        } catch (e) {}

        // Load Aayojaks for sharing
        const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', sid)));
        setAayojakList(orgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveOnward = async () => {
    if (!arrivalCity || !arrivalDate || !arrivalTime) {
      alert('Please fill Arrival City/Station, Arrival Date and Arrival Time.');
      return;
    }
    setSaving(true);
    try {
      const docId = `${userPhone}_${shivirId}`;
      await setDoc(doc(db, 'sishyaTravel', docId), {
        phone: userPhone, shivirId, travelMode, vehicleNumber,
        arrivalCity, arrivalDate, arrivalTime, notes,
        airline: travelMode === 'flight' ? airline : '',
        departureCity: travelMode === 'flight' ? departureCity : '',
        departureTime: travelMode === 'flight' ? departureTime : '',
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      try {
        const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
        const orgPhones = orgSnap.docs.filter(d => d.data().shivirId === shivirId).map(d => d.data().phone);
        if (orgPhones.length > 0) {
          await createNotificationForMany({
            phones: orgPhones, title: '✈️ Sishya Travel Updated',
            body: `A Sishya updated their onward travel details.`, type: 'sishya_travel', shivirId,
          });
        }
      } catch (e) {}
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { alert('Could not save. Please try again.'); }
    setSaving(false);
  };

  const handleSaveReturn = async () => {
    if (!returnArrivalCity || !returnArrivalDate || !returnArrivalTime) {
      alert('Please fill Arrival City, Arrival Date and Arrival Time for return.');
      return;
    }
    setSavingReturn(true);
    try {
      const docId = `${userPhone}_${shivirId}`;
      await setDoc(doc(db, 'sishyaReturnTravel', docId), {
        phone: userPhone, shivirId,
        travelMode: returnTravelMode, vehicleNumber: returnVehicleNumber,
        arrivalCity: returnArrivalCity, arrivalDate: returnArrivalDate,
        arrivalTime: returnArrivalTime, notes: returnNotes,
        airline: returnTravelMode === 'flight' ? returnAirline : '',
        departureCity: returnTravelMode === 'flight' ? returnDepartureCity : '',
        departureTime: returnTravelMode === 'flight' ? returnDepartureTime : '',
        sharedWith,
        updatedAt: serverTimestamp(),
      });
      setSavedReturn(true);

      // Notify only lead Aayojak
      try {
        if (shivirData?.leadAayojakPhone) {
          await createNotificationForMany({
            phones: [shivirData.leadAayojakPhone],
            title: '🔙 Return Travel Updated',
            body: `A Sishya updated their return travel details.`,
            type: 'sishya_return_travel', shivirId,
          });
        }
      } catch (e) {}
      setTimeout(() => setSavedReturn(false), 3000);
    } catch (e) { alert('Could not save. Please try again.'); }
    setSavingReturn(false);
  };

  const toggleShare = (phone: string) => {
    setSharedWith(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]);
  };

  // Labels per mode
  const getVehicleLabel = (mode: string) => {
    if (mode === 'train') return 'Train no. / name';
    if (mode === 'flight') return 'Flight number';
    if (mode === 'bus') return 'Bus number (if known)';
    return 'Vehicle number (optional)';
  };

  const getArrivalLabel = (mode: string) => {
    if (mode === 'train') return 'Arrival station *';
    return 'Arrival city *';
  };

  const getVehiclePlaceholder = (mode: string) => {
    if (mode === 'train') return 'e.g. 12345 Rajdhani Express';
    if (mode === 'flight') return 'e.g. AI 302';
    if (mode === 'bus') return '';
    return 'e.g. DL 01 AB 1234';
  };

  // Render travel form (reused for onward & return)
  const renderForm = (
    prefix: string,
    mode: string, setMode: (v: string) => void,
    vNum: string, setVNum: (v: string) => void,
    aCity: string, setACity: (v: string) => void,
    aDate: string, setADate: (v: string) => void,
    aTime: string, setATime: (v: string) => void,
    fNotes: string, setFNotes: (v: string) => void,
    fAirline: string, setFAirline: (v: string) => void,
    depCity: string, setDepCity: (v: string) => void,
    depTime: string, setDepTime: (v: string) => void,
  ) => (
    <div className="space-y-5">
      {/* Travel Mode */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">Travel Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {TRAVEL_MODES.map(m => (
            <button key={m.value} onClick={() => setMode(m.value)}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                mode === m.value ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500'
              }`}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Airline selector (flight only) */}
      {mode === 'flight' && (
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">Select Airline</label>
          <div className="grid grid-cols-2 gap-2">
            {AIRLINES.map(a => (
              <button key={a.code} onClick={() => setFAirline(a.code)}
                className={`p-2.5 rounded-xl border-2 text-xs font-medium flex items-center gap-2 transition-all ${
                  fAirline === a.code ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}>
                <span className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: a.color }}>{a.code}</span>
                <span className="text-gray-700">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vehicle / Train / Flight Number */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1">{getVehicleLabel(mode)}</label>
        <input type="text" value={vNum} onChange={e => setVNum(e.target.value.toUpperCase())}
          placeholder={getVehiclePlaceholder(mode)}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
      </div>

      {/* Flight: Departure city + time */}
      {mode === 'flight' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Departure city</label>
            <input type="text" value={depCity} onChange={e => setDepCity(e.target.value)}
              placeholder="e.g. Mumbai"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Departure time</label>
            <input type="time" value={depTime} onChange={e => setDepTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
          </div>
        </div>
      )}

      {/* Arrival City / Station */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1">{getArrivalLabel(mode)}</label>
        <input type="text" value={aCity} onChange={e => setACity(e.target.value)}
          placeholder={mode === 'train' ? 'e.g. New Delhi (NDLS)' : 'e.g. Delhi'}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
      </div>

      {/* Arrival Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Arrival date *</label>
          <input type="date" value={aDate} onChange={e => setADate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Arrival time *</label>
          <input type="time" value={aTime} onChange={e => setATime(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1">Notes (optional)</label>
        <textarea value={fNotes} onChange={e => setFNotes(e.target.value)}
          placeholder="Any special instructions or requests..." rows={2}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
      </div>
    </div>
  );

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

        {/* ONWARD JOURNEY */}
        <div className="bg-white rounded-2xl shadow p-5 mb-4">
          <h2 className="font-bold text-gray-700 mb-4">🛫 Onward Journey</h2>

          {renderForm('onward', travelMode, setTravelMode, vehicleNumber, setVehicleNumber,
            arrivalCity, setArrivalCity, arrivalDate, setArrivalDate, arrivalTime, setArrivalTime,
            notes, setNotes, airline, setAirline, departureCity, setDepartureCity, departureTime, setDepartureTime)}

          <button onClick={handleSaveOnward} disabled={saving}
            className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl text-base disabled:opacity-50 mt-5">
            {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Onward Details'}
          </button>
        </div>

        {/* RETURN JOURNEY */}
        {!showReturn ? (
          <button onClick={() => setShowReturn(true)}
            className="w-full bg-white rounded-2xl shadow p-4 text-center text-orange-500 font-bold mb-4">
            + Add Return Journey Details
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-700">🛬 Return Journey</h2>
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">Visible to Lead Aayojak only</span>
            </div>

            {renderForm('return', returnTravelMode, setReturnTravelMode, returnVehicleNumber, setReturnVehicleNumber,
              returnArrivalCity, setReturnArrivalCity, returnArrivalDate, setReturnArrivalDate,
              returnArrivalTime, setReturnArrivalTime, returnNotes, setReturnNotes,
              returnAirline, setReturnAirline, returnDepartureCity, setReturnDepartureCity,
              returnDepartureTime, setReturnDepartureTime)}

            {/* Share with specific Aayojaks */}
            <div className="mt-5 border-t pt-4">
              <button onClick={() => setShowSharePanel(!showSharePanel)}
                className="w-full text-left flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Share with more Aayojaks</p>
                  <p className="text-xs text-gray-400">
                    {sharedWith.length > 0
                      ? `Shared with ${sharedWith.length} Aayojak${sharedWith.length > 1 ? 's' : ''}`
                      : 'Only Lead Aayojak can see return details'}
                  </p>
                </div>
                <span className="text-orange-500 text-lg">{showSharePanel ? '▲' : '▼'}</span>
              </button>

              {showSharePanel && (
                <div className="mt-3 space-y-2">
                  {aayojakList.map(a => (
                    <label key={a.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        sharedWith.includes(a.phone) ? 'bg-orange-50 border-2 border-orange-300' : 'bg-gray-50 border-2 border-transparent'
                      }`}>
                      <input type="checkbox" checked={sharedWith.includes(a.phone)}
                        onChange={() => toggleShare(a.phone)}
                        className="w-4 h-4 accent-orange-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{a.name} Ji</p>
                        <p className="text-xs text-gray-400">{a.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleSaveReturn} disabled={savingReturn}
              className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl text-base disabled:opacity-50 mt-5">
              {savingReturn ? 'Saving...' : savedReturn ? '✅ Saved!' : 'Save Return Details'}
            </button>
          </div>
        )}

        <p className="text-center text-gray-400 text-xs mt-2 mb-4">
          You can update these details anytime before the Shivir.
        </p>

      </div>
    </div>
  );
}