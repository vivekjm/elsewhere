/**
 * Practical facts for travellers, by ISO 3166-1 alpha-2 code. Plug types use the IEC letters (A–O).
 * Emergency is the general number; where police, fire and ambulance differ, the ambulance number is given.
 * Tipping is a short, general norm, not advice for every situation.
 */
export type CountryFacts = { plugs: string; volts: number; drive: 'left' | 'right'; emergency: string; calling: string; tip: string };

const T_NONE = 'Not expected; rounding up is fine';
const T_10 = 'About 10% in restaurants if service isn’t included';
const T_ROUND = 'Round up or leave 5–10% for good service';
const T_US = '15–20% in restaurants, a few dollars for porters and drivers';

export const COUNTRIES: Record<string, CountryFacts> = {
  // Europe
  AL: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+355', tip: T_10 },
  AT: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+43', tip: T_ROUND },
  BA: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+387', tip: T_ROUND },
  BE: { plugs: 'C, E', volts: 230, drive: 'right', emergency: '112', calling: '+32', tip: T_ROUND },
  BG: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+359', tip: T_10 },
  CH: { plugs: 'C, J', volts: 230, drive: 'right', emergency: '112', calling: '+41', tip: T_ROUND },
  CY: { plugs: 'G', volts: 230, drive: 'left', emergency: '112', calling: '+357', tip: T_10 },
  CZ: { plugs: 'C, E', volts: 230, drive: 'right', emergency: '112', calling: '+420', tip: T_10 },
  DE: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+49', tip: T_ROUND },
  DK: { plugs: 'C, E, F, K', volts: 230, drive: 'right', emergency: '112', calling: '+45', tip: T_NONE },
  EE: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+372', tip: T_ROUND },
  ES: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+34', tip: T_ROUND },
  FI: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+358', tip: T_NONE },
  FR: { plugs: 'C, E', volts: 230, drive: 'right', emergency: '112', calling: '+33', tip: 'Service is included; leave a little extra for good service' },
  GB: { plugs: 'G', volts: 230, drive: 'left', emergency: '999 or 112', calling: '+44', tip: '10–12.5% in restaurants if service isn’t added' },
  GR: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+30', tip: T_10 },
  HR: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+385', tip: T_10 },
  HU: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+36', tip: '10–15% if service isn’t included' },
  IE: { plugs: 'G', volts: 230, drive: 'left', emergency: '112 or 999', calling: '+353', tip: T_10 },
  IS: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+354', tip: T_NONE },
  IT: { plugs: 'C, F, L', volts: 230, drive: 'right', emergency: '112', calling: '+39', tip: 'Coperto is often charged; small extra for good service' },
  LT: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+370', tip: T_10 },
  LU: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+352', tip: T_ROUND },
  LV: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+371', tip: T_10 },
  ME: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+382', tip: T_10 },
  MK: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+389', tip: T_10 },
  MT: { plugs: 'G', volts: 230, drive: 'left', emergency: '112', calling: '+356', tip: T_10 },
  NL: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+31', tip: T_ROUND },
  NO: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112 or 113', calling: '+47', tip: T_NONE },
  PL: { plugs: 'C, E', volts: 230, drive: 'right', emergency: '112', calling: '+48', tip: T_10 },
  PT: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+351', tip: T_ROUND },
  RO: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+40', tip: T_10 },
  RS: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+381', tip: T_10 },
  SE: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+46', tip: T_NONE },
  SI: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+386', tip: T_10 },
  SK: { plugs: 'C, E', volts: 230, drive: 'right', emergency: '112', calling: '+421', tip: T_10 },
  TR: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+90', tip: '5–10% in restaurants' },
  UA: { plugs: 'C, F', volts: 230, drive: 'right', emergency: '112', calling: '+380', tip: T_10 },
  // Americas
  AR: { plugs: 'C, I', volts: 220, drive: 'right', emergency: '107 (ambulance) or 911', calling: '+54', tip: T_10 },
  BR: { plugs: 'C, N', volts: 127, drive: 'right', emergency: '192 (ambulance) or 190', calling: '+55', tip: '10% service is usually added' },
  BS: { plugs: 'A, B', volts: 120, drive: 'left', emergency: '911 or 919', calling: '+1', tip: '15% is often added; check the bill' },
  CA: { plugs: 'A, B', volts: 120, drive: 'right', emergency: '911', calling: '+1', tip: '15–20% in restaurants' },
  CL: { plugs: 'C, L', volts: 220, drive: 'right', emergency: '131 (ambulance) or 133', calling: '+56', tip: '10% is often suggested on the bill' },
  CO: { plugs: 'A, B', volts: 110, drive: 'right', emergency: '123', calling: '+57', tip: '10% is often suggested on the bill' },
  CR: { plugs: 'A, B', volts: 120, drive: 'right', emergency: '911', calling: '+506', tip: '10% service is included by law' },
  CU: { plugs: 'A, B, C, L', volts: 110, drive: 'right', emergency: '104 (ambulance) or 106', calling: '+53', tip: T_10 },
  DO: { plugs: 'A, B', volts: 120, drive: 'right', emergency: '911', calling: '+1', tip: '10% is usually added; a little extra is welcome' },
  EC: { plugs: 'A, B', volts: 120, drive: 'right', emergency: '911', calling: '+593', tip: T_10 },
  GT: { plugs: 'A, B', volts: 120, drive: 'right', emergency: '110 or 128 (ambulance)', calling: '+502', tip: T_10 },
  JM: { plugs: 'A, B', volts: 110, drive: 'left', emergency: '110 (ambulance) or 119', calling: '+1', tip: '10–15%' },
  MX: { plugs: 'A, B', volts: 127, drive: 'right', emergency: '911', calling: '+52', tip: '10–15% in restaurants' },
  PA: { plugs: 'A, B', volts: 120, drive: 'right', emergency: '911', calling: '+507', tip: T_10 },
  PE: { plugs: 'A, B, C', volts: 220, drive: 'right', emergency: '105 or 116 (fire)', calling: '+51', tip: T_10 },
  US: { plugs: 'A, B', volts: 120, drive: 'right', emergency: '911', calling: '+1', tip: T_US },
  UY: { plugs: 'C, F, L', volts: 220, drive: 'right', emergency: '911', calling: '+598', tip: T_10 },
  // Asia and the Middle East
  AE: { plugs: 'G', volts: 230, drive: 'right', emergency: '998 (ambulance) or 999', calling: '+971', tip: '10% if service isn’t included' },
  BD: { plugs: 'C, D, G, K', volts: 220, drive: 'left', emergency: '999', calling: '+880', tip: T_ROUND },
  BT: { plugs: 'C, D, G', volts: 230, drive: 'left', emergency: '112 (ambulance) or 113', calling: '+975', tip: T_ROUND },
  CN: { plugs: 'A, C, I', volts: 220, drive: 'right', emergency: '120 (ambulance) or 110', calling: '+86', tip: T_NONE },
  HK: { plugs: 'G', volts: 220, drive: 'left', emergency: '999', calling: '+852', tip: '10% service is usually added' },
  ID: { plugs: 'C, F', volts: 230, drive: 'left', emergency: '112', calling: '+62', tip: 'Service is often added; rounding up is welcome' },
  IL: { plugs: 'C, H', volts: 230, drive: 'right', emergency: '101 (ambulance) or 100', calling: '+972', tip: '10–15% in restaurants' },
  IN: { plugs: 'C, D, M', volts: 230, drive: 'left', emergency: '112', calling: '+91', tip: T_10 },
  JO: { plugs: 'B, C, D, F, G, J', volts: 230, drive: 'right', emergency: '911', calling: '+962', tip: T_10 },
  JP: { plugs: 'A, B', volts: 100, drive: 'left', emergency: '119 (ambulance) or 110', calling: '+81', tip: 'Not customary; it can cause confusion' },
  KH: { plugs: 'A, C, G', volts: 230, drive: 'right', emergency: '119 (ambulance) or 117', calling: '+855', tip: T_ROUND },
  KR: { plugs: 'C, F', volts: 220, drive: 'right', emergency: '119 (ambulance) or 112', calling: '+82', tip: 'Not customary' },
  LA: { plugs: 'A, B, C, E, F', volts: 230, drive: 'right', emergency: '195 (ambulance) or 191', calling: '+856', tip: T_ROUND },
  LK: { plugs: 'D, G, M', volts: 230, drive: 'left', emergency: '1990 (ambulance) or 119', calling: '+94', tip: '10% service is often added' },
  MV: { plugs: 'C, D, G, J, K, L', volts: 230, drive: 'left', emergency: '102 (ambulance) or 119', calling: '+960', tip: '10% service is usually added' },
  MY: { plugs: 'G', volts: 240, drive: 'left', emergency: '999', calling: '+60', tip: 'Service is often added; not expected otherwise' },
  NP: { plugs: 'C, D, M', volts: 230, drive: 'left', emergency: '102 (ambulance) or 100', calling: '+977', tip: '5–10%; tip trekking guides and porters' },
  OM: { plugs: 'C, G', volts: 240, drive: 'right', emergency: '9999', calling: '+968', tip: T_10 },
  PH: { plugs: 'A, B, C', volts: 220, drive: 'right', emergency: '911', calling: '+63', tip: 'Service is often added; 10% otherwise' },
  QA: { plugs: 'D, G', volts: 240, drive: 'right', emergency: '999', calling: '+974', tip: T_10 },
  SA: { plugs: 'G', volts: 230, drive: 'right', emergency: '997 (ambulance) or 911', calling: '+966', tip: T_10 },
  SG: { plugs: 'G', volts: 230, drive: 'left', emergency: '995 (ambulance) or 999', calling: '+65', tip: 'Not expected; service charge is usually added' },
  TH: { plugs: 'A, B, C, O', volts: 230, drive: 'left', emergency: '1669 (ambulance) or 191', calling: '+66', tip: T_ROUND },
  TW: { plugs: 'A, B', volts: 110, drive: 'right', emergency: '119 (ambulance) or 110', calling: '+886', tip: 'Not customary; 10% service is often added' },
  UZ: { plugs: 'C, F', volts: 220, drive: 'right', emergency: '103 (ambulance) or 102', calling: '+998', tip: T_10 },
  VN: { plugs: 'A, C, F', volts: 220, drive: 'right', emergency: '115 (ambulance) or 113', calling: '+84', tip: T_ROUND },
  // Africa
  BW: { plugs: 'D, G', volts: 230, drive: 'left', emergency: '997 (ambulance) or 999', calling: '+267', tip: T_10 },
  EG: { plugs: 'C, F', volts: 220, drive: 'right', emergency: '123 (ambulance) or 122', calling: '+20', tip: '10–15%; small tips are common' },
  ET: { plugs: 'C, E, F, L', volts: 220, drive: 'right', emergency: '907 (ambulance) or 991', calling: '+251', tip: T_10 },
  GH: { plugs: 'D, G', volts: 230, drive: 'right', emergency: '112', calling: '+233', tip: T_10 },
  KE: { plugs: 'G', volts: 240, drive: 'left', emergency: '999 or 112', calling: '+254', tip: '10%; tip safari guides separately' },
  MA: { plugs: 'C, E', volts: 220, drive: 'right', emergency: '150 (ambulance) or 19', calling: '+212', tip: T_10 },
  MU: { plugs: 'C, G', volts: 230, drive: 'left', emergency: '114 (ambulance) or 999', calling: '+230', tip: T_10 },
  NA: { plugs: 'D, M', volts: 220, drive: 'left', emergency: '10111 (police)', calling: '+264', tip: T_10 },
  NG: { plugs: 'D, G', volts: 230, drive: 'right', emergency: '112', calling: '+234', tip: T_10 },
  RW: { plugs: 'C, J', volts: 230, drive: 'right', emergency: '912 (ambulance) or 112', calling: '+250', tip: T_10 },
  SC: { plugs: 'G', volts: 240, drive: 'left', emergency: '999', calling: '+248', tip: T_10 },
  SN: { plugs: 'C, D, E, K', volts: 230, drive: 'right', emergency: '1515 (ambulance) or 17', calling: '+221', tip: T_10 },
  TN: { plugs: 'C, E', volts: 230, drive: 'right', emergency: '190 (ambulance) or 197', calling: '+216', tip: T_10 },
  TZ: { plugs: 'D, G', volts: 230, drive: 'left', emergency: '112 or 114', calling: '+255', tip: '10%; tip safari and Kilimanjaro crews separately' },
  UG: { plugs: 'G', volts: 240, drive: 'left', emergency: '112 or 999', calling: '+256', tip: T_10 },
  ZA: { plugs: 'C, M, N', volts: 230, drive: 'left', emergency: '10177 (ambulance) or 112', calling: '+27', tip: '10–15% in restaurants' },
  ZW: { plugs: 'D, G', volts: 220, drive: 'left', emergency: '994 (ambulance) or 999', calling: '+263', tip: T_10 },
  // Oceania
  AU: { plugs: 'I', volts: 230, drive: 'left', emergency: '000', calling: '+61', tip: 'Not expected; round up for great service' },
  FJ: { plugs: 'I', volts: 240, drive: 'left', emergency: '911', calling: '+679', tip: 'Not expected' },
  NZ: { plugs: 'I', volts: 230, drive: 'left', emergency: '111', calling: '+64', tip: 'Not expected' },
  PF: { plugs: 'A, B, E', volts: 220, drive: 'right', emergency: '15 (ambulance) or 17', calling: '+689', tip: 'Not expected' },
};

const plugSet = (s: string) => new Set(s.split(/,\s*/));

/** Whether a plug from home fits sockets abroad, ignoring voltage. C plugs fit most European-style sockets. */
export function adapterNeeded(home: CountryFacts | undefined, away: CountryFacts): boolean | null {
  if (!home) return null;
  const awaySockets = plugSet(away.plugs);
  const homePlugs = plugSet(home.plugs);
  const fits = (p: string) => awaySockets.has(p) || (p === 'C' && ['E', 'F', 'J', 'K', 'L'].some((s) => awaySockets.has(s))) || (p === 'A' && awaySockets.has('B'));
  return ![...homePlugs].some(fits);
}

/** Offset of a time zone from UTC, in minutes, at a given instant. */
export function zoneOffset(timeZone: string, at = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
  } catch {
    return null;
  }
}

/** "3 h 30 min ahead", "2 h behind", "Same time as home". */
export function timeDifference(minutes: number): string {
  if (minutes === 0) return 'Same time as home';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60), m = abs % 60;
  return `${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''} ${minutes > 0 ? 'ahead' : 'behind'}`;
}
