import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from '../core/nav';
import { useCurrentTrip } from '../core/state';
import { uid } from '../data';
import { suggestPacking } from '../domain/packing';
import { Button, CheckToggle, EmptyState, Group, Loading, Note, Row, Section, Sheet, T } from '../loom';
import { useTripWeather } from '../services/weather';

/** Suggested items for the open trip; everything starts ticked and the person removes what they don't need. */
export function PackSuggestSheet() {
  const current = useCurrentTrip();
  const router = useRouter();
  const weather = useTripWeather(current?.trip ?? null);
  const days = useMemo(() => Object.values(weather), [weather]);
  const suggestions = useMemo(() => current ? suggestPacking(current.trip, current.extras.kind, days, current.trip.extras.map((e) => e.name)) : [], [current, days]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  // Give the forecast a moment so weather-based items appear in the first list.
  useEffect(() => { const t = setTimeout(() => setReady(true), days.length ? 0 : 1500); return () => clearTimeout(t); }, [days.length]);
  if (!current) return <Sheet title="Suggested items"><EmptyState title="No trip open" body="Open a trip first." /></Sheet>;
  if (!ready) return <Sheet title="Suggested items"><Loading label="Checking the forecast…" /></Sheet>;
  const chosen = suggestions.filter((s) => !off.has(s.name));
  const groups = [...new Set(suggestions.map((s) => s.category))];
  const add = () => {
    current.editTrip((t) => {
      for (const s of chosen) t.extras.push({ id: uid(), name: s.name, quantity: s.quantity, weight: 0, packed: false, category: s.category });
    });
    router.back();
  };
  if (!suggestions.length) return <Sheet title="Suggested items"><EmptyState art="suitcase" title="You’re all set" body="Everything we’d suggest is already on your list." /></Sheet>;
  return <Sheet title="Suggested items" footer={<Button label={chosen.length ? `Add ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'}` : 'Nothing selected'} icon="plus" onPress={chosen.length ? add : () => router.back()} />}>
    <Note>Based on {days.length ? 'the forecast, ' : ''}{current.trip.destination.split(',')[0]}, the trip length and your plans. Untick anything you don’t need.</Note>
    {groups.map((g) => <Section key={g} title={g}>
      <Group>{suggestions.filter((s) => s.category === g).map((s) => <Row key={s.name} title={s.quantity > 1 ? `${s.quantity} × ${s.name}` : s.name} meta={s.reason}
        onPress={() => setOff((prev) => { const next = new Set(prev); if (next.has(s.name)) next.delete(s.name); else next.add(s.name); return next; })}
        trailing={<CheckToggle checked={!off.has(s.name)} label={`Add ${s.name}`} onChange={(on) => setOff((prev) => { const next = new Set(prev); if (on) next.delete(s.name); else next.add(s.name); return next; })} />} />)}</Group>
    </Section>)}
    <View style={{ height: 4 }} />
    {!days.length ? <T v="meta">The forecast wasn’t available, so weather items may be missing.</T> : null}
  </Sheet>;
}
