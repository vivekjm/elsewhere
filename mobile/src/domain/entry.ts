/**
 * Entry rules for Indian passport holders on tourist trips, for destinations Indian travellers visit most.
 * Only rules that several sources agree on are listed, each with the official site to confirm on; rules change
 * often (Thailand moved from 60 to 30 visa-free days on 15 September 2026), so the app always shows when this was
 * last checked and links to the official source. Countries not listed here show only the general advice.
 */
export const ENTRY_CHECKED = '2026-10-15';

export type EntryRule = { kind: 'free' | 'arrival' | 'online' | 'visa'; summary: string; detail: string; official: string };

export const INDIAN_PASSPORT: Record<string, EntryRule> = {
  NP: { kind: 'free', summary: 'No visa needed', detail: 'Indian citizens can enter with a passport or voter ID card.', official: 'https://www.immigration.gov.np' },
  BT: { kind: 'free', summary: 'No visa needed', detail: 'A free entry permit is issued on arrival with a passport or voter ID; a Sustainable Development Fee is charged per night.', official: 'https://www.bhutan.travel' },
  MV: { kind: 'arrival', summary: 'Free visa on arrival, 30 days', detail: 'Bring a return ticket and hotel booking, and fill in the IMUGA traveller declaration before you fly.', official: 'https://imuga.immigration.gov.mv' },
  TH: { kind: 'free', summary: 'Visa-free, up to 30 days', detail: 'Since 15 September 2026 (was 60 days). Fill in the Thailand Digital Arrival Card within 72 hours before arrival; carry a return ticket and proof of funds.', official: 'https://tdac.immigration.go.th' },
  MY: { kind: 'free', summary: 'Visa-free, up to 30 days', detail: 'Announced to run until 31 December 2026. Submit the Malaysia Digital Arrival Card before you fly.', official: 'https://imigresen-online.imi.gov.my/mdac/main' },
  ID: { kind: 'arrival', summary: 'Visa on arrival or e-VOA, 30 days', detail: 'Extendable once for 30 more days. Bali also charges a tourist levy, paid online or on arrival.', official: 'https://evisa.imigrasi.go.id' },
  LK: { kind: 'online', summary: 'Apply online (ETA) before you fly', detail: 'Get the Electronic Travel Authorization on the official site; the fee and stay are shown there.', official: 'https://www.eta.gov.lk' },
  VN: { kind: 'online', summary: 'e-Visa online before you fly', detail: 'Apply only on the official portal; it takes a few working days.', official: 'https://evisa.gov.vn' },
  KH: { kind: 'online', summary: 'e-Visa online, or visa on arrival', detail: 'The official e-Visa saves the queue at the airport.', official: 'https://www.evisa.gov.kh' },
  AE: { kind: 'online', summary: 'Visa before you fly (e-visa)', detail: 'Visa on arrival (14 days) only if you hold a qualifying visa or residence permit, such as a valid US visa or green card; check the current list.', official: 'https://icp.gov.ae' },
  SG: { kind: 'visa', summary: 'Visa needed', detail: 'Apply through an authorised visa agent or the Singapore mission before you travel. Fill in the SG Arrival Card.', official: 'https://www.ica.gov.sg' },
  JP: { kind: 'online', summary: 'Visa needed: Japan eVISA available', detail: 'Indian passport holders can apply for a tourist eVISA online.', official: 'https://www.evisa.mofa.go.jp' },
  GB: { kind: 'visa', summary: 'Visa needed', detail: 'Apply for a Standard Visitor visa well ahead; processing can take weeks.', official: 'https://www.gov.uk/standard-visitor' },
  US: { kind: 'visa', summary: 'Visa needed', detail: 'Book the visa interview early; wait times can be long.', official: 'https://travel.state.gov' },
  AU: { kind: 'visa', summary: 'Visa needed', detail: 'Apply for a Visitor visa (subclass 600) online.', official: 'https://immi.homeaffairs.gov.au' },
  // Schengen countries share one visa.
  ...Object.fromEntries(['AT', 'BE', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IS', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'SE', 'SI', 'SK']
    .map((c) => [c, { kind: 'visa', summary: 'Schengen visa needed', detail: 'Apply at the embassy or visa centre of the country you’ll spend the most time in, up to 6 months ahead.', official: 'https://home-affairs.ec.europa.eu/policies/schemas-borders-and-visas/visa-policy_en' } as EntryRule])),
};
