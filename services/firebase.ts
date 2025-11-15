import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, where, updateDoc } from 'firebase/firestore';
import { ApartmentCard } from '../types';

// ------------------------------------------------------------------
// ВАЖНО: Замените эти данные на конфигурацию вашего проекта Firebase
// Вы можете получить их на https://console.firebase.google.com
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDG0SpdJUy9p31RdzfKCNai-Lw7quTK08k",
  authDomain: "inspect-repair.firebaseapp.com",
  projectId: "inspect-repair",
  storageBucket: "inspect-repair.firebasestorage.app",
  messagingSenderId: "957521909464",
  appId: "1:957521909464:web:569b3bbf12f6f43740e9ad",
  measurementId: "G-QLP7JVK74T"
};

let app;
let auth;
let db;
let isFirebaseReady = false;

try {
  // Simple check to see if user configured it
  if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseReady = true;
  } else {
    console.warn("Firebase config missing. App running in Offline Mode (LocalStorage only).");
  }
} catch (e) {
  console.error("Firebase initialization error:", e);
}

export { auth, isFirebaseReady };

// --- Database Services ---

export const subscribeToApartments = (userId: string, callback: (cards: ApartmentCard[]) => void) => {
  if (!isFirebaseReady || !db) return () => {};

  const q = query(collection(db, "apartments"), where("userId", "==", userId));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const cards: ApartmentCard[] = [];
    querySnapshot.forEach((doc) => {
      // We store the Firestore ID as the card ID locally
      cards.push({ ...doc.data(), id: doc.id } as ApartmentCard);
    });
    callback(cards);
  });

  return unsubscribe;
};

export const saveApartmentToCloud = async (userId: string, card: ApartmentCard) => {
  if (!isFirebaseReady || !db) return;

  // Ensure we don't save the ID if it's a new doc (Firestore generates it), 
  // but if it's an update, we might handle differently. 
  // For simplicity in this MVP, we treat the card ID from local state as the doc ID if possible, 
  // or let Firestore gen a new one if it doesn't exist.
  
  const { id, ...cardData } = card; // Remove ID from data payload
  const payload = { ...cardData, userId, updatedAt: new Date().toISOString() };

  try {
    if (id && id.length > 20 && !id.startsWith('card-')) {
        // Likely a Firestore ID, update it
        await updateDoc(doc(db, "apartments", id), payload);
    } else {
        // New doc
        await addDoc(collection(db, "apartments"), payload);
    }
  } catch (e) {
    console.error("Error saving to cloud", e);
    throw e;
  }
};

export const deleteApartmentFromCloud = async (id: string) => {
  if (!isFirebaseReady || !db) return;
  await deleteDoc(doc(db, "apartments", id));
};
