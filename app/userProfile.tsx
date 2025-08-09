import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function UserProfileScreen() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to settings screen with profile tab active
    router.replace('/settings');
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#d63384" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  section: {
    backgroundColor: 'rgba(255, 192, 203, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 192, 203, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#d63384',
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
});


