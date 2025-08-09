import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { db } from '../lib/firebaseConfig';

export default function VerifyOTPFamily() {
  const { verificationId, phone, countryCode } = useLocalSearchParams<{
    verificationId: string;
    phone: string;
    countryCode: string;
  }>();

  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const fullCode = otp.join('');
    if (fullCode.length === 6 && verificationId) {
      verifyOtp(fullCode);
    }
  }, [otp]);

  const handleChange = (text: string, index: number) => {
    if (/^\d$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);

      // Move to next input
      if (index < 5) {
        inputsRef.current[index + 1]?.focus();
      }
    } else if (text === '') {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
    }
  };

  const handleUserAccount = async (uid: string) => {
    try {
      // Check if user already exists in Firestore
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('phone', '==', phone));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // User already exists, log them in
        console.log('Existing family member found');
        Alert.alert(
          'Account Error',
          'This phone number is already registered with a different account.'
        );
        return;
      }

      // New user - navigate directly to setupProfile with family role
      console.log('New user, navigating to setup profile with role family...');
      router.push({
        pathname: '/setupProfile',
        params: {
          uid: uid,
          phone: phone,
          countryCode: countryCode,
          role: 'family',
          name: '',
        },
      });
    } catch (error: any) {
      console.error('Error handling user account:', error);
      Alert.alert(
        'Account Error',
        'Failed to verify your account. Please try again.'
      );
    }
  };

  const verifyOtp = async (code: string) => {
    if (!verificationId || !code) {
      Alert.alert('Error', 'Missing verification ID or OTP');
      return;
    }

    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const auth = getAuth();
      const userCredential = await signInWithCredential(auth, credential);
      
      // Handle user account creation/login
      await handleUserAccount(userCredential.user.uid);
    } catch (err: any) {
      console.error('OTP verification error:', err);

      let message = 'Verification failed. Please try again.';
      if (err.code === 'auth/invalid-verification-code') {
        message = 'Invalid OTP. Please check and try again.';
      } else if (err.code === 'auth/code-expired') {
        message = 'OTP expired. Please request a new one.';
      }

      Alert.alert('Verification Error', message);
      setOtp(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>Enter 6-digit code</Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputsRef.current[index] = ref;
            }}
            style={styles.otpBox}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            autoFocus={index === 0}
          />
        ))}
      </View>

      {loading && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffe6f0',
    paddingBottom: 400,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#cc2b5e',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  otpBox: {
    borderWidth: 1,
    borderColor: '#f5b4c6',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    width: 50,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
});
