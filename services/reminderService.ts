import * as Notifications from 'expo-notifications';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface Medicine {
  name: string;
  timings: string[];
  dosage: string;
  stock?: number;
}

export interface Routine {
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

  // Schedule medication reminder (5 minutes before)
  async scheduleMedicationReminder(medicine: Medicine, timeString: string): Promise<string | null> {
    try {
      const notificationTime = this.parseTimeString(timeString);
      if (!notificationTime) return null;

      // Schedule 5 minutes before
      const reminderTime = new Date(notificationTime.getTime() - 5 * 60 * 1000);
      
      // Don't schedule if the time has already passed today
      if (reminderTime <= new Date()) {
        return null;
      }

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
        trigger: {
          date: reminderTime,
          repeats: true, // Repeat daily
        },
      });

      this.scheduledNotifications.push(notificationId);
      console.log(`Scheduled medication reminder for ${medicine.name} at ${timeString}`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling medication reminder:', error);
      return null;
    }
  }

  // Schedule routine reminder (30 minutes before)
  async scheduleRoutineReminder(routine: Routine): Promise<string | null> {
    try {
      const notificationTime = this.parseTimeString(routine.time);
      if (!notificationTime) return null;

      // Schedule 30 minutes before
      const reminderTime = new Date(notificationTime.getTime() - 30 * 60 * 1000);
      
      // Don't schedule if the time has already passed today
      if (reminderTime <= new Date()) {
        return null;
      }

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
        trigger: {
          date: reminderTime,
          repeats: true, // Repeat daily
        },
      });

      this.scheduledNotifications.push(notificationId);
      console.log(`Scheduled routine reminder for ${routine.name} at ${routine.time}`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling routine reminder:', error);
      return null;
    }
  }

  // Schedule low stock alert
  async scheduleLowStockAlert(medicine: Medicine): Promise<string | null> {
    try {
      if (!medicine.stock || medicine.stock >= 3) return null;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Low Stock Alert',
          body: `${medicine.name} has only ${medicine.stock} days left`,
          data: {
            type: 'low_stock',
            medicineName: medicine.name,
            stock: medicine.stock,
          },
        },
        trigger: null, // Show immediately
      });

      this.scheduledNotifications.push(notificationId);
      console.log(`Scheduled low stock alert for ${medicine.name}`);
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

  // Schedule all reminders for a user
  async scheduleAllReminders(userId: string): Promise<void> {
    try {
      // Clear existing notifications
      await this.cancelAllNotifications();

      // Get user data
      const usersRef = collection(db, 'users');
      const userDocRef = doc(usersRef, userId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.log('User not found for reminder scheduling');
        return;
      }

      const userData = userDoc.data() as UserProfile;

      // Schedule medication reminders
      if (userData.medicines && userData.medicines.length > 0) {
        for (const medicine of userData.medicines) {
          if (medicine.timings && medicine.timings.length > 0) {
            for (const timing of medicine.timings) {
              await this.scheduleMedicationReminder(medicine, timing);
            }
          }
        }
      }

      // Schedule routine reminders
      if (userData.routines && userData.routines.length > 0) {
        for (const routine of userData.routines) {
          await this.scheduleRoutineReminder(routine);
        }
      }

      // Schedule low stock alerts
      if (userData.medicines && userData.medicines.length > 0) {
        for (const medicine of userData.medicines) {
          if (medicine.stock && medicine.stock < 3) {
            await this.scheduleLowStockAlert(medicine);
          }
        }
      }

      console.log(`Scheduled all reminders for user: ${userData.firstName} ${userData.lastName}`);
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
