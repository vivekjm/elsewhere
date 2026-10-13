import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useAuth } from './AuthContext';
import { emptyExtras, parseExtras, type TripExtras, type TripKind } from './extras';

type Cache = { trips: Record<string, TripExtras>; dirty: string[]; deleted: string[] };
export type ExtrasStatus = 'loading' | 'saved' | 'pending' | 'offline';
type ExtrasContextValue = {
  status: ExtrasStatus;
  /** True once this device's saved copy has been read (before the server answers). */
  ready: boolean;
  /** Every trip's extras (for backups and widgets). */
  all: Record<string, TripExtras>;
  /** Extras for a trip; a fresh default when the trip has none yet. */
  get: (tripId: string) => TripExtras;
  change: (tripId: string, edit: (draft: TripExtras) => void) => void;
  /** Replaces a trip's extras wholesale (used when importing an invite). */
  put: (tripId: string, extras: TripExtras) => void;
  remove: (tripId: string) => void;
  defaultKind: (tripId: string, kind: TripKind) => void;
};

const ExtrasContext = createContext<ExtrasContextValue | null>(null);
const cacheKey = (user: string) => `tripsloom.extras.v1.${user}`;
const emptyCache = (): Cache => ({ trips: {}, dirty: [], deleted: [] });

export function ExtrasProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  // Signed in: synced per user. The development preview (local workspace) keeps extras on this device only.
  const userId = auth.user?.id ?? (auth.guestMode ? 'local' : null);
  const synced = !!auth.user;
  const [cache, setCache] = useState<Cache>(emptyCache);
  const [status, setStatus] = useState<ExtrasStatus>('loading');
  const [ready, setReady] = useState(false);
  const cacheRef = useRef<Cache>(emptyCache());
  const userRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flight = useRef<Promise<void> | null>(null);

  const commit = useCallback((next: Cache) => {
    cacheRef.current = next;
    setCache(next);
    const user = userRef.current;
    if (user) void Storage.setItem(cacheKey(user), JSON.stringify(next)).catch(() => {});
  }, []);

  const push = useCallback(async () => {
    if (flight.current) return flight.current;
    const client = auth.client;
    const user = userRef.current;
    if (!client || !user || user === 'local') { setStatus('saved'); return; }
    flight.current = (async () => {
      const snapshot = cacheRef.current;
      if (!snapshot.dirty.length && !snapshot.deleted.length) { setStatus('saved'); return; }
      try {
        const rows = snapshot.dirty.filter((id) => snapshot.trips[id]).map((id) => ({ user_id: user, trip_id: id, data: snapshot.trips[id] }));
        if (rows.length) {
          const { error } = await client.from('trip_extras').upsert(rows, { onConflict: 'user_id,trip_id' });
          if (error) throw error;
        }
        if (snapshot.deleted.length) {
          const { error } = await client.from('trip_extras').delete().eq('user_id', user).in('trip_id', snapshot.deleted);
          if (error) throw error;
        }
        if (userRef.current !== user) return;
        // Keep anything edited while this push was in flight.
        const current = cacheRef.current;
        const sent = new Set(snapshot.dirty);
        const stillDirty = current.dirty.filter((id) => !sent.has(id) || current.trips[id] !== snapshot.trips[id]);
        const stillDeleted = current.deleted.filter((id) => !snapshot.deleted.includes(id));
        commit({ ...current, dirty: stillDirty, deleted: stillDeleted });
        setStatus(stillDirty.length || stillDeleted.length ? 'pending' : 'saved');
      } catch {
        setStatus('offline');
      }
    })().finally(() => { flight.current = null; });
    return flight.current;
  }, [auth.client, commit]);

  const schedule = useCallback(() => {
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void push(); }, 800);
  }, [push]);

  // Load the cached copy, then merge the server's rows: the server wins for any trip without local edits.
  useEffect(() => {
    userRef.current = userId;
    setReady(false);
    if (!userId) { commit(emptyCache()); setStatus('loading'); return; }
    let active = true;
    void (async () => {
      let local = emptyCache();
      try {
        const raw = await Storage.getItem(cacheKey(userId));
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Cache>;
          const trips: Record<string, TripExtras> = {};
          for (const [id, value] of Object.entries(parsed.trips ?? {})) trips[id] = parseExtras(value);
          local = { trips, dirty: Array.isArray(parsed.dirty) ? parsed.dirty.filter((x) => typeof x === 'string') : [], deleted: Array.isArray(parsed.deleted) ? parsed.deleted.filter((x) => typeof x === 'string') : [] };
        }
      } catch { /* A broken cache starts empty; the server copy fills it. */ }
      if (!active) return;
      cacheRef.current = local;
      setCache(local);
      setReady(true);
      const client = auth.client;
      if (!synced) { setStatus('saved'); return; }
      if (!client) { setStatus('offline'); return; }
      try {
        const { data, error } = await client.from('trip_extras').select('trip_id,data');
        if (error) throw error;
        if (!active || userRef.current !== userId) return;
        const merged = { ...cacheRef.current, trips: { ...cacheRef.current.trips } };
        for (const row of (data ?? []) as { trip_id: string; data: unknown }[]) {
          if (merged.dirty.includes(row.trip_id) || merged.deleted.includes(row.trip_id)) continue;
          merged.trips[row.trip_id] = parseExtras(row.data);
        }
        commit(merged);
        setStatus(merged.dirty.length || merged.deleted.length ? 'pending' : 'saved');
        if (merged.dirty.length || merged.deleted.length) void push();
      } catch {
        if (active) setStatus('offline');
      }
    })();
    return () => { active = false; };
  }, [userId, synced, auth.client, commit, push]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active' || state === 'background') void push(); });
    return () => sub.remove();
  }, [push]);

  const get = useCallback((tripId: string) => cache.trips[tripId] ?? emptyExtras(), [cache]);

  const change = useCallback((tripId: string, edit: (draft: TripExtras) => void) => {
    const current = cacheRef.current;
    const draft = JSON.parse(JSON.stringify(current.trips[tripId] ?? emptyExtras())) as TripExtras;
    edit(draft);
    const next = parseExtras({ ...draft, updatedAt: new Date().toISOString() });
    commit({
      trips: { ...current.trips, [tripId]: next },
      dirty: current.dirty.includes(tripId) ? current.dirty : [...current.dirty, tripId],
      deleted: current.deleted.filter((id) => id !== tripId),
    });
    schedule();
  }, [commit, schedule]);

  const put = useCallback((tripId: string, extras: TripExtras) => change(tripId, (d) => Object.assign(d, extras)), [change]);

  const remove = useCallback((tripId: string) => {
    const current = cacheRef.current;
    const trips = { ...current.trips };
    delete trips[tripId];
    commit({ trips, dirty: current.dirty.filter((id) => id !== tripId), deleted: [...new Set([...current.deleted, tripId])] });
    schedule();
  }, [commit, schedule]);

  const defaultKind = useCallback((tripId: string, kind: TripKind) => {
    if (!cacheRef.current.trips[tripId]) change(tripId, (d) => { d.kind = kind; });
  }, [change]);

  const value = useMemo(() => ({ status, ready, all: cache.trips, get, change, put, remove, defaultKind }), [status, ready, cache.trips, get, change, put, remove, defaultKind]);
  return <ExtrasContext.Provider value={value}>{children}</ExtrasContext.Provider>;
}

export function useExtras(): ExtrasContextValue {
  const context = useContext(ExtrasContext);
  if (!context) throw new Error('useExtras must be used inside DataProvider.');
  return context;
}
