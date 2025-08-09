import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function SetupProfile() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('family');

  const handleContinue = () => {
    if (!name.trim()) {
      Alert.alert('Please enter your name.');
      return;
    }

    // You could save this to Firebase or AsyncStorage here
    console.log('Setup complete:', { name, role });


    if (role === 'family') {
      router.replace('/dashboard'); // Navigates to family dashboard
    } else {
      router.replace('/caretaker'); // Navigates to caretaker screen
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose User</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor="#aaa"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>I am a...</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={role}
            onValueChange={(value) => setRole(value)}
            style={styles.picker}
          >
            <Picker.Item label="Family Member" value="family" />
            <Picker.Item label="Caretaker" value="caretaker" />
            <Picker.Item label="Elderly User" value="elderly" />
          </Picker>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
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
    color: '#cc2b5e',
  },
  card: {
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 24,
    backdropFilter: 'blur(12px)', // works only in web
    elevation: 10,
    shadowColor: '#cc2b5e',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    color: '#cc2b5e',
  },
  input: {
    borderWidth: 1,
    borderColor: '#f5b4c6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#f5b4c6',
    borderRadius: 10,
    marginTop: 6,
    backgroundColor: '#fff',
  },
  picker: {
    height: 44,
    width: '100%',
  },
  button: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
