import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, Share, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useRouter } from '../core/nav';
import * as Application from 'expo-application';
import * as LocalAuthentication from 'expo-local-authentication';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import { FREE_DOCUMENTS_PER_TRIP, FREE_DRAFTS_PER_MONTH, PRO_MONTHLY, PRO_YEARLY, usePro } from '../core/pro';
import { reportError, usePrefs, useTrips } from '../core/state';
import { useAuth, useExtras, type FeedbackKind } from '../data';
import { initials, plural } from '../domain/format';
import { travelStats } from '../domain/trips';
import { lookup } from '../services/places';
import {
  Avatar, Button, Card, colors, CurrencyField, EmptyState, Field, FieldLabel, fonts, Group, Header, Hero, HeroText, Icon, IconTile, PlaceField, Radio, radii,
  RoundButton, Row, RowView, Screen, Section, Segmented, shadows, Sheet, Stack, T, Tag, Toggle,
  useDirty,
} from '../loom';
import { exportBackup } from '../services/exports';
import { notificationPermission, requestNotifications, type PermissionState } from '../services/notifications';
import { SyncBanner } from './home';
import { PRIVACY_URL, TERMS_URL } from './entry';

const SUPPORT_URL = 'https://tripsloom.com/help';

function usePermission(): [PermissionState, () => void] {
  const [state, setState] = useState<PermissionState>('undetermined');
  const refresh = React.useCallback(() => { void notificationPermission().then(setState); }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);
  return [state, refresh];
}

/* ------------------------------------------------------------------ Profile */

export function ProfileScreen() {
  const prefs = usePrefs();
  const auth = useAuth();
  const pro = usePro();
  const router = useRouter();
  const { trips } = useTrips();
  const [permission, refresh] = usePermission();
  // Country for each destination ("Barcelona" → "Spain"), from the cached place lookup.
  const [countries, setCountries] = useState<Record<string, string>>({});
  const destinations = [...new Set(trips.map((t) => t.destination))].join('|');
  useEffect(() => {
    let active = true;
    void Promise.all(destinations.split('|').filter(Boolean).map(async (d) => [d, (await lookup(d).catch(() => null))?.country ?? ''] as const))
      .then((pairs) => { if (active) setCountries(Object.fromEntries(pairs)); });
    return () => { active = false; };
  }, [destinations]);
  const notificationsOn = prefs.native.notifications && permission === 'granted';
  const toggleNotifications = async (on: boolean) => {
    if (on && permission !== 'granted') {
      const result = permission === 'denied' ? 'denied' : await requestNotifications();
      refresh();
      if (result !== 'granted') {
        Alert.alert('Notifications are off', 'Turn them on for Trips Loom in Settings to get trip reminders.', [
          { text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
    }
    await prefs.update({ native: { notifications: on } }).catch((e) => reportError(e));
  };
  const signOut = () => Alert.alert('Sign out?', 'Your trips stay saved to your account. Anything not yet synced on this phone is kept for next time.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => void auth.signOut().catch((e) => reportError(e, 'Couldn’t sign out')) },
  ]);
  return <Screen bar="tabs">
    <Header big title="Profile" right={<RoundButton icon="edit" label="Edit profile" href="/preferences" />} />
    <SyncBanner />
    <Card>
      <RowView gap={14}>
        <Avatar initials={initials(prefs.name || prefs.email || '?')} tint="peach" size={60} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="title" lines={1}>{prefs.name || 'Your name'}</T>
          <T v="small" lines={1}>{[prefs.email, prefs.homeBase.split(',')[0]].filter(Boolean).join(' · ')}</T>
        </View>
      </RowView>
      <RowView gap={8} style={{ flexWrap: 'wrap' }}>
        <Tag text={prefs.unit === 'metric' ? 'Metric' : 'Imperial'} tint="grey" /><Tag text={prefs.currency} tint="grey" />
        <Tag text={plural(trips.length, 'trip')} />{pro.isPro ? <Tag text="Pro" tint="mint" /> : null}
      </RowView>
    </Card>
    {trips.length ? (() => {
      const st = travelStats(trips, undefined, (d) => countries[d] ?? '');
      const tile = (value: string | number, label: string) => <View style={{ flex: 1, gap: 2 }}><T v="title" style={{ fontSize: 24 }}>{value}</T><T v="meta">{label}</T></View>;
      return <Section title="Your travels">
        <Card>
          <RowView gap={12} align="flex-start">{tile(st.trips, st.trips === 1 ? 'trip' : 'trips')}{tile(st.countries.length, st.countries.length === 1 ? 'country' : 'countries')}{tile(st.days, st.days === 1 ? 'day away' : 'days away')}</RowView>
          {st.countries.length ? <T v="small">{st.countries.join(' · ')}</T> : <T v="small">Your first trip starts soon.</T>}
          <T v="meta">{[st.upcoming ? `${plural(st.upcoming, 'trip')} ahead` : '', st.longest ? `longest ${plural(st.longest, 'day')}` : ''].filter(Boolean).join(' · ')}</T>
        </Card>
      </Section>;
    })() : null}
    {pro.isPro ? <Card><RowView gap={12}><IconTile icon="crown" tint="mint" /><View style={{ flex: 1, gap: 2 }}>
      <T v="row" style={{ fontSize: 15 }}>Trips Loom Pro</T><T v="meta">Unlimited AI drafts and documents. Thank you.</T></View>
      <Pressable accessibilityRole="button" onPress={pro.manage} hitSlop={8}><T v="small" style={{ fontFamily: fonts.semibold }}>Manage</T></Pressable></RowView></Card>
      : <Hero padding={18}>
        <RowView style={{ justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}><HeroText v="row" style={{ fontSize: 18 }}>Trips Loom Pro</HeroText><HeroText v="small">Unlimited AI drafts and documents{pro.draftsLeft !== null ? ` · ${pro.draftsLeft} of ${FREE_DRAFTS_PER_MONTH} drafts left this month` : ''}</HeroText></View>
          <Button label="See plans" kind="white" full={false} height={44} href="/paywall" />
        </RowView>
      </Hero>}
    <Group>
      <Row icon="globe" title="Travel preferences" meta="Name, home base, units, currency" href="/preferences" />
      <Row icon="bell" title="Trip reminders" meta={permission === 'denied' ? 'Off in Settings' : notificationsOn ? 'Evening before, each morning' : 'Off'}
        trailing={<Toggle value={notificationsOn} onChange={(on) => void toggleNotifications(on)} label="Trip reminders" />} />
      {Platform.OS === 'ios' ? <Row icon="activity" title="Live Activity" meta="Today’s next plan on the Lock Screen"
        trailing={<Toggle value={prefs.native.liveActivities} onChange={(on) => void prefs.update({ native: { liveActivities: on } }).catch((e) => reportError(e))} label="Live Activity" />} /> : null}
      <Row icon="help" title="Help & feedback" href="/help" />
      <Row icon="shield" title="Data & privacy" meta="Export, permissions, delete account" href="/privacy" />
    </Group>
    <Button label="Sign out" icon="logout" kind="white" onPress={signOut} />
    <T v="meta" center>Trips Loom {Application.nativeApplicationVersion ?? ''} ({Application.nativeBuildVersion ?? ''})</T>
  </Screen>;
}

/* ------------------------------------------------------------------ Preferences */

export function PreferencesScreen() {
  const prefs = usePrefs();
  const router = useRouter();
  const [name, setName] = useState(prefs.name);
  const [homeBase, setHomeBase] = useState(prefs.homeBase);
  const [unit, setUnit] = useState(prefs.unit);
  const [currency, setCurrency] = useState(prefs.currency);
  const [tripTimeZone, setTripTimeZone] = useState(prefs.native.tripTimeZone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim()) { setError('Enter your name.'); return; }
    setBusy(true);
    try {
      await prefs.update({ display_name: name, home_base: homeBase, unit, native: { currency, tripTimeZone } });
      router.back();
    } catch (e) { reportError(e); } finally { setBusy(false); }
  };
  return <Screen gap={18} footer={<Button label="Save" icon="check" leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void save()} />}>
    <Header title="Travel preferences" />
    <Section title="About you">
      <Stack gap={14}>
        <Field label="Name" value={name} onChangeText={(t) => { setName(t); setError(''); }} icon="profile" kind="name" error={error} maxLength={80} />
        <PlaceField label="Home base" value={homeBase} onChange={setHomeBase} placeholder="Where you usually start from" />
      </Stack>
      <T v="small" style={{ paddingHorizontal: 4 }}>Your name shows on trips you share. Your home base stays private.</T>
    </Section>
    <Section title="Units"><Segmented options={['Metric', 'Imperial']} value={unit === 'metric' ? 'Metric' : 'Imperial'} onChange={(v) => setUnit(v === 'Metric' ? 'metric' : 'imperial')} /></Section>
    <CurrencyField label="Home currency" value={currency} onChange={setCurrency} />
    <Group>
      <Row icon="clock" title="Trip time zone" meta="Show plan times in the destination’s time" trailing={<Toggle value={tripTimeZone} onChange={setTripTimeZone} label="Trip time zone" />} />
      <Row icon="cloud" title="Temperatures" meta={unit === 'metric' ? 'Celsius, from your units' : 'Fahrenheit, from your units'} trailing={null} />
    </Group>
  </Screen>;
}

/* ------------------------------------------------------------------ Help & feedback */

export function HelpScreen() {
  const router = useRouter();
  const open = (kind: FeedbackKind) => router.push({ pathname: '/feedback', params: { kind } } as never);
  return <Screen gap={18}>
    <Header title="Help & feedback" />
    <Section title="Getting started">
      <Group>
        <Row icon="sparkle" title="Draft a trip with AI" meta="Describe it, get days and packing" href="/planner" />
        <Row icon="wardrobe" title="Build your wardrobe" meta="Outfits come from what you own" href="/trip/wardrobe" />
        <Row icon="shared" title="Share a trip" meta="Split costs and vote on plans" href="/shared" />
        <Row icon="mail" title="Import bookings" meta="Paste a confirmation email" href="/import-bookings" />
      </Group>
    </Section>
    <Section title="Report an issue or share an idea">
      <Group>
        <Row icon="x" tint="rose" title="Something isn’t working" onPress={() => open('issue')} />
        <Row icon="sparkle" tint="peach" title="Feature idea" onPress={() => open('idea')} />
        <Row icon="help" tint="lavender" title="Question" onPress={() => open('question')} />
      </Group>
    </Section>
    <Section title="About">
      <Group>
        <Row icon="star" title="Rate Trips Loom" onPress={() => void StoreReview.requestReview().catch(() => {})} />
        <Row icon="share" title="Tell a friend" meta="Share Trips Loom with someone who travels" onPress={() => void Share.share({ message: 'I plan my trips with Trips Loom: days, packing, budgets and shared costs in one place. https://tripsloom.com' }).catch(() => {})} />
        <Row icon="globe" title="Help centre" onPress={() => void WebBrowser.openBrowserAsync(SUPPORT_URL)} />
        <Row icon="doc" title="Terms of use" onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)} />
        <Row icon="shield" title="Privacy policy" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
        <Row icon="trips" title="Version" meta={`${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})`} trailing={null} />
      </Group>
    </Section>
  </Screen>;
}

const KINDS: { kind: FeedbackKind; label: string }[] = [{ kind: 'issue', label: 'Something isn’t working' }, { kind: 'idea', label: 'Feature idea' }, { kind: 'question', label: 'Question' }];

export function FeedbackSheet() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: FeedbackKind }>();
  const [kind, setKind] = useState<FeedbackKind>(params.kind ?? 'issue');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = useDirty([kind, message]);
  const send = async () => {
    setBusy(true);
    try {
      await auth.sendFeedback(kind, message);
      Alert.alert('Thanks — we’ve got it', 'We read every message. If you asked a question, we’ll reply by email.');
      router.back();
    } catch (e) { reportError(e, 'Couldn’t send'); } finally { setBusy(false); }
  };
  return <Sheet title="Send feedback" dirty={dirty} footer={<Button label="Send" icon="mail" leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void send()} />}>
    <Group>{KINDS.map((k) => <Row key={k.kind} title={k.label} trailing={<Radio on={kind === k.kind} />} onPress={() => setKind(k.kind)} />)}</Group>
    <Field label="Message" value={message} onChangeText={setMessage} multiline maxLength={4000} placeholder={kind === 'issue' ? 'What happened, and what did you expect?' : 'Tell us more…'}
      hint={`${message.trim().length}/4000 · at least 10 characters. We include the app version and language, never your trips.`} />
  </Sheet>;
}

/* ------------------------------------------------------------------ Data & privacy */

export function PrivacyScreen() {
  const auth = useAuth();
  const prefs = usePrefs();
  const { workspace } = useTrips();
  const extras = useExtras();
  const [permission] = usePermission();
  const [busy, setBusy] = useState<string | null>(null);
  const [biometrics, setBiometrics] = useState<string>('');
  useEffect(() => {
    void (async () => {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const types = hardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
      setBiometrics(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? (Platform.OS === 'ios' ? 'Face ID' : 'face unlock')
        : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ? (Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint') : '');
    })();
  }, []);
  const exportAll = async () => {
    if (!workspace) return;
    setBusy('export');
    try { await exportBackup(workspace, extras.all); } catch (e) { reportError(e, 'Couldn’t export'); } finally { setBusy(null); }
  };
  const setLock = async (on: boolean) => {
    if (on) {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) { Alert.alert('Set up a passcode first', 'Add Face ID, Touch ID or a passcode in Settings to lock documents.'); return; }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Lock documents' });
      if (!result.success) return;
    }
    await prefs.update({ native: { lockDocuments: on } }).catch((e) => reportError(e));
  };
  const deleteAccount = () => Alert.alert('Delete your account?', 'This permanently deletes your account, trips, wardrobe photos and preferences on every device. It can’t be undone. Export a backup first if you want a copy.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete everything', style: 'destructive', onPress: () => Alert.alert('Are you sure?', 'Your account and all its data will be gone.', [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy('delete');
        try { await auth.deleteAccount(); } catch (e) { reportError(e, 'Couldn’t delete your account'); } finally { setBusy(null); }
      } },
    ]) },
  ]);
  return <Screen gap={18}>
    <Header title="Data & privacy" />
    <Section title="Your data">
      <Group>
        <Row icon="export" title="Export everything" meta="Trips, wardrobe and extras as a JSON backup" onPress={() => void exportAll()}
          trailing={busy === 'export' ? <ActivityIndicator color={colors.ember} /> : 'chev'} />
        <Row icon="lock" title="Lock documents" meta={biometrics ? `Ask for ${biometrics} to open documents` : 'Ask for your passcode to open documents'}
          trailing={<Toggle value={prefs.native.lockDocuments} onChange={(on) => void setLock(on)} label="Lock documents" />} />
      </Group>
    </Section>
    <Section title="Permissions">
      <Group>
        <Row icon="bell" title="Notifications" meta={permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Not allowed' : 'Not asked yet'} onPress={() => void Linking.openSettings()} />
        <Row icon="image" title="Photos" meta="Only the photos you pick for wardrobe pieces" onPress={() => void Linking.openSettings()} />
      </Group>
      <T v="small" style={{ paddingHorizontal: 4 }}>Trips Loom never tracks you or shares your data for advertising.</T>
    </Section>
    <Section title="Services we use">
      <Group>
        <Row icon="cloud" title="Weather, places and tides" meta="Open-Meteo · only the destination is sent" trailing={null} />
        <Row icon="card" title="Exchange rates" meta="open.er-api.com · only the currency is sent" trailing={null} />
        <Row icon="sparkle" title="AI drafts" meta="Written on this phone where supported; prompts aren’t stored" trailing={null} />
        <Row icon="doc" title="Documents" meta="Files stay on this phone; only their names sync" trailing={null} />
      </Group>
    </Section>
    <Section title="Account">
      <Group><Row icon="trash" tint="rose" title="Delete account" meta="Removes your account and all its data" onPress={deleteAccount}
        trailing={busy === 'delete' ? <ActivityIndicator color={colors.danger} /> : 'chev'} /></Group>
    </Section>
  </Screen>;
}

/* ------------------------------------------------------------------ Paywall */

function Feature({ icon, title, sub }: { icon: 'sparkle' | 'doc' | 'shared' | 'map'; title: string; sub: string }) {
  return <RowView gap={14}><IconTile icon={icon} tint="peach" /><View style={{ flex: 1, gap: 2 }}><T v="row" style={{ fontSize: 15 }}>{title}</T><T v="meta">{sub}</T></View></RowView>;
}

function Plan({ name, price, sub, on, onPress }: { name: string; price: string; sub: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${name}, ${price || 'price shown at checkout'}, ${sub}`} onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.card, backgroundColor: on ? colors.inkButton : colors.card, boxShadow: on ? shadows.lift : shadows.rest }}>
    <View style={{ flex: 1, gap: 2 }}><T v="row" color={on ? '#FFFFFF' : undefined}>{name}</T><T v="meta" color={on ? 'rgba(255,255,255,0.8)' : undefined}>{sub}</T></View>
    {/* Until the store answers (or when it can't), say so instead of a bare dash. */}
    {price ? <T v="title" style={{ fontSize: 18 }} color={on ? '#FFFFFF' : undefined}>{price}</T>
      : <T v="meta" color={on ? 'rgba(255,255,255,0.7)' : undefined}>Price at checkout</T>}
    <Radio on={on} />
  </Pressable>;
}

export function PaywallScreen() {
  const router = useRouter();
  const pro = usePro();
  const [plan, setPlan] = useState(PRO_YEARLY);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const buy = async () => {
    setBusy('buy');
    const ok = await pro.buy(plan);
    setBusy(null);
    if (ok) { Alert.alert('Welcome to Pro', 'Unlimited drafts and documents are on.'); router.back(); }
  };
  const restore = async () => {
    setBusy('restore');
    await pro.restore();
    setBusy(null);
  };
  const yearly = pro.priceOf(PRO_YEARLY), monthly = pro.priceOf(PRO_MONTHLY);
  // Show what the annual plan saves against twelve monthly payments, from the store's own prices.
  const priceNum = (sku: string) => (pro.products.find((p) => p.id === sku) as { price?: number | null } | undefined)?.price ?? 0;
  const saving = priceNum(PRO_MONTHLY) > 0 && priceNum(PRO_YEARLY) > 0 ? Math.round((1 - priceNum(PRO_YEARLY) / (priceNum(PRO_MONTHLY) * 12)) * 100) : 0;
  // Trial wording only when the store actually offers one, so the copy always matches the purchase sheet.
  const trial = pro.trialOf(plan);
  const yearlyTrial = pro.trialOf(PRO_YEARLY), monthlyTrial = pro.trialOf(PRO_MONTHLY);
  const terms = plan === PRO_YEARLY
    ? `${yearly ? `${yearly} a year` : 'Billed yearly'}${trial ? ` after the ${trial} free trial` : ''}`
    : `${monthly ? `${monthly} a month` : 'Billed monthly'}${trial ? ` after the ${trial} free trial` : ''}`;
  return <Screen footer={<>
    {pro.isPro ? <Button label="Manage subscription" onPress={pro.manage} /> : <Button label={trial ? `Start ${trial} free trial` : plan === PRO_YEARLY ? 'Subscribe yearly' : 'Subscribe monthly'}
      leading={busy === 'buy' ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void buy()} />}
    <T v="meta" center>{terms} · renews automatically until cancelled in Settings</T>
    <RowView gap={16} style={{ justifyContent: 'center' }}>
      <Pressable accessibilityRole="button" onPress={() => void restore()} hitSlop={8}><T v="meta" color={colors.ink} style={{ fontFamily: fonts.semibold }}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</T></Pressable>
      <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)} hitSlop={8}><T v="meta" color={colors.ink} style={{ fontFamily: fonts.semibold }}>Terms</T></Pressable>
      <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} hitSlop={8}><T v="meta" color={colors.ink} style={{ fontFamily: fonts.semibold }}>Privacy</T></Pressable>
    </RowView>
  </>}>
    <RowView style={{ justifyContent: 'flex-end' }}><RoundButton icon="x" label="Close" onPress={() => router.back()} /></RowView>
    <Hero gap={10}>
      <HeroText faint style={{ fontFamily: fonts.semibold, fontSize: 14 }}>Trips Loom Pro</HeroText>
      <HeroText v="display" style={{ fontSize: 34, lineHeight: 38, letterSpacing: -0.8 }}>Plan less.{'\n'}Go further.</HeroText>
      <HeroText v="small" style={{ fontSize: 14 }}>{pro.isPro ? 'You’re on Pro. Thank you for supporting Trips Loom.' : 'Unlimited AI drafts and documents on every trip.'}</HeroText>
    </Hero>
    <Card>
      <Feature icon="sparkle" title="Unlimited AI planning" sub={`Free accounts get ${FREE_DRAFTS_PER_MONTH} drafts a month`} />
      <Feature icon="doc" title="Unlimited documents" sub={`Free accounts keep ${FREE_DOCUMENTS_PER_TRIP} per trip`} />
      <Feature icon="shared" title="Everything else stays free" sub="Shared trips, packing, budgets, widgets and reminders" />
    </Card>
    {!pro.isPro ? <Stack gap={10}>
      <Plan name={saving >= 5 ? `Yearly · save ${saving}%` : 'Yearly'} price={yearly} sub={yearlyTrial ? `${yearlyTrial} free trial, then billed yearly` : 'Billed yearly, cancel any time'} on={plan === PRO_YEARLY} onPress={() => setPlan(PRO_YEARLY)} />
      <Plan name="Monthly" price={monthly} sub={monthlyTrial ? `${monthlyTrial} free trial, then billed monthly` : 'Billed monthly, cancel any time'} on={plan === PRO_MONTHLY} onPress={() => setPlan(PRO_MONTHLY)} />
      {!pro.ready ? <T v="meta" center>Connecting to the {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}…</T> : null}
    </Stack> : null}
  </Screen>;
}

