'use client';

import { useEffect, useState, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { getStorage } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface RoomAssignment {
  roomNumber: number;
  sishyaPhones: string[];
}

interface SishyaBookingHotel {
  id: string;
  hotelName: string;
  address: string;
  mapsUrl: string;
  rooms: number;
  roomAssignments: RoomAssignment[];
  checkIn: string;
  checkOut: string;
  notes: string;
  requestPayment: boolean;
  amount: string;
  invoiceFile: File | null;
  invoiceUrl: string;
  invoiceName: string;
}

const makeRooms = (count: number, existing: RoomAssignment[] = []): RoomAssignment[] =>
  Array.from({ length: count }, (_, i) => existing[i] || { roomNumber: i + 1, sishyaPhones: [] });

const emptyHotel = (): SishyaBookingHotel => ({
  id: Date.now().toString(),
  hotelName: '',
  address: '',
  mapsUrl: '',
  rooms: 1,
  roomAssignments: [{ roomNumber: 1, sishyaPhones: [] }],
  checkIn: '',
  checkOut: '',
  notes: '',
  requestPayment: false,
  amount: '',
  invoiceFile: null,
  invoiceUrl: '',
  invoiceName: '',
});

export default function SelfBookPage() {
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userName, setUserName] = useState('');
  const [allSishya, setAllSishya] = useState<any[]>([]);
  const [shivirStartDate, setShivirStartDate] = useState('');
  const [shivirEndDate, setShivirEndDate] = useState('');
  const [hotels, setHotels] = useState<SishyaBookingHotel[]>([emptyHotel()]);
  const [selectorOpen, setSelectorOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;
      setUserPhone(phone);

      const usersSnap = await getDocs(collection(db, 'users'));
      const userDoc = usersSnap.docs.find(d => d.data().phone === phone);
      if (!userDoc || userDoc.data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }
      setUserName(userDoc.data().name || '');

      const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
      const sishyaDoc = sishyaSnap.docs.find(d => d.data().phone === phone);
      if (!sishyaDoc) { setLoading(false); return; }

      const sid = sishyaDoc.data().shivirId;
      setShivirId(sid);

      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const shivirDoc = shivirSnap.docs.find(d => d.id === sid);
      if (shivirDoc) {
        setShivirName(shivirDoc.data().name);
        setShivirStartDate(shivirDoc.data().startDate || '');
        setShivirEndDate(shivirDoc.data().endDate || '');
      }

      const allSishyaList = sishyaSnap.docs
        .filter(d => d.data().shivirId === sid && d.data().phone !== phone)
        .map(d => d.data());

      // Add "Me" as first option so booker can include themselves
      const meEntry = { phone: phone, name: 'Me', isMe: true };
      setAllSishya([meEntry, ...allSishyaList]);

      // Load existing bookings
      const selfStaySnap = await getDocs(collection(db, 'sishyaSelfStay'));
      const existing = selfStaySnap.docs.filter(
        d => d.data().bookedBy === phone && d.data().shivirId === sid
      );
      if (existing.length > 0) {
        setHotels(existing.map(d => ({
          id: d.id,
          hotelName: d.data().hotelName || '',
          address: d.data().address || '',
          mapsUrl: d.data().mapsUrl || '',
          rooms: d.data().rooms || 1,
          roomAssignments: d.data().roomAssignments || makeRooms(d.data().rooms || 1),
          checkIn: d.data().checkIn || '',
          checkOut: d.data().checkOut || '',
          notes: d.data().notes || '',
          requestPayment: d.data().requestPayment || false,
          amount: d.data().amount ? String(d.data().amount) : '',
          invoiceFile: null,
          invoiceUrl: d.data().invoiceUrl || '',
          invoiceName: d.data().invoiceName || '',
        })));
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateHotel = (id: string, field: keyof SishyaBookingHotel, value: any) => {
    setHotels(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const changeRoomCount = (hotelId: string, newCount: number) => {
    if (newCount < 1) return;
    setHotels(prev => prev.map(h => {
      if (h.id !== hotelId) return h;
      return { ...h, rooms: newCount, roomAssignments: makeRooms(newCount, h.roomAssignments) };
    }));
  };

  const toggleSishyaInRoom = (hotelId: string, roomNumber: number, phone: string) => {
    setHotels(prev => prev.map(h => {
      if (h.id !== hotelId) return h;
      const newAssignments = h.roomAssignments.map(r => {
        if (r.roomNumber !== roomNumber) return r;
        const already = r.sishyaPhones.includes(phone);
        return {
          ...r,
          sishyaPhones: already
            ? r.sishyaPhones.filter(p => p !== phone)
            : [...r.sishyaPhones, phone],
        };
      });
      return { ...h, roomAssignments: newAssignments };
    }));
  };

  const getAssignedElsewhere = (hotelId: string, roomNumber: number) => {
    const phones: string[] = [];
    hotels.forEach(h => {
      h.roomAssignments.forEach(r => {
        if (h.id === hotelId && r.roomNumber === roomNumber) return;
        phones.push(...r.sishyaPhones);
      });
    });
    return phones;
  };

  const handleFileChange = (hotelId: string, file: File | null) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type)) { alert('Only JPG, PNG or PDF files allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('File must be under 5MB.'); return; }
    setHotels(prev => prev.map(h =>
      h.id === hotelId ? { ...h, invoiceFile: file, invoiceName: file.name } : h
    ));
  };

  const removeHotel = async (id: string) => {
    if (hotels.length === 1) { alert('At least one hotel is required.'); return; }
    if (!confirm('Remove this hotel booking?')) return;
    setHotels(prev => prev.filter(h => h.id !== id));
    try { await deleteDoc(doc(db, 'sishyaSelfStay', id)); } catch (e) {}
  };

  const handleSubmit = async () => {
    for (const hotel of hotels) {
      if (!hotel.hotelName.trim()) {
        alert('Please enter hotel name for all bookings.');
        return;
      }
      if (hotel.requestPayment && (!hotel.amount || Number(hotel.amount) <= 0)) {
        alert(`Please enter a valid amount for "${hotel.hotelName}".`);
        return;
      }
    }

    setSaving(true);
    try {
      const { createNotificationForMany } = await import('@/lib/notifications');

      for (const hotel of hotels) {
        let invoiceUrl = hotel.invoiceUrl;
        let invoiceName = hotel.invoiceName;
        if (hotel.invoiceFile) {
          const storageRef = ref(
            getStorage(),
            `sishyaInvoices/${shivirId}/${hotel.id}_${hotel.invoiceFile.name}`
          );
          await uploadBytes(storageRef, hotel.invoiceFile);
          invoiceUrl = await getDownloadURL(storageRef);
          invoiceName = hotel.invoiceFile.name;
        }

        const allAssignedPhones = Array.from(
          new Set(hotel.roomAssignments.flatMap(r => r.sishyaPhones))
        );
        // Group is anyone except "Me" (self)
        const groupPhones = allAssignedPhones.filter(p => p !== userPhone);
        const isGroup = groupPhones.length > 0;

        await setDoc(doc(db, 'sishyaSelfStay', hotel.id), {
          shivirId,
          bookedBy: userPhone,
          bookedByName: userName,
          hotelName: hotel.hotelName.trim(),
          address: hotel.address.trim(),
          mapsUrl: hotel.mapsUrl.trim(),
          rooms: hotel.rooms,
          roomAssignments: hotel.roomAssignments,
          checkIn: hotel.checkIn,
          checkOut: hotel.checkOut,
          notes: hotel.notes.trim(),
          requestPayment: hotel.requestPayment,
          amount: hotel.requestPayment ? Number(hotel.amount) : 0,
          invoiceUrl,
          invoiceName,
          approvalStatus: isGroup ? 'pending_group' : 'pending_aayojak',
          updatedAt: serverTimestamp(),
        });

        if (isGroup) {
          for (const room of hotel.roomAssignments) {
            // Only notify real other Sishya — not self
            const phonesToNotify = room.sishyaPhones.filter(p => p !== userPhone);
            if (phonesToNotify.length === 0) continue;

            for (const phone of phonesToNotify) {
              const approvalId = `${hotel.id}_room${room.roomNumber}_${phone}`;

              const appSnap = await getDocs(collection(db, 'sishyaRoomApprovals'));
              const exists = appSnap.docs.find(d => d.id === approvalId);
              if (!exists) {
                const roommatePhones = room.sishyaPhones.filter(p => p !== phone);
                const roommateNames = roommatePhones
                  .map(p => {
                    if (p === userPhone) return `${userName || 'Booker'} Ji`;
                    const s = allSishya.find(x => x.phone === p);
                    return s ? `${s.name} Ji` : p;
                  })
                  .join(', ');

                await setDoc(doc(db, 'sishyaRoomApprovals', approvalId), {
                  bookingId: hotel.id,
                  shivirId,
                  roomNumber: room.roomNumber,
                  sishyaPhone: phone,
                  bookedBy: userPhone,
                  bookedByName: userName,
                  hotelName: hotel.hotelName.trim(),
                  roommateNames: roommateNames || 'No other roommates',
                  status: 'pending',
                  rejectionRemark: '',
                  createdAt: serverTimestamp(),
                });

                const roommateText = roommateNames
                  ? `You will be sharing with: ${roommateNames}.`
                  : 'You have been assigned this room.';

                await createNotificationForMany({
                  phones: [phone],
                  title: '🏨 Room Sharing Request',
                  body: `${userName || 'A Sishya'} Ji has booked Room ${room.roomNumber} at ${hotel.hotelName.trim()}. ${roommateText} Please approve or decline.`,
                  type: 'room_share_approval',
                  shivirId,
                });
              }
            }
          }
        } else {
          // Solo or only "Me" selected — notify Aayojak directly
          const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
          const orgPhones = orgSnap.docs
            .filter(d => d.data().shivirId === shivirId)
            .map(d => d.data().phone);

          if (orgPhones.length > 0) {
            await createNotificationForMany({
              phones: orgPhones,
              title: hotel.requestPayment ? '💰 Stay Payment Requested' : '🏨 Sishya Self-Booked Stay',
              body: hotel.requestPayment
                ? `${userName || 'A Sishya'} Ji has booked a stay at ${hotel.hotelName.trim()} and requests payment of ₹${hotel.amount}.`
                : `${userName || 'A Sishya'} Ji has self-booked a stay at ${hotel.hotelName.trim()}.`,
              type: hotel.requestPayment ? 'stay_payment_request' : 'stay_self_booked',
              shivirId,
            });
          }
        }
      }

      alert('Saved! Others have been notified.');
      window.location.href = '/sishya/stay';

    } catch (e) {
      console.error(e);
      alert('Could not save. Please try again.');
    }
    setSaving(false);
  };

  // Sishya: 1 day before start to start for check-in, end to 1 day after end for check-out
  const sishyaMinCheckIn = (() => {
    if (!shivirStartDate) return '';
    const d = new Date(shivirStartDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  const sishyaMaxCheckIn = shivirStartDate;
  const sishyaMinCheckOut = shivirEndDate;

  const sishyaMaxCheckOut = (() => {
    if (!shivirEndDate) return '';
    const d = new Date(shivirEndDate);
    d.setDate(d.getDate() + 1);
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
          <button onClick={() => window.location.href = '/sishya/stay'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🏠 Book My Own Stay</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4">
          <p className="text-blue-700 text-sm">
            Add hotels and assign Sishya per room. Each Sishya will be notified to approve. Aayojak is notified once all approve.
          </p>
        </div>

        {hotels.map((hotel, index) => (
          <div key={hotel.id} className="bg-white rounded-2xl shadow p-5 mb-4">

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

            <p className="text-xs text-orange-500 font-semibold uppercase mb-3">Accommodation Details</p>

            <div className="mb-3">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Hotel / Place Name *</label>
              <input type="text" value={hotel.hotelName}
                onChange={e => updateHotel(hotel.id, 'hotelName', e.target.value)}
                placeholder="e.g. Hotel Surya Palace"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Full Address</label>
              <textarea value={hotel.address}
                onChange={e => updateHotel(hotel.id, 'address', e.target.value)}
                placeholder="Full address of the hotel"
                rows={2}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Google Maps Link</label>
              <input type="url" value={hotel.mapsUrl}
                onChange={e => updateHotel(hotel.id, 'mapsUrl', e.target.value)}
                placeholder="Paste Google Maps URL here"
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Check-in Date</label>
                <input type="date" value={hotel.checkIn}
                  onChange={e => updateHotel(hotel.id, 'checkIn', e.target.value)}
                  min={sishyaMinCheckIn}
                  max={sishyaMaxCheckIn}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Check-out Date</label>
                <input type="date" value={hotel.checkOut}
                  onChange={e => updateHotel(hotel.id, 'checkOut', e.target.value)}
                  min={sishyaMinCheckOut}
                  max={sishyaMaxCheckOut}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
              </div>
            </div>

            {/* Room counter */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Number of Rooms</label>
              <div className="flex items-center gap-4">
                <button onClick={() => changeRoomCount(hotel.id, hotel.rooms - 1)}
                  className="w-10 h-10 rounded-xl border border-orange-300 text-orange-500 text-xl font-bold flex items-center justify-center hover:bg-orange-50">
                  −
                </button>
                <span className="text-xl font-bold text-gray-700 w-8 text-center">{hotel.rooms}</span>
                <button onClick={() => changeRoomCount(hotel.id, hotel.rooms + 1)}
                  className="w-10 h-10 rounded-xl border border-orange-300 text-orange-500 text-xl font-bold flex items-center justify-center hover:bg-orange-50">
                  +
                </button>
              </div>
            </div>

            {/* Per-room Sishya assignment */}
            <div className="mb-4">
              <p className="text-xs text-orange-500 font-semibold uppercase mb-3">Room Assignments</p>

              {(hotel.roomAssignments || []).map(room => {
                const selectorKey = `${hotel.id}_room${room.roomNumber}`;
                const assignedElsewhere = getAssignedElsewhere(hotel.id, room.roomNumber);
                const isSoloRoom = hotel.rooms === 1 && room.sishyaPhones.length === 0;

                return (
                  <div key={room.roomNumber} className="border border-gray-100 rounded-xl p-3 mb-3">

                    <p className="text-sm font-semibold text-gray-600 mb-2">
                      Room {room.roomNumber}
                      <span className="text-gray-400 font-normal ml-2 text-xs">
                        ({room.sishyaPhones.length} selected)
                      </span>
                    </p>

                    {isSoloRoom && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
                        <p className="text-blue-700 text-sm font-medium">🙏 Solo booking</p>
                        <p className="text-blue-600 text-xs mt-1">
                          Only you in this room. Aayojak will be notified directly when you submit.
                        </p>
                      </div>
                    )}

                    {room.sishyaPhones.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {room.sishyaPhones.map(phone => {
                          const s = allSishya.find(x => x.phone === phone);
                          return s ? (
                            <div key={phone}
                              className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-xs text-orange-700 font-medium">
                              {s.isMe ? userName : `${s.name} Ji`}
                              <button
                                onClick={() => toggleSishyaInRoom(hotel.id, room.roomNumber, phone)}
                                className="text-orange-400 hover:text-orange-600 ml-1 font-bold">×</button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}

                    {allSishya.length > 0 ? (
                      <>
                        <button
                          onClick={() => setSelectorOpen(selectorOpen === selectorKey ? null : selectorKey)}
                          className="w-full border border-dashed border-orange-300 rounded-xl p-2 text-sm text-orange-500 hover:bg-orange-50 text-left">
                          {selectorOpen === selectorKey ? '▲ Close' : isSoloRoom ? '▼ Add a roommate (optional)' : '▼ Select Sishya for this room'}
                        </button>

                        {selectorOpen === selectorKey && (
                          <div className="border border-gray-200 rounded-xl mt-1 overflow-hidden">
                            {allSishya.map(s => {
                              const isSelected = room.sishyaPhones.includes(s.phone);
                              const isElsewhere = assignedElsewhere.includes(s.phone);
                              return (
                                <button key={s.phone}
                                  onClick={() => !isElsewhere && toggleSishyaInRoom(hotel.id, room.roomNumber, s.phone)}
                                  disabled={isElsewhere}
                                  className={`w-full flex items-center justify-between p-3 text-sm border-b border-gray-100 last:border-0 ${
                                    isElsewhere ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                      : isSelected ? 'bg-orange-50 text-orange-700'
                                      : 'bg-white text-gray-700 hover:bg-gray-50'
                                  }`}>
                                  <span>{s.isMe ? 'Me (yourself)' : `${s.name} Ji`}</span>
                                  {isElsewhere
                                    ? <span className="text-xs text-gray-300">In another room</span>
                                    : isSelected
                                    ? <span className="text-green-500 font-bold">✓</span>
                                    : <span className="text-gray-300">+</span>
                                  }
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">No other Sishya in this Shivir.</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Invoice upload */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                Invoice / Tariff
                <span className="text-gray-400 font-normal ml-1">(JPG, PNG or PDF, max 5MB)</span>
              </label>
              {(hotel.invoiceUrl || hotel.invoiceName) && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-2">
                  <span className="text-green-600 text-sm">📄</span>
                  <span className="text-green-700 text-xs font-medium flex-1 truncate">{hotel.invoiceName || 'Uploaded'}</span>
                  {hotel.invoiceUrl && (
                    <button onClick={() => window.open(hotel.invoiceUrl, '_blank')}
                      className="text-xs text-blue-600 underline">View</button>
                  )}
                </div>
              )}
              <input type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                ref={el => { fileInputRefs.current[hotel.id] = el; }}
                onChange={e => handleFileChange(hotel.id, e.target.files?.[0] || null)}
                className="hidden" />
              <button
                onClick={() => fileInputRefs.current[hotel.id]?.click()}
                className="w-full border border-dashed border-gray-300 rounded-xl p-3 text-sm text-gray-500 hover:bg-gray-50 text-center">
                {hotel.invoiceFile ? `✓ ${hotel.invoiceFile.name}` : '+ Upload Invoice or Tariff'}
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Notes</label>
              <textarea value={hotel.notes}
                onChange={e => updateHotel(hotel.id, 'notes', e.target.value)}
                placeholder="Any other details..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
            </div>

            {/* Payment request toggle */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Request Aayojak to Pay</p>
                  <p className="text-xs text-gray-400">Aayojak will approve or reject this request</p>
                </div>
                <button
                  onClick={() => updateHotel(hotel.id, 'requestPayment', !hotel.requestPayment)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${hotel.requestPayment ? 'bg-orange-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hotel.requestPayment ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              {hotel.requestPayment && (
                <div className="mt-3 bg-orange-50 rounded-xl p-3">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Amount Requested (₹) *</label>
                  <input type="number" value={hotel.amount}
                    onChange={e => updateHotel(hotel.id, 'amount', e.target.value)}
                    placeholder="e.g. 2500"
                    className="w-full border border-orange-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 bg-white" />
                  <p className="text-xs text-orange-600 mt-2">
                    If Aayojak rejects, you can still stay on your own expense.
                  </p>
                </div>
              )}
            </div>

          </div>
        ))}

        <button
          onClick={() => setHotels(prev => [...prev, emptyHotel()])}
          className="w-full border-2 border-dashed border-orange-300 rounded-2xl p-4 text-orange-500 font-semibold text-sm hover:bg-orange-50 mb-4">
          + Add Another Hotel
        </button>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base hover:bg-orange-600 disabled:opacity-60 mb-6">
          {saving ? 'Saving & Notifying...' : 'Save & Notify'}
        </button>

      </div>
    </div>
  );
}