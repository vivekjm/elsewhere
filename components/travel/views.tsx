"use client";
import React, { useState } from "react";
import {
  CLOTHING_CATEGORIES,
  uid,
  packing,
  tripDates,
  type Workspace,
  type Trip,
  type Activity,
  type Extra,
} from "@/lib/model";
import {
  dateLabel,
  dayActivities,
  dayItems,
  money,
  overlaps,
  today,
} from "@/lib/planning";
import {
  Button,
  Empty,
  Icon,
  IconButton,
  OutfitArt,
  Piece,
  Search,
} from "./primitives";
import { activityIcon, type IconName } from "./icons";
import { moodOf, Landscape } from "./landscape";
import { Calendar } from "./calendar";
import {
  VIEW_LABELS,
  type View,
  type ScreenProps,
} from "./screen";
export { VIEW_LABELS };
export type { View, ScreenProps };
/** One-tap starting points so an empty day never feels like a blank form. */
const QUICK_PLANS: {
  title: string;
  category: Activity["category"];
  time: string;
  icon: IconName;
}[] = [
  { title: "Coffee", category: "Food & drink", time: "09:30", icon: "food" },
  { title: "Museum", category: "Explore", time: "11:00", icon: "event" },
  { title: "Lunch", category: "Food & drink", time: "13:00", icon: "food" },
  { title: "Walk", category: "Explore", time: "16:30", icon: "compass" },
  { title: "Dinner", category: "Food & drink", time: "19:30", icon: "food" },
  { title: "Travel day", category: "Travel", time: "08:00", icon: "plane" },
];
const ESSENTIAL_SUGGESTIONS = [
  ["Passport & travel documents", "Documents", 80],
  ["Phone charger", "Electronics", 120],
  ["Toiletry kit", "Toiletries", 300],
  ["Reusable water bottle", "Essentials", 150],
] as const;
const ESSENTIAL_ICONS: Record<string, IconName> = {
  Documents: "note",
  Electronics: "camera",
  Toiletries: "bag",
  "Health & care": "shield",
  Essentials: "bag",
  Other: "layers",
};
const essentialIcon = (category: string): IconName =>
  ESSENTIAL_ICONS[category] || "bag";
export function TripHero({
  w,
  trip,
  open,
  navigate,
}: Pick<ScreenProps, "w" | "trip" | "open" | "navigate">) {
  if (!trip) return null;
  const dates = tripDates(trip),
    pack = packing(w, trip),
    planned = dates.filter((d) => dayItems(w, trip, d).outfits.length).length;
  return (
    <section className="ew-hero" aria-label="Trip overview">
      <div className="ew-hero-landscape">
        <Landscape theme={moodOf(trip.theme)} />
      </div>
      <div className="ew-hero-content">
        <div className="ew-hero-label">
          <span className="ew-pill">
            <Icon name="compass" size={12} />
            THE NEXT ADVENTURE
          </span>
        </div>
        <h2>{trip.name}</h2>
        <div className="ew-hero-meta">
          <span>
            <Icon name="location" size={15} />
            {trip.destination}
          </span>
          <span>
            <Icon name="calendar" size={15} />
            {dateLabel(trip.start)} –{" "}
            {dateLabel(trip.end, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span>
            <Icon name="people" size={15} />
            {trip.travellers}{" "}
            {trip.travellers === 1 ? "traveller" : "travellers"}
          </span>
        </div>
      </div>
      <button
        className="ew-hero-edit"
        onClick={() => open({ kind: "trip", id: trip.id })}
        aria-label="Edit trip"
      >
        <Icon name="edit" size={14} />
        <span>Edit trip</span>
      </button>
      <div className="ew-hero-footer">
        <span className="ew-hero-caption">
          LESS TO THINK ABOUT. MORE TO LOOK FORWARD TO.
        </span>
        <div>
          <span>
            <b>{dates.length}</b> days
          </span>
          <span>
            <b>{trip.activities.length}</b> plans
          </span>
          <span>
            <b>
              {planned}/{dates.length}
            </b>{" "}
            outfits planned
          </span>
          <button onClick={() => navigate("packing")}>
            <b>
              {pack.filter((p) => p.packed).length}/{pack.length}
            </b>{" "}
            packed <Icon name="right" size={12} />
          </button>
        </div>
      </div>
    </section>
  );
}
function ActivityCard({
  a,
  props,
  conflict,
}: {
  a: Activity;
  props: ScreenProps;
  conflict?: boolean;
}) {
  const { w, trip, open, remove, change } = props;
  return (
    <article className={`ew-activity ${a.completed ? "ew-completed" : ""}`}>
      <span
        className={`ew-activity-icon ew-type-${a.category.replaceAll(/[^a-z]/gi, "").toLowerCase()}`}
      >
        <Icon name={activityIcon(a.category)} size={15} />
      </span>
      <div className="ew-activity-body">
        <span className="ew-activity-time">
          {a.time || "All day"}
          {a.endTime ? ` – ${a.endTime}` : ""}
          <i>·</i>
          {a.category}
        </span>
        <button
          className="ew-activity-title"
          onClick={() => open({ kind: "activity", id: a.id, date: a.date })}
        >
          {a.title}
        </button>
        {a.place && (
          <a
            className="ew-place"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.place)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="location" size={12} />
            {a.place}
            <Icon name="external" size={11} />
          </a>
        )}
        {a.cost > 0 && (
          <span className="ew-small">{money(a.cost, trip?.currency)}</span>
        )}
        {a.outfitId && (
          <span className="ew-activity-outfit">
            <Icon name="hanger" size={13} />
            {w.outfits.find((o) => o.id === a.outfitId)?.name}
          </span>
        )}
        {a.notes && <p className="ew-activity-notes">{a.notes}</p>}
        {a.link && (
          <a
            className="ew-text-link"
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Reference <Icon name="external" size={12} />
          </a>
        )}
        {conflict && (
          <span className="ew-overlap">
            <Icon name="warning" size={12} />
            Overlaps another plan
          </span>
        )}
        <div className="ew-activity-tools">
          <label className="ew-check-line">
            <input
              type="checkbox"
              checked={!!a.completed}
              onChange={(e) =>
                change((d) => {
                  const activity = d.trips
                    .find((t) => t.id === trip?.id)
                    ?.activities.find((i) => i.id === a.id);
                  if (activity) activity.completed = e.target.checked;
                })
              }
            />
            Done
          </label>
          <IconButton
            icon="trash"
            label={`Delete ${a.title}`}
            onClick={() => remove("activity", a.id)}
          />
        </div>
      </div>
      <IconButton
        icon="edit"
        label={`Edit ${a.title}`}
        onClick={() => open({ kind: "activity", id: a.id, date: a.date })}
      />
    </article>
  );
}
export function Planner({ props }: { props: ScreenProps }) {
  const { w, trip, day, open, selectDay } = props,
    [mode, setMode] = useState<"calendar" | "itinerary">("calendar");
  if (!trip)
    return (
      <Empty
        title="Your next chapter starts here."
        action={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => open({ kind: "trip" })}
          >
            Plan a trip
          </Button>
        }
      >
        Choose your dates. We’ll keep the plans, outfits and packing together.
      </Empty>
    );
  const details = trip.days[day],
    events = dayActivities(trip, day),
    looks = dayItems(w, trip, day),
    collisions = overlaps(events),
    dates = tripDates(trip);
  return (
    <>
      <TripHero {...props} />
      <div className="ew-planner-layout">
        <section className="ew-calendar-section">
          <div className="ew-planner-toolbar">
            <div className="ew-segmented" aria-label="Planner view">
              <span
                className="ew-segmented-glider"
                style={{ transform: `translateX(${mode === "calendar" ? 0 : 100}%)` }}
                aria-hidden="true"
              />
              <button
                aria-pressed={mode === "calendar"}
                onClick={() => setMode("calendar")}
              >
                <Icon name="calendar" size={15} />
                Calendar
              </button>
              <button
                aria-pressed={mode === "itinerary"}
                onClick={() => setMode("itinerary")}
              >
                <Icon name="list" size={15} />
                Itinerary
              </button>
            </div>
            <span className="ew-italic">A plan, not a rulebook.</span>
          </div>
          {mode === "calendar" ? (
            <Calendar props={props} />
          ) : (
            <div className="ew-itinerary">
              {dates.map((date, i) => (
                <section
                  key={date}
                  className={`ew-itinerary-day ${date === day ? "ew-active" : ""}`}
                >
                  <div className="ew-itinerary-date">
                    <span>{dateLabel(date, { weekday: "short" })}</span>
                    <b>{date.slice(-2)}</b>
                    <small>{dateLabel(date, { month: "short" })}</small>
                  </div>
                  <div>
                    <div className="ew-between">
                      <button
                        className="ew-itinerary-heading"
                        onClick={() => selectDay(date)}
                      >
                        <small>DAY {i + 1}</small>
                        <h3>
                          {trip.days[date]?.title ||
                            "Room for a little adventure"}
                        </h3>
                      </button>
                      <IconButton
                        label={`Add activity on ${date}`}
                        icon="plus"
                        onClick={() => open({ kind: "activity", date })}
                      />
                    </div>
                    {dayActivities(trip, date).map((a) => (
                      <button
                        className="ew-itinerary-event"
                        onClick={() =>
                          open({ kind: "activity", id: a.id, date })
                        }
                        key={a.id}
                      >
                        <time>{a.time || "All day"}</time>
                        <Icon name={activityIcon(a.category)} size={15} />
                        <span>
                          <strong>{a.title}</strong>
                          <small>{a.place}</small>
                        </span>
                        <Icon name="right" size={13} />
                      </button>
                    ))}
                    {!dayActivities(trip, date).length && (
                      <p className="ew-muted">A little room for spontaneity.</p>
                    )}
                    {dayItems(w, trip, date).outfits.map((o) => (
                      <span key={o.id} className="ew-itinerary-look">
                        <Icon name="hanger" size={13} />
                        {o.name}
                      </span>
                    ))}
                    {trip.days[date]?.stay && (
                      <p className="ew-small">
                        <Icon name="stay" size={12} /> {trip.days[date].stay}
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
          <p className="ew-planner-tip">
            <Icon name="leaf" size={17} />
            Pick a day to connect the places you’ll go with the things you’ll
            wear.
          </p>
          {trip.notes && (
            <div className="ew-trip-notes">
              <h3>
                <Icon name="note" />
                Trip notes
              </h3>
              <p>{trip.notes}</p>
            </div>
          )}
        </section>
        <aside className="ew-day-panel" aria-label="Selected day">
          <div className="ew-between">
            <div>
              <p className="ew-eyebrow">
                DAY {dates.indexOf(day) + 1} <span>/ {dates.length}</span>
              </p>
              <h2>
                {dateLabel(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </h2>
            </div>
            <IconButton
              icon="edit"
              label="Edit day details"
              onClick={() => open({ kind: "day", date: day })}
            />
          </div>
          <button
            className={`ew-day-subtitle ${details?.title ? "" : "ew-placeholder"}`}
            onClick={() => open({ kind: "day", date: day })}
          >
            {details?.title || "Name this day"}
            <Icon name="edit" size={12} />
          </button>
          <div className="ew-day-section">
            <div className="ew-section-heading">
              <h3>
                The plan <span>{events.length}</span>
              </h3>
              <Button
                variant="quiet"
                icon="plus"
                onClick={() => open({ kind: "activity", date: day })}
              >
                Add
              </Button>
            </div>
            {events.length ? (
              events.map((a) => (
                <ActivityCard
                  key={a.id}
                  a={a}
                  props={props}
                  conflict={collisions.has(a.id)}
                />
              ))
            ) : (
              <>
                <button
                  className="ew-day-empty"
                  onClick={() => open({ kind: "activity", date: day })}
                >
                  <Icon name="plus" />
                  <span>Nothing planned yet</span>
                </button>
                <div className="ew-quick-add" aria-label="Quick plan ideas">
                  {QUICK_PLANS.map((q) => (
                    <button
                      key={q.title}
                      onClick={() =>
                        open({
                          kind: "activity",
                          date: day,
                          draft: {
                            date: day,
                            title: q.title,
                            category: q.category,
                            time: q.time,
                          },
                        })
                      }
                    >
                      <Icon name={q.icon} size={13} />
                      {q.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="ew-day-section ew-day-outfits">
            <div className="ew-section-heading">
              <h3>
                What to wear <span>{looks.outfits.length}</span>
              </h3>
              <Button
                variant="quiet"
                onClick={() => open({ kind: "day", date: day })}
              >
                {looks.outfits.length ? "Change" : "Choose"}
              </Button>
            </div>
            <div className="ew-day-look-grid">
              {looks.outfits.map((o) => (
                <div className="ew-day-look" key={o.id}>
                  <button
                    className="ew-day-look-art"
                    onClick={() => open({ kind: "outfit", id: o.id })}
                    aria-label={`Edit outfit ${o.name}`}
                  >
                    <span className="ew-look-occasion">
                      {o.occasion || "Everyday"}
                    </span>
                    <OutfitArt w={w} outfit={o} />
                  </button>
                  <div className="ew-look-caption">
                    <div>
                      <strong>{o.name}</strong>
                      <small>
                        {o.items.length} pieces ·{" "}
                        {o.items.reduce(
                          (n, id) =>
                            n + (w.items.find((i) => i.id === id)?.weight || 0),
                          0,
                        )}{" "}
                        g
                      </small>
                    </div>
                    <Icon name="hanger" size={16} />
                  </div>
                </div>
              ))}
            </div>
            {!looks.outfits.length && (
              <button
                className="ew-day-empty"
                onClick={() => open({ kind: "day", date: day })}
              >
                <Icon name="hanger" size={23} />
                <span>A look for this day</span>
                <small>Choose outfits from your wardrobe.</small>
              </button>
            )}
          </div>
          <div className="ew-day-section">
            <div className="ew-section-heading">
              <h3>Don’t leave without</h3>
              <Button
                variant="quiet"
                onClick={() => open({ kind: "day", date: day })}
              >
                Edit
              </Button>
            </div>
            {looks.gear.length ? (
              <div className="ew-day-gear">
                {looks.gear.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => open({ kind: "item", id: i.id })}
                  >
                    <Piece item={i} />
                    <span>{i.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="ew-muted">
                Add a camera, rain layer or other daily essentials.
              </p>
            )}
          </div>
          <button
            className="ew-stay-note"
            onClick={() => open({ kind: "day", date: day })}
          >
            <Icon name="stay" />
            <span>
              <small>STAYING AT</small>
              {details?.stay || "Add tonight’s accommodation"}
            </span>
            <Icon name="edit" size={12} />
          </button>
          <button
            className="ew-day-note"
            onClick={() => open({ kind: "day", date: day })}
          >
            <Icon name="note" size={16} />
            <span>
              <strong>A note for the day</strong>
              {details?.notes ||
                "A booking detail, a reminder, a little local tip…"}
            </span>
          </button>
        </aside>
      </div>
    </>
  );
}
export function Wardrobe({
  props,
  outfitsOnly = false,
}: {
  props: ScreenProps;
  outfitsOnly?: boolean;
}) {
  const { w, open, remove, navigate } = props,
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All");
  const clothing = w.items.filter((i) =>
    CLOTHING_CATEGORIES.includes(
      i.category as (typeof CLOTHING_CATEGORIES)[number],
    ),
  );
  const items = w.items.filter(
    (i) =>
      clothing.includes(i) &&
      (category === "All" || category === i.category) &&
      `${i.name} ${i.category} ${i.notes || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const outfits = w.outfits.filter((o) =>
    `${o.name} ${o.occasion || ""} ${o.items.map((id) => w.items.find((i) => i.id === id)?.name).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="ew-page-intro">
        <p>
          A collection of things you love to travel with.
          <br />
          <span>
            Build a look, add it to a day, and your packing list follows along.
          </span>
        </p>
        <span className="ew-italic">
          <Icon name="leaf" />
          Less baggage. More possibility.
        </span>
      </div>
      <div className="ew-collection-toolbar">
        <div className="ew-tabs" aria-label="Wardrobe view">
          <button
            aria-pressed={!outfitsOnly}
            onClick={() => navigate("wardrobe")}
          >
            Items <span>{clothing.length}</span>
          </button>
          <button
            aria-pressed={outfitsOnly}
            onClick={() => navigate("outfits")}
          >
            Outfits <span>{w.outfits.length}</span>
          </button>
        </div>
        <Search
          value={query}
          onChange={setQuery}
          label={outfitsOnly ? "Search outfits" : "Search wardrobe"}
        />
      </div>
      {!outfitsOnly && (
        <div className="ew-chips" aria-label="Filter wardrobe by category">
          {["All", ...CLOTHING_CATEGORIES].map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {outfitsOnly ? (
        <div className="ew-outfit-grid">
          {outfits.map((o) => (
            <article className="ew-wardrobe-card" key={o.id}>
              <button
                className="ew-library-look"
                onClick={() => open({ kind: "outfit", id: o.id })}
                aria-label={`Edit outfit ${o.name}`}
              >
                <span className="ew-look-occasion">
                  {o.occasion || "Everyday"}
                </span>
                <OutfitArt w={w} outfit={o} />
              </button>
              <div className="ew-wardrobe-caption">
                <div>
                  <h3>{o.name}</h3>
                  <span>{o.items.length} pieces · reusable look</span>
                </div>
                <IconButton
                  icon="edit"
                  label={`Edit ${o.name}`}
                  onClick={() => open({ kind: "outfit", id: o.id })}
                />
                <IconButton
                  icon="trash"
                  label={`Delete ${o.name}`}
                  onClick={() => remove("outfit", o.id)}
                />
              </div>
            </article>
          ))}
          <button
            className="ew-add-card"
            onClick={() => open({ kind: "outfit" })}
          >
            <span>
              <Icon name="plus" size={23} />
            </span>
            <h3>A new combination</h3>
            <p>Make a little more of what you have.</p>
          </button>
        </div>
      ) : (
        <div className="ew-item-grid">
          {items.map((i) => (
            <article className="ew-wardrobe-card" key={i.id}>
              <button
                className="ew-wardrobe-art"
                onClick={() => open({ kind: "item", id: i.id })}
                aria-label={`Edit item ${i.name}`}
              >
                <span className="ew-item-category">{i.category}</span>
                <Piece item={i} large />
              </button>
              <div className="ew-wardrobe-caption">
                <div>
                  <h3>{i.name}</h3>
                  <span>
                    <i style={{ background: i.color || "#8b8b73" }} />
                    {i.weight ? `${i.weight} g` : "Weight not added"}
                  </span>
                </div>
                <IconButton
                  icon="edit"
                  label={`Edit ${i.name}`}
                  onClick={() => open({ kind: "item", id: i.id })}
                />
                <IconButton
                  icon="trash"
                  label={`Delete ${i.name}`}
                  onClick={() => remove("item", i.id)}
                />
              </div>
            </article>
          ))}
          <button
            className="ew-add-card"
            onClick={() => open({ kind: "item" })}
          >
            <span>
              <Icon name="plus" size={23} />
            </span>
            <h3>Something you love</h3>
            <p>Add a piece or upload your own photo.</p>
          </button>
        </div>
      )}
      {((outfitsOnly && !outfits.length) || (!outfitsOnly && !items.length)) &&
        query && (
          <p className="ew-search-empty">
            No matches for “{query}”.{" "}
            <Button
              variant="quiet"
              onClick={() => {
                setQuery("");
                setCategory("All");
              }}
            >
              Clear filters
            </Button>
          </p>
        )}
      <p className="ew-collection-note">
        <Icon name="shield" size={15} />
        Clothing stays here. Documents, electronics, toiletries, and other trip essentials live in Essentials.
      </p>
    </>
  );
}
export function Essentials({ props }: { props: ScreenProps }) {
  const { trip, open, change, remove } = props,
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All");
  if (!trip)
    return (
      <Empty
        icon="shield"
        title="Keep the little things together."
        action={
          <Button variant="primary" onClick={() => open({ kind: "trip" })}>
            Plan a trip
          </Button>
        }
      >
        Create a trip first, then add documents, electronics, toiletries, and
        other essentials to its checklist.
      </Empty>
    );
  const rows = trip.extras,
    done = rows.filter((e) => e.packed).length,
    visible = rows.filter(
      (e) =>
        (filter === "All" || (filter === "To pack" ? !e.packed : e.packed)) &&
        `${e.name} ${e.category || "Essentials"}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
    categories = [...new Set(visible.map((e) => e.category || "Essentials"))];
  const addSuggestion = (name: string, category: string, weight: number) =>
    change((d) => {
      const t = d.trips.find((item) => item.id === trip.id);
      if (!t || t.extras.some((e) => e.name.toLowerCase() === name.toLowerCase()))
        return;
      t.extras.push({
        id: uid(),
        name,
        category: category as Extra["category"],
        weight,
        quantity: 1,
        packed: false,
      });
    });
  const toggle = (id: string, packed: boolean) =>
    change((d) => {
      const extra = d.trips.find((item) => item.id === trip.id)?.extras.find((e) => e.id === id);
      if (extra) extra.packed = packed;
    });
  return (
    <>
      <section className="ew-essentials-overview">
        <div>
          <p className="ew-eyebrow">THE LITTLE THINGS</p>
          <h2>Everything beyond your outfits.</h2>
          <p>
            Keep passports, electronics, toiletries, and other trip essentials
            together in one place.
          </p>
          <progress value={done} max={rows.length || 1} aria-label="Essentials packed" />
        </div>
        <div className="ew-essentials-count">
          <strong>{done}</strong>
          <span>of {rows.length} ready</span>
        </div>
      </section>
      <div className="ew-essentials-layout">
        <section>
          <div className="ew-packing-toolbar">
            <div className="ew-segmented">
              {["All", "To pack", "Packed"].map((value) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value}
                  <span>
                    {value === "All"
                      ? rows.length
                      : value === "Packed"
                        ? done
                        : rows.length - done}
                  </span>
                </button>
              ))}
            </div>
            <Search value={query} onChange={setQuery} label="Find an essential" />
          </div>
          {categories.map((category) => (
            <section className="ew-packing-group" key={category}>
              <div className="ew-packing-group-header">
                <h3>{category}</h3>
                <span>
                  {rows.filter((e) => (e.category || "Essentials") === category && e.packed).length}/
                  {rows.filter((e) => (e.category || "Essentials") === category).length} packed
                </span>
              </div>
              {visible
                .filter((e) => (e.category || "Essentials") === category)
                .map((e) => (
                  <div className={`ew-packing-row ew-essential-row ${e.packed ? "ew-is-packed" : ""}`} key={e.id}>
                    <input
                      type="checkbox"
                      checked={e.packed}
                      aria-label={`Pack ${e.name}`}
                      onChange={(event) => toggle(e.id, event.target.checked)}
                    />
                    <span className="ew-pack-thumb ew-pack-icon">
                      <Icon name={essentialIcon(category)} size={20} />
                    </span>
                    <div className="ew-pack-name">
                      <strong>{e.name}</strong>
                      <small>{e.quantity} {e.quantity === 1 ? "item" : "items"} · Added to your essentials</small>
                    </div>
                    <span className="ew-pack-weight">{e.weight * e.quantity} g</span>
                    <IconButton icon="edit" label={`Edit ${e.name}`} onClick={() => open({ kind: "extra", id: e.id })} />
                    <IconButton icon="trash" label={`Delete ${e.name}`} onClick={() => remove("extra", e.id)} />
                  </div>
                ))}
            </section>
          ))}
          {!visible.length && (
            <Empty
              icon="shield"
              title={rows.length ? "Nothing here just now." : "Your essentials list is ready."}
              action={
                <Button
                  onClick={() => {
                    if (rows.length) {
                      setFilter("All");
                      setQuery("");
                    } else {
                      open({ kind: "extra" });
                    }
                  }}
                >
                  {rows.length ? "Clear filters" : "Add an essential"}
                </Button>
              }
            >
              {rows.length ? "Try another filter or search." : "Add passports, chargers, toiletries, or anything else you need."}
            </Empty>
          )}
        </section>
        <aside>
          <section className="ew-essentials-card">
            <p className="ew-eyebrow">START WITH THE BASICS</p>
            <h3>Easy to forget.<br />Good to remember.</h3>
            <p>Add a common essential with one tap, then adjust it anytime.</p>
            {ESSENTIAL_SUGGESTIONS.map(([name, category, weight]) => {
              const added = rows.some((e) => e.name.toLowerCase() === name.toLowerCase());
              return (
                <button key={name} disabled={added} onClick={() => addSuggestion(name, category, weight)}>
                  {name}
                  <Icon name={added ? "check" : "plus"} size={16} />
                </button>
              );
            })}
          </section>
        </aside>
      </div>
    </>
  );
}
export function Packing({ props }: { props: ScreenProps }) {
  const { w, trip, open, change, remove, navigate } = props,
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All");
  if (!trip)
    return (
      <Empty
        icon="bag"
        title="Pack for something wonderful."
        action={
          <Button variant="primary" onClick={() => open({ kind: "trip" })}>
            Plan a trip
          </Button>
        }
      >
        Create a trip and connect outfits to your dates. Your packing list
        starts there.
      </Empty>
    );
  const rows = packing(w, trip),
    done = rows.filter((i) => i.packed).length,
    progress = rows.length ? Math.round((done / rows.length) * 100) : 0,
    weight = rows.reduce((n, i) => n + i.quantity * i.weight, 0) / 1000,
    missingWeight = rows.filter((r) => r.weight === 0).length;
  const visible = rows.filter(
    (i) =>
      (filter === "All" || (filter === "To pack" ? !i.packed : i.packed)) &&
      `${i.name} ${i.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  const categories = [...new Set(visible.map((i) => i.category))];
  function check(id: string, automatic: boolean, checked: boolean) {
    change((d) => {
      const t = d.trips.find((t) => t.id === trip!.id)!;
      if (automatic)
        t.packed = checked
          ? [...new Set([...t.packed, id])]
          : t.packed.filter((i) => i !== id);
      else t.extras.find((e) => e.id === id)!.packed = checked;
    });
  }
  const essentials = [
    ["Travel documents", "Documents", 80],
    ["Toiletry kit", "Toiletries", 300],
    ["Phone charger", "Electronics", 120],
    ["Reusable water bottle", "Essentials", 150],
  ] as const;
  return (
    <>
      <section className="ew-packing-overview">
        <div className="ew-packing-intro">
          <p className="ew-eyebrow">READY WHEN YOU ARE</p>
          <h2>
            {progress === 100 && rows.length
              ? "All packed. Adventure awaits."
              : "A place for everything."}
          </h2>
          <p>
            {done} of {rows.length} checklist items packed for {trip.name}.
          </p>
          <progress
            value={done}
            max={rows.length || 1}
            aria-label="Packing progress"
          />
          <small>Outfit pieces are counted once, even when worn again.</small>
        </div>
        <div
          className="ew-progress-ring"
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
          aria-hidden="true"
        >
          <div>
            <strong>
              {progress}
              <span>%</span>
            </strong>
            <small>PACKED & READY</small>
          </div>
        </div>
        <div
          className={`ew-weight-summary ${trip.weightLimit > 0 && weight > trip.weightLimit ? "ew-over-budget" : ""}`}
        >
          <Icon name="weight" size={28} />
          <div>
            <strong>
              {weight.toFixed(2)} <span>kg</span>
            </strong>
            <p>Known packed-list weight</p>
            <small>
              {trip.weightLimit
                ? `${trip.weightLimit} kg target`
                : "No luggage target set"}
            </small>
          </div>
          <IconButton
            icon="edit"
            label="Edit luggage target"
            onClick={() => open({ kind: "trip", id: trip.id })}
          />
        </div>
      </section>
      <p className="ew-packing-explainer">
        <Icon name="layers" size={18} />
        <span>
          <strong>It’s all connected.</strong> Clothes and gear assigned to your
          plans appear here automatically.
        </span>
      </p>
      <div className="ew-packing-layout">
        <section>
          <div className="ew-packing-toolbar">
            <div className="ew-segmented">
              {["All", "To pack", "Packed"].map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                  <span>
                    {f === "All"
                      ? rows.length
                      : f === "Packed"
                        ? done
                        : rows.length - done}
                  </span>
                </button>
              ))}
            </div>
            <Search
              value={query}
              onChange={setQuery}
              label="Find a packing item"
            />
          </div>
          {categories.map((c) => (
            <section className="ew-packing-group" key={c}>
              <div className="ew-packing-group-header">
                <h3>{c}</h3>
                <span>
                  {rows.filter((i) => i.category === c && i.packed).length}/
                  {rows.filter((i) => i.category === c).length} packed
                </span>
              </div>
              {visible
                .filter((i) => i.category === c)
                .map((i) => (
                  <div
                    key={`${i.automatic ? "auto" : "extra"}-${i.id}`}
                    className={`ew-packing-row ${i.packed ? "ew-is-packed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={i.packed}
                      aria-label={`Pack ${i.name}`}
                      onChange={(e) =>
                        check(i.id, i.automatic, e.target.checked)
                      }
                    />
                    {i.automatic ? (
                      <div className="ew-pack-thumb">
                        <Piece item={w.items.find((x) => x.id === i.id)!} />
                      </div>
                    ) : (
                      <span className="ew-pack-thumb ew-pack-icon">
                        <Icon name="bag" size={20} />
                      </span>
                    )}
                    <div className="ew-pack-name">
                      <strong>{i.name}</strong>
                      <small
                        title={i.dates.map((d) => dateLabel(d)).join(", ")}
                      >
                        {i.automatic
                          ? `From your plans · ${i.dates.length} ${i.dates.length === 1 ? "day" : "days"}`
                          : "Added to your list"}
                      </small>
                    </div>
                    <span className="ew-pack-quantity">×{i.quantity}</span>
                    <span className="ew-pack-weight">
                      {i.weight * i.quantity} g
                    </span>
                    <IconButton
                      icon="edit"
                      label={`Edit ${i.name}`}
                      onClick={() =>
                        open({ kind: i.automatic ? "item" : "extra", id: i.id })
                      }
                    />
                    {!i.automatic && (
                      <IconButton
                        icon="trash"
                        label={`Delete ${i.name}`}
                        onClick={() => remove("extra", i.id)}
                      />
                    )}
                  </div>
                ))}
            </section>
          ))}
          {!visible.length && (
            <Empty
              icon="bag"
              title={
                rows.length
                  ? "Nothing here just now."
                  : "Your list is ready to grow."
              }
              action={
                <Button
                  onClick={() =>
                    rows.length
                      ? (setFilter("All"), setQuery(""))
                      : open({ kind: "extra" })
                  }
                >
                  {rows.length ? "Clear filters" : "Add an essential"}
                </Button>
              }
            >
              {rows.length
                ? "Try a different packing filter or search."
                : "Assign an outfit to a day, or add the essentials you’ll carry."}
            </Empty>
          )}
          <p className="ew-hint">
            Weights include quantities.{" "}
            {missingWeight
              ? `${missingWeight} ${missingWeight === 1 ? "item has" : "items have"} no weight yet; the total is incomplete.`
              : "Bag weight itself is not included unless you add it."}{" "}
            Your target is a planning aid, not an airline allowance.
          </p>
        </section>
        <aside className="ew-packing-side">
          <section className="ew-essentials-card">
            <p className="ew-eyebrow">THE LITTLE THINGS</p>
            <h3>
              Easy to forget.
              <br />
              Good to remember.
            </h3>
            <p>A few basics for the journey. Add only what you need.</p>
            {essentials.map(([name, category, weight]) => {
              const added = trip.extras.some(
                (e) => e.name.toLowerCase() === name.toLowerCase(),
              );
              return (
                <button
                  key={name}
                  disabled={added}
                  onClick={() =>
                    change((d) => {
                      d.trips
                        .find((t) => t.id === trip.id)!
                        .extras.push({
                          id: uid(),
                          name,
                          category,
                          weight,
                          quantity: 1,
                          packed: false,
                        });
                    })
                  }
                >
                  {name}
                  <Icon name={added ? "check" : "plus"} size={16} />
                </button>
              );
            })}
          </section>
          <section className="ew-reuse-note">
            <Icon name="leaf" size={25} />
            <h3>Wear it again.</h3>
            <p>
              One shirt, three good days. Reuse pieces across outfits to make a
              little more room in your bag.
            </p>
            <Button
              variant="quiet"
              icon="arrow"
              onClick={() => navigate("outfits")}
            >
              Build an outfit
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
export function Trips({ props }: { props: ScreenProps }) {
  const { w, open, navigate, remove, duplicate } = props;
  return (
    <>
      <div className="ew-trips-grid">
        {w.trips.map((t) => {
          const rows = packing(w, t),
            done = rows.filter((i) => i.packed).length;
          return (
            <article className="ew-trip-card" key={t.id}>
              <button
                className="ew-trip-card-cover"
                onClick={() => navigate("planner", t)}
                aria-label={`Open ${t.name}`}
              >
                <Landscape theme={moodOf(t.theme)} />
                <span className="ew-pill">
                  {t.end < today()
                      ? "A GOOD MEMORY"
                      : t.start <= today()
                        ? "ON THE JOURNEY"
                        : "ON THE HORIZON"}
                </span>
                <span className="ew-cover-arrow">
                  <Icon name="arrow" />
                </span>
              </button>
              <div className="ew-trip-card-body">
                <h2>
                  <button onClick={() => navigate("planner", t)}>
                    {t.name}
                  </button>
                </h2>
                <p>
                  <Icon name="location" size={14} />
                  {t.destination}
                </p>
                <p>
                  <Icon name="calendar" size={14} />
                  {dateLabel(t.start)} –{" "}
                  {dateLabel(t.end, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <div className="ew-trip-card-stats">
                  <span>
                    {tripDates(t).length} days · {t.activities.length} plans
                  </span>
                  <span>
                    {done}/{rows.length} packed
                  </span>
                </div>
                <progress
                  value={done}
                  max={rows.length || 1}
                  aria-label={`Packing progress for ${t.name}`}
                />
                <div className="ew-trip-card-tools">
                  <Button
                    variant="quiet"
                    icon="edit"
                    onClick={() => open({ kind: "trip", id: t.id })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    icon="copy"
                    onClick={() => duplicate(t)}
                  >
                    Duplicate
                  </Button>
                  <IconButton
                    icon="trash"
                    label={`Delete ${t.name}`}
                    onClick={() => remove("trip", t.id)}
                  />
                </div>
              </div>
            </article>
          );
        })}
        <button className="ew-new-trip" onClick={() => open({ kind: "trip" })}>
          <span>
            <Icon name="plus" size={28} />
          </span>
          <h2>Where to next?</h2>
          <p>The best plans start with a little curiosity.</p>
          <strong>
            Plan a new trip <Icon name="arrow" size={16} />
          </strong>
        </button>
      </div>
      <div className="ew-trips-footer">
        <Icon name="mountain" size={32} />
        <p>
          Collect moments.
          <br />
          <strong>We’ll look after the details.</strong>
        </p>
      </div>
    </>
  );
}
export function PrintPlan({ w, trip }: { w: Workspace; trip?: Trip }) {
  if (!trip) return null;
  return (
    <section className="ew-print">
      <h1>{trip.name}</h1>
      <p>
        {trip.destination} · {dateLabel(trip.start)} –{" "}
        {dateLabel(trip.end, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}{" "}
        · {trip.travellers} travellers
      </p>
      {trip.notes && <p>{trip.notes}</p>}
      {tripDates(trip).map((date, index) => (
        <section key={date}>
          <h2>
            Day {index + 1} ·{" "}
            {dateLabel(date, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </h2>
          <h3>{trip.days[date]?.title}</h3>
          {dayActivities(trip, date).map((a) => (
            <div key={a.id}>
              <strong>
                {a.time || "All day"}
                {a.endTime ? `–${a.endTime}` : ""} · {a.title}
              </strong>
              <p>
                {a.place}
                {a.cost ? ` · ${money(a.cost, trip.currency)}` : ""}
              </p>
              {a.notes && <p>{a.notes}</p>}
              {a.link && <p>{a.link}</p>}
            </div>
          ))}
          {dayItems(w, trip, date).outfits.map((o) => (
            <p key={o.id}>
              <b>Wear: {o.name}</b> —{" "}
              {o.items
                .map((id) => w.items.find((i) => i.id === id)?.name)
                .join(", ")}
            </p>
          ))}
          {dayItems(w, trip, date).gear.length > 0 && (
            <p>
              Carry:{" "}
              {dayItems(w, trip, date)
                .gear.map((i) => i.name)
                .join(", ")}
            </p>
          )}
          {trip.days[date]?.stay && <p>Stay: {trip.days[date].stay}</p>}
          {trip.days[date]?.notes && <p>{trip.days[date].notes}</p>}
        </section>
      ))}
      <h2>Packing checklist</h2>
      <table>
        <thead>
          <tr>
            <th>Ready</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Total weight</th>
          </tr>
        </thead>
        <tbody>
          {packing(w, trip).map((i) => (
            <tr key={`${i.automatic}-${i.id}`}>
              <td>{i.packed ? "Yes" : "No"}</td>
              <td>{i.name}</td>
              <td>{i.quantity}</td>
              <td>{i.weight * i.quantity} g</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Estimated activity cost:{" "}
        {money(
          trip.activities.reduce((n, a) => n + a.cost, 0),
          trip.currency,
        )}{" "}
        · Times are destination-local.
      </p>
      <footer>Planned with Trips Loom. A plan, not a rulebook.</footer>
    </section>
  );
}
