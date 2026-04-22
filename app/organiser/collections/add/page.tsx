'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { INDIA_STATES, INDIA_DISTRICTS } from '@/lib/india-locations';

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

  const [pincode, setPincode] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState('');
  const [districtPincodes, setDistrictPincodes] = useState<string[]>([]);
  const [districtPincodesLoading, setDistrictPincodesLoading] = useState(false);

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

      const savedShivirId = localStorage.getItem('selectedShivirId');
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const myShivirIds = orgSnap.docs
        .filter(d => d.data().phone === currentUser.phoneNumber)
        .map(d => d.data().shivirId);

      if (myShivirIds.length > 0) {
        const shivirId = (savedShivirId && myShivirIds.includes(savedShivirId))
          ? savedShivirId : myShivirIds[0];
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

  const handleStateChange = (newState: string) => {
    setState(newState);
    setCity('');
    setPincode('');
    setDistrictPincodes([]);
    setPincodeError('');
  };

  const fetchDistrictPincodes = async (district: string) => {
    if (!district) return;
    setDistrictPincodesLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(district)}`);
      const data = await res.json();
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const pincodes = [...new Set<string>(
          data[0].PostOffice
            .filter((po: any) => po.District?.toLowerCase() === district.toLowerCase())
            .map((po: any) => String(po.Pincode))
        )].sort();
        setDistrictPincodes(pincodes);
      } else {
        setDistrictPincodes([]);
      }
    } catch {
      setDistrictPincodes([]);
    }
    setDistrictPincodesLoading(false);
  };

  const handleDistrictChange = (district: string) => {
    setCity(district);
    setPincode('');
    setDistrictPincodes([]);
    setPincodeError('');
    if (!state && district) {
      const parentState = Object.entries(INDIA_DISTRICTS)
        .find(([, districts]) => districts.includes(district))?.[0];
      if (parentState) setState(parentState);
    }
    if (district) fetchDistrictPincodes(district);
  };

  const lookupPincode = async (value: string) => {
    setPincode(value);
    setPincodeError('');
    if (value.length !== 6) return;
    setPincodeLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${value}`);
      const data = await res.json();
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        const fetchedDistrict = po.District || po.Block || '';
        const fetchedState = po.State || '';
        setCity(fetchedDistrict);
        setState(fetchedState);
        setPincodeError('');
        if (fetchedDistrict && fetchedDistrict !== city) {
          fetchDistrictPincodes(fetchedDistrict);
        }
      } else {
        setPincodeError('Pincode not found. Please select district/state manually.');
      }
    } catch {
      setPincodeError('Could not fetch pincode data. Please select manually.');
    }
    setPincodeLoading(false);
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

      // Notify all other organisers of this Shivir
      try {
        const { createNotificationForMany } = await import('@/lib/notifications');
        const orgSnap2 = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivir.id)));
        const otherOrganisers = orgSnap2.docs
          .map(d => d.data().phone)
          .filter((p: string) => p !== userData.phone);
        if (otherOrganisers.length > 0) {
          await createNotificationForMany({
            phones: otherOrganisers,
            title: '💰 New Collection Recorded',
            body: `${userData.name} collected ₹${Number(amount).toLocaleString('en-IN')} from ${sadhakName.trim()} Ji (${paymentMode})`,
            type: 'collection_added',
            shivirId: shivir.id,
          });
        }
      } catch (_) {}

      setMessage('✅ Sahyog recorded successfully! 🙏');
      setPhone('');
      setSadhakName('');
      setCity('');
      setState('');
      setPincode('');
      setPincodeError('');
      setDistrictPincodes([]);
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

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">
                  State
                  {state && <span className="text-green-500 ml-1 text-xs">✓</span>}
                </label>
                <select
                  value={state}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400 bg-white"
                >
                  <option value="">Select State</option>
                  {INDIA_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">
                  District
                  {city && <span className="text-green-500 ml-1 text-xs">✓</span>}
                </label>
                <select
                  value={city}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={!state}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{state ? 'Select District' : 'Select State first'}</option>
                  {(INDIA_DISTRICTS[state] ?? []).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-600 text-sm font-medium mb-1">
                  Pincode
                  {districtPincodesLoading && <span className="text-orange-400 ml-1 text-xs">Fetching pincodes...</span>}
                  {!districtPincodesLoading && districtPincodes.length > 0 && (
                    <span className="text-green-500 ml-1 text-xs">{districtPincodes.length} pincodes available</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    list="pincode-options"
                    placeholder={city ? `Enter or select pincode for ${city}` : 'Enter 6-digit pincode'}
                    value={pincode}
                    onChange={(e) => lookupPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400"
                  />
                  <datalist id="pincode-options">
                    {districtPincodes.map(p => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  {pincodeLoading && (
                    <span className="absolute right-3 top-3.5 text-orange-400 text-sm">Looking up...</span>
                  )}
                </div>
                {pincodeError && (
                  <p className="text-orange-500 text-xs mt-1">{pincodeError}</p>
                )}
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