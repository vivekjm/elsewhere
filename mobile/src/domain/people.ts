import { ME } from '../data/extras';
import type { Tint } from '../loom/tokens';

const PERSON_TINTS: Tint[] = ['lavender', 'mint', 'peach', 'rose', 'grey'];

/** A steady colour per person, so the same friend looks the same on every screen. You are always peach. */
export const tintFor = (id: string): Tint => (id === ME ? 'peach' : PERSON_TINTS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % PERSON_TINTS.length]);
