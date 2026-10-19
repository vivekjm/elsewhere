/**
 * Plans in progress, kept on this phone so planning can stop and pick up again later (the Plan tab lists them).
 * A draft is saved while plan mode is open and removed when it becomes a trip. Nothing here leaves the phone.
 */
import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';
import type { Answers, PlanPlace } from '../domain/planmode';
import type { Brief, Trek } from '../domain/brief';
import type { Region } from './reels';

export type DraftTurn = { role: 'you' | 'ai' | 'quick'; text: string; changes?: string[] };
export type PlanDraft = {
  id: string;
  /** "Goa · 4 days", or the start of what was typed. */
  title: string;
  updatedAt: string;
  step: number;
  typed: string;
  reelIds: string[];
  dest: { name: string; region: Region | null } | null;
  places: PlanPlace[];
  answers: Answers | null;
  why: Partial<Record<keyof Answers, string>>;
  touched: (keyof Answers)[];
  whenMode: 'pick' | 'group';
  turns: DraftTurn[];
  /** What AI understood from the sentence, and a trek's current route (after any changes). */
  brief?: Brief | null;
  trek?: Trek | null;
};

const KEY = 'tripsloom.plans.v1';
const MAX = 12;

let drafts: PlanDraft[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() { for (const l of listeners) l(); }
const persist = () => { void Storage.setItem(KEY, JSON.stringify(drafts)).catch(() => {}); };

export function loadDrafts(): Promise<void> {
  if (loaded) return Promise.resolve();
  loading ??= Storage.getItem(KEY).then((raw) => {
    try {
      const list = raw ? JSON.parse(raw) as PlanDraft[] : [];
      if (Array.isArray(list)) drafts = list.filter((d) => d && typeof d.id === 'string' && Array.isArray(d.places)).slice(0, MAX);
    } catch { /* Start empty. */ }
    loaded = true;
    emit();
  }).catch(() => { loaded = true; });
  return loading;
}

/** Plans in progress, most recent first. */
export function useDrafts(): PlanDraft[] {
  return useSyncExternalStore((l) => { listeners.add(l); void loadDrafts(); return () => listeners.delete(l); }, () => drafts);
}

export const draftById = async (id: string) => { await loadDrafts(); return drafts.find((d) => d.id === id) ?? null; };

export function saveDraft(d: PlanDraft) {
  drafts = [d, ...drafts.filter((x) => x.id !== d.id)].slice(0, MAX);
  persist();
  emit();
}

export function removeDraft(id: string) {
  if (!drafts.some((d) => d.id === id)) return;
  drafts = drafts.filter((d) => d.id !== id);
  persist();
  emit();
}
