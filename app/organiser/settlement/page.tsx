'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { markSettlementSent } from '@/lib/settlements';

export default function SettlementPage() {
  const [settlement, setSettlement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      setCurrentUser(user);

      // Get organiser's shivir
    const savedShivirId = localStorage.getItem('selectedShivirId');
    const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
    const myShivirIds = orgSnap.docs
      .filter(d => d.data().phone === user.phoneNumber)
      .map(d => d.data().shivirId);

    if (myShivirIds.length === 0) { setLoading(false); return; }

    const shivirId = (savedShivirId && myShivirIds.includes(savedShivirId))
      ? savedShivirId : myShivirIds[0];

      // Get pending settlement
      const settlSnap = await getDocs(query(
        collection(db, 'settlements'),
        where('shivirId', '==', shivirId)
      ));
      const pending = settlSnap.docs
        .filter(d => d.data().status === 'pending' || d.data().status === 'sent' || d.data().status === 'paused')
        .sort((a, b) => (a.data().createdAt?.seconds || 0) - (b.data().createdAt?.seconds || 0));
      const latest = pending.length > 0 ? pending[0] : settlSnap.docs.sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0))[0];
      if (latest) setSettlement({ id: latest.id, ...latest.data() });
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!utr.trim()) { setMessage('Please enter UTR / Transaction number'); return; }
    if (!settlement) return;
    setSubmitting(true);
    setMessage('');
    try {
      let screenshotUrl = '';
      if (screenshot) {
        const storage = getStorage();
        const storageRef = ref(storage, `settlements/${settlement.id}/${Date.now()}`);
        await uploadBytes(storageRef, screenshot);
        screenshotUrl = await getDownloadURL(storageRef);
      }
      await markSettlementSent(settlement.id, utr.trim(), currentUser.phoneNumber || '', screenshotUrl);
      setMessage('✅ Payment marked as sent! Super Admin will confirm shortly.');
      setSettlement({ ...settlement, status: 'sent' });
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setSubmitting(false);
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
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => window.location.href = '/organiser'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">Settlement</h1>
            <p className="text-gray-400 text-xs">{settlement?.shivirName || 'Shivir'}</p>
          </div>
        </div>

        {!settlement ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-gray-500">No pending settlement</p>
          </div>
        ) : (
          <>
            {/* Settlement Detail Card — hide when paused */}
            {settlement.status !== 'paused' && <div className="bg-white rounded-2xl shadow p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-gray-700">Settlement #{settlement.settlementNumber}</p>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  settlement.status === 'confirmed' ? 'bg-green-100 text-green-600' :
                  settlement.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {settlement.status === 'confirmed' ? '✅ Confirmed' :
                   settlement.status === 'sent' ? '⏳ Sent — Awaiting Confirmation' : 'Pending'}
                </span>
              </div>

              <div className="text-3xl font-bold text-orange-500 mb-4">
                ₹{(settlement.amount || 0).toLocaleString('en-IN')}
              </div>

              {/* Payment Details — pill layout */}
              <div className="grid grid-cols-2 gap-1.5 mt-3 mb-4">
                {settlement.bankName && (
                  <div className="bg-orange-50 rounded-xl p-2">
                    <p className="text-gray-400 text-xs">Bank</p>
                    <p className="text-gray-700 text-xs font-medium">{settlement.bankName}</p>
                  </div>
                )}
                {settlement.ifsc && (
                  <div className="bg-orange-50 rounded-xl p-2">
                    <p className="text-gray-400 text-xs">IFSC</p>
                    <p className="text-gray-700 text-xs font-medium">{settlement.ifsc}</p>
                  </div>
                )}
                {settlement.accountNo && (
                  <div className="bg-orange-50 rounded-xl p-2 col-span-2">
                    <p className="text-gray-400 text-xs">Account</p>
                    {settlement.accountHolder && <p className="text-gray-700 text-xs font-medium">{settlement.accountHolder}</p>}
                    <p className="text-gray-500 text-xs">{settlement.accountNo}</p>
                  </div>
                )}
                {settlement.upiId && (
                  <div className="bg-orange-50 rounded-xl p-2">
                    <p className="text-gray-400 text-xs">UPI</p>
                    <p className="text-gray-700 text-xs font-medium">{settlement.upiId}</p>
                  </div>
                )}
                {settlement.deadline && (
                  <div className="bg-orange-50 rounded-xl p-2">
                    <p className="text-gray-400 text-xs">Send by</p>
                    <p className="text-red-500 text-xs font-medium">
                      {new Date(settlement.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {settlement.note && (
                <div className="bg-orange-50 rounded-xl p-3 text-sm text-gray-600 mb-2">
                  📝 {settlement.note}
                </div>
              )}
            </div>}

            {/* Contact Card */}
            {settlement.status !== 'paused' && settlement.contactName && (
              <div className="bg-white rounded-2xl shadow p-4 mb-4 text-center">
                <p className="text-gray-400 text-xs mb-1">For any assistance</p>
                <p className="font-bold text-gray-700">{settlement.contactName} Ji</p>
                <a href={`tel:${settlement.contactPhone}`}
                  className="text-orange-500 font-bold text-lg">
                  {settlement.contactPhone}
                </a>
              </div>
            )}

            {/* Mark as Sent — only show if still pending */}
            {settlement.status === 'pending' && (
              <div className="bg-white rounded-2xl shadow p-4 mb-4">
                <h3 className="font-bold text-gray-700 mb-3">Mark as Sent</h3>
                <input
                  type="text"
                  placeholder="Enter UTR / Transaction number"
                  value={utr}
                  onChange={e => setUtr(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm mb-3 focus:outline-none focus:border-orange-400"
                />

                {/* Screenshot Upload */}
                <label className="block w-full border-2 border-dashed border-orange-200 rounded-xl p-4 text-center cursor-pointer mb-3">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => setScreenshot(e.target.files?.[0] || null)} />
                  {screenshot ? (
                    <p className="text-green-600 text-sm font-medium">✅ {screenshot.name}</p>
                  ) : (
                    <>
                      <p className="text-orange-400 font-medium">+ Upload payment screenshot</p>
                      <p className="text-gray-400 text-xs mt-1">optional</p>
                    </>
                  )}
                </label>

                {message && (
                  <p className={`text-sm mb-3 ${message.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                    {message}
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Confirm — Mark as Sent'}
                </button>
              </div>
            )}

            {/* Already sent confirmation */}
            {settlement.status === 'sent' && !message && (
              <div className="bg-blue-50 rounded-2xl p-4 text-center">
                <p className="text-blue-600 font-medium">⏳ Payment submitted — waiting for Super Admin confirmation</p>
              </div>
            )}

            {/* Paused state */}
            {settlement.status === 'paused' && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
                <p className="text-2xl mb-2">⏸</p>
                <p className="font-bold text-gray-600">Settlement on hold</p>
                <p className="text-gray-400 text-sm mt-1">You will be notified when ready.</p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}