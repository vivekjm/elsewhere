/**
 * A trip's cover: the person's own photo when they've added one, otherwise the illustration for the trip's mood.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useWorkspace, type Trip, type TripExtras } from '../data';
import { coverOf } from '../domain/trips';
import { Backdrop, Illustration, PHOTOS, type IllustrationName } from '../loom';

type Size = number | `${number}%`;

export function CoverImage({ trip, extras, art, width = '100%', height = '100%', radius = 0 }: {
  trip: Pick<Trip, 'theme'>; extras?: Pick<TripExtras, 'cover'>; art?: IllustrationName; width?: Size; height?: Size; radius?: number;
}) {
  const { photoSource } = useWorkspace();
  const [failed, setFailed] = useState('');
  const path = extras?.cover ?? '';
  let source: ReturnType<typeof photoSource> | null = null;
  if (path && failed !== path) { try { source = photoSource(path); } catch { source = null; } }
  // While a photo loads (or if it can't), the illustration underneath keeps the space from flashing empty.
  return <View style={{ width, height, borderRadius: radius, overflow: 'hidden' }}>
    <Illustration name={art ?? coverOf(trip)} width="100%" height="100%" />
    {source ? <Image source={source} resizeMode="cover" style={StyleSheet.absoluteFill} onError={() => setFailed(path)} accessibilityIgnoresInvertColors /> : null}
  </View>;
}

/**
 * A trip's photo behind its hero: the person's own cover, else the brand photo that fits the trip's mood (the
 * coast for sea trips, the mountains for the rest). Toned and veiled like every photo, filling its parent.
 */
export function TripPhoto({ trip, extras }: { trip: Pick<Trip, 'theme'>; extras?: Pick<TripExtras, 'cover'> }) {
  const { photoSource } = useWorkspace();
  const [failed, setFailed] = useState('');
  const path = extras?.cover ?? '';
  let source: ReturnType<typeof photoSource> | null = null;
  if (path && failed !== path) { try { source = photoSource(path); } catch { source = null; } }
  const sea = ['coast', 'island', 'lake'].includes(trip.theme ?? '');
  return <Backdrop source={source ?? (sea ? PHOTOS.coast : PHOTOS.sikkim)} onError={source ? () => setFailed(path) : undefined} />;
}
