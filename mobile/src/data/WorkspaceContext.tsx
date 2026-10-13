import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { API_ORIGIN, ApiError, apiFetch, guestId, photoSource as privatePhotoSource, responseJson, uploadPhoto, type PrivatePhotoSource } from './backend';
import { useAuth } from './AuthContext';
import { workspaceSchema, type Workspace, emptyWorkspace } from './model';

export type WorkspaceStatus = 'loading' | 'saved' | 'pending' | 'saving' | 'offline' | 'error' | 'conflict';
type CachedWorkspace = { version: 1; revision: number; dirty: boolean; workspace: Workspace };
type WorkspaceContextValue = {
  workspace: Workspace | null;
  status: WorkspaceStatus;
  error: string;
  dirty: boolean;
  change: (edit: (draft: Workspace) => void) => void;
  sync: () => Promise<void>;
  reload: () => Promise<void>;
  discardAndReload: () => Promise<void>;
  exportPendingWorkspace: () => string | null;
  uploadWardrobePhoto: (uri: string, mimeType?: string) => Promise<string>;
  photoSource: (path: string) => PrivatePhotoSource;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const cacheKey = (owner: string) => `tripsloom.workspace.v1.${API_ORIGIN}.${owner}`;
const MAX_PAYLOAD_BYTES = 1_490_000;

function utf8Bytes(value: string): number {
  let count = 0;
  for (let index = 0; index < value.length; index++) {
    const codePoint = value.codePointAt(index)!;
    count += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    if (codePoint > 0xffff) index++;
  }
  return count;
}

function parseCache(value: string | null): CachedWorkspace | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CachedWorkspace>;
    if (parsed.version !== 1 || !Number.isSafeInteger(parsed.revision) || (parsed.revision ?? -1) < 0 ||
      typeof parsed.dirty !== 'boolean') return null;
    const workspace = workspaceSchema.parse(parsed.workspace);
    return { version: 1, revision: parsed.revision!, dirty: parsed.dirty, workspace };
  } catch { return null; }
}
function describe(error: unknown, guest = false): string {
  if (error instanceof ApiError && error.status === 401) {
    return guest ? 'This visitor workspace isn’t backed up yet. Your plans are saved on this device.'
      : 'Your session has expired. Sign in again to sync your changes.';
  }
  if (error instanceof Error && error.name === 'AbortError') return 'The connection timed out. Your edits are saved on this device.';
  return error instanceof Error ? error.message : 'Could not connect. Your edits are saved on this device.';
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [guestOwner, setGuestOwner] = useState<string | null>(null);
  const [guestStorageError, setGuestStorageError] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>('loading');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const owner = auth.user ? `user:${auth.user.id}` : auth.guestMode && guestOwner ? `guest:${guestOwner}` : null;
  const tokenRef = useRef<string | null>(null);
  const ownerRef = useRef<string | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const revisionRef = useRef(0);
  const generationRef = useRef(0);
  const savedRef = useRef(0);
  const blockedRef = useRef(false);
  const flightRef = useRef<Promise<void> | null>(null);
  const cacheQueueRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const epochRef = useRef(0);

  tokenRef.current = auth.session?.access_token || null;
  useEffect(() => { void guestId().then(setGuestOwner).catch(() => setGuestStorageError(true)); }, []);

  const cache = useCallback((keyOwner: string, value: CachedWorkspace) => {
    const json = JSON.stringify(value);
    cacheQueueRef.current = cacheQueueRef.current.catch(() => {}).then(() => Storage.setItem(cacheKey(keyOwner), json));
    return cacheQueueRef.current;
  }, []);

  const fetchWorkspace = useCallback(async (): Promise<{ workspace: Workspace; revision: number }> => {
    const response = await apiFetch('/api/workspace', tokenRef.current);
    const data = await responseJson<{ workspace?: unknown; revision?: unknown }>(response);
    const validated = workspaceSchema.parse(data.workspace);
    if (!Number.isSafeInteger(data.revision) || (data.revision as number) < 0) throw new Error('The server returned an invalid revision.');
    return { workspace: validated, revision: data.revision as number };
  }, []);

  const sync = useCallback(async (): Promise<void> => {
    if (flightRef.current) return flightRef.current;
    const keyOwner = ownerRef.current;
    if (!keyOwner || !workspaceRef.current || blockedRef.current || savedRef.current === generationRef.current) return;
    // Without an account (the development preview) the workspace stays on this device and never reaches the server.
    if (keyOwner.startsWith('guest:')) {
      savedRef.current = generationRef.current;
      setDirty(false);
      setStatus('saved');
      await cache(keyOwner, { version: 1, revision: revisionRef.current, dirty: false, workspace: workspaceRef.current });
      return;
    }
    const epoch = epochRef.current;
    flightRef.current = (async () => {
      while (epoch === epochRef.current && ownerRef.current === keyOwner &&
        !blockedRef.current && workspaceRef.current && savedRef.current !== generationRef.current) {
        const snapshot = workspaceRef.current;
        const generation = generationRef.current;
        const revision = revisionRef.current;
        setStatus('saving');
        setError('');
        try {
          await cacheQueueRef.current;
          const response = await apiFetch('/api/workspace', tokenRef.current, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace: snapshot, revision }),
          });
          const data = await responseJson<{ revision?: unknown }>(response);
          if (!Number.isSafeInteger(data.revision) || data.revision !== revision + 1) throw new Error('The server returned an invalid revision.');
          if (epoch !== epochRef.current || ownerRef.current !== keyOwner) return;
          revisionRef.current = data.revision as number;
          savedRef.current = generation;
          const remaining = savedRef.current !== generationRef.current;
          setDirty(remaining);
          setStatus(remaining ? 'pending' : 'saved');
          await cache(keyOwner, {
            version: 1, revision: revisionRef.current, dirty: remaining,
            workspace: workspaceRef.current!,
          });
        } catch (cause) {
          if (epoch !== epochRef.current || ownerRef.current !== keyOwner) return;
          const conflict = cause instanceof ApiError && cause.status === 409;
          blockedRef.current = conflict;
          setDirty(true);
          setStatus(conflict ? 'conflict' : cause instanceof ApiError && cause.status < 500 ? 'error' : 'offline');
          setError(conflict
            ? 'This workspace changed on another device. Your edits remain saved here. Export them before loading the server version.'
            : describe(cause, ownerRef.current?.startsWith('guest:')));
          return;
        }
      }
    })().finally(() => { flightRef.current = null; });
    return flightRef.current;
  }, [cache]);

  const load = useCallback(async (keyOwner: string, force: boolean) => {
    const epoch = ++epochRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    ownerRef.current = keyOwner;
    if (flightRef.current) await flightRef.current;
    blockedRef.current = false;
    setError('');
    setStatus('loading');
    let cached: CachedWorkspace | null = null;
    try { cached = parseCache(await Storage.getItem(cacheKey(keyOwner))); } catch { /* Network can still load. */ }
    if (epoch !== epochRef.current) return;
    if (cached && !force) {
      workspaceRef.current = cached.workspace;
      revisionRef.current = cached.revision;
      generationRef.current = cached.dirty ? 1 : 0;
      savedRef.current = 0;
      setWorkspace(cached.workspace);
      setDirty(cached.dirty);
      setStatus(cached.dirty ? 'pending' : 'saved');
    } else if (!cached) {
      workspaceRef.current = null;
      setWorkspace(null);
      setDirty(false);
    }
    if (keyOwner.startsWith('guest:')) {
      if (!cached) {
        const local = emptyWorkspace();
        workspaceRef.current = local;
        revisionRef.current = 0;
        setWorkspace(local);
      }
      setStatus('saved');
      return;
    }
    try {
      const remote = await fetchWorkspace();
      if (epoch !== epochRef.current || ownerRef.current !== keyOwner) return;
      if (cached?.dirty && !force) {
        if (remote.revision !== cached.revision) {
          blockedRef.current = true;
          setStatus('conflict');
          setError('This workspace changed on another device. Your saved edits are available to export.');
        } else {
          await sync();
        }
        return;
      }
      workspaceRef.current = remote.workspace;
      revisionRef.current = remote.revision;
      generationRef.current = 0;
      savedRef.current = 0;
      setWorkspace(remote.workspace);
      setDirty(false);
      setStatus('saved');
      await cache(keyOwner, { version: 1, revision: remote.revision, dirty: false, workspace: remote.workspace });
    } catch (cause) {
      if (epoch !== epochRef.current || ownerRef.current !== keyOwner) return;
      setStatus(cached && !force ? 'offline' : 'error');
      setError(describe(cause, keyOwner.startsWith('guest:')));
    }
  }, [cache, fetchWorkspace, sync]);

  useEffect(() => {
    if (!owner || (auth.phase !== 'ready' && !auth.guestMode)) {
      epochRef.current++;
      ownerRef.current = null;
      workspaceRef.current = null;
      setWorkspace(null);
      setDirty(false);
      setStatus(auth.guestMode && guestStorageError ? 'error' : 'loading');
      setError(auth.guestMode && guestStorageError ? 'Could not open private device storage.' : '');
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    void load(owner, false);
  }, [owner, auth.phase, auth.guestMode, guestStorageError, load]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  const change = useCallback((edit: (draft: Workspace) => void) => {
    const keyOwner = ownerRef.current;
    if (!keyOwner || !workspaceRef.current) throw new Error('The workspace is still loading.');
    if (blockedRef.current) throw new Error('Resolve the sync conflict before editing this workspace.');
    const draft = JSON.parse(JSON.stringify(workspaceRef.current)) as Workspace;
    edit(draft);
    const next = workspaceSchema.parse(draft);
    const payload = JSON.stringify({ workspace: next, revision: revisionRef.current });
    if (utf8Bytes(payload) > MAX_PAYLOAD_BYTES) {
      throw new Error('This workspace is full. Export a backup before removing old trips.');
    }
    workspaceRef.current = next;
    generationRef.current++;
    setWorkspace(next);
    setDirty(true);
    setStatus('pending');
    setError('');
    void cache(keyOwner, { version: 1, revision: revisionRef.current, dirty: true, workspace: next })
      .catch(() => { setStatus('error'); setError('Could not save changes on this device. Check available storage.'); });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void sync(); }, 400);
  }, [cache, sync]);

  const reload = useCallback(async () => {
    if (generationRef.current !== savedRef.current) throw new Error('Your unsynced edits are saved here. Export or discard them before reloading.');
    if (ownerRef.current) await load(ownerRef.current, false);
  }, [load]);
  const discardAndReload = useCallback(async () => {
    const keyOwner = ownerRef.current;
    if (!keyOwner) return;
    if (flightRef.current) await flightRef.current;
    // Fetch first, so an offline attempt cannot erase the only local draft.
    const remote = await fetchWorkspace();
    ++epochRef.current;
    blockedRef.current = false;
    workspaceRef.current = remote.workspace;
    revisionRef.current = remote.revision;
    generationRef.current = 0;
    savedRef.current = 0;
    setWorkspace(remote.workspace);
    setDirty(false);
    setError('');
    setStatus('saved');
    await cache(keyOwner, { version: 1, revision: remote.revision, dirty: false, workspace: remote.workspace });
  }, [cache, fetchWorkspace]);
  const exportPendingWorkspace = useCallback(() => workspaceRef.current ? JSON.stringify({
    format: 'tripsloom-backup', backupVersion: 2, exportedAt: new Date().toISOString(),
    workspace: workspaceRef.current, photos: [],
  }, null, 2) : null, []);
  const uploadWardrobePhoto = useCallback((uri: string, mimeType?: string) => uploadPhoto(uri, tokenRef.current, mimeType), []);
  const photoToken = auth.session?.access_token || null;
  const photoSource = useCallback((path: string) => privatePhotoSource(path, photoToken), [photoToken]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspace, status, error, dirty, change, sync, reload, discardAndReload,
    exportPendingWorkspace, uploadWardrobePhoto, photoSource,
  }), [workspace, status, error, dirty, change, sync, reload, discardAndReload, exportPendingWorkspace, uploadWardrobePhoto, photoSource]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside DataProvider.');
  return context;
}
