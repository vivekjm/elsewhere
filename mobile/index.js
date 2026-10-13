// App entry: expo-router, plus the Android home-screen widget's headless task handler.
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/android');
  registerWidgetTaskHandler(widgetTaskHandler);
}
