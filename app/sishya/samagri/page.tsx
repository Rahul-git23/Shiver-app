'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getShivirSamagri } from '@/lib/samagri';

export default function SishyaSamagriPage() {
  const [shivir, setShivir] = useState<any>(null);
  const [shivirId, setShivirId] = useState('');
  const [sishyaPhone, setSishyaPhone] = useState('');
  const [samagriItems, setSamagriItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBundle, setFilterBundle] = useState<number | 'all'>('all');

  // All Aayojaks for this Shivir (for return dropdown)
  const [aayojakList, setAayojakList] = useState<any[]>([]);

  // Handover data
  const [handover, setHandover] = useState<any>(null); // handover TO this sishya
  const [allHandovers, setAllHandovers] = useState<any[]>([]); // all handovers for this shivir

  // Step A — confirm receipt (only for receiver)
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [receiptRecord, setReceiptRecord] = useState<any>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [actualReceived, setActualReceived] = useState('');
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Step B — return bundles (any Sishya)
  const [returnConfirmed, setReturnConfirmed] = useState(false);
  const [returnRecord, setReturnRecord] = useState<any>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnBundles, setReturnBundles] = useState('');
  const [returnToAayojak, setReturnToAayojak] = useState('');
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
          ? savedShivirId : myShivirIds[0];
        setShivirId(sid);

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });
          const items = await getShivirSamagri(sid) as any[];
          setSamagriItems(items.filter(i => i.quantityToSend > 0));

          // Load all Aayojaks for this Shivir
          const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', sid)));
          const aayojakPhones = orgSnap.docs.map(d => d.data().phone);
          const aayojakDetails: any[] = [];
          for (const ap of aayojakPhones) {
            const uSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', ap)));
            if (!uSnap.empty) aayojakDetails.push({ phone: ap, name: uSnap.docs[0].data().name });
          }
          setAayojakList(aayojakDetails);

          // Load ALL handovers for this Shivir
          const handoverSnap = await getDocs(collection(db, 'samagriHandovers'));
          const shivirHandovers = handoverSnap.docs
            .filter(d => d.data().shivirId === sid)
            .map(d => ({ id: d.id, ...d.data() }));
          setAllHandovers(shivirHandovers);

          // Find handover TO this Sishya
          const myHandover = shivirHandovers.find((h: any) => h.handedTo === phone);
          if (myHandover) {
            setHandover(myHandover);

            // Check Step A — receipt confirmed
            const receiptSnap = await getDocs(collection(db, 'samagriSishyaReceipts'));
            const myReceipt = receiptSnap.docs
              .find(d => d.data().shivirId === sid && d.data().confirmedBy === phone);
            if (myReceipt) {
              setReceiptConfirmed(true);
              setReceiptRecord({ id: myReceipt.id, ...myReceipt.data() });
            }
          }

          // Check Step B — return confirmed by any sishya
          const returnSnap = await getDocs(collection(db, 'samagriReturns'));
          const myReturn = returnSnap.docs
            .find(d => d.data().shivirId === sid && d.data().returnedBy === phone);
          if (myReturn) {
            setReturnConfirmed(true);
            setReturnRecord({ id: myReturn.id, ...myReturn.data() });
          }
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Step A — Sishya confirms receipt
  const saveReceipt = async () => {
    if (!actualReceived || Number(actualReceived) <= 0) {
      alert('Please enter how many bundles you received.'); return;
    }
    if (Number(actualReceived) > handover.bundlesHandedOver) {
      alert(`Cannot be more than ${handover.bundlesHandedOver} bundles.`); return;
    }
    setSavingReceipt(true);
    try {
      const receiptId = `${handover.logisticsId}_sishyareceipt_${sishyaPhone}`;
      await setDoc(doc(db, 'samagriSishyaReceipts', receiptId), {
        logisticsId: handover.logisticsId,
        shivirId,
        confirmedBy: sishyaPhone,
        bundlesHandedOver: handover.bundlesHandedOver,
        bundlesActuallyReceived: Number(actualReceived),
        aayojakPhone: handover.handedBy,
        confirmedAt: serverTimestamp(),
      });

      // Update confirmedBySishya on handover record
      await updateDoc(doc(db, 'samagriHandovers', handover.id), {
        confirmedBySishya: true,
      });

      const { createNotificationForMany } = await import('@/lib/notifications');
      if (Number(actualReceived) !== handover.bundlesHandedOver) {
        await createNotificationForMany({
          phones: [handover.handedBy],
          title: '⚠️ Bundle Count Mismatch',
          body: `Sishya received ${actualReceived} of ${handover.bundlesHandedOver} bundles. Please check.`,
          type: 'samagri_receipt_mismatch',
          shivirId,
        });
      } else {
        await createNotificationForMany({
          phones: [handover.handedBy],
          title: '✅ Sishya Confirmed Receipt',
          body: `Sishya confirmed receiving ${actualReceived} bundles of Samagri.`,
          type: 'samagri_sishya_receipt_confirmed',
          shivirId,
        });
      }

      setReceiptConfirmed(true);
      setReceiptRecord({ bundlesActuallyReceived: Number(actualReceived), bundlesHandedOver: handover.bundlesHandedOver });
      setShowReceiptForm(false);
      setActualReceived('');
    } catch (e) { alert('Could not save. Please try again.'); }
    setSavingReceipt(false);
  };

  // Step B — Any Sishya returns bundles to selected Aayojak
  const saveReturn = async (sourceHandover: any, sourceReceipt: any) => {
    if (!returnToAayojak) { alert('Please select an Aayojak.'); return; }
    if (!returnBundles || Number(returnBundles) <= 0) {
      alert('Please enter number of bundles you are returning.'); return;
    }
    const maxReturn = sourceReceipt?.bundlesActuallyReceived || sourceHandover?.bundlesHandedOver || 0;
    if (Number(returnBundles) > maxReturn) {
      alert(`Cannot return more than ${maxReturn} bundles.`); return;
    }
    setSavingReturn(true);
    try {
      const returnId = `${sourceHandover.logisticsId}_return_${sishyaPhone}`;
      await setDoc(doc(db, 'samagriReturns', returnId), {
        logisticsId: sourceHandover.logisticsId,
        shivirId,
        returnedBy: sishyaPhone,
        returnedTo: returnToAayojak,
        bundlesReturned: Number(returnBundles),
        bundlesReceived: maxReturn,
        confirmedAt: serverTimestamp(),
      });

      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [returnToAayojak],
        title: '📦 Sishya Returned Samagri',
        body: `Sishya has returned ${returnBundles} bundles. Please confirm on Gurudham page.`,
        type: 'samagri_return_from_sishya',
        shivirId,
      });

      setReturnConfirmed(true);
      setReturnRecord({ bundlesReturned: Number(returnBundles), returnedTo: returnToAayojak });
      setShowReturnForm(false);
      setReturnBundles('');
      setReturnToAayojak('');
    } catch (e) { alert('Could not save. Please try again.'); }
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

  // For observer Sishyas — find any handover for this shivir
  const anyHandover = allHandovers.length > 0 ? allHandovers[0] : null;
  const isReceiver = handover !== null;

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

        {/* ── Handover Card — shown to ALL Sishyas if any handover exists ── */}
        {anyHandover && (() => {
          const activeHandover = isReceiver ? handover : anyHandover;
          const receiverName = activeHandover.handedToName || 'Sishya';
          const maxReturn = receiptRecord?.bundlesActuallyReceived || activeHandover?.bundlesHandedOver || 0;

          return (
            <div className="bg-white rounded-2xl shadow mb-4 overflow-hidden">
              <div className="bg-orange-50 px-5 py-4 border-b border-orange-100">
                <h2 className="font-bold text-orange-600 text-sm">
                  {isReceiver ? '📦 Samagri Handed to You' : `📦 Samagri Handed to ${receiverName} Ji`}
                </h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  {activeHandover.bundlesHandedOver} bundles handed over
                </p>
              </div>

              {/* Receiver — Step A confirm receipt */}
              {isReceiver && !receiptConfirmed && (
                <div className="px-5 py-4">
                  {showReceiptForm ? (
                    <div className="space-y-3">
                      <div className="bg-orange-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Bundles handed to you</p>
                        <p className="text-lg font-bold text-orange-600">{handover.bundlesHandedOver}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">How many did you actually receive? *</label>
                        <input type="number" value={actualReceived}
                          onChange={e => setActualReceived(e.target.value)}
                          placeholder={`Max: ${handover.bundlesHandedOver}`}
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                        <p className="text-xs text-gray-400 mt-1">If less than {handover.bundlesHandedOver}, Aayojak will be notified</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setShowReceiptForm(false); setActualReceived(''); }}
                          className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                          Cancel
                        </button>
                        <button onClick={saveReceipt} disabled={savingReceipt}
                          className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                          {savingReceipt ? 'Saving...' : 'Confirm Receipt'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowReceiptForm(true)}
                      className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm">
                      ✅ Confirm I Received the Bundles
                    </button>
                  )}
                </div>
              )}

              {/* Receipt confirmed status */}
              {receiptConfirmed && (
                <div className="bg-green-50 px-5 py-3 border-b border-green-100">
                  <p className="text-green-700 font-semibold text-sm">✅ Receipt confirmed</p>
                  <p className="text-green-600 text-xs mt-0.5">
                    {receiverName} Ji received {receiptRecord.bundlesActuallyReceived} of {activeHandover.bundlesHandedOver} bundles
                  </p>
                </div>
              )}

              {/* Observer Sishya — info only, no confirm receipt */}
              {!isReceiver && (
                <div className="bg-blue-50 px-5 py-3 border-b border-blue-100">
                  <p className="text-blue-700 text-sm">
                    {activeHandover.confirmedBySishya
                      ? `✅ ${receiverName} Ji confirmed receipt`
                      : `⏳ Awaiting confirmation from ${receiverName} Ji`}
                  </p>
                </div>
              )}

              {/* Step B — Return bundles (shown to ALL after receipt confirmed or to observer always) */}
              {(receiptConfirmed || !isReceiver) && (
                <div className="px-5 py-4">
                  {returnConfirmed ? (
                    <div className="bg-green-50 rounded-xl p-3">
                      <p className="text-green-700 text-sm font-semibold">✅ Bundles returned to Aayojak</p>
                      <p className="text-green-600 text-xs mt-1">
                        {returnRecord.bundlesReturned} bundles returned
                      </p>
                    </div>
                  ) : (
                    <>
                      {showReturnForm ? (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-gray-600">Return Bundles to Aayojak</p>
                          <div className="bg-orange-50 rounded-xl p-3">
                            <p className="text-xs text-gray-500">Max bundles to return</p>
                            <p className="text-lg font-bold text-orange-600">{maxReturn}</p>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Select Aayojak *</label>
                            <select value={returnToAayojak}
                              onChange={e => setReturnToAayojak(e.target.value)}
                              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400">
                              <option value="">Select Aayojak...</option>
                              {aayojakList.map(a => (
                                <option key={a.phone} value={a.phone}>{a.name} Ji</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Bundles returning *</label>
                            <input type="number" value={returnBundles}
                              onChange={e => setReturnBundles(e.target.value)}
                              placeholder={`Max: ${maxReturn}`}
                              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setShowReturnForm(false); setReturnBundles(''); setReturnToAayojak(''); }}
                              className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                              Cancel
                            </button>
                            <button onClick={() => saveReturn(activeHandover, receiptRecord)}
                              disabled={savingReturn}
                              className="flex-1 bg-orange-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                              {savingReturn ? 'Saving...' : 'Confirm Return'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowReturnForm(true)}
                          className="w-full border border-dashed border-orange-300 text-orange-500 font-semibold py-3 rounded-xl text-sm">
                          📦 Return Bundles to Aayojak
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Search */}
        <div className="bg-white rounded-2xl shadow p-3 mb-3">
          <input type="text" placeholder="🔍 Search item or category..."
            value={search} onChange={e => setSearch(e.target.value)}
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
                  {filteredItems.filter(i => i.category === category).map((item: any) => (
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