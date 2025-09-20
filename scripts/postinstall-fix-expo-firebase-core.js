const fs = require('fs');
const path = require('path');

function patchExpoFirebaseCoreGradle() {
  try {
    const gradlePath = path.join(__dirname, '..', 'node_modules', 'expo-firebase-core', 'android', 'build.gradle');
    if (!fs.existsSync(gradlePath)) return;
    let gradle = fs.readFileSync(gradlePath, 'utf8');

    // Replace deprecated classifier usage with archiveClassifier.set for Gradle 7/8
    gradle = gradle.replace(
      /task\s+androidSourcesJar\(type:\s*Jar\)\s*\{[\s\S]*?\}/,
      `tasks.register('androidSourcesJar', Jar) {\n  archiveClassifier.set('sources')\n  from android.sourceSets.main.java.srcDirs\n}`
    );
    gradle = gradle.replace(
      /artifact\(androidSourcesJar\)/,
      "artifact(tasks.named('androidSourcesJar'))"
    );

    fs.writeFileSync(gradlePath, gradle, 'utf8');
    console.log('[postinstall] Patched expo-firebase-core/android/build.gradle for Gradle 8');
  } catch (e) {
    console.warn('[postinstall] Failed to patch expo-firebase-core Gradle script:', e.message);
  }
}

patchExpoFirebaseCoreGradle();
