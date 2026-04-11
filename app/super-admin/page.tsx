'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { formatShivirDates, formatShivirLocation } from '@/lib/utils';

export default function SuperAdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'users' | 'shivirs' | 'sishya' | 'samagri' | 'adminaccess'>('users');

  // Users state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', phone: '', role: 'organiser' });
  const [saving, setSaving] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Admin Access state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [adminShivirs, setAdminShivirs] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');

  // Sishya assignment state
  const [shivirForSishya, setShivirForSishya] = useState<any>(null);
  const [availableSishya, setAvailableSishya] = useState<any[]>([]);
  const [assignedSishya, setAssignedSishya] = useState<any[]>([]);
  const [sishyaMessage, setSishyaMessage] = useState('');

  // Shivir state
  const [showAddShivir, setShowAddShivir] = useState(false);
  const [shivirs, setShivirs] = useState<any[]>([]);
  const [shivirMessage, setShivirMessage] = useState('');
  const [savingShivir, setSavingShivir] = useState(false);
  const [newShivir, setNewShivir] = useState({
    name: '', city: '', state: '', venue: '',
    gmapLink: '', startDate: '', endDate: '', description: '',
  });

  // Organiser assignment state
  const [organiserSearch, setOrganiserSearch] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchMsg, setSearchMsg] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [shivirOrganisers, setShivirOrganisers] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }
      const superAdminPhone = process.env.NEXT_PUBLIC_SUPER_ADMIN_PHONE;

      // Allow Super Admin in directly
      if (currentUser.phoneNumber === superAdminPhone) {
        setUser(currentUser);
        loadUsers();
        loadShivirs();
        loadAdminUsers();
        try {
          const notifSnap = await getDocs(collection(db, 'notifications'));
          const unread = notifSnap.docs.filter(d =>
            d.data().userPhone === currentUser.phoneNumber && !d.data().read
          ).length;
          setUnreadCount(unread);
        } catch (e) {}
        setLoading(false);
        return;
      }

      // Also allow Gurudev in
      const userSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber)));
      if (!userSnap.empty && userSnap.docs[0].data().role === 'gurudev') {
        setUser(currentUser);
        loadUsers();
        loadShivirs();
        loadAdminUsers();
        try {
          const notifSnap = await getDocs(collection(db, 'notifications'));
          const unread = notifSnap.docs.filter(d =>
            d.data().userPhone === currentUser.phoneNumber && !d.data().read
          ).length;
          setUnreadCount(unread);
        } catch (e) {}
        setLoading(false);
        return;
      }

      // Everyone else blocked
      window.location.href = '/access-denied';
    });
    return () => unsubscribe();
  }, []);

  const loadUsers = async () => {
    const snapshot = await getDocs(collection(db, 'users'));
    const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const usersWithDataCheck = await Promise.all(userList.map(async (u: any) => {
      if (u.status !== 'deactivated') return { ...u, hasData: false };
      const phone = u.phone;
      const contribSnap = await getDocs(query(collection(db, 'contributions'), where('addedBy', '==', phone)));
      const expenseSnap = await getDocs(query(collection(db, 'expenses'), where('addedBy', '==', phone)));
      const hasData = !contribSnap.empty || !expenseSnap.empty;
      return { ...u, hasData };
    }));
    setUsers(usersWithDataCheck);
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'deactivated' ? 'active' : 'deactivated';
    await updateDoc(doc(db, 'users', userId), { status: newStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Delete ${userName}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'users', userId));
    setUsers(users.filter(u => u.id !== userId));
  };

  const saveEditName = async (userId: string) => {
    if (!editingName.trim()) return;
    await updateDoc(doc(db, 'users', userId), { name: editingName.trim() });
    setUsers(users.map(u => u.id === userId ? { ...u, name: editingName.trim() } : u));
    setEditingUserId(null);
    setEditingName('');
  };

  const loadSishyaForShivir = async (shivirId: string) => {
    const sishyaQ = query(collection(db, 'users'), where('role', '==', 'sishya'));
    const sishyaSnap = await getDocs(sishyaQ);
    setAvailableSishya(sishyaSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const assignedQ = query(collection(db, 'shivirSishya'), where('shivirId', '==', shivirId));
    const assignedSnap = await getDocs(assignedQ);
    setAssignedSishya(assignedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const assignSishyaToShivir = async (sishya: any) => {
    if (!shivirForSishya) return;
    setSishyaMessage('');
    try {
      const already = assignedSishya.find(s => s.phone === sishya.phone);
      if (already) { setSishyaMessage('Already assigned to this Shivir'); return; }
      await addDoc(collection(db, 'shivirSishya'), {
        shivirId: shivirForSishya.id,
        shivirName: shivirForSishya.name,
        phone: sishya.phone,
        name: sishya.name,
        assignedBy: user.phoneNumber,
        assignedAt: new Date(),
        inviteStatus: 'pending',
      });
      setSishyaMessage('✅ Sishya assigned successfully!');
      loadSishyaForShivir(shivirForSishya.id);
    } catch (err: any) { setSishyaMessage('Error: ' + err.message); }
  };

  const removeSishyaFromShivir = async (sishyaId: string) => {
    await deleteDoc(doc(db, 'shivirSishya', sishyaId));
    setAssignedSishya(assignedSishya.filter(s => s.id !== sishyaId));
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.includes(userSearch);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const loadAdminUsers = async () => {
    const q = query(collection(db, 'users'), where('role', '==', 'admin'));
    const snap = await getDocs(q);
    setAdminUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const openAdminAccess = (admin: any) => {
    setSelectedAdmin(admin);
    setAdminShivirs(admin.assignedShivirs || []);
    setAccessMessage('');
  };

  const toggleShivir = (shivirId: string) => {
    setAdminShivirs(prev =>
      prev.includes(shivirId) ? prev.filter(id => id !== shivirId) : [...prev, shivirId]
    );
  };

  const saveAdminAccess = async () => {
    if (!selectedAdmin) return;
    setSavingAccess(true);
    setAccessMessage('');
    try {
      await updateDoc(doc(db, 'users', selectedAdmin.id), {
        assignedShivirs: adminShivirs,
      });
      setAccessMessage('✅ Access saved successfully!');
      setAdminUsers(prev => prev.map(a =>
        a.id === selectedAdmin.id ? { ...a, assignedShivirs: adminShivirs } : a
      ));
      setSelectedAdmin({ ...selectedAdmin, assignedShivirs: adminShivirs });
    } catch (err: any) {
      setAccessMessage('Error: ' + err.message);
    }
    setSavingAccess(false);
  };

  const loadShivirs = async () => {
    const snapshot = await getDocs(collection(db, 'shivirs'));
    setShivirs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const addUser = async () => {
    setUserMessage('');
    if (!newUser.name || !newUser.phone) { setUserMessage('Please enter name and phone'); return; }
    if (newUser.phone.length !== 10) { setUserMessage('Enter valid 10-digit number'); return; }
    setSaving(true);
    try {
      const phone = '+91' + newUser.phone;
      const check = await getDocs(query(collection(db, 'users'), where('phone', '==', phone)));
      if (!check.empty) { setUserMessage('This number is already added'); setSaving(false); return; }
      await addDoc(collection(db, 'users'), {
        name: newUser.name, phone, role: newUser.role,
        status: 'pending', adminAccess: 'viewOnly',
        createdAt: new Date(), addedBy: user.phoneNumber,
      });
      setUserMessage('✅ User added successfully!');
      setNewUser({ name: '', phone: '', role: 'organiser' });
      loadUsers();
    } catch (err: any) { setUserMessage('Error: ' + err.message); }
    setSaving(false);
  };

  const searchOrganiser = async () => {
    setSearchMsg('');
    setSearchResult(null);
    if (!organiserSearch || organiserSearch.length !== 10) {
      setSearchMsg('Enter a valid 10-digit number'); return;
    }
    const phone = '+91' + organiserSearch;
    const already = shivirOrganisers.find(o => o.phone === phone);
    if (already) { setSearchMsg('Already added to this Shivir'); return; }
    const q = query(collection(db, 'users'), where('phone', '==', phone));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      setSearchResult({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id, isNew: false });
    } else {
      setSearchResult({ phone, isNew: true });
      setSearchMsg('Not found in system — enter name to add');
    }
  };

  const addOrganiserToShivir = () => {
    if (!searchResult) return;
    if (searchResult.isNew && !newOrgName) {
      setSearchMsg('Please enter name for new Aayojak'); return;
    }
    const organiser = {
      phone: searchResult.phone,
      name: searchResult.isNew ? newOrgName : searchResult.name,
      isNew: searchResult.isNew,
    };
    setShivirOrganisers([...shivirOrganisers, organiser]);
    setOrganiserSearch('');
    setSearchResult(null);
    setNewOrgName('');
    setSearchMsg('');
  };

  const removeOrganiser = (phone: string) => {
    setShivirOrganisers(shivirOrganisers.filter(o => o.phone !== phone));
  };

  const moveOrganiser = (index: number, direction: 'up' | 'down') => {
    const list = [...shivirOrganisers];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= list.length) return;
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
    setShivirOrganisers(list);
  };

  const addShivir = async () => {
    setShivirMessage('');
    if (!newShivir.name || !newShivir.city || !newShivir.startDate || !newShivir.endDate) {
      setShivirMessage('Please fill Shivir name, city and dates'); return;
    }
    setSavingShivir(true);
    try {
      const shivirRef = await addDoc(collection(db, 'shivirs'), {
        ...newShivir, status: 'planning',
        createdBy: user.phoneNumber, createdAt: new Date(),
      });
      for (const org of shivirOrganisers) {
        if (org.isNew) {
          const check = await getDocs(query(collection(db, 'users'), where('phone', '==', org.phone)));
          if (check.empty) {
            await addDoc(collection(db, 'users'), {
              name: org.name, phone: org.phone, role: 'organiser',
              status: 'pending', adminAccess: 'viewOnly',
              createdAt: new Date(), addedBy: user.phoneNumber,
            });
          }
        }
        await addDoc(collection(db, 'shivirOrganisers'), {
          shivirId: shivirRef.id, phone: org.phone, name: org.name,
          order: shivirOrganisers.indexOf(org),
          assignedBy: user.phoneNumber, assignedAt: new Date(), inviteStatus: 'pending',
        });
      }
      setShivirMessage('✅ Shivir created successfully!');
      setNewShivir({ name: '', city: '', state: '', venue: '', gmapLink: '', startDate: '', endDate: '', description: '' });
      setShivirOrganisers([]);
      setShowAddShivir(false);
      loadShivirs();
      loadUsers();
    } catch (err: any) { setShivirMessage('Error: ' + err.message); }
    setSavingShivir(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-orange-600">🕉️ Shivir App</h1>
            <p className="text-gray-500 text-sm">Super Admin Panel</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = '/notifications'}
              className="relative">
              <span className="text-2xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => { auth.signOut(); window.location.href = '/login'; }}
              className="text-red-400 text-sm font-medium">Logout</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button onClick={() => setActiveTab('users')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            👥 Users
          </button>
          <button onClick={() => setActiveTab('shivirs')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'shivirs' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            🕉️ Shivirs
          </button>
          <button onClick={() => setActiveTab('sishya')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'sishya' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            🙏 Sishya
          </button>
          <button onClick={() => setActiveTab('samagri')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'samagri' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            📦 Samagri
          </button>
          <button onClick={() => setActiveTab('adminaccess')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'adminaccess' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow'}`}>
            🔐 Admin
          </button>
        </div>

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div>
            <button onClick={() => setShowAddUser(!showAddUser)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl mb-4 transition-colors">
              {showAddUser ? '✕ Cancel' : '+ Add New User'}
            </button>
            {showAddUser && (
              <div className="bg-white rounded-2xl shadow p-6 mb-4">
                <h2 className="font-bold text-gray-700 mb-4">Add New User</h2>
                <div className="mb-3">
                  <label className="block text-gray-600 text-sm mb-1">Full Name</label>
                  <input type="text" placeholder="Enter full name" value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                </div>
                <div className="mb-3">
                  <label className="block text-gray-600 text-sm mb-1">Phone Number</label>
                  <div className="flex gap-2">
                    <span className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-600">+91</span>
                    <input type="tel" placeholder="10-digit number" value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-gray-600 text-sm mb-1">Role</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400">
                    <option value="organiser">Aayojak</option>
                    <option value="sishya">Sishya</option>
                    <option value="gurudev">Gurudev</option>
                    <option value="admin">Admin</option>
                    <option value="dispatch">Dispatch Team</option>
                  </select>
                </div>
                {userMessage && <p className={`text-sm mb-3 ${userMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{userMessage}</p>}
                <button onClick={addUser} disabled={saving}
                  className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add User'}
                </button>
              </div>
            )}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-bold text-gray-700 mb-4">All Users ({users.length})</h2>

              {/* Search */}
              <input
                type="text"
                placeholder="Search by name or mobile..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-orange-400 mb-3"
              />

              {/* Role Filter */}
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-2">Filter by Role</p>
              <div className="flex gap-2 mb-3">
                {['all', 'organiser', 'sishya', 'dispatch'].map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    style={{ flex: 1 }}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      roleFilter === r
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-500 border-gray-300'
                    }`}>
                    {r === 'all' ? 'All' : r === 'organiser' ? 'Aayojak' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-2">Filter by Status</p>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setStatusFilter('all')}
                  style={{ flex: 1, backgroundColor: statusFilter === 'all' ? '#EA580C' : '#fff', color: statusFilter === 'all' ? '#fff' : '#6b7280', borderColor: '#EA580C', borderWidth: '1.5px', borderStyle: 'solid', borderRadius: '20px', fontSize: '11px', fontWeight: '500', padding: '2px 0', cursor: 'pointer' }}>
                  All
                </button>
                <button onClick={() => setStatusFilter('active')}
                  style={{ flex: 1, backgroundColor: '#EAF3DE', color: '#3B6D11', borderColor: '#3B6D11', borderWidth: '1.5px', borderStyle: 'solid', borderRadius: '20px', fontSize: '11px', fontWeight: '500', padding: '2px 0', cursor: 'pointer' }}>
                  Active
                </button>
                <button onClick={() => setStatusFilter('pending')}
                  style={{ flex: 1, backgroundColor: '#FAEEDA', color: '#854F0B', borderColor: '#BA7517', borderWidth: '1.5px', borderStyle: 'solid', borderRadius: '20px', fontSize: '11px', fontWeight: '500', padding: '2px 0', cursor: 'pointer' }}>
                  Pending
                </button>
                <button onClick={() => setStatusFilter('deactivated')}
                  style={{ flex: 1, backgroundColor: '#D3D1C7', color: '#444441', borderColor: '#888780', borderWidth: '1.5px', borderStyle: 'solid', borderRadius: '20px', fontSize: '11px', fontWeight: '500', padding: '2px 0', cursor: 'pointer' }}>
                  Deactivated
                </button>
              </div>

              <div className="border-t border-gray-100 mb-3"></div>

              {filteredUsers.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No users found</p>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className={`p-3 rounded-xl ${u.status === 'deactivated' ? 'bg-gray-100' : 'bg-orange-50'}`}>
                      {editingUserId === u.id ? (
                        <div className="space-y-2">
                          <input type="text" value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                          <div className="flex gap-2">
                            <button onClick={() => saveEditName(u.id)}
                              className="flex-1 bg-green-500 text-white text-xs py-2 rounded-lg font-medium">Save</button>
                            <button onClick={() => { setEditingUserId(null); setEditingName(''); }}
                              className="flex-1 bg-gray-200 text-gray-600 text-xs py-2 rounded-lg">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${u.status === 'deactivated' ? 'text-gray-400' : 'text-gray-700'}`}>{u.name}</p>
                            <p className="text-gray-400 text-sm">{u.phone}</p>
                            <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full capitalize">
                              {u.role === 'organiser' ? 'Aayojak' : u.role}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              u.status === 'deactivated' ? 'bg-gray-200 text-gray-500' :
                              u.status === 'active' ? 'bg-green-100 text-green-600' :
                              'bg-yellow-100 text-yellow-600'
                            }`}>
                              {u.status === 'deactivated' ? 'Deactivated' : u.status === 'active' ? 'Active' : 'Pending'}
                            </span>
                            <button onClick={() => { setEditingUserId(u.id); setEditingName(u.name); }}
                              className="text-xs px-3 py-1 rounded-full bg-orange-100 text-orange-600 font-medium">
                              ✏️ Edit Name
                            </button>
                            {u.status === 'pending' && (
                              <button onClick={() => deleteUser(u.id, u.name)}
                                className="text-xs px-3 py-1 rounded-full bg-red-50 text-red-500 font-medium">
                                🗑️ Delete
                              </button>
                            )}
                            {u.status !== 'pending' && (
                              <button onClick={() => toggleUserStatus(u.id, u.status)}
                                className={`text-xs px-3 py-1 rounded-full font-medium ${
                                  u.status === 'deactivated' ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500'
                                }`}>
                                {u.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}
                              </button>
                            )}
                            {u.status === 'deactivated' && !u.hasData && (
                              <button onClick={() => deleteUser(u.id, u.name)}
                                className="text-xs px-3 py-1 rounded-full bg-red-50 text-red-500 font-medium">
                                🗑️ Delete
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 text-center mt-3">Showing {filteredUsers.length} of {users.length} users</p>
            </div>
          </div>
        )}

        {/* SHIVIRS TAB */}
        {activeTab === 'shivirs' && (
          <div>
            <button onClick={() => setShowAddShivir(!showAddShivir)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl mb-4 transition-colors">
              {showAddShivir ? '✕ Cancel' : '+ Create New Shivir'}
            </button>
            {showAddShivir && (
              <div className="bg-white rounded-2xl shadow p-6 mb-4">
                <h2 className="font-bold text-gray-700 mb-4">Create New Shivir</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-600 text-sm mb-1">Shivir Name *</label>
                    <input type="text" placeholder="e.g. Delhi Shivir April 2026" value={newShivir.name}
                      onChange={(e) => setNewShivir({ ...newShivir, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-gray-600 text-sm mb-1">City *</label>
                      <input type="text" placeholder="City" value={newShivir.city}
                        onChange={(e) => setNewShivir({ ...newShivir, city: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-gray-600 text-sm mb-1">State</label>
                      <input type="text" placeholder="State" value={newShivir.state}
                        onChange={(e) => setNewShivir({ ...newShivir, state: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm mb-1">Venue</label>
                    <input type="text" placeholder="Venue name" value={newShivir.venue}
                      onChange={(e) => setNewShivir({ ...newShivir, venue: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm mb-1">Google Maps Link</label>
                    <input type="text" placeholder="Paste Google Maps link" value={newShivir.gmapLink}
                      onChange={(e) => setNewShivir({ ...newShivir, gmapLink: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-gray-600 text-sm mb-1">Start Date *</label>
                      <input type="date" value={newShivir.startDate}
                        onChange={(e) => setNewShivir({ ...newShivir, startDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-gray-600 text-sm mb-1">End Date *</label>
                      <input type="date" value={newShivir.endDate}
                        onChange={(e) => setNewShivir({ ...newShivir, endDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm mb-1">Description / Notes</label>
                    <textarea placeholder="Any notes about this Shivir..." value={newShivir.description}
                      onChange={(e) => setNewShivir({ ...newShivir, description: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-400" />
                  </div>
                  <div className="border-t pt-4 mt-2">
                    <h3 className="font-bold text-gray-700 mb-3">👥 Add Aayojak</h3>
                    <div className="flex gap-2 mb-2">
                      <div className="flex gap-1 flex-1">
                        <span className="bg-gray-100 border border-gray-300 rounded-lg px-2 py-2 text-gray-600 text-sm">+91</span>
                        <input type="tel" placeholder="Search by phone" value={organiserSearch}
                          onChange={(e) => setOrganiserSearch(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-400 text-sm" />
                      </div>
                      <button onClick={searchOrganiser}
                        className="bg-orange-100 text-orange-600 font-bold px-3 py-2 rounded-lg text-sm">Search</button>
                    </div>
                    {searchResult && (
                      <div className="bg-orange-50 rounded-lg p-3 mb-2">
                        {searchResult.isNew ? (
                          <div>
                            <p className="text-orange-600 text-sm mb-2">New person — enter name:</p>
                            <input type="text" placeholder="Full name" value={newOrgName}
                              onChange={(e) => setNewOrgName(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 text-sm focus:outline-none focus:border-orange-400" />
                          </div>
                        ) : (
                          <p className="text-gray-700 font-medium text-sm">✅ Found: {searchResult.name}</p>
                        )}
                        <button onClick={addOrganiserToShivir}
                          className="w-full bg-orange-500 text-white font-bold py-2 rounded-lg text-sm mt-1">
                          + Add to Shivir
                        </button>
                      </div>
                    )}
                    {searchMsg && <p className="text-sm text-red-500 mb-2">{searchMsg}</p>}
                    {shivirOrganisers.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-gray-600 text-sm font-medium">Aayojak ({shivirOrganisers.length}):</p>
                        {shivirOrganisers.map((org, index) => (
                          <div key={org.phone} className="flex items-center justify-between bg-white border border-orange-200 rounded-lg p-2">
                            <div className="flex items-center gap-2">
                              <span className="text-orange-400 font-bold text-sm">#{index + 1}</span>
                              <div>
                                <p className="text-gray-700 text-sm font-medium">{org.name}</p>
                                <p className="text-gray-400 text-xs">{org.phone}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => moveOrganiser(index, 'up')} className="text-gray-400 hover:text-orange-500 px-1">▲</button>
                              <button onClick={() => moveOrganiser(index, 'down')} className="text-gray-400 hover:text-orange-500 px-1">▼</button>
                              <button onClick={() => removeOrganiser(org.phone)} className="text-red-400 hover:text-red-600 px-1">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {shivirMessage && <p className={`text-sm mt-3 ${shivirMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{shivirMessage}</p>}
                <button onClick={addShivir} disabled={savingShivir}
                  className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mt-4 disabled:opacity-50">
                  {savingShivir ? 'Creating...' : 'Create Shivir'}
                </button>
              </div>
            )}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-bold text-gray-700 mb-4">All Shivirs ({shivirs.length})</h2>
              {shivirs.length === 0 ? <p className="text-gray-400 text-center py-4">No Shivirs created yet</p> : (
                <div className="space-y-3">
                  {shivirs.map((s) => (
                    <div key={s.id} 
                      onClick={() => window.location.href = `/super-admin/shivir/${s.id}`}
                      className="p-4 bg-orange-50 rounded-xl cursor-pointer hover:bg-orange-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-700">{s.name}</h3>
                        <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full capitalize">{s.status}</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">📍 {s.city}{s.state ? ', ' + s.state : ''}</p>
                      <p className="text-gray-500 text-sm">📅 {formatShivirDates(s.startDate, s.endDate)}</p>
                      <p className="text-orange-400 text-xs mt-2 font-medium">Tap to view details →</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SISHYA TAB */}
        {activeTab === 'sishya' && (
          <div>
            <div className="bg-white rounded-2xl shadow p-4 mb-4">
              <h2 className="font-bold text-gray-700 mb-3">Select Shivir to Assign Sishya</h2>
              <div className="space-y-2">
                {shivirs.map((s: any) => (
                  <button key={s.id}
                    onClick={() => { setShivirForSishya(s); loadSishyaForShivir(s.id); setSishyaMessage(''); }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                      shivirForSishya?.id === s.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                    }`}>
                    <p className="font-medium text-gray-700">{s.name}</p>
                    <p className="text-gray-500 text-sm">📅 {formatShivirDates(s.startDate, s.endDate)}</p>
                  </button>
                ))}
                {shivirs.length === 0 && <p className="text-gray-400 text-center py-4">No Shivirs created yet</p>}
              </div>
            </div>
            {shivirForSishya && (
              <div>
                <div className="bg-white rounded-2xl shadow p-4 mb-4">
                  <h2 className="font-bold text-gray-700 mb-3">Assigned Sishya ({assignedSishya.length})</h2>
                  {assignedSishya.length === 0 ? (
                    <p className="text-gray-400 text-center py-3">No Sishya assigned yet</p>
                  ) : (
                    <div className="space-y-2">
                      {assignedSishya.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                          <div>
                            <p className="font-medium text-gray-700">{s.name} Ji</p>
                            <p className="text-gray-500 text-sm">{s.phone}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full">{s.inviteStatus || 'pending'}</span>
                            <button onClick={() => removeSishyaFromShivir(s.id)} className="text-red-400 hover:text-red-600 text-sm font-bold px-2">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-2xl shadow p-4 mb-4">
                  <h2 className="font-bold text-gray-700 mb-3">Add Sishya to {shivirForSishya.name}</h2>
                  {sishyaMessage && (
                    <p className={`text-sm mb-3 ${sishyaMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{sishyaMessage}</p>
                  )}
                  {availableSishya.length === 0 ? (
                    <p className="text-gray-400 text-center py-3">No Sishya in system yet. Add them in Users tab first.</p>
                  ) : (
                    <div className="space-y-2">
                      {availableSishya.map((s: any) => {
                        const isAssigned = assignedSishya.some(a => a.phone === s.phone);
                        return (
                          <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div>
                              <p className="font-medium text-gray-700">{s.name} Ji</p>
                              <p className="text-gray-500 text-sm">{s.phone}</p>
                            </div>
                            {isAssigned ? (
                              <span className="text-xs bg-green-100 text-green-600 px-3 py-1 rounded-full">✅ Assigned</span>
                            ) : (
                              <button onClick={() => assignSishyaToShivir(s)}
                                className="bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-xl">+ Assign</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADMIN ACCESS TAB */}
        {activeTab === 'adminaccess' && (
          <div>
            {!selectedAdmin ? (
              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="font-bold text-gray-700 mb-4">🔐 Admin Users ({adminUsers.length})</h2>
                {adminUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No Admin users found</p>
                    <p className="text-gray-400 text-sm mt-1">Add a user with role "Admin" in Users tab</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminUsers.map((admin: any) => (
                      <div key={admin.id}
                        onClick={() => openAdminAccess(admin)}
                        className="p-4 bg-orange-50 rounded-xl cursor-pointer hover:bg-orange-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-700">{admin.name}</p>
                            <p className="text-gray-400 text-sm">{admin.phone}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              admin.status === 'active' ? 'bg-green-100 text-green-600' :
                              admin.status === 'deactivated' ? 'bg-gray-200 text-gray-500' :
                              'bg-yellow-100 text-yellow-600'
                            }`}>{admin.status || 'pending'}</span>
                            <p className="text-orange-400 text-xs mt-1">
                              {(admin.assignedShivirs || []).length} Shivirs assigned
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Back button */}
                <button onClick={() => { setSelectedAdmin(null); setAccessMessage(''); }}
                  className="flex items-center gap-2 text-orange-500 font-medium mb-4">
                  ← Back to Admin list
                </button>

                {/* Admin info */}
                <div className="bg-white rounded-2xl shadow p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl">🙏</div>
                    <div>
                      <p className="font-bold text-gray-700">{selectedAdmin.name}</p>
                      <p className="text-gray-400 text-sm">{selectedAdmin.phone}</p>
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Admin · View Only</span>
                    </div>
                  </div>
                </div>

                {/* Assign Shivirs */}
                <div className="bg-white rounded-2xl shadow p-4 mb-4">
                  <h3 className="font-bold text-gray-700 mb-1">Assign Shivirs</h3>
                  <p className="text-gray-400 text-xs mb-3">Select which Shivirs this Admin can view</p>
                  {shivirs.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No Shivirs created yet</p>
                  ) : (
                    <div className="space-y-2">
                      {shivirs.map((s: any) => (
                        <label key={s.id}
                          className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl cursor-pointer hover:bg-orange-100">
                          <input
                            type="checkbox"
                            checked={adminShivirs.includes(s.id)}
                            onChange={() => toggleShivir(s.id)}
                            className="w-4 h-4 accent-orange-500"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-700 text-sm">{s.name}</p>
                            <p className="text-gray-400 text-xs">{formatShivirLocation(s.city, s.state)} · {formatShivirDates(s.startDate, s.endDate)}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.status === 'active' ? 'bg-green-100 text-green-600' :
                            s.status === 'completed' ? 'bg-blue-100 text-blue-600' :
                            'bg-orange-100 text-orange-600'
                          }`}>{s.status || 'planning'}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save button */}
                {accessMessage && (
                  <p className={`text-sm mb-3 text-center ${accessMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                    {accessMessage}
                  </p>
                )}
                <button onClick={saveAdminAccess} disabled={savingAccess}
                  className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                  {savingAccess ? 'Saving...' : '💾 Save Shivir Access'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* SAMAGRI TAB */}
        {activeTab === 'samagri' && (
          <div>
            <div className="bg-white rounded-2xl shadow p-6 mb-4">
              <h2 className="font-bold text-gray-700 mb-2">📦 Samagri Management</h2>
              <p className="text-gray-500 text-sm mb-4">Manage master Samagri list and per-Shivir dispatch</p>
              <a href="/super-admin/samagri"
                className="block w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-center">
                Open Master Samagri List →
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}