'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

interface Volunteer {
  name: string;
  phone: string;
  role: string;
}

interface SishyaVolunteers {
  phone: string;
  name: string;
  volunteers: Volunteer[];
  contactNotes: string;
}

const emptyVolunteer = (): Volunteer => ({ name: '', phone: '', role: '' });

export default function OrganiserVolunteerPage() {
  const [shivirId, setShivirId] = useState('');
  const [shivirName, setShivirName] = useState('');
  const [sishyaList, setSishyaList] = useState<SishyaVolunteers[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPhone, setSavingPhone] = useState<string | null>(null);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const phone = currentUser.phoneNumber!;

      const usersSnap = await getDocs(collection(db, 'users'));
      const userDoc = usersSnap.docs.find(d => d.data().phone === phone);
      if (!userDoc || userDoc.data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }

      const savedShivirId = localStorage.getItem('selectedShivirId');
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const myShivirIds = orgSnap.docs.filter(d => d.data().phone === phone).map(d => d.data().shivirId);
      if (myShivirIds.length === 0) { setLoading(false); return; }

      const sid = (savedShivirId && myShivirIds.includes(savedShivirId)) ? savedShivirId : myShivirIds[0];
      setShivirId(sid);

      const shivirSnap = await getDocs(collection(db, 'shivirs'));
      const shivirDoc = shivirSnap.docs.find(d => d.id === sid);
      if (shivirDoc) setShivirName(shivirDoc.data().name);

      const sishyaSnap = await getDocs(collection(db, 'shivirSishya'));
      const list = sishyaSnap.docs.filter(d => d.data().shivirId === sid).map(d => d.data());

      const arrSnap = await getDocs(collection(db, 'sishyaArrangements'));
      const arrMap: any = {};
      arrSnap.docs.filter(d => d.data().shivirId === sid).forEach(d => {
        arrMap[d.data().phone] = d.data();
      });

      setSishyaList(list.map(s => ({
        phone: s.phone,
        name: s.name,
        volunteers: arrMap[s.phone]?.volunteers?.length > 0
          ? arrMap[s.phone].volunteers
          : [emptyVolunteer()],
        contactNotes: arrMap[s.phone]?.contactNotes || '',
      })));

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateVolunteer = (sishyaPhone: string, index: number, field: keyof Volunteer, value: string) => {
    setSishyaList(prev => prev.map(s => {
      if (s.phone !== sishyaPhone) return s;
      const vols = [...s.volunteers];
      vols[index] = { ...vols[index], [field]: value };
      return { ...s, volunteers: vols };
    }));
  };

  const addVolunteer = (sishyaPhone: string) => {
    setSishyaList(prev => prev.map(s =>
      s.phone === sishyaPhone ? { ...s, volunteers: [...s.volunteers, emptyVolunteer()] } : s
    ));
  };

  const removeVolunteer = (sishyaPhone: string, index: number) => {
    setSishyaList(prev => prev.map(s => {
      if (s.phone !== sishyaPhone) return s;
      const vols = s.volunteers.filter((_, i) => i !== index);
      return { ...s, volunteers: vols.length > 0 ? vols : [emptyVolunteer()] };
    }));
  };

  const updateNotes = (sishyaPhone: string, notes: string) => {
    setSishyaList(prev => prev.map(s => s.phone === sishyaPhone ? { ...s, contactNotes: notes } : s));
  };

  const saveSishya = async (s: SishyaVolunteers) => {
    setSavingPhone(s.phone);
    try {
      await setDoc(doc(db, 'sishyaArrangements', `${shivirId}_${s.phone}`), {
        shivirId,
        phone: s.phone,
        name: s.name,
        volunteers: s.volunteers,
        contactNotes: s.contactNotes,
      }, { merge: true });
      setSavedPhone(s.phone);
      setTimeout(() => setSavedPhone(null), 2500);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSavingPhone(null);
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
          <button onClick={() => window.location.href = '/organiser/sishya'}
            className="text-orange-500 text-xl font-bold">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">🤝 Volunteer Contacts</h1>
            <p className="text-gray-400 text-xs">{shivirName}</p>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4">
          <p className="text-orange-600 text-sm">
            Assign volunteers to each Sishya. They will see these contacts in their dashboard.
          </p>
        </div>

        {sishyaList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">🙏</div>
            <p className="text-gray-400">No Sishya assigned to this Shivir yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sishyaList.map(s => {
              const isSaving = savingPhone === s.phone;
              const isSaved = savedPhone === s.phone;
              return (
                <div key={s.phone} className="bg-white rounded-2xl shadow p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">🙏</div>
                    <div>
                      <p className="font-bold text-gray-700">{s.name} Ji</p>
                      <p className="text-gray-400 text-xs">{s.phone}</p>
                    </div>
                  </div>

                  <p className="text-xs text-orange-500 font-semibold uppercase mb-3">Assigned Volunteers</p>

                  <div className="space-y-3">
                    {s.volunteers.map((v, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-orange-500 font-semibold">
                            {i === 0 ? '⭐ Primary Contact' : `Contact ${i + 1}`}
                          </span>
                          {s.volunteers.length > 1 && (
                            <button onClick={() => removeVolunteer(s.phone, i)}
                              className="text-red-400 text-xs hover:text-red-600">Remove</button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <input type="text" placeholder="Volunteer name"
                            value={v.name}
                            onChange={e => updateVolunteer(s.phone, i, 'name', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="tel" placeholder="Phone number"
                              value={v.phone}
                              onChange={e => updateVolunteer(s.phone, i, 'phone', e.target.value)}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white" />
                            <input type="text" placeholder="Role (optional)"
                              value={v.role}
                              onChange={e => updateVolunteer(s.phone, i, 'role', e.target.value)}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => addVolunteer(s.phone)}
                    className="w-full border border-dashed border-orange-300 rounded-xl p-2 text-sm text-orange-500 hover:bg-orange-50 mt-3">
                    + Add Another Volunteer
                  </button>

                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-1">Notes for Sishya</label>
                    <textarea placeholder="Any contact-related instructions..."
                      value={s.contactNotes}
                      onChange={e => updateNotes(s.phone, e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none" />
                  </div>

                  <button
                    onClick={() => saveSishya(s)}
                    disabled={isSaving}
                    className={`w-full font-bold py-3 rounded-xl text-sm mt-4 transition-colors ${
                      isSaved ? 'bg-green-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'
                    } disabled:opacity-50`}>
                    {isSaving ? 'Saving...' : isSaved ? '✅ Saved!' : 'Save Contacts'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
