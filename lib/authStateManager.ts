// lib/authStateManager.ts
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Key for storing auth state in AsyncStorage
const AUTH_STATE_KEY = 'eldercare_auth_state';

// Save the current auth state to AsyncStorage
export const saveAuthState = async (user: User | null) => {
  try {
    if (user) {
      // Store minimal user info needed to restore session
      await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
        uid: user.uid,
        isAuthenticated: true,
      }));
    } else {
      // Clear auth state when user is null (logged out)
      await AsyncStorage.removeItem(AUTH_STATE_KEY);
    }
  } catch (error) {
    console.error('Error saving auth state:', error);
  }
};

// Hook to manage auth state persistence across app lifecycle
export const useAuthStatePersistence = () => {
  useEffect(() => {
    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App has come to the foreground
        console.log('App has come to the foreground');
      }
    };

    // Subscribe to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Save auth state whenever it changes
      saveAuthState(user);
    });

    // Subscribe to app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup function
    return () => {
      unsubscribeAuth();
      appStateSubscription.remove();
    };
  }, []);
};

// Function to check if user is authenticated from AsyncStorage
export const checkPersistedAuthState = async (): Promise<boolean> => {
  try {
    const authStateJson = await AsyncStorage.getItem(AUTH_STATE_KEY);
    if (authStateJson) {
      const authState = JSON.parse(authStateJson);
      return authState.isAuthenticated === true;
    }
    return false;
  } catch (error) {
    console.error('Error checking persisted auth state:', error);
    return false;
  }
};