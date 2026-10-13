import React from 'react';
import { useScreenProps } from '../../../src/navigation';
import { EssentialsScreen } from '../../../src/screens';

export default function EssentialsRoute() {
  const props = useScreenProps();
  if (!props) return null;
  return <EssentialsScreen {...props} />;
}
