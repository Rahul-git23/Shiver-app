 'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { createNotificationForMany } from '@/lib/notifications';

const DEFAULT_CATEGORIES = [
  'Hall/Venue', 'Food/Prasad', 'Decoration', 'Sound/Lighting',
  'Transport', 'Printing', 'Samagri', 'Accommodation',
  'Gurudev Arrangements', 'Sishya Arrangements', 'Miscellaneous'
];

export default function AddExpensePage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [category, setCategory] = useState('Hall/Venue');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [phase, setPhase] = useState<'planning' | 'approved'>('planning');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      setUserData({ id: userSnap.docs[0].id, ...userSnap.docs[0].data() });

      const orgQ = query(collection(db, 'shivirOrganisers'), where('phone', '==', currentUser.phoneNumber));
      const orgSnap = await getDocs(orgQ);
      if (!orgSnap.empty) {
        const shivirId = orgSnap.docs[0].data().shivirId;
        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const addCustomCategory = () => {
    if (!customCategory.trim()) return;
    const newCat = customCategory.trim();
    setCategories([...categories, newCat]);
    setCategory(newCat);
    setCustomCategory('');
    setShowCustomCategory(false);
  };

  const saveExpense = async () => {
    setMessage('');
    if (!vendorName) { setMessage('Please enter vendor/description'); return; }
    if (!estimatedAmount || isNaN(Number(estimatedAmount)) || Number(estimatedAmount) <= 0) {
      setMessage('Please enter valid amount'); return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        shivirId: shivir.id,
        shivirName: shivir.name,
        category,
        vendorName: vendorName.trim(),
        estimatedAmount: Number(estimatedAmount),
        remarks: remarks.trim(),
        phase,
        status: 'pending',
        proposedBy: userData.phone,
        proposedByName: userData.name,
        seenBy: [userData.phone],
        votes: [],
        createdAt: new Date(),
      });

      setMessage('✅ Expense added successfully!');

      // Notify all other organisers to vote
      try {
        const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivir.id)));
        const otherOrganisers = orgSnap.docs
          .map(d => d.data().phone)
          .filter(p => p !== userData.phone);
        if (otherOrganisers.length > 0) {
          await createNotificationForMany({
            phones: otherOrganisers,
            title: '🗳️ New Expense Added',
            body: `${userData.name} added ₹${Number(estimatedAmount).toLocaleString('en-IN')} for ${category} — tap to vote`,
            type: 'expense_vote',
            shivirId: shivir.id,
          });
        }
      } catch (e) {}

      setTimeout(() => {
        window.location.href = '/organiser/expenses';
      }, 1500);

    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setSaving(false);
  };

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
          <button onClick={() => window.location.href = '/organiser/expenses'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">📋 Add Expense</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          {/* Phase Selection */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-2">Phase *</label>
            <div className="flex gap-2">
              <button onClick={() => setPhase('planning')}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${
                  phase === 'planning' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-gray-600'
                }`}>
                🗓️ Shivir Planning
              </button>
              <button onClick={() => setPhase('approved')}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${
                  phase === 'approved' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-gray-600'
                }`}>
                ✅ Shivir Expenses
              </button>
            </div>
          </div>

          {/* Category Selection */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-2">Category *</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium text-left transition-colors ${
                    category === cat ? 'bg-orange-500 text-white' : 'bg-orange-50 text-gray-600 hover:bg-orange-100'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Add Custom Category */}
            {!showCustomCategory ? (
              <button onClick={() => setShowCustomCategory(true)}
                className="w-full py-2 border-2 border-dashed border-orange-300 rounded-xl text-orange-500 text-sm font-medium hover:bg-orange-50 transition-colors">
                + Add Custom Category
              </button>
            ) : (
              <div className="flex gap-2 mt-2">
                <input type="text" placeholder="Category name" value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                <button onClick={addCustomCategory}
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold">
                  Add
                </button>
                <button onClick={() => setShowCustomCategory(false)}
                  className="text-gray-400 px-2 py-2 rounded-lg text-sm">
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Vendor/Description */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Vendor / Description *
            </label>
            <input type="text" placeholder="e.g. Sharma Tent House, Prasad from XYZ"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
          </div>

          {/* Estimated Amount */}
          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Estimated Amount (₹) *
            </label>
            <input type="number" placeholder="Enter amount"
              value={estimatedAmount}
              onChange={(e) => setEstimatedAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400 text-lg font-bold" />
          </div>

          {/* Remarks */}
          <div className="mb-6">
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Remarks (Optional)
            </label>
            <textarea placeholder="Any details about this expense..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
          </div>

          {message && (
            <p className={`text-sm mb-4 ${message.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {message}
            </p>
          )}

          <button onClick={saveExpense} disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : '📋 Submit Expense'}
          </button>

        </div>
      </div>
    </div>
  );
}
