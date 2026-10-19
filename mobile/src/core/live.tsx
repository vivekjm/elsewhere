/**
 * Keeps live shared trips in step with everyone on them.
 *
 * Each live trip lives in the server's `shared_trips` row (see supabase/migrations/20261016_shared_trips.sql) and,
 * as before, in each person's own workspace, so every screen works offline and private things stay private.
 *
 * - Pull: on launch, when the app comes back, every 12 seconds while it's open, and on Realtime changes where the
 *   server has Realtime. A newer version is merged with any edits made here since the last pull (three-way, by
 *   record id, `merge3`) and applied.
 * - Push: an edit to a live trip is sent a second later with the version it was based on. If someone saved in
 *   between, the server says so, and the app pulls, merges and sends again.
 * The last version seen of each trip is kept on the phone, so edits made offline still merge correctly later.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { ME, useAuth, useExtras, useWorkspace, type GroupPrefs, type Rsvp, type Trip, type TripExtras } from '../data';
import { fromShared, memberId, merge3, toShared, type MemberRow, type SharedDoc } from '../data/live';
import { tripSchema } from '../data/model';
import { track } from './analytics';
import { usePrefs } from './state';

type Base = { version: number; doc: SharedDoc; rows: string };
type Row = { id: string; code: string; version: number; trip: SharedDoc['trip']; shared: SharedDoc['shared'] };
export type Preview = { id: string; name: string; destination: string; start: string; end: string; organiser: string; members: number; theme: string | null };

type LiveValue = {
  /** Makes a trip live (or returns its code if it already is). */
  share: (tripId: string) => Promise<string>;
  /** What an invite code opens, before joining. Null when the code doesn't exist (any more). */
  peek: (code: string) => Promise<Preview | null>;
  /** Joins by code and brings the trip onto this phone. Returns the trip id. */
  join: (code: string) => Promise<string>;
  setRsvp: (tripId: string, rsvp: Rsvp) => Promise<void>;
  setReady: (tripId: string, key: string, done: boolean) => Promise<void>;
  /** Your travel preferences for this group (budget style, food, pace). */
  setPrefs: (tripId: string, prefs: GroupPrefs) => Promise<void>;
  /** The read-only link for family at home (made once, then reused). */
  familyLink: (tripId: string) => Promise<string>;
  /** Organiser: a new link; the old one stops working. */
  rotate: (tripId: string) => Promise<string>;
  /** Leaves a live trip; your copy stays, as a trip of your own. */
  leave: (tripId: string) => Promise<void>;
  refresh: () => Promise<void>;
};
const LiveContext = createContext<LiveValue | null>(null);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const POLL_MS = 12000;
export const tripLink = (code: string) => `https://tripsloom.com/t/${code}`;
/** The view-only link for family at home (its own path, so it never opens the join flow). */
export const familyLink = (code: string) => `https://tripsloom.com/f/${code}`;

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const ws = useWorkspace();
  const extras = useExtras();
  const prefs = usePrefs();
  const client = auth.client;
  const userId = auth.user?.id ?? null;
  const bases = useRef<Record<string, Base>>({});
  const loaded = useRef<string | null>(null);
  const busy = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest workspace and extras, for async work that outlives a render.
  const latest = useRef({ ws, extras });
  latest.current = { ws, extras };
  const storeKey = userId ? `tripsloom.live.v1.${userId}` : '';

  const saveBases = useCallback(() => {
    if (storeKey) void Storage.setItem(storeKey, JSON.stringify(bases.current)).catch(() => {});
  }, [storeKey]);

  const liveIds = useCallback(() => {
    const { ws: w, extras: x } = latest.current;
    return (w.workspace?.trips ?? []).filter((t) => x.get(t.id).live).map((t) => t.id);
  }, []);

  /** Writes a merged shared document (and member list) into this phone's copy. */
  const apply = useCallback((tripId: string, doc: SharedDoc, rows: MemberRow[]) => {
    if (!userId) return;
    const { ws: w, extras: x } = latest.current;
    const local = w.workspace?.trips.find((t) => t.id === tripId);
    const current = x.get(tripId);
    const next = fromShared(doc, rows, userId, local, current);
    const checked = tripSchema.safeParse(next.trip);
    if (!checked.success) return; // A malformed shared row never overwrites a good copy.
    if (!local || !same(local, checked.data)) {
      w.change((draft) => {
        const i = draft.trips.findIndex((t) => t.id === tripId);
        if (i >= 0) draft.trips[i] = checked.data as Trip; else draft.trips.push(checked.data as Trip);
      });
    }
    const patch = { ...next.extras, live: current.live } as TripExtras;
    if (!same({ ...current, updatedAt: '' }, { ...patch, updatedAt: '' })) x.put(tripId, patch);
  }, [userId]);

  /** Sends this phone's version of a live trip. Returns false on a conflict (someone saved first). */
  const pushOne = useCallback(async (tripId: string, doc: SharedDoc): Promise<boolean> => {
    if (!client) return true;
    const base = bases.current[tripId];
    if (!base) return true;
    const { data, error } = await client.rpc('save_shared_trip', { p_id: tripId, p_version: base.version, p_trip: doc.trip, p_shared: doc.shared });
    if (error) throw error;
    if (typeof data !== 'number' || data < 0) return false;
    bases.current[tripId] = { ...base, version: data, doc };
    saveBases();
    return true;
  }, [client, saveBases]);

  /** Fetches the live trips, merges and applies what changed, then sends anything only this phone has. */
  const pull = useCallback(async (onlyIds?: string[]) => {
    if (!client || !userId || busy.current) return;
    const ids = onlyIds ?? liveIds();
    if (!ids.length) return;
    busy.current = true;
    try {
      const [{ data: trips, error }, { data: members }] = await Promise.all([
        client.from('shared_trips').select('id, code, version, trip, shared').in('id', ids),
        client.from('shared_trip_members').select('trip_id, user_id, display_name, role, rsvp, upi, ready, prefs').in('trip_id', ids),
      ]);
      if (error || !trips) return;
      const { ws: w, extras: x } = latest.current;
      for (const id of ids) {
        const row = (trips as Row[]).find((t) => t.id === id);
        if (!row) {
          // The link was turned off or you were removed: keep your copy as your own trip.
          x.change(id, (d) => { d.live = null; d.members = []; });
          delete bases.current[id];
          continue;
        }
        const rows = ((members ?? []) as (MemberRow & { trip_id: string })[]).filter((m) => m.trip_id === id);
        const remote: SharedDoc = { trip: row.trip, shared: row.shared };
        const localTrip = w.workspace?.trips.find((t) => t.id === id);
        const base = bases.current[id];
        const rowsKey = JSON.stringify(rows);
        const localDoc = localTrip ? toShared(localTrip, x.get(id), userId) : remote;
        if (base && base.version === row.version && base.rows === rowsKey) {
          // Nothing new from others, but an edit here that hasn't gone up yet (its push ran into a pull) goes now.
          if (localTrip && !same(localDoc, base.doc)) await pushOne(id, localDoc).catch(() => false);
          continue;
        }
        const merged = base ? merge3(base.doc, localDoc, remote) : remote;
        apply(id, merged, rows);
        bases.current[id] = { version: row.version, doc: remote, rows: rowsKey };
        if (!same(merged, remote)) await pushOne(id, merged);
        if (x.get(id).live?.code !== row.code) x.change(id, (d) => { if (d.live) d.live.code = row.code; });
      }
      saveBases();
    } catch { /* Offline: try again on the next pull. */ } finally { busy.current = false; }
  }, [client, userId, liveIds, apply, pushOne, saveBases]);

  /** Sends local edits to live trips (debounced by the caller). */
  const pushChanged = useCallback(async () => {
    if (!client || !userId) return;
    // A pull is running: try again once it's done, so the edit isn't left behind.
    if (busy.current) { pushTimer.current = setTimeout(() => { void pushChangedRef.current?.(); }, 1500); return; }
    const { ws: w, extras: x } = latest.current;
    for (const id of liveIds()) {
      const base = bases.current[id];
      const trip = w.workspace?.trips.find((t) => t.id === id);
      if (!base || !trip) continue;
      const doc = toShared(trip, x.get(id), userId);
      if (same(doc, base.doc)) continue;
      try {
        if (!(await pushOne(id, doc))) await pull([id]); // someone saved first: merge and send again
      } catch { /* offline: kept, sent on the next change or pull */ }
    }
  }, [client, userId, liveIds, pushOne, pull]);
  const pushChangedRef = useRef<(() => Promise<void>) | null>(null);
  pushChangedRef.current = pushChanged;

  // Load the last versions seen, then pull.
  useEffect(() => {
    if (!userId || loaded.current === userId) return;
    loaded.current = userId;
    void Storage.getItem(`tripsloom.live.v1.${userId}`).then((raw) => {
      try { bases.current = raw ? JSON.parse(raw) as Record<string, Base> : {}; } catch { bases.current = {}; }
    }).catch(() => {}).finally(() => { void pull(); });
  }, [userId, pull]);

  // Local edits to a live trip go up a second later.
  const liveKey = (ws.workspace?.trips ?? []).filter((t) => extras.get(t.id).live).map((t) => JSON.stringify(t) + JSON.stringify(extras.get(t.id))).join('|');
  useEffect(() => {
    if (!liveKey) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => { void pushChanged(); }, 1000);
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
  }, [liveKey, pushChanged]);

  // Pull while open, when the app comes back, and on Realtime changes where available.
  const hasLive = liveKey.length > 0;
  useEffect(() => {
    if (!hasLive || !client) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active') void pull(); }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void pull(); });
    const channel = client.channel('shared-trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_trips' }, () => { void pull(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_trip_members' }, () => { void pull(); })
      .subscribe();
    return () => { clearInterval(timer); sub.remove(); void client.removeChannel(channel); };
  }, [hasLive, client, pull]);

  // Your name and UPI ID on your member rows follow your profile.
  const me = `${prefs.name}|${prefs.native.upiId}`;
  useEffect(() => {
    if (!client || !userId || !hasLive) return;
    const { extras: x } = latest.current;
    for (const id of liveIds()) {
      const mine = x.get(id).members.find((m) => m.id === ME);
      if (mine && (mine.name !== prefs.name || (mine.upi ?? '') !== prefs.native.upiId) && prefs.name) {
        void client.from('shared_trip_members').update({ display_name: prefs.name.slice(0, 80), upi: prefs.native.upiId || null }).eq('trip_id', id).eq('user_id', userId)
          .then(() => pull([id]));
      }
    }
  }, [me, client, userId, hasLive, liveIds, prefs.name, prefs.native.upiId, pull]);

  const value = useMemo<LiveValue>(() => ({
    share: async (tripId) => {
      if (!client || !userId) throw new Error('Sign in to share a trip.');
      const { ws: w, extras: x } = latest.current;
      const trip = w.workspace?.trips.find((t) => t.id === tripId);
      if (!trip) throw new Error('This trip isn’t on this phone.');
      const existing = x.get(tripId).live;
      if (existing) return existing.code;
      const doc = toShared(trip, x.get(tripId), userId);
      const { data, error } = await client.rpc('share_trip_live', { p_id: tripId, p_trip: doc.trip, p_shared: doc.shared, p_name: prefs.name || 'Organiser' });
      if (error) throw new Error(error.message);
      const code = String(data);
      x.change(tripId, (d) => { d.live = { code, role: 'organiser' }; });
      bases.current[tripId] = { version: 1, doc, rows: '' };
      saveBases();
      track('trip_shared_live');
      setTimeout(() => { void pull([tripId]); }, 300);
      return code;
    },
    peek: async (code) => {
      if (!client) throw new Error('You’re offline.');
      const { data, error } = await client.rpc('peek_shared_trip', { p_code: code });
      if (error) throw new Error(error.message);
      const row = (data as { id: string; name: string; destination: string; start_date: string; end_date: string; organiser: string; members: number; theme: string | null }[] | null)?.[0];
      return row ? { id: row.id, name: row.name, destination: row.destination, start: row.start_date, end: row.end_date, organiser: row.organiser, members: row.members, theme: row.theme } : null;
    },
    join: async (code) => {
      if (!client || !userId) throw new Error('Sign in to join a trip.');
      const { data, error } = await client.rpc('join_shared_trip', { p_code: code, p_name: prefs.name || 'Traveller' });
      if (error) throw new Error(error.message);
      const tripId = String(data);
      const { extras: x } = latest.current;
      const role = x.get(tripId).live?.role ?? 'member';
      x.change(tripId, (d) => { d.live = { code, role }; });
      delete bases.current[tripId];
      busy.current = false;
      await pull([tripId]);
      track('invite_joined');
      return tripId;
    },
    setRsvp: async (tripId, rsvp) => {
      if (!client || !userId) return;
      latest.current.extras.change(tripId, (d) => { const m = d.members.find((x) => x.id === ME); if (m) m.rsvp = rsvp; });
      await client.from('shared_trip_members').update({ rsvp }).eq('trip_id', tripId).eq('user_id', userId);
      track('rsvp_set', { rsvp });
      void pull([tripId]);
    },
    setReady: async (tripId, key, done) => {
      if (!client || !userId) return;
      const mine = latest.current.extras.get(tripId).members.find((m) => m.id === ME);
      const ready = { ...(mine?.ready ?? {}), [key]: done };
      latest.current.extras.change(tripId, (d) => { const m = d.members.find((x) => x.id === ME); if (m) m.ready = ready; });
      await client.from('shared_trip_members').update({ ready }).eq('trip_id', tripId).eq('user_id', userId);
      if (done) track('ready_item_done', { item: key });
      void pull([tripId]);
    },
    setPrefs: async (tripId, groupPrefs) => {
      if (!client || !userId) return;
      latest.current.extras.change(tripId, (d) => { const m = d.members.find((x) => x.id === ME); if (m) m.prefs = groupPrefs; });
      await client.from('shared_trip_members').update({ prefs: groupPrefs }).eq('trip_id', tripId).eq('user_id', userId);
      void pull([tripId]);
    },
    familyLink: async (tripId) => {
      if (!client) throw new Error('You’re offline.');
      const known = latest.current.extras.get(tripId).familyCode;
      if (known) return familyLink(known);
      const { data, error } = await client.rpc('family_view_code', { p_id: tripId });
      if (error) throw new Error(error.message);
      const code = String(data);
      latest.current.extras.change(tripId, (d) => { d.familyCode = code; });
      return familyLink(code);
    },
    rotate: async (tripId) => {
      if (!client) throw new Error('You’re offline.');
      const { data, error } = await client.rpc('rotate_shared_trip_code', { p_id: tripId });
      if (error) throw new Error(error.message);
      const code = String(data);
      latest.current.extras.change(tripId, (d) => { if (d.live) d.live.code = code; });
      return code;
    },
    leave: async (tripId) => {
      if (!client || !userId) return;
      const { error } = await client.from('shared_trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
      if (error) throw new Error(error.message);
      latest.current.extras.change(tripId, (d) => { d.live = null; d.members = []; });
      delete bases.current[tripId];
      saveBases();
    },
    refresh: () => pull(),
  }), [client, userId, prefs.name, pull, saveBases]);

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside LiveProvider.');
  return ctx;
}

/** Your member id on the server, for code that talks to it directly. */
export const myMemberId = memberId;
