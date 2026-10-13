import * as SecureStore from 'expo-secure-store';

/** Supabase sessions can exceed a single native keychain value. Store fixed-size
 * encrypted chunks and switch banks only after the full write succeeds. */
const CHUNK_SIZE = 1400;
const MAX_CHUNKS = 32;
type Bank = 'a' | 'b';
const keyFor = (key: string, bank: Bank, part: string) => `${key}.${bank}.${part}`;

async function clearBank(key: string, bank: Bank): Promise<void> {
  const metaKey = keyFor(key, bank, 'count');
  const count = Number(await SecureStore.getItemAsync(metaKey));
  await SecureStore.deleteItemAsync(metaKey);
  if (Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS) {
    await Promise.all(Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(keyFor(key, bank, String(index))),
    ));
  }
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const bank = await SecureStore.getItemAsync(`${key}.active`) as Bank | null;
    if (bank !== 'a' && bank !== 'b') return null;
    const count = Number(await SecureStore.getItemAsync(keyFor(key, bank, 'count')));
    if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;
    const chunks = await Promise.all(Array.from({ length: count }, (_, index) =>
      SecureStore.getItemAsync(keyFor(key, bank, String(index))),
    ));
    return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join('') : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const previous = await SecureStore.getItemAsync(`${key}.active`) as Bank | null;
    const bank: Bank = previous === 'a' ? 'b' : 'a';
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) || [''];
    if (chunks.length > MAX_CHUNKS) throw new Error('Authentication session is too large to store securely.');
    await clearBank(key, bank);
    for (const [index, chunk] of chunks.entries()) {
      await SecureStore.setItemAsync(keyFor(key, bank, String(index)), chunk);
    }
    await SecureStore.setItemAsync(keyFor(key, bank, 'count'), String(chunks.length));
    await SecureStore.setItemAsync(`${key}.active`, bank);
    if (previous === 'a' || previous === 'b') await clearBank(key, previous);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(`${key}.active`);
    await Promise.all([clearBank(key, 'a'), clearBank(key, 'b')]);
  },
};
