import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

// Create a new settlement
export async function createSettlement(data: {
  shivirId: string;
  shivirName: string;
  settlementNumber: number;
  amount: number;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upiId: string;
  contactName: string;
  contactPhone: string;
  deadline: string;
  initiatedBy: string;
  initiatedByName: string;
  note: string;
}) {
  return await addDoc(collection(db, 'settlements'), {
    ...data,
    status: 'pending',
    utrNumber: '',
    sentAt: null,
    confirmedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Get all settlements for a Shivir
export async function getShivirSettlements(shivirId: string) {
  const q = query(
    collection(db, 'settlements'),
    where('shivirId', '==', shivirId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Aayojak marks payment as sent
export async function markSettlementSent(
  settlementId: string,
  utrNumber: string,
  sentByName: string,
) {
  const ref = doc(db, 'settlements', settlementId);
  return await updateDoc(ref, {
    status: 'sent',
    utrNumber,
    sentByName,
    sentAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Super Admin confirms receipt
export async function confirmSettlementReceived(
  settlementId: string,
  confirmedByName: string,
) {
  const ref = doc(db, 'settlements', settlementId);
  return await updateDoc(ref, {
    status: 'confirmed',
    confirmedByName,
    confirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}