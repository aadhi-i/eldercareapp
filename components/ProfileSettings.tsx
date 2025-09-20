import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../lib/firebaseConfig';

interface Medicine {
  name: string;
  timings: string[];
  dosage: string;
  stock?: number;
}

interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  phone?: string;
  age?: number;
  address?: string;
  emergencyContact?: string;
  healthStatus?: string;
  illnesses?: string;
  medicines?: Medicine[];
  role: string;
  connectedTo?: string;
}

export default function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [elderlyProfiles, setElderlyProfiles] = useState<UserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [elderData, setElderData] = useState<UserProfile | null>(null);
  const [familyData, setFamilyData] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated');
        setLoading(false);
        return;
      }

      // Get current user's profile
      const usersRef = collection(db, 'users');
      const userDocRef = doc(usersRef, currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      let userData: UserProfile | null = null;

      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        userData = { ...data, uid: data.uid || currentUser.uid };
      } else {
        // 1) Try by uid field
        const byUidSnap = await getDocs(query(usersRef, where('uid', '==', currentUser.uid)));
        if (!byUidSnap.empty) {
          const d = byUidSnap.docs[0];
          const data = d.data() as UserProfile;
          userData = { ...data, uid: data.uid || currentUser.uid };
        }
        // 2) Try by phone number (and common variants)
        if (!userData && currentUser.phoneNumber) {
          const phone = currentUser.phoneNumber;
          const exact = await getDocs(query(usersRef, where('phone', '==', phone)));
          if (!exact.empty) {
            const d = exact.docs[0];
            const data = d.data() as UserProfile;
            userData = { ...data, uid: data.uid || currentUser.uid };
          }
          if (!userData) {
            const digits = String(phone).replace(/\D/g, '');
            const last10 = digits.slice(-10);
            if (last10) {
              const byLast10 = await getDocs(query(usersRef, where('phone', '==', last10)));
              if (!byLast10.empty) {
                const d = byLast10.docs[0];
                const data = d.data() as UserProfile;
                userData = { ...data, uid: data.uid || currentUser.uid };
              }
              if (!userData && /^\d{10}$/.test(last10)) {
                const byNum = await getDocs(query(usersRef, where('phone', '==', Number(last10) as any)));
                if (!byNum.empty) {
                  const d = byNum.docs[0];
                  const data = d.data() as UserProfile;
                  userData = { ...data, uid: data.uid || currentUser.uid };
                }
              }
            }
          }
        }

        // 3) As a last resort for family: try to find any elder connected to this account
        if (!userData) {
          const elderQuery = query(usersRef, where('connectedTo', '==', currentUser.uid));
          const elderSnapshot = await getDocs(elderQuery);
          if (!elderSnapshot.empty) {
            const d0 = elderSnapshot.docs[0];
            const elder = d0.data() as UserProfile;
            setElderData({ ...elder, uid: elder.uid || d0.id });
            setCurrentUserRole('family');
            setFamilyData({ ...(elder as any), role: 'family', uid: currentUser.uid } as UserProfile);
            setLoading(false);
            return;
          }
        }
      }

      if (!userData) {
        Alert.alert('Error', 'User profile not found');
        setLoading(false);
        return;
      }

      // Ensure required fields have sensible defaults
      const normalizedUser: UserProfile = {
        uid: userData.uid || currentUser.uid,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userData.phone,
        age: userData.age,
        address: userData.address,
        emergencyContact: userData.emergencyContact,
        healthStatus: userData.healthStatus,
        illnesses: userData.illnesses,
        medicines: userData.medicines || [],
        role: userData.role,
        connectedTo: userData.connectedTo,
      };

      setUserProfile(normalizedUser);
      setCurrentUserRole(normalizedUser.role);

      // Determine elder data based on user role
      if (normalizedUser.role === 'elder') {
        // If current user is elder, use their data
        setElderData(normalizedUser);
        
        // Find connected family member
        if (normalizedUser.connectedTo) {
          const familyDocRef = doc(usersRef, normalizedUser.connectedTo);
          const familyDoc = await getDoc(familyDocRef);
          if (familyDoc.exists()) {
            const fd = familyDoc.data() as UserProfile;
            setFamilyData({
              uid: fd.uid || normalizedUser.connectedTo!,
              firstName: fd.firstName || '',
              lastName: fd.lastName || '',
              phone: fd.phone,
              age: fd.age,
              address: fd.address,
              emergencyContact: fd.emergencyContact,
              healthStatus: fd.healthStatus,
              illnesses: fd.illnesses,
              medicines: fd.medicines || [],
              role: fd.role,
              connectedTo: fd.connectedTo,
            });
          }
        }
      } else if (normalizedUser.role === 'family') {
        // If current user is family member, set as family data and find connected elder
        setFamilyData(normalizedUser);
        await fetchConnectedElderlyProfiles(currentUser.uid);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
      setLoading(false);
    }
  };

  const fetchConnectedElderlyProfiles = async (familyMemberId: string) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('connectedTo', '==', familyMemberId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const profiles = querySnapshot.docs.map(d => {
          const data = d.data() as UserProfile;
          return { ...data, uid: data.uid || d.id } as UserProfile;
        });
        setElderlyProfiles(profiles);
        
        // Set the first connected elder as the main elder data
        if (profiles.length > 0) {
          setElderData(profiles[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching connected profiles:', error);
      Alert.alert('Error', 'Failed to load connected profiles');
    }
  };

  // Update elder data when elderly profiles change
  useEffect(() => {
    if (elderlyProfiles.length > 0 && currentUserRole === 'family' && !elderData) {
      setElderData(elderlyProfiles[0]);
    }
  }, [elderlyProfiles, currentUserRole, elderData]);

  const handleEditProfile = (profile: UserProfile) => {
    setSelectedProfile(profile);
    setEditMode(true);
  };

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    if (!selectedProfile) return;
    
    setSelectedProfile(prev => {
      if (!prev) return prev;
      
      if (field === 'age') {
        return { ...prev, [field]: value ? parseInt(value) : undefined };
      }
      
      return { ...prev, [field]: value };
    });
  };

  const handleSaveProfile = async () => {
    if (!selectedProfile) return;
    
    try {
      setSaving(true);
      
      const usersRef = collection(db, 'users');
      const userDocRef = doc(usersRef, selectedProfile.uid);
      
      // Update only the editable fields
      await updateDoc(userDocRef, {
        firstName: selectedProfile.firstName,
        lastName: selectedProfile.lastName,
        age: selectedProfile.age,
        address: selectedProfile.address || null,
        emergencyContact: selectedProfile.emergencyContact,
        healthStatus: selectedProfile.healthStatus || null,
        illnesses: selectedProfile.illnesses || null,
      });
      
      // If this is the current user's profile, update the state
      if (userProfile && userProfile.uid === selectedProfile.uid) {
        setUserProfile(selectedProfile);
      } else {
        // Update the elderly profile in the list
        setElderlyProfiles(prev => 
          prev.map(profile => 
            profile.uid === selectedProfile.uid ? selectedProfile : profile
          )
        );
      }
      
      setEditMode(false);
      setSelectedProfile(null);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setSelectedProfile(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d63384" />
        <Text style={styles.loadingText}>Loading profile data...</Text>
      </View>
    );
  }

  if (editMode && selectedProfile) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Edit Profile</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              value={selectedProfile.firstName}
              onChangeText={(value) => handleInputChange('firstName', value)}
              placeholder="Enter first name"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={styles.input}
              value={selectedProfile.lastName}
              onChangeText={(value) => handleInputChange('lastName', value)}
              placeholder="Enter last name"
            />
          </View>
          
          {selectedProfile.role === 'elder' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, { color: '#888' }]}
                value={selectedProfile.phone}
                editable={false}
                placeholder="Phone number"
              />
              <Text style={styles.helperText}>Phone number cannot be changed</Text>
            </View>
          )}
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              value={selectedProfile.age?.toString() || ''}
              onChangeText={(value) => handleInputChange('age', value)}
              placeholder="Enter age"
              keyboardType="number-pad"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={selectedProfile.address || ''}
              onChangeText={(value) => handleInputChange('address', value)}
              placeholder="Enter address"
              multiline
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Emergency Contact *</Text>
            <TextInput
              style={styles.input}
              value={selectedProfile.emergencyContact || ''}
              onChangeText={(value) => handleInputChange('emergencyContact', value)}
              placeholder="Enter emergency contact"
              keyboardType="phone-pad"
            />
          </View>
          
          {selectedProfile.role === 'elder' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Health Status</Text>
                <TextInput
                  style={styles.input}
                  value={selectedProfile.healthStatus || ''}
                  onChangeText={(value) => handleInputChange('healthStatus', value)}
                  placeholder="Enter health status"
                  multiline
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Illnesses</Text>
                <TextInput
                  style={styles.input}
                  value={selectedProfile.illnesses || ''}
                  onChangeText={(value) => handleInputChange('illnesses', value)}
                  placeholder="Enter illnesses"
                  multiline
                />
              </View>
            </>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={handleCancelEdit}
              disabled={saving}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.saveButton, saving && styles.disabledButton]} 
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Elder Profile Display - Always show elder data for both users */}
      {elderData && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>👤 Elder Profile</Text>
            {currentUserRole === 'family' && (
              <TouchableOpacity 
                style={styles.editButton} 
                onPress={() => handleEditProfile(elderData)}
              >
                <Ionicons name="create-outline" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Basic Information */}
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Basic Information</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>{elderData.firstName} {elderData.lastName}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age:</Text>
              <Text style={styles.infoValue}>{elderData.age || 'Not specified'}</Text>
            </View>
            
            {elderData.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone:</Text>
                <Text style={styles.infoValue}>{elderData.phone}</Text>
              </View>
            )}
            
            {elderData.address && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address:</Text>
                <Text style={styles.infoValue}>{elderData.address}</Text>
              </View>
            )}
          </View>

          {/* Health Information */}
          {(elderData.healthStatus || elderData.illnesses) && (
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>Health Information</Text>
              
              {elderData.healthStatus && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Health Status:</Text>
                  <Text style={styles.infoValue}>{elderData.healthStatus}</Text>
                </View>
              )}
              
              {elderData.illnesses && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Medical Conditions:</Text>
                  <Text style={styles.infoValue}>{elderData.illnesses}</Text>
                </View>
              )}
            </View>
          )}
          
          {currentUserRole === 'elder' && (
            <View style={styles.readOnlyNotice}>
              <Text style={styles.readOnlyText}>
                📖 This is your profile. Contact your family member to make changes.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* All Medications Section */}
      {elderData && elderData.medicines && elderData.medicines.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💊 All Medications</Text>
            {currentUserRole === 'family' && (
              <TouchableOpacity 
                style={styles.editButton} 
                onPress={() => {
                  Alert.alert('Edit Medications', 'Medication editing will be available in the medication management section');
                }}
              >
                <Ionicons name="create-outline" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.medicationsSection}>
            {elderData.medicines.map((med, index) => (
              <View key={index} style={styles.medicationItem}>
                <Text style={styles.medicationName}>{med.name}</Text>
                <View style={styles.medicationDetailsContainer}>
                  <Text style={styles.medicationDetails}>
                    <Text style={styles.medicationLabel}>Dosage:</Text> {med.dosage}
                  </Text>
                  {med.timings && med.timings.length > 0 && (
                    <Text style={styles.medicationDetails}>
                      <Text style={styles.medicationLabel}>Times:</Text> {med.timings.join(', ')}
                    </Text>
                  )}
                  {med.stock && (
                    <Text style={styles.medicationDetails}>
                      <Text style={styles.medicationLabel}>Stock:</Text> {med.stock} days remaining
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
          
          {currentUserRole === 'elder' && (
            <View style={styles.readOnlyNotice}>
              <Text style={styles.readOnlyText}>
                📖 Contact your family member to update medications.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Emergency Contact Section */}
      {elderData && elderData.emergencyContact && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚨 Emergency Contact</Text>
            {currentUserRole === 'family' && (
              <TouchableOpacity 
                style={styles.editButton} 
                onPress={() => handleEditProfile(elderData)}
              >
                <Ionicons name="create-outline" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.emergencyContactSection}>
            <Text style={styles.emergencyContactLabel}>Emergency Contact Number:</Text>
            <Text style={styles.emergencyContactNumber}>{elderData.emergencyContact}</Text>
            <Text style={styles.emergencyContactNote}>
              This is the primary emergency contact number for {elderData.firstName}
            </Text>
          </View>
          
          {currentUserRole === 'elder' && (
            <View style={styles.readOnlyNotice}>
              <Text style={styles.readOnlyText}>
                📖 Contact your family member to update emergency contact.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Family Member Details */}
      {familyData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👨‍👩‍👧‍👦 Family Member Details</Text>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{familyData.firstName} {familyData.lastName}</Text>
            <Text style={styles.profileDetail}>Role: Family Member</Text>
            {familyData.phone && <Text style={styles.profileDetail}>Phone: {familyData.phone}</Text>}
            {familyData.age && <Text style={styles.profileDetail}>Age: {familyData.age}</Text>}
            {familyData.address && <Text style={styles.profileDetail}>Address: {familyData.address}</Text>}
          </View>
          
          {currentUserRole === 'family' && (
            <TouchableOpacity 
              style={[styles.button, styles.editButton]} 
              onPress={() => { if (userProfile) handleEditProfile(userProfile as UserProfile); }}
              disabled={!userProfile}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Edit Your Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* No Data State */}
      {!elderData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>No Profile Data</Text>
          <Text style={styles.emptyText}>
            {currentUserRole === 'family' 
              ? 'No connected elder profile found. Please connect with an elder using the connection code.'
              : 'No profile data found. Please complete your profile setup.'
            }
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 80,
    paddingBottom: 40,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#d63384',
    marginBottom: 20,
  },
  profileInfo: {
    marginBottom: 16,
  },
  profileDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 16,
    marginTop: 8,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  profileDetail: {
    fontSize: 18,
    color: '#555',
    marginBottom: 8,
    lineHeight: 26,
  },
  infoSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#d63384',
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#d63384',
    paddingBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    width: 140,
    marginRight: 16,
  },
  infoValue: {
    fontSize: 20,
    color: '#555',
    flex: 1,
    lineHeight: 28,
  },
  medicationsSection: {
    marginTop: 16,
  },
  medicationsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 12,
  },
  medicationItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#d63384',
  },
  medicationName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  medicationDetailsContainer: {
    marginTop: 4,
  },
  medicationDetails: {
    fontSize: 20,
    color: '#666',
    marginBottom: 6,
    lineHeight: 26,
  },
  medicationLabel: {
    fontWeight: '600',
    color: '#333',
  },
  emergencyContactSection: {
    backgroundColor: '#fff5f5',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
    alignItems: 'center',
  },
  emergencyContactLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emergencyContactNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#dc3545',
    marginBottom: 14,
    textAlign: 'center',
  },
  emergencyContactNote: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 26,
  },
  readOnlyNotice: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    marginTop: 12,
  },
  readOnlyText: {
    fontSize: 18,
    color: '#1976d2',
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: '#d63384',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#d63384',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 20,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 28,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 18,
    fontSize: 20,
    color: '#333',
  },
  helperText: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    flexDirection: 'row',
  },
  smallButton: {
    padding: 12,
  },
  saveButton: {
    backgroundColor: '#28a745',
    flex: 1,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    flex: 1,
    marginRight: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
});