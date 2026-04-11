import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Single notification
export async function createNotification({
  userPhone,
  title,
  body,
  type,
  shivirId = '',
}: {
  userPhone: string;
  title: string;
  body: string;
  type: string;
  shivirId?: string;
}) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userPhone,
      title,
      body,
      type,
      shivirId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.log('Notification error:', e);
  }
}

// Send same notification to multiple people
export async function createNotificationForMany({
  phones,
  title,
  body,
  type,
  shivirId = '',
}: {
  phones: string[];
  title: string;
  body: string;
  type: string;
  shivirId?: string;
}) {
  const promises = phones.map(phone =>
    createNotification({ userPhone: phone, title, body, type, shivirId })
  );
  await Promise.all(promises);
}