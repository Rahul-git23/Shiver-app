'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
import { createSettlement, getShivirSettlements, confirmSettlementReceived } from '@/lib/settlements';
import { createNotificationForMany } from '@/lib/notifications';

export default function SettlementSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [shivir, setShivir] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [organisers, setOrganisers] = useState<any[]>([]);

  // Form state
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [settlementMessage, setSettlementMessage] = useState('');
  const [newSettlement, setNewSettlement] = useState({
    amount: 0, bankName: '', accountNo: '', ifsc: '',
    upiId: '', contactName: '', contactPhone: '', deadline: '', note: '',
  });

  // Edit state
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [editSettlement, setEditSettlement] = useState({ contactName: '', contactPhone: '', upiId: '', bankName: '', accountHolder: '', accountNo: '', ifsc: '', deadline: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('viewer') === 'admin') setIsAdminViewer(true);
      setCurrentUser(user);
      await loadData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

  const loadData = async () => {
    const shivirDoc = await getDoc(doc(db, 'shivirs', shivirId));
    if (shivirDoc.exists()) setShivir({ id: shivirDoc.id, ...shivirDoc.data() });

    const colSnap = await getDocs(query(collection(db, 'contributions'), where('shivirId', '==', shivirId)));
    setCollections(colSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const expSnap = await getDocs(query(collection(db, 'expenses'), where('shivirId', '==', shivirId)));
    setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivirId)));
    setOrganisers(orgSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const settlementsData = await getShivirSettlements(shivirId);
    setSettlements(settlementsData as any[]);
  };

  // Computed values
  const activeCollections = collections.filter(c => c.status !== 'cancelled' && c.status !== 'refunded');
  const totalCollections = activeCollections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.estimatedAmount) || 0), 0);
  const balance = totalCollections - totalExpenses;
  const totalSettled = settlements.filter(s => s.status === 'confirmed').reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalPending = settlements.filter(s => s.status === 'pending' || s.status === 'sent').reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const remainingToSettle = balance - totalSettled - totalPending;

  const handleCreateSettlement = async () => {
    setSettlementMessage('');
    if (newSettlement.amount <= 0) { setSettlementMessage('Please enter amount'); return; }
    if (!newSettlement.contactName.trim()) { setSettlementMessage('Please enter contact name'); return; }
    if (!newSettlement.contactPhone.trim()) { setSettlementMessage('Please enter contact phone'); return; }
    if (!newSettlement.deadline) { setSettlementMessage('Please select deadline'); return; }
    if (!newSettlement.upiId.trim() && !newSettlement.accountNo.trim()) {
      setSettlementMessage('Please enter UPI ID or Bank Account details'); return;
    }
    setSavingSettlement(true);
    try {
      const settlementNumber = settlements.length + 1;
      await createSettlement({
        shivirId, shivirName: shivir.name, settlementNumber,
        amount: newSettlement.amount, bankName: newSettlement.bankName,
        accountNo: newSettlement.accountNo, ifsc: newSettlement.ifsc,
        upiId: newSettlement.upiId, contactName: newSettlement.contactName,
        contactPhone: newSettlement.contactPhone, deadline: newSettlement.deadline,
        note: newSettlement.note, initiatedBy: currentUser.phoneNumber,
        initiatedByName: 'Super Admin',
      });
      try {
        const orgPhones = organisers.map(o => o.phone);
        if (orgPhones.length > 0) {
          await createNotificationForMany({
            phones: orgPhones,
            title: '💰 Settlement Initiated',
            body: `Please send ₹${newSettlement.amount.toLocaleString()} to Gurudham by ${newSettlement.deadline}. Contact: ${newSettlement.contactName} Ji`,
            type: 'settlement_initiated', shivirId,
          });
        }
      } catch (e) {}
      setSettlementMessage('✅ Settlement initiated successfully!');
      setNewSettlement({ amount: 0, bankName: '', accountNo: '', ifsc: '', upiId: '', contactName: '', contactPhone: '', deadline: '', note: '' });
      setShowSettlementForm(false);
      const updated = await getShivirSettlements(shivirId);
      setSettlements(updated as any[]);
    } catch (err: any) {
      setSettlementMessage('Error: ' + err.message);
    }
    setSavingSettlement(false);
  };

  const openEditSettlement = (s: any) => {
    setEditingSettlementId(s.id);
    setEditSettlement({
      contactName: s.contactName || '', contactPhone: s.contactPhone || '',
      upiId: s.upiId || '', bankName: s.bankName || '', accountHolder: s.accountHolder || '',
      accountNo: s.accountNo || '', ifsc: s.ifsc || '', deadline: s.deadline || '',
    });
  };

  const saveEditSettlement = async (s: any) => {
    setSavingEdit(true);
    try {
      const changes: string[] = [];
      if (editSettlement.contactName !== s.contactName) changes.push('Contact name');
      if (editSettlement.contactPhone !== s.contactPhone) changes.push('Contact phone');
      if (editSettlement.upiId !== s.upiId) changes.push('UPI ID');
      if (editSettlement.bankName !== s.bankName) changes.push('Bank name');
      if (editSettlement.accountNo !== s.accountNo) changes.push('Account number');
      if (editSettlement.ifsc !== s.ifsc) changes.push('IFSC');
      if (editSettlement.deadline !== s.deadline) changes.push('Deadline');
      await updateDoc(doc(db, 'settlements', s.id), {
        ...editSettlement, lastEditedAt: new Date(), lastEditedChanges: changes.join(', '),
      });
      const phones = organisers.map(d => d.phone);
      await createNotificationForMany({
        phones, title: '✏️ Settlement Updated',
        body: `Settlement #${s.settlementNumber} has been updated. ${changes.join(', ')} changed.`,
        type: 'settlement_edited', shivirId,
      });
      const updated = await getShivirSettlements(shivirId);
      setSettlements(updated as any[]);
      setEditingSettlementId(null);
    } catch (err: any) { alert('Error: ' + err.message); }
    setSavingEdit(false);
  };

  const handleConfirmReceived = async (settlementId: string) => {
    if (!confirm('Confirm that payment has been received?')) return;
    await confirmSettlementReceived(settlementId, 'Super Admin');
    const updated = await getShivirSettlements(shivirId);
    setSettlements(updated as any[]);
  };

  const handlePauseResume = async (s: any) => {
    const isPaused = s.status === 'paused';
    const newStatus = isPaused ? 'pending' : 'paused';
    if (!confirm(isPaused ? 'Resume this settlement?' : 'Pause this settlement?')) return;
    try {
      await updateDoc(doc(db, 'settlements', s.id), { status: newStatus });
      const phones = organisers.map(d => d.phone);
      await createNotificationForMany({
        phones,
        title: isPaused ? '▶️ Settlement Resumed' : '⏸ Settlement Paused',
        body: isPaused ? `Settlement #${s.settlementNumber} has been resumed.` : `Settlement #${s.settlementNumber} is on hold.`,
        type: 'settlement_paused', shivirId,
      });
      const updated = await getShivirSettlements(shivirId);
      setSettlements(updated as any[]);
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const getStatusColor = (status: string) => {
    if (status === 'confirmed') return 'bg-green-100 text-green-600';
    if (status === 'sent') return 'bg-blue-100 text-blue-600';
    if (status === 'paused') return 'bg-gray-100 text-gray-500';
    return 'bg-yellow-100 text-yellow-600';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'confirmed') return '✅ Confirmed';
    if (status === 'sent') return '🕐 Sent';
    if (status === 'paused') return '⏸ Paused';
    return '⏳ Pending';
  };

  const goBack = () => {
    const adminQuery = isAdminViewer ? '?viewer=admin' : '';
    window.location.href = `/super-admin/shivir/${shivirId}${adminQuery}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-4xl mx-auto">

        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={goBack} className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🏦 Settlement</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
        </div>

        {/* Balance Summary */}
        <div className={`rounded-2xl shadow p-4 mb-4 ${balance < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <h3 className="font-bold text-gray-700 mb-3">💰 Settlement Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Collections</span>
              <span className="font-bold text-green-600">₹{totalCollections.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Expenses</span>
              <span className="font-bold text-red-500">₹{totalExpenses.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="font-bold text-gray-700">Balance</span>
              <span className={`font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>₹{balance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Settled</span>
              <span className="font-bold text-green-600">₹{totalSettled.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Remaining to Settle</span>
              <span className={`font-bold ${balance - totalSettled >= 0 ? 'text-orange-600' : 'text-red-500'}`}>₹{(balance - totalSettled).toLocaleString()}</span>
            </div>
          </div>
          {balance < 0 && (
            <div className="mt-3 bg-red-100 rounded-xl p-3">
              <p className="text-red-600 text-sm font-medium">⚠️ Deficit Alert</p>
              <p className="text-red-500 text-xs mt-1">Collections are ₹{Math.abs(balance).toLocaleString()} less than expenses.</p>
            </div>
          )}
        </div>

        {/* Initiate Button */}
        {remainingToSettle <= 0 ? (
          <div className="bg-green-50 rounded-xl p-3 text-center mb-4">
            <p className="text-green-600 text-sm font-medium">✅ All settlements have been initiated</p>
          </div>
        ) : (
          !isAdminViewer && (
            <button onClick={() => setShowSettlementForm(!showSettlementForm)}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mb-4">
              {showSettlementForm ? '✕ Cancel' : '+ Initiate New Settlement'}
            </button>
          )
        )}

        {/* Settlement Form */}
        {showSettlementForm && (
          <div className="bg-white rounded-2xl shadow p-4 mb-4">
            <h3 className="font-bold text-gray-700 mb-4">New Settlement #{settlements.length + 1}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-600 text-xs mb-1">Amount to Settle *</label>
                <input type="number" placeholder="₹ Amount" value={newSettlement.amount || ''}
                  onChange={e => setNewSettlement({ ...newSettlement, amount: Number(e.target.value) })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                {balance > 0 && (
                  <button onClick={() => setNewSettlement({ ...newSettlement, amount: remainingToSettle > 0 ? remainingToSettle : 0 })}
                    className="text-xs text-orange-500 mt-1">Use remaining balance ₹{(balance - totalSettled).toLocaleString()}</button>
                )}
              </div>
              <div className="border-t pt-3">
                <p className="text-gray-600 text-xs font-medium mb-2">Gurudham Payment Details</p>
                <div className="space-y-2">
                  <input type="text" placeholder="UPI ID (e.g. gurudham@upi)" value={newSettlement.upiId}
                    onChange={e => setNewSettlement({ ...newSettlement, upiId: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  <input type="text" placeholder="Bank Name" value={newSettlement.bankName}
                    onChange={e => setNewSettlement({ ...newSettlement, bankName: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  <input type="text" placeholder="Account Number" value={newSettlement.accountNo}
                    onChange={e => setNewSettlement({ ...newSettlement, accountNo: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  <input type="text" placeholder="IFSC Code" value={newSettlement.ifsc}
                    onChange={e => setNewSettlement({ ...newSettlement, ifsc: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-gray-600 text-xs font-medium mb-2">Contact Person</p>
                <div className="space-y-2">
                  <input type="text" placeholder="Contact Name *" value={newSettlement.contactName}
                    onChange={e => setNewSettlement({ ...newSettlement, contactName: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  <input type="tel" placeholder="Contact Phone *" value={newSettlement.contactPhone}
                    onChange={e => setNewSettlement({ ...newSettlement, contactPhone: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-gray-600 text-xs mb-1">Deadline *</label>
                <input type="date" value={newSettlement.deadline}
                  onChange={e => setNewSettlement({ ...newSettlement, deadline: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-gray-600 text-xs mb-1">Note (Optional)</label>
                <textarea placeholder="Any instructions for Aayojak..." value={newSettlement.note}
                  onChange={e => setNewSettlement({ ...newSettlement, note: e.target.value })} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              {settlementMessage && (
                <p className={`text-sm ${settlementMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{settlementMessage}</p>
              )}
              <button onClick={handleCreateSettlement} disabled={savingSettlement}
                className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {savingSettlement ? 'Initiating...' : '💰 Initiate Settlement'}
              </button>
            </div>
          </div>
        )}

        {/* Settlement History */}
        <div className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-bold text-gray-700 mb-3">Settlement History ({settlements.length})</h3>
          {settlements.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-2">No settlements yet</p>
          ) : (
            <div className="space-y-3">
              {settlements.map(s => (
                <div key={s.id} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-gray-700 text-sm">Settlement #{s.settlementNumber}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(s.status)}`}>{getStatusLabel(s.status)}</span>
                  </div>
                  <p className="text-xl font-bold text-orange-500">₹{Number(s.amount).toLocaleString()}</p>

                  {/* Pill layout */}
                  <div className="grid grid-cols-2 gap-1.5 mt-3 mb-2">
                    {s.bankName && <div className="bg-orange-50 rounded-xl p-2"><p className="text-gray-400 text-xs">Bank</p><p className="text-gray-700 text-xs font-medium">{s.bankName}</p></div>}
                    {s.ifsc && <div className="bg-orange-50 rounded-xl p-2"><p className="text-gray-400 text-xs">IFSC</p><p className="text-gray-700 text-xs font-medium">{s.ifsc}</p></div>}
                    {s.accountNo && <div className="bg-orange-50 rounded-xl p-2 col-span-2"><p className="text-gray-400 text-xs">Account</p><p className="text-gray-700 text-xs font-medium">{s.accountNo}</p></div>}
                    {s.upiId && <div className="bg-orange-50 rounded-xl p-2"><p className="text-gray-400 text-xs">UPI</p><p className="text-gray-700 text-xs font-medium">{s.upiId}</p></div>}
                    {s.deadline && <div className="bg-orange-50 rounded-xl p-2"><p className="text-gray-400 text-xs">Send by</p><p className="text-red-500 text-xs font-medium">{new Date(s.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>}
                  </div>

                  {s.utrNumber && (
                    <div className="bg-blue-50 rounded-xl p-2 mb-2">
                      <p className="text-gray-400 text-xs">UTR Number</p>
                      <p className="text-blue-700 text-xs font-medium">{s.utrNumber}</p>
                    </div>
                  )}

                  {s.lastEditedAt && (
                    <p className="text-gray-400 text-xs mb-2">
                      ✏️ Last edited: {new Date(s.lastEditedAt.seconds ? s.lastEditedAt.seconds * 1000 : s.lastEditedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {s.lastEditedChanges && ` · ${s.lastEditedChanges}`}
                    </p>
                  )}

                  {/* Edit form */}
                  {editingSettlementId === s.id && (
                    <div className="space-y-2 mb-3 bg-orange-50 rounded-xl p-3">
                      <input type="text" placeholder="Contact Name" value={editSettlement.contactName}
                        onChange={e => setEditSettlement({ ...editSettlement, contactName: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                      <input type="tel" placeholder="Contact Phone" value={editSettlement.contactPhone}
                        onChange={e => setEditSettlement({ ...editSettlement, contactPhone: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                      <input type="text" placeholder="UPI ID" value={editSettlement.upiId}
                        onChange={e => setEditSettlement({ ...editSettlement, upiId: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                      <input type="text" placeholder="Bank Name" value={editSettlement.bankName}
                        onChange={e => setEditSettlement({ ...editSettlement, bankName: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                      <input type="text" placeholder="Account Number" value={editSettlement.accountNo}
                        onChange={e => setEditSettlement({ ...editSettlement, accountNo: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                      <input type="text" placeholder="IFSC Code" value={editSettlement.ifsc}
                        onChange={e => setEditSettlement({ ...editSettlement, ifsc: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                      <input type="date" value={editSettlement.deadline}
                        onChange={e => setEditSettlement({ ...editSettlement, deadline: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                      <button onClick={() => saveEditSettlement(s)} disabled={savingEdit}
                        className="w-full bg-orange-500 text-white font-bold py-2 rounded-xl text-xs disabled:opacity-50">
                        {savingEdit ? 'Saving...' : '💾 Save Changes'}
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isAdminViewer && s.status !== 'confirmed' && (
                    <div className="flex gap-2 mt-2">
                      {(s.status === 'pending' || s.status === 'paused') && (
                        <button onClick={() => handlePauseResume(s)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium ${s.status === 'paused' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {s.status === 'paused' ? '▶️ Resume' : '⏸ Pause'}
                        </button>
                      )}
                      <button onClick={() => editingSettlementId === s.id ? setEditingSettlementId(null) : openEditSettlement(s)}
                        className="flex-1 py-2 rounded-xl text-sm font-medium bg-orange-50 text-orange-500">
                        {editingSettlementId === s.id ? '✕ Cancel' : '✏️ Edit Details'}
                      </button>
                    </div>
                  )}

                  {s.status === 'sent' && !isAdminViewer && (
                    <button onClick={() => handleConfirmReceived(s.id)}
                      className="w-full mt-2 bg-green-500 text-white font-medium py-2 rounded-xl text-sm">
                      ✅ Confirm Received
                    </button>
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