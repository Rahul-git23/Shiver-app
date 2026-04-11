import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── MASTER LIST FUNCTIONS ───────────────────────────────

// Get all categories
export async function getSamagriCategories() {
  const snapshot = await getDocs(collection(db, 'samagriCategories'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Add new category
export async function addSamagriCategory(name: string) {
  return await addDoc(collection(db, 'samagriCategories'), {
    name,
    createdAt: serverTimestamp(),
  });
}

// Get all items
export async function getSamagriItems() {
  const snapshot = await getDocs(collection(db, 'samagriItems'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Add new item to master list
export async function addSamagriItem(data: {
  category: string;
  name: string;
  quantity: number;
  price: number;
}) {
  return await addDoc(collection(db, 'samagriItems'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Update item price (Super Admin only)
export async function updateSamagriItemPrice(itemId: string, price: number) {
  const ref = doc(db, 'samagriItems', itemId);
  return await updateDoc(ref, {
    price,
    updatedAt: serverTimestamp(),
  });
}

// Update item quantity
export async function updateSamagriItemQuantity(itemId: string, quantity: number) {
  const ref = doc(db, 'samagriItems', itemId);
  return await updateDoc(ref, {
    quantity,
    updatedAt: serverTimestamp(),
  });
}

// Delete item
export async function deleteSamagriItem(itemId: string) {
  return await deleteDoc(doc(db, 'samagriItems', itemId));
}

// ─── PER SHIVIR SAMAGRI FUNCTIONS ────────────────────────

// Assign samagri items to a Shivir (Dispatch Team)
export async function assignSamagriToShivir(data: {
  shivirId: string;
  itemId: string;
  itemName: string;
  category: string;
  bundleNumber: number;
  quantityToSend: number;
  price: number;
}) {
  return await addDoc(collection(db, 'shivirSamagri'), {
    ...data,
    quantitySent: 0,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Get all bundles for a Shivir
export async function getShivirBundles(shivirId: string) {
  const q = query(
    collection(db, 'shivirSamagri'),
    where('shivirId', '==', shivirId)
  );
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const bundleNumbers = [...new Set(items.map(i => i.bundleNumber))].sort();
  return bundleNumbers.map(bn => ({
    bundleNumber: bn,
    items: items.filter(i => i.bundleNumber === bn),
  }));
}

// Get samagri assigned to a Shivir
export async function getShivirSamagri(shivirId: string) {
  const q = query(
    collection(db, 'shivirSamagri'),
    where('shivirId', '==', shivirId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Update samagri item status
export async function updateShivirSamagriStatus(
  id: string,
  status: string,
  extra?: { assignedToSishyaId?: string; assignedToSishyaNote?: string }
) {
  const ref = doc(db, 'shivirSamagri', id);
  return await updateDoc(ref, {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
  });
}

// ─── DISPATCH RECORD FUNCTIONS ───────────────────────────

// Record a dispatch
export async function recordDispatch(data: {
  shivirId: string;
  bundles: number;
  dispatchDate: string;
  transportMode: string;
  biltyNumber: string;
  biltyImageUrl?: string;
  dispatchedBy: string;
}) {
  return await addDoc(collection(db, 'samagriDispatch'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// Get dispatch records for a Shivir
export async function getShivirDispatch(shivirId: string) {
  const q = query(
    collection(db, 'samagriDispatch'),
    where('shivirId', '==', shivirId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── ORGANISER REQUEST FUNCTIONS ─────────────────────────

// Organiser raises a request
export async function addOrganiserSamagriRequest(data: {
  shivirId: string;
  requestedBy: string;
  requestedByName: string;
  itemName: string;
  quantity: number;
  remarks: string;
}) {
  return await addDoc(collection(db, 'organiserSamagriRequests'), {
    ...data,
    status: 'pending',
    paymentRequired: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Get all requests for a Shivir
export async function getOrganiserSamagriRequests(shivirId: string) {
  const q = query(
    collection(db, 'organiserSamagriRequests'),
    where('shivirId', '==', shivirId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Remove item from Shivir packing list
export async function removeShivirSamagriItem(id: string) {
  return await deleteDoc(doc(db, 'shivirSamagri', id));
}

// Update quantity of item in Shivir packing list
export async function updateShivirSamagriQty(id: string, quantity: number) {
  const ref = doc(db, 'shivirSamagri', id);
  return await updateDoc(ref, {
    quantityToSend: quantity,
    updatedAt: serverTimestamp(),
  });
}

// Super Admin approves/rejects request
export async function updateOrganiserRequest(
  requestId: string,
  data: {
    status: 'approved' | 'rejected';
    paymentRequired?: boolean;
    amount?: number;
    rejectRemark?: string;
  }
){
  const ref = doc(db, 'organiserSamagriRequests', requestId);
  return await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// Update a samagri request
export async function updateOrganiserSamagriRequest(
  requestId: string,
  data: {
    itemName: string;
    quantity: number;
    remarks: string;
    updatedBy: string;
    updatedByName: string;
    status?: string;
  }
) {
  const ref = doc(db, 'organiserSamagriRequests', requestId);
  return await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// Cancel a samagri request
export async function cancelOrganiserSamagriRequest(
  requestId: string,
  cancelledBy: string,
  cancelledByName: string,
  cancelRemark: string,
) {
  const ref = doc(db, 'organiserSamagriRequests', requestId);
  return await updateDoc(ref, {
    status: 'cancelled',
    cancelledBy,
    cancelledByName,
    cancelRemark,
    updatedAt: serverTimestamp(),
  });
}