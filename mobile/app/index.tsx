import { Redirect } from 'expo-router';
import { DEV_START_ROUTE } from '../src/devStart';

export default function Index() {
  return <Redirect href={(__DEV__ && DEV_START_ROUTE ? DEV_START_ROUTE : '/home') as never} />;
}
