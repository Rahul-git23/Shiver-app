 'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        { size: 'invisible' }
      );
    }
  };

  const sendOTP = async () => {
    setError('');
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      setupRecaptcha();
      const phoneNumber = '+91' + phone;
      const appVerifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const verifyOTP = async () => {
    setError('');
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      await confirmationResult.confirm(otp);
      const superAdminPhone = process.env.NEXT_PUBLIC_SUPER_ADMIN_PHONE;
      const userPhone = '+91' + phone;
      if (userPhone === superAdminPhone) {
        window.location.href = '/super-admin';
      } else {
        const q = query(collection(db, 'users'), where('phone', '==', userPhone));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          window.location.href = '/access-denied';
        } else {
          const userData = snapshot.docs[0].data();
          if (userData.status === 'deactivated') {
            window.location.href = '/access-denied';
            return;
          }
          if (userData.role === 'organiser') {
            window.location.href = '/organiser';
          } else if (userData.role === 'sishya') {
            window.location.href = '/sishya';
          } else if (userData.role === 'gurudev') {
            window.location.href = '/super-admin';
          } else if (userData.role === 'admin') {
            window.location.href = '/admin';
          } else if (userData.role === 'dispatch') {
            window.location.href = '/dispatch';
          } else {
            window.location.href = '/access-denied';
          }
        }
      }
    } catch (err: any) {
      setError('Invalid OTP. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🕉️</div>
          <h1 className="text-2xl font-bold text-orange-600">Shivir App</h1>
          <p className="text-gray-500 text-sm mt-1">Gurudham Management System</p>
        </div>

        {/* Phone Step */}
        {step === 'phone' && (
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Mobile Number
            </label>
            <div className="flex gap-2 mb-4">
              <span className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-3 text-gray-600 font-medium">
                +91
              </span>
              <input
                type="tel"
                placeholder="Enter 10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-orange-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              onClick={sendOTP}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg text-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        )}

        {/* OTP Step */}
        {step === 'otp' && (
          <div>
            <p className="text-gray-600 mb-4 text-center">
              OTP sent to <strong>+91 {phone}</strong>
            </p>
            <label className="block text-gray-700 font-medium mb-2">
              Enter OTP
            </label>
            <input
              type="tel"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg text-center tracking-widest focus:outline-none focus:border-orange-400 mb-4"
            />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              onClick={verifyOTP}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg text-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              onClick={() => { setStep('phone'); setError(''); }}
              className="w-full mt-3 text-orange-500 font-medium py-2"
            >
              Change Number
            </button>
          </div>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}
