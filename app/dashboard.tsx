import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { default as React, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import DrawerLayout from '../components/DrawerLayout';
import { auth, db } from '../lib/firebaseConfig';
import { reminderService } from '../services/reminderService';

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [elderData, setElderData] = useState<any>(null);
  const [familyData, setFamilyData] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [upcomingMedications, setUpcomingMedications] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  useEffect(() => {
    const fetchSharedData = async () => {
      try {
        // Wait until auth is ready
        if (authLoading) return;
        
        // Initialize reminder service
        await reminderService.initialize();
        
        const usersRef = collection(db, 'users');
        let currentUserData: any | null = null;
        let elderProfileData: any = null;

        // If user is authenticated, try to find their data
        if (auth.currentUser) {
          const uid = auth.currentUser.uid;
          const phoneNumber = auth.currentUser.phoneNumber || '';

          // 1) Try by doc id (uid)
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
        }

        // If no authenticated user or no data found, try to find the most recent elder data
        if (!currentUserData) {
          const elderQuery = query(usersRef, where('role', '==', 'elder'));
          const elderSnapshot = await getDocs(elderQuery);
          
          if (!elderSnapshot.empty) {
            const elders = elderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sortedElders = elders.sort((a, b) => {
              const aTime = a.createdAt?.toDate?.() || new Date(0);
              const bTime = b.createdAt?.toDate?.() || new Date(0);
              return bTime.getTime() - aTime.getTime();
            });
            
            currentUserData = sortedElders[0];
          }
        }

        if (currentUserData) {
          console.log('Dashboard: Found user data:', currentUserData.role, currentUserData.firstName);
          setCurrentUserRole(currentUserData.role);
          
          // Determine elder profile data based on user role
          if (currentUserData.role === 'elder') {
            // If current user is elder, use their data
            elderProfileData = currentUserData;
            setElderData(currentUserData);
            
            // Fetch connected family member data
            if (currentUserData.connectedTo) {
              const familyDocRef = doc(usersRef, currentUserData.connectedTo);
              const familyDoc = await getDoc(familyDocRef);
              if (familyDoc.exists()) setFamilyData(familyDoc.data());
            }
          } else if (currentUserData.role === 'family') {
            // If current user is family member, find connected elder
            setFamilyData(currentUserData);
            
            if (currentUserData.connectedElders && currentUserData.connectedElders.length > 0) {
              // Get the first connected elder (can be extended for multiple elders)
              const elderDocRef = doc(usersRef, currentUserData.connectedElders[0]);
              const elderDoc = await getDoc(elderDocRef);
              if (elderDoc.exists()) {
                elderProfileData = elderDoc.data();
                setElderData(elderProfileData);
              }
            } else {
              // Try to find elder by connection code
              const elderQuery = query(usersRef, where('connectedTo', '==', currentUserData.uid));
              const elderSnapshot = await getDocs(elderQuery);
              if (!elderSnapshot.empty) {
                elderProfileData = elderSnapshot.docs[0].data();
                setElderData(elderProfileData);
              }
            }
          }

          // Fetch shared data (medications, routines) for the elder profile
          if (elderProfileData) {
            await fetchSharedMedicationsAndRoutines(elderProfileData);
            await fetchUpcomingMedications(elderProfileData);
            await fetchLowStockAlerts(elderProfileData);
            
            // Schedule reminders for the elder profile
            if (currentUserData.role === 'elder') {
              await reminderService.scheduleAllReminders(currentUserData.uid);
            } else if (currentUserData.role === 'family') {
              await reminderService.scheduleElderReminders(currentUserData.uid);
            }
          }
        } else {
          // No user data found; show empty state gracefully
          setElderData(null);
        }
      } catch (error) {
        console.error('Error fetching shared data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedData();
  }, [authLoading, user?.uid]);

  const fetchSharedMedicationsAndRoutines = async (elderData: any) => {
    try {
      // Fetch medications from elder's personal medicines
      if (elderData.medicines && elderData.medicines.length > 0) {
        setMedications(elderData.medicines);
      }

      // Fetch routines from family member's account
      if (elderData.connectedTo) {
        const routinesRef = collection(db, 'dailyRoutines');
        const routinesSnap = await getDocs(query(routinesRef, where('uid', '==', elderData.connectedTo)));
        setRoutines(routinesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      }
    } catch (error) {
      console.error('Error fetching medications and routines:', error);
    }
  };

  const fetchUpcomingMedications = async (elderData: any) => {
    try {
      const today = new Date();
      const upcomingMeds: any[] = [];

      // Check elder's personal medicines
      if (elderData.medicines && elderData.medicines.length > 0) {
        elderData.medicines.forEach((med: any) => {
          if (med.timings && Array.isArray(med.timings)) {
            med.timings.forEach((time: string) => {
              const [timeStr, period] = time.split(' ');
              const [hours, minutes] = timeStr.split(':');
              let hour24 = parseInt(hours);
              
              if (period === 'PM' && hour24 !== 12) hour24 += 12;
              if (period === 'AM' && hour24 === 12) hour24 = 0;
              
              const medTime = new Date();
              medTime.setHours(hour24, parseInt(minutes), 0, 0);
              
              if (medTime > today) {
                upcomingMeds.push({
                  name: med.name,
                  dosage: med.dosage,
                  time: time,
                  timeObj: medTime,
                  type: 'personal'
                });
              }
            });
          }
        });
      }

      // Sort by time
      upcomingMeds.sort((a, b) => a.timeObj.getTime() - b.timeObj.getTime());
      setUpcomingMedications(upcomingMeds.slice(0, 5)); // Show next 5 medications
    } catch (error) {
      console.error('Error fetching upcoming medications:', error);
    }
  };

  const fetchLowStockAlerts = async (elderData: any) => {
    try {
      const alerts: any[] = [];
      
      // Check elder's personal medicines for low stock
      if (elderData.medicines && elderData.medicines.length > 0) {
        elderData.medicines.forEach((med: any) => {
          if (med.stock && med.stock <= 7) { // Alert if stock is 7 days or less
            alerts.push({
              name: med.name,
              stock: med.stock,
              type: 'personal'
            });
          }
        });
      }

      setLowStockAlerts(alerts);
    } catch (error) {
      console.error('Error fetching low stock alerts:', error);
    }
  };

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
        {/* Welcome Header */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>
            Welcome, {currentUserRole === 'family' ? familyData?.firstName : elderData?.firstName}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {currentUserRole === 'family' ? 'Managing care for' : 'Your health dashboard'}
            {elderData && ` ${elderData.firstName} ${elderData.lastName}`}
          </Text>
        </View>

        {/* 1. Upcoming Medications - Max 3 items */}
        <View style={[styles.cardWhite, styles.priorityCard]}>
          <Text style={styles.cardTitle}>⏰ Upcoming Medications</Text>
          {upcomingMedications.length > 0 ? (
            upcomingMedications.slice(0, 3).map((med, index) => (
              <View key={index} style={styles.medicationItem}>
                <Text style={styles.medicationName}>{med.name}</Text>
                <Text style={styles.medicationDetails}>
                  {med.dosage} • {med.time}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyStateText}>No upcoming medications today</Text>
          )}
        </View>

        {/* 2. Upcoming Routines - Max 3 items */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>📅 Upcoming Routines</Text>
          {routines.length > 0 ? (
            routines.slice(0, 3).map((routine, index) => (
              <View key={index} style={styles.routineItem}>
                <Text style={styles.routineTitle}>{routine.title}</Text>
                {routine.times && routine.times.length > 0 && (
                  <Text style={styles.routineTime}>
                    {routine.times.map((t: any) => formatTime(t)).join(', ')}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyStateText}>No routines scheduled today</Text>
          )}
        </View>

        {/* 3. Medication Stock Updates - Top 3 low-stock medicines */}
        <View style={[styles.cardWhite, styles.alertCard]}>
          <Text style={styles.cardTitle}>⚠️ Medication Stock Updates</Text>
          {lowStockAlerts.length > 0 ? (
            lowStockAlerts.slice(0, 3).map((alert, index) => (
              <View key={index} style={styles.alertItem}>
                <Text style={styles.alertText}>
                  {alert.name} - Only {alert.stock} days left
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyStateText}>All medications are well stocked</Text>
          )}
        </View>


        {/* No Data State */}
        {!elderData && (
          <View style={styles.cardWhite}>
            <Text style={styles.cardTitle}>No Data Available</Text>
            <Text style={styles.cardContent}>
              {currentUserRole === 'family' 
                ? 'No connected elder profile found. Please connect with an elder using the connection code.'
                : 'No profile data found. Please complete your profile setup.'
              }
            </Text>
          </View>
        )}
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
    paddingTop: 80,
    backgroundColor: '#f8f9fa',
  },
  welcomeCard: {
    backgroundColor: '#d63384',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  cardWhite: {
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
  priorityCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    backgroundColor: '#f8fff9',
  },
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#d63384',
    marginBottom: 16,
  },
  cardContent: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  medicationDetails: {
    fontSize: 16,
    color: '#666',
  },
  alertItem: {
    backgroundColor: '#fff5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  alertText: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: '600',
  },
  routineItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
  },
  routineTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  routineTime: {
    fontSize: 16,
    color: '#666',
  },
  emptyStateText: {
    fontSize: 18,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  editButton: {
    backgroundColor: '#d63384',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { fontSize: 18, color: '#333', flex: 1 },
  inputLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#666',
  },
  inputNote: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
