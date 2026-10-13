import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useRouter } from '../core/nav';
import * as WebBrowser from 'expo-web-browser';
import { useAuth, type NativePreferences } from '../data';
import { usePrefs } from '../core/state';
import { setPendingLanding } from '../core/landing';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button, Checkbox, colors, CurrencySheet, EmberBackdrop, Field, FieldLabel, fonts, Group, HeroText, IconTile, Illustration,
  maxScale, Note, PlaceField, Radio, radii, RoundButton, RowView, Screen, Segmented, shadows, Stack, Steps, T, Title, type IconName,
} from '../loom';
import { COMMON_CURRENCIES, currencyName } from '../services/currency';

export const TERMS_URL = 'https://tripsloom.com/terms';
export const PRIVACY_URL = 'https://tripsloom.com/privacy';

function Wordmark() {
  return <RowView gap={10} style={{ alignSelf: 'flex-start', paddingVertical: 10, paddingLeft: 12, paddingRight: 14, borderRadius: radii.button, backgroundColor: 'rgba(255,255,255,0.9)' }}>
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round">
      <Path d="M3 16c6 0 6-8 12-8s6 8 6 8" stroke={colors.ink} />
      <Path d="M3 8c6 0 6 8 12 8s6-8 6-8" stroke={colors.ember} />
    </Svg>
    <Text maxFontSizeMultiplier={maxScale(15)} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Trips Loom</Text>
  </RowView>;
}

/** Three woven threads, drawn to fill the band between the top chips and the headline on any screen height. */
function WovenLines({ width, top, bottom }: { width: number; top: number; bottom: number }) {
  const band = Math.max(0, bottom - top);
  if (band < 40) return null;
  const gap = Math.min(24, band / 5);
  const amp = Math.max(6, Math.min(40, (band - 2 * gap) / 2 - 4));
  const mid = top + band / 2;
  const x = (f: number) => (f * width).toFixed(1);
  const line = (y: number) => `M-10 ${y} C${x(0.25)} ${y - amp} ${x(0.4)} ${y + amp} ${x(0.65)} ${y} S${x(0.95)} ${y - amp} ${width + 10} ${y}`;
  const ys = [mid - gap, mid, mid + gap];
  return <Svg width={width} height={bottom + amp} style={{ position: 'absolute', top: 0, left: 0 }}>
    {ys.map((y) => <Path key={y} d={line(y)} stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.85} />)}
    <Circle cx={Number(x(0.35))} cy={ys[0] - amp * 0.05} r={4} fill="#FFFFFF" opacity={0.9} />
    <Circle cx={Number(x(0.65))} cy={ys[2]} r={4} fill="#FFFFFF" opacity={0.9} />
    <Circle cx={Number(x(0.89))} cy={ys[1] - amp * 0.75} r={4} fill="#FFFFFF" opacity={0.9} />
  </Svg>;
}

function AppleMark() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="#FFFFFF"><Path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.8 3-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.5.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-4.1zM14 5.2c.7-.8 1.1-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3z" /></Svg>;
}

function GoogleMark() {
  return <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" fill="#4285F4" />
    <Path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
    <Path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" fill="#FBBC05" />
    <Path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" fill="#EA4335" />
  </Svg>;
}


/** Runs a sign-in action, showing a spinner on its button and any error in an alert. */
function useSignIn() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    try { await action(); } catch (error) {
      Alert.alert('Couldn’t sign in', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(null); }
  };
  return { busy, run };
}

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const frame = useSafeAreaFrame();
  const auth = useAuth();
  const { busy, run } = useSignIn();
  // The sign-in sheet needs ~330pt; the hero takes what is left (470 on a 6.3" phone, less on an SE), never under 300.
  const heroHeight = Math.max(300, Math.min(470, frame.height - 330 - insets.bottom));
  const spinner = (key: string, color = '#FFFFFF') => busy === key ? <ActivityIndicator color={color} /> : undefined;
  return <ScrollView style={{ flex: 1, backgroundColor: colors.card }} contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.canvas }} bounces={false} showsVerticalScrollIndicator={false}>
    <View style={{ height: heroHeight }}>
      <Illustration name="threadsBg" width="100%" height="100%" style={{ position: 'absolute' }} />
      <WovenLines width={frame.width} top={insets.top + 64} bottom={heroHeight - (heroHeight < 420 ? 40 : 52) - 112} />
      <View style={{ position: 'absolute', top: insets.top + 10, left: 20 }}><Wordmark /></View>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: heroHeight < 420 ? 40 : 52, gap: 10 }}>
        <HeroText faint style={{ fontSize: 15 }}>Welcome</HeroText>
        <HeroText v="hero" style={{ letterSpacing: -0.8 }}>Every trip,{'\n'}woven together.</HeroText>
      </View>
    </View>
    <View style={{ flex: 1, marginTop: -20, backgroundColor: colors.card, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, padding: 20, paddingTop: 28, paddingBottom: insets.bottom + 16, gap: 18, boxShadow: '0px -12px 40px rgba(30,30,30,0.08)' }}>
      <T v="body">Days, outfits and packing in one plan, built from your wardrobe and the forecast.</T>
      <View style={{ marginTop: 'auto', gap: 10 }}>
        {auth.appleAvailable ? <Button label="Continue with Apple" leading={spinner('apple') ?? <AppleMark />}
          onPress={() => run('apple', auth.signInWithApple)} /> : null}
        <Button label="Continue with Google" kind="mist" leading={spinner('google', colors.ink) ?? <GoogleMark />}
          onPress={() => run('google', auth.signInWithGoogle)} />
        <Button label="Continue with email" kind="mist" onPress={() => router.push('/email-sign-in' as never)} />
        <T v="meta" center style={{ marginTop: 6, lineHeight: 18 }}>By continuing you agree to the{' '}
          <Text accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)} style={{ fontFamily: fonts.semibold, color: colors.ink }}>Terms</Text> and{' '}
          <Text accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} style={{ fontFamily: fonts.semibold, color: colors.ink }}>Privacy Policy</Text>.</T>
      </View>
    </View>
  </ScrollView>;
}

type Mode = 'sign-in' | 'sign-up' | 'reset';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function EmailSignInScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [notice, setNotice] = useState('');

  const submit = async () => {
    const next: typeof errors = {};
    if (!EMAIL.test(email.trim())) next.email = 'Enter a valid email address.';
    if (mode !== 'reset' && password.length < (mode === 'sign-up' ? 8 : 1)) next.password = mode === 'sign-up' ? 'Use at least 8 characters.' : 'Enter your password.';
    if (mode === 'sign-up' && !name.trim()) next.name = 'Enter your name.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true); setNotice('');
    try {
      if (mode === 'sign-in') await auth.signIn(email, password);
      else if (mode === 'sign-up') {
        const { needsEmailConfirmation } = await auth.signUp(email, password, name);
        if (needsEmailConfirmation) { setNotice(`We sent a confirmation link to ${email.trim()}. Open it on this phone to finish creating your account.`); setMode('sign-in'); }
      } else {
        await auth.sendPasswordReset(email);
        setNotice(`If ${email.trim()} has an account, a reset link is on its way. Open it on this phone.`);
        setMode('sign-in');
      }
    } catch (error) {
      setNotice('');
      Alert.alert(mode === 'reset' ? 'Couldn’t send the link' : 'Couldn’t sign in', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  };

  const title = mode === 'sign-in' ? 'Sign in with email' : mode === 'sign-up' ? 'Create your account' : 'Reset your password';
  const sub = mode === 'reset' ? 'We’ll email you a link to choose a new password.' : mode === 'sign-up' ? 'One account for your trips on this phone and on the web.' : 'Use the email and password from Trips Loom on the web or this app.';
  return <Screen footer={<>
    <Button label={mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'} icon={busy ? undefined : 'chev'}
      leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void submit()} />
    <Button label={mode === 'sign-in' ? 'New here? Create an account' : 'I already have an account'} kind="white"
      onPress={() => { setErrors({}); setNotice(''); setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); }} />
  </>}>
    <RowView><RoundButton icon="back" back label="Back" /></RowView>
    <Title title={title} sub={sub} />
    {notice ? <View style={{ padding: 14, borderRadius: radii.card, backgroundColor: '#D6F0E3' }}><T v="small" color="#1C6B45">{notice}</T></View> : null}
    <Stack gap={14}>
      {mode === 'sign-up' ? <Field label="Your name" value={name} onChangeText={setName} icon="profile" kind="name" error={errors.name} returnKeyType="next" maxLength={80} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} icon="mail" kind="email" error={errors.email} returnKeyType={mode === 'reset' ? 'send' : 'next'}
        onSubmitEditing={mode === 'reset' ? () => void submit() : undefined} />
      {mode !== 'reset' ? <Field label="Password" value={password} onChangeText={setPassword} icon="lock" secure={!show} kind={show ? 'text' : 'password'} error={errors.password}
        hint={mode === 'sign-up' ? 'At least 8 characters.' : undefined} returnKeyType="go" onSubmitEditing={() => void submit()}
        trailing={<Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} hitSlop={10} onPress={() => setShow(!show)}>
          <IconTile icon={show ? 'eyeOff' : 'eye'} size={32} bg="transparent" color={colors.stone} />
        </Pressable>} /> : null}
    </Stack>
    {mode === 'sign-in' ? <Pressable accessibilityRole="button" onPress={() => { setErrors({}); setNotice(''); setMode('reset'); }} style={{ paddingHorizontal: 4, minHeight: 44, justifyContent: 'center' }}>
      <T v="small" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>Forgot password?</T>
    </Pressable> : null}
  </Screen>;
}

export function ResetPasswordScreen() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    setBusy(true);
    try { await auth.updatePassword(password); Alert.alert('Password updated', 'Use your new password next time you sign in.'); }
    catch (e) { Alert.alert('Couldn’t update your password', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <Screen footer={<Button label="Save new password" leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={() => void save()} />}>
    <Title title="Choose a new password" sub="You opened a reset link. Pick a password you haven’t used before." />
    <Field label="New password" value={password} onChangeText={setPassword} icon="lock" kind="password" secure error={error} hint="At least 8 characters." autoFocus />
  </Screen>;
}

/* ------------------------------------------------------------------ Onboarding */

/** Answers carried between the four onboarding steps. */
const draft: { name: string; homeBase: string; intent: NativePreferences['intent']; focus: string[]; unit: 'metric' | 'imperial'; currency: string; seeded: boolean } = {
  name: '', homeBase: '', intent: 'shaping', focus: ['outfits', 'budget', 'friends'], unit: 'metric', currency: 'EUR', seeded: false,
};

function OnboardingTop({ step, onSkip }: { step: number; onSkip: () => void }) {
  return <RowView style={{ justifyContent: 'space-between' }}>
    {step > 1 ? <RoundButton icon="back" back label="Back" /> : <View style={{ width: 48 }} />}
    <Steps n={step} />
    <Pressable accessibilityRole="button" accessibilityLabel="Skip setup" onPress={onSkip}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radii.button, backgroundColor: colors.card, boxShadow: shadows.button }}>
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Skip</Text>
    </Pressable>
  </RowView>;
}

function OptionCard({ icon, title, sub, on, onPress }: { icon: IconName; title: string; sub: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${title}. ${sub}`} onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.card, overflow: 'hidden', backgroundColor: on ? undefined : colors.card, boxShadow: on ? shadows.lift : shadows.rest }}>
    {on ? <EmberBackdrop variant="option" /> : null}
    <IconTile icon={icon} size={48} bg={on ? 'rgba(255,255,255,0.25)' : colors.canvas} color={on ? '#FFFFFF' : colors.ink} />
    <View style={{ flex: 1, gap: 2 }}>
      <T v="row" color={on ? '#FFFFFF' : undefined}>{title}</T>
      <T v="small" color={on ? 'rgba(255,255,255,0.92)' : undefined}>{sub}</T>
    </View>
    <Radio on={on} />
  </Pressable>;
}

const FOCUS: [string, IconName, string][] = [
  ['outfits', 'wardrobe', 'Outfits & packing'], ['budget', 'card', 'Budget & splitting'], ['documents', 'doc', 'Documents'],
  ['friends', 'shared', 'Travelling with friends'], ['adventure', 'mountain', 'Adventure & safety'], ['ai', 'sparkle', 'AI planning'],
];

function FocusTile({ icon, title, on, onPress }: { icon: IconName; title: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={title} onPress={onPress}
    style={{ flex: 1, gap: 14, padding: 16, borderRadius: radii.card, backgroundColor: on ? colors.inkButton : colors.card, boxShadow: on ? shadows.dark : shadows.rest }}>
    <RowView style={{ justifyContent: 'space-between' }}>
      <IconTile icon={icon} size={40} bg={on ? 'rgba(255,255,255,0.14)' : colors.canvas} color={on ? '#FFFFFF' : colors.ink} />
      <Checkbox checked={on} accent={colors.ember} />
    </RowView>
    <T v="row" style={{ fontSize: 15 }} color={on ? '#FFFFFF' : undefined}>{title}</T>
  </Pressable>;
}

function CurrencyRow({ code, on, onPress }: { code: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={currencyName(code)} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
    <View style={{ width: 52, height: 44, borderRadius: radii.iconTile, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>{code}</Text>
    </View>
    <T v="row" style={{ flex: 1, fontSize: 15 }}>{currencyName(code)}</T>
    <Radio on={on} />
  </Pressable>;
}

/** Where Finish lands for each answer to "What brings you here?". */
const LANDING: Record<NativePreferences['intent'], string> = { booked: '/new-trip', shaping: '/planner', looking: '/discover' };

export function OnboardingScreen() {
  const { step: raw } = useLocalSearchParams<{ step: string }>();
  const step = Math.min(4, Math.max(1, Number(raw) || 1));
  const router = useRouter();
  const auth = useAuth();
  const prefs = usePrefs();
  if (!draft.seeded) {
    draft.seeded = true;
    draft.name = prefs.name; draft.homeBase = prefs.homeBase; draft.unit = prefs.unit; draft.currency = prefs.currency;
  }
  const [, rerender] = useState(0);
  const set = (fn: () => void) => { fn(); rerender((n) => n + 1); };
  const [nameError, setNameError] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async (skip: boolean) => {
    const name = draft.name.trim() || prefs.name || 'Traveller';
    setBusy(true);
    try {
      await auth.completeOnboarding({
        display_name: name, home_base: draft.homeBase.trim(), unit: draft.unit,
        native: skip ? { currency: draft.currency } : { intent: draft.intent, focus: draft.focus, currency: draft.currency },
      });
      if (!skip) setPendingLanding(LANDING[draft.intent]);
      draft.seeded = false;
    } catch (error) {
      Alert.alert('Couldn’t save your answers', error instanceof Error ? error.message : 'Check your connection and try again.');
    } finally { setBusy(false); }
  };
  const next = () => {
    if (step === 1 && !draft.name.trim()) { setNameError('Enter your name. It shows on trips you share.'); return; }
    if (step < 4) router.push(`/onboarding/${step + 1}` as never); else void finish(false);
  };
  const currencies = [...new Set([draft.currency, ...COMMON_CURRENCIES.slice(0, 4)])];
  const helper = step === 4 ? 'Rates update when you’re online and work offline after.' : 'You can change this any time from your profile.';
  return <Screen gap={20} footer={<>
    <Note center>{helper}</Note>
    <Button label={step === 4 ? 'Finish' : 'Continue'} icon={busy ? undefined : 'chev'} leading={busy ? <ActivityIndicator color="#FFFFFF" /> : undefined} onPress={next} />
  </>}>
    <OnboardingTop step={step} onSkip={() => void finish(true)} />
    {step === 1 ? <>
      <Title eyebrow="Let’s set you up" title="First, the basics" sub="Your name goes on shared trips. Your home base sets time zones and currency defaults." />
      <Stack gap={14}>
        <Field label="Your name" value={draft.name} onChangeText={(t) => set(() => { draft.name = t; setNameError(''); })} icon="profile" kind="name" error={nameError} maxLength={80} />
        <PlaceField label="Home base" value={draft.homeBase} onChange={(t) => set(() => { draft.homeBase = t; })} placeholder="Where you usually start from" />
      </Stack>
      <Note>We never show your home base to other travellers.</Note>
    </> : null}
    {step === 2 ? <>
      <Title eyebrow="Your next trip" title="What brings you here?" sub="We’ll take you straight to the right place when you finish." />
      <Stack gap={12}>
        <OptionCard icon="plane" title="A trip that’s already booked" sub="Add the dates and bookings; we’ll build the days around them." on={draft.intent === 'booked'} onPress={() => set(() => { draft.intent = 'booked'; })} />
        <OptionCard icon="sparkle" title="A trip I’m still shaping" sub="Describe it and get a first draft of days, stays and packing." on={draft.intent === 'shaping'} onPress={() => set(() => { draft.intent = 'shaping'; })} />
        <OptionCard icon="discover" title="Just looking for now" sub="Browse ideas, and start a trip whenever you’re ready." on={draft.intent === 'looking'} onPress={() => set(() => { draft.intent = 'looking'; })} />
      </Stack>
    </> : null}
    {step === 3 ? <>
      <Title eyebrow="Focus" title="What matters most?" sub="Pick as many as you like. We’ll put these first on every trip." />
      <Stack gap={10}>
        {[0, 2, 4].map((i) => <RowView key={i} align="stretch">
          {FOCUS.slice(i, i + 2).map(([key, icon, title]) => <FocusTile key={key} icon={icon} title={title} on={draft.focus.includes(key)}
            onPress={() => set(() => { draft.focus = draft.focus.includes(key) ? draft.focus.filter((f) => f !== key) : [...draft.focus, key]; })} />)}
        </RowView>)}
      </Stack>
    </> : null}
    {step === 4 ? <>
      <Title eyebrow="Almost there" title="Units & currency" sub="Weather, distances and budgets will use these everywhere." />
      <Stack gap={8}><FieldLabel>Units</FieldLabel>
        <Segmented options={['Metric', 'Imperial']} value={draft.unit === 'metric' ? 'Metric' : 'Imperial'} onChange={(v) => set(() => { draft.unit = v === 'Metric' ? 'metric' : 'imperial'; })} />
      </Stack>
      <Stack gap={8}><FieldLabel>Home currency</FieldLabel>
        <Group>
          {currencies.map((c) => <CurrencyRow key={c} code={c} on={draft.currency === c} onPress={() => set(() => { draft.currency = c; })} />)}
          <Pressable accessibilityRole="button" onPress={() => setCurrencyOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
            <IconTile icon="search" size={44} />
            <T v="row" style={{ flex: 1, fontSize: 15 }}>Another currency…</T>
          </Pressable>
        </Group>
      </Stack>
      <CurrencySheet visible={currencyOpen} value={draft.currency} onPick={(c) => set(() => { draft.currency = c; })} onClose={() => setCurrencyOpen(false)} />
    </> : null}
  </Screen>;
}
