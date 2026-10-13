/**
 * react-native-android-widget brings androidx.work:work-runtime-ktx 2.7.1 while other modules use
 * work-runtime 2.8.1, which already contains the Kotlin extensions. Pinning the ktx artifact to the same
 * version removes the duplicate classes that fail the Android build.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const LINE = '    implementation("androidx.work:work-runtime-ktx:2.8.1") // aligned with work-runtime (withWorkRuntimeFix)';

module.exports = function withWorkRuntimeFix(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('withWorkRuntimeFix')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(/dependencies\s*\{/, (m) => `${m}\n${LINE}`);
    }
    return cfg;
  });
};
