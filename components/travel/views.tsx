"use client";
import React, { useState } from "react";
import {
  CATEGORIES,
  uid,
  packing,
  tripDates,
  type Workspace,
  type Trip,
} from "@/lib/model";
import {
  dateLabel,
  dayActivities,
  dayItems,
  money,
  today,
} from "@/lib/planning";
import type { Modal as EditorModal } from "./editor";
import {
  Button,
  Empty,
  Icon,
  IconButton,
  OutfitArt,
  Piece,
  Search,
} from "./primitives";
import { VisualCalendar, DaySnapshotArt } from "./calendar";
import { DaySummary, DayPreview } from "./day-preview";
import { HeroMood, MotionToggle } from "./moods";
import { Landscape } from "./landscape";
export type View =
  | "planner"
  | "wardrobe"
  | "outfits"
  | "packing"
  | "trips"
  | "settings";
export type ScreenProps = {
  w: Workspace;
  trip?: Trip;
  day: string;
  month: string;
  open: (modal: EditorModal) => void;
  selectDay: (day: string) => void;
  setMonth: (month: string) => void;
  navigate: (view: View, trip?: Trip) => void;
  change: (fn: (w: Workspace) => void) => void;
  remove: (
    kind: "trip" | "activity" | "item" | "outfit" | "extra",
    id: string,
  ) => void;
  duplicate: (trip: Trip) => void;
  exportTrip: () => void;
};
export const VIEW_LABELS: Record<View, string> = {
  planner: "Your trip, all together.",
  wardrobe: "A well-travelled wardrobe.",
  outfits: "Good days. Great outfits.",
  packing: "A little lighter. A lot readier.",
  trips: "Somewhere worth going.",
  settings: "Your plans, in good hands.",
};
export function TripHero({
  w,
  trip,
  open,
  navigate,
  change,
}: Pick<ScreenProps, "w" | "trip" | "open" | "navigate" | "change">) {
  if (!trip) return null;
  const dates = tripDates(trip),
    pack = packing(w, trip),
    planned = dates.filter((d) => dayItems(w, trip, d).outfits.length).length;
  return (
    <section className={`ew-hero ew-mood-${trip.theme || "mountains"}`} aria-label="Trip overview">
      <div className="ew-hero-landscape">
        <Landscape key={trip.theme} theme={trip.theme || "mountains"} />
      </div>
      <div className="ew-hero-content">
        <div className="ew-hero-label">
          <span className="ew-pill">
            <Icon name="compass" size={12} />
            THE NEXT ADVENTURE
          </span>
          {trip.sample && (
            <span className="ew-sample">Sample trip · make it yours</span>
          )}
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
      <div className="ew-hero-scene-controls"><HeroMood value={trip.theme || "mountains"} onChange={mood => change(d => { const current = d.trips.find(t => t.id === trip.id); if (current) current.theme = mood; })} /><MotionToggle /></div>
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
          A LITTLE PLANNING. A LOT OF LIVING.
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
export function Planner({ props }: { props: ScreenProps }) {
  const { w, trip, day, open, selectDay } = props;
  const [mode, setMode] = useState<"calendar" | "itinerary">("calendar");
  const [preview, setPreview] = useState(false);
  if (!trip) return <Empty title="Your next chapter starts here." action={<Button variant="primary" icon="plus" onClick={() => open({ kind: "trip" })}>Plan a trip</Button>}>Choose your dates. The rest will find its place.</Empty>;
  function showDay(date: string) { selectDay(date); setPreview(true); }
  return <>
    <TripHero {...props} />
    <div className="ew-planner-layout ew-visual-planner">
      <section className="ew-calendar-section">
        <div className="ew-planner-toolbar">
          <div className="ew-segmented" aria-label="Planner view">
            <button aria-pressed={mode === "calendar"} onClick={() => setMode("calendar")}><Icon name="calendar" size={15} />Calendar</button>
            <button aria-pressed={mode === "itinerary"} onClick={() => setMode("itinerary")}><Icon name="list" size={15} />Itinerary</button>
          </div><span className="ew-italic">A plan, not a rulebook.</span>
        </div>
        {mode === "calendar" ? <VisualCalendar props={props} onPreview={showDay} /> : <div className="ew-visual-agenda">{tripDates(trip).map((date, index) => {
          const events = dayActivities(trip, date);
          return <button type="button" key={date} className={`ew-agenda-card ${day === date ? "is-selected" : ""}`} onClick={() => showDay(date)} aria-label={`Preview ${dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}`}>
            <span className="ew-agenda-date"><small>DAY {index + 1}</small><strong>{dateLabel(date, { weekday: "short", day: "numeric", month: "short" })}</strong></span>
            <span className="ew-agenda-detail"><strong>{trip.days[date]?.title || events[0]?.title || "Room for a little adventure"}</strong><DaySnapshotArt w={w} trip={trip} date={date} roomy /></span><Icon name="right" size={16} />
          </button>;
        })}</div>}
        {trip.notes && <details className="ew-trip-notes"><summary><Icon name="note" size={15} />Trip notes</summary><p>{trip.notes}</p></details>}
      </section>
      <DaySummary props={props} onExpand={() => setPreview(true)} />
    </div>
    {preview && <DayPreview props={props} onDismiss={() => setPreview(false)} />}
  </>;
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
  const items = w.items.filter(
    (i) =>
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
            Items <span>{w.items.length}</span>
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
          {["All", ...CATEGORIES].map((c) => (
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
        Your wardrobe and uploaded photos are private to this visitor workspace.
      </p>
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
      <p className="ew-trips-intro">
        A weekend away, a long-awaited adventure, or just a change of scene.
        <br />
        Keep the whole journey in one thoughtful place.
      </p>
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
                <Landscape theme={t.theme || "mountains"} animated={false} />
                <span className="ew-pill">
                  {t.sample
                    ? "SAMPLE TRIP"
                    : t.end < today()
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
      <footer>Planned with Elsewhere. A plan, not a rulebook.</footer>
    </section>
  );
}
