'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ContactsPage() {
  const [shivirName, setShivirName] = useState('');
  const [contacts, setContacts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const q = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const snap = await getDocs(q);
      if (snap.empty || snap.docs[0].data().role !== 'sishya') {
        window.location.href = '/access-denied'; return;
      }

      const phone = currentUser.phoneNumber!;

      const sishyaQ = query(collection(db, 'shivirSishya'), where('phone', '==', phone));
      const sishyaSnap = await getDocs(sishyaQ);
      if (!sishyaSnap.empty) {
        const sid = sishyaSnap.docs[0].data().shivirId;

        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', sid)));
        if (!shivirSnap.empty) setShivirName(shivirSnap.docs[0].data().name);

        const cQ = query(
          collection(db, 'sishyaArrangements'),
          where('phone', '==', phone),
          where('shivirId', '==', sid)
        );
        const cSnap = await getDocs(cQ);
        if (!cSnap.empty) setContacts(cSnap.docs[0].data());
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  const hasContacts = contacts &&
    contacts.volunteers &&
    contacts.volunteers.length > 0 &&
    contacts.volunteers[0].name;

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">📞 My Contacts</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        {hasContacts ? (
          <div className="space-y-4">

            <p className="text-gray-500 text-sm px-1">
              These volunteers have been assigned to help you during the Shivir.
              Please save their numbers.
            </p>

            {contacts.volunteers.map((v: any, i: number) => (
              v.name ? (
                <div key={i} className="bg-white rounded-2xl shadow p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                        🙏
                      </div>
                      <div>
                        <p className="font-bold text-gray-700">{v.name} Ji</p>
                        {v.role && (
                          <p className="text-xs text-gray-400">{v.role}</p>
                        )}
                      </div>
                    </div>
                    {i === 0 && (
                      <span className="bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>

                  {v.phone && (
                    <a href={`tel:${v.phone}`}
                      className="w-full bg-green-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                      📞 Call {v.name} Ji
                    </a>
                  )}
                </div>
              ) : null
            ))}

            {contacts.contactNotes && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-xs text-orange-500 font-semibold mb-1">📝 Notes from Aayojak</p>
                <p className="text-gray-600 text-sm">{contacts.contactNotes}</p>
              </div>
            )}

          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">📞</div>
            <h3 className="font-bold text-gray-600 text-lg mb-2">Not Assigned Yet</h3>
            <p className="text-gray-400 text-sm">
              Your volunteer contacts will appear here once the Aayojak assigns them.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}