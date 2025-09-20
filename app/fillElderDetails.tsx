import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
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
import { auth, db } from '../lib/firebaseConfig';

interface Medicine {
  name: string;
  timings: string[];
  dosage: string;
}

export default function FillElderDetails() {
  const { connectionCode, isConnecting } = useLocalSearchParams<{
    connectionCode?: string;
    isConnecting?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    age: '',
    emergencyContact: '', // This will be pre-filled and fixed
    address: '',
    healthStatus: '',
    illnesses: '',
  });

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [newMedicine, setNewMedicine] = useState<Medicine>({
    name: '',
    timings: [],
    dosage: '',
  });
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [currentTimings, setCurrentTimings] = useState<string[]>([]);
  const [familyMemberPhone, setFamilyMemberPhone] = useState<string>('');

  // Auto-fill emergency contact from family member's phone
  useEffect(() => {
    if (isConnecting === 'true' && connectionCode) {
      fetchFamilyMemberPhone();
    }
  }, [connectionCode, isConnecting]);

  const fetchFamilyMemberPhone = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('connectionCode', '==', connectionCode));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const familyMemberData = querySnapshot.docs[0].data();
        if (familyMemberData.phone) {
          setFamilyMemberPhone(familyMemberData.phone);
          setFormData(prev => ({
            ...prev,
            emergencyContact: familyMemberData.phone
          }));
        }
      }
    } catch (error) {
      console.log('Error fetching family member phone:', error);
      Alert.alert('Error', 'Failed to fetch family member details. Please try again.');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    // Prevent editing of emergency contact
    if (field === 'emergencyContact') {
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addMedicine = () => {
    if (!newMedicine.name.trim() || newMedicine.timings.length === 0 || !newMedicine.dosage.trim()) {
      Alert.alert('Error', 'Please fill all medicine details');
      return;
    }

    setMedicines(prev => [...prev, { ...newMedicine }]);
    setNewMedicine({ name: '', timings: [], dosage: '' });
    setCurrentTimings([]);
    setShowMedicineForm(false);
  };
  
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setSelectedTime(selectedDate);
      const hours = selectedDate.getHours();
      const minutes = selectedDate.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      const timeString = `${formattedHours}:${formattedMinutes} ${period}`;
      
      // Add the new time to current timings
      const updatedTimings = [...currentTimings, timeString];
      setCurrentTimings(updatedTimings);
      setNewMedicine(prev => ({ ...prev, timings: updatedTimings }));
    }
  };
  
  const removeTime = (index: number) => {
    const updatedTimings = currentTimings.filter((_, i) => i !== index);
    setCurrentTimings(updatedTimings);
    setNewMedicine(prev => ({ ...prev, timings: updatedTimings }));
  };

  const removeMedicine = (index: number) => {
    setMedicines(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return false;
    }
    if (!formData.lastName.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      return false;
    }
    if (!formData.phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return false;
    }
    if (!formData.emergencyContact.trim()) {
      Alert.alert('Error', 'Emergency contact is required');
      return false;
    }
    // Validate phone number format
    if (!/^\d{10}$/.test(formData.phoneNumber.trim())) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return false;
    }
    return true;
  };

  const handleSaveElderDetails = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Find the family member with the connection code
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('connectionCode', '==', connectionCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('Error', 'Invalid connection code. Please check and try again.');
        return;
      }

      const familyMemberDoc = querySnapshot.docs[0];
      const familyMemberData = familyMemberDoc.data();

      // Generate a unique ID for the elder if not authenticated
      // This ensures the elder can be saved even without authentication
      const currentUid = auth.currentUser?.uid || `elder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create new user document for elder
      const newUserRef = doc(usersRef, currentUid);
      const userData: any = {
        uid: currentUid,
        role: 'elder',
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phoneNumber.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        address: formData.address.trim() || null,
        emergencyContact: familyMemberPhone, // Always use family member's phone as emergency contact
        healthStatus: formData.healthStatus.trim() || null,
        illnesses: formData.illnesses.trim() || null,
        medicines: medicines,
        createdAt: serverTimestamp(),
        connectedTo: familyMemberDoc.id, // Link to family member
        familyMemberPhone: familyMemberData.phone,
      };

      await setDoc(newUserRef, userData);

      console.log('Elder details saved successfully');
      
      // Directly redirect to dashboard without requiring user interaction
      router.replace('/dashboard');
    } catch (error: any) {
      console.error('Error saving elder details:', error);
      Alert.alert(
        'Save Error',
        'Failed to save your details. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>
          <Text style={{ fontWeight: 'bold' }}>Fill Elder Details</Text>
        </Text>
        
        <Text style={styles.subtitle}>
          Please provide your information to connect to your family member's account
        </Text>

        <View style={styles.formContainer}>
          {/* Required Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Required Information *</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                placeholder="Enter your first name"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                placeholder="Enter your last name"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={formData.phoneNumber}
                onChangeText={(value) => handleInputChange('phoneNumber', value)}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />
              <Text style={styles.helperText}>
                This number will be used for future logins
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Emergency Contact *</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={formData.emergencyContact}
                editable={false}
                placeholder="Emergency contact will be auto-filled"
              />
              <Text style={styles.helperText}>
                This is automatically set to your family member's phone number and cannot be changed
              </Text>
            </View>
          </View>

          {/* Optional Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information (Optional)</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={formData.age}
                onChangeText={(value) => handleInputChange('age', value)}
                placeholder="Enter your age"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.address}
                onChangeText={(value) => handleInputChange('address', value)}
                placeholder="Enter your address"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Health Status</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.healthStatus}
                onChangeText={(value) => handleInputChange('healthStatus', value)}
                placeholder="Describe your current health status"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Illnesses/Conditions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.illnesses}
                onChangeText={(value) => handleInputChange('illnesses', value)}
                placeholder="List any illnesses or medical conditions"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Medicine Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💊 Medicine Management</Text>
            
            {medicines.map((medicine, index) => (
              <View key={index} style={styles.medicineItem}>
                <View style={styles.medicineInfo}>
                  <Text style={styles.medicineName}>{medicine.name}</Text>
                  <Text style={styles.medicineDetails}>
                    {medicine.timings.join(', ')} • {medicine.dosage}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeMedicine(index)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            {showMedicineForm ? (
              <View style={styles.medicineForm}>
                <TextInput
                  style={styles.input}
                  value={newMedicine.name}
                  onChangeText={(value) => setNewMedicine(prev => ({ ...prev, name: value }))}
                  placeholder="Medicine name"
                />
                
                <View style={styles.timingsContainer}>
                  <Text style={styles.label}>Medicine Timings</Text>
                  
                  {currentTimings.length > 0 && (
                    <View style={styles.timingsList}>
                      {currentTimings.map((time, index) => (
                        <View key={index} style={styles.timingItem}>
                          <Text style={styles.timingText}>{time}</Text>
                          <TouchableOpacity
                            style={styles.removeTimeButton}
                            onPress={() => removeTime(index)}
                          >
                            <Text style={styles.removeButtonText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={styles.timePickerButtonText}>+ Add Time</Text>
                  </TouchableOpacity>
                  
                  {showTimePicker && (
                    <DateTimePicker
                      value={selectedTime}
                      mode="time"
                      is24Hour={false}
                      display="default"
                      onChange={handleTimeChange}
                    />
                  )}
                </View>
                
                <TextInput
                  style={styles.input}
                  value={newMedicine.dosage}
                  onChangeText={(value) => setNewMedicine(prev => ({ ...prev, dosage: value }))}
                  placeholder="Dosage (numbers only)"
                  keyboardType="numeric"
                />
                
                <View style={styles.medicineFormButtons}>
                  <TouchableOpacity
                    style={[styles.addMedicineButton, 
                      (!newMedicine.name.trim() || currentTimings.length === 0 || !newMedicine.dosage.trim()) && 
                      styles.disabledButton]}
                    onPress={addMedicine}
                    disabled={!newMedicine.name.trim() || currentTimings.length === 0 || !newMedicine.dosage.trim()}
                  >
                    <Text style={styles.addMedicineButtonText}>Add Medicine</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowMedicineForm(false);
                      setNewMedicine({ name: '', timings: [], dosage: '' });
                      setCurrentTimings([]);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addMedicineTrigger}
                onPress={() => setShowMedicineForm(true)}
              >
                <Text style={styles.addMedicineTriggerText}>+ Add Medicine</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, loading && styles.disabledButton]} 
            onPress={handleSaveElderDetails}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Details & Connect</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffe6f0',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#cc2b5e',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    padding: 24,
    borderRadius: 20,
    shadowColor: '#cc2b5e',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cc2b5e',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5b4c6',
    paddingBottom: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cc2b5e',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#f5b4c6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  medicineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f5b4c6',
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cc2b5e',
  },
  medicineDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    backgroundColor: '#ff6b6b',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  medicineForm: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f5b4c6',
  },
  timingsContainer: {
    marginBottom: 10,
  },
  timingsList: {
    marginVertical: 10,
  },
  timingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#f5b4c6',
  },
  timingText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  removeTimeButton: {
    backgroundColor: '#ff6b6b',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerButton: {
    backgroundColor: '#f5b4c6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cc2b5e',
    marginTop: 5,
  },
  timePickerButtonText: {
    color: '#cc2b5e',
    fontSize: 14,
    fontWeight: '600',
  },
  medicineFormButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  addMedicineButton: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  addMedicineButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#ccc',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addMedicineTrigger: {
    backgroundColor: '#f5b4c6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cc2b5e',
  },
  addMedicineTriggerText: {
    color: '#cc2b5e',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
