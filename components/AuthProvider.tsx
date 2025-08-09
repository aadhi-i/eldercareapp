// components/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
import { saveAuthState } from '../lib/authStateManager';
import { initializeAuthState } from '../lib/authInitializer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

// Define the shape of the auth context
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
};

// Create the auth context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
});

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state when component mounts
    const initialize = async () => {
      await initializeAuthState();
    };
    initialize();

    // Handle app state changes
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App has come to the foreground, check auth state
        console.log('App has come to the foreground');
        await initializeAuthState();
      }
    };

    // Subscribe to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      
      // Save auth state whenever it changes
      saveAuthState(currentUser);
    });

    // Subscribe to app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup function
    return () => {
      unsubscribeAuth();
      appStateSubscription.remove();
    };
  }, []);

  // Provide the auth context to children
  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}