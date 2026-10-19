/**
 * Product analytics: named events with a few small properties, never trip content (no names, places, amounts
 * or notes). Events are queued in memory and sent in batches to Trips Loom's own `app_events` table (insert-only,
 * see supabase/migrations/20261015_app_events.sql). Nothing goes to a third party.
 *
 * Turned off in Data & privacy (`native.analytics`); while off, events are dropped, not stored.
 */
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Every event the app sends. Adding one here is the only way to send it. */
export type EventName =
  | 'app_opened' | 'onboarding_completed'
  | 'trip_created' | 'trip_opened' | 'trip_draft_started' | 'trip_draft_saved'
  | 'invite_sent' | 'invite_joined' | 'trip_shared_live' | 'member_joined'
  | 'rsvp_set' | 'vote_cast' | 'date_poll_created' | 'dates_locked'
  | 'expense_added' | 'settlement_added' | 'upi_pay_opened' | 'kitty_topped_up'
  | 'ready_item_done' | 'nudge_sent' | 'day_sheet_shared' | 'recap_shared'
  | 'discover_idea_opened' | 'booking_imported' | 'paywall_viewed' | 'purchase_completed'
  | 'entry_checked' | 'offer_shown' | 'offer_opened' | 'offer_dismissed' | 'template_shared' | 'shortlist_added'
  | 'reel_shared' | 'plan_mode_started' | 'plan_mode_step' | 'plan_mode_saved'
  | 'plan_board_opened' | 'plan_board_drafted' | 'plan_board_applied' | 'ai_ideas' | 'ai_consent' | 'plan_edit' | 'plan_hub_opened';

type Props = Record<string, string | number | boolean>;
type Queued = { name: EventName; props: Props; session_id: string; platform: 'ios' | 'android' | 'web'; app_version: string; occurred_at: string };

const MAX_QUEUE = 200;
const FLUSH_MS = 15000;
const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
let client: SupabaseClient | null = null;
let enabled = false;
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;

/** Called by the session (AppServices): who to send as, and whether the person allows it. */
export function configureAnalytics(next: SupabaseClient | null, allowed: boolean) {
  client = next;
  enabled = allowed && !!next;
  if (!enabled) queue = [];
}

/** Records an event. Property values are clipped so nothing long (like free text) can slip in. */
export function track(name: EventName, props: Props = {}) {
  if (!enabled) return;
  const clean: Props = {};
  for (const [k, v] of Object.entries(props).slice(0, 8)) clean[k.slice(0, 32)] = typeof v === 'string' ? v.slice(0, 40) : v;
  queue.push({
    name, props: clean, session_id: session, platform: Platform.OS === 'android' ? 'android' : 'ios',
    app_version: Application.nativeApplicationVersion ?? '', occurred_at: new Date().toISOString(),
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (!timer) timer = setTimeout(() => { timer = null; void flush(); }, FLUSH_MS);
}

/** Sends what's queued. A failed send keeps the events for the next try (offline). */
export async function flush() {
  if (!enabled || !client || sending || !queue.length) return;
  sending = true;
  const batch = queue.slice(0, 50);
  try {
    const { error } = await client.from('app_events').insert(batch);
    if (!error) queue = queue.slice(batch.length);
  } catch { /* Offline: keep the batch. */ } finally { sending = false; }
}

// Leaving the app sends what's left.
AppState.addEventListener('change', (state) => { if (state !== 'active') void flush(); });
