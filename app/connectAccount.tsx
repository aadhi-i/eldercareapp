import { Camera } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ConnectAccount() {
  // Use any-cast wrapper to satisfy JSX typing across expo-camera versions
  const CameraComponent: any = Camera as any;
  const [connectionCode, setConnectionCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  const handleScanQR = async () => {
    if (hasPermission === null) {
      Alert.alert('Requesting Permission', 'Requesting camera permission...');
      return;
    }
    if (hasPermission === false) {
      Alert.alert('No Access to Camera', 'Camera permission is required to scan QR codes.');
      return;
    }
    setScanning(true);
    setScanned(false);
  };

  // Convert 32-character hex to 6-character alphanumeric code
  const convertHexToCode = (hex: string): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    // Use different parts of the hex to generate the code
    for (let i = 0; i < 6; i++) {
      const hexPart = hex.substr(i * 5, 5);
      const num = parseInt(hexPart, 16);
      result += chars[num % chars.length];
    }
    
    return result;
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setScanning(false);
    
    console.log('Scanned data:', data);
    
    // Handle different QR code formats
    let scannedCode = '';
    
    // Format 1: Direct connection code (6 alphanumeric characters)
    if (/^[A-Z0-9]{6}$/.test(data)) {
      scannedCode = data;
    }
    // Format 2: "phone:connectionCode" format
    else if (data.includes(':')) {
      const parts = data.split(':');
      if (parts.length === 2 && /^[A-Z0-9]{6}$/.test(parts[1])) {
        scannedCode = parts[1];
      }
    }
    // Format 3: Hexadecimal format (32 characters)
    else if (/^[A-Fa-f0-9]{32}$/.test(data)) {
      // Convert hex to 6-character alphanumeric code
      scannedCode = convertHexToCode(data);
    }
    // Format 4: JSON format with connection code
    else if (data.startsWith('{') && data.includes('connectionCode')) {
      try {
        const jsonData = JSON.parse(data);
        if (jsonData.connectionCode && /^[A-Z0-9]{6}$/.test(jsonData.connectionCode)) {
          scannedCode = jsonData.connectionCode;
        }
      } catch {
        console.log('Failed to parse JSON data');
      }
    }
    
    if (scannedCode) {
      setConnectionCode(scannedCode);
      Alert.alert(
        'QR Code Scanned Successfully!',
        `Connection code: ${scannedCode}\n\nYou can now connect your account.`,
        [
          {
            text: 'Connect Now',
            onPress: () => handleConnect(scannedCode),
          },
          {
            text: 'Edit Code',
            style: 'cancel',
            onPress: () => setScanned(false),
          },
        ]
      );
    } else {
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code does not contain a valid connection code.\n\nExpected formats:\n• 6-character alphanumeric code\n• Hex code (32 characters)\n• JSON with connectionCode field',
        [
          {
            text: 'Try Again',
            onPress: () => setScanned(false),
          },
          {
            text: 'Enter Manually',
            style: 'cancel',
            onPress: () => setScanning(false),
          },
        ]
      );
    }
  };

  const handleConnect = (code?: string) => {
    const codeToUse = code || connectionCode.trim();
    
    if (!codeToUse) {
      Alert.alert('Error', 'Please enter a connection code');
      return;
    }

    // Validate connection code format (6 alphanumeric characters)
    const codeRegex = /^[A-Z0-9]{6}$/;
    if (!codeRegex.test(codeToUse)) {
      Alert.alert('Error', 'Please enter a valid 6-digit alphanumeric connection code');
      return;
    }

    // Navigate directly to Fill Elder Details screen
    router.push({
      pathname: '/fillElderDetails',
      params: {
        connectionCode: codeToUse,
        isConnecting: 'true',
        role: 'elder',
      },
    });
  };

  const resetScanner = () => {
    setScanned(false);
    setScanning(false);
  };

  const handlePasteCode = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent && clipboardContent.trim()) {
        // Validate if the clipboard content looks like a connection code
        const codeRegex = /^[A-Z0-9]{6}$/;
        if (codeRegex.test(clipboardContent.trim())) {
          setConnectionCode(clipboardContent.trim());
          Alert.alert('Code Pasted', 'Connection code pasted from clipboard');
        } else {
          Alert.alert('Invalid Code', 'The clipboard content is not a valid connection code');
        }
      } else {
        Alert.alert('Empty Clipboard', 'No content found in clipboard');
      }
    } catch (error) {
      console.error('Failed to paste code:', error);
      Alert.alert('Paste Failed', 'Failed to paste code from clipboard');
    }
  };

  if (scanning && hasPermission) {
    return (
      <View style={styles.container}>
        <CameraComponent
          style={styles.camera}
          type={'back' as any}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame}>
              <View style={styles.corner} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.scannerText}>Position QR code within the frame</Text>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={resetScanner}
            >
              <Text style={styles.cancelButtonText}>Cancel Scan</Text>
            </TouchableOpacity>
          </View>
        </CameraComponent>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Requesting Camera Permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No Access to Camera</Text>
        <Text style={styles.subtitle}>
          Camera permission is required to scan QR codes. Please grant camera permission in your device settings.
        </Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Account</Text>
      
      <View style={styles.card}>
        <Text style={styles.subtitle}>
          Connect to an existing family member&apos;s account
        </Text>

        <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
          <Text style={styles.scanButtonText}>📱 Scan QR Code</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Enter Connection Code:</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={connectionCode}
              onChangeText={setConnectionCode}
              placeholder="Enter 6-digit code (e.g., ABC123)"
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity style={styles.pasteButton} onPress={handlePasteCode}>
              <Text style={styles.pasteButtonText}>📋 Paste</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.connectButton, !connectionCode.trim() && styles.disabledButton]} 
          onPress={() => handleConnect()}
          disabled={!connectionCode.trim()}
        >
          <Text style={styles.connectButtonText}>Connect Account</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Login</Text>
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
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
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
  },
  scanButton: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f5b4c6',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cc2b5e',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5b4c6',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  pasteButton: {
    backgroundColor: '#f5b4c6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
    borderLeftWidth: 1,
    borderLeftColor: '#f5b4c6',
  },
  pasteButtonText: {
    color: '#cc2b5e',
    fontSize: 14,
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#cc2b5e',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#cc2b5e',
    fontSize: 16,
    fontWeight: '600',
  },
  // Camera and scanner styles
  camera: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    marginBottom: 30,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#cc2b5e',
    borderWidth: 3,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  scannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  cancelButton: {
    backgroundColor: 'rgba(204, 43, 94, 0.9)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 
