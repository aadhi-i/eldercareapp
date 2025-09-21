import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { addDoc, collection, deleteDoc, doc, DocumentData, getDoc, getDocs, onSnapshot, query, QueryDocumentSnapshot, serverTimestamp, updateDoc, where } from 'firebase/firestore';
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
  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(null);
  const [isResolvingOwner, setIsResolvingOwner] = useState<boolean>(false);
  const [managingFor, setManagingFor] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<'elder' | 'family' | null>(null);
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

  // Resolve data owner uid based on role
  useEffect(() => {
    const resolveOwner = async () => {
      setIsResolvingOwner(true);
      setDataOwnerUid(null);
      if (!user) { setIsResolvingOwner(false); return; }
      try {
        const uref = doc(collection(db, 'users'), user.uid);
        const udoc = await getDoc(uref);
        if (!udoc.exists()) { setDataOwnerUid(user.uid); return; }
        const u = udoc.data() as any;
  const role = (u?.role || 'elder') as 'elder' | 'family';
  setCurrentRole(role);
  if (role === 'elder') { setDataOwnerUid(user.uid); setManagingFor(null); return; }
        const connectedElders: string[] = Array.isArray(u?.connectedElders) ? u.connectedElders : [];
        if (connectedElders.length > 0) {
          const owner = connectedElders[0];
          setDataOwnerUid(owner);
          try {
            const oDoc = await getDoc(doc(collection(db, 'users'), owner));
            if (oDoc.exists()) {
              const od = oDoc.data() as any;
              const name = `${od?.firstName || ''} ${od?.lastName || ''}`.trim() || od?.phone || owner;
              setManagingFor(name);
            }
          } catch {}
          return;
        }
        const esnap = await getDocs(query(collection(db, 'users'), where('connectedTo', '==', user.uid)));
        if (!esnap.empty) {
          const owner = esnap.docs[0].id;
          setDataOwnerUid(owner);
          try {
            const od = esnap.docs[0].data() as any;
            const name = `${od?.firstName || ''} ${od?.lastName || ''}`.trim() || od?.phone || owner;
            setManagingFor(name);
          } catch {}
          return;
        }
        setDataOwnerUid(user.uid);
        setManagingFor(null);
        setCurrentRole(role);
      } catch (e) {
        console.error('Failed to resolve routines owner', e);
  setDataOwnerUid(user?.uid ?? null);
  setManagingFor(null);
  setCurrentRole(null);
      } finally {
        setIsResolvingOwner(false);
      }
    };
    resolveOwner();
  }, [user]);

  // Subscribe to routines for owner uid
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setIsLoading(true);
    setRoutines([]);
    if (!dataOwnerUid) { setIsLoading(false); return; }
    try {
      const uids = currentRole === 'family' && user?.uid && user.uid !== dataOwnerUid ? [dataOwnerUid, user.uid] : [dataOwnerUid];
      const ref = uids.length > 1
        ? query(collection(db, 'dailyRoutines'), where('uid', 'in', uids as string[]))
        : query(collection(db, 'dailyRoutines'), where('uid', '==', uids[0]!));
      unsubscribe = onSnapshot(
        ref,
        (snap) => {
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
          if (items.length === 0) {
            attemptMigrateLegacyRoutines(dataOwnerUid).finally(() => {
              setRoutines(items);
              setIsLoading(false);
            });
          } else {
            setRoutines(items);
            setIsLoading(false);
          }
        },
        (error) => {
          console.error('Failed to subscribe routines', error);
          setRoutines([]);
          setIsLoading(false);
        }
      );
    } catch (e) {
      console.error('Failed to init routines listener', e);
      setIsLoading(false);
    }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [dataOwnerUid, user, currentRole]);

  const parseLegacyTimeString = (s: string): RoutineTime | null => {
    try {
      const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return null;
      const h12 = Math.min(12, Math.max(1, parseInt(m[1], 10)));
      const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
      const period = m[3].toUpperCase() === 'PM' ? 'PM' : 'AM';
      return { id: `${Date.now()}-${h12}-${minute}-${period}`, hour: h12, minute, period };
    } catch { return null; }
  };

  const attemptMigrateLegacyRoutines = async (ownerUid: string | null) => {
    if (!ownerUid) return;
    try {
      const uref = doc(collection(db, 'users'), ownerUid);
      const udoc = await getDoc(uref);
      if (!udoc.exists()) return;
      const u = udoc.data() as any;
      if (u?.routinesMigratedAt) return;
      const legacy: any[] = Array.isArray(u?.dailyRoutines) ? u.dailyRoutines : [];
      if (!legacy.length) return;
      for (const lr of legacy) {
        const title = String(lr?.title ?? '').trim();
        if (!title) continue;
        const timesArr: RoutineTime[] = Array.isArray(lr?.timings)
          ? lr.timings.map((t: any) => (typeof t === 'string' ? parseLegacyTimeString(t) : null)).filter(Boolean) as RoutineTime[]
          : [];
        await addDoc(collection(db, 'dailyRoutines'), {
          uid: ownerUid,
          title,
          notes: String(lr?.notes ?? ''),
          times: timesArr.map(t => ({ id: t.id, hour: t.hour, minute: t.minute, period: t.period })),
          createdAt: Date.now(),
          migratedFromUserDoc: true,
        });
      }
      await updateDoc(uref, { routinesMigratedAt: serverTimestamp() });
    } catch (e) {
      console.error('Legacy routines migration failed', e);
    }
  };

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

  // const addTime = () => addTimeFromDate(timeDate);

  const saveRoutine = async () => {
    if (!current.title || !(current.times && current.times.length)) {
      Alert.alert('Missing info', 'Please enter a title and add at least one time.');
      return;
    }
  if (!user) { Alert.alert('Not signed in', 'Please log in to save routines.'); return; }
  if (currentRole !== 'family') { Alert.alert('Not allowed', 'Only family members can add routines.'); return; }
    try {
      const payload = {
        uid: dataOwnerUid ?? user.uid,
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
  <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Daily Routines</Text>
            {currentRole === 'family' && (
              <TouchableOpacity style={styles.addIconButton} onPress={() => setShowAdd(true)}>
              <Ionicons name="add-circle" size={32} color="#d63384" />
              </TouchableOpacity>
            )}
          </View>
          {/* Removed Managing banner per request */}

          {isLoading ? (
            <View style={styles.emptyWrapper}><View style={styles.emptyCard}><Text style={styles.emptyText}>Loading...</Text></View></View>
          ) : routines.length === 0 ? (
            <View style={styles.emptyWrapper}><View style={styles.emptyCard}><Text style={styles.emptyText}>No routines added yet...</Text></View></View>
          ) : (
            <View style={{ gap: 16 }}>
              {routines.map(r => (
                <Swipeable key={r.id} renderLeftActions={renderLeftActions} onSwipeableOpen={() => { if (currentRole !== 'family') { Alert.alert('Not allowed', 'Only family members can delete.'); return; } deleteRoutine(r.id); }} overshootLeft={false} friction={2}>
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
  // Removed vertical centering to keep content top-aligned
  containerEmpty: {},
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#d63384' },
  addIconButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(214, 51, 132, 0.1)' },
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
  manageBanner: { backgroundColor: 'rgba(214, 51, 132, 0.08)', borderColor: 'rgba(214, 51, 132, 0.3)', borderWidth: 1, padding: 10, borderRadius: 10, marginBottom: 12 },
  manageBannerText: { color: '#d63384', fontWeight: '600' },
});


