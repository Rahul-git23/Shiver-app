'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getShivirSamagri } from '@/lib/samagri';

export default function SishyaSamagriPage() {
  const [shivir, setShivir] = useState<any>(null);
  const [shivirId, setShivirId] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [samagriItems, setSamagriItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBundle, setFilterBundle] = useState<number | 'all'>('all');

  // Handover from Aayojak
  const [pendingHandovers, setPendingHandovers] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [savingConfirm, setSavingConfirm] = useState(false);

  // Return to Aayojak
  const [confirmedHandovers, setConfirmedHandovers] = useState<any[]>([]);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnBundles, setReturnBundles] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;
      setUserPhone(phone);

      const userQ = query(collection(db, 'users'), where('phone', '==', phone));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }

      // Get Shivir using localStorage
      const savedShivirId = localStorage.getItem('sishyaSelectedShivirId');
      const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
      const myShivirIds = sishyaSnap.docs
        .filter(d => d.data().phone === phone)
        .map(d => d.data().shivirId);

      if (myShivirIds.length === 0) { setLoading(false); return; }

      const sid = (savedShivirId && myShivirIds.includes(savedShivirId))
        ? savedShivirId : myShivirIds[0];

      setShivirId(sid);

      const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
      if (!shivirSnap.empty) {
        setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });
        const items = await getShivirSamagri(sid) as any[];
        setSamagriItems(items.filter(i => i.quantityToSend > 0));
      }

      // Load handovers for this Sishya
      const handoverSnap = await getDocs(collection(db, 'samagriHandovers'));
      const myHandovers = handoverSnap.docs
        .filter(d => d.data().handedTo === phone && d.data().shivirId === sid)
        .map(d => ({ id: d.id, ...d.data() }));

      setPendingHandovers(myHandovers.filter((h: any) => !h.confirmedBySishya && !h.returnedBySishya));
      setConfirmedHandovers(myHandovers.filter((h: any) => h.confirmedBySishya && !h.returnedBySishya));

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const confirmReceipt = async (handover: any) => {
    setSavingConfirm(true);
    try {
      await updateDoc(doc(db, 'samagriHandovers', handover.id), {
        confirmedBySishya: true,
        confirmedBySishyaAt: serverTimestamp(),
      });

      // Notify Aayojak
      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [handover.handedBy],
        title: '✅ Samagri Receipt Confirmed by Sishya',
        body: `Sishya has confirmed receipt of ${handover.bundlesHandedOver} bundles of Samagri.`,
        type: 'samagri_sishya_confirmed',
        shivirId,
      });

      setPendingHandovers(prev => prev.filter(h => h.id !== handover.id));
      setConfirmedHandovers(prev => [...prev, { ...handover, confirmedBySishya: true }]);
      setConfirmingId(null);
    } catch (e) {
      alert('Could not confirm. Please try again.');
    }
    setSavingConfirm(false);
  };

  const submitReturn = async (handover: any) => {
    if (!returnBundles || Number(returnBundles) < 0) {
      alert('Please enter number of bundles being returned.');
      return;
    }
    setSavingReturn(true);
    try {
      await updateDoc(doc(db, 'samagriHandovers', handover.id), {
        returnedBySishya: true,
        bundlesReturned: Number(returnBundles),
        returnedBySishyaAt: serverTimestamp(),
      });

      // Create return record
      const returnId = `${handover.id}_return`;
      await setDoc(doc(db, 'samagriReturns', returnId), {
        handoverId: handover.id,
        shivirId,
        returnedBy: userPhone,
        returnedTo: handover.handedBy,
        bundlesReturned: Number(returnBundles),
        bundlesOriginal: handover.bundlesHandedOver,
        confirmedByAayojak: false,
        createdAt: serverTimestamp(),
      });

      // Notify Aayojak
      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [handover.handedBy],
        title: '📦 Samagri Return from Sishya',
        body: `Sishya is returning ${returnBundles} bundles of Samagri. Please confirm receipt.`,
        type: 'samagri_sishya_return',
        shivirId,
      });

      setConfirmedHandovers(prev => prev.filter(h => h.id !== handover.id));
      setReturningId(null);
      setReturnBundles('');
    } catch (e) {
      alert('Could not save. Please try again.');
    }
    setSavingReturn(false);
  };

  const bundles = [...new Set(samagriItems.map(i => i.bundleNumber || 1))].sort();

  const filteredItems = samagriItems.filter(item => {
    const matchSearch = search === '' ||
      item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchBundle = filterBundle === 'all' || item.bundleNumber === filterBundle;
    return matchSearch && matchBundle;
  });

  const filteredCategories = [...new Set(filteredItems.map(i => i.category))];

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
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">📦 Shivir Samagri</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
            <p className="text-gray-400 text-xs">
              {bundles.length} Bundles · {samagriItems.length} items
            </p>
          </div>
        </div>

        {/* STEP 1 — Confirm receipt from Aayojak */}
        {pendingHandovers.length > 0 && (
          <div className="mb-4">
            {pendingHandovers.map(handover => (
              <div key={handover.id} className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3">
                <p className="text-blue-700 font-bold text-sm mb-1">📦 Samagri Handover</p>
                <p className="text-blue-600 text-sm mb-3">
                  Aayojak has handed over <span className="font-bold">{handover.bundlesHandedOver} bundles</span> to you. Please confirm receipt.
                </p>

                {confirmingId === handover.id ? (
                  <div className="space-y-2">
                    <p className="text-xs text-blue-600">Tap confirm to acknowledge you received the bundles.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                        Cancel
                      </button>
                      <button
                        onClick={() => confirmReceipt(handover)}
                        disabled={savingConfirm}
                        className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                        {savingConfirm ? 'Confirming...' : '✅ Confirm Receipt'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingId(handover.id)}
                    className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm">
                    ✅ Confirm I Received {handover.bundlesHandedOver} Bundles
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* STEP 2 — Return remaining bundles to Aayojak */}
        {confirmedHandovers.length > 0 && (
          <div className="mb-4">
            {confirmedHandovers.map(handover => (
              <div key={handover.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-3">
                <p className="text-orange-700 font-bold text-sm mb-1">🔄 Return Remaining Samagri</p>
                <p className="text-orange-600 text-sm mb-1">
                  You received <span className="font-bold">{handover.bundlesHandedOver} bundles</span>.
                </p>
                <p className="text-orange-500 text-xs mb-3">
                  After the Shivir, return remaining bundles to Aayojak.
                </p>

                {returningId === handover.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1 font-semibold">
                        Bundles being returned *
                      </label>
                      <input
                        type="number"
                        value={returnBundles}
                        onChange={e => setReturnBundles(e.target.value)}
                        placeholder={`Max: ${handover.bundlesHandedOver}`}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                      <p className="text-xs text-gray-400 mt-1">
                        Enter 0 if all bundles were used during the Shivir.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setReturningId(null); setReturnBundles(''); }}
                        className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                        Cancel
                      </button>
                      <button
                        onClick={() => submitReturn(handover)}
                        disabled={savingReturn}
                        className="flex-1 bg-orange-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                        {savingReturn ? 'Submitting...' : 'Submit Return'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReturningId(handover.id)}
                    className="w-full border border-dashed border-orange-300 text-orange-500 font-semibold py-3 rounded-xl text-sm hover:bg-orange-100">
                    📤 Return Remaining Bundles to Aayojak
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-2xl shadow p-3 mb-3">
          <input
            type="text"
            placeholder="🔍 Search item or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
        </div>

        {/* Bundle Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button onClick={() => setFilterBundle('all')}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${filterBundle === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 shadow'}`}>
            All Bundles
          </button>
          {bundles.map(bn => (
            <button key={bn} onClick={() => setFilterBundle(bn)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${filterBundle === bn ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 shadow'}`}>
              📦 Bundle {bn}
            </button>
          ))}
        </div>

        {/* Items by Category */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-gray-400">No items found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map(category => (
              <div key={category} className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-bold text-orange-600 text-sm uppercase mb-3 border-b border-orange-100 pb-2">
                  {category}
                </h2>
                <div className="space-y-2">
                  {filteredItems
                    .filter(i => i.category === category)
                    .map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex-1">
                          <p className="text-gray-700 text-sm font-medium">{item.itemName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-gray-400 text-xs">Qty: {item.quantityToSend}</span>
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                              📦 Bundle {item.bundleNumber || 1}
                            </span>
                            {item.status === 'attention_required' && (
                              <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">
                                ⚠️ Carry
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-orange-600 font-bold text-sm ml-3">₹{item.price}</p>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}