'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { formatShivirDates } from '@/lib/utils';
import { getShivirSettlements } from '@/lib/settlements';

export default function ShivirDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [adminName, setAdminName] = useState('');

  // Shivir info
  const [shivir, setShivir] = useState<any>(null);

  // Summary counts
  const [organisers, setOrganisers] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sishyaList, setSishyaList] = useState<any[]>([]);
  const [dispatchRecords, setDispatchRecords] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [leadAayojakPhone, setLeadAayojakPhone] = useState('');

  // Closure state
  const [samagriReturnConfirmedByDispatch, setSamagriReturnConfirmedByDispatch] = useState(false);
  const [closingShivir, setClosingShivir] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      // Check if admin viewer
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('viewer') === 'admin') {
        setIsAdminViewer(true);
        const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
        const userSnap = await getDocs(userQ);
        if (!userSnap.empty) setAdminName(userSnap.docs[0].data().name || 'Admin');
      }

      await loadData(shivirId);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

  const loadData = async (id: string) => {
    // Load Shivir
    const shivirDoc = await getDoc(doc(db, 'shivirs', id));
    if (shivirDoc.exists()) {
      setShivir({ id: shivirDoc.id, ...shivirDoc.data() });
      setLeadAayojakPhone(shivirDoc.data().leadAayojakPhone || '');
    }

    // Load organisers
    const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', id)));
    setOrganisers(orgSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    // Load collections (only active ones for total)
    const colSnap = await getDocs(query(collection(db, 'contributions'), where('shivirId', '==', id)));
    setCollections(colSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    // Load expenses
    const expSnap = await getDocs(query(collection(db, 'expenses'), where('shivirId', '==', id)));
    setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    // Load tasks
    const taskSnap = await getDocs(query(collection(db, 'tasks'), where('shivirId', '==', id)));
    setTasks(taskSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    // Load sishya
    const sishyaSnap = await getDocs(query(collection(db, 'shivirSishya'), where('shivirId', '==', id)));
    setSishyaList(sishyaSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    // Load dispatch records
    const dispatchSnap = await getDocs(query(collection(db, 'dispatchRecords'), where('shivirId', '==', id)));
    setDispatchRecords(dispatchSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    // Load settlements
    const settlementsData = await getShivirSettlements(id);
    setSettlements(settlementsData as any[]);

    // Check if dispatch confirmed samagri return
    const rtgSnap = await getDocs(query(collection(db, 'samagriReturnToGurudham'), where('shivirId', '==', id)));
    const dispatchConfirmed = rtgSnap.docs.some(d => d.data().dispatchConfirmed === true);
    setSamagriReturnConfirmedByDispatch(dispatchConfirmed);
  };

  // Computed values
  const activeCollections = collections.filter(c => c.status !== 'cancelled' && c.status !== 'refunded');
  const totalCollections = activeCollections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.estimatedAmount) || 0), 0);
  const balance = totalCollections - totalExpenses;

  const totalSettled = settlements
    .filter(s => s.status === 'confirmed')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalPending = settlements
    .filter(s => s.status === 'pending' || s.status === 'sent')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const remainingToSettle = balance - totalSettled - totalPending;

  // Summary helpers
  const leadOrganiser = organisers.find(o => o.phone === leadAayojakPhone);
  const pendingVotes = expenses.filter(e => e.status === 'planning' || !e.status).length;
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const tasksOverdue = tasks.filter(t => {
    if (t.status === 'done') return false;
    if (!t.deadline) return false;
    const deadline = new Date(t.deadline);
    return deadline < new Date();
  }).length;

  const settlementStatus = () => {
    if (remainingToSettle <= 0 && balance > 0) return { label: 'Settled', color: 'bg-green-100 text-green-700 border-green-300' };
    const hasPending = settlements.some(s => s.status === 'pending' || s.status === 'sent');
    if (hasPending) return { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-300' };
    if (balance > 0) return { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
    return { label: 'No Balance', color: 'bg-gray-100 text-gray-500 border-gray-300' };
  };

  const goTo = (section: string) => {
    const base = `/super-admin/shivir/${shivirId}`;
    const adminQuery = isAdminViewer ? '?viewer=admin' : '';
    window.location.href = `${base}/${section}${adminQuery}`;
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
          <button onClick={() => window.location.href = isAdminViewer ? '/admin' : '/super-admin'}
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

            {/* Financial Summary Pills */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-700 mb-1">Collections</p>
                <p className="font-bold text-green-600 text-sm">₹{totalCollections.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-red-700 mb-1">Expenses</p>
                <p className="font-bold text-red-500 text-sm">₹{totalExpenses.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-700 mb-1">Balance</p>
                <p className={`font-bold text-sm ${balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  ₹{balance.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Grid Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">

          {/* Aayojak Card */}
          <div onClick={() => goTo('aayojak')}
            className="bg-white rounded-2xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-700 text-sm">Aayojak</span>
                <span className="text-lg">👥</span>
              </div>
              <p className="text-2xl font-bold text-orange-500">{organisers.length}</p>
              <p className="text-gray-400 text-xs mt-1">
                {leadOrganiser ? `Lead: ${leadOrganiser.name?.split(' ')[0]} Ji` : 'No lead assigned'}
              </p>
            </div>
            <p className="text-orange-500 text-xs font-bold mt-2">View all →</p>
          </div>

          {/* Collections Card */}
          <div onClick={() => goTo('collections')}
            className="bg-white rounded-2xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-700 text-sm">Collections</span>
                <span className="text-lg">💰</span>
              </div>
              <p className="text-2xl font-bold text-green-600">₹{totalCollections.toLocaleString()}</p>
              <p className="text-gray-400 text-xs mt-1">{activeCollections.length} entries</p>
            </div>
            <p className="text-orange-500 text-xs font-bold mt-2">View all →</p>
          </div>

          {/* Expenses Card */}
          <div onClick={() => goTo('expenses')}
            className="bg-white rounded-2xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-700 text-sm">Expenses</span>
                <span className="text-lg">📋</span>
              </div>
              <p className="text-2xl font-bold text-red-500">₹{totalExpenses.toLocaleString()}</p>
              <p className="text-gray-400 text-xs mt-1">
                {pendingVotes > 0 ? <span className="text-yellow-600">{pendingVotes} pending votes</span> : `${expenses.length} expenses`}
              </p>
            </div>
            <p className="text-orange-500 text-xs font-bold mt-2">View all →</p>
          </div>

          {/* Tasks Card */}
          <div onClick={() => goTo('tasks')}
            className="bg-white rounded-2xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-700 text-sm">Tasks</span>
                <span className="text-lg">✅</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{tasks.length}</p>
              <p className="text-gray-400 text-xs mt-1">
                {tasksOverdue > 0
                  ? <span className="text-red-500">{tasksOverdue} overdue</span>
                  : `${tasksDone} done · ${tasks.length - tasksDone} pending`}
              </p>
            </div>
            <p className="text-orange-500 text-xs font-bold mt-2">View all →</p>
          </div>

          {/* Sishya Card */}
          <div onClick={() => goTo('sishya')}
            className="bg-white rounded-2xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-700 text-sm">Sishya</span>
                <span className="text-lg">🙏</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{sishyaList.length}</p>
              <p className="text-gray-400 text-xs mt-1">{sishyaList.length > 0 ? 'assigned' : 'none assigned'}</p>
            </div>
            <p className="text-orange-500 text-xs font-bold mt-2">View all →</p>
          </div>

          {/* Dispatch Card */}
          <div onClick={() => goTo('dispatch')}
            className="bg-white rounded-2xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-700 text-sm">Dispatch</span>
                <span className="text-lg">📦</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{dispatchRecords.length}</p>
              <p className="text-gray-400 text-xs mt-1">
                {dispatchRecords.length > 0 ? `${dispatchRecords.length} dispatched` : 'no dispatch yet'}
              </p>
            </div>
            <p className="text-orange-500 text-xs font-bold mt-2">View all →</p>
          </div>

        </div>

        {/* ── Shivir Closure Card ── */}
        {!isAdminViewer && (() => {
          const settlementDone = remainingToSettle <= 0 && balance > 0;
          const samagriDone = samagriReturnConfirmedByDispatch;
          const alreadyClosed = shivir?.status === 'closed';
          const readyToClose = settlementDone && samagriDone;

          if (alreadyClosed) {
            return (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4 text-center">
                <p className="text-2xl mb-2">🕉️</p>
                <p className="text-green-700 font-bold text-base">Shivir Closed</p>
                <p className="text-green-600 text-sm mt-1">All Aayojaks have been deactivated.</p>
                <p className="text-green-500 text-xs mt-1">They can be reactivated when assigned to a new Shivir.</p>
              </div>
            );
          }

          return (
            <div className="bg-white rounded-2xl shadow p-4 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🔒</span>
                <h2 className="font-bold text-gray-700">Shivir Closure</h2>
              </div>

              {/* Settlement status row */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm text-gray-600">Settlement</p>
                  <p className="text-xs text-gray-400">Remaining balance = ₹0</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  settlementDone ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {settlementDone ? '✅ Done' : '⏳ Pending'}
                </span>
              </div>

              {/* Samagri return status row */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm text-gray-600">Samagri Return</p>
                  <p className="text-xs text-gray-400">Dispatch confirmed receipt</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  samagriDone ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {samagriDone ? '✅ Confirmed' : '❌ Not confirmed'}
                </span>
              </div>

              {/* Close button or disabled state */}
              {readyToClose ? (
                <div className="mt-4">
                  {showCloseConfirm ? (
                    <div className="bg-red-50 rounded-xl p-4 space-y-3">
                      <p className="text-red-700 font-semibold text-sm">⚠️ Are you sure?</p>
                      <p className="text-red-600 text-xs">
                        This will permanently close the Shivir and deactivate all {organisers.length} Aayojak accounts.
                        They can be reactivated later when assigned to a new Shivir.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowCloseConfirm(false)}
                          className="flex-1 border border-gray-200 text-gray-500 font-semibold py-2 rounded-xl text-sm">
                          Cancel
                        </button>
                        <button
                          disabled={closingShivir}
                          onClick={async () => {
                            setClosingShivir(true);
                            try {
                              const { updateDoc, doc, writeBatch } = await import('firebase/firestore');
                              const batch = writeBatch(db);

                              // Close the Shivir
                              batch.update(doc(db, 'shivirs', shivirId), { status: 'closed' });

                              // Deactivate all Aayojaks
                              for (const org of organisers) {
                                const uSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', org.phone)));
                                if (!uSnap.empty) {
                                  batch.update(doc(db, 'users', uSnap.docs[0].id), { status: 'deactivated' });
                                }
                                // Remove from shivirOrganisers
                                batch.delete(doc(db, 'shivirOrganisers', org.id));
                              }

                              await batch.commit();

                              setShivir((prev: any) => ({ ...prev, status: 'closed' }));
                              setShowCloseConfirm(false);
                            } catch (e) {
                              alert('Could not close Shivir. Please try again.');
                            }
                            setClosingShivir(false);
                          }}
                          className="flex-1 bg-red-500 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50">
                          {closingShivir ? 'Closing...' : 'Yes, Close Shivir'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCloseConfirm(true)}
                      className="w-full bg-red-500 text-white font-bold py-3 rounded-xl text-sm">
                      🔒 Close Shivir
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <div className="w-full bg-gray-100 text-gray-400 font-semibold py-3 rounded-xl text-sm text-center">
                    🔒 Close Shivir — conditions not met
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Both settlement and samagri return must be complete
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Settlement Card - Full Width */}
        <div onClick={() => goTo('settlement')}
          className={`bg-white rounded-2xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow border-2 ${
            balance > 0 && remainingToSettle > 0 ? 'border-orange-400' : 
            remainingToSettle <= 0 && balance > 0 ? 'border-green-400' : 'border-gray-200'
          }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏦</span>
              <span className="font-bold text-gray-700">Settlement</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${settlementStatus().color}`}>
              {settlementStatus().label}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-1">Remaining to settle</p>
              <p className={`text-2xl font-bold ${remainingToSettle > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                ₹{Math.max(0, remainingToSettle).toLocaleString()}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                ₹{totalSettled.toLocaleString()} settled of ₹{balance > 0 ? balance.toLocaleString() : '0'}
              </p>
            </div>
            <p className="text-orange-500 text-xs font-bold">Manage →</p>
          </div>
        </div>

      </div>
    </div>
  );
}
