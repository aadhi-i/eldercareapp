// lib/firebaseConfig.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
// Removed direct import of getReactNativePersistence and initializeAuth
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: "AIzaSyBlRKVEN8bs7A8qDQ1qYtIXEsoJWTLRCPM",
  authDomain: "eldercare-f5c2f.firebaseapp.com",
  projectId: "eldercare-f5c2f",
  storageBucket: "eldercare-f5c2f.firebasestorage.app",
  messagingSenderId: "478336973283",
  appId: "1:478336973283:web:c7d1de50e886dcc312c8d6"
};

const app = initializeApp(firebaseConfig);

// Use platform-appropriate persistence
let auth: any;
if (Platform.OS === 'web') {
  auth = getAuth(app);
  // Web: use browserLocalPersistence
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error setting persistence:', error);
  });
} else {
  // React Native: use AsyncStorage-based persistence
  // Note: if your environment cannot resolve 'firebase/auth/react-native' types, you can
  // fallback to getAuth(app) without persistence to avoid build errors.
  try {
    // Use dynamic require to avoid TypeScript import issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initializeAuth, getReactNativePersistence } = require('firebase/auth/react-native');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // Fallback: no explicit persistence
    auth = getAuth(app);
  }
}

const db = getFirestore(app);

export { auth, db };

