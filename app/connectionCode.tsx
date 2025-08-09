import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function ConnectionCode() {
  const { connectionCode, qrCodeData } = useLocalSearchParams<{
    connectionCode: string;
    qrCodeData: string;
  }>();

  const [qrFormat, setQrFormat] = useState<'simple' | 'hex' | 'json'>('simple');
  const [qrValue, setQrValue] = useState('');

  useEffect(() => {
    // Generate different QR code formats
    if (qrFormat === 'simple') {
      setQrValue(connectionCode);
    } else if (qrFormat === 'hex') {
      // Convert connection code to 32-character hex
      const hexCode = convertCodeToHex(connectionCode);
      setQrValue(hexCode);
    } else if (qrFormat === 'json') {
      // JSON format with metadata
      setQrValue(JSON.stringify({
        connectionCode: connectionCode,
        type: 'eldercare_connection',
        timestamp: new Date().toISOString(),
        version: '1.0'
      }));
    }
  }, [qrFormat, connectionCode]);

  // Convert 6-character code to 32-character hex
  const convertCodeToHex = (code: string): string => {
    let hex = '';
    for (let i = 0; i < code.length; i++) {
      const charCode = code.charCodeAt(i);
      hex += charCode.toString(16).padStart(2, '0');
    }
    // Pad to 32 characters
    while (hex.length < 32) {
      hex += '0';
    }
    return hex.substring(0, 32);
  };

  const handleContinue = () => {
    Alert.alert(
      'Connection Code',
      `Your connection code is: ${connectionCode}\n\nShare this code with the elderly person you want to connect with. They can use this code to link their account to yours.`,
      [
        {
          text: 'Copy Code',
          onPress: () => {
            // In a real app, you'd copy to clipboard here
            Alert.alert('Code Copied', 'Connection code copied to clipboard');
          },
        },
        {
          text: 'Continue',
          onPress: () => router.replace('/dashboard'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connection Code</Text>
      
      <View style={styles.card}>
        <Text style={styles.subtitle}>
          Share this code with the elderly person you want to connect with
        </Text>

        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Your Connection Code:</Text>
          <Text style={styles.code}>{connectionCode}</Text>
        </View>

        <View style={styles.formatSelector}>
          <Text style={styles.formatLabel}>QR Code Format:</Text>
          <View style={styles.formatButtons}>
            <TouchableOpacity 
              style={[styles.formatButton, qrFormat === 'simple' && styles.activeFormatButton]} 
              onPress={() => setQrFormat('simple')}
            >
              <Text style={[styles.formatButtonText, qrFormat === 'simple' && styles.activeFormatButtonText]}>
                Simple
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.formatButton, qrFormat === 'hex' && styles.activeFormatButton]} 
              onPress={() => setQrFormat('hex')}
            >
              <Text style={[styles.formatButtonText, qrFormat === 'hex' && styles.activeFormatButtonText]}>
                Hex
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.formatButton, qrFormat === 'json' && styles.activeFormatButton]} 
              onPress={() => setQrFormat('json')}
            >
              <Text style={[styles.formatButtonText, qrFormat === 'json' && styles.activeFormatButtonText]}>
                JSON
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.qrContainer}>
          <Text style={styles.qrLabel}>QR Code ({qrFormat.toUpperCase()}):</Text>
          <View style={styles.qrWrapper}>
            <QRCode
              value={qrValue}
              size={200}
              color="#cc2b5e"
              backgroundColor="white"
            />
          </View>
          <Text style={styles.qrValue}>{qrValue}</Text>
        </View>

        <Text style={styles.instructions}>
          The elderly person can scan this QR code or enter the connection code manually to link their account to yours.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffe6f0',
    paddingTop: 60,
    paddingBottom: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#cc2b5e',
  },
  card: {
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#cc2b5e',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cc2b5e',
    marginBottom: 10,
  },
  code: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#cc2b5e',
    letterSpacing: 4,
    backgroundColor: '#f5b4c6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  formatSelector: {
    alignItems: 'center',
    marginBottom: 30,
  },
  formatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cc2b5e',
    marginBottom: 10,
  },
  formatButtons: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 5,
  },
  formatButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  activeFormatButton: {
    backgroundColor: '#cc2b5e',
  },
  formatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeFormatButtonText: {
    color: '#fff',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  qrLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cc2b5e',
    marginBottom: 15,
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  qrValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
