'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore';

export default function SishyaSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [shivir, setShivir] = useState<any>(null);
  const [sishyaList, setSishyaList] = useState<any[]>([]);
  const [selectedSishya, setSelectedSishya] = useState<any>(null);
  const [sishyaTravel, setSishyaTravel] = useState<any>(null);
  const [arrangements, setArrangements] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('viewer') === 'admin') setIsAdminViewer(true);

      const shivirDoc = await getDoc(doc(db, 'shivirs', shivirId));
      if (shivirDoc.exists()) setShivir({ id: shivirDoc.id, ...shivirDoc.data() });

      const sishyaSnap = await getDocs(query(collection(db, 'shivirSishya'), where('shivirId', '==', shivirId)));
      setSishyaList(sishyaSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

  const loadSishyaDetails = async (sishya: any) => {
    setSelectedSishya(sishya);
    setSishyaTravel(null);
    setArrangements(null);

    // Load travel
    try {
      const travelSnap = await getDocs(query(
        collection(db, 'sishyaTravel'),
        where('phone', '==', sishya.phone),
        where('shivirId', '==', shivirId)
      ));
      if (!travelSnap.empty) setSishyaTravel(travelSnap.docs[0].data());
    } catch (e) {}

    // Load arrangements (stay, food, transport, contacts)
    try {
      const arrSnap = await getDocs(collection(db, 'sishyaArrangements'));
      const arrDoc = arrSnap.docs.find(d => d.data().phone === sishya.phone && d.data().shivirId === shivirId);
      if (arrDoc) setArrangements(arrDoc.data());
    } catch (e) {}
  };

  const removeSishya = async (s: any) => {
    if (!confirm(`Remove ${s.name} Ji from this Shivir?`)) return;
    try {
      await deleteDoc(doc(db, 'shivirSishya', s.id));
      setSishyaList(sishyaList.filter(sx => sx.id !== s.id));
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const goBack = () => {
    const adminQuery = isAdminViewer ? '?viewer=admin' : '';
    window.location.href = `/super-admin/shivir/${shivirId}${adminQuery}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-4xl mx-auto">

        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={selectedSishya ? () => { setSelectedSishya(null); setArrangements(null); setSishyaTravel(null); } : goBack}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🙏 Sishya</h1>
            <p className="text-gray-500 text-xs">{selectedSishya ? `${selectedSishya.name} Ji` : shivir?.name}</p>
          </div>
        </div>

        {!selectedSishya ? (
          /* Sishya List */
          <div className="bg-white rounded-2xl shadow p-4">
            <h3 className="font-bold text-gray-700 mb-3">🙏 Sishya ({sishyaList.length})</h3>
            {sishyaList.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-2">No Sishya assigned yet</p>
            ) : (
              <div className="space-y-2">
                {sishyaList.map(s => (
                  <div key={s.id} className="p-3 bg-orange-50 rounded-xl flex items-center justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => loadSishyaDetails(s)}>
                      <p className="font-medium text-gray-700">{s.name} Ji</p>
                      <p className="text-gray-400 text-sm">{s.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => loadSishyaDetails(s)}
                        className="text-orange-400 font-bold text-sm">→</button>
                      {!isAdminViewer && (
                        <button onClick={() => removeSishya(s)}
                          className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-500 border border-red-200">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Sishya Detail View */
          <div className="space-y-4">
            {/* Sishya Header */}
            <div className="bg-orange-500 rounded-2xl shadow p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-orange-500 font-bold text-lg">
                {selectedSishya.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-orange-100 font-medium uppercase tracking-wide">Viewing Details For</p>
                <h3 className="font-bold text-white text-lg">{selectedSishya.name} Ji</h3>
                <p className="text-orange-100 text-sm">{selectedSishya.phone}</p>
              </div>
            </div>

            {/* Travel Details */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h4 className="font-bold text-gray-700 mb-3">✈️ Travel Details</h4>
              {!sishyaTravel ? (
                <p className="text-gray-400 text-sm">No travel details submitted yet</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Mode</span><span className="font-medium text-gray-700 capitalize">{sishyaTravel.travelMode}</span></div>
                  {sishyaTravel.vehicleNumber && <div className="flex justify-between"><span className="text-gray-500">Vehicle/Flight No.</span><span className="font-medium text-gray-700">{sishyaTravel.vehicleNumber}</span></div>}
                  {sishyaTravel.departureCity && <div className="flex justify-between"><span className="text-gray-500">From</span><span className="font-medium text-gray-700">{sishyaTravel.departureCity}</span></div>}
                  {sishyaTravel.departureDate && <div className="flex justify-between"><span className="text-gray-500">Departure</span><span className="font-medium text-gray-700">{sishyaTravel.departureDate} {sishyaTravel.departureTime}</span></div>}
                  {sishyaTravel.arrivalDate && <div className="flex justify-between"><span className="text-gray-500">Arrival</span><span className="font-medium text-gray-700">{sishyaTravel.arrivalDate} {sishyaTravel.arrivalTime}</span></div>}
                  {sishyaTravel.notes && <div className="border-t pt-2 mt-2"><p className="text-gray-400 text-xs">Notes: {sishyaTravel.notes}</p></div>}
                </div>
              )}
            </div>

            {/* Stay Details */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h4 className="font-bold text-gray-700 mb-3">🏨 Stay Details</h4>
              {!arrangements?.hotelName ? (
                <p className="text-gray-400 text-sm">Not assigned yet</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Hotel</span><span className="font-medium text-gray-700">{arrangements.hotelName}</span></div>
                  {arrangements.hotelAddress && <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="font-medium text-gray-700">{arrangements.hotelAddress}</span></div>}
                  {arrangements.roomDetails && <div className="flex justify-between"><span className="text-gray-500">Room</span><span className="font-medium text-gray-700">{arrangements.roomDetails}</span></div>}
                  {arrangements.checkInTime && <div className="flex justify-between"><span className="text-gray-500">Check-in</span><span className="font-medium text-gray-700">{arrangements.checkInTime}</span></div>}
                  {arrangements.checkOutTime && <div className="flex justify-between"><span className="text-gray-500">Check-out</span><span className="font-medium text-gray-700">{arrangements.checkOutTime}</span></div>}
                  {arrangements.mapsUrl && (
                    <a href={arrangements.mapsUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-medium">
                      📍 Open in Google Maps
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Food Schedule */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h4 className="font-bold text-gray-700 mb-3">🍽️ Food Schedule</h4>
              {!arrangements?.breakfastTime && !arrangements?.lunchTime && !arrangements?.dinnerTime ? (
                <p className="text-gray-400 text-sm">Not assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: 'Breakfast', time: arrangements.breakfastTime, location: arrangements.breakfastLocation },
                    { label: 'Lunch', time: arrangements.lunchTime, location: arrangements.lunchLocation },
                    { label: 'Dinner', time: arrangements.dinnerTime, location: arrangements.dinnerLocation },
                  ].map(meal => (
                    meal.time && (
                      <div key={meal.label} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg text-sm">
                        <span className="text-gray-500">{meal.label}</span>
                        <span className="text-gray-700 font-medium">{meal.time} · {meal.location || '—'}</span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Transport */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h4 className="font-bold text-gray-700 mb-3">🚗 Transport</h4>
              {!arrangements?.pickupPoint ? (
                <p className="text-gray-400 text-sm">Not assigned yet</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Pickup Point</span><span className="font-medium text-gray-700">{arrangements.pickupPoint}</span></div>
                  {arrangements.pickupTime && <div className="flex justify-between"><span className="text-gray-500">Pickup Time</span><span className="font-medium text-gray-700">{arrangements.pickupTime}</span></div>}
                  {arrangements.vehicleDetails && <div className="flex justify-between"><span className="text-gray-500">Vehicle</span><span className="font-medium text-gray-700">{arrangements.vehicleDetails}</span></div>}
                  {arrangements.driverName && <div className="flex justify-between"><span className="text-gray-500">Driver</span><span className="font-medium text-gray-700">{arrangements.driverName}</span></div>}
                  {arrangements.driverPhone && (
                    <a href={`tel:${arrangements.driverPhone}`} className="inline-block mt-1 text-xs bg-green-50 text-green-600 px-3 py-1 rounded-lg font-medium">
                      📞 Call Driver: {arrangements.driverPhone}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Contacts */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h4 className="font-bold text-gray-700 mb-3">📞 Contacts</h4>
              {!arrangements?.volunteers || arrangements.volunteers.length === 0 || !arrangements.volunteers[0]?.name ? (
                <p className="text-gray-400 text-sm">No contacts assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {arrangements.volunteers.filter((v: any) => v.name).map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-700 text-sm">{v.name} Ji</p>
                        {v.role && <p className="text-gray-400 text-xs">{v.role}</p>}
                      </div>
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded-lg font-medium border border-green-200">
                          📞 Call
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}