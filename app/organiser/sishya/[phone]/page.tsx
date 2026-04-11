'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const TABS = ['Stay', 'Food', 'Transport', 'Contacts'];

export default function SishyaArrangementPage({ params }: { params: Promise<{ phone: string }> }) {
  const [sishyaPhone, setSishyaPhone] = useState('');
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [sishyaName, setSishyaName] = useState('');
  const [activeTab, setActiveTab] = useState('Stay');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Stay fields
  const [hotelName, setHotelName] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');
  const [roomDetails, setRoomDetails] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [stayNotes, setStayNotes] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');

  // Food fields
  const [breakfastTime, setBreakfastTime] = useState('');
  const [breakfastLocation, setBreakfastLocation] = useState('');
  const [lunchTime, setLunchTime] = useState('');
  const [lunchLocation, setLunchLocation] = useState('');
  const [dinnerTime, setDinnerTime] = useState('');
  const [dinnerLocation, setDinnerLocation] = useState('');
  const [foodNotes, setFoodNotes] = useState('');

  // Transport fields
  const [pickupPoint, setPickupPoint] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [transportNotes, setTransportNotes] = useState('');

// Contact fields
  const [volunteers, setVolunteers] = useState([
    { name: '', phone: '', role: '' }
  ]);
  const [contactNotes, setContactNotes] = useState('');

  useEffect(() => {
    params.then(async (p) => {
      const phone = decodeURIComponent(p.phone);
      setSishyaPhone(phone);

      onAuthStateChanged(auth, async (currentUser) => {
        if (!currentUser) { window.location.href = '/login'; return; }

        // Check organiser role
        const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
        const userSnap = await getDocs(userQ);
        if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
          window.location.href = '/access-denied'; return;
        }

        // Get Shivir — scan all docs
        const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
        const orgDoc = orgSnap.docs.find(d => d.data().phone === currentUser.phoneNumber);
        if (!orgDoc) { setLoading(false); return; }
        const sid = orgDoc.data().shivirId;
        setShivirId(sid);

        // Get Shivir name
        const shivirSnap = await getDocs(collection(db, 'shivirs'));
        const shivirDoc = shivirSnap.docs.find(d => d.id === sid);
        if (shivirDoc) setShivirName(shivirDoc.data().name);

        // Get Sishya name from shivirSishya
        const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
        const sishyaDoc = sishyaSnap.docs.find(d => d.data().phone === phone);
        if (sishyaDoc) setSishyaName(sishyaDoc.data().name);

        // Load existing arrangements
        try {
          const arrSnap = await getDocs(collection(db, 'sishyaArrangements'));
          const arrDoc = arrSnap.docs.find(d => d.data().phone === phone && d.data().shivirId === sid);
          if (arrDoc) {
            const d = arrDoc.data();
            setHotelName(d.hotelName || '');
            setHotelAddress(d.hotelAddress || '');
            setRoomDetails(d.roomDetails || '');
            setCheckInTime(d.checkInTime || '');
            setCheckOutTime(d.checkOutTime || '');
            setStayNotes(d.stayNotes || '');
            setMapsUrl(d.mapsUrl || '');
            setBreakfastTime(d.breakfastTime || '');
            setBreakfastLocation(d.breakfastLocation || '');
            setLunchTime(d.lunchTime || '');
            setLunchLocation(d.lunchLocation || '');
            setDinnerTime(d.dinnerTime || '');
            setDinnerLocation(d.dinnerLocation || '');
            setFoodNotes(d.foodNotes || '');
            setPickupPoint(d.pickupPoint || '');
            setPickupTime(d.pickupTime || '');
            setVehicleDetails(d.vehicleDetails || '');
            setDriverName(d.driverName || '');
            setDriverPhone(d.driverPhone || '');
            setTransportNotes(d.transportNotes || '');
            if (d.volunteers && d.volunteers.length > 0) {
              setVolunteers(d.volunteers);
            }
            setContactNotes(d.contactNotes || '');
          }
        } catch (e) {
          console.log('No arrangements yet');
        }

        setLoading(false);
      });
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docId = `${sishyaPhone}_${shivirId}`;
      await setDoc(doc(db, 'sishyaArrangements', docId), {
        phone: sishyaPhone,
        shivirId,
        hotelName, hotelAddress, roomDetails, checkInTime, checkOutTime, stayNotes, mapsUrl,
        breakfastTime, breakfastLocation, lunchTime, lunchLocation,
        dinnerTime, dinnerLocation, foodNotes,
        pickupPoint, pickupTime, vehicleDetails, driverName, driverPhone, transportNotes,
        volunteers, contactNotes,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Could not save. Please try again.');
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

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/organiser/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">
              🙏 {sishyaName ? `${sishyaName} Ji` : 'Sishya Details'}
            </h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow p-1 mb-4 flex gap-1">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400'
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow p-5 space-y-4">

          {/* STAY TAB */}
          {activeTab === 'Stay' && (
            <>
              <p className="text-xs text-orange-500 font-semibold uppercase">Accommodation Details</p>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Hotel / Place Name</label>
                <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)}
                  placeholder="e.g. Hotel Surya Palace"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Full Address</label>
                <textarea value={hotelAddress} onChange={e => setHotelAddress(e.target.value)}
                  placeholder="Full address for Google Maps" rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Room Details</label>
                <input type="text" value={roomDetails} onChange={e => setRoomDetails(e.target.value)}
                  placeholder="e.g. Room 204, 2nd Floor"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Check-in Time</label>
                  <input type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Check-out Time</label>
                  <input type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Google Maps Link</label>
                <input type="url" value={mapsUrl} onChange={e => setMapsUrl(e.target.value)}
                  placeholder="Paste Google Maps URL here"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={stayNotes} onChange={e => setStayNotes(e.target.value)}
                  placeholder="Any special instructions..." rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>
            </>
          )}

          {/* FOOD TAB */}
          {activeTab === 'Food' && (
            <>
              <p className="text-xs text-orange-500 font-semibold uppercase">Food Schedule</p>
              {[
                { label: '🌅 Breakfast', time: breakfastTime, setTime: setBreakfastTime, location: breakfastLocation, setLocation: setBreakfastLocation },
                { label: '☀️ Lunch', time: lunchTime, setTime: setLunchTime, location: lunchLocation, setLocation: setLunchLocation },
                { label: '🌙 Dinner', time: dinnerTime, setTime: setDinnerTime, location: dinnerLocation, setLocation: setDinnerLocation },
              ].map(meal => (
                <div key={meal.label} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <p className="font-semibold text-gray-600 text-sm">{meal.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Time</label>
                      <input type="time" value={meal.time} onChange={e => meal.setTime(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Location</label>
                      <input type="text" value={meal.location} onChange={e => meal.setLocation(e.target.value)}
                        placeholder="e.g. Hall A"
                        className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={foodNotes} onChange={e => setFoodNotes(e.target.value)}
                  placeholder="Any dietary notes..." rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>
            </>
          )}

          {/* TRANSPORT TAB */}
          {activeTab === 'Transport' && (
            <>
              <p className="text-xs text-orange-500 font-semibold uppercase">Transport Arrangement</p>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Pickup Point</label>
                <input type="text" value={pickupPoint} onChange={e => setPickupPoint(e.target.value)}
                  placeholder="e.g. Railway Station Exit Gate 2"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Pickup Time</label>
                <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Vehicle Details</label>
                <input type="text" value={vehicleDetails} onChange={e => setVehicleDetails(e.target.value)}
                  placeholder="e.g. White Innova DL 3C 1234"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Volunteer Name</label>
                  <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)}
                    placeholder="Seva Karta name"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Volunteer Phone</label>
                  <input type="tel" value={driverPhone} onChange={e => setDriverPhone(e.target.value)}
                    placeholder="10 digit number"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={transportNotes} onChange={e => setTransportNotes(e.target.value)}
                  placeholder="Any special instructions..." rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>
            </>
          )}

          {/* CONTACTS TAB */}
          {activeTab === 'Contacts' && (
            <>
              <p className="text-xs text-orange-500 font-semibold uppercase">Assigned Volunteers</p>

              {volunteers.map((v, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-600 text-sm">
                      {i === 0 ? 'Primary Contact' : `Volunteer ${i + 1}`}
                    </p>
                    {i > 0 && (
                      <button
                        onClick={() => setVolunteers(volunteers.filter((_, idx) => idx !== i))}
                        className="text-red-400 text-xs font-medium">
                        Remove
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input type="text" value={v.name}
                      onChange={e => setVolunteers(volunteers.map((vol, idx) => idx === i ? { ...vol, name: e.target.value } : vol))}
                      placeholder="Volunteer name"
                      className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Phone</label>
                      <input type="tel" value={v.phone}
                        onChange={e => setVolunteers(volunteers.map((vol, idx) => idx === i ? { ...vol, phone: e.target.value } : vol))}
                        placeholder="10 digit number"
                        className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Responsibility</label>
                      <input type="text" value={v.role}
                        onChange={e => setVolunteers(volunteers.map((vol, idx) => idx === i ? { ...vol, role: e.target.value } : vol))}
                        placeholder="e.g. Stay & Food"
                        className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>
                </div>
              ))}

              {volunteers.length < 5 && (
                <button
                  onClick={() => setVolunteers([...volunteers, { name: '', phone: '', role: '' }])}
                  className="w-full border-2 border-dashed border-orange-300 text-orange-500 font-medium py-3 rounded-xl text-sm">
                  + Add Another Volunteer
                </button>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={contactNotes} onChange={e => setContactNotes(e.target.value)}
                  placeholder="Any additional contact instructions..." rows={2}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>
            </>
          )}

        </div>

        {/* Save Button */}
        <button onClick={handleSave} disabled={saving}
          className="w-full mt-4 bg-orange-500 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-50">
          {saving ? 'Saving...' : saved ? '✅ Saved!' : `Save ${activeTab} Details`}
        </button>

      </div>
    </div>
  );
}