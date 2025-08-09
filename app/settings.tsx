import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DrawerLayout from '../components/DrawerLayout';
import ProfileSettings from '../components/ProfileSettings';

export default function SettingsScreen() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy'>('profile');

  return (
    <DrawerLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'profile' && styles.activeTab]} 
            onPress={() => setActiveTab('profile')}
          >
            <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'notifications' && styles.activeTab]} 
            onPress={() => setActiveTab('notifications')}
          >
            <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'privacy' && styles.activeTab]} 
            onPress={() => setActiveTab('privacy')}
          >
            <Text style={[styles.tabText, activeTab === 'privacy' && styles.activeTabText]}>Privacy</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'profile' && <ProfileSettings />}
        
        {activeTab === 'notifications' && (
          <View style={styles.section}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.text}>Coming soon: Notification preferences and settings.</Text>
          </View>
        )}
        
        {activeTab === 'privacy' && (
          <View style={styles.section}>
            <Text style={styles.title}>Privacy</Text>
            <Text style={styles.text}>Coming soon: Privacy settings and data management.</Text>
          </View>
        )}
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
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 192, 203, 0.3)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  activeTab: {
    backgroundColor: 'rgba(255, 192, 203, 0.2)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#d63384',
    fontWeight: '600',
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


