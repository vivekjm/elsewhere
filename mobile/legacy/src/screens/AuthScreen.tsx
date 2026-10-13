import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '../data';
import { AppButton, SegmentedControl, TextField, useTheme, fonts, Wordmark } from '../design';
import { Muted, Page, Surface, Title } from './shared';

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'recover';
export function AuthScreen({ onRetry }: { onRetry?: () => void } = {}) {
  const auth = useAuth();
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>(auth.recovery ? 'recover' : 'sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (auth.recovery) setMode('recover'); }, [auth.recovery]);
  const switchMode = (value: Mode) => { setMode(value); setError(''); setNotice(''); setPassword(''); setConfirmation(''); };
  const submit = async () => {
    setError(''); setNotice('');
    if (mode !== 'recover' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (mode === 'sign-up' && name.trim().length < 2) return setError('Tell us what we should call you.');
    if (mode !== 'forgot' && password.length < 8) return setError('Use at least 8 characters for your password.');
    if ((mode === 'sign-up' || mode === 'recover') && password !== confirmation) return setError('Those passwords do not match.');
    setBusy(true);
    try {
      if (mode === 'sign-in') await auth.signIn(email.trim(), password);
      if (mode === 'sign-up') { const result = await auth.signUp(email.trim(), password, name.trim()); setNotice(result.needsEmailConfirmation ? 'Check your email to confirm your account, then return to Trips Loom.' : 'Your account is ready. Let’s make it yours.'); }
      if (mode === 'forgot') { await auth.sendPasswordReset(email.trim()); setNotice('A reset link is on its way. Check your inbox.'); }
      if (mode === 'recover') { await auth.updatePassword(password); switchMode('sign-in'); setNotice('Your password is updated. Sign in with it next time.'); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const configured = auth.phase === 'ready';
  return <Page><View style={{ paddingTop: 32, paddingBottom: 12, gap: 16 }}><Wordmark size={32} /><Text style={{ color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, letterSpacing: 2.4 }}>A LITTLE SPACE FOR THE JOURNEY</Text><Title size={32}>Plan the days you’ll talk about for years.</Title><Muted>Keep the route, the wardrobe and the small details in one calm place.</Muted></View>
    <Surface>{auth.phase === 'loading' ? <><ActivityIndicator color={colors.primary} /><Muted>Opening your account…</Muted></> : !configured ? <><Title size={23}>{auth.phase === 'error' ? 'We couldn’t open sign-in.' : 'Sign-in is being connected.'}</Title><Muted>You can explore a visitor workspace while account sign-in is unavailable.</Muted><Muted>{auth.phase === 'error' ? 'Check your connection and try again.' : 'Account services may not be configured for this environment yet.'}</Muted>{onRetry ? <AppButton label="Retry sign-in" variant="secondary" onPress={onRetry} /> : null}<AppButton label="Continue as guest" onPress={auth.enterGuestMode} /></> : <><Title size={24}>{mode === 'sign-up' ? 'Make room for your next chapter.' : mode === 'forgot' ? 'A way back to your plans.' : mode === 'recover' ? 'Choose a new password.' : 'Welcome back.'}</Title><Muted>{mode === 'sign-up' ? 'Create a private space for your trips, clothes and details.' : mode === 'forgot' ? 'We’ll email a secure reset link.' : mode === 'recover' ? 'Choose a strong new password.' : 'Your trips, all together.'}</Muted>{mode === 'sign-in' || mode === 'sign-up' ? <SegmentedControl label="Account" stretch value={mode === 'sign-up' ? 'sign-up' : 'sign-in'} onChange={value => switchMode(value)} options={[{ value: 'sign-in', label: 'Sign in' }, { value: 'sign-up', label: 'Create account' }]} /> : null}{mode === 'sign-up' ? <TextField label="Your name" value={name} onChangeText={setName} autoComplete="name" placeholder="The name you like to travel by" /> : null}{mode !== 'recover' ? <TextField label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" /> : null}{mode !== 'forgot' ? <TextField label={mode === 'recover' ? 'New password' : 'Password'} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" /> : null}{mode === 'sign-up' || mode === 'recover' ? <TextField label="Confirm password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" /> : null}{error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 21, fontFamily: fonts.regular }}>{error}</Text> : null}{notice ? <Text accessibilityRole="alert" style={{ color: colors.success, lineHeight: 21, fontFamily: fonts.regular }}>{notice}</Text> : null}<AppButton label={mode === 'sign-up' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'recover' ? 'Update password' : 'Sign in'} onPress={() => void submit()} loading={busy} />{mode === 'sign-in' ? <Pressable accessibilityRole="button" onPress={() => switchMode('forgot')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, textAlign: 'center', fontFamily: fonts.semibold }}>Forgot password?</Text></Pressable> : mode === 'forgot' || mode === 'recover' ? <Pressable accessibilityRole="button" onPress={() => switchMode('sign-in')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, textAlign: 'center', fontFamily: fonts.semibold }}>Back to sign in</Text></Pressable> : null}<View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 }}><AppButton label="Continue as guest" variant="secondary" onPress={auth.enterGuestMode} /></View></>}</Surface>
    <Muted>Your plans stay private to your account.</Muted>
  </Page>;
}
