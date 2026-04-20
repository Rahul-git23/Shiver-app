'use client';
import { formatShivirDates } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import PaymentApprovalPopup from '@/components/PaymentApprovalPopup';

export default function OrganiserPage() {
  const [userData, setUserData] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statsCollections, setStatsCollections] = useState(0);
  const [statsExpenses, setStatsExpenses] = useState(0);
  const [statsCollectionsAmount, setStatsCollectionsAmount] = useState(0);
  const [statsExpensesAmount, setStatsExpensesAmount] = useState(0);
  const [statsTasks, setStatsTasks] = useState(0);
  const [statsPendingVotes, setStatsPendingVotes] = useState(0);
  const [settlement, setSettlement] = useState<any>(null);
  const [shivirId, setShivirId] = useState<string>('');
  const [removalRequest, setRemovalRequest] = useState<any>(null);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [voting, setVoting] = useState(false);
  const [currentUserPhone, setCurrentUserPhone] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      // Get user data
      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      const user = userSnap.docs[0].data();
      setUserData(user);
      setCurrentUserPhone(currentUser.phoneNumber || '');

      // Get assigned Shivir
      const orgQ = query(collection(db, 'shivirOrganisers'), where('phone', '==', currentUser.phoneNumber));
      const orgSnap = await getDocs(orgQ);

      // Check how many Shivirs this Aayojak is assigned to
      const myShivirIds = orgSnap.docs.map(d => d.data().shivirId);

      if (myShivirIds.length === 0) { setLoading(false); return; }

      // If multiple Shivirs and none selected yet — go to selection page
      const savedShivirId = localStorage.getItem('selectedShivirId');
      if (myShivirIds.length > 1 && !savedShivirId) {
        window.location.href = '/organiser/select-shivir';
        return;
      }

      // If saved Shivir is no longer assigned — clear and reselect
      if (savedShivirId && !myShivirIds.includes(savedShivirId)) {
        localStorage.removeItem('selectedShivirId');
        window.location.href = '/organiser/select-shivir';
        return;
      }

      const selectedShivirId = savedShivirId || myShivirIds[0];
      if (!orgSnap.empty) {
        const shivirId = selectedShivirId;
        // Check for pending payment approvals
        const staySnap = await getDocs(collection(db, 'sishyaSelfStay'));
        const pendingPayment = staySnap.docs.some(d =>
          d.data().shivirId === shivirId &&
          d.data().requestPayment === true &&
          d.data().payStatus !== 'approved' &&
          d.data().payStatus !== 'rejected'
        );
        setHasPendingPayment(pendingPayment);        
        const shivirQ = query(collection(db, 'shivirs'), where('__name__', '==', shivirId));
        const shivirSnap = await getDocs(shivirQ);
        if (!shivirSnap.empty) {
          const shivirData = { id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() };
          setShivir(shivirData);

          // Fetch real stats
          const sid = shivirData.id;

          const colSnap = await getDocs(query(collection(db, 'contributions'), where('shivirId', '==', sid)));
          const activeCols = colSnap.docs.filter(d => d.data().status !== 'cancelled' && d.data().status !== 'refunded');
          setStatsCollections(activeCols.length);
          setStatsCollectionsAmount(activeCols.reduce((sum, d) => sum + (d.data().amount || 0), 0));

          const expSnap = await getDocs(query(collection(db, 'expenses'), where('shivirId', '==', sid)));
          setStatsExpenses(expSnap.size);
          setStatsPendingVotes(expSnap.docs.filter(d => d.data().status === 'planning').length);
          setStatsExpensesAmount(expSnap.docs.reduce((sum, d) => sum + (d.data().estimatedAmount || d.data().amount || 0), 0));

          const taskSnap = await getDocs(query(collection(db, 'tasks'), where('shivirId', '==', sid)));

          // Fetch active removal request
          try {
            const removalSnap = await getDocs(query(
              collection(db, 'removalRequests'),
              where('shivirId', '==', sid),
              where('status', '==', 'pending')
            ));
            if (!removalSnap.empty) {
              setRemovalRequest({ id: removalSnap.docs[0].id, ...removalSnap.docs[0].data() });
            }
          } catch (e) {}

          // Fetch active settlement
          try {
            const settlSnap = await getDocs(query(collection(db, 'settlements'), where('shivirId', '==', sid)));
            const latestSettl = settlSnap.docs.sort((a, b) => (b.data().createdAt || 0) - (a.data().createdAt || 0))[0];
            if (latestSettl) setSettlement({ id: latestSettl.id, ...latestSettl.data() });
            if (!settlSnap.empty) setSettlement({ id: settlSnap.docs[0].id, ...settlSnap.docs[0].data() });
          } catch (e) {}

          setShivirId(sid);
          setStatsTasks(taskSnap.docs.filter(d => d.data().status !== 'done').length);
        }
      }
    // Get unread notification count
          try {
            const notifSnap = await getDocs(collection(db, 'notifications'));
            const unread = notifSnap.docs.filter(d =>
              d.data().userPhone === currentUser.phoneNumber && !d.data().read
            ).length;
            setUnreadCount(unread);
          } catch (e) {}

          setLoading(false);
        });
        return () => unsubscribe();
      }, []);

  const handleVote = async (vote: 'approve' | 'reject') => {
    if (!removalRequest || !currentUserPhone) return;
    setVoting(true);
    try {
      const { doc, updateDoc, deleteDoc } = await import('firebase/firestore');
      const reqRef = doc(db, 'removalRequests', removalRequest.id);
      const newVotes = { ...removalRequest.votes, [currentUserPhone]: vote };
      await updateDoc(reqRef, { votes: newVotes });

      const orgSnap = await getDocs(query(collection(db, 'shivirOrganisers'), where('shivirId', '==', shivirId)));
      const totalOrganisers = orgSnap.size;
      const majority = Math.floor(totalOrganisers / 2) + 1;
      const approveCount = Object.values(newVotes).filter(v => v === 'approve').length;
      const rejectCount = Object.values(newVotes).filter(v => v === 'reject').length;

      if (approveCount >= majority) {
        const orgDoc = orgSnap.docs.find(d => d.data().phone === removalRequest.targetPhone);
        if (orgDoc) await deleteDoc(doc(db, 'shivirOrganisers', orgDoc.id));
        await updateDoc(reqRef, { status: 'approved' });
        setRemovalRequest(null);
      } else if (rejectCount >= majority) {
        await updateDoc(reqRef, { status: 'rejected' });
        setRemovalRequest(null);
      } else {
        setRemovalRequest({ ...removalRequest, votes: newVotes });
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setVoting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Removal Vote Popup */}
        {removalRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <p className="text-gray-400 text-xs text-center mb-1">Removal request</p>
              <p className="font-bold text-gray-700 text-lg text-center mb-4">
                Remove {removalRequest.targetName} Ji?
              </p>

              <div className="bg-orange-50 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold">
                    {removalRequest.targetName?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 text-sm">{removalRequest.targetName} Ji</p>
                    <p className="text-gray-400 text-xs">{removalRequest.targetPhone}</p>
                  </div>
                </div>
                <div className="border-t border-orange-100 pt-2">
                  <p className="text-gray-500 text-xs">Requested by: {removalRequest.requestedByName}</p>
                  <p className="text-gray-500 text-xs mt-1">Reason: {removalRequest.remark}</p>
                </div>
              </div>

              {/* Vote counts */}
              {(() => {
                const votes = removalRequest.votes || {};
                const approveCount = Object.values(votes).filter(v => v === 'approve').length;
                const rejectCount = Object.values(votes).filter(v => v === 'reject').length;
                const hasVoted = currentUserPhone && votes[currentUserPhone];
                return (
                  <>
                    <p className="text-gray-400 text-xs text-center mb-3">
                      {hasVoted ? `You voted — waiting for others` : `Your vote is needed`}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => !hasVoted && handleVote('approve')}
                        disabled={voting || !!hasVoted}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm relative ${
                          hasVoted === 'approve' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700'
                        } disabled:opacity-60`}>
                        ✅ Approve
                        {approveCount > 0 && (
                          <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {approveCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => !hasVoted && handleVote('reject')}
                        disabled={voting || !!hasVoted}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm relative ${
                          hasVoted === 'reject' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'
                        } disabled:opacity-60`}>
                        ❌ Reject
                        {rejectCount > 0 && (
                          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {rejectCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-orange-600">🕉️ Shivir App</h1>
            <p className="text-gray-500 text-sm">Aayojak Dashboard</p>
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
            <div className="flex items-center gap-3">
            <button
              onClick={() => {
                localStorage.removeItem('selectedShivirId');
                window.location.href = '/organiser/select-shivir';
              }}
              className="text-orange-500 text-xs font-medium border border-orange-300 px-2 py-1 rounded-lg">
              Switch Shivir
            </button>
            <button onClick={() => { auth.signOut(); window.location.href = '/login'; }}
              className="text-red-400 text-sm font-medium">Logout</button>
          </div>
          </div>
        </div>

        {/* Welcome */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-2xl">🙏</div>
            <div>
              <h2 className="text-xl font-bold text-gray-700">Jai Gurudev, {userData?.name}!</h2>
              <p className="text-gray-500 text-sm">Welcome to your dashboard</p>
            </div>
          </div>
        </div>

        {/* Shivir Card */}
        {shivir ? (
          <div className="bg-orange-500 rounded-2xl shadow p-6 mb-4 text-white">
            <p className="text-orange-100 text-sm mb-1">Your Assigned Shivir</p>
            <h2 className="text-xl font-bold mb-3">{shivir.name}</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>📍</span>
                <span className="text-orange-100">{shivir.venue || shivir.city}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🏙️</span>
                <span className="text-orange-100">{shivir.city}{shivir.state ? ', ' + shivir.state : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📅</span>
                <span className="text-orange-100">{formatShivirDates(shivir.startDate, shivir.endDate)}</span>
              </div>
              {shivir.gmapLink && (
                <a href={shivir.gmapLink} target="_blank"
                  className="flex items-center gap-2 bg-white bg-opacity-20 rounded-lg px-3 py-2 mt-2">
                  <span>🗺️</span>
                  <span className="text-white text-sm font-medium">Open in Google Maps</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-6 mb-4 text-center">
            <div className="text-3xl mb-2">🕉️</div>
            <p className="text-gray-500">No Shivir assigned yet</p>
            <p className="text-gray-400 text-sm mt-1">Please contact your coordinator</p>
          </div>
        )}
        
        {/* Settlement Alert Card */}
        {settlement && settlement.status !== 'confirmed' && (
          <>
            {settlement.status === 'paused' ? (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-600">⏸ Settlement on hold</p>
                  <p className="text-gray-400 text-sm">You will be notified when ready</p>
                </div>
                <button onClick={() => window.location.href = '/organiser/settlement'}
                  className="text-orange-500 text-sm font-medium">View →</button>
              </div>
            ) : (
          <div className="bg-white border-2 border-orange-400 rounded-2xl shadow p-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-gray-700">Settlement Pending</span>
              <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-full">Action needed</span>
            </div>
            <div className="text-2xl font-bold text-orange-500 mb-3">
              ₹{(settlement.amount || 0).toLocaleString('en-IN')}
            </div>
            <button
              onClick={() => window.location.href = '/organiser/settlement'}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl">
              <span className="block">{userData?.name} Ji</span>
              <span className="block text-sm font-medium opacity-90">Initiate Settlement →</span>
            </button>
            {settlement.deadline && (
              <p className="text-center text-gray-400 text-xs mt-2">
                Send by: {new Date(settlement.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
            )}
          </>
        )}
        
        {settlement && settlement.status === 'confirmed' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-green-700">✅ Settlement Confirmed</p>
              <p className="text-green-600 text-sm">₹{(settlement.amount || 0).toLocaleString('en-IN')} received by Gurudham</p>
            </div>
            <button onClick={() => window.location.href = '/organiser/settlement'}
              className="text-orange-500 text-sm font-medium">View →</button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => window.location.href = '/organiser/collections'}
            className="bg-white rounded-2xl shadow p-4 text-center">
            <div className="text-xl font-bold text-orange-500">
              ₹{statsCollectionsAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-gray-500 text-sm mt-1">Collections</div>
          </button>
          <button onClick={() => window.location.href = '/organiser/expenses'}
            className="bg-white rounded-2xl shadow p-4 text-center">
            <div className="text-xl font-bold text-orange-500">
              ₹{statsExpensesAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-gray-500 text-sm mt-1">Expenses</div>
          </button>
          <button onClick={() => window.location.href = '/organiser/tasks'}
            className="bg-white rounded-2xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{statsTasks}</div>
            <div className="text-gray-500 text-sm">Active Tasks</div>
          </button>
          <button onClick={() => window.location.href = '/organiser/expenses'}
            className="bg-white rounded-2xl shadow p-4 text-center">
            <div className={`text-2xl font-bold ${statsPendingVotes > 0 ? 'text-red-500' : 'text-orange-500'}`}>
              {statsPendingVotes}
            </div>
            <div className="text-gray-500 text-sm">Pending Votes</div>
          </button>
        </div>

        {/* Menu */}
        {shivir && (
          <div className="bg-white rounded-2xl shadow p-4 mb-4">
            <h3 className="font-bold text-gray-700 mb-3">Shivir Modules</h3>
            <div className="space-y-2">
              <button onClick={() => window.location.href = '/organiser/collections'}
                className="w-full text-left p-3 bg-orange-50 rounded-xl flex items-center gap-3 hover:bg-orange-100 transition-colors">
                <span className="text-xl">💰</span>
                <span className="text-gray-700 font-medium">Collections</span>
              </button>
              <button onClick={() => window.location.href = '/organiser/expenses'}
                className="w-full text-left p-3 bg-orange-50 rounded-xl flex items-center gap-3 hover:bg-orange-100 transition-colors">
                <span className="text-xl">📋</span>
                <span className="text-gray-700 font-medium">Expenses</span>
              </button>
              <button onClick={() => window.location.href = '/organiser/tasks'}
                className="w-full text-left p-3 bg-orange-50 rounded-xl flex items-center gap-3 hover:bg-orange-100 transition-colors">
                <span className="text-xl">✅</span>
                <span className="text-gray-700 font-medium">Tasks</span>
              </button>
              <button onClick={() => window.location.href = '/organiser/gurudham'}
                className="w-full text-left p-3 bg-orange-50 rounded-xl flex items-center gap-3 hover:bg-orange-100 transition-colors">
                <span className="text-xl">📦</span>
                <span className="text-gray-700 font-medium">Updates from Gurudham</span>
              </button>
              <button onClick={() => window.location.href = '/organiser/samagri-request'}
                className="w-full text-left p-3 bg-orange-50 rounded-xl flex items-center gap-3 hover:bg-orange-100 transition-colors">
                <span className="text-xl">🛒</span>
                <span className="text-gray-700 font-medium">Samagri Request</span>
              </button>
              <button onClick={() => window.location.href = '/organiser/sishya'}
                className="w-full text-left p-3 bg-orange-50 rounded-xl flex items-center gap-3 hover:bg-orange-100 transition-colors">
                <span className="text-xl">🙏</span>
                <span className="text-gray-700 font-medium">Sishya Management</span>
              </button>
            </div>
          </div>
        )}

      </div>

      <PaymentApprovalPopup
        organiserPhone={currentUserPhone}
        shivirId={shivirId}
      />

    </div>
  );
}