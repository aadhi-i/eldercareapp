import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';

interface Medicine {
  name: string;
  timings: string[];
  dosage: string;
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
      
      if (!userDoc.exists()) {
        // Try to find user by phone number
        const q = query(usersRef, where('phone', '==', currentUser.phoneNumber));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          Alert.alert('Error', 'User profile not found');
          setLoading(false);
          return;
        }
        
        const userData = querySnapshot.docs[0].data() as UserProfile;
        setUserProfile(userData);
        
        // If this is a family member, fetch connected elderly profiles
        if (userData.role === 'family') {
          await fetchConnectedElderlyProfiles(userData.uid);
        }
      } else {
        const userData = userDoc.data() as UserProfile;
        setUserProfile(userData);
        
        // If this is a family member, fetch connected elderly profiles
        if (userData.role === 'family') {
          await fetchConnectedElderlyProfiles(userData.uid);
        }
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
        const profiles = querySnapshot.docs.map(doc => doc.data() as UserProfile);
        setElderlyProfiles(profiles);
      }
    } catch (error) {
      console.error('Error fetching connected profiles:', error);
      Alert.alert('Error', 'Failed to load connected profiles');
    }
  };

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
      {userProfile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Profile</Text>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userProfile.firstName} {userProfile.lastName}</Text>
            <Text style={styles.profileDetail}>Role: {userProfile.role === 'family' ? 'Family Member' : userProfile.role === 'elder' ? 'Elder' : 'Caregiver'}</Text>
            {userProfile.phone && <Text style={styles.profileDetail}>Phone: {userProfile.phone}</Text>}
            {userProfile.age && <Text style={styles.profileDetail}>Age: {userProfile.age}</Text>}
            {userProfile.address && <Text style={styles.profileDetail}>Address: {userProfile.address}</Text>}
            {userProfile.emergencyContact && <Text style={styles.profileDetail}>Emergency Contact: {userProfile.emergencyContact}</Text>}
            {userProfile.role === 'elder' && (
              <>
                {userProfile.healthStatus && <Text style={styles.profileDetail}>Health Status: {userProfile.healthStatus}</Text>}
                {userProfile.illnesses && <Text style={styles.profileDetail}>Illnesses: {userProfile.illnesses}</Text>}
              </>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.button, styles.editButton]} 
            onPress={() => handleEditProfile(userProfile)}
          >
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {userProfile?.role === 'family' && elderlyProfiles.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Elderly Profiles</Text>
          {elderlyProfiles.map((profile, index) => (
            <View key={profile.uid} style={[styles.profileInfo, index > 0 && styles.profileDivider]}>
              <Text style={styles.profileName}>{profile.firstName} {profile.lastName}</Text>
              <Text style={styles.profileDetail}>Role: {profile.role === 'elder' ? 'Elder' : 'Caregiver'}</Text>
              {profile.phone && <Text style={styles.profileDetail}>Phone: {profile.phone}</Text>}
              {profile.age && <Text style={styles.profileDetail}>Age: {profile.age}</Text>}
              {profile.address && <Text style={styles.profileDetail}>Address: {profile.address}</Text>}
              {profile.emergencyContact && <Text style={styles.profileDetail}>Emergency Contact: {profile.emergencyContact}</Text>}
              {profile.healthStatus && <Text style={styles.profileDetail}>Health Status: {profile.healthStatus}</Text>}
              {profile.illnesses && <Text style={styles.profileDetail}>Illnesses: {profile.illnesses}</Text>}
              
              <TouchableOpacity 
                style={[styles.button, styles.editButton, styles.smallButton]} 
                onPress={() => handleEditProfile(profile)}
              >
                <Text style={styles.buttonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      
      {userProfile?.role === 'family' && elderlyProfiles.length === 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Elderly Profiles</Text>
          <Text style={styles.emptyText}>No connected elderly profiles found.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: 'rgba(255, 192, 203, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 192, 203, 0.3)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#d63384',
    marginBottom: 16,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  profileDetail: {
    fontSize: 16,
    color: '#555',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  smallButton: {
    padding: 10,
  },
  editButton: {
    backgroundColor: '#d63384',
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
    fontSize: 16,
    fontWeight: '600',
  },
});