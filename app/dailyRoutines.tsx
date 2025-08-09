import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import DrawerLayout from '../components/DrawerLayout';

export default function DailyRoutinesScreen() {
  return (
    <DrawerLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.title}>Daily Routines</Text>
          <Text style={styles.text}>Coming soon: Plan and track daily routines and activities.</Text>
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


