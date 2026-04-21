'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { formatShivirDates, formatShivirLocation } from '@/lib/utils';
import { getSamagriItems, getSamagriCategories, assignSamagriToShivir, getShivirSamagri, updateShivirSamagriStatus, recordDispatch, getShivirDispatch, removeShivirSamagriItem, updateShivirSamagriQty } from '@/lib/samagri';

export default function DispatchShivirPage() {
  const params = useParams();
  const shivirId = params.id as string;

  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'packing' | 'dispatch' | 'requests'>('packing');

  // Samagri state
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shivirSamagri, setShivirSamagri] = useState<any[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // New item assignment
  const [assigningItem, setAssigningItem] = useState<any>(null);
  const [assignQty, setAssignQty] = useState(0);
  const [assignBundle, setAssignBundle] = useState(1);
  const [existingBundles, setExistingBundles] = useState<number[]>([]);

  // Edit qty state
  const [editingPackItem, setEditingPackItem] = useState<string | null>(null);
  const [editPackQty, setEditPackQty] = useState(0);

  // Dispatch record
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [showAddDispatch, setShowAddDispatch] = useState(false);
  const [newDispatch, setNewDispatch] = useState({
    bundles: 0, dispatchDate: '', transportMode: '', biltyNumber: '', notes: ''
  });
  const [savingDispatch, setSavingDispatch] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState('');

  // Organiser requests
  const [requests, setRequests] = useState<any[]>([]);

  // Returns from Aayojak
  const [returnRecords, setReturnRecords] = useState<any[]>([]);
  const [confirmingReturn, setConfirmingReturn] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'dispatch') {
        window.location.href = '/access-denied'; return;
      }
      setUserData({ id: userSnap.docs[0].id, ...userSnap.docs[0].data() });

      // Load Shivir
      const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
      if (!shivirSnap.empty) {
        setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });
      }

      // Load master items and categories
      const [items, cats] = await Promise.all([getSamagriItems(), getSamagriCategories()]);
      setMasterItems(items as any[]);
      setCategories(cats as any[]);

      // Load shivir samagri
      const shivirItems = await getShivirSamagri(shivirId);
      setShivirSamagri(shivirItems as any[]);

      // Load dispatch records
      const dispatchRecords = await getShivirDispatch(shivirId);
      setDispatches(dispatchRecords as any[]);

      // Load organiser requests
      const reqQ = query(collection(db, 'organiserSamagriRequests'), where('shivirId', '==', shivirId), where('status', '==', 'approved'));
      const reqSnap = await getDocs(reqQ);
      setRequests(reqSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Load samagri return to gurudham records
      const rtgSnap = await getDocs(query(collection(db, 'samagriReturnToGurudham'), where('shivirId', '==', shivirId)));
      const rtgRecords = rtgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Enrich with Aayojak name
      const enriched = await Promise.all(rtgRecords.map(async (r: any) => {
        const uSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', r.sentBy)));
        const name = !uSnap.empty ? uSnap.docs[0].data().name : r.sentBy;
        return { ...r, sentByName: name };
      }));
      setReturnRecords(enriched);

      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

  const handleAssignItem = async (item: any) => {
    if (assignQty <= 0) return;
    if (assignBundle <= 0) return;
    await assignSamagriToShivir({
      shivirId,
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      bundleNumber: assignBundle,
      quantityToSend: assignQty,
      price: item.price,
    });
    const updated = await getShivirSamagri(shivirId);
    setShivirSamagri(updated as any[]);
    setAssigningItem(null);
    setAssignQty(0);
    setAssignBundle(1);
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    await updateShivirSamagriStatus(id, status);
    setShivirSamagri(shivirSamagri.map(i => i.id === id ? { ...i, status } : i));
  };

  const handleRemovePackItem = async (id: string) => {
    if (!confirm('Remove this item from packing list?')) return;
    await removeShivirSamagriItem(id);
    setShivirSamagri(shivirSamagri.filter(i => i.id !== id));
  };

  const handleUpdateQty = async (id: string) => {
    if (editPackQty <= 0) return;
    await updateShivirSamagriQty(id, editPackQty);
    setShivirSamagri(shivirSamagri.map(i => i.id === id ? { ...i, quantityToSend: editPackQty } : i));
    setEditingPackItem(null);
    setEditPackQty(0);
  };

  const handleRecordDispatch = async () => {
    if (!newDispatch.bundles || !newDispatch.dispatchDate) {
      setDispatchMessage('Please fill bundles and dispatch date'); return;
    }
    setSavingDispatch(true);
    await recordDispatch({
      shivirId,
      ...newDispatch,
      dispatchedBy: userData?.phone,
    });
    const updated = await getShivirDispatch(shivirId);
    setDispatches(updated as any[]);
    setNewDispatch({ bundles: 0, dispatchDate: '', transportMode: '', biltyNumber: '', notes: '' });
    setShowAddDispatch(false);
    setDispatchMessage('✅ Dispatch recorded!');
    setSavingDispatch(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'packed') return 'bg-blue-100 text-blue-600';
    if (status === 'dispatched') return 'bg-green-100 text-green-600';
    if (status === 'delivered') return 'bg-purple-100 text-purple-600';
    if (status === 'attention_required') return 'bg-red-100 text-red-600';
    return 'bg-yellow-100 text-yellow-600';
  };

  // Items already assigned to this shivir
  const assignedItemIds = shivirSamagri.map(i => i.itemId);
  const filteredMasterItems = selectedCategory === 'all'
    ? masterItems
    : masterItems.filter(i => i.category === selectedCategory);

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
          <button onClick={() => window.location.href = '/dispatch'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">📦 Dispatch</h1>
            <p className="text-gray-500 text-xs">
              {shivir?.name} · <span className="font-bold text-orange-500">{formatShivirLocation(shivir?.city, shivir?.state)}</span>
            </p>
            <p className="text-gray-400 text-xs">{formatShivirDates(shivir?.startDate, shivir?.endDate)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('packing')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'packing' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            📦 Packing
          </button>
          <button onClick={() => setActiveTab('dispatch')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'dispatch' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            🚚 Dispatch
          </button>
          <button onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'requests' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            📋 Requests {requests.length > 0 && `(${requests.length})`}
          </button>
          <button onClick={() => setActiveTab('returns' as any)}
            className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === ('returns' as any) ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            🔄 Returns {returnRecords.length > 0 && `(${returnRecords.length})`}
          </button>
        </div>

        {/* PACKING TAB */}
        {activeTab === 'packing' && (
          <div>
            {/* Assigned Items */}
            <div className="bg-white rounded-2xl shadow p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-700">
                  Packing List ({shivirSamagri.length} items)
                </h2>
                <button onClick={() => setShowAddItem(!showAddItem)}
                  className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1.5 rounded-xl">
                  + Add Item
                </button>
              </div>

              {shivirSamagri.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">📦</div>
                  <p className="text-gray-400 text-sm">No items added yet</p>
                  <p className="text-gray-400 text-xs mt-1">Tap "+ Add Item" to start packing list</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shivirSamagri.map((item: any) => (
                    <div key={item.id} className="border border-orange-100 rounded-xl p-3">
                      {editingPackItem === item.id ? (
                        <div className="space-y-2">
                          <p className="font-medium text-gray-700 text-sm">{item.itemName}</p>
                          <div className="flex gap-2">
                            <input type="number"
                              value={editPackQty || ''}
                              onChange={e => setEditPackQty(Number(e.target.value))}
                              placeholder="New quantity"
                              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                            <button onClick={() => handleUpdateQty(item.id)}
                              className="bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-medium">
                              Save
                            </button>
                            <button onClick={() => setEditingPackItem(null)}
                              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm">
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-700 text-sm">{item.itemName}</p>
                            <p className="text-orange-500 text-xs">{item.category}</p>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-gray-400 text-xs">Qty: {item.quantityToSend}</span>
                              <span className="text-xs bg-orange-100 text-orange-600 px-2 rounded-full">
                                Bundle {item.bundleNumber || 1}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(item.status)}`}>
                              {item.status === 'pending' ? '⏳ Pending' :
                               item.status === 'packed' ? '✅ Packed' :
                               item.status === 'dispatched' ? '🚚 Dispatched' :
                               item.status === 'attention_required' ? '⚠️ Attention' : item.status}
                            </span>
                            <select
                              value={item.status}
                              onChange={e => handleStatusUpdate(item.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 mt-1">
                              <option value="pending">Pending</option>
                              <option value="packed">Packed</option>
                              <option value="dispatched">Dispatched</option>
                              <option value="attention_required">Attention Required</option>
                            </select>
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => { setEditingPackItem(item.id); setEditPackQty(item.quantityToSend); }}
                                className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-lg">
                                ✏️ Edit Qty
                              </button>
                              <button
                                onClick={() => handleRemovePackItem(item.id)}
                                className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded-lg">
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Item from Master List */}
            {showAddItem && (
              <div className="bg-white rounded-2xl shadow p-4 mb-4">
                <h2 className="font-bold text-gray-700 mb-3">Add from Master List</h2>

                {/* Category Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                  <button onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    All
                  </button>
                  {categories.map((cat: any) => (
                    <button key={cat.id} onClick={() => setSelectedCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === cat.name ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {cat.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {filteredMasterItems.map((item: any) => {
                    const isAssigned = assignedItemIds.includes(item.id);
                    return (
                      <div key={item.id} className={`p-3 rounded-xl border ${isAssigned ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                        {assigningItem?.id === item.id ? (
                          <div>
                            <p className="font-medium text-gray-700 text-sm mb-2">{item.name}</p>
                            <div className="flex gap-2 mb-2">
                              <input type="number" placeholder="Qty to send"
                                value={assignQty || ''}
                                onChange={e => setAssignQty(Number(e.target.value))}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                              <select
                                value={assignBundle}
                                onChange={e => setAssignBundle(Number(e.target.value))}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                                {[1,2,3,4,5,6,7,8,9,10]
                                  .filter(n => !existingBundles.includes(n) ||
                                    !shivirSamagri.some(s => s.itemId === item.id && s.bundleNumber === n))
                                  .map(n => (
                                    <option key={n} value={n}>Bundle {n}</option>
                                  ))}
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAssignItem(item)}
                                className="flex-1 bg-orange-500 text-white px-3 py-2 rounded-lg text-sm font-medium">
                                Add to Bundle {assignBundle}
                              </button>
                              <button onClick={() => setAssigningItem(null)}
                                className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm">
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-700 text-sm">{item.name}</p>
                              <p className="text-orange-500 text-xs">{item.category}</p>
                              <p className="text-gray-400 text-xs">Stock: {item.quantity}</p>
                            </div>
                            {isAssigned ? (
                              <span className="text-xs bg-green-100 text-green-600 px-3 py-1 rounded-full">✅ Added</span>
                            ) : (
                              <button onClick={() => { setAssigningItem(item); setAssignQty(0); }}
                                className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1.5 rounded-xl">
                                + Add
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredMasterItems.length === 0 && (
                    <p className="text-gray-400 text-center py-4 text-sm">No items in master list yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DISPATCH TAB */}
        {activeTab === 'dispatch' && (
          <div>
            <button onClick={() => setShowAddDispatch(!showAddDispatch)}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mb-4">
              {showAddDispatch ? '✕ Cancel' : '+ Record Dispatch'}
            </button>

            {showAddDispatch && (
              <div className="bg-white rounded-2xl shadow p-4 mb-4">
                <h2 className="font-bold text-gray-700 mb-3">Record Dispatch</h2>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-gray-600 text-xs mb-1">No. of Bundles *</label>
                      <input type="number" placeholder="e.g. 5"
                        value={newDispatch.bundles || ''}
                        onChange={e => setNewDispatch({ ...newDispatch, bundles: Number(e.target.value) })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-gray-600 text-xs mb-1">Dispatch Date *</label>
                      <input type="date"
                        value={newDispatch.dispatchDate}
                        onChange={e => setNewDispatch({ ...newDispatch, dispatchDate: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-600 text-xs mb-1">Transport Mode</label>
                    <input type="text" placeholder="e.g. Rajdhani Express / By Road"
                      value={newDispatch.transportMode}
                      onChange={e => setNewDispatch({ ...newDispatch, transportMode: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-xs mb-1">Bilty Number</label>
                    <input type="text" placeholder="Railway receipt / tracking number"
                      value={newDispatch.biltyNumber}
                      onChange={e => setNewDispatch({ ...newDispatch, biltyNumber: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-xs mb-1">Notes</label>
                    <textarea placeholder="Any additional notes..."
                      value={newDispatch.notes}
                      onChange={e => setNewDispatch({ ...newDispatch, notes: e.target.value })}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  {dispatchMessage && <p className={`text-sm ${dispatchMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{dispatchMessage}</p>}
                  <button onClick={handleRecordDispatch} disabled={savingDispatch}
                    className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                    {savingDispatch ? 'Saving...' : 'Record Dispatch'}
                  </button>
                </div>
              </div>
            )}

            {/* Dispatch Records */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-bold text-gray-700 mb-3">Dispatch Records ({dispatches.length})</h2>
              {dispatches.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">🚚</div>
                  <p className="text-gray-400 text-sm">No dispatches recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dispatches.map((d: any) => (
                    <div key={d.id} className="bg-orange-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-gray-700">📦 {d.bundles} Bundles</p>
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">🚚 Dispatched</span>
                      </div>
                      <p className="text-gray-600 text-sm">📅 {new Date(d.dispatchDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      {d.transportMode && <p className="text-gray-600 text-sm">🚛 {d.transportMode}</p>}
                      {d.biltyNumber && <p className="text-gray-600 text-sm">🎫 Bilty: {d.biltyNumber}</p>}
                      {d.notes && <p className="text-gray-500 text-xs mt-1">📝 {d.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-bold text-gray-700 mb-3">
                Aayojak Requests ({requests.length})
              </h2>
              {requests.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-gray-400 text-sm">No approved requests yet</p>
                  <p className="text-gray-400 text-xs mt-1">Approved Aayojak requests will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((req: any) => (
                    <div key={req.id} className="border border-orange-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-700">{req.itemName}</p>
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">✅ Approved</span>
                      </div>
                      <p className="text-gray-500 text-sm">Qty: {req.quantity}</p>
                      {req.remarks && <p className="text-gray-400 text-xs mt-1">📝 {req.remarks}</p>}
                      {req.paymentRequired && (
                        <p className="text-orange-600 text-xs mt-1 font-medium">💰 Payment: ₹{req.amount}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RETURNS TAB */}
        {activeTab === ('returns' as any) && (
          <div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-bold text-gray-700 mb-3">
                Returns from Aayojak ({returnRecords.length})
              </h2>
              {returnRecords.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">🔄</div>
                  <p className="text-gray-400 text-sm">No returns yet</p>
                  <p className="text-gray-400 text-xs mt-1">When Aayojak sends samagri back it will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {returnRecords.map((r: any) => (
                    <div key={r.id} className="border border-orange-100 rounded-xl overflow-hidden">
                      <div className="bg-orange-50 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-gray-700">📦 {r.totalBundlesSent} Bundles</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${r.dispatchConfirmed ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                            {r.dispatchConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs">From: {r.sentByName} Ji</p>
                        {r.extraGiftBundles > 0 && (
                          <p className="text-gray-500 text-xs">
                            Includes {r.extraGiftBundles} extra gift bundle{r.extraGiftBundles > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      {r.biltyImageUrl ? (
                        <div className="px-3 py-2 border-t border-orange-100">
                          <a href={r.biltyImageUrl} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-500 underline">
                            📎 View Bilty Image
                          </a>
                        </div>
                      ) : null}
                      {!r.dispatchConfirmed && (
                        <div className="p-3 border-t border-orange-100">
                          {confirmingReturn === r.id ? (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-500">Confirm you received {r.totalBundlesSent} bundles from {r.sentByName} Ji?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmingReturn(null)}
                                  className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'samagriReturnToGurudham', r.id), {
                                        dispatchConfirmed: true,
                                      });
                                      setReturnRecords(prev => prev.map(rec =>
                                        rec.id === r.id ? { ...rec, dispatchConfirmed: true } : rec
                                      ));
                                      const { createNotificationForMany } = await import('@/lib/notifications');
                                      await createNotificationForMany({
                                        phones: [r.sentBy],
                                        title: '✅ Gurudham Received Samagri',
                                        body: `Dispatch team confirmed receipt of ${r.totalBundlesSent} bundles returned to Gurudham.`,
                                        type: 'samagri_gurudham_confirmed',
                                        shivirId,
                                      });
                                      setConfirmingReturn(null);
                                    } catch (e) {
                                      alert('Could not save. Please try again.');
                                    }
                                  }}
                                  className="flex-1 bg-green-500 text-white font-bold py-2 rounded-xl text-sm">
                                  Yes, Confirm
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmingReturn(r.id)}
                              className="w-full bg-green-500 text-white font-bold py-2 rounded-xl text-sm">
                              ✅ Confirm Receipt
                            </button>
                          )}
                        </div>
                      )}
                      {r.dispatchConfirmed && (
                        <div className="bg-green-50 px-3 py-2 border-t border-green-100">
                          <p className="text-green-700 text-xs font-semibold">✅ Receipt confirmed by Dispatch team</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}