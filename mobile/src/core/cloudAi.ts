/**
 * Permission to use the cloud AI provider. Planning sends text to it (posts' words, what you typed, and for ideas the
 * trip's destination, places, group size, food and budget), so the person is asked once, the first time it would
 * happen, and can change it in Data & privacy (App Review 5.1.2(i): disclose sharing with third-party AI and get
 * explicit permission first). Until they say yes, nothing goes to the cloud; Apple's on-device model needs no
 * permission because nothing leaves the phone.
 */
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { track } from './analytics';
import { usePrefs } from './state';

/** Where each provider is, in words people can weigh. */
const ABOUT: Record<string, string> = {
  DeepSeek: 'DeepSeek, an AI company whose servers are in China',
  Gemini: 'Google’s Gemini',
  OpenAI: 'OpenAI',
};

export function useCloudAi() {
  const prefs = usePrefs();
  const choice = prefs.native.cloudAi;
  /** True when the cloud may be used: already allowed, or allowed now when asked. */
  const confirm = useCallback(async (label: string): Promise<boolean> => {
    if (choice === 'on') return true;
    if (choice === 'off') return false;
    const allowed = await new Promise<boolean>((resolve) => {
      Alert.alert(`Use ${label} for AI planning?`, [
        `To find places in posts and suggest ideas, Trips Loom sends some text to ${ABOUT[label] ?? label}: the posts’ public text, what you type into the planner, and the trip’s destination, places, group size, food and budget.`,
        'Never your name, email, documents or other trips.',
        'You can change this any time in Profile → Data & privacy.',
      ].join('\n\n'), [
        { text: 'Don’t allow', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Allow', onPress: () => resolve(true) },
      ], { cancelable: false });
    });
    track('ai_consent', { allowed });
    await prefs.update({ native: { cloudAi: allowed ? 'on' : 'off' } }).catch(() => {});
    return allowed;
  }, [choice, prefs]);
  return { choice, allowed: choice !== 'off', confirm, set: (on: boolean) => prefs.update({ native: { cloudAi: on ? 'on' : 'off' } }) };
}
