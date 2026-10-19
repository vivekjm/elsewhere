/**
 * Where a shared reel lands. Sharing from Instagram, YouTube or TikTok (the iOS share sheet, Android's share
 * target) saves the link, starts reading it, and opens plan mode with it; a second share while plan mode is open
 * joins the same plan.
 */
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useShareIntentContext } from 'expo-share-intent';
import { useRouter } from './nav';
import { track } from './analytics';
import { reelLink } from '../domain/reels';
import { addToInbox } from '../services/reelInbox';

export function ShareInbox() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const router = useRouter();
  useEffect(() => {
    if (!hasShareIntent) return;
    const text = [shareIntent.text, shareIntent.webUrl && !shareIntent.text?.includes(shareIntent.webUrl) ? shareIntent.webUrl : ''].filter(Boolean).join(' ').trim();
    resetShareIntent();
    const link = reelLink(text);
    if (!link) {
      Alert.alert('Share a reel or post', 'Trips Loom plans from links: share a reel, a post or a YouTube Short to it, and it reads the caption for places.');
      return;
    }
    track('reel_shared', { platform: link.platform });
    void addToInbox(text).then((id) => {
      if (id) router.navigate({ pathname: '/plan-mode', params: { reel: id } } as never);
    });
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);
  return null;
}
