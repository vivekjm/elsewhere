/**
 * A map for planning, across the page: a day's stops numbered in order and joined by the route, or every place in a
 * plan. It isn't dragged; it frames what it shows and glides to the next day when that changes.
 */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type LngLatBounds } from '@maplibre/maplibre-react-native';
import { colors, radii, useMapStyle } from '../loom';

export type MapPin = {
  id: string; lat: number; lng: number; color: string;
  /** A number in the pin (a day's stops); none for a plain dot. */
  label?: string;
  /** Not chosen yet (an AI pick): an outline instead of a fill. */
  hollow?: boolean;
  /** Just changed: ringed. */
  ring?: boolean;
};

/** The box around the pins, widened a little when they're all in one spot. */
function boundsOf(pins: MapPin[]): LngLatBounds {
  const lats = pins.map((p) => p.lat), lngs = pins.map((p) => p.lng);
  let [w, s, e, n] = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  const pad = 0.006;
  if (e - w < pad) { w -= pad; e += pad; }
  if (n - s < pad) { s -= pad; n += pad; }
  return [w, s, e, n];
}

/**
 * The map as a tile: the warm dark map with square corners and a light edge, its pins in the kinds' colours and the
 * day's route as a dashed ink thread. `children`: a title under the map (shown on its own when there's nothing to map).
 * `flush`: sits straight on the tile below it (the day strip), as one mosaic.
 */
export function PlanMap({ pins, route, height = 200, label, flush, children }: { pins: MapPin[]; route?: boolean; height?: number; label: string; flush?: boolean; children?: React.ReactNode }) {
  const mapStyle = useMapStyle();
  const shown = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const key = shown.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  const bounds = useMemo(() => (shown.length ? boundsOf(shown) : null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!bounds) return children ? <View>{children}</View> : null;
  const line = route && shown.length > 1
    ? { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: shown.map((p) => [p.lng, p.lat]) } }
    : null;
  const points = {
    type: 'FeatureCollection' as const,
    features: shown.map((p, i) => ({ type: 'Feature' as const, properties: { color: p.color, label: p.label ?? '', big: !!p.label, hollow: !!p.hollow, ring: !!p.ring, order: shown.length - i },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] } })),
  };
  const padding = { top: 36, bottom: 36, left: 36, right: 36 };
  const map = <View style={{ height, borderRadius: radii.card, borderBottomLeftRadius: flush ? radii.check : radii.card, borderBottomRightRadius: flush ? radii.check : radii.card, overflow: 'hidden', backgroundColor: '#1a1814' }} accessibilityLabel={label}>
    <Map style={{ flex: 1 }} mapStyle={mapStyle as never} logo={false} attribution attributionPosition={{ top: 6, right: 8 }} tintColor={colors.inkFaint} compass={false}
      dragPan={false} touchZoom={false} doubleTapZoom={false} doubleTapHoldZoom={false} touchRotate={false} touchPitch={false}>
      <Camera initialViewState={{ bounds, padding }} bounds={bounds} padding={padding} maxZoom={15} duration={650} easing="ease" />
      {line ? <GeoJSONSource id="plan-route" data={line}>
        <Layer id="plan-route-line" type="line" paint={{ 'line-color': colors.ink, 'line-width': 1.5, 'line-dasharray': [2.5, 2], 'line-opacity': 0.9 }} layout={{ 'line-join': 'round' }} />
      </GeoJSONSource> : null}
      {/* Drawn by the map itself (not views on top), so pins added later appear at once. "1" sits above "2". */}
      <GeoJSONSource id="plan-pins" data={points}>
        <Layer id="plan-pin-ring" type="circle" filter={['==', ['get', 'ring'], true]} paint={{ 'circle-radius': 17, 'circle-color': 'rgba(0, 0, 0, 0)', 'circle-stroke-width': 2, 'circle-stroke-color': colors.sand }} />
        <Layer id="plan-pin" type="circle" layout={{ 'circle-sort-key': ['get', 'order'] }}
          paint={{ 'circle-radius': ['case', ['get', 'big'], 11, 6], 'circle-color': ['case', ['get', 'hollow'], colors.ground, ['get', 'color']], 'circle-stroke-width': ['case', ['get', 'hollow'], 1.5, 2], 'circle-stroke-color': ['case', ['get', 'hollow'], ['get', 'color'], colors.ground] }} />
        <Layer id="plan-pin-label" type="symbol" filter={['==', ['get', 'big'], true]}
          layout={{ 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true, 'symbol-sort-key': ['get', 'order'] }}
          paint={{ 'text-color': ['case', ['get', 'hollow'], ['get', 'color'], colors.onLight] }} />
      </GeoJSONSource>
    </Map>
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.card, borderBottomLeftRadius: flush ? radii.check : radii.card, borderBottomRightRadius: flush ? radii.check : radii.card, borderWidth: 1, borderColor: colors.hairline }} />
  </View>;
  return children ? <View style={{ gap: 16 }}>{map}{children}</View> : map;
}
