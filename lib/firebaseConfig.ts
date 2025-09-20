// lib/firebaseConfig.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
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
let auth: ReturnType<typeof getAuth>;
if (Platform.OS === 'web') {
  auth = getAuth(app);
  // Web: use browserLocalPersistence
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error setting persistence:', error);
  });
} else {
  // React Native: use AsyncStorage-based persistence via dynamic require for compatibility
  try {
    // First try to import from main package (some versions export RN APIs here)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnAuth = require('firebase/auth');
    if (rnAuth?.initializeAuth && rnAuth?.getReactNativePersistence) {
      auth = rnAuth.initializeAuth(app, {
        persistence: rnAuth.getReactNativePersistence(AsyncStorage),
      });
    }
  } catch (e) {
    // As a last resort, getAuth without persistence (will log a warning)
    auth = getAuth(app);
  }
}

const db = getFirestore(app);

export { auth, db };

