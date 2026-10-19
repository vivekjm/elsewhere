/**
 * Contextual partner offers: one card per trip, in the three weeks before it, with the things this trip still needs
 * (a stay when no night has one, activities for the destination, an eSIM for a trip abroad). Partner links carry the
 * affiliate id from the build's environment (EXPO_PUBLIC_AFFILIATE_*) when set; the card says so plainly.
 * Dismissed per trip and never shown during or after the trip.
 */
import React, { useEffect, useState } from 'react';
import Storage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';
import { track } from '../core/analytics';
import { usePrefs } from '../core/state';
import { lookup } from '../services/places';
import { tripDates, type Trip } from '../data';
import { daysFromToday, todayISO } from '../domain/format';
import { Group, Row, Section, T, type IconName, type Tint } from '../loom';

const AFFILIATE = {
  booking: process.env.EXPO_PUBLIC_AFFILIATE_BOOKING ?? '',
  getyourguide: process.env.EXPO_PUBLIC_AFFILIATE_GETYOURGUIDE ?? '',
  airalo: process.env.EXPO_PUBLIC_AFFILIATE_AIRALO ?? '',
};

/** Trips whose offers were already counted as shown this session (the card mounts again on every visit). */
const counted = new Set<string>();

type Offer = { id: string; icon: IconName; tint: Tint; title: string; meta: string; url: string; partner: string };

function offersFor(trip: Trip, abroad: boolean): Offer[] {
  const city = trip.destination.split(',')[0]?.trim() ?? '';
  const nights = tripDates(trip).slice(0, -1);
  const unstayed = nights.filter((d) => !trip.days[d]?.stay).length;
  const out: Offer[] = [];
  if (city && unstayed) {
    const q = new URLSearchParams({ ss: trip.destination, checkin: trip.start, checkout: trip.end, group_adults: String(Math.max(1, trip.travellers)), no_rooms: '1', ...(AFFILIATE.booking ? { aid: AFFILIATE.booking } : {}) });
    out.push({ id: 'stay', icon: 'bed', tint: 'peach', title: `Stays in ${city}`, meta: `${unstayed} ${unstayed === 1 ? 'night has' : 'nights have'} no stay yet · Booking.com`, url: `https://www.booking.com/searchresults.html?${q}`, partner: 'booking' });
  }
  if (city) {
    const q = new URLSearchParams({ q: city, date_from: trip.start, date_to: trip.end, ...(AFFILIATE.getyourguide ? { partner_id: AFFILIATE.getyourguide } : {}) });
    out.push({ id: 'activities', icon: 'ticket', tint: 'mint', title: `Things to book in ${city}`, meta: 'Tours, tickets and experiences · GetYourGuide', url: `https://www.getyourguide.com/s/?${q}`, partner: 'getyourguide' });
  }
  if (abroad) {
    out.push({ id: 'esim', icon: 'globe', tint: 'lavender', title: 'Data when you land', meta: 'A travel eSIM, set up before you fly · Airalo', url: `https://www.airalo.com/${AFFILIATE.airalo ? `?ref=${encodeURIComponent(AFFILIATE.airalo)}` : ''}`, partner: 'airalo' });
  }
  return out.slice(0, 3);
}

/** Whether the trip leaves the home country (for the eSIM offer). */
function useAbroad(trip: Trip): boolean {
  const prefs = usePrefs();
  const [abroad, setAbroad] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([lookup(trip.destination), prefs.homeBase ? lookup(prefs.homeBase) : Promise.resolve(null)]).then(([away, home]) => {
      if (active) setAbroad(!!away?.countryCode && !!home?.countryCode && away.countryCode !== home.countryCode);
    }).catch(() => {});
    return () => { active = false; };
  }, [trip.destination, prefs.homeBase]);
  return abroad;
}

export function OffersCard({ trip }: { trip: Trip }) {
  const abroad = useAbroad(trip);
  const key = `tripsloom.offers.dismissed.${trip.id}`;
  const [hidden, setHidden] = useState(true);
  const days = daysFromToday(trip.start);
  const inWindow = trip.start > todayISO() && days <= 21;
  const offers = inWindow ? offersFor(trip, abroad) : [];
  useEffect(() => {
    if (!offers.length) return;
    void Storage.getItem(key).then((v) => { setHidden(v === '1'); if (v !== '1' && !counted.has(trip.id)) { counted.add(trip.id); track('offer_shown', { count: offers.length }); } }).catch(() => setHidden(false));
  }, [key, offers.length, trip.id]);
  if (hidden || !offers.length) return null;
  const dismiss = () => { setHidden(true); void Storage.setItem(key, '1').catch(() => {}); track('offer_dismissed'); };
  const affiliate = offers.some((o) => AFFILIATE[o.partner as keyof typeof AFFILIATE]);
  return <Section title="Still to sort" action="Hide" onAction={dismiss}>
    <Group>{offers.map((o) => <Row key={o.id} icon={o.icon} tint={o.tint} title={o.title} meta={o.meta}
      onPress={() => { track('offer_opened', { offer: o.id }); void WebBrowser.openBrowserAsync(o.url); }} />)}</Group>
    <T v="meta" style={{ paddingHorizontal: 4 }}>{affiliate ? 'Partner links: Tripsloom may earn a small commission, at no cost to you.' : 'Opens the partner’s site.'}</T>
  </Section>;
}
