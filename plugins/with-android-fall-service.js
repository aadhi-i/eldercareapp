// Local Expo config plugin to inject an Android Foreground Service, BOOT receiver,
// and a simple React Native native module for background fall detection.
// This JS version ensures Expo can resolve the plugin without TypeScript support at runtime.

const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_CLASS = 'FallDetectionService';
const MODULE_CLASS = 'FallDetectionModule';
const PACKAGE_CLASS = 'FallDetectionPackage';
const RECEIVER_CLASS = 'BootReceiver';

const FALL_NOTIFICATION_CHANNEL_ID = 'fall_detection_channel';

function getPackageName(androidPackage) {
  if (!androidPackage) throw new Error('Android package is required in app.json (expo.android.package)');
  return androidPackage;
}

const withForegroundServiceManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    const pkg = getPackageName(config.android?.package);
    const manifest = config.modResults;

    // Ensure tools namespace
    manifest.manifest.$ = manifest.manifest.$ || {};
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Ensure permissions
    const perms = [
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.FOREGROUND_SERVICE',
      // For Android 14+ specific typed services (dataSync)
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.WAKE_LOCK',
    ];
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
    for (const name of perms) {
      if (!manifest.manifest['uses-permission'].some((p) => p.$['android:name'] === name)) {
        manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    const app = AndroidConfig.Manifest.getMainApplication(manifest);
    if (!app) throw new Error('MainApplication not found in AndroidManifest');

    // Fix appComponentFactory conflict
    app.$ = app.$ || {};
    const replaceKey = 'tools:replace';
    const entry = 'android:appComponentFactory';
    if (!app.$[replaceKey]) {
      app.$[replaceKey] = entry;
    } else if (typeof app.$[replaceKey] === 'string' && !app.$[replaceKey].split(',').map((s) => s.trim()).includes(entry)) {
      app.$[replaceKey] = app.$[replaceKey] + `,${entry}`;
    }
    if (!app.$['android:appComponentFactory']) {
      app.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
    }

    // Service entry
    app.service = app.service || [];
    const serviceName = `${pkg}.${SERVICE_CLASS}`;
    if (!app.service.some((s) => s.$['android:name'] === serviceName)) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
        },
        'intent-filter': [
          { action: [{ $: { 'android:name': `${pkg}.ACTION_START_FALL_SERVICE` } }] },
        ],
      });
    }

    // Boot receiver
    app.receiver = app.receiver || [];
    const receiverName = `${pkg}.${RECEIVER_CLASS}`;
    if (!app.receiver.some((r) => r.$['android:name'] === receiverName)) {
      app.receiver.push({
        $: { 'android:name': receiverName, 'android:enabled': 'true', 'android:exported': 'true' },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }] },
        ],
      });
    }

    return config;
  });
};

const withNativeFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const androidRoot = cfg.modRequest.platformProjectRoot;
      const pkg = getPackageName(cfg.android?.package);
      const srcDir = path.join(androidRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      fs.mkdirSync(srcDir, { recursive: true });

      // Service code
      const servicePath = path.join(srcDir, `${SERVICE_CLASS}.kt`);
      const serviceCode = `package ${pkg}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat

class ${SERVICE_CLASS} : Service(), SensorEventListener {
  private lateinit var sensorManager: SensorManager
  private var lastSpikeTime: Long = 0

  override fun onCreate() {
    super.onCreate()
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    val gyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    accel?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    gyro?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    startInForeground()
  }

  private fun startInForeground() {
    val channelId = "${FALL_NOTIFICATION_CHANNEL_ID}"
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(channelId, "Fall Detection", NotificationManager.IMPORTANCE_LOW)
      nm.createNotificationChannel(channel)
    }
    val notif: Notification = NotificationCompat.Builder(this, channelId)
      .setContentTitle("Fall detection active")
      .setContentText("Monitoring for potential falls…")
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setOngoing(true)
      .build()
    startForeground(1337, notif)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Keep running until explicitly stopped
    return START_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    sensorManager.unregisterListener(this)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onSensorChanged(event: android.hardware.SensorEvent?) {
    if (event == null) return
    if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) {
      val ax = event.values[0]
      val ay = event.values[1]
      val az = event.values[2]
      val mag = Math.sqrt((ax*ax + ay*ay + az*az).toDouble())
      val now = SystemClock.elapsedRealtime()
      // very simple heuristic spike
      if (mag > 25 && now - lastSpikeTime > 4000) {
        lastSpikeTime = now
        notifyFallDetected()
      }
    }
  }

  private fun notifyFallDetected() {
    // Broadcast an intent that JS module can listen to
    val intent = Intent("${pkg}.FALL_DETECTED")
    sendBroadcast(intent)
  }
}
`;
      fs.writeFileSync(servicePath, serviceCode);

      // Boot receiver
      const receiverPath = path.join(srcDir, `${RECEIVER_CLASS}.kt`);
      const receiverCode = `package ${pkg}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ${RECEIVER_CLASS} : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      val prefs = context.getSharedPreferences("fall_prefs", Context.MODE_PRIVATE)
      if (prefs.getBoolean("enabled", false)) {
        context.startForegroundService(Intent(context, ${SERVICE_CLASS}::class.java))
      }
    }
  }
}
`;
      fs.writeFileSync(receiverPath, receiverCode);

      // RN module to start/stop service and emit events
      const modulePath = path.join(srcDir, `${MODULE_CLASS}.kt`);
      const moduleCode = `package ${pkg}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class ${MODULE_CLASS}(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  private val action = "${pkg}.FALL_DETECTED"
  private val receiver = object: BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("fallDetected", null)
    }
  }

  override fun getName(): String = "FallDetection"

  @ReactMethod
  fun start(enableBoot: Boolean) {
    val intent = Intent(ctx, ${SERVICE_CLASS}::class.java)
    ctx.startForegroundService(intent)
    if (enableBoot) ctx.getSharedPreferences("fall_prefs", Context.MODE_PRIVATE)
      .edit().putBoolean("enabled", true).apply()
    ctx.registerReceiver(receiver, IntentFilter(action))
  }

  @ReactMethod
  fun stop() {
    val intent = Intent(ctx, ${SERVICE_CLASS}::class.java)
    ctx.stopService(intent)
    ctx.getSharedPreferences("fall_prefs", Context.MODE_PRIVATE)
      .edit().putBoolean("enabled", false).apply()
    try { ctx.unregisterReceiver(receiver) } catch (_: Exception) {}
  }
}
`;
      fs.writeFileSync(modulePath, moduleCode);

      const packagePath = path.join(srcDir, `${PACKAGE_CLASS}.kt`);
      const packageCode = `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ${PACKAGE_CLASS} : ReactPackage {
  override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> = mutableListOf()
  override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> = mutableListOf(${MODULE_CLASS}(reactContext))
}
`;
      fs.writeFileSync(packagePath, packageCode);

      return cfg;
    },
  ]);
};

// We skip modifying MainApplication to register a package for compatibility with Expo managed apps.

const withGradle = (config) => withAppBuildGradle(config, (cfg) => {
  // Ensure Kotlin Android plugin is applied using modern id
  const contents = cfg.modResults.contents;
  const hasOld = contents.includes("id 'kotlin-android'") || contents.includes('id("kotlin-android")');
  const hasNew = contents.includes("id 'org.jetbrains.kotlin.android'") || contents.includes('id("org.jetbrains.kotlin.android")');
  if (!hasOld && !hasNew) {
    cfg.modResults.contents = contents.replace(
      /plugins\s*\{/,
      (m) => `${m}\n    id 'org.jetbrains.kotlin.android'\n`
    );
  }
  return cfg;
});

const withAndroidFallService = (config) => {
  config = withForegroundServiceManifest(config);
  config = withNativeFiles(config);
  config = withGradle(config);
  return config;
};

module.exports = withAndroidFallService;
