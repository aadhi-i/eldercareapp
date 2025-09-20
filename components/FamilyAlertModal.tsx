import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';

type Props = {
  visible: boolean;
  elderName?: string;
  onAcknowledge: () => void;
  onCall: () => void;
};

export default function FamilyAlertModal({ visible, elderName, onAcknowledge, onCall }: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
        setAudioReady(true);
      } catch {}
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    // Start repeating TTS + vibration as alarm
    const phrase = `Fall alert${elderName ? ' from ' + elderName : ''}. Tap acknowledge or call.`;
    try { Speech.speak(phrase, { rate: 0.9, pitch: 1.0 }); } catch {}
    Vibration.vibrate([500, 400, 500, 400], false);
    intervalRef.current = setInterval(() => {
      try { Speech.speak(phrase, { rate: 0.9, pitch: 1.0 }); } catch {}
      Vibration.vibrate([400, 300], false);
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      try { Speech.stop(); } catch {}
    };
  }, [visible, elderName, audioReady]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Fall Alert</Text>
          {!!elderName && <Text style={styles.desc}>From: {elderName}</Text>}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.bigBtn, styles.ack]} onPress={onAcknowledge}>
              <Text style={styles.bigBtnText}>Acknowledge</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bigBtn, styles.call]} onPress={onCall}>
              <Text style={styles.bigBtnText}>Call</Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '88%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#cc2b5e',
    marginBottom: 8,
  },
  desc: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  bigBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ack: {
    backgroundColor: '#28a745',
  },
  call: {
    backgroundColor: '#d63384',
  },
  bigBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
