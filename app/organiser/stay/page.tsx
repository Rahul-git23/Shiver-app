'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

interface HotelGroup {
  id: string;
  hotelName: string;
  address: string;
  mapsUrl: string;
  rooms: number;
  checkIn: string;
  checkOut: string;
  notes: string;
  sishyaPhones: string[];
}

const emptyHotel = (): HotelGroup => ({
  id: Date.now().toString(),
  hotelName: '',
  address: '',
  mapsUrl: '',
  rooms: 1,
  checkIn: '',
  checkOut: '',
  notes: '',
  sishyaPhones: [],
});

export default function StayManagementPage() {
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [organiserPhone, setOrganiserPhone] = useState('');
  const [sishyaList, setSishyaList] = useState<any[]>([]);
  const [hotels, setHotels] = useState<HotelGroup[]>([emptyHotel()]);
  const [shivirStartDate, setShivirStartDate] = useState('');
  const [shivirEndDate, setShivirEndDate] = useState('');
  const [shivirStartDate, setShivirStartDate] = useState('');
  const [shivirEndDate, setShivirEndDate] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sishyaSelectorOpen, setSishyaSelectorOpen] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;
      setOrganiserPhone(phone);

      // Check role
      const usersSnap = await getDocs(collection(db, 'users'));
      const userDoc = usersSnap.docs.find(d => d.data().phone === phone);
      if (!userDoc || userDoc.data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }

      // Get Shivir
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const orgDoc = orgSnap.docs.find(d => d.data().phone === phone);
      if (!orgDoc) { setLoading(false); return; }
      const sid = orgDoc.data().shivirId;
      setShivirId(sid);

      // Get Shivir name
      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const shivirDoc = shivirSnap.docs.find(d => d.id === sid);
      if (shivirDoc) {
        setShivirName(shivirDoc.data().name);
        setShivirStartDate(shivirDoc.data().startDate || '');
        setShivirEndDate(shivirDoc.data().endDate || '');
      }
        setShivirStartDate(shivirDoc.data().startDate || '');
        setShivirEndDate(shivirDoc.data().endDate || '');
      }
      // Get Sishya list
      const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
      const list = sishyaSnap.docs
        .filter(d => d.data().shivirId === sid)
        .map(d => d.data());
      setSishyaList(list);

      // Load existing hotel groups
      const staySnap = await getDocs(collection(db, 'sishyaStayGroups'));
      const existing = staySnap.docs
        .filter(d => d.data().shivirId === sid)
        .map(d => ({ id: d.id, ...d.data() } as HotelGroup));
      if (existing.length > 0) setHotels(existing);

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateHotel = (id: string, field: keyof HotelGroup, value: any) => {
    setHotels(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const toggleSishya = (hotelId: string, phone: string) => {
    setHotels(prev => prev.map(h => {
      if (h.id !== hotelId) return h;
      const already = h.sishyaPhones.includes(phone);
      return {
        ...h,
        sishyaPhones: already
          ? h.sishyaPhones.filter(p => p !== phone)
          : [...h.sishyaPhones, phone],
      };
    }));
  };

  const addHotel = () => {
    setHotels(prev => [...prev, emptyHotel()]);
  };

  const removeHotel = async (id: string) => {
    if (!confirm('Remove this hotel?')) return;
    setHotels(prev => prev.filter(h => h.id !== id));
    try {
      await deleteDoc(doc(db, 'sishyaStayGroups', id));
    } catch (e) {}
  };

  const saveHotel = async (hotel: HotelGroup) => {
    if (!hotel.hotelName.trim()) {
      alert('Please enter a hotel name.');
      return;
    }
    setSaving(hotel.id);
    try {
      await setDoc(doc(db, 'sishyaStayGroups', hotel.id), {
        shivirId,
        hotelName: hotel.hotelName.trim(),
        address: hotel.address.trim(),
        mapsUrl: hotel.mapsUrl.trim(),
        rooms: hotel.rooms,
        checkIn: hotel.checkIn,
        checkOut: hotel.checkOut,
        notes: hotel.notes.trim(),
        sishyaPhones: hotel.sishyaPhones,
        bookedBy: organiserPhone,
        updatedAt: serverTimestamp(),
      });
      setSaved(hotel.id);
      setTimeout(() => setSaved(null), 2500);
    } catch (e) {
      alert('Could not save. Please try again.');
    }
    setSaving(null);
  };

  // Find which Sishya are already assigned to OTHER hotels (to show as unavailable)
  const getAssignedElsewhere = (currentHotelId: string) => {
    const assigned: string[] = [];
    hotels.forEach(h => {
      if (h.id !== currentHotelId) assigned.push(...h.sishyaPhones);
    });
    return assigned;
  };

  // Aayojak date limits: 3 days before start, 2 days after end
  const getAayojakMinCheckIn = () => {
    if (!shivirStartDate) return '';
    const d = new Date(shivirStartDate);
    d.setDate(d.getDate() - 3);
    return d.toISOString().split('T')[0];
  };
  const getAayojakMaxCheckOut = () => {
    if (!shivirEndDate) return '';
    const d = new Date(shivirEndDate);
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  };

  const aayojakMinCheckIn = (() => {
    if (!shivirStartDate) return '';
    const d = new Date(shivirStartDate);
    d.setDate(d.getDate() - 3);
    return d.toISOString().split('T')[0];
  })();

  const aayojakMaxCheckIn = shivirStartDate;

  const aayojakMinCheckOut = shivirEndDate;

  const aayojakMaxCheckOut = (() => {
    if (!shivirEndDate) return '';
    const d = new Date(shivirEndDate);
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  })();

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
          <button onClick={() => window.location.href = '/organiser/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🏨 Stay Management</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {/* Sishya summary */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <p className="text-xs text-orange-500 font-semibold uppercase mb-2">Sishya Overview</p>
          <div className="flex flex-wrap gap-2">
            {sishyaList.map(s => {
              const assignedTo = hotels.find(h => h.sishyaPhones.includes(s.phone));
              return (
                <div key={s.phone}
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    assignedTo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {assignedTo ? '✓' : '·'} {s.name} Ji
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {hotels.reduce((acc, h) => acc + h.sishyaPhones.length, 0)} of {sishyaList.length} Sishya assigned to a hotel
          </p>
        </div>

        {/* Hotel Cards */}
        {hotels.map((hotel, index) => {
          const assignedElsewhere = getAssignedElsewhere(hotel.id);
          const isSaving = saving === hotel.id;
          const isSaved = saved === hotel.id;

          return (
            <div key={hotel.id} className="bg-white rounded-2xl shadow p-5 mb-4">

              {/* Hotel card header */}
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
                  Hotel {index + 1} of {hotels.length}
                </div>
                {hotels.length > 1 && (
                  <button onClick={() => removeHotel(hotel.id)}
                    className="text-red-400 text-xs font-medium hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>

              {/* Hotel name */}
              <p className="text-xs text-orange-500 font-semibold uppercase mb-3">Accommodation Details</p>

              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Hotel / Place Name *</label>
                <input
                  type="text"
                  value={hotel.hotelName}
                  onChange={e => updateHotel(hotel.id, 'hotelName', e.target.value)}
                  placeholder="e.g. Hotel Surya Palace"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Full Address</label>
                <textarea
                  value={hotel.address}
                  onChange={e => updateHotel(hotel.id, 'address', e.target.value)}
                  placeholder="Full address"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Google Maps Link</label>
                <input
                  type="url"
                  value={hotel.mapsUrl}
                  onChange={e => updateHotel(hotel.id, 'mapsUrl', e.target.value)}
                  placeholder="Paste Google Maps URL here"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Check-in Date</label>
                <input
                  type="date"
                  value={hotel.checkIn}
                  onChange={e => updateHotel(hotel.id, 'checkIn', e.target.value)}
                  min={aayojakMinCheckIn}
                  max={aayojakMaxCheckIn}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Check-out Date</label>
                <input
                  type="date"
                  value={hotel.checkOut}
                  onChange={e => updateHotel(hotel.id, 'checkOut', e.target.value)}
                  min={aayojakMinCheckOut}
                  max={aayojakMaxCheckOut}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
            </div>

              {/* Room counter */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Number of Rooms</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => updateHotel(hotel.id, 'rooms', Math.max(1, hotel.rooms - 1))}
                    className="w-10 h-10 rounded-xl border border-orange-300 text-orange-500 text-xl font-bold flex items-center justify-center hover:bg-orange-50">
                    −
                  </button>
                  <span className="text-xl font-bold text-gray-700 w-8 text-center">{hotel.rooms}</span>
                  <button
                    onClick={() => updateHotel(hotel.id, 'rooms', hotel.rooms + 1)}
                    className="w-10 h-10 rounded-xl border border-orange-300 text-orange-500 text-xl font-bold flex items-center justify-center hover:bg-orange-50">
                    +
                  </button>
                </div>
              </div>

              {/* Sishya selector */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-2">
                  Sishya at this Hotel
                  <span className="text-gray-400 font-normal ml-1">({hotel.sishyaPhones.length} selected)</span>
                </label>

                {/* Selected chips */}
                {hotel.sishyaPhones.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {hotel.sishyaPhones.map(phone => {
                      const s = sishyaList.find(x => x.phone === phone);
                      return s ? (
                        <div key={phone}
                          className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-xs text-orange-700 font-medium">
                          {s.name} Ji
                          <button onClick={() => toggleSishya(hotel.id, phone)}
                            className="text-orange-400 hover:text-orange-600 ml-1 font-bold">×</button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Add Sishya button */}
                <button
                  onClick={() => setSishyaSelectorOpen(sishyaSelectorOpen === hotel.id ? null : hotel.id)}
                  className="w-full border border-dashed border-orange-300 rounded-xl p-3 text-sm text-orange-500 hover:bg-orange-50 text-left">
                  {sishyaSelectorOpen === hotel.id ? '▲ Close list' : '▼ Select Sishya for this hotel'}
                </button>

                {/* Sishya dropdown list */}
                {sishyaSelectorOpen === hotel.id && (
                  <div className="border border-gray-200 rounded-xl mt-1 overflow-hidden">
                    {sishyaList.length === 0 ? (
                      <p className="text-sm text-gray-400 p-3">No Sishya assigned to this Shivir.</p>
                    ) : (
                      sishyaList.map(s => {
                        const isSelected = hotel.sishyaPhones.includes(s.phone);
                        const isElsewhere = assignedElsewhere.includes(s.phone);
                        return (
                          <button
                            key={s.phone}
                            onClick={() => !isElsewhere && toggleSishya(hotel.id, s.phone)}
                            disabled={isElsewhere}
                            className={`w-full flex items-center justify-between p-3 text-sm border-b border-gray-100 last:border-0 ${
                              isElsewhere
                                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                : isSelected
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}>
                            <span>{s.name} Ji</span>
                            {isElsewhere
                              ? <span className="text-xs text-gray-300">Assigned elsewhere</span>
                              : isSelected
                              ? <span className="text-green-500 font-bold">✓</span>
                              : <span className="text-gray-300">+</span>
                            }
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Notes</label>
                <textarea
                  value={hotel.notes}
                  onChange={e => updateHotel(hotel.id, 'notes', e.target.value)}
                  placeholder="Any special instructions..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>

              {/* Save button */}
              <button
                onClick={() => saveHotel(hotel)}
                disabled={isSaving}
                className={`w-full font-bold py-4 rounded-2xl text-base transition-colors ${
                  isSaved
                    ? 'bg-green-500 text-white'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}>
                {isSaving ? 'Saving...' : isSaved ? '✅ Saved!' : `Save Hotel ${index + 1}`}
              </button>

            </div>
          );
        })}

        {/* Add another hotel button */}
        <button
          onClick={addHotel}
          className="w-full border-2 border-dashed border-orange-300 rounded-2xl p-4 text-orange-500 font-semibold text-sm hover:bg-orange-50 mb-6">
          + Add Another Hotel
        </button>

      </div>
    </div>
  );
}