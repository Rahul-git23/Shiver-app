'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

export default function ExpensesSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [shivir, setShivir] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('viewer') === 'admin') setIsAdminViewer(true);

      const shivirDoc = await getDoc(doc(db, 'shivirs', shivirId));
      if (shivirDoc.exists()) setShivir({ id: shivirDoc.id, ...shivirDoc.data() });

      const expSnap = await getDocs(query(collection(db, 'expenses'), where('shivirId', '==', shivirId)));
      setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.estimatedAmount) || 0), 0);

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
          <div className="flex-1">
            <h1 className="text-lg font-bold text-orange-600">📋 Expenses</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-red-500 text-lg">₹{totalExpenses.toLocaleString()}</p>
            <p className="text-gray-400 text-xs">{expenses.length} expenses</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          {expenses.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No expenses yet</p>
          ) : (
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

      </div>
    </div>
  );
}