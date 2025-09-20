import { Ionicons } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { default as React, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../components/AuthProvider';
import DrawerLayout from '../components/DrawerLayout';
import { auth, db } from '../lib/firebaseConfig';

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [familyData, setFamilyData] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [listening, setListening] = useState(false);
  const [sttStatus, setSttStatus] = useState<string>('');
  const recognizingRef = useRef(false);

  // Animated values for Gemini-like activation effect
  const glow = useRef(new Animated.Value(0)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  const flow = useRef(new Animated.Value(0)).current;
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const rippleLoopsRef = useRef<Animated.CompositeAnimation[]>([]);
  const flowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Wait until auth is ready
        if (authLoading) return;
        
        const usersRef = collection(db, 'users');
        let currentUserData: any | null = null;

        // If user is authenticated, try to find their data
        if (auth.currentUser) {
          const uid = auth.currentUser.uid;
          const phoneNumber = auth.currentUser.phoneNumber || '';

          // 1) Try by doc id (uid)
          const byIdSnap = await getDoc(doc(usersRef, uid));
          if (byIdSnap.exists()) {
            currentUserData = byIdSnap.data();
          }

          // 2) Try by uid field
          if (!currentUserData) {
            const byUidSnap = await getDocs(query(usersRef, where('uid', '==', uid)));
            if (!byUidSnap.empty) currentUserData = byUidSnap.docs[0].data();
          }

          // 3) Try by phone variants
          if (!currentUserData && phoneNumber) {
            const exact = await getDocs(query(usersRef, where('phone', '==', phoneNumber)));
            if (!exact.empty) currentUserData = exact.docs[0].data();

            if (!currentUserData) {
              const digits = String(phoneNumber).replace(/\D/g, '');
              const last10 = digits.slice(-10);
              if (last10) {
                const byLast10 = await getDocs(query(usersRef, where('phone', '==', last10)));
                if (!byLast10.empty) currentUserData = byLast10.docs[0].data();

                if (!currentUserData && /^\d{10}$/.test(last10)) {
                  const byNum = await getDocs(query(usersRef, where('phone', '==', Number(last10) as any)));
                  if (!byNum.empty) currentUserData = byNum.docs[0].data();
                }
              }
            }
          }
        }

        // If no authenticated user or no data found, try to find the most recent elder data
        // This handles the case where elder was saved without authentication
        if (!currentUserData) {
          const elderQuery = query(usersRef, where('role', '==', 'elder'));
          const elderSnapshot = await getDocs(elderQuery);
          
          if (!elderSnapshot.empty) {
            // Get the most recently created elder (by createdAt timestamp)
            const elders: any[] = elderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sortedElders = elders.sort((a, b) => {
              const aTime = a.createdAt?.toDate?.() || new Date(0);
              const bTime = b.createdAt?.toDate?.() || new Date(0);
              return bTime.getTime() - aTime.getTime();
            });
            
            currentUserData = sortedElders[0];
          }
        }

        if (currentUserData) {
          setUserData(currentUserData);

          // If user is an elder, fetch connected family member's data and their meds/routines
          if (currentUserData.role === 'elder' && currentUserData.connectedTo) {
            const familyDocRef = doc(usersRef, currentUserData.connectedTo);
            const familyDoc = await getDoc(familyDocRef);
            if (familyDoc.exists()) setFamilyData(familyDoc.data());

            const medsRef = collection(db, 'medicines');
            const medsSnap = await getDocs(query(medsRef, where('uid', '==', currentUserData.connectedTo)));
            setMedications(medsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

            const routinesRef = collection(db, 'dailyRoutines');
            const routinesSnap = await getDocs(query(routinesRef, where('uid', '==', currentUserData.connectedTo)));
            setRoutines(routinesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
          }
        } else {
          // No user data found; show empty state gracefully
          setUserData(null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [authLoading, user?.uid]);

  // Voice assistant activation animations
  useEffect(() => {
    const startAnimations = () => {
      glowLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(glow, { toValue: 0, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        ])
      );
      glowLoopRef.current.start();

      const mkRipple = (val: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
            Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );

      rippleLoopsRef.current = [mkRipple(ripple1, 0), mkRipple(ripple2, 400), mkRipple(ripple3, 800)];
      rippleLoopsRef.current.forEach((loop) => loop.start());

      flowLoopRef.current = Animated.loop(
        Animated.timing(flow, { toValue: 1, duration: 6000, useNativeDriver: true, easing: Easing.linear })
      );
      flowLoopRef.current.start();
    };

    const stopAnimations = () => {
      glowLoopRef.current?.stop?.();
      rippleLoopsRef.current.forEach((loop) => loop.stop());
      glow.setValue(0);
      ripple1.setValue(0);
      ripple2.setValue(0);
      ripple3.setValue(0);
      flowLoopRef.current?.stop?.();
      flow.setValue(0);
    };

    if (voiceActive) startAnimations();
    else stopAnimations();

    return () => {
      // Cleanup on unmount
      glowLoopRef.current?.stop?.();
      rippleLoopsRef.current.forEach((loop) => loop.stop());
    };
  }, [voiceActive, glow, ripple1, ripple2, ripple3]);

  // Setup speech recognition listeners
  useEffect(() => {
    Voice.onSpeechResults = (e: any) => {
      const text = (e?.value?.[0] || '').toLowerCase();
      if (!text) return;
      setTranscript(text);
      handleVoiceCommand(text);
    };
    Voice.onSpeechPartialResults = (e: any) => {
      const text = (e?.value?.[0] || '').toLowerCase();
      if (!text) return;
      setTranscript(text);
    };
    Voice.onSpeechStart = () => { setListening(true); setSttStatus('Listening…'); };
    Voice.onSpeechEnd = async () => {
      setListening(false);
      setSttStatus('');
      // Auto-restart to keep listening continuously
      if (voiceActive) {
        setTimeout(async () => {
          try {
            // Avoid capturing our own TTS
            const speaking = await (Speech as any).isSpeakingAsync?.();
            if (!speaking) await startListening();
          } catch {}
        }, 250);
      }
    };
    Voice.onSpeechError = (e: any) => {
      setListening(false);
      setSttStatus('Speech error. Trying again…');
      if (voiceActive) {
        setTimeout(() => { startListening(); }, 400);
      }
    };

    return () => {
      Voice.destroy().catch(() => {});
      Voice.removeAllListeners();
    };
  }, []);

  // Start listening with availability and permission checks
  const startListening = async () => {
    try {
      const available = (await (Voice as any).isAvailable?.()) as any;
      if (available === false || available === 0 || available == null) {
        const msg = 'Speech recognition is unavailable here. Use a development build (not Expo Go).';
        setSttStatus(msg);
        try { Speech.speak("Sorry, listening isn't available in this build.", { rate: 0.95, pitch: 1.0 }); } catch {}
        return;
      }
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setSttStatus('Microphone permission denied.');
          try { Speech.speak('Microphone permission is required to listen.', { rate: 0.95, pitch: 1.0 }); } catch {}
          return;
        }
      }
      const locale = Platform.select({ ios: 'en-US', android: 'en-US', default: 'en-US' })!;
      recognizingRef.current = true;
      setSttStatus('Starting listener…');
      await Voice.start(locale);
    } catch (err) {
      recognizingRef.current = false;
      setSttStatus('Unable to start listening.');
      try { Speech.speak('Unable to start listening right now.', { rate: 0.95, pitch: 1.0 }); } catch {}
    }
  };

  // Format helper
  const formatTime = (t: any) => `${String(t?.hour ?? '').padStart(2, '0')}:${String(t?.minute ?? '').padStart(2, '0')} ${t?.period ?? ''}`;
  // Assistant: build a short, friendly, context-aware message
  const buildAssistantMessage = () => {
    const parts: string[] = [];
    // Personal meds (elder)
    if (userData?.medicines && Array.isArray(userData.medicines) && userData.medicines.length > 0) {
      const top = userData.medicines.slice(0, 3).map((m: any) => {
        const timesStr = Array.isArray(m.timings) ? m.timings.join(', ') : '';
        return `${m.name ?? ''}${m.dosage ? `, ${m.dosage}` : ''}${timesStr ? ` at ${timesStr}` : ''}`;
      }).filter(Boolean);
      if (top.length) parts.push(`Your medicines: ${top.join('; ')}.`);
    }
    // Family meds summary (scheduled by family)
    if (medications && medications.length > 0) {
      const first = medications.slice(0, 3).map((m: any) => {
        const timesArr = Array.isArray(m.times) ? m.times : [];
        const timesStr = timesArr.map((t: any) => formatTime(t)).join(', ');
        return `${m.name ?? ''}${m.dosage ? `, ${m.dosage}` : ''}${timesStr ? ` at ${timesStr}` : ''}`;
      }).filter(Boolean);
      if (first.length) parts.push(`Scheduled by family: ${first.join('; ')}.`);
    }
    // Routines summary
    if (routines && routines.length > 0) {
      const first = routines.slice(0, 3).map((r: any) => {
        const timesArr = Array.isArray(r.times) ? r.times : [];
        const timesStr = timesArr.map((t: any) => formatTime(t)).join(', ');
        return `${r.title ?? ''}${timesStr ? ` at ${timesStr}` : ''}`;
      }).filter(Boolean);
      if (first.length) parts.push(`Today's routines: ${first.join('; ')}.`);
    }
    // Stock info (placeholder if not available)
    parts.push('Medicine stock status is available in the app.');
    // Motivation
    const motivations = [
      'You are doing great. Keep moving forward, one step at a time.',
      'Remember to stay hydrated and smile today.',
      'Small steps make big changes. I believe in you.',
    ];
    parts.push(motivations[Math.floor(Math.random() * motivations.length)]);
    return parts.join(' ');
  };

  // When activating/deactivating, speak or stop speaking
  const handleToggleAssistant = () => {
    setVoiceActive((v) => {
      const next = !v;
      if (next) {
        setTranscript('');
        const greet = 'hello, how can i help you today?';
        Speech.speak(greet, { rate: 0.95, pitch: 1.0 });
        if (!recognizingRef.current) {
          setTimeout(async () => {
            await startListening();
          }, 900);
        }
      } else {
        Speech.stop();
        setTranscript('');
        setSttStatus('');
        if (recognizingRef.current) {
          Voice.stop().catch(() => {});
          recognizingRef.current = false;
        }
      }
      return next;
    });
  };

  // Parse recognized text into simple intents and respond via TTS
  const handleVoiceCommand = (text: string) => {
    const isMedicinesNow = /(what|which).*(medicine|medicines).*(now|currently|this time)/i.test(text) || /medicine.*now/i.test(text);
    const isAllMedicines = /(list|what).*(medicine|medicines)/i.test(text);
    const isRoutines = /(what|list).*(routine|routines)/i.test(text);
    const isStock = /(medicine|medicin).*stock/i.test(text);
    const isMotivate = /(motivate|motivation|inspire|encourage)/i.test(text);
    const isSummary = /(summary|summarize|overview|what's going on|tell me everything|quick update|give me an update)/i.test(text);

    if (isMedicinesNow || isAllMedicines) {
      const parts: string[] = [];
      if (userData?.medicines && userData.medicines.length) {
        const top = userData.medicines.slice(0, 5).map((m: any) => {
          const times = Array.isArray(m.timings) ? m.timings.join(', ') : '';
          return `${m.name ?? ''}${m.dosage ? `, ${m.dosage}` : ''}${times ? ` at ${times}` : ''}`;
        });
        parts.push(`Your medicines: ${top.join('; ')}.`);
      }
      if (medications && medications.length) {
        const top = medications.slice(0, 5).map((m: any) => {
          const timesArr = Array.isArray(m.times) ? m.times : [];
          const timesStr = timesArr.map((t: any) => formatTime(t)).join(', ');
          return `${m.name ?? ''}${m.dosage ? `, ${m.dosage}` : ''}${timesStr ? ` at ${timesStr}` : ''}`;
        });
        parts.push(`Scheduled by family: ${top.join('; ')}.`);
      }
      const reply = parts.join(' ') || 'No medicines found right now.';
      Speech.speak(reply, { rate: 0.95, pitch: 1.0 });
      return;
    }

    if (isRoutines) {
      const parts: string[] = [];
      if (routines && routines.length) {
        const top = routines.slice(0, 5).map((r: any) => {
          const timesArr = Array.isArray(r.times) ? r.times : [];
          const timesStr = timesArr.map((t: any) => formatTime(t)).join(', ');
          return `${r.title ?? ''}${timesStr ? ` at ${timesStr}` : ''}`;
        });
        parts.push(`Routines: ${top.join('; ')}.`);
      }
      const reply = parts.join(' ') || 'No routines found.';
      Speech.speak(reply, { rate: 0.95, pitch: 1.0 });
      return;
    }

    if (isStock) {
      Speech.speak('Medicine stock status is available in the app. Please check the medicines stock section.', { rate: 0.95, pitch: 1.0 });
      return;
    }

    if (isMotivate) {
      const motivations = [
        'You are doing great. Keep moving forward, one step at a time.',
        'Remember to stay hydrated and smile today.',
        'Small steps make big changes. I believe in you.',
      ];
      Speech.speak(motivations[Math.floor(Math.random() * motivations.length)], { rate: 0.95, pitch: 1.0 });
      return;
    }

    if (isSummary) {
      Speech.speak(buildAssistantMessage(), { rate: 0.95, pitch: 1.0 });
      return;
    }

    // Neutral fallback guidance
    Speech.speak('I can help with your medicines, routines, medicine stock note, or a quick summary. What would you like to know?', { rate: 0.95, pitch: 1.0 });
  };

  // Format phone number with country code
  const formatPhoneWithCountryCode = (phone: string) => {
    if (!phone) return '';
    // Add +91 (India) country code if not already present
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('91')) return `+${phone}`;
    return `+91 ${phone}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#d63384" />
      </View>
    );
  }

  return (
    <DrawerLayout>
  <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 140 }]}>
        {/* Profile Info Card */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Profile Information</Text>
          <Text style={styles.cardContent}>
            • Name: {userData?.firstName} {userData?.lastName}
            {"\n"}• Age: {userData?.age || 'Not specified'}
            {"\n"}• Phone: {userData?.phone ? formatPhoneWithCountryCode(userData.phone) : 'Not specified'}
            {"\n"}• Address: {userData?.address || 'Not specified'}
            {"\n"}• Health Status: {userData?.healthStatus || 'Not specified'}
            {"\n"}• Medical Conditions: {userData?.illnesses || 'None specified'}
          </Text>
        </View>

        {/* Emergency Contact - Disabled Input */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>
          <Text style={styles.inputLabel}>Phone Number:</Text>
          <TextInput
            style={styles.disabledInput}
            value={formatPhoneWithCountryCode(userData?.emergencyContact || '')}
            editable={false}
            placeholder="No emergency contact available"
          />
          <Text style={styles.inputNote}>
            This is your emergency contact number. Contact admin to update.
          </Text>
        </View>

        {/* Family Member Info */}
        {familyData && (
          <View style={styles.cardWhite}>
            <Text style={styles.cardTitle}>Family Member Contact</Text>
            <Text style={styles.inputLabel}>Family Member's Phone Number:</Text>
            <TextInput
              style={styles.disabledInput}
              value={formatPhoneWithCountryCode(familyData?.phone || '')}
              editable={false}
              placeholder="No contact available"
            />
            <Text style={styles.inputNote}>
              This is your connected family member's phone number for emergencies.
            </Text>
            <Text style={[styles.cardContent, { marginTop: 10 }]}>
              • Name: {familyData?.firstName} {familyData?.lastName}
            </Text>
          </View>
        )}

        {/* Elder's Personal Medicines */}
        {userData?.medicines && userData.medicines.length > 0 && (
          <View style={styles.cardWhite}>
            <Text style={styles.cardTitle}>Personal Medications</Text>
            <Text style={styles.cardContent}>
              {userData.medicines
                .map((m: any) => {
                  const timesStr = Array.isArray(m.timings) ? m.timings.join(', ') : '';
                  return `• ${m.name ?? ''} — ${m.dosage ?? ''}${timesStr ? ` — ${timesStr}` : ''}`;
                })
                .join('\n')}
            </Text>
          </View>
        )}

        {/* Medicines Card (from family member account) */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Family Member's Medications</Text>
          <Text style={styles.cardContent}>
            {medications && medications.length > 0
              ? medications
                  .map((m: any) => {
                    const timesArr = Array.isArray(m.times) ? m.times : [];
                    const timesStr = timesArr.map((t: any) => formatTime(t)).join(', ');
                    return `• ${m.name ?? ''} — ${m.dosage ?? ''}${timesStr ? ` — ${timesStr}` : ''}`;
                  })
                  .join('\n')
              : 'No medications scheduled by family member'}
          </Text>
        </View>

        {/* Daily Routine Card (from family member account) */}
        <View style={styles.cardWhite}>
          <Text style={styles.cardTitle}>Daily Routines</Text>
          <Text style={styles.cardContent}>
            {routines && routines.length > 0
              ? routines
                  .map((r: any) => {
                    const timesArr = Array.isArray(r.times) ? r.times : [];
                    const timesStr = timesArr.map((t: any) => formatTime(t)).join(', ');
                    return `• ${r.title ?? ''}${timesStr ? ` — ${timesStr}` : ''}`;
                  })
                  .join('\n')
              : 'No routines scheduled'}
          </Text>
        </View>
      </ScrollView>

      {/* Voice activation overlay: Fullscreen blur + flowing gradient + ripples/glow */}
      {voiceActive && (
        <>
          {/* Blur overlay covering entire screen (doesn't block touches) */}
          <BlurView intensity={55} tint="light" style={styles.blurOverlay} pointerEvents="none" />

          {/* Flowing gradient layer */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flowLayer,
              {
                transform: [
                  {
                    translateX: flow.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(204, 43, 94, 0.10)',
                'rgba(255, 175, 189, 0.22)',
                'rgba(204, 43, 94, 0.10)'
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.flowGradient}
            />
          </Animated.View>

          <View style={styles.voiceOverlay} pointerEvents="none">
            <View style={styles.voiceOverlayCenter}>
            {/* Ripples */}
            <Animated.View
              style={[
                styles.ripple,
                {
                  transform: [
                    {
                      scale: ripple1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }),
                    },
                  ],
                  opacity: ripple1.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ripple,
                {
                  transform: [
                    {
                      scale: ripple2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }),
                    },
                  ],
                  opacity: ripple2.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ripple,
                {
                  transform: [
                    {
                      scale: ripple3.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }),
                    },
                  ],
                  opacity: ripple3.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                },
              ]}
            />

            {/* Breathing glow behind FAB */}
            <Animated.View
              style={[
                styles.glow,
                {
                  transform: [
                    {
                      scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
                    },
                  ],
                },
              ]}
            />
            </View>
          </View>
        </>
      )}

      {/* On-screen captions of recognized speech (above FAB) */}
      {voiceActive && !!transcript && (
        <View style={styles.captionContainer} pointerEvents="none">
          <Text style={styles.captionText} numberOfLines={3}>{transcript}</Text>
        </View>
      )}

      {voiceActive && !!sttStatus && (
        <View style={styles.statusContainer} pointerEvents="none">
          <Text style={styles.statusText}>{sttStatus}</Text>
        </View>
      )}

      {/* Centered bottom floating mic button for voice assistant */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.fabButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Voice assistant"
          onPress={handleToggleAssistant}
        >
          <Ionicons name="mic" size={40} color="#fff" />
        </TouchableOpacity>
      </View>
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  topBar: {
    marginBottom: 20,
  },
  cardWhite: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { fontSize: 16, color: '#333', flex: 1 },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#666',
  },
  inputNote: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Drawer-related styles moved into DrawerLayout
  fabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#cc2b5e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  // Voice activation overlay and effects
  voiceOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  voiceOverlayCenter: {
    position: 'absolute',
    bottom: 0,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#cc2b5e',
    opacity: 0.25,
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#cc2b5e',
    shadowColor: '#cc2b5e',
    shadowOpacity: 0.8,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0.6,
  },
  // Fullscreen blur and flowing gradient
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flowLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flowGradient: {
    position: 'absolute',
    top: 0,
    left: -120,
    right: -120,
    bottom: 0,
  },
  captionContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 122,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  captionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  statusContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 216,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },
});
