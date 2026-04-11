'use client';

import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

export default function TasksSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: shivirId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [shivir, setShivir] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = '/login'; return; }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('viewer') === 'admin') setIsAdminViewer(true);

      const shivirDoc = await getDoc(doc(db, 'shivirs', shivirId));
      if (shivirDoc.exists()) setShivir({ id: shivirDoc.id, ...shivirDoc.data() });

      const taskSnap = await getDocs(query(collection(db, 'tasks'), where('shivirId', '==', shivirId)));
      const taskList = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      taskList.sort((a: any, b: any) => {
        const priority: any = { high: 0, medium: 1, low: 2 };
        return (priority[a.priority] || 1) - (priority[b.priority] || 1);
      });
      setTasks(taskList);

      setLoading(false);
    });
    return () => unsubscribe();
  }, [shivirId]);

  const goBack = () => {
    const adminQuery = isAdminViewer ? '?viewer=admin' : '';
    window.location.href = `/super-admin/shivir/${shivirId}${adminQuery}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-4xl mx-auto">

        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={goBack} className="text-orange-500 font-bold text-lg">←</button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-orange-600">✅ Tasks</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-700 text-lg">{tasks.length}</p>
            <p className="text-gray-400 text-xs">{tasks.filter(t => t.status === 'done').length} done</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          {tasks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No tasks yet</p>
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="p-3 bg-orange-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-700 text-sm">{t.title}</p>
                      <p className="text-gray-400 text-xs">Assigned to: {Array.isArray(t.assignedToNames) ? t.assignedToNames.join(', ') : t.assignedToNames || t.assignedTo}</p>
                      {t.deadline && (
                        <p className={`text-xs mt-1 ${new Date(t.deadline) < new Date() && t.status !== 'done' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          📅 {new Date(t.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {new Date(t.deadline) < new Date() && t.status !== 'done' && ' · Overdue'}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.priority === 'high' ? 'bg-red-100 text-red-500' :
                        t.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>{t.priority}</span>
                      <p className={`text-xs mt-1 ${
                        t.status === 'done' ? 'text-green-600' :
                        t.status === 'inProgress' ? 'text-blue-500' : 'text-gray-400'
                      }`}>{t.status === 'inProgress' ? 'In Progress' : t.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}