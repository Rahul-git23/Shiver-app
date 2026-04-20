 'use client';

import { formatShivirDates, formatShivirLocation } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function CollectionsPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [myTotal, setMyTotal] = useState(0);
  const [targetAmount, setTargetAmount] = useState(0);
  const [currentUserPhone, setCurrentUserPhone] = useState('');
  const [refundRemarks, setRefundRemarks] = useState<{[key: string]: string}>({});
  const [refundingId, setRefundingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      // Get user data
      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      const user = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      setUserData(user); setCurrentUserPhone(currentUser.phoneNumber || '');

      // Get assigned Shivir
      const savedShivirId = localStorage.getItem('selectedShivirId');
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const myShivirIds = orgSnap.docs
        .filter(d => d.data().phone === currentUser.phoneNumber)
        .map(d => d.data().shivirId);

      if (myShivirIds.length === 0) { setLoading(false); return; }

      const shivirId = (savedShivirId && myShivirIds.includes(savedShivirId))
        ? savedShivirId : myShivirIds[0];

      if (shivirId) {
        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
        if (!shivirSnap.empty) {
          const shivirData = { id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() };
          setShivir(shivirData);

          // Get collections for this Shivir
          const colQ = query(collection(db, 'contributions'), where('shivirId', '==', shivirId));
          const colSnap = await getDocs(colQ);
          const cols = colSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Sort by date (newest first)
          cols.sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
          setCollections(cols);

          // Calculate totals
          const total = cols.reduce((sum: number, c: any) => 
            c.status !== 'cancelled' && c.status !== 'refunded' ? sum + (c.amount || 0) : sum, 0);
          const myT = cols.filter((c: any) => c.addedBy === currentUser.phoneNumber && c.status !== 'cancelled')
                         .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
          setTotalAmount(total);
          setMyTotal(myT);

          // Calculate target = approved expenses + ₹50,000 buffer
          const expSnap = await getDocs(query(collection(db, 'expenses'), where('shivirId', '==', shivirId)));
          const approvedExpenses = expSnap.docs
            .filter(d => d.data().status === 'approved')
            .reduce((sum: number, d) => sum + (d.data().estimatedAmount || d.data().amount || 0), 0);
          setTargetAmount(approvedExpenses + 50000);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRefund = async (col: any) => {
  const remark = refundRemarks[col.id]?.trim();
  if (!remark) { alert('Please add a remark before refunding'); return; }
  if (!confirm(`Refund ₹${col.amount} to ${col.sadhakName} Ji?`)) return;
  setRefundingId(col.id);
  try {
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'contributions', col.id), {
      status: 'refunded',
      refundRemark: remark,
      refundedAt: new Date(),
      refundedBy: currentUserPhone,
    });
    setCollections(prev => prev.map(c => c.id === col.id ? { ...c, status: 'refunded', refundRemark: remark } : c));
  } catch (err: any) {
    alert('Error: ' + err.message);
  }
  setRefundingId(null);
};

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (amount: number) => {
    return '₹' + amount.toLocaleString('en-IN');
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
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = '/organiser'}
              className="text-orange-500 font-bold text-lg">←</button>
            <div>
              <h1 className="text-lg font-bold text-orange-600">💰 Collections</h1>
              <p className="text-gray-500 text-xs">
                {shivir?.name} · <span className="font-bold text-orange-500">{formatShivirLocation(shivir?.city, shivir?.state)}</span>
              </p>
              <p className="text-gray-400 text-xs">
                {formatShivirDates(shivir?.startDate, shivir?.endDate)}
              </p>
            </div>
          </div>
          <button onClick={() => window.location.href = '/organiser/collections/add'}
            className="bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
            + Add
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-orange-500 rounded-2xl shadow p-4 text-white">
            <p className="text-orange-100 text-xs mb-1">Total Collected</p>
            <p className="text-2xl font-bold">{formatAmount(totalAmount)}</p>
            <p className="text-orange-100 text-xs mt-1">{collections.length} entries</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-gray-500 text-xs mb-1">My Collections</p>
            <p className="text-2xl font-bold text-orange-500">{formatAmount(myTotal)}</p>
            <p className="text-gray-400 text-xs mt-1">
              {collections.filter((c: any) => c.addedBy === userData?.phone).length} entries
            </p>
          </div>
        </div>

        {/* Collection Target Progress */}
        {targetAmount > 0 && (
          <div className="bg-white rounded-2xl shadow p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-600">Collection Target</p>
              <p className="text-sm font-bold text-orange-500">{formatAmount(targetAmount)}</p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-4 mb-2 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  totalAmount >= targetAmount ? 'bg-green-500' :
                  totalAmount >= targetAmount * 0.75 ? 'bg-orange-500' :
                  totalAmount >= targetAmount * 0.5 ? 'bg-yellow-500' :
                  'bg-red-400'
                }`}
                style={{ width: `${Math.min((totalAmount / targetAmount) * 100, 100)}%` }}>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {Math.round((totalAmount / targetAmount) * 100)}% reached
              </p>
              <p className="text-xs text-gray-400">
                {totalAmount >= targetAmount
                  ? '✅ Target reached!'
                  : `${formatAmount(targetAmount - totalAmount)} remaining`}
              </p>
            </div>

            {/* Buffer note */}
            <p className="text-xs text-gray-300 mt-2 text-center">
              Includes ₹50,000 buffer · Based on approved expenses
            </p>
          </div>
        )}       

        {/* Collections List */}
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-bold text-gray-700 mb-4">
            All Collections ({collections.length})
          </h2>

          {collections.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🙏</div>
              <p className="text-gray-400">No collections recorded yet</p>
              <p className="text-gray-400 text-sm">Tap "+ Add" to record first Sahyog</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collections.map((col: any) => (
                <div key={col.id} className="border border-orange-100 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-700">{col.sadhakName} Ji</p>
                        {col.isReturning && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                            Returning 🙏
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm">{col.city}{col.state ? ', ' + col.state : ''}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        {formatDate(col.createdAt)} • {col.paymentMode}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Collected by: {col.addedByName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-600 text-lg">
                        {formatAmount(col.amount)}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        col.status === 'cancelled' ? 'bg-red-100 text-red-500' :
                        col.status === 'refunded' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {col.status || 'active'}
                      </span>
                    </div>
                  </div>
                  {col.remark && (
                    <p className="text-gray-400 text-xs mt-2 border-t pt-2">
                      📝 {col.remark}
                    </p>
                  )}

                  {/* Refund row — only for own active collections */}
                  {col.status === 'active' && col.addedBy === currentUserPhone && (
                    <div className="flex gap-2 items-center mt-2 border-t pt-2">
                      <input
                        type="text"
                        placeholder="Remark (required), WHY?"
                        value={refundRemarks[col.id] || ''}
                        onChange={e => setRefundRemarks(prev => ({ ...prev, [col.id]: e.target.value }))}
                        className="flex-1 text-xs px-3 border border-green-400 rounded-lg bg-white focus:outline-none"
                        style={{ height: '32px' }}
                      />
                      <button
                        onClick={() => handleRefund(col)}
                        disabled={refundingId === col.id}
                        className="text-xs px-4 bg-orange-50 text-orange-700 border border-orange-300 rounded-lg disabled:opacity-50"
                        style={{ height: '32px' }}>
                        {refundingId === col.id ? '...' : 'Refund'}
                      </button>
                    </div>
                  )}

                  {col.status === 'refunded' && col.refundRemark && (
                    <p className="text-orange-400 text-xs mt-2 border-t pt-2">
                      ↩ Refunded · {col.refundRemark}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
