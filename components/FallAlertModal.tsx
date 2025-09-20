import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';

type Props = {
  visible: boolean;
  onConfirmHelp: () => void;
  onCancel: () => void;
  countdownSec?: number;
};

export default function FallAlertModal({ visible, onConfirmHelp, onCancel, countdownSec = 12 }: Props) {
  const [remaining, setRemaining] = useState(countdownSec);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setRemaining(countdownSec);
    try { Speech.speak('Are you okay? Tap I am okay, or I need help. I will call your emergency contact if you do not respond.', { rate: 0.95 }); } catch {}
    Vibration.vibrate([300, 300, 300], false);

    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) {
          clearInterval(intervalRef.current!);
          onConfirmHelp();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      try { Speech.stop(); } catch {}
    };
  }, [visible, countdownSec]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Possible fall detected</Text>
          <Text style={styles.desc}>Are you okay? Calling help in {remaining}s.</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.ok]} onPress={onCancel}>
              <Text style={styles.btnText}>I am OK</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.help]} onPress={onConfirmHelp}>
              <Text style={styles.btnText}>I need help</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '86%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#cc2b5e',
    marginBottom: 8,
  },
  desc: {
    fontSize: 16,
    color: '#333',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ok: {
    backgroundColor: '#28a745',
    marginRight: 8,
  },
  help: {
    backgroundColor: '#dc3545',
    marginLeft: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
