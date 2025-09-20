import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Dimensions, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFallDetection } from '../hooks/useFallDetection';
import { auth, db } from '../lib/firebaseConfig';
import FallAlertModal from './FallAlertModal';
import FamilyAlertModal from './FamilyAlertModal';

type DrawerLayoutProps = PropsWithChildren<{
  // Optionally allow overriding the title shown next to the hamburger in the drawer
  menuTitle?: string;
}>;

export default function DrawerLayout({ children, menuTitle = 'Menu' }: DrawerLayoutProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.75, 320);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerTranslateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [fallEnabled, setFallEnabled] = useState(false);
  const [fallModal, setFallModal] = useState(false);
  const [userRole, setUserRole] = useState<'elder' | 'family' | null>(null);
  const [activeAlert, setActiveAlert] = useState<null | { id: string; elderUid: string | null; elderName?: string | null; elderPhone?: string | null }>(null);
  const [connectedElderIds, setConnectedElderIds] = useState<string[]>([]);
  const fall = useFallDetection({
    onFall: () => setFallModal(true),
    intervalMs: 60,
    graceMs: 20000,
  });

  const openDrawer = () => {
    setIsDrawerOpen(true);
    Animated.timing(drawerTranslateX, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerTranslateX, {
      toValue: -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setIsDrawerOpen(false));
  };

  const toggleDrawer = () => {
    if (isDrawerOpen) closeDrawer();
    else openDrawer();
  };

  const navigateTo = (path: string, params?: Record<string, string>) => {
    closeDrawer();
    if (params) router.push({ pathname: path as any, params } as any);
    else router.push(path as any);
  };

  const handleLogout = async () => {
    try {
      // Sign out from Firebase
      await signOut(auth);
      // Navigate to login screen
      router.replace('/login' as any);
      closeDrawer();
    } catch (error) {
      console.error('Error signing out:', error);
      // Still navigate to login screen even if there's an error
      router.replace('/login' as any);
      closeDrawer();
    }
  };

  // Load and watch fall toggle
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('fallEnabled');
        setFallEnabled(v === '1');
      } catch {}
    })();
    const sub = DeviceEventEmitter.addListener('fallToggleChanged', (value: boolean) => {
      setFallEnabled(value);
    });
    return () => sub.remove();
  }, []);

  // Load current user role
  useEffect(() => {
    (async () => {
      try {
        const usersRef = collection(db, 'users');
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const byIdSnap = await getDoc(doc(usersRef, uid));
        if (byIdSnap.exists()) {
          const d: any = byIdSnap.data();
          if (d?.role === 'family' || d?.role === 'elder') setUserRole(d.role);
          else setUserRole(null);
          return;
        }
        const byUidSnap = await getDocs(query(usersRef, where('uid', '==', uid)));
        if (!byUidSnap.empty) {
          const d: any = byUidSnap.docs[0].data();
          if (d?.role === 'family' || d?.role === 'elder') setUserRole(d.role);
          else setUserRole(null);
        }
      } catch (e) {
        console.warn('Failed to fetch user role', e);
      }
    })();
  }, []);

  // For elders: subscribe to their own user doc fallEnabled to remotely control detection
  useEffect(() => {
    if (userRole !== 'elder' || !auth.currentUser?.uid) return;
    const uRef = doc(db, 'users', auth.currentUser.uid);
    const unsub = onSnapshot(uRef, (snap) => {
      const d: any = snap.data() || {};
      const remote = !!d.fallEnabled;
      setFallEnabled(remote);
      DeviceEventEmitter.emit('fallToggleChanged', remote);
    }, (err) => console.warn('Elder fallEnabled listen error', err));
    return () => unsub();
  }, [userRole]);

  // For family: load connected elder ids and reflect first elder's fallEnabled for UI
  useEffect(() => {
    (async () => {
      if (userRole !== 'family' || !auth.currentUser?.uid) return;
      try {
        const usersRef = collection(db, 'users');
        const eldersSnap = await getDocs(query(usersRef, where('role', '==', 'elder'), where('connectedTo', '==', auth.currentUser.uid)));
        const ids = eldersSnap.docs.map((d) => d.id);
        setConnectedElderIds(ids);
        if (ids.length > 0) {
          const unsub = onSnapshot(doc(db, 'users', ids[0]), (snap) => {
            const d: any = snap.data() || {};
            const remote = !!d.fallEnabled;
            setFallEnabled(remote);
          }, (err) => console.warn('Family reflect fallEnabled listen error', err));
          return () => unsub();
        }
      } catch (e) {
        console.warn('Failed to load connected elders', e);
      }
    })();
  }, [userRole]);

  // Subscribe to alerts for family accounts (simplified query to avoid composite index)
  useEffect(() => {
    if (userRole !== 'family' || !auth.currentUser?.uid) return;
    const alertsRef = collection(db, 'alerts');
    const qAlerts = query(alertsRef, where('toUid', '==', auth.currentUser.uid));
    const unsub = onSnapshot(qAlerts, async (snap) => {
      if (snap.empty) return;
      // pick the newest 'new' alert
      const candidates = snap.docs
        .map((d) => ({ id: d.id, data: d.data() as any }))
        .filter((x) => (x.data?.status || 'new') === 'new');
      if (candidates.length === 0) return;
      const pick = candidates.sort((a, b) => {
        const ta: any = a.data?.createdAt?.toMillis ? a.data.createdAt.toMillis() : 0;
        const tb: any = b.data?.createdAt?.toMillis ? b.data.createdAt.toMillis() : 0;
        return tb - ta;
      })[0];
      const data: any = pick.data;
      const docId = pick.id;
      const elderUid: string | null = data?.elderUid || null;
      let elderName: string | null = null;
      let elderPhone: string | null = null;
      try {
        if (elderUid) {
          const uRef = collection(db, 'users');
          const elderById = await getDoc(doc(uRef, elderUid));
          if (elderById.exists()) {
            const d: any = elderById.data();
            elderName = d?.name || d?.fullName || d?.displayName || null;
            elderPhone = d?.phone || null;
          } else {
            const byUid = await getDocs(query(uRef, where('uid', '==', elderUid)));
            if (!byUid.empty) {
              const d: any = byUid.docs[0].data();
              elderName = d?.name || d?.fullName || d?.displayName || null;
              elderPhone = d?.phone || null;
            }
          }
        }
      } catch {}
      setActiveAlert({ id: docId, elderUid, elderName, elderPhone });
    }, (err) => {
      console.warn('alerts listen error', err?.code || err?.message || err);
    });
    return () => unsub();
  }, [userRole]);

  useEffect(() => {
    if (fallEnabled) fall.enable();
    else fall.disable();
    AsyncStorage.setItem('fallEnabled', fallEnabled ? '1' : '0').catch(() => {});
  }, [fallEnabled]);

  const onToggleFall = async () => {
    if (userRole !== 'family') return;
    setFallEnabled((v) => !v);
    const next = !fallEnabled;
    DeviceEventEmitter.emit('fallToggleChanged', next);
    try { Speech.speak(next ? 'Fall detection enabled' : 'Fall detection disabled', { rate: 0.95 }); } catch {}
    // Propagate to connected elder documents
    try {
      if (connectedElderIds.length > 0) {
        await Promise.all(connectedElderIds.map((id) => updateDoc(doc(db, 'users', id), {
          fallEnabled: next,
          fallUpdatedAt: serverTimestamp(),
          controlledBy: auth.currentUser?.uid || null,
        })));
      }
    } catch (e) {
      console.warn('Failed to update elder fallEnabled', e);
    }
  };

  const fetchEmergencyInfo = async (): Promise<{ number: string | null; data: any | null }> => {
    try {
      const usersRef = collection(db, 'users');
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        const byIdSnap = await getDoc(doc(usersRef, uid));
        if (byIdSnap.exists()) {
          const d: any = byIdSnap.data();
          return { number: d?.emergencyContact || d?.phone || null, data: { ...d, id: uid } };
        }
        const byUidSnap = await getDocs(query(usersRef, where('uid', '==', uid)));
        if (!byUidSnap.empty) {
          const d: any = byUidSnap.docs[0].data();
          return { number: d?.emergencyContact || d?.phone || null, data: { ...d, id: byUidSnap.docs[0].id } };
        }
      }
    } catch (e) {
      console.warn('Emergency number fetch failed', e);
    }
    return { number: null, data: null };
  };

  const handleConfirmHelp = async () => {
    setFallModal(false);
    const info = await fetchEmergencyInfo();
    const phone = (info.number || '')?.toString().replace(/\s+/g, '') || '';
    const elder = info.data;
    // Firestore alert for connected devices
    try {
      const toUid = elder?.connectedTo || null;
      if (toUid) {
        await addDoc(collection(db, 'alerts'), {
          toUid,
          type: 'fall',
          elderUid: elder?.uid || auth.currentUser?.uid || null,
          createdAt: serverTimestamp(),
          status: 'new',
        });
      }
    } catch (e) {
      console.warn('Failed to write fall alert', e);
    }
    if (phone) {
      try { Speech.speak('Calling your emergency contact.', { rate: 0.95 }); } catch {}
      Linking.openURL(`tel:${phone}`).catch(() => {
        try { Speech.speak('Unable to open phone dialer.', { rate: 0.95 }); } catch {}
      });
    } else {
      try { Speech.speak('No emergency contact number found in your profile.', { rate: 0.95 }); } catch {}
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* App Header with hamburger at top-left */}
      <View
        style={[
          styles.appHeader,
          { paddingTop: insets.top + 10 },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          onPress={toggleDrawer}
          accessibilityLabel={isDrawerOpen ? 'Close menu' : 'Open menu'}
          style={styles.headerHamburger}
        >
          <Ionicons name="menu" size={28} color="#d63384" />
        </TouchableOpacity>
        <Text style={styles.appHeaderTitle}>ElderCare</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Content below header */}
      <View style={{ flex: 1 }}>{children}</View>

      {/* Overlay */}
      {isDrawerOpen && <Pressable onPress={closeDrawer} style={styles.overlay} />}

      {/* Drawer */}
      <Animated.View
        pointerEvents={isDrawerOpen ? 'auto' : 'none'}
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            transform: [{ translateX: drawerTranslateX }],
            paddingTop: insets.top + 16,
          },
        ]}
      >
        <View style={styles.menuContainer}>
          {/* Header row with hamburger to the left of text "Menu" */}
          <View style={styles.drawerHeaderRow}>
            <TouchableOpacity onPress={toggleDrawer} accessibilityRole="button">
              <Ionicons name="menu" size={26} color="#d63384" />
            </TouchableOpacity>
            <Text style={styles.drawerHeaderText}>{menuTitle}</Text>
          </View>

          {/* New: Dashboard and Connection entries */}
          <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/dashboard')}>
            <Ionicons name="home-outline" size={22} color="#d63384" />
            <Text style={styles.menuItemText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/connectionCode')}>
            <Ionicons name="qr-code-outline" size={22} color="#d63384" />
            <Text style={styles.menuItemText}>Connection</Text>
          </TouchableOpacity>

          {/* Existing items */}

          <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/medication')}>
            <Ionicons name="medical-outline" size={22} color="#d63384" />
            <Text style={styles.menuItemText}>Medication</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/dailyRoutines')}>
            <Ionicons name="calendar-outline" size={22} color="#d63384" />
            <Text style={styles.menuItemText}>Daily Routines</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/medicinestock')}>
            <Ionicons name="cube-outline" size={22} color="#d63384" />
            <Text style={styles.menuItemText}>Medicine Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/settings')}>
            <Ionicons name="settings-outline" size={22} color="#d63384" />
            <Text style={styles.menuItemText}>Settings</Text>
          </TouchableOpacity>

          {/* Fall detection control (family-only toggle) */}
          {userRole === 'family' ? (
            <View style={[styles.menuItem, { justifyContent: 'space-between' }]}> 
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="alert-circle-outline" size={22} color="#d63384" />
                <Text style={styles.menuItemText}>Fall Detection</Text>
              </View>
              <TouchableOpacity
                onPress={onToggleFall}
                accessibilityRole="button"
                accessibilityLabel={fallEnabled ? 'Disable fall detection' : 'Enable fall detection'}
                style={[styles.toggleBtn, fallEnabled ? styles.toggleOn : styles.toggleOff]}
              >
                <Text style={styles.toggleText}>{fallEnabled ? 'On' : 'Off'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.menuItem, { justifyContent: 'space-between' }]}> 
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="alert-circle-outline" size={22} color="#d63384" />
                <Text style={styles.menuItemText}>Fall Detection</Text>
              </View>
              <View style={[styles.toggleBtn, styles.toggleOff]}>
                <Text style={styles.toggleText}>{fallEnabled ? 'On' : 'Off'}</Text>
              </View>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#d63384" />
            <Text style={styles.menuItemText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      {/* Global fall alert modal */}
      <FallAlertModal
        visible={fallModal}
        onCancel={() => setFallModal(false)}
        onConfirmHelp={handleConfirmHelp}
      />
      {/* Family-side alert modal */}
      <FamilyAlertModal
        visible={!!activeAlert}
        elderName={activeAlert?.elderName || undefined}
        onAcknowledge={async () => {
          const a = activeAlert; if (!a) return;
          try {
            await updateDoc(doc(db, 'alerts', a.id), { status: 'acknowledged', acknowledgedAt: serverTimestamp() });
          } catch {}
          setActiveAlert(null);
        }}
        onCall={() => {
          const phone = (activeAlert?.elderPhone || '').toString().replace(/\s+/g, '');
          if (phone) {
            Linking.openURL(`tel:${phone}`).catch(() => {});
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 2, height: 0 },
    shadowRadius: 8,
    elevation: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.05)',
  },
  appHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 105, 180, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerHamburger: {
    padding: 6,
    borderRadius: 20,
  },
  appHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d63384',
  },
  menuContainer: {
    flex: 1,
  },
  drawerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  drawerHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d63384',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutItem: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  toggleOn: {
    backgroundColor: '#28a745',
  },
  toggleOff: {
    backgroundColor: '#6c757d',
  },
  toggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});


