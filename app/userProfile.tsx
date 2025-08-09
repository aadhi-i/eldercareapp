import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import DrawerLayout from '../components/DrawerLayout';

export default function UserProfileScreen() {
  return (
    <DrawerLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.title}>User Profile</Text>
          <Text style={styles.text}>Coming soon: Edit profile, contact details, and caregiver info.</Text>
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


