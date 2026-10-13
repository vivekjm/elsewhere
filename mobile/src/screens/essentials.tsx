/**
 * Country essentials for the open trip: local time and difference from home, plugs and voltage, driving side,
 * emergency number, calling code, money and tipping. Facts come from a built-in table; time and rates are live.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import * as Localization from 'expo-localization';
import { useCurrentTrip, usePrefs, useTrips } from '../core/state';
import { adapterNeeded, COUNTRIES, timeDifference, zoneOffset, type CountryFacts } from '../domain/countries';
import { money } from '../domain/format';
import { Card, colors, EmptyState, Group, Header, Hero, HeroText, Icon, Loading, Note, Row, RowView, Screen, Section, T } from '../loom';
import { currencyName, useRates } from '../services/currency';
import { lookup, type Place } from '../services/places';
import { NoTrip } from './trip';

const deviceZone = () => Localization.getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
const deviceRegion = () => Localization.getLocales()[0]?.regionCode ?? '';

function localTime(timeZone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, hour: '2-digit', minute: '2-digit', weekday: 'short' }).format(now);
  } catch {
    return '';
  }
}

export function EssentialsScreen() {
  const current = useCurrentTrip();
  const prefs = usePrefs();
  const { status } = useTrips();
  const [place, setPlace] = useState<Place | null | 'loading'>('loading');
  const [home, setHome] = useState<Place | null>(null);
  const [now, setNow] = useState(() => new Date());
  const destination = current?.trip.destination ?? '';
  useEffect(() => {
    let active = true;
    setPlace('loading');
    void lookup(destination).then((p) => { if (active) setPlace(p); }).catch(() => { if (active) setPlace(null); });
    return () => { active = false; };
  }, [destination]);
  useEffect(() => {
    let active = true;
    if (prefs.homeBase) void lookup(prefs.homeBase).then((p) => { if (active) setHome(p); }).catch(() => {});
    return () => { active = false; };
  }, [prefs.homeBase]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const rates = useRates(current?.trip.currency ?? 'EUR');

  if (!current) return status === 'loading' ? <Loading /> : <NoTrip />;
  if (place === 'loading') return <Loading label="Looking up the destination…" />;
  const { trip } = current;
  if (!place) return <Screen><Header title="Essentials" />
    <EmptyState art="compass" title="Couldn’t find this place" body={`We couldn’t look up “${trip.destination}”. Check your connection, or edit the trip’s destination to a city or country.`} />
  </Screen>;

  const facts: CountryFacts | undefined = COUNTRIES[place.countryCode];
  const homeCode = home?.countryCode || deviceRegion();
  const homeFacts = COUNTRIES[homeCode];
  const homeZone = home?.timeZone || deviceZone();
  const awayOffset = place.timeZone ? zoneOffset(place.timeZone, now) : null;
  const homeOffset = zoneOffset(homeZone, now);
  const diff = awayOffset !== null && homeOffset !== null ? awayOffset - homeOffset : null;
  const time = place.timeZone ? localTime(place.timeZone, now) : '';
  const adapter = facts ? adapterNeeded(homeFacts, facts) : null;
  const voltageClash = facts && homeFacts && Math.abs(facts.volts - homeFacts.volts) > 60;
  const homeCurrency = prefs.currency;
  const rate = homeCurrency !== trip.currency ? rates?.[homeCurrency] : undefined;
  const call = (number: string) => {
    const first = number.match(/\d{2,5}/)?.[0];
    if (!first) return;
    Alert.alert(`Call ${first}?`, `Emergency number in ${place.country}. Only call in a real emergency.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', style: 'destructive', onPress: () => void Linking.openURL(`tel:${first}`).catch(() => {}) },
    ]);
  };

  return <Screen>
    <Header title="Essentials" />
    <Hero gap={8}>
      <HeroText faint style={{ fontSize: 14 }}>{place.country || trip.destination}</HeroText>
      <HeroText v="display" style={{ fontSize: 32, lineHeight: 36 }}>{time || '—'}</HeroText>
      <HeroText v="small">{diff === null ? `Local time in ${place.name}` : `Local time in ${place.name} · ${timeDifference(diff)}`}</HeroText>
      {diff !== null && Math.abs(diff) >= 180 ? <HeroText v="small">Jet lag tip: shift your sleep an hour a day before you leave, and get daylight on arrival.</HeroText> : null}
    </Hero>
    {facts ? <>
      <Section title="Power">
        <Group>
          <Row icon="plug" title={`Plug type ${facts.plugs}`} meta={adapter === null ? 'Set your home base in Preferences to check your plugs' : adapter ? 'Your plugs won’t fit: bring an adapter' : 'Your plugs fit'} trailing={null} />
          <Row icon="activity" title={`${facts.volts} V`} meta={voltageClash ? 'Different from home: check chargers say 100–240 V' : 'Most phone and laptop chargers work worldwide'} trailing={null} />
        </Group>
      </Section>
      <Section title="Getting around">
        <Group>
          <Row icon="map" title={`Drive on the ${facts.drive}`} meta={homeFacts && homeFacts.drive !== facts.drive ? 'The opposite side to home: take care crossing roads too' : 'Same side as home'} trailing={null} />
          <Row icon="phone" title={`Emergency ${facts.emergency}`} meta="Tap to call" onPress={() => call(facts.emergency)} />
          <Row icon="globe" title={`Country code ${facts.calling}`} meta="Dial it before local numbers from abroad" trailing={null} />
        </Group>
      </Section>
    </> : <Card><RowView gap={10} align="flex-start"><Icon name="help" size={18} color={colors.stone} /><T v="small" style={{ flex: 1 }}>Plug, voltage and emergency details for {place.country || 'this country'} aren’t in Trips Loom yet. Check them before you go.</T></RowView></Card>}
    <Section title="Money">
      <Group>
        <Row icon="card" title={`${trip.currency} · ${currencyName(trip.currency)}`} meta={rate ? `${money(1, trip.currency)} ≈ ${money(rate, homeCurrency)} today` : homeCurrency === trip.currency ? 'Same as your home currency' : 'Rate unavailable offline'} trailing={null} />
        {facts ? <Row icon="star" title="Tipping" meta={facts.tip} trailing={null} /> : null}
      </Group>
    </Section>
    <Note>Check entry, visa and health requirements with official government sources before you travel; they change often.</Note>
    <View style={{ height: 8 }} />
  </Screen>;
}
