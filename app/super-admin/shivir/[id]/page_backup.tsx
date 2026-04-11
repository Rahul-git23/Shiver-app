'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { formatShivirDates, formatShivirLocation } from '@/lib/utils';
import { createSettlement, getShivirSettlements, confirmSettlementReceived } from '@/lib/settlements';
import { createNotificationForMany } from '@/lib/notifications';

export default function ShivirDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'organiser' | 'sishya' | 'dispatch' | 'settlement'>('organiser');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [adminName, setAdminName] = useState('');

  // Shivir info
  const [shivir, setShivir] = useState<any>(null);

  // Organiser tab data
  const [collections, setCollections] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [organisers, setOrganisers] = useState<any[]>([]);

  // Sishya tab data
  const [sishyaList, setSishyaList] = useState<any[]>([]);
  const [selectedSishya, setSelectedSishya] = useState<any>(null);
  const [sishyaTravel, setSishyaTravel] = useState<any>(null);
  const [sishyaHospitality, setSishyaHospitality] = useState<any>(null);

  // Dispatch tab data
  const [dispatchRecords, setDispatchRecords] = useState<any[]>([]);
  const [packingItems, setPackingItems] = useState<any[]>([]);
  const [samagriRequests, setSamagriRequests] = useState<any[]>([]);

  // Settlement tab data
  const [settlements, setSettlements] = useState<any[]>([]);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [editSettlement, setEditSettlement] = useState({ contactName: '', contactPhone: '', upiId: '', bankName: '', accountHolder: '', accountNo: '', ifsc: '', deadline: '' });
  const [editQrFile, setEditQrFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [leadAayojakPhone, setLeadAayojakPhone] = useState<string>('');
  const [removalRequests, setRemovalRequests] = useState<any[]>([]);
  const [showAddOrganiser, setShowAddOrganiser] = useState(false);
  const [newOrgSearch, setNewOrgSearch] = useState('');
  const [newOrgResult, setNewOrgResult] = useState<any>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgMsg, setNewOrgMsg] = useState('');
  const [addingOrg, setAddingOrg] = useState(false);
  const [settlementMessage, setSettlementMessage] = useState('');
  const [newSettlement, setNewSettlement] = useState({
    amount: 0,
    bankName: '',
    accountNo: '',
    ifsc: '',
    upiId: '',
    contactName: '',
    contactPhone: '',
    deadline: '',
    note: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      const superAdminPhone = process.env.NEXT_PUBLIC_SUPER_ADMIN_PHONE;
      const userSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', user.phoneNumber)));
      const isGurudev = !userSnap.empty && userSnap.docs[0].data().role === 'gurudev';
      const isAdmin = !userSnap.empty && userSnap.docs[0].data().role === 'admin';
      if (isAdmin) {
        setIsAdminViewer(true);
        setAdminName(userSnap.docs[0].data().name || 'Admin');
      }
      if (user.phoneNumber !== superAdminPhone && !isGurudev && !isAdmin) {
        window.location.href = '/access-denied'; return;
      }
      setCurrentUser(user);
      await loadAll();
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadAll = async () => {
    const id = shivirId;

    const shivirDoc = await getDoc(doc(db, 'shivirs', id));
    if (shivirDoc.exists()) setShivir({ id: shivirDoc.id, ...shivirDoc.data() });

    const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', id)));
    setOrganisers(orgSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const colSnap = await getDocs(query(collection(db, 'contributions'), where('shivirId', '==', id)));
    setCollections(colSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const expSnap = await getDocs(query(collection(db, 'expenses'), where('shivirId', '==', id)));
    setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const taskSnap = await getDocs(query(collection(db, 'tasks'), where('shivirId', '==', id)));
    setTasks(taskSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const sishyaSnap = await getDocs(query(collection(db, 'shivirSishya'), where('shivirId', '==', id)));
    setSishyaList(sishyaSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const dispatchSnap = await getDocs(query(collection(db, 'dispatchRecords'), where('shivirId', '==', id)));
    setDispatchRecords(dispatchSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const samagriSnap = await getDocs(query(collection(db, 'organiserSamagriRequests'), where('shivirId', '==', id)));
    setSamagriRequests(samagriSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const settlementsData = await getShivirSettlements(id);
    setSettlements(settlementsData as any[]);
    // Load lead Aayojak
      const shivirLeadDoc = await getDoc(doc(db, 'shivirs', id));
      if (shivirLeadDoc.exists()) {
        setLeadAayojakPhone(shivirLeadDoc.data().leadAayojakPhone || '');
      }

      // Load active removal requests
      const removalSnap = await getDocs(query(
        collection(db, 'removalRequests'),
        where('shivirId', '==', id),
        where('status', '==', 'pending')
      ));
      setRemovalRequests(removalSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const loadSishyaDetails = async (sishya: any) => {
    setSelectedSishya(sishya);
    setSishyaTravel(null);
    setSishyaHospitality(null);
    const travelSnap = await getDocs(query(collection(db, 'sishyaTravel'),
      where('shivirId', '==', shivirId), where('phone', '==', sishya.phone)));
    if (!travelSnap.empty) setSishyaTravel(travelSnap.docs[0].data());
    const hospSnap = await getDocs(query(collection(db, 'hospitality'),
      where('shivirId', '==', shivirId), where('sishyaPhone', '==', sishya.phone)));
    if (!hospSnap.empty) setSishyaHospitality(hospSnap.docs[0].data());
  };

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
        shivirId,
        shivirName: shivir.name,
        settlementNumber,
        amount: newSettlement.amount,
        bankName: newSettlement.bankName,
        accountNo: newSettlement.accountNo,
        ifsc: newSettlement.ifsc,
        upiId: newSettlement.upiId,
        contactName: newSettlement.contactName,
        contactPhone: newSettlement.contactPhone,
        deadline: newSettlement.deadline,
        note: newSettlement.note,
        initiatedBy: currentUser.phoneNumber,
        initiatedByName: 'Super Admin',
      });

      // Notify all Aayojak
      try {
        const orgPhones = organisers.map(o => o.phone);
        if (orgPhones.length > 0) {
          await createNotificationForMany({
            phones: orgPhones,
            title: '💰 Settlement Initiated',
            body: `Please send ₹${newSettlement.amount.toLocaleString()} to Gurudham by ${newSettlement.deadline}. Contact: ${newSettlement.contactName} Ji`,
            type: 'settlement_initiated',
            shivirId,
          });
        }
      } catch (e) {}

      setSettlementMessage('✅ Settlement initiated successfully!');
      setNewSettlement({
        amount: 0, bankName: '', accountNo: '', ifsc: '',
        upiId: '', contactName: '', contactPhone: '', deadline: '', note: '',
      });
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
    setEditQrFile(null);
    setEditSettlement({
      contactName: s.contactName || '',
      contactPhone: s.contactPhone || '',
      upiId: s.upiId || '',
      bankName: s.bankName || '',
      accountHolder: s.accountHolder || '',
      accountNo: s.accountNo || '',
      ifsc: s.ifsc || '',
      deadline: s.deadline || '',
    });
  };

  const saveEditSettlement = async (s: any) => {
    setSavingEdit(true);
    try {
      console.log('Starting save...', editQrFile ? 'with QR' : 'no QR');
      const changes: string[] = [];
      if (editSettlement.contactName !== s.contactName) changes.push('Contact name');
      if (editSettlement.contactPhone !== s.contactPhone) changes.push('Contact phone');
      if (editSettlement.upiId !== s.upiId) changes.push('UPI ID');
      if (editSettlement.bankName !== s.bankName) changes.push('Bank name');
      if (editSettlement.accountNo !== s.accountNo) changes.push('Account number');
      if (editSettlement.ifsc !== s.ifsc) changes.push('IFSC');
      if (editSettlement.deadline !== s.deadline) changes.push('Deadline');
      
     await updateDoc(doc(db, 'settlements', s.id), {
        ...editSettlement,
        lastEditedAt: new Date(),
        lastEditedChanges: changes.join(', '),
      });

      // Notify all Aayojaks
      const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivirId)));
      const phones = orgSnap.docs.map(d => d.data().phone);
      await createNotificationForMany({
        phones,
        title: '✏️ Settlement Updated',
        body: `Settlement #${s.settlementNumber} has been updated. ${changes.join(', ')} changed.`,
        type: 'settlement_edited',
        shivirId,
      });

      const updated = await getShivirSettlements(shivirId);
      setSettlements(updated as any[]);
      setEditingSettlementId(null);
    } catch (err: any) {
      console.log('Error caught:', err);
      alert('Error: ' + err.message);
    }
    setSavingEdit(false);
  };

  const handleConfirmReceived = async (settlementId: string) => {
    if (!confirm('Confirm that payment has been received?')) return;
    await confirmSettlementReceived(settlementId, 'Super Admin');
    const updated = await getShivirSettlements(shivirId);
    setSettlements(updated as any[]);
  };

  const searchNewOrganiser = async () => {
    setNewOrgMsg('');
    setNewOrgResult(null);
    if (!newOrgSearch || newOrgSearch.length !== 10) {
      setNewOrgMsg('Enter a valid 10-digit number'); return;
    }
    const phone = '+91' + newOrgSearch;
    const already = organisers.find(o => o.phone === phone);
    if (already) { setNewOrgMsg('Already added to this Shivir'); return; }
    const q = query(collection(db, 'users'), where('phone', '==', phone));
    const snap = await getDocs(q);
    if (!snap.empty) {
      setNewOrgResult({ ...snap.docs[0].data(), id: snap.docs[0].id, isNew: false });
    } else {
      setNewOrgResult({ phone, isNew: true });
      setNewOrgMsg('Not found — enter name to add as new Aayojak');
    }
  };

  const addOrganiserToShivir = async () => {
    if (!newOrgResult) return;
    if (newOrgResult.isNew && !newOrgName.trim()) {
      setNewOrgMsg('Please enter name'); return;
    }
    setAddingOrg(true);
    try {
      const phone = newOrgResult.phone;
      const name = newOrgResult.isNew ? newOrgName.trim() : newOrgResult.name;
      if (newOrgResult.isNew) {
        await addDoc(collection(db, 'users'), {
          name, phone, role: 'organiser',
          status: 'pending', createdAt: new Date(),
        });
      }
      await addDoc(collection(db, 'shivirOrganisers'), {
        shivirId, phone, name,
        assignedBy: currentUser?.phoneNumber || '',
        assignedAt: new Date(),
        inviteStatus: 'pending',
      });
      setNewOrgMsg('✅ Aayojak added successfully!');
      setNewOrgSearch('');
      setNewOrgResult(null);
      setNewOrgName('');
      setShowAddOrganiser(false);
      await loadAll();
    } catch (err: any) {
      setNewOrgMsg('Error: ' + err.message);
    }
    setAddingOrg(false);
  };

  const handleRemoveAayojak = async (o: any) => {
    const totalOrganisers = organisers.length;
    if (totalOrganisers < 5) {
      // Direct remove — less than 5 Aayojaks
      if (!confirm(`Remove ${o.name} Ji from this Shivir?`)) return;
      try {
        await deleteDoc(doc(db, 'shivirOrganisers', o.id));
        setOrganisers(organisers.filter(org => org.id !== o.id));
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    } else {
      // Voting required — 5 or more Aayojaks
      const remark = prompt(`Enter reason for removing ${o.name} Ji (required):`);
      if (!remark || !remark.trim()) return;
      try {
        // Create removal request
        await addDoc(collection(db, 'removalRequests'), {
          shivirId,
          shivirName: shivir?.name || '',
          targetPhone: o.phone,
          targetName: o.name,
          requestedBy: currentUser?.phoneNumber || 'Super Admin',
          requestedByName: 'Super Admin',
          remark: remark.trim(),
          votes: {},
          status: 'pending',
          createdAt: new Date(),
        });

        // Notify all Aayojaks
        const orgPhones = organisers.map((org: any) => org.phone);
        await createNotificationForMany({
          phones: orgPhones,
          title: '🗳️ Removal Vote Required',
          body: `Super Admin requested removal of ${o.name} Ji. Please vote.`,
          type: 'removal_vote',
          shivirId,
        });

        alert(`Removal request sent. All Aayojaks have been notified to vote.`);

        // Reload removal requests
        const removalSnap = await getDocs(query(
          collection(db, 'removalRequests'),
          where('shivirId', '==', shivirId),
          where('status', '==', 'pending')
        ));
        setRemovalRequests(removalSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleSetLead = async (phone: string) => {
    try {
      const newLead = leadAayojakPhone === phone ? '' : phone;
      await updateDoc(doc(db, 'shivirs', shivirId), { leadAayojakPhone: newLead });
      setLeadAayojakPhone(newLead);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handlePauseResume = async (s: any) => {
    const isPaused = s.status === 'paused';
    const newStatus = isPaused ? 'pending' : 'paused';
    const confirmMsg = isPaused
      ? 'Resume this settlement? Aayojaks will be notified.'
      : 'Pause this settlement? Aayojaks will be notified that details are being updated.';
    if (!confirm(confirmMsg)) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'settlements', s.id), { status: newStatus });
      const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivirId)));
      const phones = orgSnap.docs.map(d => d.data().phone);
      await createNotificationForMany({
        phones,
        title: isPaused ? '▶️ Settlement Resumed' : '⏸ Settlement Paused',
        body: isPaused
          ? `Settlement #${s.settlementNumber} has been resumed. Please check updated payment details.`
          : `Settlement #${s.settlementNumber} is on hold. Gurudham is updating payment details.`,
        type: 'settlement_paused',
        shivirId,
      });
      const updated = await getShivirSettlements(shivirId);
      setSettlements(updated as any[]);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const totalCollections = collections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.estimatedAmount) || 0), 0);
  const balance = totalCollections - totalExpenses;
  const totalSettled = settlements
  .filter(s => s.status === 'confirmed')
  .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const totalPending = settlements
    .filter(s => s.status === 'pending' || s.status === 'sent')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const remainingToSettle = balance - totalSettled - totalPending;

  const getSettlementStatusColor = (status: string) => {
    if (status === 'confirmed') return 'bg-green-100 text-green-600';
    if (status === 'sent') return 'bg-blue-100 text-blue-600';
    if (status === 'paused') return 'bg-gray-100 text-gray-500';
    return 'bg-yellow-100 text-yellow-600';
  };

  const getSettlementStatusLabel = (status: string) => {
    if (status === 'confirmed') return '✅ Confirmed';
    if (status === 'sent') return '🕐 Sent';
    if (status === 'paused') return '⏸ Paused';
    return '⏳ Pending';
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/super-admin'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🕉️ Shivir Details</h1>
            <p className="text-gray-500 text-sm">{isAdminViewer ? adminName : 'Super Admin'}</p>
            <p className="text-gray-400 text-xs">{isAdminViewer ? 'Admin — Read Only View' : 'Full Access'}</p>
          </div>
        </div>

        {/* Shivir Info Card */}
        {shivir && (
          <div className="bg-white rounded-2xl shadow p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-800 text-lg">{shivir.name}</h2>
              <span className="bg-orange-100 text-orange-600 text-xs px-3 py-1 rounded-full capitalize font-medium">
                {shivir.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm">📍 {shivir.city}{shivir.state ? ', ' + shivir.state : ''}{shivir.venue ? ' · ' + shivir.venue : ''}</p>
            <p className="text-gray-500 text-sm">📅 {formatShivirDates(shivir.startDate, shivir.endDate)}</p>
            {shivir.description && <p className="text-gray-400 text-sm mt-1">📝 {shivir.description}</p>}

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Collections</p>
                <p className="font-bold text-green-600 text-sm">₹{totalCollections.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Expenses</p>
                <p className="font-bold text-red-500 text-sm">₹{totalExpenses.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Balance</p>
                <p className={`font-bold text-sm ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  ₹{balance.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {(['organiser', 'sishya', 'dispatch', 'settlement'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${
                activeTab === tab ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'
              }`}>
              {tab === 'organiser' ? '👥 Aayojak' :
               tab === 'sishya' ? '🙏 Sishya' :
               tab === 'dispatch' ? '📦 Dispatch' : '💰 Settlement'}
            </button>
          ))}
        </div>

        {/* ORGANISER TAB */}
        {activeTab === 'organiser' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-bold text-gray-700 mb-3">👥 Aayojak ({organisers.length})</h3>
              {/* Add Aayojak button */}
              {!isAdminViewer && (
                <div className="mb-3">
                  <button
                    onClick={() => { setShowAddOrganiser(!showAddOrganiser); setNewOrgMsg(''); setNewOrgResult(null); }}
                    className="w-full bg-orange-500 text-white font-bold py-2 rounded-xl text-sm">
                    {showAddOrganiser ? '✕ Cancel' : '+ Add Aayojak'}
                  </button>
                  {showAddOrganiser && (
                    <div className="bg-orange-50 rounded-xl p-3 mt-2 space-y-2">
                      <div className="flex gap-2">
                        <div className="flex gap-1 flex-1">
                          <span className="bg-white border border-gray-200 rounded-lg px-2 py-2 text-gray-600 text-xs">+91</span>
                          <input type="tel" placeholder="10-digit number"
                            value={newOrgSearch}
                            onChange={e => setNewOrgSearch(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                        </div>
                        <button onClick={searchNewOrganiser}
                          className="bg-orange-500 text-white text-xs font-bold px-3 rounded-xl">
                          Search
                        </button>
                      </div>
                      {newOrgResult && (
                        <div className="bg-white rounded-xl p-3">
                          {newOrgResult.isNew ? (
                            <div className="space-y-2">
                              <p className="text-orange-500 text-xs">New person — enter name:</p>
                              <input type="text" placeholder="Full name"
                                value={newOrgName}
                                onChange={e => setNewOrgName(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                            </div>
                          ) : (
                            <p className="text-green-600 text-xs font-medium">✅ Found: {newOrgResult.name}</p>
                          )}
                          <button onClick={addOrganiserToShivir} disabled={addingOrg}
                            className="w-full bg-orange-500 text-white font-bold py-2 rounded-xl text-xs mt-2 disabled:opacity-50">
                            {addingOrg ? 'Adding...' : '+ Add to Shivir'}
                          </button>
                        </div>
                      )}
                      {newOrgMsg && (
                        <p className={`text-xs ${newOrgMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                          {newOrgMsg}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {organisers.length === 0 ? <p className="text-gray-400 text-sm">No Aayojak assigned</p> : (
                <div className="space-y-2">
                {organisers.map((o, i) => (
                  <div key={o.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-sm">
                        {o.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-700 text-sm">{o.name} Ji</p>
                          {leadAayojakPhone === o.phone && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⭐ Lead</span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs">{o.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isAdminViewer && (
                        <button
                          onClick={() => handleRemoveAayojak(o)}
                          className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-500 border border-red-200">
                          Remove
                        </button>
                      )}
                      {!isAdminViewer && (
                        <button
                          onClick={() => handleSetLead(o.phone)}
                          className="text-xl leading-none"
                          title={leadAayojakPhone === o.phone ? 'Remove Lead' : 'Set as Lead'}>
                          {leadAayojakPhone === o.phone ? '★' : '☆'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-700">💰 Collections ({collections.length})</h3>
                <span className="text-green-600 font-bold text-sm">₹{totalCollections.toLocaleString()}</span>
              </div>
              {collections.length === 0 ? <p className="text-gray-400 text-sm text-center py-2">No collections yet</p> : (
                <div className="space-y-2">
                  {collections.map(c => (
                    <div key={c.id} className="p-3 bg-orange-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{c.sadhakName || c.name || 'Unknown'} Ji</p>
                          <p className="text-gray-400 text-xs">{c.city} · {c.paymentMode}</p>
                          <p className="text-gray-400 text-xs">By: {c.addedByName || c.addedBy}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">₹{Number(c.amount).toLocaleString()}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            c.status === 'cancelled' ? 'bg-red-100 text-red-500' :
                            c.status === 'refunded' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-green-100 text-green-600'
                          }`}>{c.status || 'active'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-700">🧾 Expenses ({expenses.length})</h3>
                <span className="text-red-500 font-bold text-sm">₹{totalExpenses.toLocaleString()}</span>
              </div>
              {expenses.length === 0 ? <p className="text-gray-400 text-sm text-center py-2">No expenses yet</p> : (
                <div className="space-y-2">
                  {expenses.map(e => (
                    <div key={e.id} className="p-3 bg-orange-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{e.vendorName}</p>
                          <p className="text-gray-400 text-xs">{e.category}</p>
                          <p className="text-gray-400 text-xs">By: {e.proposedByName || e.proposedBy}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-700">₹{Number(e.estimatedAmount).toLocaleString()}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            e.status === 'approved' ? 'bg-green-100 text-green-600' :
                            e.status === 'rejected' ? 'bg-red-100 text-red-500' :
                            'bg-yellow-100 text-yellow-600'
                          }`}>{e.status || 'pending'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-bold text-gray-700 mb-3">✅ Tasks ({tasks.length})</h3>
              {tasks.length === 0 ? <p className="text-gray-400 text-sm text-center py-2">No tasks yet</p> : (
                <div className="space-y-2">
                  {tasks.map(t => (
                    <div key={t.id} className="p-3 bg-orange-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{t.title}</p>
                          <p className="text-gray-400 text-xs">Assigned to: {Array.isArray(t.assignedToNames) ? t.assignedToNames.join(', ') : t.assignedToNames || t.assignedTo}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            t.priority === 'high' ? 'bg-red-100 text-red-500' :
                            t.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>{t.priority}</span>
                          <p className={`text-xs mt-1 ${
                            t.status === 'done' ? 'text-green-600' :
                            t.status === 'inProgress' ? 'text-blue-500' : 'text-gray-400'
                          }`}>{t.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SISHYA TAB */}
        {activeTab === 'sishya' && (
          <div className="space-y-4">
            {!selectedSishya ? (
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-bold text-gray-700 mb-3">🙏 Sishya ({sishyaList.length})</h3>
                {sishyaList.length === 0 ? <p className="text-gray-400 text-sm text-center py-2">No Sishya assigned yet</p> : (
                  <div className="space-y-2">
                    {sishyaList.map(s => (
                      <div key={s.id} className="p-3 bg-orange-50 rounded-xl flex items-center justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => loadSishyaDetails(s)}>
                          <p className="font-medium text-gray-700">{s.name} Ji</p>
                          <p className="text-gray-400 text-sm">{s.phone}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => loadSishyaDetails(s)}
                            className="text-orange-400 font-bold text-sm">→</button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Remove ${s.name} Ji from this Shivir?`)) return;
                              try {
                                await deleteDoc(doc(db, 'shivirSishya', s.id));
                                setSishyaList(sishyaList.filter(sx => sx.id !== s.id));
                              } catch (err: any) {
                                alert('Error: ' + err.message);
                              }
                            }}
                            className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-500 border border-red-200">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <button onClick={() => setSelectedSishya(null)}
                  className="flex items-center gap-2 text-orange-500 font-medium">
                  ← Back to Sishya list
                </button>
                <div className="bg-orange-500 rounded-2xl shadow p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-orange-500 font-bold text-lg">
                    {selectedSishya.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-orange-100 font-medium uppercase tracking-wide">Viewing Details For</p>
                    <h3 className="font-bold text-white text-lg">{selectedSishya.name} Ji</h3>
                    <p className="text-orange-100 text-sm">{selectedSishya.phone}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow p-4">
                  <h4 className="font-bold text-gray-700 mb-3">✈️ Travel Details</h4>
                  {!sishyaTravel ? <p className="text-gray-400 text-sm">Not filled yet</p> : (
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-400">Mode:</span> <span className="text-gray-700 font-medium">{sishyaTravel.travelMode}</span></p>
                      <p><span className="text-gray-400">Train/Flight:</span> <span className="text-gray-700 font-medium">{sishyaTravel.trainFlightNumber || '—'}</span></p>
                      <p><span className="text-gray-400">Departure:</span> <span className="text-gray-700 font-medium">{sishyaTravel.departureTime || '—'}</span></p>
                      <p><span className="text-gray-400">Arrival:</span> <span className="text-gray-700 font-medium">{sishyaTravel.arrivalTime || '—'}</span></p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow p-4">
                  <h4 className="font-bold text-gray-700 mb-3">🏨 Stay Details</h4>
                  {!sishyaHospitality?.stay ? <p className="text-gray-400 text-sm">Not assigned yet</p> : (
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-400">Hotel:</span> <span className="text-gray-700 font-medium">{sishyaHospitality.stay.hotelName}</span></p>
                      <p><span className="text-gray-400">Address:</span> <span className="text-gray-700 font-medium">{sishyaHospitality.stay.address || '—'}</span></p>
                      <p><span className="text-gray-400">Room:</span> <span className="text-gray-700 font-medium">{sishyaHospitality.stay.roomDetails || '—'}</span></p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow p-4">
                  <h4 className="font-bold text-gray-700 mb-3">🍽️ Food Schedule</h4>
                  {!sishyaHospitality?.food ? <p className="text-gray-400 text-sm">Not assigned yet</p> : (
                    <div className="space-y-2 text-sm">
                      {['breakfast', 'lunch', 'dinner'].map(meal => (
                        <div key={meal} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg">
                          <span className="text-gray-500 capitalize">{meal}</span>
                          <span className="text-gray-700 font-medium">
                            {sishyaHospitality.food[meal]?.time || '—'} · {sishyaHospitality.food[meal]?.location || '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow p-4">
                  <h4 className="font-bold text-gray-700 mb-3">🚗 Transport</h4>
                  {!sishyaHospitality?.transport ? <p className="text-gray-400 text-sm">Not assigned yet</p> : (
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-400">Pickup:</span> <span className="text-gray-700 font-medium">{sishyaHospitality.transport.pickupPoint || '—'}</span></p>
                      <p><span className="text-gray-400">Time:</span> <span className="text-gray-700 font-medium">{sishyaHospitality.transport.pickupTime || '—'}</span></p>
                      <p><span className="text-gray-400">Vehicle:</span> <span className="text-gray-700 font-medium">{sishyaHospitality.transport.vehicle || '—'}</span></p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow p-4">
                  <h4 className="font-bold text-gray-700 mb-3">📞 Contacts</h4>
                  {!sishyaHospitality?.contacts || sishyaHospitality.contacts.length === 0 ?
                    <p className="text-gray-400 text-sm">No contacts assigned yet</p> : (
                    <div className="space-y-2">
                      {sishyaHospitality.contacts.map((c: any, i: number) => (
                        <div key={i} className="p-3 bg-orange-50 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-700 text-sm">{c.name}</p>
                            <p className="text-gray-400 text-xs">{c.responsibility}</p>
                          </div>
                          <p className="text-orange-600 font-medium text-sm">{c.phone}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DISPATCH TAB */}
        {activeTab === 'dispatch' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-bold text-gray-700 mb-3">📦 Packing List ({packingItems.length} items)</h3>
              {packingItems.length === 0 ? <p className="text-gray-400 text-sm text-center py-2">No packing list yet</p> : (
                <div className="space-y-2">
                  {packingItems.map(item => (
                    <div key={item.id} className="p-3 bg-orange-50 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-700 text-sm">{item.itemName}</p>
                        <p className="text-gray-400 text-xs">Bundle #{item.bundleNumber} · Qty: {item.quantity}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.status === 'dispatched' ? 'bg-green-100 text-green-600' :
                        item.status === 'packed' ? 'bg-blue-100 text-blue-600' :
                        item.status === 'attention' ? 'bg-red-100 text-red-500' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-bold text-gray-700 mb-3">📋 Samagri Requests ({samagriRequests.length})</h3>
              {samagriRequests.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">No requests yet</p>
              ) : (
                <div className="space-y-2">
                  {samagriRequests.map(r => (
                    <div key={r.id} className="p-3 bg-orange-50 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{r.itemName}</p>
                          <p className="text-gray-400 text-xs">Qty: {r.quantity}</p>
                          {r.remarks && <p className="text-gray-400 text-xs">📝 {r.remarks}</p>}
                          {r.requestedByName && <p className="text-gray-400 text-xs">By: {r.requestedByName}</p>}
                          {r.status === 'approved' && r.paymentRequired && (
                            <p className="text-green-600 text-xs font-medium mt-1">💰 Payment: ₹{r.amount}</p>
                          )}
                          {r.status === 'rejected' && r.rejectRemark && (
                            <p className="text-red-500 text-xs mt-1">Reason: {r.rejectRemark}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          r.status === 'approved' ? 'bg-green-100 text-green-600' :
                          r.status === 'rejected' ? 'bg-red-100 text-red-500' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {r.status === 'approved' ? '✅ Approved' :
                          r.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-bold text-gray-700 mb-3">🚚 Dispatch Records ({dispatchRecords.length})</h3>
              {dispatchRecords.length === 0 ? <p className="text-gray-400 text-sm text-center py-2">No dispatch recorded yet</p> : (
                <div className="space-y-2">
                  {dispatchRecords.map(d => (
                    <div key={d.id} className="p-3 bg-orange-50 rounded-xl">
                      <p className="font-medium text-gray-700 text-sm">Bundles: {d.bundleCount}</p>
                      <p className="text-gray-400 text-xs">Date: {d.dispatchDate}</p>
                      <p className="text-gray-400 text-xs">Transport: {d.transportDetails}</p>
                      {d.biltyNumber && <p className="text-gray-400 text-xs">Bilty: {d.biltyNumber}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTLEMENT TAB */}
        {activeTab === 'settlement' && (
          <div className="space-y-4">

            {/* Balance Summary */}
            <div className={`rounded-2xl shadow p-4 ${balance < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
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
                  <span className={`font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    ₹{balance.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Settled</span>
                  <span className="font-bold text-green-600">₹{totalSettled.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-700">Remaining to Settle</span>
                  <span className={`font-bold ${balance - totalSettled >= 0 ? 'text-orange-600' : 'text-red-500'}`}>
                    ₹{(balance - totalSettled).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Deficit Warning */}
              {balance < 0 && (
                <div className="mt-3 bg-red-100 rounded-xl p-3">
                  <p className="text-red-600 text-sm font-medium">⚠️ Deficit Alert</p>
                  <p className="text-red-500 text-xs mt-1">
                    Collections are ₹{Math.abs(balance).toLocaleString()} less than expenses.
                    You can still settle the available amount.
                  </p>
                </div>
              )}
            </div>

            {remainingToSettle <= 0 ? (
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-green-600 text-sm font-medium">✅ All settlements have been initiated</p>
              </div>
            ) : (
              <>
                {/* Initiate Settlement Button */}
                {!isAdminViewer && <button onClick={() => setShowSettlementForm(!showSettlementForm)}
                  className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl">
                  {showSettlementForm ? '✕ Cancel' : '+ Initiate New Settlement'}
                </button>}
              </>
            )}

            {/* Settlement Form */}
            {showSettlementForm && (
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-bold text-gray-700 mb-4">New Settlement #{settlements.length + 1}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-600 text-xs mb-1">Amount to Settle *</label>
                    <input type="number" placeholder="₹ Amount"
                      value={newSettlement.amount || ''}
                      onChange={e => setNewSettlement({ ...newSettlement, amount: Number(e.target.value) })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                    {balance > 0 && (
                      <button onClick={() => setNewSettlement({ ...newSettlement, amount: remainingToSettle > 0 ? remainingToSettle : 0 })}
                        className="text-xs text-orange-500 mt-1">
                        Use remaining balance ₹{(balance - totalSettled).toLocaleString()}
                      </button>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-gray-600 text-xs font-medium mb-2">Gurudham Payment Details</p>
                    <div className="space-y-2">
                      <input type="text" placeholder="UPI ID (e.g. gurudham@upi)"
                        value={newSettlement.upiId}
                        onChange={e => setNewSettlement({ ...newSettlement, upiId: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                      <input type="text" placeholder="Bank Name"
                        value={newSettlement.bankName}
                        onChange={e => setNewSettlement({ ...newSettlement, bankName: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                      <input type="text" placeholder="Account Number"
                        value={newSettlement.accountNo}
                        onChange={e => setNewSettlement({ ...newSettlement, accountNo: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                      <input type="text" placeholder="IFSC Code"
                        value={newSettlement.ifsc}
                        onChange={e => setNewSettlement({ ...newSettlement, ifsc: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-gray-600 text-xs font-medium mb-2">Contact Person</p>
                    <div className="space-y-2">
                      <input type="text" placeholder="Contact Name *"
                        value={newSettlement.contactName}
                        onChange={e => setNewSettlement({ ...newSettlement, contactName: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                      <input type="tel" placeholder="Contact Phone *"
                        value={newSettlement.contactPhone}
                        onChange={e => setNewSettlement({ ...newSettlement, contactPhone: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-600 text-xs mb-1">Deadline *</label>
                    <input type="date"
                      value={newSettlement.deadline}
                      onChange={e => setNewSettlement({ ...newSettlement, deadline: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  </div>

                  <div>
                    <label className="block text-gray-600 text-xs mb-1">Note (Optional)</label>
                    <textarea placeholder="Any instructions for Aayojak..."
                      value={newSettlement.note}
                      onChange={e => setNewSettlement({ ...newSettlement, note: e.target.value })}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  </div>

                  {settlementMessage && (
                    <p className={`text-sm ${settlementMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                      {settlementMessage}
                    </p>
                  )}

                  <button onClick={handleCreateSettlement} disabled={savingSettlement}
                    className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                    {savingSettlement ? 'Initiating...' : '💰 Initiate Settlement'}
                  </button>
                </div>
              </div>
            )}

            {/* Past Settlements */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-bold text-gray-700 mb-3">Settlement History ({settlements.length})</h3>
              {settlements.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">💰</div>
                  <p className="text-gray-400 text-sm">No settlements yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map((s: any) => (
                    <div key={s.id} className="border border-orange-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-gray-700">Settlement #{s.settlementNumber}</p>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSettlementStatusColor(s.status)}`}>
                          {getSettlementStatusLabel(s.status)}
                        </span>
                      </div>
                      <p className="text-orange-600 font-bold text-lg">₹{Number(s.amount).toLocaleString()}</p>

                                                                                        
                      {/* Edit Form */}
                      {editingSettlementId === s.id && (
                        <div className="bg-orange-50 rounded-xl p-3 mt-2 space-y-2">
                          <input type="text" placeholder="Contact Name"
                            value={editSettlement.contactName}
                            onChange={e => setEditSettlement({ ...editSettlement, contactName: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                          <input type="tel" placeholder="Contact Phone"
                            value={editSettlement.contactPhone}
                            onChange={e => setEditSettlement({ ...editSettlement, contactPhone: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                          <input type="text" placeholder="UPI ID"
                            value={editSettlement.upiId}
                            onChange={e => setEditSettlement({ ...editSettlement, upiId: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                          <input type="text" placeholder="Bank Name"
                            value={editSettlement.bankName}
                            onChange={e => setEditSettlement({ ...editSettlement, bankName: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                          <input type="text" placeholder="Account Holder Name"
                            value={editSettlement.accountHolder}
                            onChange={e => setEditSettlement({ ...editSettlement, accountHolder: e.target.value })}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                          <input type="text" placeholder="Account Number"
                            value={editSettlement.accountNo}
                            onChange={e => setEditSettlement({ ...editSettlement, accountNo: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                          <input type="text" placeholder="IFSC Code"
                            value={editSettlement.ifsc}
                            onChange={e => setEditSettlement({ ...editSettlement, ifsc: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />                            
                          <input type="date"
                            value={editSettlement.deadline}
                            onChange={e => setEditSettlement({ ...editSettlement, deadline: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400" />
                          <button
                            onClick={() => saveEditSettlement(s)}
                            disabled={savingEdit}
                            className="w-full bg-orange-500 text-white font-bold py-2 rounded-xl text-xs disabled:opacity-50">
                            {savingEdit ? 'Saving...' : '💾 Save Changes'}
                          </button>
                        </div>
                      )}
                      {/* Option B pill layout */}
                      <div className="grid grid-cols-2 gap-1.5 mt-3 mb-2">
                        {s.bankName && (
                          <div className="bg-orange-50 rounded-xl p-2">
                            <p className="text-gray-400 text-xs">Bank</p>
                            <p className="text-gray-700 text-xs font-medium">{s.bankName}</p>
                          </div>
                        )}
                        {s.ifsc && (
                          <div className="bg-orange-50 rounded-xl p-2">
                            <p className="text-gray-400 text-xs">IFSC</p>
                            <p className="text-gray-700 text-xs font-medium">{s.ifsc}</p>
                          </div>
                        )}
                        {s.accountNo && (
                          <div className="bg-orange-50 rounded-xl p-2 col-span-2">
                            <p className="text-gray-400 text-xs">Account</p>
                            {s.accountHolder && <p className="text-gray-700 text-xs font-medium">{s.accountHolder}</p>}
                            <p className="text-gray-500 text-xs">{s.accountNo}</p>
                          </div>
                        )}
                        {s.upiId && (
                          <div className="bg-orange-50 rounded-xl p-2">
                            <p className="text-gray-400 text-xs">UPI</p>
                            <p className="text-gray-700 text-xs font-medium">{s.upiId}</p>
                          </div>
                        )}
                        {s.deadline && (
                          <div className="bg-orange-50 rounded-xl p-2">
                            <p className="text-gray-400 text-xs">Send by</p>
                            <p className="text-red-500 text-xs font-medium">{new Date(s.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                        )}
                      </div>

                      {/* Contact */}
                      {s.contactName && (
                        <div className="border-t border-gray-100 pt-2 mb-1">
                          <p className="text-gray-500 text-xs">📞 {s.contactName} Ji · {s.contactPhone}</p>
                        </div>
                      )}

                      {s.note && <p className="text-gray-400 text-xs mt-1">📝 {s.note}</p>}

                      {/* UTR number if sent */}
                      {s.status === 'sent' && s.utrNumber && (
                        <div className="mt-2 bg-blue-50 rounded-lg p-2">
                          <p className="text-blue-600 text-xs font-medium">📤 UTR: {s.utrNumber}</p>
                          {s.sentByName && <p className="text-blue-400 text-xs">Sent by: {s.sentByName}</p>}
                        </div>
                      )}

                      {s.lastEditedAt && (
                        <p className="text-xs text-purple-400 mt-2">
                          ✏️ Last edited: {new Date(s.lastEditedAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {s.lastEditedChanges ? ` · ${s.lastEditedChanges}` : ''}
                        </p>
                      )}
                      
                      {/* Bottom action row */}
                      {!isAdminViewer && (s.status === 'pending' || s.status === 'sent' || s.status === 'paused') && (
                        <div className="flex gap-2 mt-2">
                          {(s.status === 'pending' || s.status === 'paused') && (
                            <button
                              onClick={() => handlePauseResume(s)}
                              className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                                s.status === 'paused' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                              {s.status === 'paused' ? '▶️ Resume' : '⏸ Pause'}
                            </button>
                          )}
                          <button
                            onClick={() => editingSettlementId === s.id ? setEditingSettlementId(null) : openEditSettlement(s)}
                            className="flex-1 py-2 rounded-xl text-sm font-medium bg-orange-50 text-orange-500">
                            {editingSettlementId === s.id ? '✕ Cancel' : '✏️ Edit Details'}
                          </button>
                        </div>
                      )}

                      {/* Confirm button for sent settlements */}
                      {s.status === 'sent' && (
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
        )}

      </div>
    </div>
  );
}