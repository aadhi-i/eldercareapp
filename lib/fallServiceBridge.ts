import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const NativeFall = (NativeModules as any)?.FallDetection;

export const FallService = {
  start(enableBoot = true) {
    if (Platform.OS !== 'android') return;
    if (NativeFall?.start) {
      try { NativeFall.start(!!enableBoot); } catch {}
    }
  },
  stop() {
    if (Platform.OS !== 'android') return;
    if (NativeFall?.stop) {
      try { NativeFall.stop(); } catch {}
    }
  },
  addListener(cb: () => void) {
    if (Platform.OS !== 'android' || !NativeFall) return { remove: () => {} };
    try {
      const emitter = new NativeEventEmitter(NativeFall);
      const sub = emitter.addListener('fallDetected', cb);
      return { remove: () => sub.remove() };
    } catch {
      return { remove: () => {} };
    }
  },
};
