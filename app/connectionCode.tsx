import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const routeParams = useLocalSearchParams<{
    connectionCode?: string;
    qrCodeData?: string;
  }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(routeParams.connectionCode || null);
  const [qr, setQr] = useState<string | null>(routeParams.qrCodeData || null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const maybeFetchFromDb = async () => {
      if (code && qr) return; // already provided via params
      if (!user?.uid) return;
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setRole(data.role || null);
          setCode(data.connectionCode || null);
          setQr((data.qrCodeData as string) || (data.phone && data.connectionCode ? `${data.phone}:${data.connectionCode}` : null));
        }
      } catch (e) {
        console.log('Failed to fetch connection data', e);
      } finally {
        setLoading(false);
      }
    };
    maybeFetchFromDb();
  }, [user?.uid]);

  const handleContinue = () => {
    if (!code) return;
    Alert.alert(
      'Connection Code',
      `Your connection code is: ${code}`,
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

  const renderBody = () => {
    if (loading) {
      return <ActivityIndicator color="#cc2b5e" />;
    }
    if (!code) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connection</Text>
          <Text style={styles.cardContent}>
            {role !== 'family'
              ? 'Only family members have a connection code.'
              : 'No connection code found. Please complete your profile setup.'}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.card}>
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Your Connection Code:</Text>
          <Text style={styles.code}>{code}</Text>
        </View>
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode value={code} size={200} color="#cc2b5e" backgroundColor="white" />
          </View>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connection Code</Text>
      {renderBody()}
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
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 10,
  },
  cardContent: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
    textAlign: 'center',
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
