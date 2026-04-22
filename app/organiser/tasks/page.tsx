 'use client';

import { formatShivirDates, formatShivirLocation } from '@/lib/utils'; 
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function TasksPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'my'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'inprogress' | 'done'>('all');

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

      const savedShivirId = localStorage.getItem('selectedShivirId');
      const orgSnap = await getDocs(collection(db, 'shivirOrganisers'));
      const myShivirIds = orgSnap.docs
        .filter(d => d.data().phone === currentUser.phoneNumber)
        .map(d => d.data().shivirId);

      if (myShivirIds.length === 0) { setLoading(false); return; }

      const shivirId = (savedShivirId && myShivirIds.includes(savedShivirId))
        ? savedShivirId : myShivirIds[0];

      if (shivirId) {
        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });

          const taskQ = query(collection(db, 'tasks'), where('shivirId', '==', shivirId));
          const taskSnap = await getDocs(taskQ);
          const taskList = taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          taskList.sort((a: any, b: any) => {
            const priority = { high: 0, medium: 1, low: 2 };
            return (priority[a.priority as keyof typeof priority] || 1) - (priority[b.priority as keyof typeof priority] || 1);
          });
          setTasks(taskList);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (taskId: string, newStatus: string) => {
    await updateDoc(doc(db, 'tasks', taskId), { status: newStatus });
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const hasTime = dateStr.includes('T');
    if (!hasTime) return datePart;
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${datePart}, ${timePart}`;
  };

  const isOverdue = (dateStr: string, status: string) => {
    if (!dateStr || status === 'done') return false;
    return new Date(dateStr) < new Date();
  };

  const filteredTasks = tasks.filter(t => {
    const myFilter = activeFilter === 'my' ? (t.assignedTo || []).includes(userData?.phone) : true;
    const statusMatch = statusFilter === 'all' ? true : t.status === statusFilter;
    return myFilter && statusMatch;
  });

  const myTaskCount = tasks.filter(t => (t.assignedTo || []).includes(userData?.phone)).length;
  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'inprogress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  const priorityColor = (priority: string) => {
    if (priority === 'high') return 'bg-red-100 text-red-600';
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-600';
    return 'bg-green-100 text-green-600';
  };

  const statusColor = (status: string) => {
    if (status === 'done') return 'bg-green-100 text-green-600';
    if (status === 'inprogress') return 'bg-blue-100 text-blue-600';
    return 'bg-gray-100 text-gray-600';
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
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = '/organiser'}
              className="text-orange-500 font-bold text-lg">←</button>
            <div>
              <h1 className="text-lg font-bold text-orange-600">✅ Tasks</h1>
              <p className="text-gray-500 text-xs">
                {shivir?.name} · <span className="font-bold text-orange-500">{formatShivirLocation(shivir?.city, shivir?.state)}</span>
              </p>
              <p className="text-gray-400 text-xs">
                {formatShivirDates(shivir?.startDate, shivir?.endDate)}
              </p>
            </div>
          </div>
          <button onClick={() => window.location.href = '/organiser/tasks/add'}
            className="bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
            + Add
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total', count: tasks.length, color: 'bg-orange-500 text-white' },
            { label: 'To Do', count: todoCount, color: 'bg-white text-gray-700' },
            { label: 'In Progress', count: inProgressCount, color: 'bg-white text-blue-600' },
            { label: 'Done', count: doneCount, color: 'bg-white text-green-600' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.color} rounded-2xl shadow p-3 text-center`}>
              <p className="text-xl font-bold">{stat.count}</p>
              <p className="text-xs mt-0.5 opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setActiveFilter('all')}
            className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'
            }`}>
            All Tasks ({tasks.length})
          </button>
          <button onClick={() => setActiveFilter('my')}
            className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeFilter === 'my' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'
            }`}>
            My Tasks ({myTaskCount})
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {[
            { key: 'all', label: 'All' },
            { key: 'todo', label: 'To Do' },
            { key: 'inprogress', label: 'In Progress' },
            { key: 'done', label: 'Done' },
          ].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === s.key ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-gray-400">No tasks found</p>
            <p className="text-gray-400 text-sm mt-1">Tap "+ Add" to create first task</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task: any) => (
              <div key={task.id} className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(task.priority)}`}>
                        {task.priority?.toUpperCase()}
                      </span>
                      {isOverdue(task.deadline, task.status) && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          ⚠️ Overdue
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-700">{task.title}</h3>
                    {task.description && (
                      <p className="text-gray-500 text-sm mt-1">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div>
                    {task.deadline && (
                      <p className={`text-xs ${isOverdue(task.deadline, task.status) ? 'text-red-500' : 'text-gray-400'}`}>
                        📅 {formatDate(task.deadline)}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs mt-0.5">
                      By: {task.createdByName}
                    </p>
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={task.status}
                    onChange={(e) => updateStatus(task.id, e.target.value)}
                    className={`text-xs px-2 py-1.5 rounded-lg font-medium border-0 cursor-pointer ${statusColor(task.status)}`}>
                    <option value="todo">To Do</option>
                    <option value="inprogress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                {/* Assigned to */}
                {task.assignedToNames && task.assignedToNames.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-gray-400 text-xs">
                      👤 {task.assignedToNames.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
