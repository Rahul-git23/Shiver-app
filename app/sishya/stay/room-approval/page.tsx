'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, getDocs, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';

interface ApprovalItem {
  id: string;
  bookingId: string;
  shivirId: string;
  roomNumber: number;
  hotelName: string;
  bookedBy: string;
  bookedByName: string;
  roommateNames: string;
  status: string;
}

export default function RoomApprovalPage() {
  const [userPhone, setUserPhone] = useState('');
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [declining, setDeclining] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [showCallPopup, setShowCallPopup] = useState<ApprovalItem | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;
      setUserPhone(phone);

      // Load pending approvals for this Sishya
      const snap = await getDocs(collection(db, 'sishyaRoomApprovals'));
      const pending = snap.docs
        .filter(d => d.data().sishyaPhone === phone && d.data().status === 'pending')
        .map(d => ({ id: d.id, ...d.data() } as ApprovalItem));
      setApprovals(pending);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (approval: ApprovalItem) => {
    setProcessing(approval.id);
    try {
      // Mark this approval as approved
      await updateDoc(doc(db, 'sishyaRoomApprovals', approval.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
      });

      // Check if ALL approvals for this booking are now approved
      const allSnap = await getDocs(collection(db, 'sishyaRoomApprovals'));
      const allForBooking = allSnap.docs.filter(
        d => d.data().bookingId === approval.bookingId
      );
      const allApproved = allForBooking.every(
        d => d.id === approval.id || d.data().status === 'approved'
      );

      if (allApproved) {
        // All group members approved — notify Aayojak
        const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
        const orgPhones = orgSnap.docs
          .filter(d => d.data().shivirId === approval.shivirId)
          .map(d => d.data().phone);

        // Get booking details for payment check
        const staySnap = await getDocs(collection(db, 'sishyaSelfStay'));
        const bookingDoc = staySnap.docs.find(d => d.id === approval.bookingId);
        const booking = bookingDoc?.data();

        if (orgPhones.length > 0) {
          const { createNotificationForMany } = await import('@/lib/notifications');
          await createNotificationForMany({
            phones: orgPhones,
            title: booking?.requestPayment ? '💰 Stay Payment Requested' : '🏨 Sishya Self-Booked Stay',
            body: booking?.requestPayment
              ? `${booking?.bookedByName || 'A Sishya'} Ji's group has confirmed their stay at ${approval.hotelName} and requests payment of ₹${booking?.amount}.`
              : `${booking?.bookedByName || 'A Sishya'} Ji's group has confirmed their stay at ${approval.hotelName}.`,
            type: booking?.requestPayment ? 'stay_payment_request' : 'stay_self_booked',
            shivirId: approval.shivirId,
          });
        }

        // Update booking approval status
        if (bookingDoc) {
          await updateDoc(doc(db, 'sishyaSelfStay', approval.bookingId), {
            approvalStatus: booking?.requestPayment ? 'pending_aayojak_payment' : 'group_approved',
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Remove from local list
      setApprovals(prev => prev.filter(a => a.id !== approval.id));
    } catch (e) {
      alert('Could not process. Please try again.');
    }
    setProcessing(null);
  };

  const handleDecline = async (approval: ApprovalItem) => {
    if (!remark.trim()) {
      alert('Please enter a reason for declining.');
      return;
    }
    setProcessing(approval.id);
    try {
      // Mark as rejected with remark
      await updateDoc(doc(db, 'sishyaRoomApprovals', approval.id), {
        status: 'rejected',
        rejectionRemark: remark.trim(),
        rejectedAt: serverTimestamp(),
      });

      // Notify the booker
      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [approval.bookedBy],
        title: '❌ Room Sharing Declined',
        body: `A Sishya has declined Room ${approval.roomNumber} at ${approval.hotelName}. Reason: ${remark.trim()}`,
        type: 'room_share_rejected',
        shivirId: approval.shivirId,
      });

      // Show popup to this Sishya saying "call booker"
      setShowCallPopup(approval);
      setDeclining(null);
      setRemark('');
      setApprovals(prev => prev.filter(a => a.id !== approval.id));
    } catch (e) {
      alert('Could not process. Please try again.');
    }
    setProcessing(null);
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
          <button onClick={() => window.location.href = '/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🏨 Room Sharing Requests</h1>
            <p className="text-gray-400 text-xs">Pending approvals</p>
          </div>
        </div>

        {/* Call popup — shown after declining */}
        {showCallPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🙏</div>
                <h2 className="text-lg font-bold text-gray-800">Jai Gurudev</h2>
              </div>
              <p className="text-gray-700 text-sm text-center mb-2">
                You have declined the room sharing request.
              </p>
              <div className="bg-orange-50 rounded-xl p-3 mb-4 text-center">
                <p className="text-sm text-gray-600">Please call</p>
                <p className="text-lg font-bold text-orange-600 mt-1">
                  {showCallPopup.bookedByName
                    ? `${showCallPopup.bookedByName} Ji`
                    : 'the person who booked'}
                </p>
                <p className="text-xs text-gray-400 mt-1">to inform them of your decision</p>
              </div>
              <button
                onClick={() => { setShowCallPopup(null); window.location.href = '/sishya/stay'; }}
                className="w-full bg-orange-500 text-white font-bold py-3 rounded-2xl text-sm">
                OK, understood
              </button>
            </div>
          </div>
        )}

        {approvals.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="font-bold text-gray-600 text-lg mb-2">All caught up!</h3>
            <p className="text-gray-400 text-sm">No pending room sharing requests.</p>
            <button
              onClick={() => window.location.href = '/sishya/stay'}
              className="mt-4 bg-orange-500 text-white font-bold py-3 px-6 rounded-2xl text-sm">
              Back to My Stay
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map(approval => (
              <div key={approval.id} className="bg-white rounded-2xl shadow p-5">

                {/* Greeting */}
                <div className="text-center mb-4">
                  <p className="text-orange-500 font-bold text-base">🙏 Jai Gurudev</p>
                </div>

                {/* Request details */}
                <div className="bg-orange-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-gray-700 mb-3">
                    <span className="font-bold text-orange-600">
                      {approval.bookedByName ? `${approval.bookedByName} Ji` : 'A Sishya'}
                    </span>
                    {' '}has booked a room and added you.
                  </p>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Hotel</span>
                      <span className="text-gray-700 font-medium">{approval.hotelName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Room</span>
                      <span className="text-gray-700 font-medium">Room {approval.roomNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Sharing with</span>
                      <span className="text-gray-700 font-medium text-right max-w-48">
                        {[
                            `${approval.bookedByName || 'Booker'} Ji (booked this room)`,
                            approval.roommateNames && approval.roommateNames !== 'No other roommates'
                            ? approval.roommateNames
                            : null
                        ].filter(Boolean).join(', ')}
                        </span>
                    </div>
                  </div>
                </div>

                {/* Decline remark field */}
                {declining === approval.id && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Reason for declining *
                    </label>
                    <textarea
                      value={remark}
                      onChange={e => setRemark(e.target.value)}
                      placeholder="Please share why you are declining..."
                      rows={3}
                      className="w-full border border-red-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-400 resize-none" />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => { setDeclining(null); setRemark(''); }}
                        className="flex-1 border border-gray-200 text-gray-500 font-semibold py-3 rounded-xl text-sm">
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDecline(approval)}
                        disabled={!remark.trim() || processing === approval.id}
                        className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40">
                        {processing === approval.id ? 'Submitting...' : 'Confirm Decline'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {declining !== approval.id && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setDeclining(approval.id); setRemark(''); }}
                      disabled={processing === approval.id}
                      className="flex-1 border border-red-300 text-red-500 font-bold py-3 rounded-2xl text-sm hover:bg-red-50 disabled:opacity-40">
                      Decline
                    </button>
                    <button
                      onClick={() => handleApprove(approval)}
                      disabled={processing === approval.id}
                      className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl text-sm hover:bg-green-600 disabled:opacity-60">
                      {processing === approval.id ? 'Processing...' : 'Approve'}
                    </button>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}