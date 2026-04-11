'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { createNotificationForMany } from '@/lib/notifications';

export default function AddTaskPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [organisers, setOrganisers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      const user = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      setUserData(user);

      const orgQ = query(collection(db, 'shivirOrganisers'), where('phone', '==', currentUser.phoneNumber));
      const orgSnap = await getDocs(orgQ);
      if (!orgSnap.empty) {
        const shivirId = orgSnap.docs[0].data().shivirId;
        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });
          const allOrgQ = query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivirId));
          const allOrgSnap = await getDocs(allOrgQ);
          setOrganisers(allOrgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleAssign = (phone: string) => {
    setAssignedTo(prev =>
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const saveTask = async () => {
    setMessage('');
    if (!title.trim()) { setMessage('Please enter task title'); return; }
    if (assignedTo.length === 0) { setMessage('Please assign to at least one Aayojak'); return; }

    setSaving(true);
    try {
      const assignedToNames = organisers
        .filter(o => assignedTo.includes(o.phone))
        .map(o => o.name);

      await addDoc(collection(db, 'tasks'), {
        shivirId: shivir.id,
        shivirName: shivir.name,
        title: title.trim(),
        description: description.trim(),
        deadline,
        priority,
        assignedTo,
        assignedToNames,
        status: 'todo',
        createdBy: userData.phone,
        createdByName: userData.name,
        createdAt: new Date(),
      });

      setMessage('✅ Task created successfully!');

      // Notify all assigned Aayojak
      try {
        const othersToNotify = assignedTo.filter(p => p !== userData.phone);
        if (othersToNotify.length > 0) {
          await createNotificationForMany({
            phones: othersToNotify,
            title: '✅ New Task Assigned',
            body: `${userData.name} assigned you: "${title.trim()}" — ${priority} priority`,
            type: 'task_assigned',
            shivirId: shivir.id,
          });
        }
      } catch (e) {}

      setTimeout(() => {
        window.location.href = '/organiser/tasks';
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
          <button onClick={() => window.location.href = '/organiser/tasks'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">✅ Add Task</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">Task Title *</label>
            <input type="text" placeholder="e.g. Book the hall, Arrange prasad"
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
          </div>

          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">Description (Optional)</label>
            <textarea placeholder="Any details about this task..."
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
          </div>

          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-2">Priority *</label>
            <div className="flex gap-2">
              {[
                { key: 'high', label: '🔴 High', color: 'bg-red-500' },
                { key: 'medium', label: '🟡 Medium', color: 'bg-yellow-500' },
                { key: 'low', label: '🟢 Low', color: 'bg-green-500' },
              ].map(p => (
                <button key={p.key} onClick={() => setPriority(p.key as any)}
                  className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${
                    priority === p.key ? `${p.color} text-white` : 'bg-orange-50 text-gray-600'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-600 text-sm font-medium mb-1">Deadline (Optional)</label>
            <input type="date" value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-400" />
          </div>

          <div className="mb-6">
            <label className="block text-gray-600 text-sm font-medium mb-2">
              Assign To * ({assignedTo.length} selected)
            </label>
            <div className="space-y-2">
              {organisers.map((org: any) => (
                <button key={org.phone} onClick={() => toggleAssign(org.phone)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                    assignedTo.includes(org.phone)
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white hover:border-orange-300'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      assignedTo.includes(org.phone) ? 'bg-orange-500' : 'bg-gray-300'
                    }`}>
                      {org.name?.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-700 text-sm">{org.name}</p>
                      <p className="text-gray-400 text-xs">{org.phone}</p>
                    </div>
                  </div>
                  {assignedTo.includes(org.phone) && (
                    <span className="text-orange-500 font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <p className={`text-sm mb-4 ${message.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {message}
            </p>
          )}

          <button onClick={saveTask} disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : '✅ Create Task'}
          </button>

        </div>
      </div>
    </div>
  );
}