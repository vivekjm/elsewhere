/**
 * Reels people share to Trips Loom, kept on this phone until they become a trip. Each is read once (caption,
 * hashtags, cover text) and saved, so sharing three Goa reels over a month builds up a Goa plan. Nothing here
 * leaves the phone.
 */
import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { destinationHints, reelLink, tagsIn, type Reel } from '../domain/reels';
import { coverTextOf, fetchReel } from './reels';

const KEY = 'tripsloom.reels.v1';
const MAX = 200;

let reels: Reel[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const reading = new Set<string>();
const listeners = new Set<() => void>();
let snapshot = { reels, reading: [...reading] };

function emit() {
  snapshot = { reels, reading: [...reading] };
  for (const l of listeners) l();
}
const save = () => { void Storage.setItem(KEY, JSON.stringify(reels.slice(0, MAX))).catch(() => {}); };

export function loadInbox(): Promise<void> {
  if (loaded) return Promise.resolve();
  loading ??= Storage.getItem(KEY).then((raw) => {
    try { const list = raw ? JSON.parse(raw) as Reel[] : []; if (Array.isArray(list)) reels = [...list.filter((r) => r && typeof r.id === 'string'), ...reels.filter((r) => !list.some((x) => x?.id === r.id))]; } catch { /* Start empty. */ }
    loaded = true;
    emit();
  }).catch(() => { loaded = true; });
  return loading;
}

export function useInbox() {
  return useSyncExternalStore((l) => { listeners.add(l); void loadInbox(); return () => listeners.delete(l); }, () => snapshot);
}

export const inboxReel = (id: string) => reels.find((r) => r.id === id) ?? null;

function put(reel: Reel) {
  reels = [reel, ...reels.filter((r) => r.id !== reel.id)].slice(0, MAX);
  save();
  emit();
}

/**
 * Saves a shared link (or text containing one) and reads it. Returns its id at once; the reel fills in as it's
 * read. A reel already saved isn't read again (unless `refresh`).
 */
export async function addToInbox(input: string, refresh = false): Promise<string | null> {
  await loadInbox();
  const link = reelLink(input);
  if (!link) return null;
  const had = reels.find((r) => r.id === link.id);
  const shared = input.replace(/https?:\/\/\S+/g, ' ').trim();
  if (had && !refresh) {
    // Bring it to the top; keep anything newly shared with it.
    put({ ...had, notes: shared && !had.notes.includes(shared) ? `${had.notes}\n${shared}`.trim() : had.notes });
    return had.id;
  }
  if (reading.has(link.id)) return link.id;
  reading.add(link.id);
  // A placeholder shows straight away while the post is read.
  if (!had) put({ ...link, author: '', handle: '', postedAt: '', likes: null, comments: null, title: '', caption: '', hashtags: [], mentions: [], keywords: [], thumbnail: '', coverText: '', notes: shared, status: 'ok', savedAt: new Date().toISOString() });
  else emit();
  try {
    const reel = await fetchReel(input);
    if (reel) {
      const keep = reels.find((r) => r.id === reel.id);
      put({ ...reel, notes: [keep?.notes, reel.notes].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('\n').trim(), savedAt: keep?.savedAt ?? reel.savedAt });
      // Cover text comes after: the caption is enough to start.
      void coverTextOf(reel).then((coverText) => { const now = reels.find((r) => r.id === reel.id); if (coverText && now) put({ ...now, coverText }); });
    }
  } finally {
    reading.delete(link.id);
    emit();
  }
  return link.id;
}

export function updateReel(id: string, patch: Partial<Pick<Reel, 'notes' | 'caption'>>) {
  const r = reels.find((x) => x.id === id);
  if (!r) return;
  // A caption pasted by hand (the post was private or unreachable) is read like any other.
  put({ ...r, ...patch, ...(patch.caption !== undefined ? { hashtags: tagsIn(`${patch.caption}\n${r.title}`), status: patch.caption.trim() ? 'ok' : r.status } : {}) });
}

export function removeFromInbox(ids: string[]) {
  reels = reels.filter((r) => !ids.includes(r.id));
  save();
  emit();
}

/** Saved reels grouped by where they're about ("Goa · 3 reels"), most recent first. */
export function byDestination(list: Reel[]): { name: string; reels: Reel[] }[] {
  const groups = new Map<string, Reel[]>();
  for (const r of list) {
    const name = r.status === 'unreachable' && !r.caption ? 'Couldn’t read' : destinationHints([r])[0]?.name ?? 'Somewhere';
    groups.set(name, [...(groups.get(name) ?? []), r]);
  }
  return [...groups.entries()].map(([name, rs]) => ({ name, reels: rs })).sort((a, b) => (b.reels[0]?.savedAt ?? '').localeCompare(a.reels[0]?.savedAt ?? ''));
}
