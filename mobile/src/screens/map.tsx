/**
 * Trip map (Wanderlog-style) with offline download, journal check-ins (Polarsteps-style) and live flight
 * status (TripIt-style). Maps: MapLibre with OpenFreeMap vector tiles, both free with no API key.
 * Map data © OpenStreetMap contributors; the attribution button stays on.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Camera, GeoJSONSource, Layer, Map, Marker, OfflineManager, type CameraRef, type OfflinePack } from '@maplibre/maplibre-react-native';
import { useRouter } from '../core/nav';
import { reportError, useCurrentTrip, useTrips } from '../core/state';
import { tripDates, uid, type Activity } from '../data';
import { clockTime, localDay, longDay, shortDay, weekday } from '../domain/format';
import { plansOn, sortPlans } from '../domain/trips';
import { Button, Card, colors, EmptyState, fonts, Header, HScroll, Icon, Loading, Note, Pill, radii, RowView, Screen, shadows, Stack, T, tints } from '../loom';
import { bearing, flightStatus, parseFlightNumber, type FlightStatus } from '../services/flights';
import { boundsOf, currentPosition, distanceKm, geocodePlace, placeName, type LatLng } from '../services/geo';
import { lookup } from '../services/places';
import { openRoute } from '../services/maps';
import { NoTrip } from './trip';

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const PACK_PREFIX = 'trip-';

/* ------------------------------------------------------------------ geocoding */

/** Finds coordinates for plans that have a place but no saved position, and stores them on the trip. */
function useLocatePlans() {
  const current = useCurrentTrip();
  const [busy, setBusy] = useState(false);
  const trip = current?.trip;
  const places = current?.extras.places;
  const missing = useMemo(() => (trip?.activities ?? []).filter((a) => a.place.trim() && places?.[a.id]?.query !== placeQuery(a, trip?.destination ?? '')), [trip, places]);
  useEffect(() => {
    if (!current || !missing.length || busy) return;
    let active = true;
    setBusy(true);
    void (async () => {
      const city = current.trip.destination.split(',')[0].trim();
      const found: Record<string, { lat: number; lng: number; query: string }> = {};
      for (const a of missing.slice(0, 25)) {
        const hit = await geocodePlace(a.place, city).catch(() => null);
        if (hit) found[a.id] = { ...hit, query: placeQuery(a, current.trip.destination) };
      }
      if (active && Object.keys(found).length) current.editExtras((d) => { Object.assign(d.places, found); });
      if (active) setBusy(false);
    })();
    return () => { active = false; };
  }, [missing.map((a) => a.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return busy;
}
/** What a saved position was found for; the version makes every plan look itself up again when the rules change. */
const placeQuery = (a: Activity, destination: string) => `v2|${a.place.trim()}|${destination.split(',')[0].trim()}`;

/* ------------------------------------------------------------------ trip map */

function Pin({ label, color }: { label: string; color: string }) {
  return <View style={{ minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 14, backgroundColor: color, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: shadows.button }}>
    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' }}>{label}</Text>
  </View>;
}

export function TripMapScreen() {
  const current = useCurrentTrip();
  const { status } = useTrips();
  const router = useRouter();
  const camera = useRef<CameraRef>(null);
  const locating = useLocatePlans();
  const dates = current ? tripDates(current.trip) : [];
  const [day, setDay] = useState<string | null>(null);
  const [pack, setPack] = useState<{ state: 'none' | 'downloading' | 'saved'; percent: number; mb: number }>({ state: 'none', percent: 0, mb: 0 });
  const [checking, setChecking] = useState(false);
  const tripId = current?.trip.id ?? '';
  // The destination itself, so the map opens on the city even before any plan has a place.
  const [home, setHome] = useState<LatLng | null>(null);
  const destination = current?.trip.destination ?? '';
  useEffect(() => {
    let active = true;
    if (destination) void lookup(destination).then((p) => { if (active && p) setHome({ lat: p.latitude, lng: p.longitude }); }).catch(() => {});
    return () => { active = false; };
  }, [destination]);

  // Offline pack status for this trip.
  useEffect(() => {
    if (!tripId) return;
    let active = true;
    void OfflineManager.getPack(`${PACK_PREFIX}${tripId}`).then(async (p) => {
      if (!p || !active) return;
      const s = await p.status();
      if (active) setPack({ state: s.state === 'complete' ? 'saved' : 'downloading', percent: Math.round(s.percentage), mb: s.completedResourceSize / 1e6 });
    }).catch(() => {});
    return () => { active = false; };
  }, [tripId]);

  const stops = useMemo(() => {
    if (!current) return [];
    const plans = day ? plansOn(current.trip, day) : sortPlans(current.trip.activities).sort((a, b) => a.date.localeCompare(b.date));
    return plans.map((a) => ({ a, at: current.extras.places[a.id] })).filter((x): x is { a: Activity; at: { lat: number; lng: number; query: string } } => !!x.at && !!x.a.place.trim());
  }, [current, day]);
  const steps = useMemo(() => (current?.extras.journal ?? []).filter((s) => !day || localDay(s.at) === day), [current, day]);
  const points: LatLng[] = [...stops.map((s) => s.at), ...steps];
  const bounds = boundsOf(points, 0.6) ?? (home ? boundsOf([home], 3) : null);
  const boundsKey = bounds?.map((n) => n.toFixed(4)).join(',');
  // Fit only once the map has loaded and has a size; fitting earlier fails ("padding greater than map").
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (bounds && loaded) camera.current?.fitBounds(bounds, { padding: { top: 48, bottom: 48, left: 32, right: 32 }, duration: 600 });
  }, [boundsKey, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveOffline = useCallback(async () => {
    if (!current) return;
    // The whole trip area (every located plan and check-in, plus the city around it), zoom 10–15.
    const all: LatLng[] = [...Object.values(current.extras.places), ...current.extras.journal, ...(home ? [home] : [])];
    const area = boundsOf(all, 6);
    if (!area) { Alert.alert('Couldn’t find the area', 'Check your connection, or add places to your plans first.'); return; }
    setPack({ state: 'downloading', percent: 0, mb: 0 });
    try {
      await OfflineManager.deletePack(`${PACK_PREFIX}${current.trip.id}`).catch(() => {});
      await OfflineManager.createPack(
        { mapStyle: MAP_STYLE, bounds: area, minZoom: 10, maxZoom: 15, metadata: { id: `${PACK_PREFIX}${current.trip.id}`, name: current.trip.name } },
        (_p: OfflinePack, s) => setPack({ state: s.state === 'complete' ? 'saved' : 'downloading', percent: Math.round(s.percentage), mb: s.completedResourceSize / 1e6 }),
        (_p, e) => { setPack({ state: 'none', percent: 0, mb: 0 }); reportError(new Error(e.message), 'Couldn’t save the map'); },
      );
    } catch (e) {
      setPack({ state: 'none', percent: 0, mb: 0 });
      reportError(e, 'Couldn’t save the map');
    }
  }, [current, home]);
  const removeOffline = () => Alert.alert('Remove offline map?', 'It frees the space on this phone. You can download it again any time.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => void OfflineManager.deletePack(`${PACK_PREFIX}${tripId}`).then(() => setPack({ state: 'none', percent: 0, mb: 0 })).catch((e) => reportError(e)) },
  ]);

  const checkIn = async () => {
    if (!current) return;
    setChecking(true);
    try {
      const here = await currentPosition();
      if (!here) { Alert.alert('Location is off', 'Allow location for Trips Loom in Settings to check in where you are.'); return; }
      const name = await placeName(here);
      current.editExtras((d) => { d.journal.push({ id: uid(), at: new Date().toISOString(), lat: here.lat, lng: here.lng, place: name || 'Checked in', note: '' }); });
    } catch (e) {
      reportError(e, 'Couldn’t check in');
    } finally {
      setChecking(false);
    }
  };

  if (!current) return status === 'loading' ? <Loading /> : <NoTrip />;
  const { trip } = current;
  const city = trip.destination.split(',')[0].trim();
  const withPlace = (day ? plansOn(trip, day) : trip.activities).filter((a) => a.place.trim());
  const walk = stops.length > 1 ? stops.slice(1).reduce((sum, s, i) => sum + distanceKm(stops[i].at, s.at), 0) : 0;
  const line = stops.length > 1 ? { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: stops.map((s) => [s.at.lng, s.at.lat]) } } : null;
  const focus = points[0] ?? home;
  const center: [number, number] = focus ? [focus.lng, focus.lat] : [0, 20];

  return <Screen bar="tabs">
    <Header title="Map" />
    <HScroll>
      <Pill label="All days" active={day === null} onPress={() => setDay(null)} />
      {dates.map((d) => <Pill key={d} label={`${weekday(d)} ${shortDay(d).split(' ').slice(-2).join(' ')}`} active={day === d} onPress={() => setDay(d)} />)}
    </HScroll>
    <View style={{ height: 380, borderRadius: radii.hero, overflow: 'hidden', backgroundColor: colors.mist, boxShadow: shadows.rest }}>
      <Map style={{ flex: 1 }} mapStyle={MAP_STYLE} logo={false} attribution attributionPosition={{ bottom: 8, right: 8 }} accessibilityLabel={`Map of ${trip.name}`} onDidFinishLoadingMap={() => setLoaded(true)}>
        <Camera ref={camera} initialViewState={{ center, zoom: focus ? 12 : 1.5 }} />
        {line ? <GeoJSONSource id="day-route" data={line}>
          <Layer id="day-route-line" type="line" paint={{ 'line-color': colors.ember, 'line-width': 3, 'line-dasharray': [1.5, 1.5] }} layout={{ 'line-cap': 'round' }} />
        </GeoJSONSource> : null}
        {stops.map((s, i) => <Marker key={s.a.id} id={`plan-${s.a.id}`} lngLat={[s.at.lng, s.at.lat]} onPress={() => router.push({ pathname: '/add-plan', params: { id: s.a.id } } as never)}>
          <Pin label={String(i + 1)} color={colors.ember} />
        </Marker>)}
        {steps.map((s) => <Marker key={s.id} id={`step-${s.id}`} lngLat={[s.lng, s.lat]}><Pin label="●" color={tints.lavender.fg} /></Marker>)}
      </Map>
      {!points.length ? <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 16, padding: 12, borderRadius: radii.card, backgroundColor: 'rgba(255,255,255,0.94)' }}>
        <T v="small">{locating ? 'Finding your places on the map…' : withPlace.length ? 'Couldn’t find these places. Try a fuller address in each plan’s “Where”.' : `Add a “Where” to your plans and they’ll appear here. You can save ${destination.split(',')[0] || 'the area'} for offline now.`}</T>
      </View> : null}
    </View>
    {stops.length ? <Card padding={14} gap={10}>
      {stops.map((s, i) => <Pressable key={s.a.id} accessibilityRole="button" accessibilityLabel={`Open ${s.a.title}`} onPress={() => router.push({ pathname: '/add-plan', params: { id: s.a.id } } as never)}>
        <RowView gap={12}>
          <Pin label={String(i + 1)} color={colors.ember} />
          <View style={{ flex: 1 }}><T v="row" style={{ fontSize: 15 }} lines={1}>{s.a.title}</T><T v="meta" lines={1}>{[day ? '' : shortDay(s.a.date), s.a.time, s.a.place].filter(Boolean).join(' · ')}</T></View>
          {i > 0 ? <T v="meta">{distanceKm(stops[i - 1].at, s.at).toFixed(1)} km</T> : null}
        </RowView>
      </Pressable>)}
      {walk ? <T v="meta">{day ? `${walk.toFixed(1)} km between stops, about ${Math.round((walk / 4.5) * 60)} min on foot` : `${walk.toFixed(1)} km between all stops`}</T> : null}
    </Card> : null}
    <Stack gap={10}>
      {stops.length && day ? <Button label={`Route for ${weekday(day)} in Maps`} icon="map" onPress={() => void openRoute(stops.map((s) => s.a.place), city).catch((e) => reportError(e, 'Couldn’t open Maps'))} /> : null}
      <Button label={checking ? 'Finding you…' : 'Check in here'} icon="pin" kind="white" onPress={() => void checkIn()} />
      {pack.state === 'saved'
        ? <Card padding={14}><RowView gap={12}><Icon name="check" size={18} color={tints.mint.fg} /><View style={{ flex: 1 }}><T v="row" style={{ fontSize: 15 }}>Saved for offline</T><T v="meta">{pack.mb.toFixed(0)} MB on this phone · works without signal</T></View>
          <Pressable accessibilityRole="button" onPress={removeOffline} hitSlop={8}><T v="small" style={{ fontFamily: fonts.semibold }}>Remove</T></Pressable></RowView></Card>
        : <Button label={pack.state === 'downloading' ? `Saving map… ${pack.percent}%` : 'Save map for offline'} icon="export" kind="white" onPress={pack.state === 'downloading' ? undefined : () => void saveOffline()} />}
    </Stack>
    {steps.length ? <Card padding={14} gap={10}>
      <T v="label">Check-ins{day ? '' : ' on this trip'}</T>
      {[...steps].reverse().map((s) => <RowView key={s.id} gap={12}>
        <Pin label="●" color={tints.lavender.fg} />
        <View style={{ flex: 1 }}><T v="row" style={{ fontSize: 15 }} lines={1}>{s.place}</T><T v="meta">{`${shortDay(localDay(s.at))} · ${clockTime(s.at)}`}</T></View>
      </RowView>)}
    </Card> : null}
    {current.extras.journal.length ? <Note>Check-ins stay private to you. They show up in the trip recap and travel book.</Note> : null}
  </Screen>;
}

/* ------------------------------------------------------------------ flight status */

/** A top-down plane pointing along its heading (0 = north). */
function PlaneMarker({ heading }: { heading: number }) {
  return <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ember, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: shadows.button }}>
    <Svg width={20} height={20} viewBox="0 0 24 24" style={{ transform: [{ rotate: `${Math.round(heading)}deg` }] }}>
      <Path fill="#FFFFFF" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </Svg>
  </View>;
}

const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

/** Live flight status for one plan (a Travel plan with a flight number). Refreshes every 30 seconds. */
export function FlightScreen() {
  const current = useCurrentTrip();
  const { status: tripsStatus } = useTrips();
  const params = useLocalSearchParams<{ id?: string }>();
  const plan = current?.trip.activities.find((a) => a.id === params.id);
  const [status, setStatus] = useState<FlightStatus | null | 'loading'>('loading');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const text = plan ? `${plan.title} ${plan.notes}` : '';
  const departs = useMemo(() => {
    if (!plan?.time) return null;
    const [h, m] = plan.time.split(':').map(Number);
    const d = new Date(`${plan.date}T00:00:00`); d.setHours(h || 0, m || 0, 0, 0); return d;
  }, [plan?.date, plan?.time]);
  useEffect(() => {
    if (!text) return;
    let active = true;
    const load = () => void flightStatus(text, departs).then((s) => { if (active) { setStatus(s); setCheckedAt(new Date()); } }).catch(() => { if (active) setStatus(null); });
    load();
    const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [text, departs]);

  if (!current) return tripsStatus === 'loading' ? <Loading /> : <NoTrip />;
  if (!plan || !parseFlightNumber(text)) return <Screen><Header title="Flight" /><EmptyState art="ticket" title="No flight number" body="Add the flight number to the plan’s name, like “TP 1321”, to follow it live." /></Screen>;
  if (status === 'loading') return <Screen><Header title="Flight" /><Loading label="Finding the flight…" /></Screen>;
  const r = status?.route;
  const live = status?.live;
  const phaseText = !status ? 'Couldn’t reach flight data. Check your connection.' :
    status.phase === 'airborne' ? (status.etaMinutes ? `In the air · lands in about ${fmtMinutes(status.etaMinutes)}` : 'In the air') :
    status.phase === 'scheduled' ? `Scheduled · departs ${longDay(plan.date)} at ${plan.time}` :
    status.phase === 'landed' ? 'Probably landed' : live?.onGround ? 'On the ground' : 'Not tracked right now';
  const line = r ? { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[r.origin.lng, r.origin.lat], [r.destination.lng, r.destination.lat]] } } : null;
  const bounds = r ? boundsOf([r.origin, r.destination, ...(live ? [live] : [])], 80) : live ? boundsOf([live], 200) : null;

  return <Screen>
    <Header title={status?.number ?? 'Flight'} />
    <Card padding={16} gap={6}>
      <T v="eyebrow">{r?.airline ?? 'Flight'}</T>
      <T v="title">{r ? `${r.origin.iata} → ${r.destination.iata}` : plan.title}</T>
      {r ? <T v="small">{r.origin.city || r.origin.name} to {r.destination.city || r.destination.name}</T> : null}
      <RowView gap={8} style={{ marginTop: 6 }}><Icon name="plane" size={16} color={status?.phase === 'airborne' ? colors.ember : colors.stone} /><T v="row" style={{ fontSize: 15, flex: 1 }}>{phaseText}</T></RowView>
    </Card>
    {bounds ? <View style={{ height: 300, borderRadius: radii.hero, overflow: 'hidden', backgroundColor: colors.mist, boxShadow: shadows.rest }}>
      <Map style={{ flex: 1 }} mapStyle={MAP_STYLE} logo={false} attribution attributionPosition={{ bottom: 8, right: 8 }} accessibilityLabel="Flight map">
        <Camera initialViewState={{ bounds, padding: { top: 40, bottom: 40, left: 40, right: 40 } }} />
        {line ? <GeoJSONSource id="flight-route" data={line}><Layer id="flight-route-line" type="line" paint={{ 'line-color': colors.stone, 'line-width': 2, 'line-dasharray': [2, 2] }} /></GeoJSONSource> : null}
        {r ? <Marker id="origin" lngLat={[r.origin.lng, r.origin.lat]}><Pin label={r.origin.iata || 'A'} color={colors.inkButton} /></Marker> : null}
        {r ? <Marker id="destination" lngLat={[r.destination.lng, r.destination.lat]}><Pin label={r.destination.iata || 'B'} color={colors.inkButton} /></Marker> : null}
        {live ? <Marker id="plane" lngLat={[live.lng, live.lat]}><PlaneMarker heading={live.track ?? (r ? bearing(live, r.destination) : 0)} /></Marker> : null}
      </Map>
    </View> : null}
    {live ? <Card padding={16}>
      <RowView gap={12} align="flex-start">
        {[['Altitude', live.onGround ? 'Ground' : `${live.altitudeM.toLocaleString()} m`], ['Speed', live.speedKmh != null ? `${live.speedKmh.toLocaleString()} km/h` : '–'], ['To go', status?.remainingKm != null ? `${status.remainingKm.toLocaleString()} km` : '–']].map(([k, v]) =>
          <View key={k} style={{ flex: 1, gap: 2 }}><T v="meta">{k}</T><T v="row" style={{ fontSize: 16 }}>{v}</T></View>)}
      </RowView>
      {status?.progress != null ? <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.rule, overflow: 'hidden' }}><View style={{ width: `${Math.round(status.progress * 100)}%`, height: 6, backgroundColor: colors.ember }} /></View> : null}
      <T v="meta">{[live.aircraft, live.registration].filter(Boolean).join(' · ')}{checkedAt ? ` · updated ${clockTime(checkedAt.toISOString())}` : ''}</T>
    </Card> : null}
    <Note>Live positions come from volunteer ADS-B receivers (adsb.lol) and routes from adsbdb. Gate, delay and baggage details aren’t included; check your airline’s app for those.</Note>
  </Screen>;
}

