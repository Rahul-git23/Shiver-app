'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

export default function CollectionsSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [shivir, setShivir] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('viewer') === 'admin') setIsAdminViewer(true);

      // Load Shivir
      const shivirDoc = await getDoc(doc(db, 'shivirs', shivirId));
      if (shivirDoc.exists()) setShivir({ id: shivirDoc.id, ...shivirDoc.data() });

      // Load collections
      const colSnap = await getDocs(query(collection(db, 'contributions'), where('shivirId', '==', shivirId)));
      const cols = colSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      cols.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setCollections(cols);

      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

  const activeCollections = collections.filter(c => c.status !== 'cancelled' && c.status !== 'refunded');
  const totalCollections = activeCollections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

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
          <div className="flex-1">
            <h1 className="text-lg font-bold text-orange-600">💰 Collections</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-green-600 text-lg">₹{totalCollections.toLocaleString()}</p>
            <p className="text-gray-400 text-xs">{activeCollections.length} active</p>
          </div>
        </div>

        {/* Collections List */}
        <div className="bg-white rounded-2xl shadow p-4">
          {collections.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No collections yet</p>
          ) : (
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
                  {c.status === 'refunded' && c.refundRemark && (
                    <p className="text-orange-400 text-xs mt-2 border-t pt-2">
                      ↩ Refunded · {c.refundRemark}
                    </p>
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