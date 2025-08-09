import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebaseConfig';

export default function ConnectionCode() {
  const { connectionCode, qrCodeData } = useLocalSearchParams<{
    connectionCode: string;
    qrCodeData: string;
  }>();

  const { user } = useAuth();
  const [qrValue, setQrValue] = useState('');
  const [resolvedCode, setResolvedCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Priority: route param → Firestore user doc
    const load = async () => {
      if (connectionCode) {
        setResolvedCode(String(connectionCode));
        setQrValue(String(connectionCode));
        return;
      }
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const code = snap.exists() ? (snap.data() as any)?.connectionCode : undefined;
        if (code) {
          setResolvedCode(String(code));
          setQrValue(String(code));
        }
      } catch (e) {
        console.warn('Failed to fetch connection code', e);
      }
    };
    load();
  }, [connectionCode, user?.uid]);

  const handleContinue = () => {
    Alert.alert(
      'Connection Code',
      `Your connection code is: ${resolvedCode || connectionCode || ''}`,
      [
        {
          text: 'Copy Code',
          onPress: () => {
            Alert.alert('Code Copied', 'Connection code copied to clipboard');
          },
        },
        {
          text: 'Continue',
          onPress: () => router.replace('/dashboard'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connection Code</Text>
      
      <View style={styles.card}>
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Your Connection Code:</Text>
          <Text style={styles.code}>{resolvedCode || connectionCode}</Text>
        </View>

        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={qrValue || resolvedCode || connectionCode || 'DEFAULT'}
              size={200}
              color="#cc2b5e"
              backgroundColor="white"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffe6f0',
    paddingTop: 60,
    paddingBottom: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#cc2b5e',
  },
  card: {
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#cc2b5e',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    alignItems: 'center',
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cc2b5e',
    marginBottom: 10,
  },
  code: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#cc2b5e',
    letterSpacing: 4,
    backgroundColor: '#f5b4c6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  button: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
