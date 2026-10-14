import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { TripExtras } from '../data/extras';
import { tripDates, type Trip } from '../data/model';
import { daysFromToday, planTime, todayISO, toDate } from '../domain/format';
import { sortPlans } from '../domain/trips';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function notificationPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestNotifications(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trips', { name: 'Trip reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

type Reminder = { id: string; at: Date; title: string; body: string; url: string; tripId: string };

/** Reminders for the next 60 days, earliest first (iOS keeps at most 64 pending). */
export function plannedReminders(trips: Trip[], extras: (id: string) => TripExtras, now = new Date()): Reminder[] {
  const out: Reminder[] = [];
  const today = todayISO(now);
  for (const trip of trips) {
    if (trip.end < today || daysFromToday(trip.start, today) > 60) continue;
    const x = extras(trip.id);
    const eve = toDate(trip.start); eve.setDate(eve.getDate() - 1); eve.setHours(18, 0, 0, 0);
    if (eve > now) {
      const unpacked = trip.extras.filter((e) => !e.packed).length;
      out.push({ id: `eve-${trip.id}`, tripId: trip.id, at: eve, title: `${trip.name} starts tomorrow`, url: '/trip/packing',
        body: unpacked ? `${unpacked} ${unpacked === 1 ? 'thing' : 'things'} still to pack. Check the forecast and your first day.` : 'Check the forecast and your first day.' });
    }
    for (const date of tripDates(trip)) {
      const morning = toDate(date); morning.setHours(8, 0, 0, 0);
      if (morning <= now) continue;
      const plans = sortPlans(trip.activities.filter((a) => a.date === date));
      if (plans.length) {
        const first = plans[0];
        out.push({ id: `day-${trip.id}-${date}`, tripId: trip.id, at: morning, title: `Today in ${trip.destination.split(',')[0]}`, url: '/trip/days',
          body: `${first.time ? `${planTime(first.time)} · ` : ''}${first.title}${plans.length > 1 ? ` and ${plans.length - 1} more` : ''}` });
      }
      // Flight check-in usually opens 24 hours before departure (TripIt-style reminder).
      for (const plan of plans) {
        if (plan.category !== 'Travel' || !plan.time || !/\b(flight|fly|airport|[A-Z]{2}\s?\d{2,4})\b/i.test(`${plan.title} ${plan.notes}`)) continue;
        const departs = toDate(date); const [h, m] = plan.time.split(':').map(Number); departs.setHours(h || 0, m || 0, 0, 0);
        const checkIn = new Date(departs.getTime() - 24 * 3600000);
        if (checkIn > now) out.push({ id: `checkin-${trip.id}-${plan.id}`, tripId: trip.id, at: checkIn, title: `Check in for ${plan.title}`.slice(0, 120),
          url: '/trip/days', body: `Online check-in usually opens now, 24 hours before your ${planTime(plan.time)} departure. Choose your seat early.` });
      }
      if (x.kind === 'trek' && x.adventure.checkInReminders) {
        const evening = toDate(date); evening.setHours(19, 30, 0, 0);
        if (evening > now) out.push({ id: `alt-${trip.id}-${date}`, tripId: trip.id, at: evening, title: 'Altitude check-in', url: '/altitude-check-in',
          body: 'Log your blood oxygen, heart rate and how you feel. It takes a minute.' });
      }
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60);
}

/** Replaces every scheduled reminder with the current plan. A no-op without permission. */
export async function syncReminders(trips: Trip[], extras: (id: string) => TripExtras, enabled: boolean) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled || (await notificationPermission()) !== 'granted') return;
    for (const r of plannedReminders(trips, extras)) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { url: r.url, tripId: r.tripId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, ...(Platform.OS === 'android' ? { channelId: 'trips' } : {}) },
      });
    }
  } catch { /* Reminders are best effort; the app works without them. */ }
}
