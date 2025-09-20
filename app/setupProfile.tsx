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

export default function SetupProfile() {
  const { uid, phone, countryCode, role, name, connectionCode, isConnecting } = useLocalSearchParams<{
    uid?: string;
    phone?: string;
    countryCode?: string;
    role: string;
    name?: string;
    connectionCode?: string;
    isConnecting?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (name) {
      const nameParts = name.trim().split(' ');
      return {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phoneNumber: phone || '',
        age: '',
        emergencyContact: '',
        address: '',
        healthStatus: '',
        illnesses: '',
      };
    }
    return {
      firstName: '',
      lastName: '',
      phoneNumber: phone || '',
      age: '',
      emergencyContact: '',
      address: '',
      healthStatus: '',
      illnesses: '',
    };
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

  // Generate random 6-digit alphanumeric code for family members
  const generateConnectionCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Auto-fill emergency contact for elderly from family member's phone
  useEffect(() => {
    if (isConnecting === 'true' && connectionCode && role === 'elder') {
      fetchFamilyMemberPhone();
    }
  }, [connectionCode, role, isConnecting]);

  const fetchFamilyMemberPhone = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('connectionCode', '==', connectionCode));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const familyMemberData = querySnapshot.docs[0].data();
        if (familyMemberData.phone) {
          setFormData(prev => ({
            ...prev,
            emergencyContact: familyMemberData.phone
          }));
        }
      }
    } catch (error) {
      console.log('Error fetching family member phone:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
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
    // Only name, phone, and emergency contact are mandatory
    if (!formData.firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return false;
    }
    if (!formData.lastName.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      return false;
    }
    if (role === 'elder' && !formData.phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return false;
    }
    if (role !== 'family' && !formData.emergencyContact.trim()) {
      Alert.alert('Error', 'Please enter an emergency contact');
      return false;
    }
    if (role === 'family' && !formData.address.trim()) {
      Alert.alert('Error', 'Please enter your address');
      return false;
    }
    if (role === 'family' && !formData.age.trim()) {
      Alert.alert('Error', 'Please enter your age');
      return false;
    }
    // Validate phone number format
    if (role === 'elder' && formData.phoneNumber.trim() && !/^\d{10}$/.test(formData.phoneNumber.trim())) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return false;
    }
    // Validate emergency contact format
    if (formData.emergencyContact.trim() && !/^\d{10}$/.test(formData.emergencyContact.trim())) {
      Alert.alert('Error', 'Please enter a valid 10-digit emergency contact number');
      return false;
    }
    return true;
  };

  const handleCreateProfile = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isConnecting === 'true' && connectionCode) {
        // Handle connecting to existing account
        await handleConnectToAccount();
      } else if (uid && phone && countryCode) {
        // Handle new user registration
        await handleNewUserRegistration();
      } else {
        Alert.alert('Error', 'Missing required parameters');
      }
    } catch (error: any) {
      console.error('Error creating profile:', error);
      Alert.alert(
        'Profile Creation Error',
        'Failed to create your profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConnectToAccount = async () => {
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

      // Ensure the connecting user is authenticated so we can link by their Firebase uid
  const currentUid = auth.currentUser?.uid;
      if (!currentUid) {
        Alert.alert('Authentication required', 'Please log in again to complete the connection.');
        router.replace('/login');
        return;
      }

      // Create new user document for elder/caregiver
      const newUserRef = doc(usersRef, currentUid);
      const userData: any = {
        uid: currentUid,
        role: role || 'elder',
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        address: formData.address.trim() || null,
        emergencyContact: familyMemberData.phone, // Always use family member's phone as emergency contact
        healthStatus: formData.healthStatus.trim() || null,
        illnesses: formData.illnesses.trim() || null,
        medicines: medicines,
        createdAt: serverTimestamp(),
        connectedTo: familyMemberDoc.id, // Link to family member
        familyMemberPhone: familyMemberData.phone,
      };
      
      // Add phone number for elderly users
      if (role === 'elder') {
        userData.phone = formData.phoneNumber.trim();
      }

      await setDoc(newUserRef, userData);

      console.log('Account connected successfully');
      router.replace('/dashboard');
    } catch (error: any) {
      console.error('Error connecting account:', error);
      throw error;
    }
  };

  const handleNewUserRegistration = async () => {
    try {
      const usersRef = collection(db, 'users');
      const userDocRef = doc(usersRef, uid);
      
      const userData: any = {
        uid: uid,
        phone: role === 'elder' ? formData.phoneNumber.trim() : phone,
        countryCode: countryCode,
        role: role || 'elder',
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        address: formData.address.trim() || null,
        emergencyContact: formData.emergencyContact.trim(),
        healthStatus: formData.healthStatus.trim() || null,
        illnesses: formData.illnesses.trim() || null,
        medicines: medicines,
        createdAt: serverTimestamp(),
        caregiverTokens: [],
      };

      // Generate connection code for family members
      if (role === 'family') {
        userData.connectionCode = generateConnectionCode();
        userData.qrCodeData = `${phone}:${userData.connectionCode}`;
      }

      await setDoc(userDocRef, userData);

      console.log('Profile created successfully');
      
      if (role === 'family') {
        // Navigate to connection code screen for family members
        router.push({
          pathname: '/connectionCode',
          params: {
            connectionCode: userData.connectionCode,
            qrCodeData: userData.qrCodeData,
          },
        });
      } else {
        router.replace('/dashboard');
      }
    } catch (error: any) {
      console.error('Error creating profile:', error);
      throw error;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>
          <Text style={{ fontWeight: 'bold' }}>
            {isConnecting === 'true' ? 'Connect Profile' : 'Setup Profile'}
          </Text>
        </Text>
        
        <Text style={styles.subtitle}>
          {isConnecting === 'true' 
            ? 'Please provide your information to connect to the family account'
            : 'Please provide your information to complete your profile'
          }
        </Text>

        <View style={styles.formContainer}>
          {/* Mandatory Fields */}
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

            {role === 'elder' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number *</Text>
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
            )}

            {role !== 'family' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Emergency Contact *</Text>
                <TextInput
                  style={[styles.input, isConnecting === 'true' && role === 'elder' && styles.disabledInput]}
                  value={formData.emergencyContact}
                  onChangeText={(value) => handleInputChange('emergencyContact', value)}
                  placeholder="Enter emergency contact number"
                  keyboardType="phone-pad"
                  editable={!(isConnecting === 'true' && role === 'elder')}
                />
                {isConnecting === 'true' && role === 'elder' && (
                  <Text style={styles.helperText}>
                    This is automatically set to your family member's phone number and cannot be changed
                  </Text>
                )}
              </View>
            )}

            {role === 'family' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.address}
                  onChangeText={(value) => handleInputChange('address', value)}
                  placeholder="Enter your address"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <Text style={styles.helperText}>
                  This address will be used for emergency situations
                </Text>
              </View>
            )}
          </View>

          {/* Optional Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information (Optional)</Text>
            
            {role === 'family' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Age *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.age}
                  onChangeText={(value) => handleInputChange('age', value)}
                  placeholder="Enter your age"
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={styles.helperText}>
                  Required for family members to ensure appropriate care coordination
                </Text>
              </View>
            )}

            {role !== 'family' && (
              <>
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
              </>
            )}

            {role !== 'family' && (
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
            )}

            {role !== 'family' && (
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
            )}
          </View>

          {/* Medicine Management */}
          {role === 'elder' && (
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
          )}

          <TouchableOpacity 
            style={[styles.createButton, loading && styles.disabledButton]} 
            onPress={handleCreateProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>
                {isConnecting === 'true' ? 'Connect Account' : 'Create Profile'}
              </Text>
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
  createButton: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
