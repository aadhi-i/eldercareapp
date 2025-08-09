// lib/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBlRKVEN8bs7A8qDQ1qYtIXEsoJWTLRCPM",
  authDomain: "eldercare-f5c2f.firebaseapp.com",
  projectId: "eldercare-f5c2f",
  storageBucket: "eldercare-f5c2f.firebasestorage.app",
  messagingSenderId: "478336973283",
  appId: "1:478336973283:web:c7d1de50e886dcc312c8d6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Set persistence to LOCAL to keep the user logged in until they explicitly log out
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error('Error setting persistence:', error);
  });

const db = getFirestore(app);

export { auth, db };

