'use client';

import { formatShivirDates, formatShivirLocation } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function GurudhamUpdatesPage() {
  const [shivir, setShivir] = useState<any>(null);
  const [shivirId, setShivirId] = useState('');
  const [organiserPhone, setOrganiserPhone] = useState('');
  const [sishyaList, setSishyaList] = useState<any[]>([]);
  const [samagriList, setSamagriList] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSishya, setExpandedSishya] = useState<string | null>(null);

  // Confirm receipt state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [receiptBundles, setReceiptBundles] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Handover state
  const [showHandover, setShowHandover] = useState<string | null>(null);
  const [handoverSishya, setHandoverSishya] = useState('');
  const [handoverBundles, setHandoverBundles] = useState('');
  const [savingHandover, setSavingHandover] = useState(false);

  // Return confirmation state
  const [confirmingReturn, setConfirmingReturn] = useState<string | null>(null);
  const [savingReturnConfirm, setSavingReturnConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;
      setOrganiserPhone(phone);

      const userQ = query(collection(db, 'users'), where('phone', '==', phone));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }

      const savedShivirId = localStorage.getItem('selectedShivirId');
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const myShivirIds = orgSnap.docs
        .filter(d => d.data().phone === phone)
        .map(d => d.data().shivirId);

      if (myShivirIds.length === 0) { setLoading(false); return; }

      const selectedId = (savedShivirId && myShivirIds.includes(savedShivirId))
        ? savedShivirId : myShivirIds[0];

      if (selectedId) {
        const sid = selectedId;
        setShivirId(sid);

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });

          const sishyaQ = query(collection(db, 'shivirSishya'), where('shivirId', '==', sid));
          const sishyaSnap = await getDocs(sishyaQ);
          const sishyaIds = sishyaSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          const sishyaDetails: any[] = [];
          for (const s of sishyaIds as any[]) {
            const uSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', s.phone)));
            if (!uSnap.empty) {
              sishyaDetails.push({ ...uSnap.docs[0].data(), shivirData: s });
            }
          }
          setSishyaList(sishyaDetails);

          const samagriQ = query(collection(db, 'logistics'), where('shivirId', '==', sid));
          const samagriSnap = await getDocs(samagriQ);
          setSamagriList(samagriSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          const receiptSnap = await getDocs(collection(db, 'samagriReceipts'));
          const myReceipts = receiptSnap.docs
            .filter(d => d.data().shivirId === sid && d.data().confirmedBy === phone)
            .map(d => ({ id: d.id, ...d.data() }));
          setReceipts(myReceipts);

          const handoverSnap = await getDocs(collection(db, 'samagriHandovers'));
          const myHandovers = handoverSnap.docs
            .filter(d => d.data().shivirId === sid && d.data().handedBy === phone)
            .map(d => ({ id: d.id, ...d.data() }));
          setHandovers(myHandovers);

          // Load returns from Sishya
          const returnsSnap = await getDocs(collection(db, 'samagriReturns'));
          const myReturns = returnsSnap.docs
            .filter(d => d.data().shivirId === sid && d.data().returnedTo === phone)
            .map(d => ({ id: d.id, ...d.data() }));
          setReturns(myReturns);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const confirmReceipt = async (samagri: any) => {
    if (!receiptBundles || Number(receiptBundles) <= 0) {
      alert('Please enter number of bundles received.');
      return;
    }
    setSavingReceipt(true);
    try {
      const receiptId = `${samagri.id}_${organiserPhone}`;
      await setDoc(doc(db, 'samagriReceipts', receiptId), {
        logisticsId: samagri.id,
        shivirId,
        confirmedBy: organiserPhone,
        bundlesReceived: Number(receiptBundles),
        bundlesDispatched: samagri.bundles || 0,
        notes: receiptNotes.trim(),
        confirmedAt: serverTimestamp(),
        type: 'aayojak_from_dispatch',
      });

      await updateDoc(doc(db, 'logistics', samagri.id), {
        aayojakConfirmed: true,
        aayojakConfirmedAt: serverTimestamp(),
        aayojakPhone: organiserPhone,
      });

      setReceipts(prev => [...prev, {
        id: receiptId,
        logisticsId: samagri.id,
        bundlesReceived: Number(receiptBundles),
        notes: receiptNotes.trim(),
      }]);

      const { createNotificationForMany } = await import('@/lib/notifications');
      const dispatchSnap = await getDocs(collection(db, 'users'));
      const dispatchPhones = dispatchSnap.docs
        .filter(d => d.data().role === 'dispatch')
        .map(d => d.data().phone);
      if (dispatchPhones.length > 0) {
        await createNotificationForMany({
          phones: dispatchPhones,
          title: '✅ Samagri Receipt Confirmed',
          body: `Aayojak has confirmed receipt of ${receiptBundles} bundles for ${shivir?.name}.`,
          type: 'samagri_receipt_confirmed',
          shivirId,
        });
      }

      setSamagriList(prev => prev.map(s =>
        s.id === samagri.id ? { ...s, aayojakConfirmed: true } : s
      ));
      setConfirmingId(null);
      setReceiptBundles('');
      setReceiptNotes('');
    } catch (e) {
      alert('Could not save. Please try again.');
    }
    setSavingReceipt(false);
  };

  const saveHandover = async (samagri: any) => {
    if (!handoverSishya) { alert('Please select a Sishya.'); return; }
    if (!handoverBundles || Number(handoverBundles) <= 0) {
      alert('Please enter number of bundles handed over.');
      return;
    }
    setSavingHandover(true);
    try {
      const handoverId = `${samagri.id}_handover_${organiserPhone}`;
      const selectedSishya = sishyaList.find(s => s.phone === handoverSishya);

      await setDoc(doc(db, 'samagriHandovers', handoverId), {
        logisticsId: samagri.id,
        shivirId,
        handedBy: organiserPhone,
        handedTo: handoverSishya,
        handedToName: selectedSishya?.name || '',
        bundlesHandedOver: Number(handoverBundles),
        confirmedBySishya: false,
        handedAt: serverTimestamp(),
      });

      const { createNotificationForMany } = await import('@/lib/notifications');
      await createNotificationForMany({
        phones: [handoverSishya],
        title: '📦 Samagri Handover',
        body: `Aayojak has handed over ${handoverBundles} bundles of Samagri to you. Please confirm receipt.`,
        type: 'samagri_handover_to_sishya',
        shivirId,
      });

      setHandovers(prev => [...prev, {
        id: handoverId,
        logisticsId: samagri.id,
        handedTo: handoverSishya,
        handedToName: selectedSishya?.name || '',
        bundlesHandedOver: Number(handoverBundles),
        confirmedBySishya: false,
      }]);

      setShowHandover(null);
      setHandoverSishya('');
      setHandoverBundles('');
    } catch (e) {
      alert('Could not save. Please try again.');
    }
    setSavingHandover(false);
  };

  const confirmReturnFromSishya = async (myReturn: any, handoverId: string) => {
    setSavingReturnConfirm(true);
    try {
      await updateDoc(doc(db, 'samagriReturns', myReturn.id), {
        confirmedByAayojak: true,
        confirmedByAayojakAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'samagriHandovers', handoverId), {
        returnedBySishya: true,
        bundlesReturned: myReturn.bundlesReturned,
      });
      setReturns(prev => prev.map(r =>
        r.id === myReturn.id ? { ...r, confirmedByAayojak: true } : r
      ));
      setConfirmingReturn(null);
    } catch (e) {
      alert('Could not confirm. Please try again.');
    }
    setSavingReturnConfirm(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Not updated yet';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
          <button onClick={() => window.location.href = '/organiser'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">📦 Updates from Gurudham</h1>
            <p className="text-gray-500 text-xs">
              {shivir?.name} · <span className="font-bold text-orange-500">{formatShivirLocation(shivir?.city, shivir?.state)}</span>
            </p>
            <p className="text-gray-400 text-xs">
              {formatShivirDates(shivir?.startDate, shivir?.endDate)}
            </p>
          </div>
        </div>

        {/* Samagri Section */}
        <div className="bg-white rounded-2xl shadow p-5 mb-4">
          <h2 className="font-bold text-gray-700 mb-4">📦 Samagri Dispatch</h2>
          {samagriList.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-gray-400">No samagri updates yet</p>
              <p className="text-gray-400 text-sm mt-1">Gurudham will update dispatch details here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {samagriList.map((s: any) => {
                const myReceipt = receipts.find(r => r.logisticsId === s.id);
                const myHandover = handovers.find(h => h.logisticsId === s.id);
                const isConfirmed = s.aayojakConfirmed || !!myReceipt;
                const myReturn = myHandover ? returns.find(r => r.handoverId === myHandover.id) : null;

                return (
                  <div key={s.id} className="border border-orange-100 rounded-xl overflow-hidden">

                    {/* Dispatch info */}
                    <div className="bg-orange-50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-gray-700">{s.title || 'Samagri Update'}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isConfirmed ? 'bg-green-100 text-green-600' :
                          s.status === 'dispatched' ? 'bg-blue-100 text-blue-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {isConfirmed ? '✅ Receipt Confirmed' :
                           s.status === 'dispatched' ? '🚚 Dispatched' : '⏳ Pending'}
                        </span>
                      </div>
                      {s.bundles && <p className="text-gray-600 text-sm">📦 Bundles sent: {s.bundles}</p>}
                      {s.dispatchDate && <p className="text-gray-600 text-sm">📅 Dispatch: {formatDate(s.dispatchDate)}</p>}
                      {s.transport && <p className="text-gray-600 text-sm">🚛 {s.transport}</p>}
                      {s.notes && <p className="text-gray-500 text-sm mt-1 pt-1 border-t border-orange-100">📝 {s.notes}</p>}
                    </div>

                    {/* Receipt confirmed info */}
                    {isConfirmed && myReceipt && (
                      <div className="bg-green-50 px-4 py-3 border-t border-green-100">
                        <p className="text-green-700 text-sm font-semibold">✅ You confirmed receipt</p>
                        <p className="text-green-600 text-xs">Bundles received: {myReceipt.bundlesReceived}</p>
                        {myReceipt.notes && <p className="text-green-600 text-xs">Note: {myReceipt.notes}</p>}
                      </div>
                    )}

                    {/* Confirm receipt form */}
                    {!isConfirmed && s.status === 'dispatched' && (
                      <div className="p-4 border-t border-orange-100">
                        {confirmingId === s.id ? (
                          <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-600">Confirm Receipt</p>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Bundles received *</label>
                              <input type="number" value={receiptBundles}
                                onChange={e => setReceiptBundles(e.target.value)}
                                placeholder={`Dispatched: ${s.bundles || '?'}`}
                                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                              <input type="text" value={receiptNotes}
                                onChange={e => setReceiptNotes(e.target.value)}
                                placeholder="Any remarks..."
                                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setConfirmingId(null); setReceiptBundles(''); setReceiptNotes(''); }}
                                className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                                Cancel
                              </button>
                              <button onClick={() => confirmReceipt(s)} disabled={savingReceipt}
                                className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                                {savingReceipt ? 'Saving...' : 'Confirm Receipt'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmingId(s.id)}
                            className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm">
                            ✅ Confirm I Received This
                          </button>
                        )}
                      </div>
                    )}

                    {/* Handover to Sishya */}
                    {isConfirmed && (
                      <div className="p-4 border-t border-gray-100">
                        {myHandover ? (
                          <div>
                            <div className={`rounded-xl p-3 ${myHandover.confirmedBySishya ? 'bg-green-50' : 'bg-blue-50'}`}>
                              <p className={`text-sm font-semibold ${myHandover.confirmedBySishya ? 'text-green-700' : 'text-blue-700'}`}>
                                {myHandover.confirmedBySishya ? '✅ Sishya confirmed receipt' : '⏳ Handed over — awaiting Sishya confirmation'}
                              </p>
                              <p className={`text-xs mt-1 ${myHandover.confirmedBySishya ? 'text-green-600' : 'text-blue-600'}`}>
                                {myHandover.bundlesHandedOver} bundles → {myHandover.handedToName} Ji
                              </p>
                            </div>

                            {/* Return from Sishya */}
                            {myReturn && (
                              <div className="mt-2">
                                {myReturn.confirmedByAayojak ? (
                                  <div className="bg-green-50 rounded-xl p-3">
                                    <p className="text-green-700 text-sm font-semibold">✅ Return confirmed</p>
                                    <p className="text-green-600 text-xs">{myReturn.bundlesReturned} bundles returned by {myHandover.handedToName} Ji</p>
                                  </div>
                                ) : (
                                  <div className="bg-orange-50 rounded-xl p-3">
                                    <p className="text-orange-700 text-sm font-semibold">📤 Sishya is returning bundles</p>
                                    <p className="text-orange-600 text-xs mb-2">{myReturn.bundlesReturned} bundles from {myHandover.handedToName} Ji</p>
                                    {confirmingReturn === myReturn.id ? (
                                      <div className="flex gap-2">
                                        <button onClick={() => setConfirmingReturn(null)}
                                          className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-xs">
                                          Cancel
                                        </button>
                                        <button
                                          disabled={savingReturnConfirm}
                                          onClick={() => confirmReturnFromSishya(myReturn, myHandover.id)}
                                          className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-xs disabled:opacity-50">
                                          {savingReturnConfirm ? 'Confirming...' : '✅ Confirm Receipt'}
                                        </button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setConfirmingReturn(myReturn.id)}
                                        className="w-full bg-orange-500 text-white font-bold py-2 rounded-xl text-xs">
                                        ✅ Confirm I Received {myReturn.bundlesReturned} Bundles Back
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {showHandover === s.id ? (
                              <div className="space-y-3">
                                <p className="text-sm font-semibold text-gray-600">Hand over to Sishya</p>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Select Sishya *</label>
                                  <select value={handoverSishya} onChange={e => setHandoverSishya(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400">
                                    <option value="">Select Sishya...</option>
                                    {sishyaList.map(s => (
                                      <option key={s.phone} value={s.phone}>{s.name} Ji</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Bundles handed over *</label>
                                  <input type="number" value={handoverBundles}
                                    onChange={e => setHandoverBundles(e.target.value)}
                                    placeholder={`Received: ${myReceipt?.bundlesReceived || '?'}`}
                                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400" />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => { setShowHandover(null); setHandoverSishya(''); setHandoverBundles(''); }}
                                    className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                                    Cancel
                                  </button>
                                  <button onClick={() => saveHandover(s)} disabled={savingHandover}
                                    className="flex-1 bg-orange-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                                    {savingHandover ? 'Saving...' : 'Record Handover'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setShowHandover(s.id)}
                                className="w-full border border-dashed border-orange-300 text-orange-500 font-semibold py-3 rounded-xl text-sm hover:bg-orange-50">
                                🤝 Hand Over to Sishya
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sishya Section */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-bold text-gray-700 mb-4">
            🙏 Sishya from Gurudham ({sishyaList.length})
          </h2>
          {sishyaList.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">🙏</div>
              <p className="text-gray-400">No Sishya assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sishyaList.map((sishya: any, index: number) => (
                <div key={index} className="border border-orange-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSishya(expandedSishya === sishya.phone ? null : sishya.phone)}
                    className="w-full p-4 flex items-center justify-between hover:bg-orange-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl">🙏</div>
                      <div className="text-left">
                        <p className="font-bold text-gray-700">{sishya.name} Ji</p>
                        <p className="text-gray-500 text-sm">{sishya.shivirData?.travelMode || 'Travel details pending'}</p>
                      </div>
                    </div>
                    <span className="text-orange-500 text-lg">{expandedSishya === sishya.phone ? '▲' : '▼'}</span>
                  </button>

                  {expandedSishya === sishya.phone && (
                    <div className="bg-orange-50 p-4 border-t border-orange-100">
                      <div className="space-y-2">
                        {sishya.phone && (
                          <a href={`tel:${sishya.phone}`} className="flex items-center gap-2 bg-white rounded-lg p-3">
                            <span>📞</span>
                            <span className="text-orange-600 font-medium">{sishya.phone}</span>
                          </a>
                        )}
                        {sishya.shivirData?.travelMode && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-gray-500 text-xs">Travel Mode</p>
                            <p className="text-gray-700 font-medium">{sishya.shivirData.travelMode}</p>
                          </div>
                        )}
                        {sishya.shivirData?.arrivalTime && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-gray-500 text-xs">Arrival Time</p>
                            <p className="text-gray-700 font-medium">{sishya.shivirData.arrivalTime}</p>
                          </div>
                        )}
                        {!sishya.shivirData?.travelMode && (
                          <p className="text-gray-400 text-sm text-center py-2">Travel details not updated yet</p>
                        )}
                      </div>
                    </div>
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