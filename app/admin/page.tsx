'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatShivirDates, formatShivirLocation } from '@/lib/utils';

export default function AdminPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivirs, setShivirs] = useState<any[]>([]);
  const [shivirStats, setShivirStats] = useState<{[id: string]: any}>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'admin') {
        window.location.href = '/access-denied'; return;
      }
      setUserData(userSnap.docs[0].data());

      // Get only assigned Shivirs
      const adminData = userSnap.docs[0].data();
      const assignedIds: string[] = adminData.assignedShivirs || [];
      if (assignedIds.length === 0) {
        setShivirs([]);
        setLoading(false);
        return;
      }
      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const shivirList = shivirSnap.docs
        .filter(d => assignedIds.includes(d.id))
        .map(d => ({ id: d.id, ...d.data() }));
      shivirList.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setShivirs(shivirList);

      // Get stats for each Shivir
      const stats: {[id: string]: any} = {};
      for (const shivir of shivirList) {
        const sid = shivir.id;

        const colSnap = await getDocs(query(collection(db, 'contributions'), where('shivirId', '==', sid)));
        const activeCols = colSnap.docs.filter(d => d.data().status !== 'cancelled' && d.data().status !== 'refunded');
        const totalCollections = activeCols.reduce((sum, d) => sum + (d.data().amount || 0), 0);

        const expSnap = await getDocs(query(collection(db, 'expenses'), where('shivirId', '==', sid)));
        const totalExpenses = expSnap.docs.reduce((sum, d) => sum + (d.data().estimatedAmount || d.data().amount || 0), 0);

        const settlSnap = await getDocs(query(collection(db, 'settlements'), where('shivirId', '==', sid)));
        const totalSettled = settlSnap.docs
          .filter(d => d.data().status === 'confirmed')
          .reduce((sum, d) => sum + (d.data().amount || 0), 0);

        stats[sid] = {
          collections: totalCollections,
          expenses: totalExpenses,
          balance: totalCollections - totalExpenses,
          settled: totalSettled,
        };
      }
      setShivirStats(stats);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredShivirs = shivirs.filter((s: any) => {
    const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const formatAmount = (n: number) => '₹' + n.toLocaleString('en-IN');

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
          <div>
            <h1 className="text-lg font-bold text-orange-600">🕉️ Shivir App</h1>
            <p className="text-gray-500 text-sm">Admin Dashboard</p>
          </div>
          <button onClick={() => { auth.signOut(); window.location.href = '/login'; }}
            className="text-red-400 text-sm font-medium">Logout</button>
        </div>

        {/* Welcome */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">🙏</div>
          <div>
            <h2 className="font-bold text-gray-700">Jai Gurudev, {userData?.name}!</h2>
            <p className="text-gray-400 text-sm">View Only · {userData?.assignedShivirs?.length || 0} Shivirs assigned</p>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl shadow p-3 text-center">
            <p className="text-xl font-bold text-orange-500">{shivirs.length}</p>
            <p className="text-gray-400 text-xs">Total</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-3 text-center">
            <p className="text-xl font-bold text-green-500">
              {shivirs.filter((s: any) => s.status === 'active').length}
            </p>
            <p className="text-gray-400 text-xs">Active</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-3 text-center">
            <p className="text-xl font-bold text-gray-400">
              {shivirs.filter((s: any) => s.status === 'completed').length}
            </p>
            <p className="text-gray-400 text-xs">Completed</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow p-3 mb-3">
          <input
            type="text"
            placeholder="Search by name or city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm focus:outline-none text-gray-700"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {['all', 'planning', 'active', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Shivir List */}
        <div className="space-y-3">
          {filteredShivirs.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center">
              <p className="text-gray-400">No Shivirs found</p>
            </div>
          ) : (
            filteredShivirs.map((s: any) => {
              const stats = shivirStats[s.id] || {};
              return (
                <div key={s.id} className="bg-white rounded-2xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => window.location.href = `/super-admin/shivir/${s.id}?viewer=admin`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-700">{s.name}</h3>
                      <p className="text-gray-400 text-xs">{formatShivirLocation(s.city, s.state)}</p>
                      <p className="text-gray-400 text-xs">{formatShivirDates(s.startDate, s.endDate)}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      s.status === 'active' ? 'bg-green-100 text-green-600' :
                      s.status === 'completed' ? 'bg-blue-100 text-blue-600' :
                      s.status === 'cancelled' ? 'bg-red-100 text-red-500' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {s.status || 'planning'}
                    </span>
                  </div>

                  {/* Financial Summary */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-sm font-bold text-green-600">{formatAmount(stats.collections || 0)}</p>
                      <p className="text-gray-400 text-xs">Collections</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-red-400">{formatAmount(stats.expenses || 0)}</p>
                      <p className="text-gray-400 text-xs">Expenses</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-bold ${(stats.balance || 0) >= 0 ? 'text-orange-500' : 'text-red-500'}`}>
                        {formatAmount(stats.balance || 0)}
                      </p>
                      <p className="text-gray-400 text-xs">Balance</p>
                    </div>
                  </div>

                  {/* Settled badge */}
                  {stats.settled > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-center">
                      <span className="text-xs text-green-600 font-medium">
                        ✅ {formatAmount(stats.settled)} settled
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}