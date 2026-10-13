import React from 'react';
import { Stack } from 'expo-router';
import { useStackOptions } from '../../../src/navigation';

export default function CalendarStack() {
  const options = useStackOptions();
  return <Stack screenOptions={options}><Stack.Screen name="index" options={{ title: 'Calendar' }} /></Stack>;
}
