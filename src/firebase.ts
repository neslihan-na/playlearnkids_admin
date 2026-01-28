import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  getAuth,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import { get, getDatabase, ref, set, remove, update } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadString,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';

// Environment detection
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.REACT_APP_ENV ?? process.env.NODE_ENV;
const isLiveEnv = appEnv === 'production' || appEnv === 'live' || appEnv === 'prod';

// Debug: Environment variables kontrolü
console.log('🔍 Environment Debug:', {
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  REACT_APP_ENV: process.env.REACT_APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  appEnv,
  isLiveEnv,
  REACT_APP_FIREBASE_TESTDATABASE_URL: process.env.REACT_APP_FIREBASE_TESTDATABASE_URL,
  REACT_APP_FIREBASE_DATABASE_URL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
});

// Firebase configuration - Dev ve Live için ayrı config'ler
// Eğer özel DEV/LIVE config'leri varsa onları kullan, yoksa genel config'leri kullan
// ------------------------------------------------------------------
// 1️⃣  Live & Dev Realtime Database URLs (hard‑coded)
// ------------------------------------------------------------------
export const LIVE_DB_URL = "https://playlearnkids-default-rtdb.europe-west1.firebasedatabase.app";
export const DEV_DB_URL = "https://playlearnkidstest.europe-west1.firebasedatabase.app";

// ------------------------------------------------------------------
// 2️⃣  Shared Firebase config (hard‑coded keys)
// ------------------------------------------------------------------
const getFirebaseConfig = () => {
  return {
    apiKey: "AIzaSyD2VAHH8sw_GhifUvA6FDweTtIBtWUFrww",
    authDomain: "playlearnkids.firebaseapp.com",
    projectId: "playlearnkids",
    storageBucket: "playlearnkids.firebasestorage.app",
    messagingSenderId: "10889232034",
    appId: "1:10889232034:ios:06240f0d3c857defc861fb",
  };
};

const firebaseConfig = getFirebaseConfig();

// Debug: Environment ve URL'i kontrol et
console.log('🔥 Firebase Environment:', isLiveEnv ? 'LIVE' : 'DEV');
// Log which DB URL we are using based on environment
if (isLiveEnv) {
  console.log('🔥 Using Live DB URL:', LIVE_DB_URL);
} else {
  console.log('🔥 Using Dev DB URL:', DEV_DB_URL);
}

// Firebase'i başlat (sadece bir kez başlatmak için kontrol)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase servislerini export et
// ------------------------------------------------------------------
// 3️⃣  Create two Database instances – one for live, one for dev.
// ------------------------------------------------------------------
export const liveDatabase = getDatabase(app, LIVE_DB_URL);
export const devDatabase = getDatabase(app, DEV_DB_URL);
export const storage = getStorage(app);
// Export a generic `database` that resolves to the correct instance based on environment.
export const database = isLiveEnv ? liveDatabase : devDatabase;
export const db = getFirestore(app);



// Firebase Auth'u başlat (Web için basit getAuth yeterli)
export const auth: Auth = getAuth(app);

export default app;

// Environment management
const getCurrentEnvironment = () => {
  const env = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.REACT_APP_ENV ?? process.env.NODE_ENV;
  if (env === 'production' || env === 'live' || env === 'prod') {
    return 'live';
  }
  return 'test'; // development, dev, test için
};

// Database paths based on environment
// ------------------------------------------------------------------
// 4️⃣  Build the correct database path for the selected environment.
// ------------------------------------------------------------------
export const getDatabasePath = (path: string) => {
  const currentEnv = getCurrentEnvironment();
  // Use the appropriate root collection for each DB instance.
  const root = currentEnv === 'test' ? 'test_users' : 'users';
  return `${root}/${path}`;
};

// Auth functions
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// User info check
export const getUserInfo = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log('🔍 getUserInfo: No current user');
    return null;
  }

  console.log('🔍 getUserInfo: Current user email:', currentUser.email);

  // İlk önce admins koleksiyonunda kontrol et
  if (currentUser.email) {
    const adminKey = currentUser.email.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    console.log('🔍 getUserInfo: Admin key generated:', adminKey);

    const adminRef = ref(database, `admins/${adminKey}`);
    const adminSnapshot = await get(adminRef);

    console.log('🔍 getUserInfo: Admin snapshot exists:', adminSnapshot.exists());

    if (adminSnapshot.exists()) {
      const adminData = adminSnapshot.val();
      console.log('🔍 getUserInfo: Admin data:', adminData);

      if (adminData.isActive) {
        console.log('✅ getUserInfo: Admin is active, updating last login');
        // Admin giriş zamanını güncelle - sadece lastLogin alanını güncelle
        try {
          await update(adminRef, {
            lastLogin: Date.now()
          });
        } catch (error) {
          // lastLogin güncellemesi başarısız olsa bile devam et
          console.warn('⚠️ getUserInfo: Failed to update lastLogin:', error);
        }

        return {
          name: adminData.name,
          email: adminData.email,
          isAdmin: true,
          adminKey: adminKey,
          ...adminData
        };
      } else {
        console.log('❌ getUserInfo: Admin is not active');
      }
    } else {
      console.log('❌ getUserInfo: Admin not found in admins collection');
    }
  }

  console.log('🔍 getUserInfo: Checking users collection...');
  // Eğer admins'ta yoksa eski yöntemle users'ta kontrol et
  const userRef = ref(database, getDatabasePath(currentUser.displayName || ''));
  const snapshot = await get(userRef);

  console.log('🔍 getUserInfo: User snapshot exists:', snapshot.exists());

  if (snapshot.exists()) {
    const userData = snapshot.val();
    console.log('🔍 getUserInfo: User data:', userData);
    return {
      name: userData.name,
      isAdmin: userData.isAdmin || false,
      ...userData
    };
  }

  console.log('❌ getUserInfo: No user found anywhere');
  return null;
};


// Auth state listener
export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Export Firebase instances
export { ref, get, set, remove, update, storageRef, uploadString, uploadBytes, getDownloadURL, deleteObject };
// getDatabasePath is already exported as a named export above; no duplicate export needed.
