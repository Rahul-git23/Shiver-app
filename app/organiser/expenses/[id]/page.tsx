 'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { use } from 'react';

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [userData, setUserData] = useState<any>(null);
  const [expense, setExpense] = useState<any>(null);
  const [shivir, setShivir] = useState<any>(null);
  const [organiserCount, setOrganiserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [message, setMessage] = useState('');
  const [canVote, setCanVote] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      // Get user data
      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }
      const user = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      setUserData(user);

      // Get expense
      const expRef = doc(db, 'expenses', id);
      const expSnap = await getDoc(expRef);
      if (!expSnap.exists()) { window.location.href = '/organiser/expenses'; return; }
      const expData = { id: expSnap.id, ...expSnap.data() } as any;
      setExpense(expData);

      // Get Shivir
      const shivirSnap = await getDoc(doc(db, 'shivirs', expData.shivirId));
      if (shivirSnap.exists()) setShivir({ id: shivirSnap.id, ...shivirSnap.data() });

      // Get organiser count
      const orgQ = query(collection(db, 'shivirOrganisers'), where('shivirId', '==', expData.shivirId));
      const orgSnap = await getDocs(orgQ);
      setOrganiserCount(orgSnap.size);

      // Mark as seen
      const seenBy = expData.seenBy || [];
      if (!seenBy.includes(currentUser.phoneNumber)) {
        await updateDoc(expRef, {
          seenBy: arrayUnion(currentUser.phoneNumber)
        });
        seenBy.push(currentUser.phoneNumber);
      }

      // Can vote if 2+ organisers have seen it
      const hasVoted = (expData.votes || []).some((v: any) => v.phone === currentUser.phoneNumber);
      const seenEnough = seenBy.length >= 2;
      setCanVote(!hasVoted && seenEnough && expData.status === 'pending');

      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  const castVote = async (voteType: 'approve' | 'reject') => {
    if (!canVote) return;
    setVoting(true);
    setMessage('');

    try {
      const expRef = doc(db, 'expenses', id);
      const newVote = {
        phone: userData.phone,
        name: userData.name,
        vote: voteType,
        votedAt: new Date(),
      };

      const updatedVotes = [...(expense.votes || []), newVote];
      const approveCount = updatedVotes.filter((v: any) => v.vote === 'approve').length;
      const rejectCount = updatedVotes.filter((v: any) => v.vote === 'reject').length;
      const majority = Math.floor(organiserCount / 2) + 1;

      let newStatus = 'pending';
      let newPhase = expense.phase;

      if (approveCount >= majority) {
        newStatus = 'approved';
        newPhase = 'approved';
      } else if (rejectCount >= majority) {
        newStatus = 'rejected';
      }

      await updateDoc(expRef, {
        votes: arrayUnion(newVote),
        status: newStatus,
        phase: newPhase,
      });

      setExpense({ ...expense, votes: updatedVotes, status: newStatus, phase: newPhase });
      setCanVote(false);
      setMessage(newStatus === 'approved' ? '✅ Expense Approved!' :
                 newStatus === 'rejected' ? '❌ Expense Rejected!' :
                 '🗳️ Vote recorded!');

    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setVoting(false);
  };

  const formatAmount = (amount: number) => '₹' + amount?.toLocaleString('en-IN');
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const approveCount = (expense?.votes || []).filter((v: any) => v.vote === 'approve').length;
  const rejectCount = (expense?.votes || []).filter((v: any) => v.vote === 'reject').length;
  const majority = Math.floor(organiserCount / 2) + 1;
  const seenCount = (expense?.seenBy || []).length;

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-orange-500 text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 p-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/organiser/expenses'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">📋 Expense Detail</h1>
            <p className="text-gray-500 text-xs">{shivir?.name}</p>
          </div>
        </div>

        {/* Expense Details */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full">
                {expense?.category}
              </span>
              <h2 className="text-xl font-bold text-gray-700 mt-2">{expense?.vendorName}</h2>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              expense?.status === 'approved' ? 'bg-green-100 text-green-600' :
              expense?.status === 'rejected' ? 'bg-red-100 text-red-500' :
              'bg-yellow-100 text-yellow-600'
            }`}>
              {expense?.status === 'approved' ? '✅ Approved' :
               expense?.status === 'rejected' ? '❌ Rejected' : '🗳️ Voting'}
            </span>
          </div>

          <div className="bg-orange-50 rounded-xl p-4 mb-4">
            <p className="text-gray-500 text-sm">Estimated Amount</p>
            <p className="text-3xl font-bold text-orange-600">{formatAmount(expense?.estimatedAmount)}</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Phase</span>
              <span className="font-medium text-gray-700 capitalize">{expense?.phase}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Proposed by</span>
              <span className="font-medium text-gray-700">{expense?.proposedByName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-700">{formatDate(expense?.createdAt)}</span>
            </div>
            {expense?.remarks && (
              <div className="border-t pt-2 mt-2">
                <p className="text-gray-500">Remarks</p>
                <p className="text-gray-700 mt-1">{expense?.remarks}</p>
              </div>
            )}
          </div>
        </div>

        {/* Voting Status */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h3 className="font-bold text-gray-700 mb-4">🗳️ Voting Status</h3>

          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{approveCount}</p>
              <p className="text-green-600 text-sm">Approve</p>
            </div>
            <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{rejectCount}</p>
              <p className="text-red-500 text-sm">Reject</p>
            </div>
            <div className="flex-1 bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{majority}</p>
              <p className="text-orange-600 text-sm">Needed</p>
            </div>
          </div>

          {/* Seen by */}
          <p className="text-gray-400 text-xs mb-4">
            👁️ Seen by {seenCount} of {organiserCount} Aayojak
            {seenCount < 2 && ' — voting starts after 2 Aayojak view'}
          </p>

          {/* Vote buttons */}
          {expense?.status === 'pending' && (
            <div>
              {canVote ? (
                <div className="flex gap-3">
                  <button onClick={() => castVote('approve')} disabled={voting}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                    ✅ Approve
                  </button>
                  <button onClick={() => castVote('reject')} disabled={voting}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                    ❌ Reject
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  {seenCount < 2 ?
                    <p className="text-gray-500 text-sm">⏳ Waiting for 2 Aayojak to view before voting starts</p> :
                    <p className="text-gray-500 text-sm">✅ You have already voted</p>
                  }
                </div>
              )}
            </div>
          )}

          {/* Votes list */}
          {(expense?.votes || []).length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-gray-600 text-sm font-medium">Votes:</p>
              {expense.votes.map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                  <span className="text-gray-700 text-sm">{v.name}</span>
                  <span className={`text-sm font-bold ${v.vote === 'approve' ? 'text-green-600' : 'text-red-500'}`}>
                    {v.vote === 'approve' ? '✅ Approved' : '❌ Rejected'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {message && (
          <div className={`rounded-2xl p-4 text-center font-bold ${
            message.startsWith('✅') ? 'bg-green-100 text-green-700' :
            message.startsWith('❌') ? 'bg-red-100 text-red-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {message}
          </div>
        )}

      </div>
    </div>
  );
}
