'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface PaymentRequest {
  id: string;
  shivirId: string;
  bookedBy: string;
  bookedByName: string;
  hotelName: string;
  amount: number;
}

interface Props {
  organiserPhone: string;
  shivirId: string;
}

export default function PaymentApprovalPopup({ organiserPhone, shivirId }: Props) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [current, setCurrent] = useState<PaymentRequest | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectRemark, setRejectRemark] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!organiserPhone || !shivirId) return;
    loadRequests();
  }, [organiserPhone, shivirId]);

  const loadRequests = async () => {
    try {
      const staySnap = await getDocs(collection(db, 'sishyaSelfStay'));
      const pending = staySnap.docs
        .filter(d =>
          d.data().shivirId === shivirId &&
          d.data().requestPayment === true &&
          d.data().payStatus !== 'approved' &&
          d.data().payStatus !== 'rejected'
        )
        .map(d => ({
          id: d.id,
          shivirId: d.data().shivirId,
          bookedBy: d.data().bookedBy,
          bookedByName: d.data().bookedByName || '',
          hotelName: d.data().hotelName || '',
          amount: d.data().amount || 0,
        }));
      setRequests(pending);
      if (pending.length > 0) setCurrent(pending[0]);
    } catch (e) {}
  };

  const handleApprove = async () => {
    if (!current) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'sishyaSelfStay', current.id), {
        payStatus: 'approved',
        approvalStatus: 'approved',
        approvedBy: organiserPhone,
        approvedAt: serverTimestamp(),
      });

      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [current.bookedBy],
        title: '✅ Stay Payment Approved',
        body: `Aayojak has approved payment for your stay at ${current.hotelName}. Amount: ₹${current.amount}.`,
        type: 'stay_payment_approved',
        shivirId,
      });

      // Move to next request
      const remaining = requests.filter(r => r.id !== current.id);
      setRequests(remaining);
      setCurrent(remaining.length > 0 ? remaining[0] : null);
      setRejectMode(false);
      setRejectRemark('');
    } catch (e) {
      alert('Could not process. Please try again.');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!current || !rejectRemark.trim()) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'sishyaSelfStay', current.id), {
        payStatus: 'rejected',
        approvalStatus: 'rejected',
        rejectedBy: organiserPhone,
        rejectionRemark: rejectRemark.trim(),
        rejectedAt: serverTimestamp(),
      });

      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [current.bookedBy],
        title: '❌ Stay Payment Rejected',
        body: `Aayojak has rejected the payment request for ${current.hotelName}. Reason: ${rejectRemark.trim()}. You may still stay at your own expense.`,
        type: 'stay_payment_rejected',
        shivirId,
      });

      const remaining = requests.filter(r => r.id !== current.id);
      setRequests(remaining);
      setCurrent(remaining.length > 0 ? remaining[0] : null);
      setRejectMode(false);
      setRejectRemark('');
    } catch (e) {
      alert('Could not process. Please try again.');
    }
    setProcessing(false);
  };

  // Nothing to show
  if (!current || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-orange-200 overflow-hidden">

          {/* Top bar */}
          <div className="bg-orange-500 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">💰 Stay Payment Request</p>
              {requests.length > 1 && (
                <p className="text-orange-100 text-xs">{requests.length} pending requests</p>
              )}
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-white text-lg font-bold opacity-80 hover:opacity-100 w-8 h-8 flex items-center justify-center">
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-4">

            {!rejectMode ? (
              <>
                {/* Summary */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-bold text-orange-600">
                      {current.bookedByName ? `${current.bookedByName} Ji` : 'A Sishya'}
                    </span>
                    {' '}requests payment for their stay.
                  </p>
                  <div className="bg-orange-50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Hotel</p>
                      <p className="text-sm font-semibold text-gray-700">{current.hotelName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Amount</p>
                      <p className="text-base font-bold text-orange-600">
                        ₹{current.amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* View full details link */}
                <button
                  onClick={() => window.location.href = '/organiser/stay/payment-approval'}
                  className="text-xs text-blue-500 underline mb-3 block">
                  View full details →
                </button>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setRejectMode(true)}
                    disabled={processing}
                    className="flex-1 border border-red-300 text-red-500 font-bold py-3 rounded-xl text-sm hover:bg-red-50 disabled:opacity-40">
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 bg-green-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-green-600 disabled:opacity-60">
                    {processing ? 'Processing...' : 'Approve ₹' + current.amount.toLocaleString('en-IN')}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Reject mode */}
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Reason for rejection *
                </p>
                <textarea
                  value={rejectRemark}
                  onChange={e => setRejectRemark(e.target.value)}
                  placeholder="Please provide a reason..."
                  rows={2}
                  className="w-full border border-red-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-400 resize-none mb-3" />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setRejectMode(false); setRejectRemark(''); }}
                    className="flex-1 border border-gray-200 text-gray-500 font-semibold py-3 rounded-xl text-sm">
                    Back
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectRemark.trim() || processing}
                    className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40">
                    {processing ? 'Submitting...' : 'Confirm Reject'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}