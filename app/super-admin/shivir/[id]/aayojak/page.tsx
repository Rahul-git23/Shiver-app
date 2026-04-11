'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { createNotificationForMany } from '@/lib/notifications';

export default function AayojakPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [shivir, setShivir] = useState<any>(null);
  const [organisers, setOrganisers] = useState<any[]>([]);
  const [leadAayojakPhone, setLeadAayojakPhone] = useState('');
  const [removalRequests, setRemovalRequests] = useState<any[]>([]);

  // Add Aayojak state
  const [showAddOrganiser, setShowAddOrganiser] = useState(false);
  const [newOrgSearch, setNewOrgSearch] = useState('');
  const [newOrgResult, setNewOrgResult] = useState<any>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgMsg, setNewOrgMsg] = useState('');
  const [addingOrg, setAddingOrg] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }

      // Check admin viewer
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('viewer') === 'admin') setIsAdminViewer(true);

      setCurrentUser(user);
      await loadData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

  const loadData = async () => {
    // Load Shivir
    const shivirDoc = await getDoc(doc(db, 'shivirs', shivirId));
    if (shivirDoc.exists()) {
      setShivir({ id: shivirDoc.id, ...shivirDoc.data() });
      setLeadAayojakPhone(shivirDoc.data().leadAayojakPhone || '');
    }

    // Load organisers
    const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivirId)));
    setOrganisers(orgSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    // Load active removal requests
    const removalSnap = await getDocs(query(
      collection(db, 'removalRequests'),
      where('shivirId', '==', shivirId),
      where('status', '==', 'pending')
    ));
    setRemovalRequests(removalSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      await loadData();
    } catch (err: any) {
      setNewOrgMsg('Error: ' + err.message);
    }
    setAddingOrg(false);
  };

  const handleRemoveAayojak = async (o: any) => {
    const totalOrganisers = organisers.length;
    if (totalOrganisers < 5) {
      if (!confirm(`Remove ${o.name} Ji from this Shivir?`)) return;
      try {
        await deleteDoc(doc(db, 'shivirOrganisers', o.id));
        setOrganisers(organisers.filter(org => org.id !== o.id));
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    } else {
      const remark = prompt(`Enter reason for removing ${o.name} Ji (required):`);
      if (!remark || !remark.trim()) return;
      try {
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

        const orgPhones = organisers.map((org: any) => org.phone);
        await createNotificationForMany({
          phones: orgPhones,
          title: '🗳️ Removal Vote Required',
          body: `Super Admin requested removal of ${o.name} Ji. Please vote.`,
          type: 'removal_vote',
          shivirId,
        });

        alert(`Removal request sent. All Aayojaks have been notified to vote.`);
        await loadData();
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

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={goBack} className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">👥 Aayojak</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
        </div>

        {/* Active Removal Requests */}
        {removalRequests.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 mb-4">
            <h3 className="font-bold text-yellow-700 text-sm mb-2">🗳️ Active Removal Votes</h3>
            {removalRequests.map(r => (
              <div key={r.id} className="bg-white rounded-xl p-3 mb-2">
                <p className="text-gray-700 text-sm font-medium">Remove {r.targetName} Ji</p>
                <p className="text-gray-400 text-xs">Reason: {r.remark}</p>
                <p className="text-gray-400 text-xs mt-1">
                  Votes: {Object.values(r.votes || {}).filter(v => v === 'approve').length} approve · {Object.values(r.votes || {}).filter(v => v === 'reject').length} reject
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Add Aayojak */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <h3 className="font-bold text-gray-700 mb-3">👥 Aayojak ({organisers.length})</h3>

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

          {/* Aayojak List */}
          {organisers.length === 0 ? <p className="text-gray-400 text-sm">No Aayojak assigned</p> : (
            <div className="space-y-2">
              {organisers.map((o) => (
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

      </div>
    </div>
  );
}