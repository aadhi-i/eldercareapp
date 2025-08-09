import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function VerifyOTP() {
  const { verificationId, phoneNumber } = useLocalSearchParams<{
    verificationId: string;
    phoneNumber: string;
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

  const verifyOtp = async (code: string) => {
    if (!verificationId || !code) {
      Alert.alert('Error', 'Missing verification ID or OTP');
      return;
    }

    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const auth = getAuth();
      await signInWithCredential(auth, credential);

      router.replace('/chooseUser');
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
      <Text style={styles.heading}>Verify OTP</Text>
      <Text style={styles.subHeading}>Enter 6-digit OTP sent to {phoneNumber}</Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputsRef.current[index] = ref)}
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
    backgroundColor: '#fff',
    paddingBottom : 400,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subHeading: {
    fontSize: 16,
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
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    width: 50,
    textAlign: 'center',
  },
});
