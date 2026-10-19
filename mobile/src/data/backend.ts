import 'react-native-url-polyfill/auto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { uid } from './model';

/** Override for preview/staging builds; release builds target the existing Worker. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://tripsloom.com').trim().replace(/\/+$/, '');
export const API_ORIGIN = new URL(API_BASE_URL).origin;
const GUEST_KEY = 'tripsloom.guest.v1';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

let guestIdPromise: Promise<string> | null = null;
let currentGuestId: string | null = null;
export function guestId(): Promise<string> {
  if (!guestIdPromise) {
    guestIdPromise = (async () => {
      const stored = await SecureStore.getItemAsync(GUEST_KEY);
      if (stored && /^[a-f0-9-]{36}$/i.test(stored)) {
        currentGuestId = stored;
        return stored;
      }
      const id = uid();
      await SecureStore.setItemAsync(GUEST_KEY, id);
      currentGuestId = id;
      return id;
    })().catch((error) => {
      guestIdPromise = null;
      throw error;
    });
  }
  return guestIdPromise;
}

export async function ownerHeaders(token: string | null, write = false): Promise<Record<string, string>> {
  const id = await guestId().catch((error: unknown) => {
    if (!token) throw error;
    return null;
  });
  return {
    ...(id ? { Cookie: `tripsloom_guest=${id}` } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(write ? { Origin: API_ORIGIN } : {}),
  };
}

export async function apiFetch(
  path: string,
  token: string | null,
  init: RequestInit = {},
  timeoutMs = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const method = (init.method || 'GET').toUpperCase();
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method,
      headers: {
        ...(await ownerHeaders(token, method !== 'GET' && method !== 'HEAD')),
        ...init.headers,
      },
      signal: init.signal || controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: unknown };
  if (!response.ok) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : `Request failed (${response.status}).`,
      response.status,
    );
  }
  return body as T;
}

export type PrivatePhotoSource = { uri: string; headers: Record<string, string> };
export function photoSource(path: string, token: string | null): PrivatePhotoSource {
  if (!/^\/api\/images\/[a-f0-9-]{36}$/i.test(path)) throw new Error('Invalid photo path.');
  return {
    uri: `${API_BASE_URL}${path}`,
    headers: {
      ...(currentGuestId ? { Cookie: `tripsloom_guest=${currentGuestId}` } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

export async function uploadPhoto(uri: string, token: string | null, mimeType = 'image/jpeg'): Promise<string> {
  if (!uri) throw new Error('Choose a photo first.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }
  const form = new FormData();
  // Expo's fetch only sends a file part that can give up its bytes (an expo-file-system File); React Native's
  // `{ uri, name, type }` part fails with "Unsupported FormDataPart implementation". The server reads the type
  // from the bytes, and the part carries the file's own name.
  form.append('image', new File(uri) as unknown as Blob);
  const response = await apiFetch('/api/images', token, { method: 'POST', body: form });
  const data = await responseJson<{ url?: unknown }>(response);
  if (typeof data.url !== 'string' || !/^\/api\/images\/[a-f0-9-]{36}$/i.test(data.url)) {
    throw new Error('The photo upload returned an invalid path.');
  }
  return data.url;
}
