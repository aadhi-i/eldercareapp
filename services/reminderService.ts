import * as Notifications from 'expo-notifications';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Backwards-compatible fields
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Newer fields for SDK 54+/expo-notifications >= 0.32
    shouldShowBanner: true,
    shouldShowList: true,
  }) as any,
});

export interface Medicine {
  id?: string;
  uid?: string;
  name: string;
  timings?: string[]; // legacy
  times?: Array<{ id?: string; hour: number; minute: number; period: 'AM' | 'PM' }>; // current
  dosage: string;
}

export interface Routine {
  id?: string;
  uid?: string;
  name: string;
  time: string;
  type: string;
  description?: string;
}

export interface UserProfile {
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
  routines?: Routine[];
  role: string;
  connectedTo?: string;
}

class ReminderService {
  private scheduledNotifications: string[] = [];
  private watchUnsubs: Array<() => void> = [];
  private watchTargetElder: string | null = null;
  private debounceTimer: any = null;

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }

      // Get push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push notification token:', token);
      
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  // Schedule medication reminder (10 minutes before)
  async scheduleMedicationReminder(medicine: Medicine, timeString: string): Promise<string | null> {
    try {
      const parsed = this.parseTimeString(timeString);
      if (!parsed) return null;
  const offsetMinutes = 10;
  const reminderTime = new Date(parsed.getTime() - offsetMinutes * 60 * 1000);
  // if time already passed today, push to tomorrow
  if (reminderTime <= new Date()) reminderTime.setDate(reminderTime.getDate() + 1);
  // Calendar daily trigger at specific time
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Medication Reminder',
          body: `${medicine.name} at ${timeString}`,
          data: {
            type: 'medication',
            medicineName: medicine.name,
            time: timeString,
            dosage: medicine.dosage,
          },
        },
  trigger: ({ hour: reminderTime.getHours(), minute: reminderTime.getMinutes(), repeats: true } as any),
      });

      this.scheduledNotifications.push(notificationId);
      console.log(`Scheduled medication reminder for ${medicine.name} at ${timeString}`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling medication reminder:', error);
      return null;
    }
  }

  // Schedule routine reminder (20 minutes before)
  async scheduleRoutineReminder(routine: Routine): Promise<string | null> {
    try {
      const parsed = this.parseTimeString(routine.time);
      if (!parsed) return null;
  const offsetMinutes = 20;
  const reminderTime = new Date(parsed.getTime() - offsetMinutes * 60 * 1000);
  if (reminderTime <= new Date()) reminderTime.setDate(reminderTime.getDate() + 1);
  // Calendar daily trigger at specific time
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 Routine Reminder',
          body: `${routine.name} starts at ${routine.time}`,
          data: {
            type: 'routine',
            routineName: routine.name,
            time: routine.time,
            description: routine.description,
          },
        },
  trigger: ({ hour: reminderTime.getHours(), minute: reminderTime.getMinutes(), repeats: true } as any),
      });

      this.scheduledNotifications.push(notificationId);
      console.log(`Scheduled routine reminder for ${routine.name} at ${routine.time}`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling routine reminder:', error);
      return null;
    }
  }

  // Schedule low stock alert (1 day before running out)
  async scheduleLowStockAlert(params: { medicine: Medicine; quantity: number }): Promise<string | null> {
    try {
      const { medicine, quantity } = params;
      // Determine daily consumption
      const timesPerDay = Array.isArray(medicine.times) ? medicine.times.length : (Array.isArray(medicine.timings) ? medicine.timings.length : 0);
      if (!timesPerDay) return null;

      // Approximate quantity per dose from dosage text
      const dosageText = (medicine.dosage || '').toLowerCase();
      let qtyPerDose = 1;
      const extractNum = (re: RegExp) => {
        const m = dosageText.match(re);
        return m ? parseInt(m[1]) : undefined;
      };
      qtyPerDose = extractNum(/(\d+)\s*tablet/) || extractNum(/(\d+)\s*capsule/) || extractNum(/(\d+)\s*ml/) || extractNum(/(\d+)\s*mg/) || extractNum(/(\d+)/) || 1;

      const dailyConsumption = Math.max(1, timesPerDay * qtyPerDose);
      const daysLeft = Math.floor(quantity / dailyConsumption);

      // Compute alert time: 1 day before running out, at 9:00 AM
      const now = new Date();
      const alert = new Date(now);
      alert.setHours(9, 0, 0, 0);
      const daysUntilAlert = Math.max(0, daysLeft - 1);
      alert.setDate(alert.getDate() + daysUntilAlert);

      // If the computed alert time is in the past, schedule for soon (in 1 minute)
      const triggerDate = alert.getTime() <= Date.now() ? new Date(Date.now() + 60 * 1000) : alert;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Low Stock Alert',
          body: `${medicine.name} may run out in about 1 day`,
          data: {
            type: 'low_stock',
            medicineName: medicine.name,
            quantity,
          },
        },
        trigger: ({ date: triggerDate } as any),
      });

      this.scheduledNotifications.push(notificationId);
      console.log(`Scheduled low stock alert for ${medicine.name} on ${triggerDate.toISOString()}`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling low stock alert:', error);
      return null;
    }
  }

  // Parse time string (e.g., "9:00 AM", "14:30", "2:30 PM")
  private parseTimeString(timeString: string): Date | null {
    try {
      const now = new Date();
      const [time, period] = timeString.split(' ');
      
      let [hours, minutes] = time.split(':').map(Number);
      
      // Handle AM/PM
      if (period) {
        if (period.toUpperCase() === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period.toUpperCase() === 'AM' && hours === 12) {
          hours = 0;
        }
      }
      
      const notificationTime = new Date(now);
      notificationTime.setHours(hours, minutes, 0, 0);
      
      return notificationTime;
    } catch (error) {
      console.error('Error parsing time string:', error);
      return null;
    }
  }

  private offsetHourMinute(hour24: number, minute: number, offsetMinutes: number): { hour: number; minute: number } {
    const total = (hour24 * 60 + minute + offsetMinutes + 24 * 60) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return { hour: h, minute: m };
  }

  // Schedule all reminders for a user
  async scheduleAllReminders(userId: string): Promise<void> {
    try {
      // Clear existing notifications
      await this.cancelAllNotifications();
      // Resolve connected family (if any) for elder
      const usersRef = collection(db, 'users');
      const uDoc = await getDoc(doc(usersRef, userId));
      if (!uDoc.exists()) {
        console.log('User not found for reminder scheduling');
        return;
      }
      const uData = uDoc.data() as UserProfile;
      const elderUid = uData.uid || userId;
      const familyUid = await this.resolveConnectedFamilyUid(elderUid);
      const uids = familyUid && familyUid !== elderUid ? [elderUid, familyUid] : [elderUid];

      // Load medicines from Firestore
      const medsSnap = uids.length > 1
        ? await getDocs(query(collection(db, 'medicines'), where('uid', 'in', uids)))
        : await getDocs(query(collection(db, 'medicines'), where('uid', '==', uids[0])));
      const medicines: Medicine[] = medsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // Schedule medication reminders
      for (const med of medicines) {
        const timings: string[] = Array.isArray(med.timings) && med.timings.length
          ? med.timings
          : (Array.isArray(med.times) ? med.times.map(t => this.formatTime(t.hour, t.minute, t.period)) : []);
        for (const t of timings) {
          await this.scheduleMedicationReminder(med, t);
        }
      }

      // Load routines from Firestore
      const routinesSnap = uids.length > 1
        ? await getDocs(query(collection(db, 'dailyRoutines'), where('uid', 'in', uids)))
        : await getDocs(query(collection(db, 'dailyRoutines'), where('uid', '==', uids[0])));
      const routines: Routine[] = routinesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      for (const r of routines) {
        await this.scheduleRoutineReminder(r);
      }

      // Load stock and schedule 1-day alerts
      const stockSnap = await getDocs(query(collection(db, 'medicineStocks'), where('uid', '==', elderUid)));
      const stockByMed: Record<string, number> = {};
      stockSnap.docs.forEach(s => {
        const sd = s.data() as any;
        if (sd?.medicineId) stockByMed[String(sd.medicineId)] = Number(sd.quantity ?? 0);
      });
      for (const med of medicines) {
        const q = stockByMed[med.id!];
        if (q && q > 0) {
          await this.scheduleLowStockAlert({ medicine: med, quantity: q });
        }
      }

      console.log(`Scheduled all reminders for user: ${elderUid}`);
    } catch (error) {
      console.error('Error scheduling all reminders:', error);
    }
  }

  // Schedule reminders for connected elder (for family members)
  async scheduleElderReminders(familyMemberId: string): Promise<void> {
    try {
      // Find connected elder
      const usersRef = collection(db, 'users');
      const elderQuery = query(usersRef, where('connectedTo', '==', familyMemberId));
      const elderSnapshot = await getDocs(elderQuery);

      if (!elderSnapshot.empty) {
        const elderData = elderSnapshot.docs[0].data() as UserProfile;
        await this.scheduleAllReminders(elderData.uid);
      }
    } catch (error) {
      console.error('Error scheduling elder reminders:', error);
    }
  }

  // Live watch to auto-reschedule when data changes
  startWatchingElder(elderUid: string): void {
    if (this.watchTargetElder === elderUid) return; // already watching
    this.stopWatching();
    this.watchTargetElder = elderUid;
    const setup = async () => {
      const familyUid = await this.resolveConnectedFamilyUid(elderUid);
      const uids = familyUid && familyUid !== elderUid ? [elderUid, familyUid] : [elderUid];
      // Medicines
      const medsUnsub = onSnapshot(
        uids.length > 1
          ? query(collection(db, 'medicines'), where('uid', 'in', uids))
          : query(collection(db, 'medicines'), where('uid', '==', uids[0]!)),
        () => this.debounceReschedule(elderUid)
      );
      // Routines
      const routinesUnsub = onSnapshot(
        uids.length > 1
          ? query(collection(db, 'dailyRoutines'), where('uid', 'in', uids))
          : query(collection(db, 'dailyRoutines'), where('uid', '==', uids[0]!)),
        () => this.debounceReschedule(elderUid)
      );
      // Stock (only elder-owned)
      const stockUnsub = onSnapshot(
        query(collection(db, 'medicineStocks'), where('uid', '==', elderUid)),
        () => this.debounceReschedule(elderUid)
      );
      this.watchUnsubs = [medsUnsub, routinesUnsub, stockUnsub];
      // Initial schedule
      this.debounceReschedule(elderUid);
    };
    setup();
  }

  async startWatchingForFamily(familyUid: string): Promise<void> {
    // Resolve elder and start watching elder
    const elderUid = await this.resolveElderForFamily(familyUid);
    if (elderUid) this.startWatchingElder(elderUid);
  }

  stopWatching(): void {
    this.watchUnsubs.forEach(u => {
      try { u(); } catch {}
    });
    this.watchUnsubs = [];
    this.watchTargetElder = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private debounceReschedule = (elderUid: string) => {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.scheduleAllReminders(elderUid).catch(err => console.error('Reschedule failed', err));
    }, 400);
  };

  private async resolveConnectedFamilyUid(elderUid: string): Promise<string | null> {
    try {
      const uRef = doc(collection(db, 'users'), elderUid);
      const uDoc = await getDoc(uRef);
      if (!uDoc.exists()) return null;
      const data = uDoc.data() as any;
      const raw = data?.connectedTo ? String(data.connectedTo) : null;
      if (!raw) return null;
      // by doc id
      const famDoc = await getDoc(doc(collection(db, 'users'), raw));
      if (famDoc.exists()) return famDoc.id;
      // by uid field
      const byUid = await getDocs(query(collection(db, 'users'), where('uid', '==', raw)));
      if (!byUid.empty) return byUid.docs[0].id;
      // by phone variants
      const exact = await getDocs(query(collection(db, 'users'), where('phone', '==', raw)));
      if (!exact.empty) return exact.docs[0].id;
      const digits = raw.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      if (last10) {
        const by10 = await getDocs(query(collection(db, 'users'), where('phone', '==', last10)));
        if (!by10.empty) return by10.docs[0].id;
        if (/^\d{10}$/.test(last10)) {
          const byNum = await getDocs(query(collection(db, 'users'), where('phone', '==', Number(last10) as any)));
          if (!byNum.empty) return byNum.docs[0].id;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async resolveElderForFamily(familyUid: string): Promise<string | null> {
    try {
      // by connectedElders
      const byArr = await getDocs(query(collection(db, 'users'), where('connectedElders', 'array-contains', familyUid)));
      if (!byArr.empty) return byArr.docs[0].id;
      // by elder.connectedTo == familyUid
      const byField = await getDocs(query(collection(db, 'users'), where('connectedTo', '==', familyUid)));
      if (!byField.empty) return byField.docs[0].id;
      return null;
    } catch {
      return null;
    }
  }

  private formatTime(hour: number, minute: number, period: 'AM'|'PM'): string {
    const h = Math.max(1, Math.min(12, hour));
    const m = String(minute).padStart(2, '0');
    return `${h}:${m} ${period}`;
  }

  // Cancel all scheduled notifications
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledNotifications = [];
      console.log('Cancelled all scheduled notifications');
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  // Cancel specific notification
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      this.scheduledNotifications = this.scheduledNotifications.filter(id => id !== notificationId);
      console.log(`Cancelled notification: ${notificationId}`);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Initialize reminder service
  async initialize(): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (hasPermission) {
        console.log('Reminder service initialized successfully');
      } else {
        console.log('Reminder service initialization failed - no permissions');
      }
    } catch (error) {
      console.error('Error initializing reminder service:', error);
    }
  }
}

// Export singleton instance
export const reminderService = new ReminderService();
export default reminderService;

