import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, where, setDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { ApartmentCard } from '../types';

// ------------------------------------------------------------------
// ВАЖНО: Замените эти данные на конфигурацию вашего проекта Firebase
// Вы можете получить их на https://console.firebase.google.com
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDLtOVpeD8YePbDnGfQd-luF_qKXlLH-Qw",
  authDomain: "webclient-c958f.firebaseapp.com",
  projectId: "webclient-c958f",
  storageBucket: "webclient-c958f.firebasestorage.app",
  messagingSenderId: "627155312782",
  appId: "1:627155312782:web:6948f45b8cfc5a3b62e9df",
  measurementId: "G-TV5E2J7JGX"
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let isFirebaseReady = false;

try {
  // Simple check to see if user configured it
  if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Enable Offline Persistence
    // This prevents "Could not reach Cloud Firestore backend" errors and allows offline work
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
         console.warn('Persistence failed: Multiple tabs open.');
      } else if (err.code === 'unimplemented') {
         console.warn('Persistence failed: Browser not supported.');
      }
    });

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
  if (!isFirebaseReady || !db || !userId) return () => {};

  // Фильтруем только по userId текущего пользователя
  const q = query(collection(db, "apartments"), where("userId", "==", userId));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const cards: ApartmentCard[] = [];
    querySnapshot.forEach((doc) => {
      // Используем ID документа из Firestore как основной ID карточки
      cards.push({ ...doc.data(), id: doc.id } as ApartmentCard);
    });
    callback(cards);
  });

  return unsubscribe;
};

export const saveApartmentToCloud = async (userId: string, card: ApartmentCard) => {
  if (!isFirebaseReady || !db) return;

  const { id, ...cardData } = card; // Убираем ID из данных, чтобы не дублировать его внутри документа
  const payload = { ...cardData, userId, updatedAt: new Date().toISOString() };

  try {
    // ЛОГИКА ОПРЕДЕЛЕНИЯ: ОБНОВЛЕНИЕ ИЛИ СОЗДАНИЕ
    // Если ID существует и это не временный локальный ID (начинающийся на card- или gen-), обновляем
    const isExistingDoc = id && !id.startsWith('card-') && !id.startsWith('gen-');

    if (isExistingDoc) {
        // setDoc с { merge: true } работает как UPSERT (обновить или создать с заданным ID)
        await setDoc(doc(db, "apartments", id!), payload, { merge: true });
        console.log("Document saved (upsert) with ID: ", id);
    } else {
        // Создаем новый документ с авто-генерируемым ID
        const docRef = await addDoc(collection(db, "apartments"), payload);
        console.log("New document created with ID: ", docRef.id);
    }
  } catch (e) {
    console.error("Error saving to cloud", e);
    throw e;
  }
};

export const deleteApartmentFromCloud = async (id: string) => {
  if (!isFirebaseReady || !db) return;
  try {
    await deleteDoc(doc(db, "apartments", id));
    console.log("Document deleted:", id);
  } catch (e) {
    console.error("Error deleting document:", e);
    throw e;
  }
};