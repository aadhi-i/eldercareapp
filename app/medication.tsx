import { Picker } from '@react-native-picker/picker';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DrawerLayout from '../components/DrawerLayout';

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [currentMedication, setCurrentMedication] = useState<Partial<Medication>>({
    name: '',
    dosage: '',
    instructions: '',
    times: [],
  });
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const addTime = () => {
    const newTime: MedicationTime = {
      id: Date.now().toString(),
      hour: selectedHour,
      minute: selectedMinute,
      period: selectedPeriod,
    };

    setCurrentMedication(prev => ({
      ...prev,
      times: [...(prev.times || []), newTime],
    }));
    setShowTimeModal(false);
  };

  const removeTime = (timeId: string) => {
    setCurrentMedication(prev => ({
      ...prev,
      times: (prev.times || []).filter(time => time.id !== timeId),
    }));
  };

  const saveMedication = () => {
    if (!currentMedication.name || !currentMedication.dosage || !currentMedication.times?.length) {
      Alert.alert('Error', 'Please fill in all required fields and add at least one time.');
      return;
    }

    const newMedication: Medication = {
      id: Date.now().toString(),
      name: currentMedication.name!,
      dosage: currentMedication.dosage!,
      instructions: currentMedication.instructions || '',
      times: currentMedication.times!,
    };

    setMedications(prev => [...prev, newMedication]);
    setCurrentMedication({ name: '', dosage: '', instructions: '', times: [] });
    setShowAddModal(false);
  };

  const deleteMedication = (medicationId: string) => {
    Alert.alert(
      'Delete Medication',
      'Are you sure you want to delete this medication?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMedications(prev => prev.filter(med => med.id !== medicationId));
          },
        },
      ]
    );
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

  return (
    <DrawerLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Medication Management</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.addButtonText}>+ Add Medication</Text>
          </TouchableOpacity>
        </View>

        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No medications added yet. Tap the button above to add your first medication.
            </Text>
          </View>
        ) : (
          <View style={styles.medicationsList}>
            {medications.map(medication => (
              <View key={medication.id} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{medication.name}</Text>
                  <TouchableOpacity
                    onPress={() => deleteMedication(medication.id)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>×</Text>
                  </TouchableOpacity>
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
                <TouchableOpacity
                  style={styles.addTimeButton}
                  onPress={() => setShowTimeModal(true)}
                >
                  <Text style={styles.addTimeButtonText}>+ Add Time</Text>
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
              <Text style={styles.modalTitle}>Select Time</Text>
              
              <View style={styles.timePickerContainer}>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>Hour</Text>
                  <Picker
                    selectedValue={selectedHour}
                    onValueChange={setSelectedHour}
                    style={styles.picker}
                  >
                    {hours.map(hour => (
                      <Picker.Item key={hour} label={hour.toString()} value={hour} />
                    ))}
                  </Picker>
                </View>
                
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>Minute</Text>
                  <Picker
                    selectedValue={selectedMinute}
                    onValueChange={setSelectedMinute}
                    style={styles.picker}
                  >
                    {minutes.map(minute => (
                      <Picker.Item key={minute} label={minute.toString().padStart(2, '0')} value={minute} />
                    ))}
                  </Picker>
                </View>
                
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>Period</Text>
                  <Picker
                    selectedValue={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                    style={styles.picker}
                  >
                    <Picker.Item label="AM" value="AM" />
                    <Picker.Item label="PM" value="PM" />
                  </Picker>
                </View>
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
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
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
  addButton: {
    backgroundColor: '#d63384',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: 'rgba(255, 192, 203, 0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 192, 203, 0.3)',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
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
  deleteButton: {
    backgroundColor: '#ff4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
}); 
