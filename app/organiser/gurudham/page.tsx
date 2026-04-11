 'use client';

import { formatShivirDates, formatShivirLocation } from '@/lib/utils'; 
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function GurudhamUpdatesPage() {
  const [shivir, setShivir] = useState<any>(null);
  const [sishyaList, setSishyaList] = useState<any[]>([]);
  const [samagriList, setSamagriList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSishya, setExpandedSishya] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { window.location.href = '/login'; return; }

      const userQ = query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty || userSnap.docs[0].data().role !== 'organiser') {
        window.location.href = '/access-denied'; return;
      }

      const orgQ = query(collection(db, 'shivirOrganisers'), where('phone', '==', currentUser.phoneNumber));
      const orgSnap = await getDocs(orgQ);
      if (!orgSnap.empty) {
        const shivirId = orgSnap.docs[0].data().shivirId;
        const shivirSnap = await getDocs(query(collection(db, 'shivirs'), where('__name__', '==', shivirId)));
        if (!shivirSnap.empty) {
          setShivir({ id: shivirSnap.docs[0].id, ...shivirSnap.docs[0].data() });

          // Get Sishya assigned to this Shivir
          const sishyaQ = query(collection(db, 'shivirSishya'), where('shivirId', '==', shivirId));
          const sishyaSnap = await getDocs(sishyaQ);
          const sishyaIds = sishyaSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          // Get Sishya user details
          const sishyaDetails: any[] = [];
          for (const s of sishyaIds as any[]) {
            const userSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', s.phone)));
            if (!userSnap.empty) {
              sishyaDetails.push({ ...userSnap.docs[0].data(), shivirData: s });
            }
          }
          setSishyaList(sishyaDetails);

          // Get Samagri for this Shivir
          const samagriQ = query(collection(db, 'logistics'), where('shivirId', '==', shivirId));
          const samagriSnap = await getDocs(samagriQ);
          setSamagriList(samagriSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Not updated yet';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
        <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
          <button onClick={() => window.location.href = '/organiser'}
            className="text-orange-500 font-bold text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-orange-600">📦 Updates from Gurudham</h1>
            <p className="text-gray-500 text-xs">
              {shivir?.name} · <span className="font-bold text-orange-500">{formatShivirLocation(shivir?.city, shivir?.state)}</span>
            </p>
            <p className="text-gray-400 text-xs">
              {formatShivirDates(shivir?.startDate, shivir?.endDate)}
            </p>
          </div>
        </div>

        {/* Samagri Section */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="font-bold text-gray-700 mb-4">📦 Samagri Dispatch</h2>
          {samagriList.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-gray-400">No samagri updates yet</p>
              <p className="text-gray-400 text-sm mt-1">Gurudham will update dispatch details here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {samagriList.map((s: any) => (
                <div key={s.id} className="bg-orange-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-700">{s.title || 'Samagri Update'}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      s.status === 'dispatched' ? 'bg-green-100 text-green-600' :
                      s.status === 'delivered' ? 'bg-blue-100 text-blue-600' :
                      'bg-yellow-100 text-yellow-600'
                    }`}>
                      {s.status === 'dispatched' ? '🚚 Dispatched' :
                       s.status === 'delivered' ? '✅ Delivered' : '⏳ Pending'}
                    </span>
                  </div>
                  {s.bundles && (
                    <p className="text-gray-600 text-sm">📦 Bundles: {s.bundles}</p>
                  )}
                  {s.dispatchDate && (
                    <p className="text-gray-600 text-sm">📅 Dispatch: {formatDate(s.dispatchDate)}</p>
                  )}
                  {s.expectedDate && (
                    <p className="text-gray-600 text-sm">🕐 Expected: {formatDate(s.expectedDate)}</p>
                  )}
                  {s.transport && (
                    <p className="text-gray-600 text-sm">🚛 Transport: {s.transport}</p>
                  )}
                  {s.notes && (
                    <p className="text-gray-500 text-sm mt-2 border-t pt-2">📝 {s.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sishya Section */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-gray-700 mb-4">
            🙏 Sishya from Gurudham ({sishyaList.length})
          </h2>
          {sishyaList.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">🙏</div>
              <p className="text-gray-400">No Sishya assigned yet</p>
              <p className="text-gray-400 text-sm mt-1">Gurudham will update Sishya details here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sishyaList.map((sishya: any, index: number) => (
                <div key={index} className="border border-orange-100 rounded-xl overflow-hidden">
                  {/* Sishya Card */}
                  <button
                    onClick={() => setExpandedSishya(
                      expandedSishya === sishya.phone ? null : sishya.phone
                    )}
                    className="w-full p-4 flex items-center justify-between hover:bg-orange-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                        🙏
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-700">{sishya.name} Ji</p>
                        <p className="text-gray-500 text-sm">{sishya.shivirData?.travelMode || 'Travel details pending'}</p>
                      </div>
                    </div>
                    <span className="text-orange-500 text-lg">
                      {expandedSishya === sishya.phone ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Expanded Details */}
                  {expandedSishya === sishya.phone && (
                    <div className="bg-orange-50 p-4 border-t border-orange-100">
                      <div className="space-y-2">
                        {sishya.phone && (
                          <a href={`tel:${sishya.phone}`}
                            className="flex items-center gap-2 bg-white rounded-lg p-3">
                            <span>📞</span>
                            <span className="text-orange-600 font-medium">{sishya.phone}</span>
                          </a>
                        )}
                        {sishya.shivirData?.travelMode && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-gray-500 text-xs">Travel Mode</p>
                            <p className="text-gray-700 font-medium">{sishya.shivirData.travelMode}</p>
                          </div>
                        )}
                        {sishya.shivirData?.trainFlightNumber && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-gray-500 text-xs">Train/Flight Number</p>
                            <p className="text-gray-700 font-medium">{sishya.shivirData.trainFlightNumber}</p>
                          </div>
                        )}
                        {sishya.shivirData?.arrivalTime && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-gray-500 text-xs">Arrival Time</p>
                            <p className="text-gray-700 font-medium">{sishya.shivirData.arrivalTime}</p>
                          </div>
                        )}
                        {sishya.shivirData?.arrivalDate && (
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-gray-500 text-xs">Arrival Date</p>
                            <p className="text-gray-700 font-medium">{formatDate(sishya.shivirData.arrivalDate)}</p>
                          </div>
                        )}
                        {!sishya.shivirData?.travelMode && (
                          <p className="text-gray-400 text-sm text-center py-2">
                            Travel details not updated yet
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
