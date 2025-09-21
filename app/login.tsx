import { useIsFocused } from '@react-navigation/native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { router } from 'expo-router';
import { signInWithPhoneNumber } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import CountryPicker, {
    Country,
    CountryCode,
} from 'react-native-country-picker-modal';
import { useAuth } from '../components/AuthProvider';
import { auth, firebaseConfig } from '../lib/firebaseConfig';

export default function LoginScreen() {
  const { user, isLoading } = useAuth();
  const isFocused = useIsFocused();

  const [countryCode, setCountryCode] = useState<CountryCode>('IN');
  const [country, setCountry] = useState<Country | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const recaptchaVerifier = useRef<any>(null);
  
  // Check if user is already authenticated and redirect to dashboard
  useEffect(() => {
    if (isFocused && user && !isLoading) {
      router.replace('/dashboard');
    }
  }, [isFocused, user, isLoading]);

  const onSelect = (country: Country) => {
    setCountryCode(country.cca2);
    setCountry(country);
  };

  const handleContinue = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Please enter a valid phone number');
      return;
    }

    const fullPhone = `+${country?.callingCode?.[0] || '91'}${phoneNumber}`;

    try {
      const confirmation = await signInWithPhoneNumber(
        auth,
        fullPhone,
        recaptchaVerifier.current
      );

      router.push({
        pathname: '/verify-otp',
        params: {
          phone: fullPhone,
          verificationId: confirmation.verificationId,
          countryCode: countryCode,
        },
      });
    } catch (error: any) {
      console.error('OTP send error:', error);
      Alert.alert('Error sending OTP', error.message);
    }
  };

  // Show loading indicator while checking authentication state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#d63384" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={firebaseConfig as any}
          attemptInvisibleVerification
        />

        <Text style={styles.title}>
          <Text style={{ fontWeight: 'bold' }}>ElderCare</Text>
        </Text>

        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <Text style={styles.loginHeading}>Login</Text>

            <View style={styles.phoneInputWrapper}>
              <CountryPicker
                countryCode={countryCode}
                withFlag
                withCallingCode
                withFilter
                withEmoji
                onSelect={onSelect}
                containerButtonStyle={styles.countryPicker}
              />
              <Text style={styles.callingCode}>+{country?.callingCode?.[0] || '91'}</Text>
              <TextInput
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                style={styles.phoneInput}
              />
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleContinue}>
              <Text style={styles.loginText}>Continue</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.connectButton} onPress={() => router.push('/connectAccount')}>
              <Text style={styles.connectButtonText}>🔗 Connect Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>
            Don’t have an account?{' '}
            <Text
              style={styles.signupLink}
              onPress={() => router.push('/signup')}
            >
              Sign up
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffe6f0',
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#cc2b5e',
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -270,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    padding: 24,
    borderRadius: 20,
    shadowColor: '#cc2b5e',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  loginHeading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#cc2b5e',
    marginBottom: 20,
    textAlign: 'center',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5b4c6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  countryPicker: {
    marginRight: 8,
  },
  callingCode: {
    fontSize: 16,
    marginRight: 4,
    color: '#cc2b5e',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  loginButton: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f5b4c6',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#f5b4c6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cc2b5e',
  },
  connectButtonText: {
    color: '#cc2b5e',
    fontSize: 16,
    fontWeight: '600',
  },
  signupContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  signupText: {
    color: '#444',
    fontSize: 17,
  },
  signupLink: {
    color: '#cc2b5e',
    fontWeight: '600',
  },
});
