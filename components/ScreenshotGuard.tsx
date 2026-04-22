'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';

const EXEMPT_ROLES = ['gurudev'];
const SUPER_ADMIN_PHONE = process.env.NEXT_PUBLIC_SUPER_ADMIN_PHONE;

export default function ScreenshotGuard({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [exempt, setExempt] = useState(true); // default true until we know role (avoids flash)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { setExempt(true); return; }

      // Superadmin always exempt
      if (currentUser.phoneNumber === SUPER_ADMIN_PHONE) { setExempt(true); return; }

      // Check role from Firestore
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), where('phone', '==', currentUser.phoneNumber))
        );
        const role = snap.empty ? null : snap.docs[0].data().role;
        setExempt(role ? EXEMPT_ROLES.includes(role) : true);
      } catch {
        setExempt(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (exempt) { setBlocked(false); return; }

    const show = () => setBlocked(true);
    const hide = () => setBlocked(false);

    // Tab/app loses focus (screenshot on many Android devices briefly triggers this)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) show(); else hide();
    });
    window.addEventListener('blur', show);
    window.addEventListener('focus', hide);

    return () => {
      document.removeEventListener('visibilitychange', () => {
        if (document.hidden) show(); else hide();
      });
      window.removeEventListener('blur', show);
      window.removeEventListener('focus', hide);
    };
  }, [exempt]);

  return (
    <>
      {/* Print/PDF block — always active for restricted users */}
      {!exempt && (
        <style>{`
          @media print {
            body * { display: none !important; }
            body::after {
              display: flex !important;
              content: '';
              position: fixed;
              inset: 0;
              background: #f97316;
            }
          }
        `}</style>
      )}

      {/* Overlay shown on blur/visibility loss */}
      {blocked && !exempt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: '#f97316',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🕉️</div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, textAlign: 'center', padding: '0 32px' }}>
            Screenshots are not allowed
          </p>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 8, textAlign: 'center', padding: '0 32px' }}>
            This content is confidential. Please return to the app.
          </p>
        </div>
      )}

      <div style={!exempt ? { userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties : undefined}>
        {children}
      </div>
    </>
  );
}
