'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getShivirSamagri } from '@/lib/samagri';

export default function SishyaSamagriPage() {
  const [shivir, setShivir] = useState<any>(null);
  const [samagriItems, setSamagriItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBundle, setFilterBundle] = useState<number | 'all'>('all');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }

      const sishyaQ = query(collection(db, 'shivirSishya'), where('phone', '==', currentUser.phoneNumber));
      const sishyaSnap = await getDocs(sishyaQ);
      if (!sishyaSnap.empty) {
        const shivirId = sishyaSnap.docs[0].data().shivirId;
        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });
          const items = await getShivirSamagri(shivirId) as any[];
          setSamagriItems(items.filter(i => i.quantityToSend > 0));
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const bundles = [...new Set(samagriItems.map(i => i.bundleNumber || 1))].sort();
  const categories = [...new Set(samagriItems.map(i => i.category))];

  const filteredItems = samagriItems.filter(item => {
    const matchSearch = search === '' ||
      item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchBundle = filterBundle === 'all' || item.bundleNumber === filterBundle;
    return matchSearch && matchBundle;
  });

  const filteredCategories = [...new Set(filteredItems.map(i => i.category))];

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/sishya'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">📦 Shivir Samagri</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
            <p className="text-gray-400 text-xs">
              {bundles.length} Bundles · {samagriItems.length} items
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow p-3 mb-3">
          <input
            type="text"
            placeholder="🔍 Search item or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
        </div>

        {/* Bundle Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button onClick={() => setFilterBundle('all')}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${filterBundle === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 shadow'}`}>
            All Bundles
          </button>
          {bundles.map(bn => (
            <button key={bn} onClick={() => setFilterBundle(bn)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${filterBundle === bn ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 shadow'}`}>
              📦 Bundle {bn}
            </button>
          ))}
        </div>

        {/* Items by Category */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-gray-400">No items found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map(category => (
              <div key={category} className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-bold text-orange-600 text-sm uppercase mb-3 border-b border-orange-100 pb-2">
                  {category}
                </h2>
                <div className="space-y-2">
                  {filteredItems
                    .filter(i => i.category === category)
                    .map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex-1">
                          <p className="text-gray-700 text-sm font-medium">{item.itemName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-gray-400 text-xs">Qty: {item.quantityToSend}</span>
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                              📦 Bundle {item.bundleNumber || 1}
                            </span>
                            {item.status === 'attention_required' && (
                              <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">
                                ⚠️ Carry
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-orange-600 font-bold text-sm ml-3">₹{item.price}</p>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}