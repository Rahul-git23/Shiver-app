'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, getDocs, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';

interface PaymentRequest {
  id: string;
  shivirId: string;
  bookedBy: string;
  bookedByName: string;
  hotelName: string;
  amount: number;
  checkIn: string;
  checkOut: string;
  address: string;
  mapsUrl: string;
  invoiceUrl: string;
  invoiceName: string;
}

export default function PaymentApprovalPage() {
  const [organiserPhone, setOrganiserPhone] = useState('');
  const [shivirId, setShivirId] = useState('');
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');

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

      // Load pending payment requests for this Shivir
      await loadRequests(sid);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadRequests = async (sid: string) => {
    const staySnap = await getDocs(collection(db, 'sishyaSelfStay'));
    const pending = staySnap.docs
      .filter(d =>
        d.data().shivirId === sid &&
        d.data().requestPayment === true &&
        d.data().payStatus !== 'approved' &&
        d.data().payStatus !== 'rejected' &&
        (d.data().approvalStatus === 'pending_aayojak' || d.data().approvalStatus === 'pending_aayojak_payment')
      )
      .map(d => ({
        id: d.id,
        shivirId: d.data().shivirId,
        bookedBy: d.data().bookedBy,
        bookedByName: d.data().bookedByName || '',
        hotelName: d.data().hotelName || '',
        amount: d.data().amount || 0,
        checkIn: d.data().checkIn || '',
        checkOut: d.data().checkOut || '',
        address: d.data().address || '',
        mapsUrl: d.data().mapsUrl || '',
        invoiceUrl: d.data().invoiceUrl || '',
        invoiceName: d.data().invoiceName || '',
      } as PaymentRequest));
    setRequests(pending);
  };

  const handleApprove = async (request: PaymentRequest) => {
    setProcessing(request.id);
    try {
      await updateDoc(doc(db, 'sishyaSelfStay', request.id), {
        payStatus: 'approved',
        approvalStatus: 'approved',
        approvedBy: organiserPhone,
        approvedAt: serverTimestamp(),
      });

      // Notify Sishya
      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [request.bookedBy],
        title: '✅ Stay Payment Approved',
        body: `Aayojak has approved payment for your stay at ${request.hotelName}. Amount: ₹${request.amount}.`,
        type: 'stay_payment_approved',
        shivirId,
      });

      const remaining = requests.filter(r => r.id !== request.id);
      setRequests(remaining);

      // If no more pending — go to dashboard
      if (remaining.length === 0) {
        window.location.href = '/organiser';
      }
    } catch (e) {
      alert('Could not process. Please try again.');
    }
    setProcessing(null);
  };

  const handleReject = async (request: PaymentRequest) => {
    if (!rejectRemark.trim()) {
      alert('Please enter a reason for rejection.');
      return;
    }
    setProcessing(request.id);
    try {
      await updateDoc(doc(db, 'sishyaSelfStay', request.id), {
        payStatus: 'rejected',
        approvalStatus: 'rejected',
        rejectedBy: organiserPhone,
        rejectionRemark: rejectRemark.trim(),
        rejectedAt: serverTimestamp(),
      });

      // Notify Sishya
      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [request.bookedBy],
        title: '❌ Stay Payment Rejected',
        body: `Aayojak has rejected the payment request for ${request.hotelName}. Reason: ${rejectRemark.trim()}. You may still stay at your own expense.`,
        type: 'stay_payment_rejected',
        shivirId,
      });

      const remaining = requests.filter(r => r.id !== request.id);
      setRequests(remaining);
      setRejectingId(null);
      setRejectRemark('');

      if (remaining.length === 0) {
        window.location.href = '/organiser';
      }
    } catch (e) {
      alert('Could not process. Please try again.');
    }
    setProcessing(null);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  // If no pending requests — show go to dashboard button (no auto redirect)
  if (!loading && requests.length === 0) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="font-bold text-gray-700 text-lg mb-2">All caught up!</h3>
          <p className="text-gray-400 text-sm mb-6">No pending payment requests.</p>
          <button
            onClick={() => window.location.href = '/organiser'}
            className="w-full bg-orange-500 text-white font-bold py-3 rounded-2xl text-sm">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header — no back button, this is blocking */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <div className="text-center">
            <p className="text-orange-500 font-bold text-base mb-1">🙏 Jai Gurudev</p>
            <h1 className="text-lg font-bold text-gray-800">Stay Payment Approval</h1>
            <p className="text-gray-400 text-xs mt-1">
              Please review and respond to continue using the app
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
          <p className="text-amber-700 text-sm font-medium">
            ⚠️ {requests.length} pending payment request{requests.length > 1 ? 's' : ''} require your response
          </p>
          <p className="text-amber-600 text-xs mt-1">
            You cannot access other pages until all requests are reviewed.
          </p>
        </div>

        {/* Payment request cards */}
        {requests.map((request, index) => (
          <div key={request.id} className="bg-white rounded-2xl shadow p-5 mb-4">

            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
                Request {index + 1} of {requests.length}
              </div>
              <div className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
                ₹{request.amount.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Sishya info */}
            <div className="bg-orange-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-600 mb-3">
                <span className="font-bold text-orange-600">
                  {request.bookedByName ? `${request.bookedByName} Ji` : 'A Sishya'}
                </span>
                {' '}has self-booked a stay and requests payment.
              </p>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Hotel</span>
                  <span className="text-gray-700 font-medium">{request.hotelName}</span>
                </div>
                {request.address && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Address</span>
                    <span className="text-gray-700 text-right max-w-48">{request.address}</span>
                  </div>
                )}
                {(request.checkIn || request.checkOut) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Dates</span>
                    <span className="text-gray-700 font-medium">
                      {formatDate(request.checkIn)} → {formatDate(request.checkOut)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Amount requested</span>
                  <span className="text-orange-600 font-bold">₹{request.amount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Invoice / Maps buttons */}
            <div className="flex gap-2 mb-4">
              {(request.mapsUrl || request.address) && (
                <button
                  onClick={() => window.open(request.mapsUrl || `https://maps.google.com?q=${encodeURIComponent(request.address)}`, '_blank')}
                  className="flex-1 border border-orange-300 text-orange-500 font-semibold py-2 rounded-xl text-sm hover:bg-orange-50">
                  📍 View on Maps
                </button>
              )}
              {request.invoiceUrl && (
                <button
                  onClick={() => window.open(request.invoiceUrl, '_blank')}
                  className="flex-1 border border-blue-300 text-blue-500 font-semibold py-2 rounded-xl text-sm hover:bg-blue-50">
                  📄 View Invoice
                </button>
              )}
            </div>

            {/* Rejection remark field */}
            {rejectingId === request.id && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Reason for rejection *
                </label>
                <textarea
                  value={rejectRemark}
                  onChange={e => setRejectRemark(e.target.value)}
                  placeholder="Please provide a reason..."
                  rows={3}
                  className="w-full border border-red-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-400 resize-none" />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setRejectingId(null); setRejectRemark(''); }}
                    className="flex-1 border border-gray-200 text-gray-500 font-semibold py-3 rounded-xl text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReject(request)}
                    disabled={!rejectRemark.trim() || processing === request.id}
                    className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40">
                    {processing === request.id ? 'Submitting...' : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {rejectingId !== request.id && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setRejectingId(request.id); setRejectRemark(''); }}
                  disabled={processing === request.id}
                  className="flex-1 border border-red-300 text-red-500 font-bold py-3 rounded-2xl text-sm hover:bg-red-50 disabled:opacity-40">
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(request)}
                  disabled={processing === request.id}
                  className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl text-sm hover:bg-green-600 disabled:opacity-60">
                  {processing === request.id ? 'Processing...' : 'Approve Payment'}
                </button>
              </div>
            )}

          </div>
        ))}

      </div>
    </div>
  );
}