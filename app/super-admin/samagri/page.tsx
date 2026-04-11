'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  getSamagriCategories, getSamagriItems, addSamagriCategory,
  addSamagriItem, updateSamagriItemPrice, updateSamagriItemQuantity,
  deleteSamagriItem, updateOrganiserRequest,
} from '@/lib/samagri';
import { createNotification } from '@/lib/notifications';

interface Category { id: string; name: string; }
interface Item { id: string; category: string; name: string; quantity: number; price: number; }

export default function SamagriMasterPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'master' | 'requests'>('master');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ category: '', name: '', quantity: 0, price: 0 });
  const [addingItem, setAddingItem] = useState(false);

  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(0);

  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalData, setApprovalData] = useState({ paymentRequired: false, amount: 0, rejectReason: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [cats, itms] = await Promise.all([getSamagriCategories(), getSamagriItems()]);
    setCategories(cats as Category[]);
    setItems(itms as Item[]);
    setLoading(false);
  }

  async function loadRequests() {
    setLoadingRequests(true);
    const snap = await getDocs(collection(db, 'organiserSamagriRequests'));
    const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const shivirIds = [...new Set(reqs.map((r: any) => r.shivirId))];
    const shivirMap: { [key: string]: string } = {};
    for (const sid of shivirIds) {
      const sSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
      if (!sSnap.empty) shivirMap[sid as string] = sSnap.docs[0].data().name;
    }
    setRequests(reqs.map((r: any) => ({ ...r, shivirName: shivirMap[r.shivirId] || r.shivirId })));
    setLoadingRequests(false);
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    await addSamagriCategory(newCategoryName.trim());
    setNewCategoryName('');
    setAddingCategory(false);
    loadData();
  }

  async function handleAddItem() {
    if (!newItem.name || !newItem.category) return;
    setAddingItem(true);
    await addSamagriItem(newItem);
    setNewItem({ category: '', name: '', quantity: 0, price: 0 });
    setShowAddItem(false);
    setAddingItem(false);
    loadData();
  }

  async function handleSaveEdit(itemId: string) {
    await Promise.all([updateSamagriItemPrice(itemId, editPrice), updateSamagriItemQuantity(itemId, editQuantity)]);
    setEditingItem(null);
    loadData();
  }

  async function handleDelete(itemId: string) {
    if (!confirm('Delete this item?')) return;
    await deleteSamagriItem(itemId);
    loadData();
  }

  async function handleApprove(requestId: string) {
    await updateOrganiserRequest(requestId, {
      status: 'approved',
      paymentRequired: approvalData.paymentRequired,
      amount: approvalData.paymentRequired ? approvalData.amount : 0,
    });
    try {
      const req = requests.find((r: any) => r.id === requestId);
      if (req?.requestedBy) {
        await createNotification({
          userPhone: req.requestedBy,
          title: '✅ Samagri Request Approved',
          body: approvalData.paymentRequired
            ? `Your request for ${req.itemName} approved. Payment of ₹${approvalData.amount} required.`
            : `Your request for ${req.itemName} has been approved.`,
          type: 'samagri_approved',
          shivirId: req.shivirId,
        });
      }
    } catch (e) {}
    setApprovingId(null);
    setApprovalData({ paymentRequired: false, amount: 0, rejectReason: '' });
    loadRequests();
  }

  async function handleReject(requestId: string) {
    await updateOrganiserRequest(requestId, {
      status: 'rejected',
      rejectRemark: approvalData.rejectReason,
    });
    try {
      const req = requests.find((r: any) => r.id === requestId);
      if (req?.requestedBy) {
        await createNotification({
          userPhone: req.requestedBy,
          title: '❌ Samagri Request Rejected',
          body: `Your request for ${req.itemName} has been rejected. Please contact Super Admin.`,
          type: 'samagri_rejected',
          shivirId: req.shivirId,
        });
      }
    } catch (e) {}
    setApprovingId(null);
    setApprovalData({ paymentRequired: false, amount: 0, rejectReason: '' });
    loadRequests();
  }

  async function handleEditApproved(requestId: string) {
    await updateOrganiserRequest(requestId, {
      status: 'approved',
      paymentRequired: approvalData.paymentRequired,
      amount: approvalData.paymentRequired ? approvalData.amount : 0,
    });
    try {
      const req = requests.find((r: any) => r.id === requestId);
      if (req?.requestedBy) {
        await createNotification({
          userPhone: req.requestedBy,
          title: '💰 Samagri Payment Details Updated',
          body: approvalData.paymentRequired
            ? `Payment for ${req.itemName} updated to ₹${approvalData.amount}.`
            : `Payment requirement removed for ${req.itemName}.`,
          type: 'samagri_updated',
          shivirId: req.shivirId,
        });
      }
    } catch (e) {}
    setApprovingId(null);
    setApprovalData({ paymentRequired: false, amount: 0, rejectReason: '' });
    loadRequests();
  }

  async function handleRejectApproved(requestId: string) {
    await updateOrganiserRequest(requestId, {
      status: 'rejected',
      rejectRemark: approvalData.rejectReason,
    });
    try {
      const req = requests.find((r: any) => r.id === requestId);
      if (req?.requestedBy) {
        await createNotification({
          userPhone: req.requestedBy,
          title: '❌ Samagri Request Rejected',
          body: `Your approved request for ${req.itemName} has been rejected. Reason: ${approvalData.rejectReason}`,
          type: 'samagri_rejected',
          shivirId: req.shivirId,
        });
      }
    } catch (e) {}
    setApprovingId(null);
    setApprovalData({ paymentRequired: false, amount: 0, rejectReason: '' });
    loadRequests();
  }

  const filteredItems = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory);
  const pendingRequests = requests.filter((r: any) => r.status === 'pending');

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <p className="text-orange-600 font-medium">Loading Samagri List...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-orange-600 font-bold text-xl">←</button>
          <div>
            <h1 className="text-xl font-bold text-orange-700">Samagri Management</h1>
            <p className="text-sm text-gray-500">{items.length} items · {categories.length} categories</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('master')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'master' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            📦 Master List
          </button>
          <button onClick={() => { setActiveTab('requests'); loadRequests(); }}
            className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'requests' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            🛒 Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </button>
        </div>

        {/* MASTER LIST TAB */}
        {activeTab === 'master' && (
          <div>
            <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-3">Add New Category</h2>
              <div className="flex gap-2">
                <input type="text" placeholder="Category name (e.g., Mala)"
                  value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                <button onClick={handleAddCategory} disabled={addingCategory}
                  className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
                  {addingCategory ? '...' : 'Add'}
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              <button onClick={() => setActiveCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'}`}>
                All ({items.length})
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.name)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeCategory === cat.name ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'}`}>
                  {cat.name} ({items.filter(i => i.category === cat.name).length})
                </button>
              ))}
            </div>

            <button onClick={() => setShowAddItem(!showAddItem)}
              className="w-full bg-orange-100 border-2 border-dashed border-orange-300 text-orange-600 font-medium py-3 rounded-2xl mb-4">
              + Add New Item
            </button>

            {showAddItem && (
              <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                <h2 className="font-semibold text-gray-700 mb-3">New Item Details</h2>
                <div className="space-y-3">
                  <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                  </select>
                  <input type="text" placeholder="Item name (e.g., Red Hakik Mala)"
                    value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Quantity" value={newItem.quantity || ''}
                      onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                    <input type="number" placeholder="Price ₹" value={newItem.price || ''}
                      onChange={e => setNewItem({ ...newItem, price: Number(e.target.value) })}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <button onClick={handleAddItem} disabled={addingItem}
                    className="w-full bg-orange-500 text-white py-2 rounded-xl font-medium">
                    {addingItem ? 'Adding...' : 'Save Item'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                  No items yet. Add your first item above.
                </div>
              ) : (
                filteredItems.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    {editingItem === item.id ? (
                      <div className="space-y-2">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-orange-500">{item.category}</p>
                        <div className="flex gap-2">
                          <input type="number" value={editQuantity} onChange={e => setEditQuantity(Number(e.target.value))}
                            placeholder="Quantity" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                          <input type="number" value={editPrice} onChange={e => setEditPrice(Number(e.target.value))}
                            placeholder="Price ₹" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(item.id)}
                            className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-medium">Save</button>
                          <button onClick={() => setEditingItem(null)}
                            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{item.name}</p>
                          <p className="text-xs text-orange-500">{item.category}</p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-xs text-gray-500">Qty: <span className="font-medium text-gray-700">{item.quantity}</span></span>
                            <span className="text-xs text-gray-500">₹<span className="font-medium text-gray-700">{item.price}</span></span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingItem(item.id); setEditPrice(item.price); setEditQuantity(item.quantity); }}
                            className="bg-orange-100 text-orange-600 px-3 py-1.5 rounded-xl text-xs font-medium">Edit</button>
                          <button onClick={() => handleDelete(item.id)}
                            className="bg-red-50 text-red-500 px-3 py-1.5 rounded-xl text-xs font-medium">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div>
            {loadingRequests ? (
              <div className="text-center py-8 text-orange-500">Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <div className="text-4xl mb-2">🛒</div>
                <p className="text-gray-400">No requests yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req: any) => (
                  <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm">

                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-700">{req.itemName}</p>
                        <p className="text-gray-500 text-sm">Qty: {req.quantity}</p>
                        <p className="text-orange-500 text-xs mt-0.5">📍 {req.shivirName}</p>
                        {req.remarks && <p className="text-gray-400 text-xs mt-1">📝 {req.remarks}</p>}
                        {req.requestedByName && <p className="text-gray-400 text-xs">By: {req.requestedByName}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        req.status === 'approved' ? 'bg-green-100 text-green-600' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-500' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {req.status === 'approved' ? '✅ Approved' :
                         req.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                      </span>
                    </div>

                    {req.status === 'approved' && req.paymentRequired && (
                      <div className="mt-1 bg-green-50 rounded-lg p-2 mb-2">
                        <p className="text-green-600 text-xs font-medium">💰 Payment: ₹{req.amount}</p>
                      </div>
                    )}

                    {req.status === 'rejected' && req.rejectRemark && (
                      <div className="mt-1 bg-red-50 rounded-lg p-2 mb-2">
                        <p className="text-red-500 text-xs font-medium">Reason: {req.rejectRemark}</p>
                      </div>
                    )}

                    {/* PENDING */}
                    {req.status === 'pending' && (
                      <div>
                        {approvingId === req.id ? (
                          <div className="bg-orange-50 rounded-xl p-3 space-y-2 mt-2">
                            <p className="text-gray-700 text-sm font-medium">Approval Details</p>
                            <div className="flex items-center gap-2">
                              <input type="checkbox"
                                checked={approvalData.paymentRequired}
                                onChange={e => setApprovalData({ ...approvalData, paymentRequired: e.target.checked })}
                                className="w-4 h-4" />
                              <label className="text-sm text-gray-700">Payment Required</label>
                            </div>
                            {approvalData.paymentRequired && (
                              <input type="number" placeholder="Amount ₹"
                                value={approvalData.amount || ''}
                                onChange={e => setApprovalData({ ...approvalData, amount: Number(e.target.value) })}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                            )}
                            <p className="text-gray-700 text-sm font-medium mt-2">Reject Reason (if rejecting)</p>
                            <input type="text" placeholder="Enter reason for rejection..."
                              value={approvalData.rejectReason}
                              onChange={e => setApprovalData({ ...approvalData, rejectReason: e.target.value })}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(req.id)}
                                className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-medium">
                                ✅ Approve
                              </button>
                              <button onClick={() => {
                                if (!approvalData.rejectReason.trim()) {
                                  alert('Please enter a reason for rejection');
                                  return;
                                }
                                handleReject(req.id);
                              }}
                                className="flex-1 bg-red-50 text-red-500 py-2 rounded-xl text-sm font-medium">
                                ❌ Reject
                              </button>
                              <button onClick={() => setApprovingId(null)}
                                className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm">✕</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setApprovingId(req.id); setApprovalData({ paymentRequired: false, amount: 0, rejectReason: '' }); }}
                            className="w-full mt-2 bg-orange-100 text-orange-600 font-medium py-2 rounded-xl text-sm">
                            Review Request →
                          </button>
                        )}
                      </div>
                    )}

                    {/* APPROVED */}
                    {req.status === 'approved' && (
                      <div>
                        {approvingId === req.id ? (
                          <div className="bg-orange-50 rounded-xl p-3 space-y-2 mt-2">
                            <p className="text-gray-700 text-sm font-medium">Edit Approved Request</p>
                            <div className="flex items-center gap-2">
                              <input type="checkbox"
                                checked={approvalData.paymentRequired}
                                onChange={e => setApprovalData({ ...approvalData, paymentRequired: e.target.checked })}
                                className="w-4 h-4" />
                              <label className="text-sm text-gray-700">Payment Required</label>
                            </div>
                            {approvalData.paymentRequired && (
                              <input type="number" placeholder="Amount ₹"
                                value={approvalData.amount || ''}
                                onChange={e => setApprovalData({ ...approvalData, amount: Number(e.target.value) })}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                            )}
                            <p className="text-gray-700 text-sm font-medium mt-2">Reject Reason (if rejecting) *</p>
                            <input type="text" placeholder="Compulsory if rejecting..."
                              value={approvalData.rejectReason}
                              onChange={e => setApprovalData({ ...approvalData, rejectReason: e.target.value })}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                            <div className="flex gap-2">
                              <button onClick={() => handleEditApproved(req.id)}
                                className="flex-1 bg-blue-500 text-white py-2 rounded-xl text-sm font-medium">
                                💾 Save Changes
                              </button>
                              <button onClick={() => {
                                if (!approvalData.rejectReason.trim()) {
                                  alert('Please enter a reason for rejection');
                                  return;
                                }
                                handleRejectApproved(req.id);
                              }}
                                className="flex-1 bg-red-50 text-red-500 py-2 rounded-xl text-sm font-medium">
                                ❌ Reject
                              </button>
                              <button onClick={() => setApprovingId(null)}
                                className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm">✕</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => {
                            setApprovingId(req.id);
                            setApprovalData({
                              paymentRequired: req.paymentRequired || false,
                              amount: req.amount || 0,
                              rejectReason: ''
                            });
                          }}
                            className="w-full mt-2 bg-blue-50 text-blue-600 font-medium py-2 rounded-xl text-sm">
                            ✏️ Edit / Reject →
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}