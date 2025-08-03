// components/GoogleSignIn.tsx
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import React, { useEffect } from 'react';
import { Alert, Button } from 'react-native';
import { auth } from '../lib/firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

const GoogleSignIn = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "478336973283-6tr8o7mo4i181erfk4lalvotm4b59tsl.apps.googleusercontent.com",
    expoClientId: "478336973283-8gulqp4jcdfghfpnqln7c257lgerivbr.apps.googleusercontent.com", // required for Expo Go
  });

  useEffect(() => {
    const authenticate = async () => {
      if (response?.type === 'success') {
        const { id_token } = response.params;

        const credential = GoogleAuthProvider.credential(id_token);
        try {
          await signInWithCredential(auth, credential);
          Alert.alert('Success', 'Logged in with Google!');
        } catch (error: any) {
          Alert.alert('Firebase Auth Error', error.message);
        }
      }
    };

    authenticate();
  }, [response]);

  return (
    <Button
      title="Continue with Google"
      onPress={() => promptAsync()}
      disabled={!request}
    />
  );
};

export default GoogleSignIn;
