// lib/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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

export { auth };

