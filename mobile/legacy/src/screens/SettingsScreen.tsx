import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { packing } from '../types';
import { useAuth, useWorkspace } from '../data';
import { Card, fonts, Icon, PressableScale, SegmentedControl, themeColors, useTheme, type IconName, type PaletteName } from '../design';
import { SymbolView } from 'expo-symbols';
import { OnboardingScreen } from './OnboardingScreen';
import { Action, Group, GroupLabel, Page, Row, type WorkspaceScreenProps } from './shared';

const palettes: { id: PaletteName; name: string; detail: string }[] = [
  { id: 'olive', name: 'Forest', detail: 'Calm olive and warm paper' }, { id: 'coast', name: 'Coast', detail: 'Sea blue and cool mist' }, { id: 'terracotta', name: 'Terracotta', detail: 'Clay, sand and soft cream' }, { id: 'lavender', name: 'Lavender', detail: 'Plum and pale lilac' },
];
const csv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const ics = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export function SettingsScreen(props: WorkspaceScreenProps) {
  const theme = useTheme();
  const { colors } = theme;
  const auth = useAuth();
  const store = useWorkspace();
  const [editingProfile, setEditingProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  if (editingProfile) return <OnboardingScreen onCancel={() => setEditingProfile(false)} onComplete={() => setEditingProfile(false)} />;
  const share = async (content: string, title: string, extension: 'json' | 'ics' | 'csv', mimeType: string) => {
    try {
      if (!await Sharing.isAvailableAsync()) throw Error('Sharing is unavailable on this device.');
      const safeName = title.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'trips-loom';
      const file = new File(Paths.cache, `${safeName}-${Date.now()}.${extension}`);
      file.create(); file.write(content);
      await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
    } catch (error) { Alert.alert('Could not share', error instanceof Error ? error.message : 'Please try again.'); }
  };
  const exportBackup = () => { const body = store.exportPendingWorkspace(); if (!body) return Alert.alert('Nothing to export', 'Open a workspace first.'); void share(body, 'Trips Loom backup', 'json', 'application/json'); };
  const exportCalendar = () => {
    const trip = props.trip; if (!trip) return;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trips Loom//Mobile//EN', 'CALSCALE:GREGORIAN', ...trip.activities.flatMap(activity => {
      const day = activity.date.replace(/-/g, '');
      const time = activity.time.replace(':', '');
      const start = time ? `${day}T${time}00` : day;
      const end = activity.endTime ? `${day}T${activity.endTime.replace(':', '')}00` : '';
      return ['BEGIN:VEVENT', `UID:${activity.id}@tripsloom.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART${time ? '' : ';VALUE=DATE'}:${start}`, ...(end ? [`DTEND:${end}`] : []), `SUMMARY:${ics(activity.title)}`, ...(activity.place ? [`LOCATION:${ics(activity.place)}`] : []), ...(activity.notes ? [`DESCRIPTION:${ics(activity.notes)}`] : []), 'END:VEVENT'];
    }), 'END:VCALENDAR'].join('\r\n');
    void share(lines, `${trip.name} calendar`, 'ics', 'text/calendar');
  };
  const exportPacking = () => {
    const trip = props.trip; if (!trip) return;
    const lines = ['Item,Category,Quantity,Weight (g),Packed', ...packing(props.workspace, trip).map(item => [item.name, item.category, item.quantity, item.weight * item.quantity, item.packed ? 'Yes' : 'No'].map(csv).join(','))].join('\n');
    void share(lines, `${trip.name} packing list`, 'csv', 'text/csv');
  };
  const sync = async () => { setBusy(true); try { await store.sync(); } catch (error) { Alert.alert('Could not sync', error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); } };
  const reload = async () => { setBusy(true); try { await store.reload(); } catch (error) { Alert.alert('Could not refresh', error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); } };
  const discard = () => Alert.alert('Replace local changes?', 'Changes on this device that have not synced will be lost.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace', style: 'destructive', onPress: () => { void store.discardAndReload().catch(error => Alert.alert('Could not reload', error instanceof Error ? error.message : 'Please try again.')); } }]);
  const signOut = () => Alert.alert('Sign out?', 'Your saved trips will be here when you return.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: () => { void auth.signOut().catch(error => Alert.alert('Could not sign out', error instanceof Error ? error.message : 'Please try again.')); } }]);
  const name = auth.profile?.display_name || (auth.guestMode ? 'Visitor' : 'Your account');
  const letters = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
  const syncIssue = store.status === 'offline' || store.status === 'error' || store.status === 'conflict';
  return <Page>
    <View style={{ alignItems: 'center', gap: 12, paddingTop: 8 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
        {auth.profile?.display_name ? <Text style={{ color: theme.mode === 'dark' ? colors.text : colors.primary, fontFamily: fonts.semibold, fontSize: 30 }}>{letters}</Text> : <SymbolView name="person.fill" size={38} tintColor={theme.mode === 'dark' ? colors.text : colors.primary} />}
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text accessibilityRole="header" style={[theme.typography.title, { color: colors.text }]}>{name}</Text>
        <Text style={[theme.typography.subtitle, { color: colors.textMuted }]}>{auth.user?.email || 'Saved on this device'}</Text>
      </View>
    </View>

    {syncIssue ? <Card tone="alt" style={{ gap: 12, padding: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="warning" size={20} color={colors.warning} />
        <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 16 }}>{store.status === 'conflict' ? 'Changed on another device' : store.status === 'offline' ? 'Offline' : 'Not synced'}</Text>
      </View>
      <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 }}>{store.status === 'conflict' ? 'Export your edits, or replace them with the cloud copy.' : store.error || 'Your edits are safe on this device.'}</Text>
      {store.status === 'conflict'
        ? <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Action label="Export" onPress={exportBackup} /></View><View style={{ flex: 1 }}><Action label="Use cloud" onPress={discard} danger /></View></View>
        : <Action label={busy ? 'Working…' : 'Try again'} onPress={() => void (store.status === 'error' && !store.dirty ? reload() : sync())} disabled={busy} />}
    </Card> : null}

    <GroupLabel>Appearance</GroupLabel>
    <Card style={{ gap: 20, padding: 20 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Colour theme" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {palettes.map(palette => { const on = theme.palette === palette.id; const swatch = themeColors.light[palette.id]; return <PressableScale key={palette.id} onPress={() => theme.setPalette(palette.id)} scaleTo={0.9}
          accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={palette.name} style={{ alignItems: 'center', gap: 8 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, padding: 3, borderWidth: 2, borderColor: on ? colors.primary : 'transparent' }}>
            <View style={{ flex: 1, borderRadius: 25, overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ flex: 1, backgroundColor: swatch.primary }} /><View style={{ flex: 1, backgroundColor: swatch.accent }} />
            </View>
          </View>
          <Text style={{ color: on ? colors.text : colors.textMuted, fontFamily: on ? fonts.semibold : fonts.regular, fontSize: 13 }}>{palette.name}</Text>
        </PressableScale>; })}
      </View>
      <SegmentedControl label="Appearance" stretch value={theme.modePreference} onChange={theme.setMode}
        options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
    </Card>

    <GroupLabel>Account</GroupLabel>
    <Group>
      {auth.user ? <Row leading={<RowIcon name="edit" />} title="Travel profile" onPress={() => setEditingProfile(true)} /> : <Row leading={<RowIcon name="people" />} title="Sign in or create account" onPress={auth.leaveGuestMode} />}
      <Row leading={<RowIcon name="download" />} title="Back up workspace" onPress={exportBackup} />
      {props.trip ? <Row leading={<RowIcon name="calendar" />} title="Share trip calendar" onPress={exportCalendar} /> : null}
      {props.trip ? <Row leading={<RowIcon name="bag" />} title="Share packing list" onPress={exportPacking} /> : null}
      {auth.user ? <Row leading={<RowIcon name="logout" tone="danger" />} title="Sign out" onPress={signOut} trailing={<View />} /> : null}
    </Group>
  </Page>;
}

function RowIcon({ name, tone }: { name: IconName; tone?: 'danger' }) {
  const { colors, mode } = useTheme();
  return <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
    <Icon name={name} size={18} color={tone === 'danger' ? colors.danger : mode === 'dark' ? colors.text : colors.primary} />
  </View>;
}
