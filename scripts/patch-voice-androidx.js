const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'node_modules', '@react-native-voice', 'voice', 'android', 'build.gradle');

try {
  if (!fs.existsSync(gradlePath)) {
    console.log('[patch-voice-androidx] build.gradle not found, skipping');
    process.exit(0);
  }
  let content = fs.readFileSync(gradlePath, 'utf8');
  const before = 'implementation "com.android.support:appcompat-v7:${supportVersion}"';
  const after = 'implementation "androidx.appcompat:appcompat:1.6.1"';

  if (content.includes(after)) {
    console.log('[patch-voice-androidx] Already patched');
    process.exit(0);
  }

  if (!content.includes(before)) {
    console.log('[patch-voice-androidx] Expected dependency not found, skipping');
    process.exit(0);
  }

  content = content.replace(before, after);
  fs.writeFileSync(gradlePath, content, 'utf8');
  console.log('[patch-voice-androidx] Patched @react-native-voice/voice to use AndroidX appcompat');
} catch (e) {
  console.warn('[patch-voice-androidx] Failed to patch:', e.message);
  // Do not fail install
  process.exit(0);
}
