import { workspaceSchema, imagePath, type Workspace } from './model.ts';
export const MAX_BACKUP_BYTES = 24 * 1024 * 1024;
export type PendingBackup = { workspace: Workspace; photos: { itemId: string; data: string }[] };
const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid backup object.'); return v as Record<string, unknown>; };
const array = (v: unknown): unknown[] => { if (!Array.isArray(v)) throw new Error('Invalid backup collection.'); return v; };
const category = (v: unknown) => ({ tops: 'Tops', bottoms: 'Bottoms', layers: 'Layers', shoes: 'Shoes', accessories: 'Accessories', gear: 'Gear' } as Record<string, string>)[String(v)] || v;
const activityType = (v: unknown) => ({ explore: 'Explore', food: 'Food & drink', transport: 'Travel', stay: 'Stay', event: 'Event', other: 'Other' } as Record<string, string>)[String(v)] || v;
/** Accept the hosted v1 format and both earlier portable HTML/React workspaces. */
export function parseBackup(text: string): PendingBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('Choose a backup under 24 MB.');
  const raw = record(JSON.parse(text));
  let data = record(raw.format === 'elsewhere-backup' ? raw.workspace : raw);
  const photos: PendingBackup['photos'] = [];
  if (raw.format === 'elsewhere-backup') {
    if (raw.backupVersion !== 2) throw new Error('This backup format is not supported.');
    for (const value of array(raw.photos ?? [])) { const p = record(value); if (typeof p.itemId !== 'string' || typeof p.data !== 'string') throw new Error('Invalid photo in backup.'); photos.push({ itemId: p.itemId, data: p.data }); }
  }
  if (data.schemaVersion === 1 || data.schemaVersion === 2) {
    const source = data;
    data = { version: 1,
      items: array(source.wardrobe).map(value => { const i = record(value); if (i.image) { if (typeof i.id !== 'string' || typeof i.image !== 'string') throw new Error('Invalid wardrobe photo.'); photos.push({ itemId: i.id, data: i.image }); } return { ...i, image: '', category: category(i.category), shape: i.art === 'cap' ? 'hat' : i.art }; }),
      outfits: array(source.outfits).map(value => { const o = record(value); return { ...o, items: o.itemIds }; }),
      trips: array(source.trips).map(value => {
        const t = record(value), days = array(t.days).map(record);
        if (new Set(days.map(d => d.date)).size !== days.length) throw new Error('Duplicate day dates in backup.');
        return { ...t, travellers: t.travelers, weightLimit: t.luggageLimit, budget: t.budget ?? 0,
          days: Object.fromEntries(days.map(d => { if (typeof d.date !== 'string') throw new Error('Missing day date.'); return [d.date, { ...d, outfitId: '', outfitIds: d.outfitIds, gear: d.itemIds }]; })),
          activities: days.flatMap(d => array(d.events).map(value => { const a = record(value); return { ...a, date: d.date, category: activityType(a.type), gear: a.itemIds, link: a.url ?? '' }; })),
          extras: t.packing,
          packed: Object.entries(record(t.packedItems)).filter(([, v]) => { if (typeof v !== 'boolean') throw new Error('Invalid packing status.'); return v; }).map(([k]) => k)
        };
      })
    };
  }
  const workspace = workspaceSchema.parse(data), seen = new Set<string>();
  if (photos.length > workspace.items.length) throw new Error('Too many photos in backup.');
  for (const p of photos) {
    if (!workspace.items.some(i => i.id === p.itemId) || seen.has(p.itemId) || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.data) || p.data.length > 7_000_000) throw new Error('Invalid or duplicate photo in backup.');
    seen.add(p.itemId);
  }
  if (new TextEncoder().encode(JSON.stringify(workspace)).byteLength > 1_480_000) throw new Error('This backup exceeds the hosted workspace size limit.');
  return { workspace, photos };
}
export async function exportBackup(workspace: Workspace, includePhotos = true): Promise<string> {
  const photos: PendingBackup['photos'] = [];
  if (includePhotos) for (const item of workspace.items) {
    if (!item.image) continue;
    const response = await fetch(item.image, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Could not read the photo for “${item.name}”. Retry, or turn off “Include photos” for a data-only backup.`);
    const blob = await response.blob();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 5 * 1024 * 1024) throw new Error('An image is too large or has an unsupported type.');
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read photo.')); reader.readAsDataURL(blob); });
    photos.push({ itemId: item.id, data });
    if (photos.reduce((n, p) => n + p.data.length, 0) > MAX_BACKUP_BYTES) throw new Error('Photos exceed the 24 MB backup limit. Export a data-only backup instead.');
  }
  const result = JSON.stringify({ format: 'elsewhere-backup', backupVersion: 2, exportedAt: new Date().toISOString(), workspace, photos }, null, 2);
  if (new TextEncoder().encode(result).byteLength > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 24 MB. Turn off “Include photos” and try again.');
  return result;
}
/** Upload photos only after the entire file has validated and the user confirmed replacement. */
export async function prepareRestore(pending: PendingBackup): Promise<Workspace> {
  const workspace = structuredClone(pending.workspace);
  for (const photo of pending.photos) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(photo.data);
    if (!match) throw new Error('Invalid backup photo.');
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0)), form = new FormData();
    form.set('image', new Blob([bytes], { type: match[1] }), `restored-${photo.itemId}.${match[1].split('/')[1]}`);
    const r = await fetch('/api/images', { method: 'POST', credentials: 'same-origin', body: form }), data = await r.json().catch(() => ({})) as { url?: string; error?: string };
    if (!r.ok || !data.url || !imagePath(data.url)) throw new Error(data.error || 'Could not restore a photo. Your current workspace has not been replaced.');
    workspace.items.find(i => i.id === photo.itemId)!.image = data.url;
  }
  return workspaceSchema.parse(workspace);
}
