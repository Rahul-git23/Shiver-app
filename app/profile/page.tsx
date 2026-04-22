'use client';

import { useEffect, useRef, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const DRESS_CODE: Record<string, string> = {
  organiser: '🟡 Yellow Guru Chader',
  sishya: '⬜ White Kurta',
  dispatch: '⬜ White Kurta',
  admin: '⬜ White Kurta',
  gurudev: '🟡 Yellow Guru Chader',
};

export default function ProfilePage() {
  const [userData, setUserData] = useState<any>(null);
  const [userDocId, setUserDocId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const q = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const snap = await getDocs(q);
      if (snap.empty) { window.location.href = '/access-denied'; return; }
      setUserDocId(snap.docs[0].id);
      setUserData({ id: snap.docs[0].id, ...snap.docs[0].data() });
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMessage('Only image files allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage('File must be under 5MB.'); return; }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile || !userDocId) return;
    setUploading(true);
    setMessage('');
    try {
      const storageRef = ref(getStorage(), `profilePhotos/${userData.phone}`);
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', userDocId), {
        photoPending: downloadURL,
        photoStatus: 'pending',
      });
      setUserData((prev: any) => ({ ...prev, photoPending: downloadURL, photoStatus: 'pending' }));
      setSelectedFile(null);
      setPreview('');
      setMessage('✅ Photo submitted! Awaiting Super Admin approval.');
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setUploading(false);
  };

  const goBack = () => {
    const role = userData?.role;
    if (role === 'organiser') window.location.href = '/organiser';
    else if (role === 'sishya') window.location.href = '/sishya';
    else if (role === 'dispatch') window.location.href = '/dispatch';
    else if (role === 'admin') window.location.href = '/admin';
    else window.location.href = '/super-admin';
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  const status = userData?.photoStatus || 'none';
  const approvedPhoto = userData?.photoURL;
  const pendingPhoto = userData?.photoPending;
  const dressCode = DRESS_CODE[userData?.role] || '⬜ White Kurta';

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={goBack} className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">👤 My Profile</h1>
            <p className="text-gray-400 text-xs">{userData?.name} Ji</p>
          </div>
        </div>

        {/* Current Photo */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4 flex flex-col items-center">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-orange-200 mb-3">
            {approvedPhoto ? (
              <img src={approvedPhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-orange-100 flex items-center justify-center text-5xl">🙏</div>
            )}
          </div>
          <p className="font-bold text-gray-700 text-lg">{userData?.name} Ji</p>
          <p className="text-gray-400 text-sm capitalize">{userData?.role === 'organiser' ? 'Aayojak' : userData?.role}</p>

          {/* Status badge */}
          {status === 'pending' && (
            <span className="mt-2 bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full">
              ⏳ Photo pending approval
            </span>
          )}
          {status === 'approved' && (
            <span className="mt-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
              ✅ Photo approved
            </span>
          )}
          {status === 'rejected' && (
            <div className="mt-2 text-center">
              <span className="bg-red-100 text-red-600 text-xs font-semibold px-3 py-1 rounded-full">
                ❌ Photo rejected
              </span>
              {userData?.photoRejectedReason && (
                <p className="text-red-400 text-xs mt-1">{userData.photoRejectedReason}</p>
              )}
            </div>
          )}
        </div>

        {/* Dress Code Reminder */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
          <p className="text-orange-700 font-semibold text-sm mb-1">📋 Dress Code</p>
          <p className="text-orange-600 text-sm">{dressCode}</p>
          <p className="text-gray-400 text-xs mt-1">
            Please upload a photo in the correct dress code for approval.
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-bold text-gray-700 mb-4">
            {status === 'approved' ? 'Update Photo' : 'Upload Photo'}
          </h3>

          {/* Pending photo preview */}
          {status === 'pending' && pendingPhoto && !preview && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Submitted photo (awaiting approval):</p>
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-yellow-200">
                <img src={pendingPhoto} alt="Pending" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {preview ? (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Preview:</p>
              <div className="w-32 h-32 rounded-xl overflow-hidden border border-orange-200 mb-3">
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => { setSelectedFile(null); setPreview(''); }}
                className="text-xs text-gray-400 underline">
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-orange-300 rounded-xl p-6 text-center mb-4 hover:bg-orange-50">
              <p className="text-orange-500 font-medium">+ Choose Photo</p>
              <p className="text-gray-400 text-xs mt-1">JPG, PNG or WebP · Max 5MB</p>
            </button>
          )}

          {message && (
            <p className={`text-sm mb-3 ${message.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {message}
            </p>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-40">
            {uploading ? 'Uploading...' : '🙏 Submit for Approval'}
          </button>
        </div>

      </div>
    </div>
  );
}
