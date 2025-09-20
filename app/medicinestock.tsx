import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, DocumentData, onSnapshot, query, QueryDocumentSnapshot, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, LayoutAnimation, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../components/AuthProvider';
import DrawerLayout from '../components/DrawerLayout';
import { db } from '../lib/firebaseConfig';

type TimeEntry = { id: string; hour: number; minute: number; period: 'AM' | 'PM' };
type Medicine = { id: string; name: string; dosage: string; times: TimeEntry[] };

type Stock = { id: string; medicineId: string; quantity: number; lastDecrementDate?: number };

export default function MedicineStockScreen() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stocks, setStocks] = useState<Record<string, Stock>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showAddStock, setShowAddStock] = useState<boolean>(false);
  const [selectedMedicineId, setSelectedMedicineId] = useState<string | null>(null);
  const [addQuantity, setAddQuantity] = useState<string>('');

  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  useEffect(() => {
    if (!user) { setMedicines([]); setStocks({}); return; }
    let unsubMeds: (() => void) | null = null;
    let unsubStocks: (() => void) | null = null;
    setIsLoading(true);
    try {
      const medsRef = query(collection(db, 'medicines'), where('uid', '==', user.uid));
      unsubMeds = onSnapshot(medsRef, snapshot => {
        const items: Medicine[] = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data() as any;
          const times: TimeEntry[] = Array.isArray(data?.times) ? data.times.map((t: any, idx: number) => ({
            id: t?.id ?? `${d.id}-t${idx}`,
            hour: Number(t?.hour ?? 0),
            minute: Number(t?.minute ?? 0),
            period: (t?.period === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM',
          })) : [];
          return { id: d.id, name: String(data?.name ?? ''), dosage: String(data?.dosage ?? ''), times };
        });
        setMedicines(items);
      });

      const stocksRef = query(collection(db, 'medicineStocks'), where('uid', '==', user.uid));
      unsubStocks = onSnapshot(stocksRef, snapshot => {
        const map: Record<string, Stock> = {};
        snapshot.docs.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data() as any;
          map[data.medicineId] = {
            id: d.id,
            medicineId: String(data?.medicineId),
            quantity: Number(data?.quantity ?? 0),
            lastDecrementDate: typeof data?.lastDecrementDate === 'number' ? data.lastDecrementDate : undefined,
          };
        });
        setStocks(map);
      });
    } catch (e) {
      console.error('Failed to load stock data', e);
    } finally {
      setIsLoading(false);
    }
    return () => {
      unsubMeds && unsubMeds();
      unsubStocks && unsubStocks();
    };
  }, [user]);

  // Enhanced automatic stock decrease based on medication schedules
  useEffect(() => {
    if (!user) return;
    const todayKey = new Date(); 
    todayKey.setHours(0, 0, 0, 0);
    const todayMs = todayKey.getTime();
    const updates: Promise<any>[] = [];
    
    medicines.forEach(m => {
      const current = stocks[m.id];
      if (!current) return;
      
      // Skip if already decremented today
      if (current.lastDecrementDate === todayMs) return;
      
      // Calculate daily consumption based on dosage and frequency
      const timesPerDay = m.times.length;
      if (!timesPerDay) return;
      
      // Parse dosage to get quantity per dose (e.g., "1 tablet", "2 capsules", "5ml")
      const dosageText = m.dosage.toLowerCase();
      let quantityPerDose = 1; // default
      
      if (dosageText.includes('tablet')) {
        const match = dosageText.match(/(\d+)\s*tablet/);
        quantityPerDose = match ? parseInt(match[1]) : 1;
      } else if (dosageText.includes('capsule')) {
        const match = dosageText.match(/(\d+)\s*capsule/);
        quantityPerDose = match ? parseInt(match[1]) : 1;
      } else if (dosageText.includes('ml')) {
        const match = dosageText.match(/(\d+)\s*ml/);
        quantityPerDose = match ? parseInt(match[1]) : 1;
      } else if (dosageText.includes('mg')) {
        const match = dosageText.match(/(\d+)\s*mg/);
        quantityPerDose = match ? parseInt(match[1]) : 1;
      } else {
        // Try to extract any number from dosage
        const match = dosageText.match(/(\d+)/);
        quantityPerDose = match ? parseInt(match[1]) : 1;
      }
      
      // Calculate total daily consumption
      const dailyConsumption = timesPerDay * quantityPerDose;
      const newQty = Math.max(0, current.quantity - dailyConsumption);
      
      // Only update if quantity changed
      if (newQty !== current.quantity) {
        updates.push(updateDoc(doc(db, 'medicineStocks', current.id), { 
          quantity: newQty, 
          lastDecrementDate: todayMs,
          lastDecrementAmount: dailyConsumption
        }));
      }
    });
    
    if (updates.length) {
      Promise.allSettled(updates).catch((error) => {
        console.error('Error updating medicine stock:', error);
      });
    }
  }, [medicines, stocks, user]);

  const openAddStock = (medicineId: string) => {
    setSelectedMedicineId(medicineId);
    setAddQuantity('');
    setShowAddStock(true);
  };

  const saveStock = async () => {
    if (!user || !selectedMedicineId) return;
    const qty = Number(addQuantity);
    if (!Number.isFinite(qty) || qty <= 0) { Alert.alert('Invalid quantity'); return; }
    try {
      const existing = stocks[selectedMedicineId];
      if (existing) {
        await updateDoc(doc(db, 'medicineStocks', existing.id), { quantity: existing.quantity + qty });
      } else {
        await addDoc(collection(db, 'medicineStocks'), { uid: user.uid, medicineId: selectedMedicineId, quantity: qty, lastDecrementDate: null });
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowAddStock(false);
    } catch (e) {
      console.error('Failed to save stock', e);
      Alert.alert('Error', 'Failed to save stock');
    }
  };

  // const lowStock = useMemo(() => {
  //   return medicines
  //     .map(m => ({
  //       medicine: m,
  //       quantity: stocks[m.id]?.quantity ?? 0,
  //       daysLeft: m.times.length ? Math.floor((stocks[m.id]?.quantity ?? 0) / m.times.length) : Infinity,
  //     }))
  //     .filter(x => x.daysLeft <= 3)
  //     .sort((a,b) => a.daysLeft - b.daysLeft)
  //     .slice(0, 50);
  // }, [medicines, stocks]);

  const getQty = (id: string) => stocks[id]?.quantity ?? 0;

  return (
    <DrawerLayout>
      <GestureHandlerRootView style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Medicine Stock</Text>
            <TouchableOpacity style={styles.addIconButton}>
              <Ionicons name="add-circle" size={32} color="#d63384" />
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>Loading...</Text></View>
          ) : medicines.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>No medicines available. Add medicines first.</Text></View>
          ) : (
            <View style={{ gap: 16 }}>
              {medicines.map(m => (
                <View key={m.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.medName}>{m.name}</Text>
                    <View style={styles.stockInfo}>
                      <Text style={styles.qtyBadge}>Qty: {getQty(m.id)}</Text>
                      {m.times.length > 0 && (
                        <Text style={styles.daysRemaining}>
                          {Math.floor(getQty(m.id) / m.times.length)} days left
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.medDosage}>Dosage: {m.dosage}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={styles.timesLabel}>Per day: {m.times.length} time(s)</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => openAddStock(m.id)}>
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={styles.addBtnText}>Add Stock</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Add Stock Modal */}
          <Modal visible={showAddStock} animationType="slide" transparent onRequestClose={() => setShowAddStock(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity style={styles.modalClose} onPress={() => setShowAddStock(false)}>
                  <Ionicons name="close" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Add Stock</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Quantity"
                  value={addQuantity}
                  onChangeText={setAddQuantity}
                  keyboardType="numeric"
                />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity style={[styles.modalButton, styles.secondary]} onPress={() => setShowAddStock(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.primary]} onPress={saveStock}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#d63384' },
  addIconButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(214, 51, 132, 0.1)' },
  emptyCard: { backgroundColor: 'rgba(255, 192, 203, 0.15)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255, 192, 203, 0.3)' },
  emptyText: { color: '#666', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  medName: { fontSize: 18, fontWeight: '600', color: '#333' },
  medDosage: { fontSize: 14, color: '#666', marginTop: 4 },
  stockInfo: { alignItems: 'flex-end' },
  qtyBadge: { backgroundColor: '#f0f0f0', color: '#333', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, overflow: 'hidden', fontSize: 12 },
  daysRemaining: { fontSize: 11, color: '#666', marginTop: 2, fontStyle: 'italic' },
  timesLabel: { fontSize: 14, color: '#666' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#d63384', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' },
  modalClose: { position: 'absolute', right: 12, top: 12, zIndex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  secondary: { backgroundColor: '#6c757d' },
  primary: { backgroundColor: '#d63384' },
  modalButtonText: { color: '#fff', fontWeight: '600' },
});

