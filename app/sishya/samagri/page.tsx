'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getShivirSamagri } from '@/lib/samagri';

export default function SishyaSamagriPage() {
  const [shivir, setShivir] = useState<any>(null);
  const [shivirId, setShivirId] = useState('');
  const [sishyaPhone, setSishyaPhone] = useState('');
  const [samagriItems, setSamagriItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBundle, setFilterBundle] = useState<number | 'all'>('all');

  // Step 3 state
  const [handover, setHandover] = useState<any>(null);
  const [alreadyReturned, setAlreadyReturned] = useState(false);
  const [returnRecord, setReturnRecord] = useState<any>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnBundles, setReturnBundles] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;
      setSishyaPhone(phone);

      const userQ = query(collection(db, 'users'), where('phone', '==', phone));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }

      const savedShivirId = localStorage.getItem('sishyaSelectedShivirId');
      const sishyaQ = query(collection(db, 'shivirSishya'), where('phone', '==', phone));
      const sishyaSnap = await getDocs(sishyaQ);

      if (!sishyaSnap.empty) {
        const myShivirIds = sishyaSnap.docs.map(d => d.data().shivirId);
        const sid = (savedShivirId && myShivirIds.includes(savedShivirId))
          ? savedShivirId
          : myShivirIds[0];

        setShivirId(sid);

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });

          const items = await getShivirSamagri(sid) as any[];
          setSamagriItems(items.filter(i => i.quantityToSend > 0));

          // Fetch handover for this Sishya
          const handoverSnap = await getDocs(collection(db, 'samagriHandovers'));
          const myHandover = handoverSnap.docs
            .find(d => d.data().shivirId === sid && d.data().handedTo === phone);

          if (myHandover) {
            setHandover({ id: myHandover.id, ...myHandover.data() });

            // Check if already returned
            const returnSnap = await getDocs(collection(db, 'samagriReturns'));
            const myReturn = returnSnap.docs
              .find(d => d.data().shivirId === sid && d.data().returnedBy === phone);

            if (myReturn) {
              setAlreadyReturned(true);
              setReturnRecord({ id: myReturn.id, ...myReturn.data() });
            }
          }
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveReturn = async () => {
    if (!returnBundles || Number(returnBundles) <= 0) {
      alert('Please enter number of bundles you are returning.');
      return;
    }
    if (Number(returnBundles) > handover.bundlesHandedOver) {
      alert(`You cannot return more than ${handover.bundlesHandedOver} bundles (what was handed to you).`);
      return;
    }
    setSavingReturn(true);
    try {
      const returnId = `${handover.logisticsId}_return_${sishyaPhone}`;

      await setDoc(doc(db, 'samagriReturns', returnId), {
        logisticsId: handover.logisticsId,
        shivirId,
        returnedBy: sishyaPhone,
        returnedTo: handover.handedBy,
        bundlesReturned: Number(returnBundles),
        bundlesReceived: handover.bundlesHandedOver,
        confirmedAt: serverTimestamp(),
      });

      // Notify Aayojak
      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [handover.handedBy],
        title: '📦 Sishya Returned Samagri',
        body: `Sishya has returned ${returnBundles} bundles. Please confirm on Gurudham page.`,
        type: 'samagri_return_from_sishya',
        shivirId,
      });

      setAlreadyReturned(true);
      setReturnRecord({
        bundlesReturned: Number(returnBundles),
        bundlesReceived: handover.bundlesHandedOver,
      });
      setShowReturnForm(false);
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

        {/* ── STEP 3 — Handover Card ── */}
        {handover && (
          <div className="bg-white rounded-2xl shadow mb-4 overflow-hidden">

            <div className="bg-orange-50 px-5 py-4 border-b border-orange-100">
              <h2 className="font-bold text-orange-600 text-sm">📦 Samagri Handed to You</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Aayojak handed over {handover.bundlesHandedOver} bundles
              </p>
            </div>

            {alreadyReturned ? (
              /* Already returned — show summary */
              <div className="bg-green-50 px-5 py-4">
                <p className="text-green-700 font-semibold text-sm">✅ You have confirmed return</p>
                <p className="text-green-600 text-xs mt-1">
                  Received: {returnRecord.bundlesReceived} bundles · Returned: {returnRecord.bundlesReturned} bundles
                </p>
                <p className="text-green-500 text-xs mt-0.5">
                  Aayojak will confirm receipt on their end
                </p>
              </div>
            ) : (
              /* Not yet returned */
              <div className="px-5 py-4">
                {showReturnForm ? (
                  <div className="space-y-3">
                    <div className="bg-orange-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Bundles handed to you</p>
                      <p className="text-lg font-bold text-orange-600">{handover.bundlesHandedOver}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Bundles you are returning *
                      </label>
                      <input
                        type="number"
                        value={returnBundles}
                        onChange={e => setReturnBundles(e.target.value)}
                        placeholder={`Max: ${handover.bundlesHandedOver}`}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                      <p className="text-xs text-gray-400 mt-1">
                        Cannot exceed {handover.bundlesHandedOver} bundles
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowReturnForm(false); setReturnBundles(''); }}
                        className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                        Cancel
                      </button>
                      <button
                        onClick={saveReturn}
                        disabled={savingReturn}
                        className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                        {savingReturn ? 'Saving...' : 'Confirm Return'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReturnForm(true)}
                    className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm">
                    ✅ Confirm Receipt & Return Bundles
                  </button>
                )}
              </div>
            )}
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