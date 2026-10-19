/**
 * Facts in the sentence someone types to start a plan ("3 days in Jaipur on my own from 12 December…"): where, how
 * long and who's going. Pure (no React Native, no dates from the phone), so it's unit-tested; the start date, which
 * needs today's date, is in `drafter.ts`.
 */

const WORD_NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14 };

export function parseDays(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*(?:[a-z-]+\s+)?(day|night)/);
  if (m) { const n = Number(m[1]); return Math.max(1, Math.min(m[2] === 'night' ? n + 1 : n, 30)); }
  for (const [word, n] of Object.entries(WORD_NUMBERS)) if (text.includes(`${word} day`) || text.includes(`${word}-day`)) return n;
  for (const [word, n] of Object.entries(WORD_NUMBERS)) if (text.includes(`${word} night`)) return n + 1;
  if (text.includes('fortnight') || text.includes('two weeks')) return 14;
  if (text.includes('long weekend')) return 4;
  if (text.includes('weekend')) return 3;
  if (/\b(a|one|1)\s+week\b|week-long|weeklong|\bweek in\b/.test(text)) return 7;
  return null;
}

export function parseTravellers(text: string): number | null {
  let m = text.match(/(?:family|group) of (\d{1,2})/); if (m) return Math.min(Number(m[1]), 20);
  m = text.match(/(\d{1,2})\s*(?:people|persons|adults|travellers|travelers|of us|friends|pax)/); if (m) return Math.max(1, Math.min(Number(m[1]) + (text.includes(`${m[1]} friends`) ? 1 : 0), 20));
  m = text.match(/with (\d{1,2}) (?:friends?|colleagues?|others?|people|persons?)\b/); if (m) return Math.min(Number(m[1]) + 1, 20);
  m = text.match(/with (a|one|two|three|four|five|six) (?:friends?|colleagues?|others?)\b/); if (m) return (m[1] === 'a' ? 1 : WORD_NUMBERS[m[1]] ?? 1) + 1;
  if (/\bwith (?:a |my )?(?:friend|colleague|partner|wife|husband|girlfriend|boyfriend|mum|mom|dad|sister|brother)\b/.test(text)) return 2;
  m = text.match(/\b(two|three|four|five|six) (?:of us|friends|people)\b/); if (m) return WORD_NUMBERS[m[1]] + (text.includes(`${m[1]} friends`) ? 1 : 0);
  if (/\b(solo|alone|by myself|on my own|just me|only me)\b/.test(text)) return 1;
  if (/\b(couple|honeymoon|two of us|my partner|my wife|my husband|girlfriend|boyfriend)\b/.test(text)) return text.includes('kids') ? 4 : 2;
  if (/\b(kids|children|family)\b/.test(text)) return 4;
  if (text.includes('friends')) return 4;
  return null;
}

export function parseDestination(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  const skip = /^(January|February|March|April|May|June|July|August|September|October|November|December|Spring|Summer|Autumn|Fall|Winter|A|An|The|We|I|My|Our|Me|Us)$/;
  // A name ends with its sentence: "…in December. Sunset at the fort" is December (skipped), never "Sunset".
  const tidy = (raw: string) => raw.split(/(?<=[.!?])\s+/)[0].split(/\s+/).filter((w) => !skip.test(w.replace(/[,.!?]/g, ''))).join(' ').replace(/[,.!?]+$/, '').trim();
  // "Goa with friends…", "Bali in March": the trip's place opens the sentence.
  const opening = cleaned.match(/^((?:[A-Z][\p{L}'’-]+)(?: [A-Z][\p{L}'’-]+)*)\s*(?:in|for|with|on|,|:|-|–|this|next)\b/u)?.[1];
  // "Trek in…", "Weekend in…": the opening word says what kind of trip, not where.
  if (opening && tidy(opening).length >= 2 && !/^(trek|trekking|trip|hike|tour|holiday|vacation|weekend|getaway|honeymoon|road trip|plan)$/i.test(tidy(opening))) return tidy(opening);
  // "3 days in Jaipur…", "a trip to Bali": the first place after in/to/visit that isn't a month or a season.
  for (const m of cleaned.matchAll(/\b(?:in|to|around|across|through|visit|visiting|explore|exploring)\s+(?:the\s+)?((?:[A-Z][\p{L}'’.-]+)(?:[ ,]+(?:[A-Z][\p{L}'’.-]+|de|del|da|di|do|la|le|el|of|the))*)/gu)) {
    const place = tidy(m[1]);
    if (place.length >= 2) return place;
  }
  return '';
}

/** Words that describe the trip, not where it is. */
const TRIP_WORD = /^(trek|treks|trekking|trip|trips|hike|hiking|tour|holiday|holidays|vacation|weekend|getaway|honeymoon|plan|visit|travel|journey|days?|nights?|weeks?|me|us|we|my|our|friends?|family|wife|husband|partner|kids|solo|budget|cheap|food|veg|jain|road|drive|beach|beaches|camping|snow|winter|summer|monsoon|spring|autumn|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|next|this|a|an|the|some|somewhere)$/i;

/**
 * Places the sentence might mean, most likely first, for when AI can't read it: "Trek in nepal in goechala" gives
 * goechala and nepal (lowercase is fine), never "Trek"; "4 days in Goa with friends in December" gives Goa.
 */
export function destinationCandidates(text: string): string[] {
  const out: string[] = [];
  const add = (raw: string) => {
    const words = raw.split(/(?<=[.!?])\s+/)[0].replace(/[,.!?:;]+$/g, '').split(/\s+/).filter((w) => w && !TRIP_WORD.test(w.replace(/[^\p{L}]/gu, '')));
    const name = words.join(' ').trim();
    if (name.length >= 2 && !/^\d/.test(name) && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  };
  const said = parseDestination(text);
  if (said && !TRIP_WORD.test(said)) add(said);
  // After in / to / visit…, in any case, up to three words, stopping at the next connecting word.
  for (const m of text.replace(/\s+/g, ' ').matchAll(/\b(?:in|to|around|across|through|visit|visiting|explore|exploring|at)\s+((?:[\p{L}'’.-]+)(?:\s+(?!(?:in|for|with|on|from|to|and|or|this|next|during|by|at)\b)[\p{L}'’.-]+){0,2})/giu)) add(m[1]);
  // A sentence that is only a name ("goa", "old manali").
  if (!out.length && text.trim().split(/\s+/).length <= 3) add(text.trim());
  // The most specific first: "in nepal in goechala" means goechala, in Nepal.
  return out.length > 1 && /\bin\b.*\bin\b/i.test(text) ? [...out].reverse() : out;
}
