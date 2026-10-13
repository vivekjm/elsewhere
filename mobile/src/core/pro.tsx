import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { deepLinkToSubscriptions, isUserCancelledError, useIAP, type Product, type Purchase } from 'expo-iap';
import { useAuth } from '../data';

export const PRO_YEARLY = 'com.tripsloom.pro.yearly';
export const PRO_MONTHLY = 'com.tripsloom.pro.monthly';
export const PRO_SKUS = [PRO_YEARLY, PRO_MONTHLY];
/** Free accounts get this many AI trip drafts a calendar month. */
export const FREE_DRAFTS_PER_MONTH = 3;
/** Free accounts can keep this many documents on each trip. */
export const FREE_DOCUMENTS_PER_TRIP = 3;

const PRO_CACHE = 'tripsloom.pro.v1';
const monthKey = () => new Date().toISOString().slice(0, 7);

type ProValue = {
  isPro: boolean;
  ready: boolean;
  products: Product[];
  priceOf: (sku: string) => string;
  /** "7-day" or "1-month" when the store offers this subscription with a free trial, else null. */
  trialOf: (sku: string) => string | null;
  buy: (sku: string) => Promise<boolean>;
  restore: () => Promise<boolean>;
  manage: () => void;
  draftsLeft: number | null;
  /** Counts an AI draft; false when the free allowance for the month is used up. */
  useDraft: () => Promise<boolean>;
};
const ProContext = createContext<ProValue | null>(null);

export function ProProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  // The last known state, so an offline launch keeps Pro on until the store answers.
  const [cachedPro, setCachedPro] = useState(false);
  const pendingBuy = useRef<((ok: boolean) => void) | null>(null);
  useEffect(() => { void Storage.getItem(PRO_CACHE).then((v) => setCachedPro(v === '1')).catch(() => {}); }, []);

  const iap = useIAP({
    onPurchaseSuccess: (purchase: Purchase) => {
      void iap.finishTransaction({ purchase, isConsumable: false }).catch(() => {});
      void iap.getActiveSubscriptions(PRO_SKUS).catch(() => {});
      pendingBuy.current?.(true); pendingBuy.current = null;
    },
    onPurchaseError: (error) => {
      if (!isUserCancelledError(error)) Alert.alert('Purchase didn’t go through', error.message || 'Please try again.');
      pendingBuy.current?.(false); pendingBuy.current = null;
    },
  });

  useEffect(() => {
    if (!iap.connected) return;
    void iap.fetchProducts({ skus: PRO_SKUS, type: 'subs' }).catch(() => {});
    void iap.getActiveSubscriptions(PRO_SKUS).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iap.connected]);

  const storePro = iap.activeSubscriptions.some((s) => PRO_SKUS.includes(s.productId) && s.isActive);
  const answered = iap.connected && iap.subscriptions.length > 0;
  const isPro = storePro || (!answered && cachedPro);
  useEffect(() => {
    if (!answered && !storePro) return;
    setCachedPro(storePro);
    void Storage.setItem(PRO_CACHE, storePro ? '1' : '0').catch(() => {});
  }, [answered, storePro]);

  const products = iap.subscriptions as unknown as Product[];
  const priceOf = useCallback((sku: string) => products.find((p) => p.id === sku)?.displayPrice ?? '', [products]);
  const trialOf = useCallback((sku: string) => {
    const product = products.find((p) => p.id === sku) as unknown as { subscriptionOffers?: { paymentMode?: string | null; price?: number; period?: { unit: string; value: number } | null; periodCount?: number | null }[] } | undefined;
    const offer = product?.subscriptionOffers?.find((o) => o.paymentMode === 'free-trial' || o.price === 0);
    if (!offer?.period || !['day', 'week', 'month', 'year'].includes(offer.period.unit)) return null;
    const count = offer.period.value * (offer.periodCount && offer.periodCount > 0 ? offer.periodCount : 1);
    return count > 0 ? `${count}-${offer.period.unit}` : null;
  }, [products]);

  const buy = useCallback(async (sku: string) => {
    if (!iap.connected) { Alert.alert('The App Store isn’t available', 'Check your connection and try again.'); return false; }
    if (!iap.subscriptions.some((p) => p.id === sku)) { Alert.alert('Subscriptions aren’t available right now', 'Please try again later.'); return false; }
    const product = iap.subscriptions.find((p) => p.id === sku) as unknown as { subscriptionOffers?: { offerTokenAndroid?: string; offerToken?: string }[] } | undefined;
    const done = new Promise<boolean>((resolve) => { pendingBuy.current = resolve; });
    try {
      const token = product?.subscriptionOffers?.[0]?.offerTokenAndroid ?? product?.subscriptionOffers?.[0]?.offerToken;
      await iap.requestPurchase({
        type: 'subs',
        request: {
          apple: { sku, appAccountToken: auth.user?.id },
          google: { skus: [sku], ...(token ? { subscriptionOffers: [{ sku, offerToken: token }] } : {}) },
        },
      } as never);
    } catch (error) {
      pendingBuy.current = null;
      if (!isUserCancelledError(error as never)) Alert.alert('Purchase didn’t go through', error instanceof Error ? error.message : 'Please try again.');
      return false;
    }
    return done;
  }, [iap, auth.user?.id]);

  const restore = useCallback(async () => {
    try {
      await iap.restorePurchases();
      await iap.getActiveSubscriptions(PRO_SKUS);
      return true;
    } catch (error) {
      Alert.alert('Couldn’t restore purchases', error instanceof Error ? error.message : 'Please try again.');
      return false;
    }
  }, [iap]);

  const manage = useCallback(() => {
    void deepLinkToSubscriptions({ skuAndroid: PRO_YEARLY, packageNameAndroid: 'com.tripsloom.app' } as never).catch(() => {
      Alert.alert('Manage subscription', Platform.OS === 'ios' ? 'Open Settings › your name › Subscriptions.' : 'Open Google Play › Payments & subscriptions.');
    });
  }, []);

  const prefs = auth.profile?.native_preferences;
  const used = prefs?.aiDraftMonth === monthKey() ? prefs.aiDraftCount : 0;
  const draftsLeft = isPro ? null : Math.max(0, FREE_DRAFTS_PER_MONTH - used);
  const useDraft = useCallback(async () => {
    if (isPro) return true;
    if ((draftsLeft ?? 0) <= 0) return false;
    await auth.updateProfile({ native: { aiDraftMonth: monthKey(), aiDraftCount: used + 1 } }).catch(() => {});
    return true;
  }, [isPro, draftsLeft, used, auth]);

  const value = useMemo<ProValue>(() => ({
    isPro, ready: iap.connected, products, priceOf, trialOf, buy, restore, manage, draftsLeft, useDraft,
  }), [isPro, iap.connected, products, priceOf, trialOf, buy, restore, manage, draftsLeft, useDraft]);
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProValue {
  const value = useContext(ProContext);
  if (!value) throw new Error('usePro must be used inside ProProvider.');
  return value;
}
