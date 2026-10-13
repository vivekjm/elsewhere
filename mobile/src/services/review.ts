/** Store review prompt, at most once per app version and only after a good moment (a finished trip's recap). */
import * as Application from 'expo-application';
import Storage from 'expo-sqlite/kv-store';
import * as StoreReview from 'expo-store-review';

const KEY = 'tripsloom.review.askedVersion';

export async function askForReview(): Promise<void> {
  try {
    const version = Application.nativeApplicationVersion ?? '0';
    if ((await Storage.getItem(KEY)) === version) return;
    if (!(await StoreReview.hasAction())) return;
    await Storage.setItem(KEY, version);
    await StoreReview.requestReview();
  } catch { /* Never block the app on a review prompt. */ }
}
