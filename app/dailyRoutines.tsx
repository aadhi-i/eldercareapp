import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { addDoc, collection, deleteDoc, doc, DocumentData, getDocs, query, QueryDocumentSnapshot, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, LayoutAnimation, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../components/AuthProvider';
import DrawerLayout from '../components/DrawerLayout';
import { db } from '../lib/firebaseConfig';

type RoutineTime = {
  id: string;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
};

type Routine = {
  id: string;
  title: string;
  notes?: string;
  times: RoutineTime[];
};

export default function DailyRoutinesScreen() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [current, setCurrent] = useState<Partial<Routine>>({ title: '', notes: '', times: [] });
  const [timeDate, setTimeDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(9); d.setMinutes(0);
    return d;
  });
  const [showClock, setShowClock] = useState<boolean>(false);

  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!user) { setRoutines([]); return; }
      try {
        setIsLoading(true);
        const ref = collection(db, 'dailyRoutines');
        const qRef = query(ref, where('uid', '==', user.uid));
        const snap = await getDocs(qRef);
        const items: Routine[] = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data() as any;
          const times: RoutineTime[] = Array.isArray(data?.times) ? data.times.map((t: any, idx: number) => ({
            id: t?.id ?? `${d.id}-t${idx}`,
            hour: Number(t?.hour ?? 0),
            minute: Number(t?.minute ?? 0),
            period: (t?.period === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM',
          })) : [];
          return { id: d.id, title: String(data?.title ?? ''), notes: String(data?.notes ?? ''), times };
        });
        if (alive) setRoutines(items);
      } catch (e) {
        console.error('Failed to load routines', e);
        if (alive) setRoutines([]);
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [user]);

  const formatTime = (t: RoutineTime) => `${String(t.hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')} ${t.period}`;

  const addTimeFromDate = (d: Date) => {
    const h24 = d.getHours();
    const mins = d.getMinutes();
    const period: 'AM'|'PM' = h24 >= 12 ? 'PM' : 'AM';
    const h12 = ((h24 + 11) % 12) + 1;
    const newTime: RoutineTime = { id: Date.now().toString(), hour: h12, minute: mins, period };
    setCurrent(prev => ({ ...prev, times: [ ...(prev.times || []), newTime ] }));
    setShowClock(false);
  };

  const addTime = () => addTimeFromDate(timeDate);

  const saveRoutine = async () => {
    if (!current.title || !(current.times && current.times.length)) {
      Alert.alert('Missing info', 'Please enter a title and add at least one time.');
      return;
    }
    if (!user) { Alert.alert('Not signed in', 'Please log in to save routines.'); return; }
    try {
      const payload = {
        uid: user.uid,
        title: current.title,
        notes: current.notes ?? '',
        times: (current.times || []).map(t => ({ id: t.id, hour: t.hour, minute: t.minute, period: t.period })),
        createdAt: Date.now(),
      };
      const ref = await addDoc(collection(db, 'dailyRoutines'), payload);
      const newRoutine: Routine = { id: ref.id, title: payload.title!, notes: payload.notes!, times: payload.times as RoutineTime[] };
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRoutines(prev => [...prev, newRoutine]);
      setShowAdd(false);
      setCurrent({ title: '', notes: '', times: [] });
    } catch (e) {
      console.error('Failed to save routine', e);
      Alert.alert('Error', 'Failed to save routine');
    }
  };

  const deleteRoutine = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRoutines(prev => prev.filter(r => r.id !== id));
    try { await deleteDoc(doc(db, 'dailyRoutines', id)); } catch (e) { console.error('Delete failed', e); }
  };

  const renderLeftActions = () => (
    <View style={styles.leftAction}> 
      <Ionicons name="trash" size={24} color="#fff" />
    </View>
  );

  return (
    <DrawerLayout>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.container, routines.length === 0 && styles.containerEmpty]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Daily Routines</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAdd(true)}>
              <Text style={styles.addButtonText}>+ Add Routine</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.emptyWrapper}><View style={styles.emptyCard}><Text style={styles.emptyText}>Loading...</Text></View></View>
          ) : routines.length === 0 ? (
            <View style={styles.emptyWrapper}><View style={styles.emptyCard}><Text style={styles.emptyText}>No routines added yet...</Text></View></View>
          ) : (
            <View style={{ gap: 16 }}>
              {routines.map(r => (
                <Swipeable key={r.id} renderLeftActions={renderLeftActions} onSwipeableOpen={() => deleteRoutine(r.id)} overshootLeft={false} friction={2}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{r.title}</Text>
                    {r.notes ? <Text style={styles.cardNotes}>{r.notes}</Text> : null}
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.timesLabel}>Times:</Text>
                      {r.times.map(t => (
                        <Text key={t.id} style={styles.timeItem}>• {formatTime(t)}</Text>
                      ))}
                    </View>
                  </View>
                </Swipeable>
              ))}
            </View>
          )}

          {/* Add Routine Modal */}
          <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity style={styles.modalClose} onPress={() => setShowAdd(false)}>
                  <Ionicons name="close" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Add Routine</Text>
                <TextInput style={styles.input} placeholder="Title" value={current.title} onChangeText={(t) => setCurrent(p => ({ ...p, title: t }))} />
                <TextInput style={styles.input} placeholder="Notes (optional)" value={current.notes} onChangeText={(t) => setCurrent(p => ({ ...p, notes: t }))} />

                <Text style={styles.timesHeading}>Times</Text>
                {current.times && current.times.length > 0 && (
                  <FlatList data={current.times} keyExtractor={(i) => i.id} style={styles.timesList}
                    renderItem={({ item }) => (
                      <View style={styles.timeRow}><Text style={styles.timeText}>{formatTime(item)}</Text></View>
                    )}
                  />
                )}
                {showClock && (
                  <View style={styles.clockPickerWrapper}>
                    <DateTimePicker
                      value={timeDate}
                      mode="time"
                      is24Hour={false}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e: DateTimePickerEvent, d?: Date) => {
                        if (e.type === 'dismissed') { setShowClock(false); return; }
                        if (d) {
                          setTimeDate(d);
                          if (Platform.OS === 'android') addTimeFromDate(d);
                        }
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                        <TouchableOpacity style={[styles.modalButton, styles.secondary]} onPress={() => setShowClock(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.primary]} onPress={() => addTimeFromDate(timeDate)}><Text style={styles.modalButtonText}>Add</Text></TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity style={[styles.modalButton, styles.secondary]} onPress={() => setShowClock(true)}><Text style={styles.modalButtonText}>Add Time</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.primary]} onPress={saveRoutine}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
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
  container: { padding: 20, paddingTop: 80, backgroundColor: '#fff', flexGrow: 1 },
  containerEmpty: { justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#d63384' },
  addButton: { backgroundColor: '#d63384', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 6 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  emptyWrapper: { alignItems: 'center' },
  emptyCard: { width: '100%', backgroundColor: 'rgba(255, 192, 203, 0.15)', borderRadius: 16, padding: 28, borderWidth: 1, borderColor: 'rgba(255, 192, 203, 0.3)', alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  cardNotes: { fontSize: 14, color: '#888', marginTop: 4 },
  timesLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  timeItem: { fontSize: 14, color: '#666', marginLeft: 8 },
  leftAction: { justifyContent: 'center', backgroundColor: '#ff4d4f', borderRadius: 16, marginBottom: 16, paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' },
  modalClose: { position: 'absolute', right: 12, top: 12, zIndex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  timesHeading: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  timesList: { maxHeight: 120, marginBottom: 12 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8f9fa', padding: 8, borderRadius: 8, marginBottom: 8 },
  timeText: { fontSize: 14, color: '#333' },
  clockPickerWrapper: { alignItems: 'center', marginBottom: 16 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  secondary: { backgroundColor: '#6c757d' },
  primary: { backgroundColor: '#d63384' },
  modalButtonText: { color: '#fff', fontWeight: '600' },
});


