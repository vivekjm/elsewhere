import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { TripExtras } from '../data/extras';
import { tripDates, type Trip, type Workspace } from '../data/model';
import { clockTime, dateRange, localDay, longDay, money } from '../domain/format';
import { CATEGORY, sortPlans } from '../domain/trips';

const safeName = (name: string) => name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'trip';

async function shareFile(name: string, contents: string, mimeType: string, uti?: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: name });
}

/** Renders HTML to a PDF named after the trip ("Barcelona-in-October-travel-book.pdf"), then opens the share sheet. */
async function sharePdf(htmlDoc: string, name: string, title: string) {
  const { uri } = await Print.printToFileAsync({ html: htmlDoc });
  const printed = new File(uri);
  const file = new File(Paths.cache, `${name}.pdf`);
  if (file.exists) file.delete();
  printed.move(file);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

/** Everything you've saved, as one JSON file the web app's restore flow also accepts (photos excluded). */
export async function exportBackup(workspace: Workspace, extras: Record<string, TripExtras>) {
  const body = JSON.stringify({
    format: 'tripsloom-backup', backupVersion: 2, exportedAt: new Date().toISOString(), workspace, photos: [],
    tripExtras: extras,
  }, null, 2);
  await shareFile(`trips-loom-backup-${new Date().toISOString().slice(0, 10)}.json`, body, 'application/json', 'public.json');
}

const ics = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsDate = (iso: string) => iso.replace(/-/g, '');
const icsDateTime = (iso: string, time: string) => `${icsDate(iso)}T${time.replace(':', '')}00`;

/** The trip and every timed plan as a calendar file (Calendar, Google Calendar and Outlook import it). */
export async function exportCalendar(trip: Trip) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trips Loom//EN', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const end = new Date(Date.parse(trip.end) + 86400000).toISOString().slice(0, 10);
  lines.push('BEGIN:VEVENT', `UID:trip-${trip.id}@tripsloom.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(trip.start)}`, `DTEND;VALUE=DATE:${icsDate(end)}`,
    `SUMMARY:${ics(trip.name)}`, `LOCATION:${ics(trip.destination)}`, 'END:VEVENT');
  for (const a of trip.activities) {
    lines.push('BEGIN:VEVENT', `UID:plan-${a.id}@tripsloom.com`, `DTSTAMP:${stamp}`);
    if (a.time) {
      lines.push(`DTSTART:${icsDateTime(a.date, a.time)}`, `DTEND:${icsDateTime(a.date, a.endTime || addHour(a.time))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(a.date)}`);
    }
    lines.push(`SUMMARY:${ics(a.title)}`);
    if (a.place) lines.push(`LOCATION:${ics(a.place)}`);
    if (a.notes || a.link) lines.push(`DESCRIPTION:${ics([a.notes, a.link].filter(Boolean).join('\n'))}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  await shareFile(`${safeName(trip.name)}.ics`, lines.join('\r\n'), 'text/calendar', 'public.calendar-event');
}
function addHour(time: string) { const [h, m] = time.split(':').map(Number); return `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A printable itinerary: one section per day with plans, stays and notes. */
export async function exportItineraryPDF(trip: Trip) {
  const days = tripDates(trip).map((date, i) => {
    const plans = sortPlans(trip.activities.filter((a) => a.date === date));
    const day = trip.days[date];
    const rows = plans.map((a) => `<tr><td class="t">${html(a.time || '—')}</td><td><b>${html(a.title)}</b><span class="c">${html(CATEGORY[a.category].label)}</span>${a.place ? `<div class="m">${html(a.place)}</div>` : ''}${a.notes ? `<div class="m">${html(a.notes)}</div>` : ''}</td><td class="r">${a.cost ? html(money(a.cost, trip.currency)) : ''}</td></tr>`).join('');
    return `<section><h2>Day ${i + 1} · ${html(longDay(date))}${day?.title ? ` — ${html(day.title)}` : ''}</h2>${day?.stay ? `<p class="m">Stay: ${html(day.stay)}</p>` : ''}${rows ? `<table>${rows}</table>` : '<p class="m">Nothing planned yet.</p>'}${day?.notes ? `<p class="m">${html(day.notes)}</p>` : ''}</section>`;
  }).join('');
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1E1E1E;margin:32px}
    h1{font-size:28px;margin:0}h2{font-size:16px;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #FF6A2B}
    .m{color:#7A7A7A;font-size:12px;margin:2px 0}.c{font-size:11px;color:#9A3F13;background:#FBD9C4;border-radius:4px;padding:1px 6px;margin-left:8px}
    table{width:100%;border-collapse:collapse}td{padding:6px 4px;vertical-align:top;border-bottom:1px solid #E6E5E2;font-size:13px}.t{width:56px;color:#7A7A7A}.r{text-align:right;white-space:nowrap}
    section{page-break-inside:avoid}</style></head><body>
    <h1>${html(trip.name)}</h1><p class="m">${html(trip.destination)} · ${html(dateRange(trip.start, trip.end))} · ${trip.travellers} ${trip.travellers === 1 ? 'traveller' : 'travellers'}</p>
    ${days}<p class="m" style="margin-top:32px">Planned with Trips Loom</p></body></html>`;
  await sharePdf(doc, `${safeName(trip.name)}-itinerary`, `${trip.name} itinerary`);
}

/**
 * A keepsake travel book as a PDF (a free take on Polarsteps' printed books): the trip's numbers, the journal
 * check-ins in order, each day with its plans and notes, spending by category and the recap note.
 * `spentByCategory` is already converted to the trip currency.
 */
export async function exportTravelBook(trip: Trip, extras: TripExtras, spentByCategory: { label: string; amount: number }[], countries: string[]) {
  const dates = tripDates(trip);
  const done = trip.activities.filter((a) => a.completed).length;
  const spent = spentByCategory.reduce((s, x) => s + x.amount, 0);
  const steps = [...extras.journal].sort((a, b) => a.at.localeCompare(b.at));
  const stat = (v: string | number, l: string) => `<div class="s"><b>${html(String(v))}</b><span>${html(l)}</span></div>`;
  const journal = steps.length ? `<h2>Where you went</h2><ol class="j">${steps.map((s) => `<li><b>${html(s.place || 'Check-in')}</b><span class="m">${html(longDay(localDay(s.at)))} · ${html(clockTime(s.at))}</span>${s.note ? `<div>${html(s.note)}</div>` : ''}</li>`).join('')}</ol>` : '';
  const days = dates.map((date, i) => {
    const plans = sortPlans(trip.activities.filter((a) => a.date === date));
    const day = trip.days[date];
    if (!plans.length && !day?.notes && !day?.title) return '';
    return `<section><h3>Day ${i + 1} · ${html(longDay(date))}${day?.title ? ` — ${html(day.title)}` : ''}</h3>${plans.map((a) => `<p>${a.completed ? '✓ ' : ''}${a.time ? `<span class="m">${html(a.time)}</span> ` : ''}${html(a.title)}${a.place ? ` <span class="m">· ${html(a.place)}</span>` : ''}</p>`).join('')}${day?.notes ? `<p class="n">${html(day.notes)}</p>` : ''}</section>`;
  }).join('');
  const money_ = spentByCategory.length ? `<h2>Spending</h2><table>${spentByCategory.map((x) => `<tr><td>${html(x.label)}</td><td class="r">${html(money(x.amount, trip.currency))}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="r"><b>${html(money(spent, trip.currency))}</b></td></tr></table>` : '';
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1E1E1E;margin:40px}
    .cover{padding:48px 32px;border-radius:20px;background:linear-gradient(135deg,#FFB98A,#FF6A2B);color:#fff;margin-bottom:28px}
    .cover h1{font-size:40px;margin:0 0 8px}.cover p{margin:0;font-size:15px;opacity:.95}
    .stats{display:flex;gap:12px;margin:0 0 24px}.s{flex:1;background:#F4F3F1;border-radius:12px;padding:14px}.s b{display:block;font-size:24px}.s span{font-size:12px;color:#7A7A7A}
    h2{font-size:18px;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #FF6A2B}h3{font-size:14px;margin:18px 0 6px}
    p{margin:3px 0;font-size:13px}.m{color:#7A7A7A;font-size:12px}.n{font-style:italic;color:#555}
    .j{padding-left:18px}.j li{margin:0 0 10px;font-size:13px}.j li span{display:block}
    table{width:100%;border-collapse:collapse}td{padding:6px 4px;border-bottom:1px solid #E6E5E2;font-size:13px}.r{text-align:right}
    section{page-break-inside:avoid}blockquote{margin:16px 0;padding:14px 18px;background:#FBF1EA;border-radius:12px;font-size:14px}</style></head><body>
    <div class="cover"><h1>${html(trip.name)}</h1><p>${html(trip.destination)} · ${html(dateRange(trip.start, trip.end))}</p>${extras.rating ? `<p>${'★'.repeat(extras.rating)}${'☆'.repeat(5 - extras.rating)}</p>` : ''}</div>
    <div class="stats">${stat(dates.length, dates.length === 1 ? 'day' : 'days')}${stat(countries.length || 1, (countries.length || 1) === 1 ? 'country' : 'countries')}${stat(done || trip.activities.length, done ? 'plans done' : 'plans')}${stat(steps.length, steps.length === 1 ? 'check-in' : 'check-ins')}</div>
    ${extras.recapNote ? `<blockquote>${html(extras.recapNote)}</blockquote>` : ''}
    ${journal}<h2>Day by day</h2>${days || '<p class="m">No plans recorded.</p>'}${money_}
    <p class="m" style="margin-top:36px">Made with Trips Loom</p></body></html>`;
  await sharePdf(doc, `${safeName(trip.name)}-travel-book`, `${trip.name} travel book`);
}
