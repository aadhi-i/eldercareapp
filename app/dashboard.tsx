import { default as React, default as React } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import DrawerLayout from '../components/DrawerLayout';

export default function Dashboard() {
  return (
    <DrawerLayout>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Medicines Card */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Upcoming Medications</Text>
          <Text style={styles.cardContent}>• Paracetamol — 8:00 AM{"\n"}• Vitamin D — 12:00 PM</Text>
        </View>
  return (
    <DrawerLayout>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Medicine Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💊 Medicines</Text>
          <Text style={styles.cardContent}>• Paracetamol - 8:00 AM{"\n"}• Vitamin D - 12:00 PM</Text>
        </View>

        {/* Daily Routine Card */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Upcoming Routines</Text>
          <Text style={styles.cardContent}>
            • Morning Walk — 6:30 AM{"\n"}• Breakfast — 8:30 AM{"\n"}• Lunch — 1:00 PM
          </Text>
        </View>
      </ScrollView>
        {/* Daily Routine Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 Daily Routine</Text>
          <Text style={styles.cardContent}>
            • Morning Walk - 6:30 AM{"\n"}• Breakfast - 8:30 AM{"\n"}• Lunch - 1:00 PM
          </Text>
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
  card: {
    backgroundColor: 'rgba(255, 192, 203, 0.15)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#ff69b4',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
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
});
