'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

export default function DispatchSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [shivir, setShivir] = useState<any>(null);
  const [dispatchRecords, setDispatchRecords] = useState<any[]>([]);
  const [packingItems, setPackingItems] = useState<any[]>([]);
  const [samagriRequests, setSamagriRequests] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('viewer') === 'admin') setIsAdminViewer(true);

      const shivirDoc = await getDoc(doc(db, 'shivirs', shivirId));
      if (shivirDoc.exists()) setShivir({ id: shivirDoc.id, ...shivirDoc.data() });

      const dispatchSnap = await getDocs(query(collection(db, 'dispatchRecords'), where('shivirId', '==', shivirId)));
      setDispatchRecords(dispatchSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const samagriSnap = await getDocs(query(collection(db, 'organiserSamagriRequests'), where('shivirId', '==', shivirId)));
      setSamagriRequests(samagriSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

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
            <h1 className="text-lg font-bold text-orange-600">📦 Dispatch</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
        </div>

        {/* Samagri Requests */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <h3 className="font-bold text-gray-700 mb-3">📋 Samagri Requests ({samagriRequests.length})</h3>
          {samagriRequests.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-2">No requests</p>
          ) : (
            <div className="space-y-2">
              {samagriRequests.map(r => (
                <div key={r.id} className="p-3 bg-orange-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-700 text-sm">{r.itemName}</p>
                      <p className="text-gray-400 text-xs">Qty: {r.quantity} · By: {r.requestedByName || r.requestedBy}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
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

        {/* Dispatch Records */}
        <div className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-bold text-gray-700 mb-3">🚚 Dispatch Records ({dispatchRecords.length})</h3>
          {dispatchRecords.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-2">No dispatch recorded yet</p>
          ) : (
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
    </div>
  );
}