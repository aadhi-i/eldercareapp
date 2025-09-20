import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const NativeFall = (NativeModules as any)?.FallDetection;

export const FallService = {
  start(enableBoot = true) {
    if (Platform.OS !== 'android' || !NativeFall?.start) return;
    try { NativeFall.start(!!enableBoot); } catch {}
  },
  stop() {
    if (Platform.OS !== 'android' || !NativeFall?.stop) return;
    try { NativeFall.stop(); } catch {}
  },
  addListener(cb: () => void) {
    if (Platform.OS !== 'android' || !NativeFall) return { remove: () => {} };
    const emitter = new NativeEventEmitter(NativeFall);
    const sub = emitter.addListener('fallDetected', cb);
    return { remove: () => sub.remove() };
  },
};
