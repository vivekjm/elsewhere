/**
 * Sharing a trip with the people on it, without a server: `tripsloom://join?d=<deflate, base64url>`
 * carries the plan, travellers, costs and votes. The recipient previews it, picks who they are and gets
 * their own copy; opening a newer invite for the same trip updates that copy.
 *
 * Not included: wardrobe pieces, outfits, packing ticks, documents and health check-ins — those stay private.
 * Invites are untrusted input: size is bounded before and after inflating, and the trip is re-validated.
 */
import { Inflate, strFromU8, strToU8, deflateSync } from 'fflate';
import { ME, parseExtras, type TripExtras } from '../data/extras';
import { tripSchema, uid, type Trip } from '../data/model';

const MAX_INFLATED = 512 * 1024;
const MAX_TOKEN = 60000;
/** iOS truncates opened links at 2,047 characters; longer invites go as a code to paste. */
export const MAX_LINK = 1900;

export type Invite = { v: 1; from: string; sentAt: string; trip: Trip; extras: TripExtras };

function b64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(token: string): Uint8Array {
  let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Builds an invite from your copy: "you" becomes your name so everyone sees who paid. */
export function makeInvite(trip: Trip, extras: TripExtras, senderName: string, senderUpi = ''): Invite {
  const sender = senderName.trim() || 'Trip organiser';
  const senderId = `p-${uid()}`;
  const swap = (id: string) => id === ME ? senderId : id;
  const cleanTrip: Trip = {
    ...trip, packed: [], extras: trip.extras.map((e) => ({ ...e, packed: false })),
    activities: trip.activities.map((a) => ({ ...a, outfitId: '', gear: [] })),
    days: Object.fromEntries(Object.entries(trip.days).map(([d, day]) => [d, { ...day, outfitId: '', outfitIds: [], gear: [] }])),
  };
  const shared: TripExtras = {
    ...extras,
    people: [{ id: senderId, name: sender, ...(senderUpi ? { upi: senderUpi } : {}) }, ...extras.people],
    expenses: extras.expenses.map((e) => ({ ...e, paidBy: swap(e.paidBy), splitWith: e.splitWith.map(swap) })),
    settlements: extras.settlements.map((s) => ({ ...s, from: swap(s.from), to: swap(s.to) })),
    polls: extras.polls.map((p) => ({ ...p, votes: Object.fromEntries(Object.entries(p.votes).map(([k, v]) => [swap(k), v])) })),
    documents: [],
    adventure: { ...extras.adventure, checkIns: [], gear: extras.adventure.gear.map((g) => ({ ...g, packed: false })), emergency: { name: '', relation: '', phone: '' } },
    // Plan locations are recomputed on each phone; journal check-ins are private and never shared.
    places: {}, journal: [],
    rating: 0, recapNote: '', invitedBy: sender,
  };
  return { v: 1, from: sender, sentAt: new Date().toISOString(), trip: cleanTrip, extras: shared };
}

export function encodeInvite(invite: Invite): string {
  return b64url(deflateSync(strToU8(JSON.stringify(invite)), { level: 9 }));
}

export function inviteLink(token: string): string { return `tripsloom://join?d=${token}`; }

/** Inflates in chunks and gives up as soon as the output passes the limit (a compression bomb never fully expands). */
function boundedInflate(packed: Uint8Array): string | null {
  const chunks: Uint8Array[] = [];
  let total = 0, tooBig = false;
  const stream = new Inflate((chunk) => {
    total += chunk.length;
    if (total > MAX_INFLATED) { tooBig = true; return; }
    chunks.push(chunk);
  });
  for (let i = 0; i < packed.length && !tooBig; i += 4096) stream.push(packed.subarray(i, i + 4096), i + 4096 >= packed.length);
  if (tooBig) return null;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return strFromU8(out);
}

/** Accepts a whole link, a pasted message containing one, or a bare code. Returns null when it isn't a valid invite. */
export function decodeInvite(text: string): Invite | null {
  const match = text.match(/[?&]d=([A-Za-z0-9_-]+)/) ?? text.trim().match(/^([A-Za-z0-9_-]{40,})$/);
  const token = match?.[1];
  if (!token || token.length > MAX_TOKEN) return null;
  try {
    const json = boundedInflate(fromB64url(token));
    if (json === null) return null;
    const data = JSON.parse(json) as Partial<Invite>;
    if (data.v !== 1 || typeof data.from !== 'string') return null;
    const trip = tripSchema.safeParse(data.trip);
    if (!trip.success) return null;
    return { v: 1, from: data.from.slice(0, 80), sentAt: typeof data.sentAt === 'string' ? data.sentAt : '', trip: trip.data, extras: parseExtras(data.extras) };
  } catch {
    return null;
  }
}

/**
 * Your copy of an invited trip: the person you picked becomes "you" (`ME`), and everyone else,
 * including the sender, stays as named people.
 */
export function acceptInvite(invite: Invite, meId: string): { trip: Trip; extras: TripExtras } {
  const swap = (id: string) => id === meId ? ME : id;
  const extras: TripExtras = {
    ...invite.extras,
    people: invite.extras.people.filter((p) => p.id !== meId),
    expenses: invite.extras.expenses.map((e) => ({ ...e, paidBy: swap(e.paidBy), splitWith: e.splitWith.map(swap) })),
    settlements: invite.extras.settlements.map((s) => ({ ...s, from: swap(s.from), to: swap(s.to) })),
    polls: invite.extras.polls.map((p) => ({ ...p, votes: Object.fromEntries(Object.entries(p.votes).map(([k, v]) => [swap(k), v])) })),
    invitedBy: invite.from,
  };
  return { trip: invite.trip, extras };
}
