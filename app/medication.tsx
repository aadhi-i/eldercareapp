import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { addDoc, collection, deleteDoc, doc, DocumentData, getDocs, query, QueryDocumentSnapshot, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    LayoutAnimation,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../components/AuthProvider';
import DrawerLayout from '../components/DrawerLayout';
import { db } from '../lib/firebaseConfig';

interface MedicationTime {
  id: string;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
  times: MedicationTime[];
}

export default function MedicationScreen() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [currentMedication, setCurrentMedication] = useState<Partial<Medication>>({
    name: '',
    dosage: '',
    instructions: '',
    times: [],
  });
  const [timePickerDate, setTimePickerDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(9);
    d.setMinutes(0);
    return d;
  });

  // Time wheel/clock uses native DateTimePicker

  // Current authenticated user
  const { user } = useAuth();

  // Enable smooth removal animations on Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    let isMounted = true;
    // Fetch user's medicines from Firestore (root collection 'medicines' filtered by UID)
    const loadMedications = async () => {
      if (!user) {
        setMedications([]);
        return;
      }
      try {
        setIsLoading(true);
        const medicinesRef = collection(db, 'medicines');
        const q = query(medicinesRef, where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        const items: Medication[] = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data() as any;
          const times: MedicationTime[] = Array.isArray(data?.times)
            ? data.times.map((t: any, idx: number) => ({
                id: t?.id ?? `${d.id}-t${idx}`,
                hour: Number(t?.hour ?? 0),
                minute: Number(t?.minute ?? 0),
                period: (t?.period === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM',
              }))
            : [];
          return {
            id: d.id,
            name: String(data?.name ?? ''),
            dosage: String(data?.dosage ?? ''),
            instructions: String(data?.instructions ?? ''),
            times,
          } as Medication;
        });
        if (isMounted) setMedications(items);
      } catch (e) {
        console.error('Failed to load medications', e);
        if (isMounted) setMedications([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadMedications();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Helper to add time from a Date object
  const addTimeFromDate = (date: Date) => {
    const hours24 = date.getHours();
    const minutes = date.getMinutes();
    const period: 'AM' | 'PM' = hours24 >= 12 ? 'PM' : 'AM';
    const hour12 = ((hours24 + 11) % 12) + 1;
    const newTime: MedicationTime = {
      id: Date.now().toString(),
      hour: hour12,
      minute: minutes,
      period,
    };
    setCurrentMedication(prev => ({
      ...prev,
      times: [...(prev.times || []), newTime],
    }));
    setShowTimeModal(false);
  };

  // Add a time entry using the currently selected date (for iOS Add Time button)
  const addTime = () => addTimeFromDate(timePickerDate);

  const removeTime = (timeId: string) => {
    setCurrentMedication(prev => ({
      ...prev,
      times: (prev.times || []).filter(time => time.id !== timeId),
    }));
  };

  // Persist a new medicine document in Firestore and optimistically update UI
  const saveMedication = async () => {
    if (!currentMedication.name || !currentMedication.dosage || !currentMedication.times?.length) {
      Alert.alert('Error', 'Please fill in all required fields and add at least one time.');
      return;
    }
    if (!user) {
      Alert.alert('Not signed in', 'Please log in to save medications.');
      return;
    }

    try {
      const payload = {
        uid: user.uid,
        name: currentMedication.name,
        dosage: currentMedication.dosage,
        instructions: currentMedication.instructions ?? '',
        // Store times as array of objects; keep ids for client-side list rendering
        times: (currentMedication.times || []).map(t => ({ id: t.id, hour: t.hour, minute: t.minute, period: t.period })),
        createdAt: Date.now(),
      };
      const ref = await addDoc(collection(db, 'medicines'), payload);

      // Optimistically add to local list with Firestore-generated id
      const newMedication: Medication = {
        id: ref.id,
        name: payload.name!,
        dosage: payload.dosage!,
        instructions: payload.instructions!,
        times: payload.times as MedicationTime[],
      };
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMedications(prev => [...prev, newMedication]);

      // Reset form
      setCurrentMedication({ name: '', dosage: '', instructions: '', times: [] });
      setShowAddModal(false);
    } catch (e) {
      console.error('Failed to save medication', e);
      Alert.alert('Error', 'Failed to save medication. Please try again.');
    }
  };

  const handleSwipeDelete = async (medicationId: string) => {
    // Optimistic update with smooth layout animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMedications(prev => prev.filter(med => med.id !== medicationId));
    try {
      if (user) {
        // Delete from root 'medicines' collection
        await deleteDoc(doc(db, 'medicines', medicationId));
      }
    } catch (e) {
      console.error('Failed to delete medication', e);
    }
  };

  const formatTime = (time: MedicationTime) => {
    const hour = time.hour.toString().padStart(2, '0');
    const minute = time.minute.toString().padStart(2, '0');
    return `${hour}:${minute} ${time.period}`;
  };

  const renderTimeItem = ({ item }: { item: MedicationTime }) => (
    <View style={styles.timeItem}>
      <Text style={styles.timeText}>{formatTime(item)}</Text>
      <TouchableOpacity
        onPress={() => removeTime(item.id)}
        style={styles.removeTimeButton}
      >
        <Text style={styles.removeTimeText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  // Left swipe action with red background and trash icon
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<string | number>,
    dragX: Animated.AnimatedInterpolation<string | number>
  ) => {
    const translateX = dragX.interpolate({ inputRange: [0, 100], outputRange: [-20, 0] });
    return (
      <View style={styles.leftAction}>
        <Animated.View style={{ transform: [{ translateX }] }}>
          <Ionicons name="trash" size={24} color="#fff" />
        </Animated.View>
      </View>
    );
  };

  return (
    <DrawerLayout>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.container, medications.length === 0 && styles.containerEmpty]}>        
        <View style={styles.header}>
          <Text style={styles.title}>Medication Management</Text>
          <TouchableOpacity
            style={styles.addIconButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle" size={32} color="#d63384" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.emptyWrapper}>
            <View style={styles.emptyCard}><Text style={styles.emptyCardText}>Loading...</Text></View>
          </View>
        ) : medications.length === 0 ? (
          <View style={styles.emptyWrapper}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No medications added yet...</Text>
            </View>
          </View>
        ) : (
          <View style={styles.medicationsList}>
            {medications.map(medication => (
              <Swipeable
                key={medication.id}
                renderLeftActions={renderLeftActions}
                onSwipeableOpen={() => handleSwipeDelete(medication.id)}
                overshootLeft={false}
                friction={2}
              >
                <View style={styles.medicationCard}>
                  <View style={styles.medicationHeader}>
                    <Text style={styles.medicationName}>{medication.name}</Text>
                  </View>
                  <Text style={styles.medicationDosage}>Dosage: {medication.dosage}</Text>
                  {medication.instructions && (
                    <Text style={styles.medicationInstructions}>
                      Instructions: {medication.instructions}
                    </Text>
                  )}
                  <View style={styles.timesContainer}>
                    <Text style={styles.timesLabel}>Timings:</Text>
                    {medication.times.map(time => (
                      <Text key={time.id} style={styles.timeDisplay}>
                        • {formatTime(time)}
                      </Text>
                    ))}
                  </View>
                </View>
              </Swipeable>
            ))}
          </View>
        )}

        {/* Add Medication Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add New Medication</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Medication Name"
                value={currentMedication.name}
                onChangeText={(text) => setCurrentMedication(prev => ({ ...prev, name: text }))}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Dosage (e.g., 1 tablet, 10ml)"
                value={currentMedication.dosage}
                onChangeText={(text) => setCurrentMedication(prev => ({ ...prev, dosage: text }))}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Instructions (optional)"
                value={currentMedication.instructions}
                onChangeText={(text) => setCurrentMedication(prev => ({ ...prev, instructions: text }))}
                multiline
              />

              <View style={styles.timesSection}>
                <Text style={styles.timesSectionTitle}>Medication Times</Text>
                {currentMedication.times && currentMedication.times.length > 0 && (
                  <FlatList
                    data={currentMedication.times}
                    renderItem={renderTimeItem}
                    keyExtractor={(item) => item.id}
                    style={styles.timesList}
                  />
                )}
                <TouchableOpacity style={styles.addTimeButton} onPress={() => setShowTimeModal(true)}>
                  <Text style={styles.addTimeButtonText}>+ Add Time (Clock)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowAddModal(false);
                    setCurrentMedication({ name: '', dosage: '', instructions: '', times: [] });
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveMedication}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Time Picker Modal */}
        <Modal
          visible={showTimeModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowTimeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowTimeModal(false)}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Time</Text>
              <View style={styles.clockPickerWrapper}>
                <DateTimePicker
                  value={timePickerDate}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    if (event.type === 'dismissed') return;
                    if (date) {
                      setTimePickerDate(date);
                      // On Android, pressing OK should add and close immediately
                      if (Platform.OS === 'android') addTimeFromDate(date);
                    }
                  }}
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowTimeModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={addTime}
                >
                  <Text style={styles.saveButtonText}>Add Time</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        </ScrollView>
      </GestureHandlerRootView>
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 80,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  containerEmpty: {
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#d63384',
  },
  addIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(214, 51, 132, 0.1)',
  },
  emptyWrapper: {
    alignItems: 'center',
  },
  emptyCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 192, 203, 0.15)',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 192, 203, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  medicationsList: {
    gap: 16,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  medicationDosage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  medicationInstructions: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  timesContainer: {
    marginTop: 8,
  },
  timesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  timeDisplay: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  leftAction: {
    justifyContent: 'center',
    backgroundColor: '#ff4d4f',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  timesSection: {
    marginBottom: 20,
  },
  timesSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  timesList: {
    maxHeight: 120,
    marginBottom: 12,
  },
  timeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#333',
  },
  removeTimeButton: {
    backgroundColor: '#ff4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addTimeButton: {
    backgroundColor: '#28a745',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addTimeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  pickerColumn: {
    alignItems: 'center',
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  picker: {
    width: 80,
    height: 120,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#d63384',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalClose: { position: 'absolute', right: 12, top: 12, zIndex: 1 },
  clockPickerWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
}); 

// Mock helpers removed; Firestore is the source of truth now
