"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  addDays,
  type Trip,
  type Workspace,
  type Activity,
} from "@/lib/model";
import {
  dateLabel,
  dayActivities,
  dayItems,
  money,
  monthDays,
  shiftMonth,
  today,
} from "@/lib/planning";
import { Button, Icon, IconButton, OutfitArt, Piece } from "./primitives";
import { activityIcon, type IconName } from "./icons";
import { Popover } from "./pickers";
import type { ScreenProps } from "./screen";
const typeClass = (category: string) =>
  `ew-type-${category.replaceAll(/[^a-z]/gi, "").toLowerCase()}`;
function CellSnapshot({
  events,
  looks,
  gear,
}: {
  events: Activity[];
  looks: { id: string; name: string }[];
  gear: { id: string; name: string }[];
}) {
  return (
    <span className="ew-cell-snapshot">
      <span className="ew-cell-events">
        {events.slice(0, 2).map((a) => (
          <span key={a.id} className={`ew-event-chip ${typeClass(a.category)}`}>
            <Icon name={activityIcon(a.category)} size={11} />
            <b>{a.time ? a.time.slice(0, 5) : "All day"}</b>
            <em>{a.title}</em>
          </span>
        ))}
        {events.length > 2 && (
          <small className="ew-cell-more">+{events.length - 2} more</small>
        )}
      </span>
      {looks.length > 0 && (
        <span className="ew-outfit-chip" title={looks.map((o) => o.name).join(", ")}>
          <Icon name="hanger" size={12} />
          <span>
            {looks[0].name}
            {looks.length > 1 ? ` +${looks.length - 1}` : ""}
          </span>
        </span>
      )}
      {gear.length > 0 && (
        <span className="ew-gear-chip">
          <Icon name="bag" size={11} />
          {gear.length}
        </span>
      )}
    </span>
  );
}
function PreviewSection({
  icon,
  title,
  count,
  children,
  empty,
}: {
  icon: IconName;
  title: string;
  count?: number;
  children?: React.ReactNode;
  empty?: string;
}) {
  return (
    <section className="ew-preview-section">
      <div className="ew-preview-heading">
        <Icon name={icon} size={13} />
        <h4>{title}</h4>
        {count !== undefined && count > 0 && <span>{count}</span>}
      </div>
      {children || <p className="ew-preview-empty">{empty}</p>}
    </section>
  );
}
export function DayPreview({
  w,
  trip,
  date,
  onClose,
  onEditDay,
  onAddPlan,
  onOpenPlan,
  onOpenOutfit,
  onGoToPacking,
  onOpenItem,
  onPickDay,
}: {
  w: Workspace;
  trip: Trip;
  date: string;
  onClose: () => void;
  onEditDay: () => void;
  onAddPlan: () => void;
  onOpenPlan: (id: string) => void;
  onOpenOutfit: (id: string) => void;
  onGoToPacking: () => void;
  onOpenItem: (id: string) => void;
  onPickDay?: (date: string) => void;
}) {
  const events = dayActivities(trip, date),
    items = dayItems(w, trip, date),
    details = trip.days[date],
    titles = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  return (
    <div className="ew-day-preview">
      <header className="ew-preview-header">
        <div className="ew-preview-date" aria-hidden="true">
          <b>{Number(date.slice(-2))}</b>
          <span>{dateLabel(date, { month: "short" })}</span>
        </div>
        <div>
          <h3>{titles}</h3>
          <p>{details?.title || "A day with room to wander"}</p>
        </div>
        <div className="ew-preview-tools">
          {onPickDay && (
            <>
              <IconButton
                icon="left"
                label="Previous day"
                disabled={date <= trip.start}
                onClick={() => onPickDay(addDays(date, -1))}
              />
              <IconButton
                icon="right"
                label="Next day"
                disabled={date >= trip.end}
                onClick={() => onPickDay(addDays(date, 1))}
              />
            </>
          )}
          <IconButton icon="close" label="Close day preview" onClick={onClose} />
        </div>
      </header>
      <div className="ew-preview-stats">
        <span>
          <Icon name="calendar" size={12} />
          {events.length} {events.length === 1 ? "plan" : "plans"}
        </span>
        <span>
          <Icon name="hanger" size={12} />
          {items.outfits.length}{" "}
          {items.outfits.length === 1 ? "outfit" : "outfits"}
        </span>
        <span>
          <Icon name="bag" size={12} />
          {items.gear.length} to carry
        </span>
      </div>
      <div className="ew-preview-body">
        <PreviewSection
          icon="list"
          title="The plan"
          count={events.length}
          empty="Nothing planned yet."
        >
          {events.length > 0 && (
            <ul className="ew-preview-timeline">
              {events.map((a) => (
                <li key={a.id}>
                  <button
                    className={a.completed ? "ew-completed" : ""}
                    onClick={() => onOpenPlan(a.id)}
                  >
                    <time>{a.time ? a.time.slice(0, 5) : "—"}</time>
                    <i className={typeClass(a.category)}>
                      <Icon name={activityIcon(a.category)} size={13} />
                    </i>
                    <span>
                      <strong>{a.title}</strong>
                      <small>
                        {a.place || a.category}
                        {a.cost > 0 ? ` · ${money(a.cost, trip.currency)}` : ""}
                      </small>
                    </span>
                    <Icon name="right" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PreviewSection>
        <PreviewSection
          icon="hanger"
          title="What to wear"
          count={items.outfits.length}
          empty="No look chosen for this day."
        >
          {items.outfits.length > 0 && (
            <div className="ew-preview-looks">
              {items.outfits.map((o) => (
                <button key={o.id} onClick={() => onOpenOutfit(o.id)}>
                  <span className="ew-preview-look-art">
                    <OutfitArt w={w} outfit={o} />
                  </span>
                  <strong>{o.name}</strong>
                  <small>{o.occasion || "Everyday"}</small>
                </button>
              ))}
            </div>
          )}
        </PreviewSection>
        {items.gear.length > 0 && (
          <PreviewSection icon="bag" title="Carry" count={items.gear.length}>
            <div className="ew-preview-gear">
              {items.gear.map((i) => (
                <button key={i.id} onClick={() => onOpenItem(i.id)}>
                  <span className="ew-preview-gear-art">
                    <Piece item={i} />
                  </span>
                  {i.name}
                </button>
              ))}
              <button className="ew-preview-gear-more" onClick={onGoToPacking}>
                Packing list <Icon name="right" size={11} />
              </button>
            </div>
          </PreviewSection>
        )}
        {(details?.stay || details?.notes) && (
          <div className="ew-preview-notes">
            {details?.stay && (
              <p>
                <Icon name="stay" size={13} />
                {details.stay}
              </p>
            )}
            {details?.notes && (
              <p>
                <Icon name="note" size={13} />
                {details.notes}
              </p>
            )}
          </div>
        )}
      </div>
      <footer className="ew-preview-actions">
        <Button variant="primary" icon="plus" onClick={onAddPlan}>
          Add a plan
        </Button>
        <Button icon="edit" onClick={onEditDay}>
          Day details
        </Button>
      </footer>
    </div>
  );
}
export function Calendar({ props }: { props: ScreenProps }) {
  const { trip, w, day, month, selectDay, setMonth, open, navigate } = props,
    ref = useRef<HTMLTableElement>(null),
    cell = useRef<HTMLButtonElement>(null),
    [preview, setPreview] = useState(false);
  const lastDay = useRef(day);
  useEffect(() => {
    if (lastDay.current !== day) {
      lastDay.current = day;
      setPreview(true);
    }
  }, [day]);
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);
  if (!trip) return null;
  const dates = monthDays(month),
    firstEnabled = dates.find((d) => d >= trip.start && d <= trip.end);
  const focused = dates.includes(day) ? day : firstEnabled;
  function key(e: React.KeyboardEvent, date: string) {
    const weekday = (new Date(date).getUTCDay() + 6) % 7;
    const amount = (
      {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7,
        Home: -weekday,
        End: 6 - weekday,
      } as Record<string, number>
    )[e.key];
    if (amount === undefined || !trip) return;
    e.preventDefault();
    const target = new Date(Date.parse(date) + amount * 86400000)
      .toISOString()
      .slice(0, 10);
    if (target < trip.start || target > trip.end) return;
    selectDay(target);
    requestAnimationFrame(() =>
      ref.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)
        ?.focus(),
    );
  }
  const plan = (date: string) =>
    open({ kind: "activity", date, draft: { date } });
  return (
    <div className="ew-calendar-card">
      <div className="ew-month-toolbar">
        <h2>{dateLabel(`${month}-01`, { month: "long", year: "numeric" })}</h2>
        <div>
          <Button
            variant="quiet"
            onClick={() => {
              setMonth(today().slice(0, 7));
              if (today() >= trip.start && today() <= trip.end)
                selectDay(today());
            }}
          >
            Today
          </Button>
          <IconButton
            label="Previous month"
            icon="left"
            disabled={month <= "1900-01"}
            onClick={() => setMonth(shiftMonth(month, -1))}
          />
          <IconButton
            label="Next month"
            icon="right"
            disabled={month >= "2200-12"}
            onClick={() => setMonth(shiftMonth(month, 1))}
          />
        </div>
      </div>
      <table
        ref={ref}
        className="ew-calendar"
        aria-label={`${dateLabel(`${month}-01`, { month: "long", year: "numeric" })} trip calendar`}
      >
        <thead>
          <tr>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {dates.slice(week * 7, week * 7 + 7).map((date) => {
                const inTrip = date >= trip.start && date <= trip.end,
                  events = dayActivities(trip, date),
                  items = dayItems(w, trip, date);
                return (
                  <td
                    key={date}
                    className={`${inTrip ? "ew-in-trip" : ""} ${day === date ? "ew-selected-day" : ""} ${!date.startsWith(month) ? "ew-other-month" : ""} ${events.length ? "ew-has-plans" : ""}`}
                  >
                    <button
                      type="button"
                      ref={day === date ? cell : undefined}
                      data-date={date}
                      disabled={!inTrip}
                      tabIndex={focused === date ? 0 : -1}
                      aria-pressed={day === date}
                      aria-current={date === today() ? "date" : undefined}
                      aria-label={`${dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}, ${events.length} activities, ${items.outfits.length} outfits${inTrip ? "" : ", outside trip"}`}
                      onClick={() => {
                        selectDay(date);
                        setPreview(true);
                      }}
                      onKeyDown={(e) => key(e, date)}
                    >
                      <span className="ew-date-number">
                        {Number(date.slice(-2))}
                      </span>
                      {date === trip.start && (
                        <small className="ew-date-flag">LET’S GO</small>
                      )}
                      <CellSnapshot
                        events={events}
                        looks={items.outfits}
                        gear={items.gear}
                      />
                      <span className="ew-cell-dots" aria-hidden="true">
                        {events.slice(0, 3).map((a) => (
                          <i key={a.id} className={`ew-dot-${typeClass(a.category).slice(8)}`} />
                        ))}
                        {items.outfits.length > 0 && <i className="ew-dot-look" />}
                      </span>
                    </button>
                    {inTrip && (
                      <button
                        type="button"
                        className="ew-cell-add"
                        aria-label={`Add a plan on ${dateLabel(date)}`}
                        tabIndex={-1}
                        onClick={() => plan(date)}
                      >
                        <Icon name="plus" size={13} />
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Popover
        open={preview && day >= trip.start && day <= trip.end}
        onClose={() => setPreview(false)}
        anchor={cell}
        align="end"
        minHeight={170}
        className="ew-day-preview-popover"
      >
        <DayPreview
          w={w}
          trip={trip}
          date={day}
          onClose={() => setPreview(false)}
          onEditDay={() => {
            setPreview(false);
            open({ kind: "day", date: day });
          }}
          onAddPlan={() => {
            setPreview(false);
            plan(day);
          }}
          onOpenPlan={(id) => {
            setPreview(false);
            open({ kind: "activity", id, date: day });
          }}
          onOpenOutfit={(id) => {
            setPreview(false);
            open({ kind: "outfit", id });
          }}
          onOpenItem={(id) => {
            setPreview(false);
            open({ kind: "item", id });
          }}
          onGoToPacking={() => {
            setPreview(false);
            navigate("packing");
          }}
          onPickDay={(next) => selectDay(next)}
        />
      </Popover>
      <div className="ew-calendar-footer">
        <div>
          <span>
            <i className="ew-dot-explore" />
            Explore
          </span>
          <span>
            <i className="ew-dot-fooddrink" />
            Food
          </span>
          <span>
            <i className="ew-dot-travel" />
            Travel
          </span>
          <span>
            <i className="ew-dot-look" />
            Outfit
          </span>
        </div>
        <small>
          <Icon name="right" size={11} /> Tap a day for the full picture
        </small>
      </div>
      {!firstEnabled && (
        <div className="ew-month-empty">
          No trip dates in this month.{" "}
          <Button
            variant="quiet"
            onClick={() => {
              selectDay(trip.start);
            }}
          >
            Go to your trip <Icon name="arrow" size={12} />
          </Button>
        </div>
      )}
    </div>
  );
}
