import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { defaultNativePreferences, useAuth, useExtras, useWorkspace, type NativePreferences, type Trip, type TripExtras, type Workspace } from '../data';
import { featuredTrip } from '../domain/trips';
import { Loading } from '../loom';

const SELECTED_KEY = 'tripsloom.selected-trip.v1';

type SelectionValue = { selectedId: string | null; select: (id: string | null) => void; restored: boolean };
const SelectionContext = createContext<SelectionValue>({ selectedId: null, select: () => {}, restored: true });

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    void Storage.getItem(SELECTED_KEY).then((id) => { if (id) setSelectedId(id); }).catch(() => {}).finally(() => setRestored(true));
  }, []);
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    void (id ? Storage.setItem(SELECTED_KEY, id) : Storage.removeItem(SELECTED_KEY)).catch(() => {});
  }, []);
  const value = useMemo(() => ({ selectedId, select, restored }), [selectedId, select, restored]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export const useSelection = () => useContext(SelectionContext);

/** Shows why an edit was refused (validation, a sync conflict, a full workspace) instead of failing silently. */
export function reportError(error: unknown, title = 'Couldn’t save that') {
  Alert.alert(title, error instanceof Error ? error.message : 'Please try again.');
}

/** The workspace with an edit helper that reports problems. Returns true when the edit was applied. */
export function useTrips() {
  const ws = useWorkspace();
  const edit = useCallback((fn: (draft: Workspace) => void): boolean => {
    try { ws.change(fn); return true; } catch (error) { reportError(error); return false; }
  }, [ws]);
  return { ...ws, trips: ws.workspace?.trips ?? [], edit };
}

export type CurrentTrip = {
  trip: Trip; extras: TripExtras;
  editTrip: (fn: (draft: Trip) => void) => boolean;
  editExtras: (fn: (draft: TripExtras) => void) => void;
};

/** The trip the trip screens show: the selected one, else the featured one. Null when there are no trips. */
export function useCurrentTrip(): CurrentTrip | null {
  const { trips, edit } = useTrips();
  const extras = useExtras();
  const { selectedId } = useSelection();
  const trip = trips.find((t) => t.id === selectedId) ?? featuredTrip(trips);
  const id = trip?.id ?? '';
  const editTrip = useCallback((fn: (draft: Trip) => void) => edit((w) => {
    const draft = w.trips.find((t) => t.id === id);
    if (!draft) throw new Error('This trip was removed on another device.');
    fn(draft);
  }), [edit, id]);
  const editExtras = useCallback((fn: (draft: TripExtras) => void) => extras.change(id, fn), [extras, id]);
  if (!trip) return null;
  return { trip, extras: extras.get(trip.id), editTrip, editExtras };
}

/**
 * Holds a form back until the trips and the selected trip have loaded. Forms copy the record into state once, on
 * mount, so one opened cold from a link or notification would otherwise start empty (and save a plan with no date).
 */
export function afterLoad<P extends object>(Form: React.ComponentType<P>): React.ComponentType<P> {
  function Loaded(props: P) {
    const { status } = useWorkspace();
    const { ready } = useExtras();
    const { restored } = useSelection();
    if (status === 'loading' || !ready || !restored) return <Loading />;
    return <Form {...props} />;
  }
  Loaded.displayName = `afterLoad(${Form.displayName ?? Form.name})`;
  return Loaded;
}

/** Units, currency and name, with defaults while the profile loads. */
export function usePrefs() {
  const auth = useAuth();
  const profile = auth.profile;
  const native: NativePreferences = profile?.native_preferences ?? defaultNativePreferences();
  const meta = auth.user?.user_metadata as { display_name?: string; full_name?: string; name?: string } | undefined;
  const name = profile?.display_name || meta?.display_name || meta?.full_name || meta?.name || auth.user?.email?.split('@')[0] || '';
  return {
    name, firstName: name.split(' ')[0] ?? '', email: auth.user?.email ?? '',
    unit: profile?.unit ?? 'metric', homeBase: profile?.home_base ?? '', currency: native.currency, native,
    update: auth.updateProfile,
  };
}
