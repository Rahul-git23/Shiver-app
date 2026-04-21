'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AddCollectionPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [phone, setPhone] = useState('');
  const [sadhakName, setSadhakName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remark, setRemark] = useState('');

  const [existingDonation, setExistingDonation] = useState<any>(null);
  const [isReturning, setIsReturning] = useState(false);
  const [phoneChecked, setPhoneChecked] = useState(false);

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

  const checkPhone = async () => {
    setMessage('');
    setExistingDonation(null);
    setIsReturning(false);
    setPhoneChecked(false);

    if (!phone || phone.length !== 10) {
      setMessage('Please enter a valid 10-digit number');
      return;
    }

    const fullPhone = '+91' + phone;
    
    // Step 1: Get ALL contributions for this Shivir and filter in code
    if (!shivir) {
      setMessage('Shivir not loaded yet. Please wait and try again.');
      return;
    }
    if (shivir) {
      const shivirColQ = query(
        collection(db, 'contributions'),
        where('shivirId', '==', shivir.id)
      );
      const shivirColSnap = await getDocs(shivirColQ);
      const allCols = shivirColSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Find if this phone already donated in this Shivir
      const found = allCols.find((c: any) => c.sadhakPhone === fullPhone);
      if (found) {
        setExistingDonation(found);
        return; // Stop here — show existing donation warning
      }
    }

    // Step 2: Check past Shivirs for returning Sadhak
    const pastQ = query(collection(db, 'contributions'), where('sadhakPhone', '==', fullPhone));
    const pastSnap = await getDocs(pastQ);
    if (!pastSnap.empty) {
      setIsReturning(true);
      const pastData = pastSnap.docs[0].data();
      setSadhakName(pastData.sadhakName || '');
      setCity(pastData.city || '');
      setState(pastData.state || '');
    }

    setPhoneChecked(true);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const saveCollection = async () => {
    setMessage('');
    if (!phone || phone.length !== 10) { setMessage('Please enter valid phone number'); return; }
    if (!sadhakName) { setMessage('Please enter Sadhak name'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setMessage('Please enter valid amount'); return; }
    if (!phoneChecked) { setMessage('Please check phone number first'); return; }

    setSaving(true);
    try {
      await addDoc(collection(db, 'contributions'), {
        shivirId: shivir.id,
        shivirName: shivir.name,
        sadhakName: sadhakName.trim(),
        sadhakPhone: '+91' + phone,
        city: city.trim(),
        state: state.trim(),
        amount: Number(amount),
        paymentMode,
        remark: remark.trim(),
        addedBy: userData.phone,
        addedByName: userData.name,
        isReturning,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      setMessage('✅ Sahyog recorded successfully! 🙏');
      setPhone('');
      setSadhakName('');
      setCity('');
      setState('');
      setAmount('');
      setPaymentMode('Cash');
      setRemark('');
      setExistingDonation(null);
      setIsReturning(false);
      setPhoneChecked(false);

      setTimeout(() => {
        window.location.href = '/organiser/collections';
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

        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/organiser/collections'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">💰 Record Sahyog</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Sadhak Phone Number *
            </label>
            <div className="flex gap-2">
              <span className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-3 text-gray-600">+91</span>
              <input
                type="tel"
                placeholder="10-digit number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setPhoneChecked(false);
                  setExistingDonation(null);
                  setIsReturning(false);
                }}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400"
              />
              <button onClick={checkPhone}
                className="bg-orange-500 text-white font-bold px-4 py-2 rounded-lg text-sm">
                Check
              </button>
            </div>
            {message && !phoneChecked && (
              <p className="text-red-500 text-sm mt-1">{message}</p>
            )}
          </div>

          {/* Existing Donation Warning */}
          {existingDonation && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-orange-700 mb-2">
                ⚠️ {existingDonation.sadhakName} Ji has already donated in this Shivir
              </p>
              <p className="text-gray-600 text-sm">💰 Amount: ₹{existingDonation.amount?.toLocaleString('en-IN')}</p>
              <p className="text-gray-600 text-sm">📅 Date: {formatDate(existingDonation.createdAt)}</p>
              <p className="text-gray-600 text-sm">👤 Collected by: {existingDonation.addedByName}</p>
              <button
                onClick={() => {
                  setSadhakName(existingDonation.sadhakName);
                  setCity(existingDonation.city || '');
                  setState(existingDonation.state || '');
                  setExistingDonation(null);
                  setPhoneChecked(true);
                }}
                className="w-full mt-3 bg-orange-500 text-white font-bold py-2 rounded-xl text-sm">
                Contribute More 🙏
              </button>
            </div>
          )}

          {/* Returning Sadhak Badge */}
          {isReturning && phoneChecked && !existingDonation && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
              <p className="text-green-700 text-sm font-medium">
                🙏 Returning Sadhak — details auto-filled
              </p>
            </div>
          )}

          {/* Form fields */}
          {phoneChecked && !existingDonation && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">Sadhak Name *</label>
                <input type="text" placeholder="Enter full name" value={sadhakName}
                  onChange={(e) => setSadhakName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-gray-600 text-sm font-medium mb-1">City</label>
                  <input type="text" placeholder="City" value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
                <div className="flex-1">
                  <label className="block text-gray-600 text-sm font-medium mb-1">State</label>
                  <input type="text" placeholder="State" value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">Amount (₹) *</label>
                <input type="number" placeholder="Enter amount" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400 text-lg font-bold" />
              </div>

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">Payment Mode *</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Cash', 'UPI', 'Bank Transfer', 'Cheque'].map((mode) => (
                    <button key={mode} onClick={() => setPaymentMode(mode)}
                      className={`py-3 rounded-xl font-medium text-sm transition-colors ${
                        paymentMode === mode ? 'bg-orange-500 text-white' : 'bg-orange-50 text-gray-600 hover:bg-orange-100'
                      }`}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">Remark (Optional)</label>
                <textarea placeholder="Any notes..." value={remark}
                  onChange={(e) => setRemark(e.target.value)} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
              </div>

              {message && (
                <p className={`text-sm ${message.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                  {message}
                </p>
              )}

              <button onClick={saveCollection} disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : '🙏 Record Sahyog'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}