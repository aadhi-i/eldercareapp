import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';

type FallDetectionOptions = {
  onFall: () => void;
  intervalMs?: number; // sampling interval
  graceMs?: number;    // refractory period after a detected fall
};

// Simple heuristic fall detector (foreground):
// - Look for a spike in acceleration magnitude (> gSpike), followed by low acceleration (free-fall) and then a high jerk/rotation.
// - Uses moving window stats to reduce false positives (sitting down, phone drop) but won’t be perfect.
// Notes:
// - For production-grade ML, train a small embedded model (e.g., TensorFlow Lite) on labeled motion sequences and run it here.
export function useFallDetection({ onFall, intervalMs = 50, graceMs = 15000 }: FallDetectionOptions) {
  const [enabled, setEnabled] = useState(false);
  const lastFallAtRef = useRef<number>(0);
  const bufferRef = useRef<Array<{ t: number; acc: number; rot: number }>>([]);

  // Tunable thresholds
  const g = 9.80665; // m/s^2
  const gSpike = 2.2 * g; // spike threshold
  const lowAcc = 0.35 * g; // free-fall-ish low
  const rotSpike = 3.0; // rad/s rotation rate spike
  const jerkSpike = 25; // m/s^3 derived jerk threshold

  const checkFallPattern = useCallback(() => {
    const buf = bufferRef.current;
    if (buf.length < 8) return false;

    // Look at last ~0.8s window (depends on intervalMs)
    const now = Date.now();
    const windowMs = 800;
    const window = buf.filter((x) => now - x.t <= windowMs);
    if (window.length < 6) return false;

    let sawSpike = false;
    let sawLowAcc = false;
    let sawRot = false;
    let sawJerk = false;

    // crude jerk estimate
    for (let i = 1; i < window.length; i++) {
      const aPrev = window[i - 1].acc;
      const a = window[i].acc;
      const dt = (window[i].t - window[i - 1].t) / 1000;
      if (dt > 0) {
        const jerk = Math.abs((a - aPrev) / dt);
        if (jerk > jerkSpike) sawJerk = true;
      }
    }

    for (const s of window) {
      if (s.acc > gSpike) sawSpike = true;
      if (s.acc < lowAcc) sawLowAcc = true;
      if (s.rot > rotSpike) sawRot = true;
    }

    // Require a combination to reduce false positives
    return (sawSpike && sawLowAcc && (sawRot || sawJerk));
  }, [gSpike, lowAcc, rotSpike, jerkSpike]);

  useEffect(() => {
    if (!enabled) {
      DeviceMotion.removeAllListeners();
      return;
    }

    DeviceMotion.setUpdateInterval(intervalMs);
  const sub = DeviceMotion.addListener((data: DeviceMotionMeasurement) => {
      const t = Date.now();
      const acc = Math.sqrt(
        Math.pow(data.accelerationIncludingGravity?.x ?? 0, 2) +
        Math.pow(data.accelerationIncludingGravity?.y ?? 0, 2) +
        Math.pow(data.accelerationIncludingGravity?.z ?? 0, 2)
      );
      const rot = Math.sqrt(
        Math.pow(data.rotation?.alpha ?? 0, 2) +
        Math.pow(data.rotation?.beta ?? 0, 2) +
        Math.pow(data.rotation?.gamma ?? 0, 2)
      );

      const buf = bufferRef.current;
      buf.push({ t, acc, rot });
      // keep ~2 seconds
      const cutoff = t - 2000;
      while (buf.length && buf[0].t < cutoff) buf.shift();

      const sinceLastFall = t - (lastFallAtRef.current || 0);
      if (sinceLastFall < graceMs) return;

      if (checkFallPattern()) {
        lastFallAtRef.current = t;
        onFall();
      }
    });

    return () => {
      sub && sub.remove();
    };
  }, [enabled, intervalMs, graceMs, onFall, checkFallPattern]);

  const enable = useCallback(() => setEnabled(true), []);
  const disable = useCallback(() => setEnabled(false), []);

  return { enabled, enable, disable };
}

export default useFallDetection;