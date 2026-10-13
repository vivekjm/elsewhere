import React from 'react';
import { useScreenProps } from '../../../src/navigation';
import { TripsScreen } from '../../../src/screens';

export default function TripsRoute() {
  const props = useScreenProps();
  if (!props) return null;
  return <TripsScreen {...props} />;
}
