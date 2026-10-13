import Storage from 'expo-sqlite/kv-store';

/** GET JSON with a timeout. Returns null on any failure: every caller has an offline path. */
export async function getJSON<T>(url: string, timeoutMs = 12000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Entry<T> = { at: number; value: T };

/** A small persistent cache: returns a fresh value, or loads, stores and returns it; falls back to a stale copy offline. */
export async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T | null>): Promise<T | null> {
  const storageKey = `tripsloom.cache.${key}`;
  let stale: Entry<T> | null = null;
  try {
    const raw = await Storage.getItem(storageKey);
    if (raw) stale = JSON.parse(raw) as Entry<T>;
  } catch { /* A bad entry is refetched. */ }
  if (stale && Date.now() - stale.at < maxAgeMs) return stale.value;
  const value = await load();
  if (value !== null) {
    void Storage.setItem(storageKey, JSON.stringify({ at: Date.now(), value })).catch(() => {});
    return value;
  }
  return stale?.value ?? null;
}
