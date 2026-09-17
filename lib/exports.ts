import { packing, safeLink, type Workspace, type Trip } from './model.ts';
export function download(name: string, content: string | Blob, type = 'application/json') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
// Quote every cell and neutralise spreadsheet formulas, including whitespace-prefixed ones.
const cell = (value: unknown) => { let s = String(value); if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
export function packingCSV(w: Workspace, t: Trip): string {
  return [['Item', 'Quantity', 'Unit weight (g)', 'Packed', 'Category', 'Source', 'Used on'], ...packing(w, t).map(i => [i.name, i.quantity, i.weight, i.packed ? 'Yes' : 'No', i.category, i.automatic ? 'Itinerary' : 'Manual', i.dates.join(', ')])].map(row => row.map(cell).join(',')).join('\r\n');
}
const escapeICS = (s: string) => s.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
/** RFC 5545 folding is measured in UTF-8 octets, not JavaScript string length. */
export function foldICS(line: string): string {
  const encoder = new TextEncoder(); let result = '', part = '', bytes = 0;
  for (const character of line) { const n = encoder.encode(character).length; if (bytes + n > 75) { result += part + '\r\n'; part = ' '; bytes = 1; } part += character; bytes += n; }
  return result + part;
}
export function calendarICS(t: Trip): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Elsewhere//Trip Planner//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeICS(t.name)}`];
  for (const a of t.activities) {
    lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(t.id)}-${encodeURIComponent(a.id)}@elsewhere`, `DTSTAMP:${stamp}`);
    if (a.time) {
      lines.push(`DTSTART:${a.date.replaceAll('-', '')}T${a.time.replace(':', '')}00`);
      if (a.endTime) lines.push(`DTEND:${a.date.replaceAll('-', '')}T${a.endTime.replace(':', '')}00`);
    } else lines.push(`DTSTART;VALUE=DATE:${a.date.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${new Date(Date.parse(a.date) + 86400000).toISOString().slice(0, 10).replaceAll('-', '')}`);
    lines.push(`SUMMARY:${escapeICS(a.title)}`, `LOCATION:${escapeICS(a.place)}`, `DESCRIPTION:${escapeICS([a.notes, t.days[a.date]?.stay ? `Stay: ${t.days[a.date].stay}` : ''].filter(Boolean).join('\n'))}`);
    if (a.link && safeLink(a.link)) lines.push(`URL:${a.link.replace(/[\r\n]/g, '')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR'); return lines.map(foldICS).join('\r\n') + '\r\n';
}
export const filename = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'elsewhere-trip';
