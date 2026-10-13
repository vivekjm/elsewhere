import React from 'react';
import { useScreenProps } from '../../../src/navigation';
import { PlannerScreen } from '../../../src/screens';

export default function CalendarRoute() {
  const props = useScreenProps();
  if (!props) return null;
  return <PlannerScreen {...props} />;
}
