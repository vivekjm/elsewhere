import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth, type OnboardingInput } from '../data';
import { AppButton, TextField, useTheme, fonts, Wordmark } from '../design';
import { Chip, Muted, Page, Surface, Title } from './shared';

const travelStyles = [
  { value: 'slow and scenic', label: 'Slow and scenic', detail: 'Long walks, quiet corners, and room to wander.' },
  { value: 'city weekends', label: 'City weekends', detail: 'Good neighbourhoods, full days, and no wasted time.' },
  { value: 'food and culture', label: 'Food and culture', detail: 'Markets, museums, local tables, and stories to bring home.' },
  { value: 'outdoors and open air', label: 'Outdoors and open air', detail: 'Fresh air, scenic routes, and a little healthy effort.' },
  { value: 'a little of everything', label: 'A little of everything', detail: 'The best parts of a place at your own pace.' },
];
const interests = ['Food and drink', 'Architecture', 'Nature', 'Art and design', 'Local life', 'Rest and slow mornings'];
const packingStyles = [
  { value: 'light and considered', label: 'Light and considered', detail: 'Fewer pieces, more combinations.' },
  { value: 'ready for anything', label: 'Ready for anything', detail: 'A thoughtful safety net for changing plans.' },
  { value: 'comfort first', label: 'Comfort first', detail: 'The right layers and familiar favourites.' },
];
export function OnboardingScreen({ onCancel, onComplete }: { onCancel?: () => void; onComplete?: () => void } = {}) {
  const auth = useAuth();
  const { colors } = useTheme();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingInput>(() => ({
    display_name: auth.profile?.display_name || String(auth.user?.user_metadata?.display_name || auth.user?.email?.split('@')[0] || ''),
    home_base: auth.profile?.home_base || '',
    travel_style: auth.profile?.travel_style || 'a little of everything',
    interests: auth.profile?.interests?.length ? auth.profile.interests : ['Food and drink', 'Local life'],
    packing_style: auth.profile?.packing_style || 'light and considered',
    unit: auth.profile?.unit || 'metric',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof OnboardingInput>(key: K, value: OnboardingInput[K]) => { setDraft(current => ({ ...current, [key]: value })); setError(''); };
  const next = async () => {
    if (step === 1 && (draft.display_name.trim().length < 2 || draft.home_base.trim().length < 2)) return setError('Add your name and home base.');
    if (step === 3 && draft.interests.length === 0) return setError('Choose at least one interest.');
    if (step < 4) return setStep(step + 1);
    setBusy(true); setError('');
    try { await auth.completeOnboarding({ ...draft, display_name: draft.display_name.trim(), home_base: draft.home_base.trim() }); onComplete?.(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save your travel profile.'); }
    finally { setBusy(false); }
  };
  const choice = (label: string, detail: string, selected: boolean, onPress: () => void) => <Pressable key={label} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={{ minHeight: 70, borderRadius: 14, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accentSoft : colors.surface, padding: 14, gap: 4 }}><Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.semibold }}>{label}</Text><Muted>{detail}</Muted></Pressable>;
  return <Page><View style={{ gap: 8, paddingTop: 16 }}><Wordmark size={30} /><Muted>YOUR TRAVEL PROFILE · {step} OF 4</Muted><View style={{ height: 5, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}><View style={{ height: 5, width: `${step * 25}%`, backgroundColor: colors.primary }} /></View></View><Surface>{step === 1 ? <><Title>Let’s make this feel like yours.</Title><Muted>A couple of small details help keep your journey personal.</Muted><TextField label="What should we call you?" value={draft.display_name} onChangeText={value => update('display_name', value)} placeholder="Your name or favourite nickname" autoComplete="name" /><TextField label="Where do you set off from?" value={draft.home_base} onChangeText={value => update('home_base', value)} placeholder="City or region" /></> : null}{step === 2 ? <><Title>What kind of trips pull you in?</Title><Muted>Choose the rhythm that sounds most like you.</Muted>{travelStyles.map(style => choice(style.label, style.detail, draft.travel_style === style.value, () => update('travel_style', style.value)))}</> : null}{step === 3 ? <><Title>What would you love more of?</Title><Muted>Choose a few details you enjoy noticing on a trip.</Muted><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{interests.map(interest => <Chip key={interest} label={interest} selected={draft.interests.includes(interest)} onPress={() => update('interests', draft.interests.includes(interest) ? draft.interests.filter(value => value !== interest) : [...draft.interests, interest])} />)}</View></> : null}{step === 4 ? <><Title>How should we help you pack?</Title><Muted>Choose your packing style and weight units.</Muted>{packingStyles.map(style => choice(style.label, style.detail, draft.packing_style === style.value, () => update('packing_style', style.value)))}<Text style={{ color: colors.text, fontFamily: fonts.semibold, marginTop: 8 }}>Weight units</Text><View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Kilograms" selected={draft.unit === 'metric'} onPress={() => update('unit', 'metric')} /><Chip label="Pounds" selected={draft.unit === 'imperial'} onPress={() => update('unit', 'imperial')} /></View></> : null}{error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontFamily: fonts.regular }}>{error}</Text> : null}<View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}><View style={{ flex: 1 }}>{step > 1 || onCancel ? <AppButton label={step > 1 ? 'Back' : 'Cancel'} variant="secondary" onPress={() => step > 1 ? setStep(step - 1) : onCancel?.()} disabled={busy} /> : null}</View><View style={{ flex: 1 }}><AppButton label={step === 4 ? 'Open Trips Loom' : 'Continue'} onPress={() => void next()} loading={busy} /></View></View></Surface></Page>;
}
