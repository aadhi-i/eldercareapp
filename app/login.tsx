import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router'; // ✅ added import for router
import React, { useState } from 'react';
import {
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

export default function LoginScreen() {
  const [countryCode, setCountryCode] = useState<CountryCode>('IN');
  const [country, setCountry] = useState<Country | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  const onSelect = (country: Country) => {
    setCountryCode(country.cca2);
    setCountry(country);
  };

  const handleContinue = () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Please enter a valid phone number');
      return;
    }
    Alert.alert('Login', `Logging in with +${country?.callingCode?.[0] || '91'} ${phoneNumber}`);
    // Navigate to verification or home screen
  };

  const handleGoogleLogin = () => {
    Alert.alert('Google Login pressed');
    // Trigger Google authentication logic here
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
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

            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR</Text>
              <View style={styles.separatorLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
              <Ionicons name="logo-google" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.googleText}>Login with Google</Text>
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
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  title: {
    fontSize: 26,
    marginBottom: 20,
    textAlign: 'center',
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -270,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  loginHeading: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 25,
    marginBottom: 20,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 20,
  },
  countryPicker: {
    marginRight: 8,
  },
  callingCode: {
    fontSize: 16,
    marginRight: 4,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ccc',
  },
  separatorText: {
    marginHorizontal: 8,
    color: '#999',
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#DB4437',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleText: {
    color: '#fff',
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
    color: '#007AFF',
    fontWeight: '600',
  },
});
