"use client";
import React, { useMemo, useRef } from "react";
import { addDays, type Trip, type Workspace } from "@/lib/model";
import { dateLabel, daySnapshot, monthDays, shiftMonth, today } from "@/lib/planning";
import { Button, Icon, IconButton } from "./primitives";
import { Garment } from "./garment";
import { activityIcon } from "./icons";
import type { ScreenProps } from "./views";

export function DaySnapshotArt({ w, trip, date, roomy = false }: { w: Workspace; trip: Trip; date: string; roomy?: boolean }) {
  const snapshot = daySnapshot(w, trip, date);
  return <span className={`ew-snapshot ${roomy ? "ew-snapshot-roomy" : ""}`} aria-hidden="true">
    {snapshot.pieces.length > 0 && <span className="ew-snapshot-pieces">
      {snapshot.pieces.slice(0, 3).map(item => <span key={item.id} className="ew-snapshot-piece"><Garment item={item} /></span>)}
      {snapshot.pieces.length > 2 && <small className="ew-snapshot-overflow ew-snapshot-overflow-mobile">+{snapshot.pieces.length - 2}</small>}
      {snapshot.pieces.length > 3 && <small className="ew-snapshot-overflow ew-snapshot-overflow-desktop">+{snapshot.pieces.length - 3}</small>}
    </span>}
    {snapshot.activities.slice(0, snapshot.pieces.length ? 1 : 2).map(activity => <span key={activity.id} className={`ew-snapshot-plan ew-type-${activity.category.replaceAll(/[^a-z]/gi, "").toLowerCase()}`}>
      <Icon name={activityIcon(activity.category)} size={12} /><span>{activity.title}</span>
    </span>)}
    <span className="ew-snapshot-meta">
      {snapshot.activities.length > 0 && <span><Icon name={activityIcon(snapshot.activities[0].category)} size={11} /><b>{snapshot.activities.length}</b></span>}
      {snapshot.outfits.length > 0 && <span><Icon name="hanger" size={11} /><b>{snapshot.outfits.length}</b></span>}
      {snapshot.gear.length > 0 && <span><Icon name="bag" size={11} /><b>{snapshot.gear.length}</b></span>}
      {snapshot.stay && <Icon name="stay" size={11} />}{snapshot.notes && <Icon name="note" size={11} />}
    </span>
    {!snapshot.hasContent && <span className="ew-snapshot-add"><Icon name="plus" size={16} /><span>Make a little plan</span></span>}
    {!snapshot.activities.length && !snapshot.pieces.length && snapshot.title && <span className="ew-snapshot-title">{snapshot.title}</span>}
  </span>;
}

export function VisualCalendar({ props, onPreview }: { props: ScreenProps; onPreview: (date: string) => void }) {
  const { trip, w, day, month, selectDay, setMonth } = props;
  const ref = useRef<HTMLTableElement>(null);
  const dates = useMemo(() => {
    const all = monthDays(month);
    // Keep complete weeks, without an unnecessary sixth row in shorter months.
    return all.slice(0, Math.ceil((all.findLastIndex(d => d.startsWith(month)) + 1) / 7) * 7);
  }, [month]);
  if (!trip) return null;
  const firstEnabled = dates.find(d => d >= trip.start && d <= trip.end);
  const focused = dates.includes(day) ? day : firstEnabled;
  function keyboard(e: React.KeyboardEvent, date: string) {
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const amount = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday } as Record<string, number>)[e.key];
    if (amount === undefined || !trip) return;
    e.preventDefault();
    const target = addDays(date, amount);
    if (target < trip.start || target > trip.end) return;
    selectDay(target);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus({ preventScroll: true }));
  }
  return <div className="ew-calendar-card ew-visual-calendar">
    <div className="ew-month-toolbar"><h2 aria-live="polite">{dateLabel(`${month}-01`, { month: "long", year: "numeric" })}</h2><div>
      <Button variant="quiet" onClick={() => { selectDay(trip.start); }}>Trip dates</Button>
      <IconButton label="Previous month" icon="left" disabled={month <= "1900-01"} onClick={() => setMonth(shiftMonth(month, -1))} />
      <IconButton label="Next month" icon="right" disabled={month >= "2200-12"} onClick={() => setMonth(shiftMonth(month, 1))} />
    </div></div>
    <table ref={ref} className="ew-calendar" aria-label={`${dateLabel(`${month}-01`, { month: "long", year: "numeric" })} trip calendar`}>
      <thead><tr>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <th key={d} scope="col">{d}</th>)}</tr></thead>
      <tbody>{Array.from({ length: dates.length / 7 }, (_, week) => {
        const weekDates = dates.slice(week * 7, week * 7 + 7);
        const tripWeek = weekDates.some(d => d >= trip.start && d <= trip.end);
        return <tr key={week} className={tripWeek ? "ew-trip-week" : "ew-quiet-week"}>{weekDates.map(date => {
          const inTrip = date >= trip.start && date <= trip.end;
          const snapshot = inTrip ? daySnapshot(w, trip, date) : null;
          const accessible = `${dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}, ${snapshot?.activities.length || 0} activities, ${snapshot?.outfits.length || 0} outfits${snapshot?.gear.length ? `, ${snapshot.gear.length} essentials` : ""}${snapshot?.stay ? `, staying at ${snapshot.stay}` : ""}${snapshot?.notes ? ", has a note" : ""}${inTrip ? ", open day preview" : ", outside trip"}`;
          return <td key={date} className={`${inTrip ? "ew-in-trip" : ""} ${day === date ? "ew-selected-day" : ""} ${!date.startsWith(month) ? "ew-other-month" : ""}`}>
            <button type="button" data-date={date} disabled={!inTrip} tabIndex={focused === date ? 0 : -1} aria-pressed={day === date} aria-current={date === today() ? "date" : undefined} aria-label={accessible} onClick={() => onPreview(date)} onKeyDown={e => keyboard(e, date)}>
              <span className="ew-cell-heading"><span className="ew-date-number">{Number(date.slice(-2))}</span>{date === trip.start && <small className="ew-date-flag">GO</small>}{date === trip.end && <Icon name="location" size={11} />}</span>
              {inTrip && <DaySnapshotArt w={w} trip={trip} date={date} />}
            </button>
          </td>;
        })}</tr>;
      })}</tbody>
    </table>
    <div className="ew-calendar-footer"><span><Icon name="hanger" size={12} />Outfits</span><span><Icon name="compass" size={12} />Plans</span><span><Icon name="bag" size={12} />Essentials</span><small>Tap a day to see it all</small></div>
    {!firstEnabled && <div className="ew-month-empty"><span>Your trip is in {dateLabel(trip.start, { month: "long" })}.</span><Button variant="quiet" onClick={() => selectDay(trip.start)}>Back to trip <Icon name="arrow" size={12} /></Button></div>}
  </div>;
}
