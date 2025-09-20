import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { default as React, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import DrawerLayout from '../components/DrawerLayout';
import { auth, db } from '../lib/firebaseConfig';

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [familyData, setFamilyData] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Wait until auth is ready
        if (authLoading) return;
        if (!auth.currentUser) {
          setLoading(false);
          return;
        }

        const uid = auth.currentUser.uid;
        const phoneNumber = auth.currentUser.phoneNumber || '';
        const usersRef = collection(db, 'users');

        // 1) Try by doc id (uid)
        let currentUserData: any | null = null;
        const byIdSnap = await getDoc(doc(usersRef, uid));
        if (byIdSnap.exists()) {
          currentUserData = byIdSnap.data();
        }

        // 2) Try by uid field
        if (!currentUserData) {
          const byUidSnap = await getDocs(query(usersRef, where('uid', '==', uid)));
          if (!byUidSnap.empty) currentUserData = byUidSnap.docs[0].data();
        }

        // 3) Try by phone variants
        if (!currentUserData && phoneNumber) {
          const exact = await getDocs(query(usersRef, where('phone', '==', phoneNumber)));
          if (!exact.empty) currentUserData = exact.docs[0].data();

          if (!currentUserData) {
            const digits = String(phoneNumber).replace(/\D/g, '');
            const last10 = digits.slice(-10);
            if (last10) {
              const byLast10 = await getDocs(query(usersRef, where('phone', '==', last10)));
              if (!byLast10.empty) currentUserData = byLast10.docs[0].data();

              if (!currentUserData && /^\d{10}$/.test(last10)) {
                const byNum = await getDocs(query(usersRef, where('phone', '==', Number(last10) as any)));
                if (!byNum.empty) currentUserData = byNum.docs[0].data();
              }
            }
          }
        }

        if (currentUserData) {
          setUserData(currentUserData);

          // If user is an elder, fetch connected family member's data and their meds/routines
          if (currentUserData.role === 'elder' && currentUserData.connectedTo) {
            const familyDocRef = doc(usersRef, currentUserData.connectedTo);
            const familyDoc = await getDoc(familyDocRef);
            if (familyDoc.exists()) setFamilyData(familyDoc.data());

            const medsRef = collection(db, 'medicines');
            const medsSnap = await getDocs(query(medsRef, where('uid', '==', currentUserData.connectedTo)));
            setMedications(medsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

            const routinesRef = collection(db, 'dailyRoutines');
            const routinesSnap = await getDocs(query(routinesRef, where('uid', '==', currentUserData.connectedTo)));
            setRoutines(routinesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
          }
        } else {
          // No user data found; show empty state gracefully
          setUserData(null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [authLoading, user?.uid]);

  // Format helper
  const formatTime = (t: any) => `${String(t?.hour ?? '').padStart(2, '0')}:${String(t?.minute ?? '').padStart(2, '0')} ${t?.period ?? ''}`;

  // Format phone number with country code
  const formatPhoneWithCountryCode = (phone: string) => {
    if (!phone) return '';
    // Add +91 (India) country code if not already present
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('91')) return `+${phone}`;
    return `+91 ${phone}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#d63384" />
      </View>
    );
  }

  return (
    <DrawerLayout>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile Info Card */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Profile Information</Text>
          <Text style={styles.cardContent}>
            • Name: {userData?.firstName} {userData?.lastName}
            {"\n"}• Age: {userData?.age}
            {"\n"}• Health Status: {userData?.healthStatus || 'Not specified'}
            {"\n"}• Medical Conditions: {userData?.illnesses || 'None specified'}
          </Text>
        </View>

        {/* Emergency Contact - Disabled Input */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>
          <Text style={styles.inputLabel}>Phone Number:</Text>
          <TextInput
            style={styles.disabledInput}
            value={formatPhoneWithCountryCode(userData?.emergencyContact || '')}
            editable={false}
            placeholder="No emergency contact available"
          />
          <Text style={styles.inputNote}>
            This is your emergency contact number. Contact admin to update.
          </Text>
        </View>

        {/* Family Member Info */}
        {familyData && (
          <View style={styles.cardWhite}>
            <Text style={styles.cardTitle}>Family Member Contact</Text>
            <Text style={styles.inputLabel}>Family Member's Phone Number:</Text>
            <TextInput
              style={styles.disabledInput}
              value={formatPhoneWithCountryCode(familyData?.phone || '')}
              editable={false}
              placeholder="No contact available"
            />
            <Text style={styles.inputNote}>
              This is your connected family member's phone number for emergencies.
            </Text>
            <Text style={[styles.cardContent, { marginTop: 10 }]}>
              • Name: {familyData?.firstName} {familyData?.lastName}
            </Text>
          </View>
        )}

        {/* Medicines Card (from family member account) */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Medications</Text>
          <Text style={styles.cardContent}>
            {medications && medications.length > 0
              ? medications
                  .map((m: any) => {
                    const timesArr = Array.isArray(m.times) ? m.times : [];
                    const timesStr = timesArr.map((t: any) => formatTime(t)).join(', ');
                    return `• ${m.name ?? ''} — ${m.dosage ?? ''}${timesStr ? ` — ${timesStr}` : ''}`;
                  })
                  .join('\n')
              : 'No medications scheduled'}
          </Text>
        </View>

        {/* Daily Routine Card (from family member account) */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Daily Routines</Text>
          <Text style={styles.cardContent}>
            {routines && routines.length > 0
              ? routines
                  .map((r: any) => {
                    const timesArr = Array.isArray(r.times) ? r.times : [];
                    const timesStr = timesArr.map((t: any) => formatTime(t)).join(', ');
                    return `• ${r.title ?? ''}${timesStr ? ` — ${timesStr}` : ''}`;
                  })
                  .join('\n')
              : 'No routines scheduled'}
          </Text>
        </View>
      </ScrollView>
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  topBar: {
    marginBottom: 20,
  },
  cardWhite: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 10,
  },
  cardContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { fontSize: 16, color: '#333', flex: 1 },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#666',
  },
  inputNote: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Drawer-related styles moved into DrawerLayout
});
