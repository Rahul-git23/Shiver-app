 'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login';
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-orange-500 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-orange-600">🕉️ Shivir App</h1>
              <p className="text-gray-500 text-sm">Welcome back!</p>
            </div>
            <button
              onClick={() => { auth.signOut(); window.location.href = '/login'; }}
              className="text-red-400 text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="font-bold text-gray-700 mb-3">Your Account</h2>
          <p className="text-gray-600">📱 Phone: {user?.phoneNumber}</p>
          <p className="text-gray-400 text-sm mt-2">Role: Setting up...</p>
        </div>

        {/* Coming Soon */}
        <div className="bg-orange-100 rounded-2xl p-6 text-center">
          <div className="text-3xl mb-2">🚧</div>
          <p className="text-orange-700 font-medium">Dashboard coming soon!</p>
          <p className="text-orange-500 text-sm mt-1">We are building this step by step</p>
        </div>

      </div>
    </div>
  );
}
