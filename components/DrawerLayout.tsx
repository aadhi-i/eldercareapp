import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { PropsWithChildren, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../lib/firebaseConfig';

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

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#d63384" />
            <Text style={styles.menuItemText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
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
});


