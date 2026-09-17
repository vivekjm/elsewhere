import type { Trip, Workspace } from "./model.ts";
import { packing } from "./model.ts";
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csv = (s: unknown) =>
  `"${String(typeof s === "string" && /^[=+@\-\t\r]/.test(s) ? "\'" + s : s).replaceAll('"', '""')}"`;
export function packingCSV(w: Workspace, t: Trip) {
  return [
    "Item,Quantity,Weight (g),Packed",
    ...packing(w, t).map((i) =>
      [i.name, i.quantity, i.weight, i.packed ? "Yes" : "No"]
        .map(csv)
        .join(","),
    ),
  ].join("\r\n");
}
const esc = (s: string) =>
  s
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
export function calendarICS(t: Trip) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elsewhere//Trip Planner//EN",
    ...t.activities.flatMap((a) => {
      const start = new Date(`${a.date}T${a.time}:00Z`),
        end = new Date(start.getTime() + 3600000),
        stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15);
      return [
        "BEGIN:VEVENT",
        `UID:${a.id}@elsewhere`,
        `DTSTAMP:${stamp(new Date())}Z`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${esc(a.title)}`,
        `LOCATION:${esc(a.place)}`,
        `DESCRIPTION:${esc(a.notes + (a.link ? "\n" + a.link : ""))}`,
        "END:VEVENT",
      ];
    }),
    "END:VCALENDAR",
  ].join("\r\n");
}
