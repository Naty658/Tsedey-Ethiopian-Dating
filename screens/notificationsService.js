import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export async function createNotification({
  toUid,
  type,
  title,
  body,
  icon = 'bell',
  fromUid = null,
  refId = null,
}) {
  if (!toUid) return;

  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  await setDoc(doc(db, 'users', toUid, 'notifications', id), {
    type,
    title,
    body,
    icon,
    fromUid,
    refId,
    read: false,
    createdAt: serverTimestamp(),
  });
}