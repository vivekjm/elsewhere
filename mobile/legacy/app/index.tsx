import { Redirect } from 'expo-router';

/** The app opens on the Calendar tab. */
export default function Index() {
  return <Redirect href="/calendar" />;
}
