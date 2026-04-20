 'use client';

import { formatShivirDates, formatShivirLocation } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

const DEFAULT_CATEGORIES = [
  'Hall/Venue', 'Food/Prasad', 'Decoration', 'Sound/Lighting',
  'Transport', 'Printing', 'Samagri', 'Accommodation',
  'Gurudev Arrangements', 'Sishya Arrangements', 'Miscellaneous'
];

export default function ExpensesPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState<'planning' | 'approved'>('planning');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      setUserData({ id: userSnap.docs[0].id, ...userSnap.docs[0].data() });

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

          const expQ = query(collection(db, 'expenses'), where('shivirId', '==', shivirId));
          const expSnap = await getDocs(expQ);
          const exps = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setExpenses(exps);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatAmount = (amount: number) => '₹' + amount.toLocaleString('en-IN');

  const planningExpenses = expenses.filter((e: any) => e.phase === 'planning');
  const approvedExpenses = expenses.filter((e: any) => e.phase === 'approved');
  const currentExpenses = activePhase === 'planning' ? planningExpenses : approvedExpenses;

  // Group by category
  const groupByCategory = (exps: any[]) => {
    const groups: { [key: string]: any[] } = {};
    exps.forEach(exp => {
      const cat = exp.category || 'Miscellaneous';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(exp);
    });
    return groups;
  };

  const categoryGroups = groupByCategory(currentExpenses);
  const totalAmount = currentExpenses.reduce((sum: number, e: any) => sum + (e.estimatedAmount || 0), 0);
  const approvedTotal = approvedExpenses.reduce((sum: number, e: any) => sum + (e.estimatedAmount || 0), 0);

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
              <h1 className="text-lg font-bold text-orange-600">📋 Expenses</h1>
              <p className="text-gray-500 text-xs">
                {shivir?.name} · <span className="font-bold text-orange-500">{formatShivirLocation(shivir?.city, shivir?.state)}</span>
              </p>
              <p className="text-gray-400 text-xs">
                {formatShivirDates(shivir?.startDate, shivir?.endDate)}
              </p>
            </div>
          </div>
          <button onClick={() => window.location.href = '/organiser/expenses/add'}
            className="bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
            + Add
          </button>
        </div>

        {/* Total Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-orange-500 rounded-2xl shadow p-4 text-white">
            <p className="text-orange-100 text-xs mb-1">Planning Total</p>
            <p className="text-xl font-bold">
              {formatAmount(planningExpenses.reduce((s: number, e: any) => s + (e.estimatedAmount || 0), 0))}
            </p>
            <p className="text-orange-100 text-xs mt-1">{planningExpenses.length} expenses</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-gray-500 text-xs mb-1">Approved Total</p>
            <p className="text-xl font-bold text-green-600">{formatAmount(approvedTotal)}</p>
            <p className="text-gray-400 text-xs mt-1">{approvedExpenses.length} expenses</p>
          </div>
        </div>

        {/* Phase Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActivePhase('planning')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
              activePhase === 'planning' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'
            }`}>
            🗓️ Shivir Planning ({planningExpenses.length})
          </button>
          <button onClick={() => setActivePhase('approved')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
              activePhase === 'approved' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'
            }`}>
            ✅ Shivir Expenses ({approvedExpenses.length})
          </button>
        </div>

        {/* Category Groups */}
        {Object.keys(categoryGroups).length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-gray-400">No expenses in this phase yet</p>
            <p className="text-gray-400 text-sm mt-1">Tap "+ Add" to add first expense</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(categoryGroups).map(([category, exps]) => {
              const catTotal = exps.reduce((s: number, e: any) => s + (e.estimatedAmount || 0), 0);
              const pendingCount = exps.filter((e: any) => e.status === 'pending').length;
              const approvedCount = exps.filter((e: any) => e.status === 'approved').length;
              return (
                <div key={category} className="bg-white rounded-2xl shadow p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-700">{category}</h3>
                    <span className="font-bold text-orange-600">{formatAmount(catTotal)}</span>
                  </div>
                  <div className="flex gap-2 text-xs mb-3">
                    {pendingCount > 0 && (
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                        {pendingCount} pending vote
                      </span>
                    )}
                    {approvedCount > 0 && (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        {approvedCount} approved
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {exps.map((exp: any) => (
                      <button key={exp.id}
                        onClick={() => window.location.href = `/organiser/expenses/${exp.id}`}
                        className="w-full text-left bg-orange-50 rounded-xl p-3 hover:bg-orange-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-700 font-medium text-sm">{exp.vendorName}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{exp.remarks}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-orange-600 font-bold text-sm">
                              {formatAmount(exp.estimatedAmount)}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              exp.status === 'approved' ? 'bg-green-100 text-green-600' :
                              exp.status === 'rejected' ? 'bg-red-100 text-red-500' :
                              'bg-yellow-100 text-yellow-600'
                            }`}>
                              {exp.status === 'pending' ? '🗳️ Voting' :
                               exp.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
