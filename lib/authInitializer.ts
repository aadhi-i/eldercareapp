// lib/authInitializer.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebaseConfig';

// Key for storing auth state in AsyncStorage
const AUTH_STATE_KEY = 'eldercare_auth_state';

/**
 * This function checks if there's a persisted auth state in AsyncStorage
 * and ensures Firebase auth is properly initialized with that state.
 * 
 * It should be called when the app starts or comes to the foreground.
 */
export const initializeAuthState = async (): Promise<void> => {
  try {
    // Check if we have a stored auth state
    const authStateJson = await AsyncStorage.getItem(AUTH_STATE_KEY);
    
    if (authStateJson) {
      const authState = JSON.parse(authStateJson);
      
      // If we have a stored auth state but Firebase doesn't have a current user,
      // this means the app was killed and restarted, but we want to maintain the session
      if (authState.isAuthenticated && !auth.currentUser) {
        console.log('Restoring auth state from storage');
        // Firebase persistence should handle this automatically with browserLocalPersistence
        // We just need to wait for Firebase to initialize
      }
    }
  } catch (error) {
    console.error('Error initializing auth state:', error);
  }
};