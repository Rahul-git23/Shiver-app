'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatShivirDates, formatShivirLocation } from '@/lib/utils';
import {
  addOrganiserSamagriRequest,
  getOrganiserSamagriRequests,
  updateOrganiserSamagriRequest,
  cancelOrganiserSamagriRequest,
} from '@/lib/samagri';
import { createNotificationForMany } from '@/lib/notifications';

export default function SamagriRequestPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [allAayojak, setAllAayojak] = useState<any[]>([]);

  const [newRequest, setNewRequest] = useState({
    itemName: '', quantity: 0, remarks: '',
  });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ itemName: '', quantity: 0, remarks: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState('');

  // Cancel state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelRemark, setCancelRemark] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      const user = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      setUserData(user);

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

          // Load all Aayojak for this Shivir
          const allOrgQ = query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivirId));
          const allOrgSnap = await getDocs(allOrgQ);
          setAllAayojak(allOrgSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          const reqs = await getOrganiserSamagriRequests(shivirId);
          setRequests(reqs as any[]);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const reloadRequests = async () => {
    if (!shivir) return;
    const reqs = await getOrganiserSamagriRequests(shivir.id);
    setRequests(reqs as any[]);
  };

  const notifyAllAayojak = async (title: string, body: string) => {
    try {
      const phones = allAayojak
        .map(o => o.phone)
        .filter(p => p !== userData.phone);
      if (phones.length > 0) {
        await createNotificationForMany({
          phones,
          title,
          body,
          type: 'samagri_request',
          shivirId: shivir.id,
        });
      }
    } catch (e) {}
  };

  const handleSubmitRequest = async () => {
    setMessage('');
    if (!newRequest.itemName.trim()) { setMessage('Please enter item name'); return; }
    if (newRequest.quantity <= 0) { setMessage('Please enter valid quantity'); return; }
    setSaving(true);
    try {
      await addOrganiserSamagriRequest({
        shivirId: shivir.id,
        requestedBy: userData.phone,
        requestedByName: userData.name,
        itemName: newRequest.itemName.trim(),
        quantity: newRequest.quantity,
        remarks: newRequest.remarks.trim(),
      });
      await notifyAllAayojak(
        '🛒 New Samagri Request',
        `${userData.name} requested: ${newRequest.itemName.trim()} (Qty: ${newRequest.quantity})`
      );
      setMessage('✅ Request submitted!');
      setNewRequest({ itemName: '', quantity: 0, remarks: '' });
      setShowAddForm(false);
      await reloadRequests();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setSaving(false);
  };

  const openEdit = (req: any) => {
    setEditingId(req.id);
    setEditData({ itemName: req.itemName, quantity: req.quantity, remarks: req.remarks || '' });
    setEditMessage('');
  };

  const handleSubmitUpdate = async (req: any) => {
    setEditMessage('');
    if (!editData.itemName.trim()) { setEditMessage('Please enter item name'); return; }
    if (editData.quantity <= 0) { setEditMessage('Please enter valid quantity'); return; }
    setEditSaving(true);
    try {
      await updateOrganiserSamagriRequest(req.id, {
        itemName: editData.itemName.trim(),
        quantity: editData.quantity,
        remarks: editData.remarks.trim(),
        updatedBy: userData.phone,
        updatedByName: userData.name,
        status: req.status === 'rejected' ? 'pending' : req.status,
      });
      await notifyAllAayojak(
        '✏️ Samagri Request Updated',
        `${userData.name} updated request: ${editData.itemName.trim()} (Qty: ${editData.quantity})`
      );
      setEditingId(null);
      await reloadRequests();
    } catch (err: any) {
      setEditMessage('Error: ' + err.message);
    }
    setEditSaving(false);
  };

  const handleSuggest = async (req: any) => {
    setEditMessage('');
    if (!editData.itemName.trim()) { setEditMessage('Please enter item name'); return; }
    if (editData.quantity <= 0) { setEditMessage('Please enter valid quantity'); return; }
    setEditSaving(true);
    try {
      await createNotificationForMany({
        phones: [req.requestedBy],
        title: '💡 Suggestion on Your Request',
        body: `${userData.name} suggests: ${editData.itemName.trim()}, Qty: ${editData.quantity}${editData.remarks ? ', Note: ' + editData.remarks : ''}`,
        type: 'samagri_suggestion',
        shivirId: shivir.id,
      });
      setEditMessage('✅ Suggestion sent to ' + req.requestedByName + '!');
      setTimeout(() => { setEditingId(null); setEditMessage(''); }, 1500);
    } catch (err: any) {
      setEditMessage('Error: ' + err.message);
    }
    setEditSaving(false);
  };

  const handleCancel = async (req: any) => {
    if (!cancelRemark.trim()) return;
    setCancelSaving(true);
    try {
      await cancelOrganiserSamagriRequest(
        req.id,
        userData.phone,
        userData.name,
        cancelRemark.trim(),
      );
      await notifyAllAayojak(
        '🚫 Samagri Request Cancelled',
        `${userData.name} cancelled request: ${req.itemName}. Reason: ${cancelRemark.trim()}`
      );
      setCancellingId(null);
      setCancelRemark('');
      await reloadRequests();
    } catch (err: any) {}
    setCancelSaving(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-600';
    if (status === 'rejected') return 'bg-red-100 text-red-500';
    if (status === 'cancelled') return 'bg-gray-200 text-gray-500';
    return 'bg-yellow-100 text-yellow-600';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'approved') return '✅ Approved';
    if (status === 'rejected') return '❌ Rejected';
    if (status === 'cancelled') return '🚫 Cancelled';
    return '⏳ Pending';
  };

  const isMyRequest = (req: any) => req.requestedBy === userData?.phone;

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
              <h1 className="text-lg font-bold text-orange-600">🛒 Samagri Request</h1>
              <p className="text-gray-500 text-xs">
                {shivir?.name} · <span className="font-bold text-orange-500">{formatShivirLocation(shivir?.city, shivir?.state)}</span>
              </p>
              <p className="text-gray-400 text-xs">{formatShivirDates(shivir?.startDate, shivir?.endDate)}</p>
            </div>
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
            {showAddForm ? '✕' : '+ New'}
          </button>
        </div>

        {/* Add Request Form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl shadow p-4 mb-4">
            <h2 className="font-bold text-gray-700 mb-3">New Samagri Request</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-600 text-xs mb-1">Item Name *</label>
                <input type="text"
                  placeholder="e.g. Magazines for Gyan Dan"
                  value={newRequest.itemName}
                  onChange={e => setNewRequest({ ...newRequest, itemName: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-gray-600 text-xs mb-1">Quantity *</label>
                <input type="number" placeholder="e.g. 500"
                  value={newRequest.quantity || ''}
                  onChange={e => setNewRequest({ ...newRequest, quantity: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-gray-600 text-xs mb-1">Remarks</label>
                <textarea placeholder="e.g. For Gyan Dan distribution"
                  value={newRequest.remarks}
                  onChange={e => setNewRequest({ ...newRequest, remarks: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              {message && (
                <p className={`text-sm ${message.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{message}</p>
              )}
              <button onClick={handleSubmitRequest} disabled={saving}
                className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}

        {/* Requests List */}
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-bold text-gray-700 mb-3">
            All Requests ({requests.length})
          </h2>
          {requests.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🛒</div>
              <p className="text-gray-400">No requests yet</p>
              <p className="text-gray-400 text-sm mt-1">Tap "+ New" to request Samagri</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req: any) => (
                <div key={req.id} className={`border rounded-xl p-3 ${req.status === 'cancelled' ? 'border-gray-200 opacity-70' : 'border-orange-100'}`}>

                  {/* Request Info */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-700">{req.itemName}</p>
                      <p className="text-gray-500 text-sm">Qty: {req.quantity}</p>
                      <p className="text-orange-500 text-xs mt-0.5">
                        By: {req.requestedByName || req.requestedBy}
                        {isMyRequest(req) && <span className="text-gray-400"> (You)</span>}
                      </p>
                      {req.remarks && <p className="text-gray-400 text-xs mt-1">📝 {req.remarks}</p>}
                      {req.updatedByName && (
                        <p className="text-gray-300 text-xs mt-0.5">✏️ Updated by {req.updatedByName}</p>
                      )}
                      {req.status === 'approved' && req.paymentRequired && (
                        <div className="mt-2 bg-orange-50 rounded-lg p-2">
                          <p className="text-orange-600 text-xs font-medium">💰 Payment: ₹{req.amount}</p>
                        </div>
                      )}
                      {req.status === 'rejected' && req.rejectRemark && (
                        <p className="text-red-400 text-xs mt-1">Reason: {req.rejectRemark}</p>
                      )}
                      {req.status === 'cancelled' && req.cancelRemark && (
                        <p className="text-gray-400 text-xs mt-1">Cancelled: {req.cancelRemark}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 ${getStatusColor(req.status)}`}>
                      {getStatusLabel(req.status)}
                    </span>
                  </div>

                  {/* Edit Section — Pending or Rejected */}
                  {(req.status === 'pending' || req.status === 'rejected') && (
                    <div>
                      {editingId === req.id ? (
                        <div className="bg-orange-50 rounded-xl p-3 space-y-2 mt-2">
                          <p className="text-gray-700 text-sm font-medium">
                            {isMyRequest(req) ? '✏️ Edit Request' : `💡 Suggest to ${req.requestedByName}`}
                          </p>
                          <input type="text" placeholder="Item name"
                            value={editData.itemName}
                            onChange={e => setEditData({ ...editData, itemName: e.target.value })}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                          <input type="number" placeholder="Quantity"
                            value={editData.quantity || ''}
                            onChange={e => setEditData({ ...editData, quantity: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                          <textarea placeholder="Remarks"
                            value={editData.remarks}
                            onChange={e => setEditData({ ...editData, remarks: e.target.value })}
                            rows={2}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                          {editMessage && (
                            <p className={`text-xs ${editMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{editMessage}</p>
                          )}
                          <div className="flex gap-2">
                            {isMyRequest(req) ? (
                              <button onClick={() => handleSubmitUpdate(req)} disabled={editSaving}
                                className="flex-1 bg-orange-500 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                                {editSaving ? 'Saving...' : req.status === 'rejected' ? '🔄 Resubmit' : '💾 Submit Update'}
                              </button>
                            ) : (
                              <button onClick={() => handleSuggest(req)} disabled={editSaving}
                                className="flex-1 bg-blue-500 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                                {editSaving ? 'Sending...' : `💡 Suggest to ${req.requestedByName}`}
                              </button>
                            )}
                            <button onClick={() => { setEditingId(null); setEditMessage(''); }}
                              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm">✕</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openEdit(req)}
                          className="w-full mt-1 bg-orange-50 text-orange-600 font-medium py-2 rounded-xl text-sm">
                          {isMyRequest(req) ? '✏️ Edit Request' : `💡 Suggest to ${req.requestedByName}`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cancel Section — Approved only, own request only */}
                  {req.status === 'approved' && isMyRequest(req) && (
                    <div>
                      {cancellingId === req.id ? (
                        <div className="bg-red-50 rounded-xl p-3 space-y-2 mt-2">
                          <p className="text-gray-700 text-sm font-medium">🚫 Cancel Request</p>
                          <textarea placeholder="Reason for cancellation (required)..."
                            value={cancelRemark}
                            onChange={e => setCancelRemark(e.target.value)}
                            rows={2}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                          <div className="flex gap-2">
                            <button onClick={() => handleCancel(req)} disabled={cancelSaving || !cancelRemark.trim()}
                              className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                              {cancelSaving ? 'Cancelling...' : '🚫 Confirm Cancel'}
                            </button>
                            <button onClick={() => { setCancellingId(null); setCancelRemark(''); }}
                              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-sm">✕</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setCancellingId(req.id)}
                          className="w-full mt-1 bg-red-50 text-red-500 font-medium py-2 rounded-xl text-sm">
                          🚫 Cancel Request
                        </button>
                      )}
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