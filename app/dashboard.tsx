import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, DocumentData, getDocs, query, QueryDocumentSnapshot, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import DrawerLayout from '../components/DrawerLayout';
import { db } from '../lib/firebaseConfig';

type TimeEntry = { hour: number; minute: number; period: 'AM' | 'PM' };

type MedicineDoc = {
  id: string;
  name: string;
  dosage: string;
  times: Array<{ id: string } & TimeEntry>;
};

type RoutineDoc = {
  id: string;
  title: string;
  times: Array<{ id: string } & TimeEntry>;
};

type UpcomingItem = { id: string; label: string; timeLabel: string; when: Date };

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [upcomingMeds, setUpcomingMeds] = useState<UpcomingItem[]>([]);
  const [upcomingRoutines, setUpcomingRoutines] = useState<UpcomingItem[]>([]);
  const [lowStock, setLowStock] = useState<{ name: string; quantity: number; daysLeft: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!user) { setUpcomingMeds([]); setUpcomingRoutines([]); return; }
      try {
        setIsLoading(true);
        // Fetch user's medicines
        const medsRef = collection(db, 'medicines');
        const medsSnap = await getDocs(query(medsRef, where('uid', '==', user.uid)));
        const meds: MedicineDoc[] = medsSnap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: String(data?.name ?? ''),
            dosage: String(data?.dosage ?? ''),
            times: Array.isArray(data?.times) ? data.times.map((t: any, idx: number) => ({
              id: t?.id ?? `${d.id}-t${idx}`,
              hour: Number(t?.hour ?? 0),
              minute: Number(t?.minute ?? 0),
              period: (t?.period === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM',
            })) : [],
          };
        });
        // Fetch user's routines
        const routinesRef = collection(db, 'dailyRoutines');
        const routinesSnap = await getDocs(query(routinesRef, where('uid', '==', user.uid)));
        const routines: RoutineDoc[] = routinesSnap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: String(data?.title ?? ''),
            times: Array.isArray(data?.times) ? data.times.map((t: any, idx: number) => ({
              id: t?.id ?? `${d.id}-t${idx}`,
              hour: Number(t?.hour ?? 0),
              minute: Number(t?.minute ?? 0),
              period: (t?.period === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM',
            })) : [],
          };
        });

        // Fetch stocks
        const stocksRef = collection(db, 'medicineStocks');
        const stocksSnap = await getDocs(query(stocksRef, where('uid', '==', user.uid)));
        const stocks: Record<string, number> = {};
        stocksSnap.docs.forEach(d => {
          const data = d.data() as any;
          stocks[String(data?.medicineId)] = Number(data?.quantity ?? 0);
        });

        const now = new Date();
        const toDate = (t: TimeEntry) => {
          const hours24 = t.period === 'PM' ? (t.hour % 12) + 12 : (t.hour % 12);
          const d = new Date();
          d.setHours(hours24, t.minute, 0, 0);
          // If time already passed today, consider tomorrow
          if (d.getTime() < now.getTime()) {
            d.setDate(d.getDate() + 1);
          }
          return d;
        };

        const medItems: UpcomingItem[] = meds.flatMap(m => m.times.map(t => ({
          id: `${m.id}_${t.id}`,
          label: `${m.name} (${m.dosage})`,
          timeLabel: `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')} ${t.period}`,
          when: toDate(t),
        })));
        const routineItems: UpcomingItem[] = routines.flatMap(r => r.times.map(t => ({
          id: `${r.id}_${t.id}`,
          label: r.title,
          timeLabel: `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')} ${t.period}`,
          when: toDate(t),
        })));

        medItems.sort((a, b) => a.when.getTime() - b.when.getTime());
        routineItems.sort((a, b) => a.when.getTime() - b.when.getTime());

        // Compute low stock (<= 3 days left)
        const low = meds
          .map(m => ({
            name: m.name,
            quantity: stocks[m.id] ?? 0,
            perDay: m.times.length || 0,
          }))
          .filter(x => x.perDay > 0)
          .map(x => ({ name: x.name, quantity: x.quantity, daysLeft: Math.floor(x.quantity / x.perDay) }))
          .filter(x => x.daysLeft <= 3)
          .sort((a,b) => a.daysLeft - b.daysLeft)
          .slice(0, 3);

        if (alive) {
          setUpcomingMeds(medItems.slice(0, 3));
          setUpcomingRoutines(routineItems.slice(0, 3));
          setLowStock(low);
        }
      } catch (e) {
        console.error('Failed to load dashboard data', e);
        if (alive) { setUpcomingMeds([]); setUpcomingRoutines([]); }
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [user]);

  const renderList = (items: UpcomingItem[], emptyText: string) => {
    if (isLoading) return <Text style={styles.cardContent}>Loading...</Text>;
    if (!items.length) return <Text style={styles.cardContent}>{emptyText}</Text>;
    return (
      <View style={{ gap: 8 }}>
        {items.map(it => (
          <View key={it.id} style={styles.row}> 
            <Ionicons name="time-outline" size={16} color="#d63384" style={{ marginRight: 8 }} />
            <Text style={styles.rowText}>{it.timeLabel} — {it.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <DrawerLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Upcoming Medications</Text>
          {renderList(upcomingMeds, 'No upcoming medications')}
        </View>

        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Upcoming Routines</Text>
          {renderList(upcomingRoutines, 'No upcoming routines')}
        </View>

        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Low Stock</Text>
          {isLoading ? (
            <Text style={styles.cardContent}>Loading...</Text>
          ) : lowStock.length === 0 ? (
            <Text style={styles.cardContent}>All stocks look good</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {lowStock.map((s, idx) => (
                <View key={`${s.name}_${idx}`} style={styles.row}>
                  <Ionicons name="alert-circle-outline" size={16} color="#d63384" style={{ marginRight: 8 }} />
                  <Text style={styles.rowText}>{s.name} — Qty: {s.quantity} (≈ {s.daysLeft} day(s) left)</Text>
                </View>
              ))}
            </View>
          )}
        </View>
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
  // Drawer-related styles moved into DrawerLayout
});
