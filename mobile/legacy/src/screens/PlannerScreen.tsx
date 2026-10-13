import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { tripDates, type Activity } from '../types';
import { AppButton, EmptyState, Icon, IconButton, PressableScale, TripCard, useTheme, type IconName } from '../design';
import { useNativeHeader } from '../navigation';
import { EditorSheet } from './EditorSheet';
import { Chip, type EditTarget, formatDate, Group, GroupLabel, landscapeImage, moodFor, Page, Row, ScreenTitle, type WorkspaceScreenProps } from './shared';

const quickPlans: { label: string; time: string; category: Activity['category'] }[] = [
  { label: 'Coffee', time: '09:30', category: 'Food & drink' }, { label: 'Museum', time: '11:00', category: 'Explore' }, { label: 'Lunch', time: '13:00', category: 'Food & drink' }, { label: 'Walk', time: '16:30', category: 'Explore' }, { label: 'Travel day', time: '08:00', category: 'Travel' },
];

function RowIcon({ name }: { name: IconName }) {
  const { colors, mode } = useTheme();
  return <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
    <Icon name={name} size={18} color={mode === 'dark' ? colors.text : colors.primary} />
  </View>;
}

export function PlannerScreen(props: WorkspaceScreenProps) {
  const { colors, typography } = useTheme();
  const { workspace, trip, onSelectDay, onNavigate } = props;
  const [editor, setEditor] = useState<EditTarget | null>(null);
  const tripMenu = useMemo(() => workspace.trips.length > 1 ? () => [{
    type: 'menu' as const, label: trip?.name ?? 'Trips', accessibilityLabel: 'Switch trip',
    icon: { type: 'sfSymbol' as const, name: 'chevron.up.chevron.down' as const },
    menu: { title: 'Switch trip', items: workspace.trips.map(entry => ({ type: 'action' as const, label: entry.name, description: entry.destination || undefined,
      state: entry.id === trip?.id ? 'on' as const : 'off' as const, onPress: () => props.onSelectTrip(entry.id) })) },
  }] : undefined, [workspace.trips, trip?.id, trip?.name]);
  const selected = trip && props.day >= trip.start && props.day <= trip.end ? props.day : trip?.start || props.day;
  useNativeHeader({ title: trip?.destination || trip?.name || 'Calendar', subtitle: trip ? `${tripDates(trip).length} days · ${formatDate(trip.start)} – ${formatDate(trip.end)}` : undefined, onAdd: trip ? () => setEditor({ kind: 'activity', date: selected }) : undefined, addLabel: 'Add a plan', left: tripMenu });
  const days = useMemo(() => trip ? tripDates(trip) : [], [trip]);
  const dayInfo = trip?.days[selected];
  const plans = useMemo(() => trip?.activities.filter(item => item.date === selected).sort((a, b) => a.time.localeCompare(b.time)) || [], [trip, selected]);
  const chosen = useMemo(() => {
    const ids = new Set([dayInfo?.outfitId, ...(dayInfo?.outfitIds || []), ...plans.map(plan => plan.outfitId)].filter(Boolean));
    return workspace.outfits.filter(outfit => ids.has(outfit.id));
  }, [workspace.outfits, dayInfo, plans]);
  const carry = workspace.items.filter(item => new Set([...(dayInfo?.gear || []), ...plans.flatMap(plan => plan.gear)]).has(item.id));

  if (!trip) return <Page><View style={{ paddingTop: 48 }}><EmptyState icon="calendar" title="No trip selected" description="Plan a trip to start filling its days."
    action={<AppButton label="Plan a trip" icon="plus" onPress={() => setEditor({ kind: 'trip' })} />} /></View><EditorSheet target={editor} workspace={workspace} change={props.change} onClose={() => setEditor(null)} onSavedTrip={id => { props.onSelectTrip(id); onNavigate('planner'); }} /></Page>;

  const dayIndex = days.indexOf(selected);
  const addPlan = (draft?: Record<string, unknown>) => setEditor({ kind: 'activity', date: selected, draft });
  const editDay = () => setEditor({ kind: 'day', date: selected });

  return <Page>
    <TripCard height={236} title={trip.name} meta={`${formatDate(trip.start)} – ${formatDate(trip.end, { day: 'numeric', month: 'short', year: 'numeric' })}`} metaIcon="calendar"
      image={landscapeImage(trip.theme)} mood={moodFor(trip)} badge={`${days.length} ${days.length === 1 ? 'day' : 'days'}`}
      chips={[{ icon: 'people' as const, label: `${trip.travellers} ${trip.travellers === 1 ? 'traveller' : 'travellers'}` }, { icon: 'list' as const, label: `${trip.activities.length} ${trip.activities.length === 1 ? 'plan' : 'plans'}` }]}
      action="edit" actionLabel="Edit trip" onAction={() => setEditor({ kind: 'trip', id: trip.id })} />

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 14 }} style={{ marginHorizontal: -14, paddingLeft: 14 }}>
      {days.map(date => {
        const on = date === selected;
        const busy = trip.activities.some(item => item.date === date);
        return <PressableScale key={date} onPress={() => onSelectDay(date)} scaleTo={0.92} accessibilityRole="button" accessibilityState={{ selected: on }}
          accessibilityLabel={`${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${busy ? ', has plans' : ''}`}
          style={{ width: 56, height: 72, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 2,
            backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.border }}>
          <Text style={[typography.caption, { fontSize: 12, color: on ? colors.onPrimary : colors.textMuted }]}>{formatDate(date, { weekday: 'short' })}</Text>
          <Text style={[typography.heading, { color: on ? colors.onPrimary : colors.text }]}>{Number(date.slice(-2))}</Text>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: busy ? (on ? colors.onPrimary : colors.accent) : 'transparent' }} />
        </PressableScale>;
      })}
    </ScrollView>

    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: -8 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>{dayInfo?.title || formatDate(selected, { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
        <Text style={[typography.subtitle, { color: colors.textMuted }]}>Day {dayIndex + 1} of {days.length}{dayInfo?.title ? ` · ${formatDate(selected, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}</Text>
      </View>
      <IconButton icon="edit" label="Edit this day" variant="tonal" size="sm" onPress={editDay} />
    </View>

    <GroupLabel subtitle={plans.length ? `${plans.length} ${plans.length === 1 ? 'plan' : 'plans'} today` : 'Nothing planned yet'}>Plans</GroupLabel>
    {plans.length ? <Group>{plans.map(plan => <Row key={plan.id} onPress={() => setEditor({ kind: 'activity', id: plan.id, date: selected })}
      leading={<Text style={[typography.bodyStrong, { color: colors.primary, width: 50, fontSize: 15 }]}>{plan.time || '—'}</Text>}
      title={plan.title} detail={plan.place || plan.category} />)}</Group>
      : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 14 }} style={{ marginHorizontal: -14, paddingLeft: 14 }}>
        {quickPlans.map(plan => <Chip key={plan.label} icon="plus" label={plan.label} onPress={() => addPlan({ title: plan.label, time: plan.time, category: plan.category })} />)}
      </ScrollView>}

    <GroupLabel subtitle={chosen.length ? undefined : 'Pick something to wear'}>Outfit</GroupLabel>
    <Group>{chosen.length ? chosen.map(outfit => <Row key={outfit.id} onPress={() => setEditor({ kind: 'outfit', id: outfit.id })}
      leading={<RowIcon name="hanger" />} title={outfit.name} detail={`${outfit.items.length} pieces`} />)
      : <Row onPress={editDay} leading={<RowIcon name="hanger" />} title="Choose an outfit" trailing={<Icon name="plus" size={18} color={colors.primary} />} />}</Group>

    <GroupLabel subtitle="Stay and things to carry">Details</GroupLabel>
    <Group>
      <Row onPress={editDay} leading={<RowIcon name="stay" />} title={dayInfo?.stay || 'Add a stay'} detail={dayInfo?.stay ? 'Stay' : undefined} />
      <Row onPress={editDay} leading={<RowIcon name="bag" />} title={carry.length ? carry.map(item => item.name).join(', ') : 'Add things to carry'} detail={carry.length ? 'Carry' : undefined} />
      {dayInfo?.notes ? <Row onPress={editDay} leading={<RowIcon name="note" />} title={dayInfo.notes} detail="Notes" /> : null}
    </Group>
    <EditorSheet target={editor} workspace={workspace} trip={trip} change={props.change} onClose={() => setEditor(null)} onSavedTrip={props.onSelectTrip} />
  </Page>;
}
