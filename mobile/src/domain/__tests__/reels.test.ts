/**
 * Reel parsing, on captions from real public posts (October 2026). Run from the repo root:
 *   node --import tsx --test mobile/src/domain/__tests__/*.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baitIn, candidatesIn, count, cuesIn, destinationHints, areaHints, instagramPreview, mergeCandidates, reelLink, splitTag, tagBase, tagsIn, type Reel } from '../reels';

const CHAPORA = `572 likes, 35 comments - beingazhar_ on October 13, 2026: "If you grew up watching Dil Chahta Hai, this isn't just a viewpoint—it’s a feeling. 🌅✨

​Sitting on these ancient ruins, watching the endless sea meet the sky, you can almost hear "Tanha Dil" playing in the wind. From this height, you don't just see a beach; you see the entire soul of Goa. Honestly, your Goa trip is incomplete if you haven’t sat on this wall with your friends, even if just once.

👉 ​📍 Want to know the exact spot and how to reach? Comment "DIL CHAHTA HAI" below and I’ll DM you the location! 📩

​[ DilChahtaHai NorthGoa GoaDiaries HiddenGoa CinematicGoa ChaporaFort TravelIndia GoaTourism ViralReels ExploresIndia ]

.
.
.
#dilchahtahai #goa #chapora #peaceandlove
#tuesdaythoughts". `;

const BANGKOK = `Things do do in Bangkok Thailand 🇹🇭 Here is your perfect Bangkok itinerary for first time visitors: What to do in Bangkok? 🕉️ Visit some of the best temples in Bangkok such as Wat Arun, Wat Phra Kaew or Wat Pho 🎉 Go out on Khaosan Road 🐉 Visit the Pink Dragon Temple (40 min cab ride), free entry 🌆 Go to the best rooftop bars in Bangkok such as Tichuca or Above Eleven Where to eat in Bangkok? 🥭 Make me mango cafe, Mango Restaurant, SO Samsen How to get around Bangkok? 🛺 Depending on how far you go, Grab or TukTuk is the best way for me. #thingstodoinbangkok #bangkok #bangkokitinerary #whattodoinbangkok #bangkoktravel #bangkoktrip #bangkokthailand`;

const KIDS = `💫My top 15 things to do with kids in Bangkok.💫  1️⃣Children’s Discovery Museum  💰 Free Entry 📍Near Chatuchak ⏰10 AM to 4 PM, closed on Monday 2️⃣Sea Life Aquarium  📍@sealifebangkok_official , Siam Paragon Mall ⏰ 10 AM to 8 PM 3️⃣ Chocolate Ville, open air theme park restaurant 📍@chocolateville ⏰ 3 pm to 12 AM`;

const reel = (over: Partial<Reel>): Reel => ({
  id: 'instagram:x', url: '', platform: 'instagram', author: '', handle: '', postedAt: '', likes: null, comments: null, title: '', caption: '', hashtags: [], mentions: [],
  keywords: [], thumbnail: '', coverText: '', notes: '', status: 'ok', savedAt: '', ...over,
});

test('links: platform, post id and canonical URL', () => {
  assert.deepEqual(reelLink('https://www.instagram.com/north.goa/reel/DehJ2rpTsFI/?igsh=abc'), { id: 'instagram:DehJ2rpTsFI', url: 'https://www.instagram.com/reel/DehJ2rpTsFI/', platform: 'instagram' });
  assert.equal(reelLink('see https://instagram.com/p/C0dEfGh12/ wow')?.id, 'instagram:C0dEfGh12');
  assert.equal(reelLink('https://youtu.be/1pYQmdxHrZ0?si=x')?.id, 'youtube:1pYQmdxHrZ0');
  assert.equal(reelLink('https://www.youtube.com/shorts/1pYQmdxHrZ0')?.url, 'https://www.youtube.com/shorts/1pYQmdxHrZ0');
  assert.equal(reelLink('https://www.youtube.com/watch?v=b8oIjSiKrQ4&t=3')?.id, 'youtube:b8oIjSiKrQ4');
  assert.equal(reelLink('https://www.tiktok.com/@sandymakessense/video/7469851491017198880?lang=en')?.id, 'tiktok:7469851491017198880');
  assert.equal(reelLink('no link here'), null);
});

test('counts', () => {
  assert.equal(count('1,234'), 1234);
  assert.equal(count('1.2K'), 1200);
  assert.equal(count('3M'), 3000000);
  assert.equal(count('27'), 27);
});

test('Instagram preview text: likes, comments, creator, date and the full caption', () => {
  const p = instagramPreview(CHAPORA)!;
  assert.equal(p.likes, 572);
  assert.equal(p.comments, 35);
  assert.equal(p.handle, 'beingazhar_');
  assert.equal(p.postedAt, '2026-10-13');
  assert.match(p.caption, /^If you grew up watching Dil Chahta Hai/);
  assert.match(p.caption, /#tuesdaythoughts$/);
  const empty = instagramPreview('27 likes, 0 comments - nehaachaudhary07 on October 15, 2026')!;
  assert.equal(empty.caption, '');
  assert.equal(empty.postedAt, '2026-10-15');
});

test('hashtags: #tags, [ bracket lists ] and how they split', () => {
  const tags = tagsIn(instagramPreview(CHAPORA)!.caption).map((t) => t.toLowerCase());
  for (const t of ['dilchahtahai', 'goa', 'chapora', 'chaporafort', 'northgoa', 'goadiaries']) assert.ok(tags.includes(t), t);
  assert.equal(splitTag('ChaporaFort'), 'Chapora Fort');
  assert.equal(splitTag('NorthGoa'), 'North Goa');
  assert.equal(splitTag('bagabeach'), 'baga beach');
  assert.equal(splitTag('southgoa'), 'south goa');
  assert.equal(tagBase('goadiaries'), 'goa');
  assert.equal(tagBase('bangkoktravelguide'), 'bangkok');
  assert.equal(tagBase('chapora'), 'chapora');
});

test('the hidden spot: "Comment X and I’ll DM you the location"', () => {
  const b = baitIn(instagramPreview(CHAPORA)!.caption)!;
  assert.equal(b.kind, 'comment');
  assert.equal(b.keyword, 'DIL CHAHTA HAI');
  assert.equal(baitIn('Location in the pinned comment 👇')?.kind, 'pinned');
  assert.equal(baitIn('Full guide: link in bio')?.kind, 'bio');
  assert.equal(baitIn('Third day in Goa'), null);
});

test('Chapora: the place comes from the hashtags, and the destination is Goa', () => {
  const caption = instagramPreview(CHAPORA)!.caption;
  const r = reel({ caption, hashtags: tagsIn(caption) });
  const hints = destinationHints([r]);
  assert.equal(hints[0].name, 'Goa');
  assert.deepEqual(areaHints([r], 'Goa'), ['North Goa']);
  const merged = mergeCandidates(candidatesIn(r, 'Goa'));
  const titles = merged.map((c) => c.title);
  assert.ok(titles.includes('Chapora Fort'), titles.join(', '));
  assert.ok(!titles.some((t) => /^(North Goa|Goa|Travel India|Viral Reels)$/i.test(t)), titles.join(', '));
  assert.equal(merged.find((c) => c.title === 'Chapora Fort')!.source, 'hashtag');
});

test('Bangkok: inline lists, "such as" lists and "go out on"', () => {
  const r = reel({ caption: BANGKOK, hashtags: tagsIn(BANGKOK), platform: 'tiktok' });
  assert.equal(destinationHints([r])[0].name, 'Bangkok');
  const titles = mergeCandidates(candidatesIn(r, 'Bangkok')).map((c) => c.title);
  for (const t of ['Wat Arun', 'Wat Phra Kaew', 'Wat Pho', 'Khaosan Road', 'Tichuca', 'Above Eleven']) assert.ok(titles.includes(t), `${t} in ${titles.join(', ')}`);
  assert.ok(titles.some((t) => /Pink Dragon Temple/.test(t)), titles.join(', '));
});

test('numbered keycap lists with 📍 pins and tagged venues', () => {
  const r = reel({ caption: KIDS, mentions: ['sealifebangkok_official', 'chocolateville'] });
  const titles = mergeCandidates(candidatesIn(r, 'Bangkok')).map((c) => c.title);
  for (const t of ['Children’s Discovery Museum', 'Sea Life Aquarium', 'Siam Paragon Mall', 'Chocolate Ville']) assert.ok(titles.includes(t), `${t} in ${titles.join(', ')}`);
});

test('what people paste wins: a comment naming the spot', () => {
  const r = reel({ caption: 'Best sunset of my life 🌅 #goa', hashtags: ['goa'], notes: 'Creator replied: it’s Cabo de Rama Fort, South Goa' });
  const c = mergeCandidates(candidatesIn(r, 'Goa'));
  assert.ok(c.some((x) => /Cabo de Rama Fort/.test(x.title) && x.source === 'comment'), c.map((x) => `${x.title}/${x.source}`).join(', '));
});

test('cues: interests, party, budget, food, months', () => {
  const c = cuesIn(['Did you know Goa has FREE ferry rides? Save your budget for the beach shacks instead! #couplegoals', 'Sunset at the fort, pure veg thali after', 'Goa in October!']);
  assert.ok(c.interests.includes('beaches'));
  assert.ok(c.interests.includes('views'));
  assert.ok(c.interests.includes('heritage'));
  assert.equal(c.party, 'couple');
  assert.equal(c.budget, 'backpacker');
  assert.equal(c.veg, true);
  assert.equal(c.free, true);
  assert.deepEqual(c.months, [10]);
});

test('a YouTube Short that names no places still gives the destination', () => {
  const r = reel({ platform: 'youtube', title: '10 places in South Goa you must visit #travel #southgoa #itinerary #goa #shorts', hashtags: ['travel', 'southgoa', 'itinerary', 'goa', 'shorts', 'goadiaries'], keywords: ['south goa places to visit', 'places to visit in south goa'] });
  assert.equal(destinationHints([r])[0].name, 'Goa');
  assert.deepEqual(areaHints([r], 'Goa'), ['South Goa']);
  assert.deepEqual(mergeCandidates(candidatesIn(r, 'Goa')).filter((c) => c.confidence >= 0.5), []);
});

test('a title that is just a name: "Cabo De Rama Beach 🏝️"', () => {
  const r = reel({ platform: 'youtube', title: 'Cabo De Rama Beach 🏝️', caption: 'Hidden gem in South Goa #goa #beach #hiddengem', hashtags: ['goa', 'beach', 'hiddengem'] });
  assert.ok(mergeCandidates(candidatesIn(r, 'Goa')).some((c) => c.title === 'Cabo De Rama Beach'));
  const t = reel({ caption: 'Third day in Goa❤️\n#couplegoals #goa #bagabeach', hashtags: ['couplegoals', 'goa', 'bagabeach'] });
  assert.deepEqual(mergeCandidates(candidatesIn(t, 'Goa')).map((c) => c.title), ['Baga Beach']);
});

test('YouTube Shorts: a hidden list, and a title with the destination in front', () => {
  assert.equal(baitIn('Our best FINDS this Goa trip 🏖️⤵️\n\nComment ‘50 best places in Goa’ to access our complete list!')?.kind, 'comment');
  const r = reel({ platform: 'youtube', title: 'Goa Baga Beach #shorts', caption: 'goa baga beach shorts my travel support in goa', hashtags: ['shorts'] });
  assert.ok(mergeCandidates(candidatesIn(r, 'Goa')).some((c) => c.title === 'Baga Beach'), mergeCandidates(candidatesIn(r, 'Goa')).map((c) => c.title).join(', '));
});

test('a pasted DM: places, not the areas they’re in, and not the "Their DM:" label', () => {
  const r = reel({ caption: 'Our best FINDS this Goa trip', notes: 'Their DM: Fontainhas, Gunpowder in Assagao, Cabo de Rama Fort and Butterfly Beach' });
  const titles = mergeCandidates(candidatesIn(r, 'Goa')).map((c) => c.title);
  assert.deepEqual(titles.sort(), ['Butterfly Beach', 'Cabo de Rama Fort', 'Fontainhas', 'Gunpowder']);
});

test('real captions: the creator’s own tag isn’t the destination; repeated names are; pins name the place, then the area', () => {
  const villa = reel({ handle: 'tio_tonys', caption: 'Private Villa for 10 Not a hotel for 100 #tiotonys #northgoa #goavillas #goaholidays', hashtags: ['tiotonys', 'northgoa', 'goavillas', 'goaholidays'] });
  assert.equal(destinationHints([villa])[0].name, 'Goa');
  const waves = reel({ caption: 'Happiness comes in waves 🌊\n#goa #waves #beach\n(Goa travel, Goa memories, Goa vibes, Goa fun, Goa beaches)', hashtags: ['goa', 'waves', 'beach'] });
  assert.equal(destinationHints([waves])[0].name, 'Goa');
  const caption = 'Stepping here feels like stepping back in time—where every old, brightly-painted Portuguese house has a story\n📍 Fontainhas, Panjim, Goa\n[ Fontainhas PanjimGoa LatinQuarter GoaDiaries ]\n#goa #fontainhasgoa';
  const r = reel({ caption, hashtags: tagsIn(caption) });
  const titles = mergeCandidates(candidatesIn(r, 'Goa')).map((c) => c.title);
  assert.equal(titles[0], 'Fontainhas');
  assert.ok(!titles.includes('Portuguese'), titles.join(', '));
  assert.ok(!titles.some((t) => /Goa$/.test(t)), titles.join(', '));
});

test('a pasted comment: sentence words and weekdays aren’t places', () => {
  const r = reel({ notes: 'Top comment: Sunset dinner at Thalassa in Vagator, and go to Anjuna Flea Market on Wednesday' });
  assert.deepEqual(mergeCandidates(candidatesIn(r, 'Goa')).map((c) => c.title).sort(), ['Anjuna Flea Market', 'Thalassa']);
});

test('#HiddenGoa and #NorthGoa aren’t places; #PanjimGoa is', () => {
  const caption = '[ DilChahtaHai NorthGoa GoaDiaries HiddenGoa CinematicGoa ChaporaFort PanjimGoa ]';
  const titles = mergeCandidates(candidatesIn(reel({ caption, hashtags: tagsIn(caption) }), 'Goa')).map((c) => c.title);
  assert.ok(!titles.some((t) => /^(North|Hidden|Cinematic)$/.test(t)), titles.join(', '));
  assert.ok(titles.includes('Chapora Fort') && titles.includes('Panjim'), titles.join(', '));
});

test('a time hint applies to its own clause only', () => {
  const c = mergeCandidates(candidatesIn(reel({ notes: 'Sunset dinner at Thalassa in Vagator, and go to Anjuna Flea Market on Wednesday' }), 'Goa'));
  assert.equal(c.find((x) => x.title === 'Thalassa')?.slot, 'sunset');
  assert.equal(c.find((x) => x.title === 'Anjuna Flea Market')?.slot, undefined);
});

test('typed text: a name starts after a full stop, not across it', () => {
  const r = reel({ caption: '', notes: '3 days in Jaipur on my own from 12 December. Amber Fort, Hawa Mahal, Nahargarh Fort at sunset' });
  const titles = mergeCandidates(candidatesIn(r, 'Jaipur')).map((c) => c.title);
  assert.deepEqual(titles.sort(), ['Amber Fort', 'Hawa Mahal', 'Nahargarh Fort']);
  // "St." is part of a name, not the end of a sentence.
  assert.ok(mergeCandidates(candidatesIn(reel({ caption: 'Mass at St. Francis Church, then lunch', notes: '' }), 'Goa')).some((c) => c.title === 'St. Francis Church' || c.title === 'St Francis Church'));
});
