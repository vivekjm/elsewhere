import React from 'react';
import { useScreenProps } from '../../../src/navigation';
import { PackingScreen } from '../../../src/screens';

export default function PackingRoute() {
  const props = useScreenProps();
  if (!props) return null;
  return <PackingScreen {...props} />;
}
