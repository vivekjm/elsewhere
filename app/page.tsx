"use client";
import { useState, useEffect, useRef } from "react";
import {
  CalendarDays,
  Shirt,
  Luggage,
  Compass,
  Plus,
  ArrowUpRight,
  MapPin,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
  Download,
  Upload,
  Check,
  Camera,
  Footprints,
  Package,
  ArrowLeft,
  CloudCheck,
  AlertCircle,
  Plane,
  Wallet,
  Search,
  Layers,
  Printer,
} from "lucide-react";
import { Editor, type Modal, type FormDraft } from "@/components/travel/editor";
import { Choice, Piece } from "@/components/travel/primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Toaster, toast } from "sonner";
import {
  uid,
  workspaceSchema,
  tripDates,
  packing,
  removeItem,
  removeOutfit,
  type Workspace,
  type Trip,
  type Item,
  type Outfit,
  type Activity,
} from "@/lib/model";
import { download, packingCSV, calendarICS } from "@/lib/exports";
type View = "planner" | "wardrobe" | "outfits" | "packing" | "trips";

const labels = {
  planner: "Trip planner",
  wardrobe: "Wardrobe",
  outfits: "Outfits",
  packing: "Packing list",
  trips: "All trips",
};
const icons = {
  planner: CalendarDays,
  wardrobe: Shirt,
  outfits: Layers,
  packing: Luggage,
  trips: Plane,
};
const dateLabel = (
  d: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
    ...options,
    timeZone: "UTC",
  });
export default function Home() {
  const [tripId, setTripId] = useState(""),
    [day, setDay] = useState(""),
    [month, setMonth] = useState("2026-09"),
    [view, setView] = useState<View>("planner"),
    [calendarView, setCalendarView] = useState("calendar"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All"),
    [modal, setModal] = useState<Modal | null>(null),
    [form, setForm] = useState<FormDraft>({}),
    [confirmation, setConfirmation] = useState<{
      title: string;
      action: () => void;
    } | null>(null),
    [savingForm, setSavingForm] = useState(false);
  const { w, status, loadError, latest, load, flush, change } = useWorkspace(
    (data) => {
      setTripId(data.trips[0]?.id || "");
      setDay(data.trips[0]?.start || "");
      setMonth(
        data.trips[0]?.start.slice(0, 7) ||
          new Date().toISOString().slice(0, 7),
      );
    },
  );
  const restoreInput = useRef<HTMLInputElement>(null);
  const trip = w?.trips.find((t) => t.id === tripId) || w?.trips[0],
    dates = trip ? tripDates(trip) : [],
    dayData = trip?.days[day] || { outfitId: "", stay: "", notes: "" },
    plans =
      trip?.activities
        .filter((a) => a.date === day)
        .sort((a, b) => a.time.localeCompare(b.time)) || [],
    pack = w && trip ? packing(w, trip) : [],
    packedCount = pack.filter((i) => i.packed).length,
    weight = pack.reduce((n, i) => n + i.weight * i.quantity, 0) / 1000,
    cost = trip?.activities.reduce((n, a) => n + a.cost, 0) || 0;
  function updateTrip(fn: (t: Trip) => void) {
    change((d) => {
      const t = d.trips.find((t) => t.id === trip?.id);
      if (t) fn(t);
    });
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "read_trip_workspace",
            description:
              "Read this visitor’s trips, wardrobe, outfits, and derived packing lists.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw Error("Expected an empty object");
              if (!latest.current) throw Error("Workspace is loading");
              return structuredClone(latest.current);
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
  function chooseTrip(t: Trip) {
    setTripId(t.id);
    setDay(t.start);
    setMonth(t.start.slice(0, 7));
    setView("planner");
    setSearch("");
  }
  function open(kind: Modal["kind"], id?: string) {
    setModal({ kind, id });
    if (kind === "trip") {
      const t = w?.trips.find((t) => t.id === id);
      setForm(
        t
          ? {
              name: t.name,
              destination: t.destination,
              start: t.start,
              end: t.end,
              travellers: t.travellers,
              budget: t.budget,
              currency: t.currency,
              weightLimit: t.weightLimit,
            }
          : {
              name: "",
              destination: "",
              start: new Date().toISOString().slice(0, 10),
              end: new Date(Date.now() + 6 * 86400000)
                .toISOString()
                .slice(0, 10),
              travellers: 1,
              budget: 1000,
              currency: "EUR",
              weightLimit: 8,
            },
      );
    }
    if (kind === "activity")
      setForm(
        trip?.activities.find((a) => a.id === id) || {
          title: "",
          date: day || trip?.start,
          time: "10:00",
          place: "",
          category: "Explore",
          cost: 0,
          link: "",
          notes: "",
          outfitId: "",
          gear: [],
        },
      );
    if (kind === "item")
      setForm(
        w?.items.find((i) => i.id === id) || {
          name: "",
          category: "Tops",
          weight: 0,
          image: "",
        },
      );
    if (kind === "outfit")
      setForm(w?.outfits.find((o) => o.id === id) || { name: "", items: [] });
    if (kind === "day") setForm(dayData);
    if (kind === "extra")
      setForm(
        trip?.extras.find((i) => i.id === id) || {
          name: "",
          quantity: 1,
          weight: 0,
          packed: false,
        },
      );
  }
  const f = (key: keyof FormDraft, v: string | number | boolean | string[]) =>
    setForm((s) => ({ ...s, [key]: v }));
  function ask(title: string, action: () => void) {
    setConfirmation({ title, action });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || !w) return;
    const next = structuredClone(w);
    const t = next.trips.find((t) => t.id === trip?.id);
    const id = modal.id || uid();
    try {
      if (modal.kind === "trip") {
        const current = next.trips.find((t) => t.id === id);
        if (
          current &&
          current.activities.some(
            (a) => a.date < (form.start || "") || a.date > (form.end || ""),
          )
        )
          throw Error("Reschedule activities before shortening these dates.");
        const data = {
          ...form,
          id,
          activities: current?.activities || [],
          days: Object.fromEntries(
            Object.entries(current?.days || {}).filter(
              ([d]) => d >= (form.start || "") && d <= (form.end || ""),
            ),
          ),
          extras: current?.extras || [],
          packed: current?.packed || [],
        };
        if (current) Object.assign(current, data);
        else next.trips.push(data as Trip);
      }
      if (modal.kind === "activity" && t) {
        const a = { ...form, id };
        const i = t.activities.findIndex((a) => a.id === id);
        if (i < 0) t.activities.push(a as Activity);
        else t.activities[i] = a as Activity;
      }
      if (modal.kind === "item") {
        const i = next.items.findIndex((i) => i.id === id);
        if (i < 0) next.items.push({ ...form, id } as Item);
        else next.items[i] = { ...form, id } as Item;
      }
      if (modal.kind === "outfit") {
        if (!form.items?.length)
          throw Error("Choose at least one wardrobe item.");
        const i = next.outfits.findIndex((o) => o.id === id);
        if (i < 0) next.outfits.push({ ...form, id } as Outfit);
        else next.outfits[i] = { ...form, id } as Outfit;
      }
      if (modal.kind === "day" && t)
        t.days[day] = { ...form } as Trip["days"][string];
      if (modal.kind === "extra" && t) {
        const i = t.extras.findIndex((x) => x.id === id);
        if (i < 0) t.extras.push({ ...form, id } as Trip["extras"][number]);
        else t.extras[i] = { ...form, id } as Trip["extras"][number];
      }
      const result = workspaceSchema.safeParse(next);
      if (!result.success) throw Error(result.error.issues[0].message);
      change((d) => Object.assign(d, result.data));
      if (modal.kind === "trip") {
        chooseTrip(result.data.trips.find((t) => t.id === id)!);
      }
      if (modal.kind === "activity") {
        setDay(form.date!);
        setMonth(form.date!.slice(0, 7));
      }
      setModal(null);
      toast.success("Your changes are ready to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Please check your details");
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setSavingForm(true);
    try {
      const fd = new FormData();
      fd.set("image", file);
      const r = await fetch("/api/images", { method: "POST", body: fd }),
        d = (await r.json()) as {
          error?: string;
          workspace: unknown;
          revision: number;
          url: string;
        };
      if (!r.ok) throw Error(d.error);
      f("image", d.url);
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSavingForm(false);
    }
  }
  async function restore(file?: File) {
    if (!file || !w) return;
    try {
      if (file.size > 1500000)
        throw Error("Choose a backup smaller than 1.5 MB.");
      const data = workspaceSchema.parse(JSON.parse(await file.text()));
      ask("Replace this workspace with your backup?", () => {
        change((d) => Object.assign(d, data));
        setTripId(data.trips[0]?.id || "");
        setDay(data.trips[0]?.start || "");
        setMonth(data.trips[0]?.start.slice(0, 7) || month);
        toast.success(
          "Backup restored. Photos stay private to the browser that uploaded them.",
        );
      });
    } catch {
      toast.error("This isn’t a valid Elsewhere backup (version 1).");
    } finally {
      if (restoreInput.current) restoreInput.current.value = "";
    }
  }
  const outfitOptions = [
    { value: "", label: "No outfit assigned" },
    ...(w?.outfits.map((o) => ({ value: o.id, label: o.name })) || []),
  ];
  function outfitCard(o: Outfit) {
    return (
      <div className="look" key={o.id}>
        <div className="look-pieces">
          {o.items.map((id) => {
            const i = w?.items.find((i) => i.id === id);
            return i ? <Piece key={id} item={i} /> : null;
          })}
        </div>
        <div className="look-caption">
          <div>
            <h3>{o.name}</h3>
            <p>
              {o.items.length} pieces ·{" "}
              {o.items.reduce(
                (n, id) => n + (w?.items.find((i) => i.id === id)?.weight || 0),
                0,
              )}{" "}
              g
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label={`Edit ${o.name}`}
            onClick={() => open("outfit", o.id)}
          >
            <Pencil />
          </button>
        </div>
      </div>
    );
  }
  function activityCard(a: Activity) {
    return (
      <article
        key={a.id}
        className={`activity ${a.category === "Food & drink" ? "sand" : ""}`}
      >
        <div className="between">
          <small>
            {a.time} · {a.category.toUpperCase()}
          </small>
          <button
            className="icon-btn"
            aria-label={`Edit ${a.title}`}
            onClick={() => open("activity", a.id)}
          >
            <Pencil />
          </button>
        </div>
        <h3>{a.title}</h3>
        {a.place && (
          <p>
            <MapPin size={12} /> {a.place}
            {a.cost > 0 && ` · ${money(a.cost)}`}
          </p>
        )}
        {a.notes && <p>{a.notes}</p>}
        {a.outfitId && (
          <span className="mini-label">
            <Shirt size={12} />
            {w?.outfits.find((o) => o.id === a.outfitId)?.name}
          </span>
        )}
        {a.link && (
          <a
            href={a.link}
            target="_blank"
            rel="noreferrer"
            className="reference"
          >
            Open reference <ArrowUpRight size={12} />
          </a>
        )}
        <button
          className="delete-activity"
          aria-label={`Delete ${a.title}`}
          onClick={() =>
            ask(`Delete “${a.title}”?`, () =>
              updateTrip(
                (t) =>
                  (t.activities = t.activities.filter((x) => x.id !== a.id)),
              ),
            )
          }
        >
          <Trash2 size={13} />
        </button>
      </article>
    );
  }
  const money = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: trip?.currency || "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  const title =
    modal?.kind === "day"
      ? "Day details"
      : `${modal?.id ? "Edit" : "New"} ${modal?.kind === "extra" ? "packing item" : modal?.kind}`;
  if (loadError)
    return (
      <main className="error-screen">
        <Compass size={40} />
        <h1>Your workspace couldn’t load</h1>
        <p>{loadError}</p>
        <button className="primary" onClick={() => void load()}>
          Try again
        </button>
      </main>
    );
  if (!w)
    return (
      <main className="error-screen">
        <Compass size={40} />
        <h1>Getting your plans ready</h1>
        <p>Opening your personal travel workspace…</p>
      </main>
    );
  const monthStart = new Date(month + "-01T12:00:00Z"),
    offset = (monthStart.getUTCDay() + 6) % 7,
    monthDays = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
    ).getUTCDate(),
    calendarDays = Array.from(
      { length: Math.ceil((offset + monthDays) / 7) * 7 },
      (_, i) => i - offset + 1,
    );
  return (
    <SidebarProvider
      className="shell"
      style={{ "--sidebar-width": "225px" } as React.CSSProperties}
    >
      <Toaster position="top-center" richColors />
      <Sidebar className="travel-sidebar">
        <SidebarHeader>
          <button className="brand" onClick={() => setView("trips")}>
            <Compass /> elsewhere<span>TRAVEL, TOGETHER</span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {(Object.keys(labels) as View[]).map((v) => {
              const Icon = icons[v];
              return (
                <SidebarMenuItem key={v}>
                  <SidebarMenuButton
                    isActive={view === v}
                    onClick={() => {
                      setView(v);
                      setSearch("");
                      setFilter("All");
                    }}
                  >
                    <Icon />
                    <span>{labels[v]}</span>
                    {v === "packing" && (
                      <span className="nav-count">{pack.length}</span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          <div className="side-trips">
            <p className="eyebrow">YOUR TRIPS</p>
            {w.trips.map((t) => (
              <button
                className={t.id === trip?.id ? "chosen" : ""}
                key={t.id}
                onClick={() => chooseTrip(t)}
              >
                <span className="trip-marker" />
                {t.name}
              </button>
            ))}
            <button onClick={() => open("trip")}>
              <Plus size={13} /> Plan another trip
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="rail-note">
            A little planning.
            <br />A lot of possibility.
          </div>
          <small>Private to this browser · No account needed</small>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header>
          <span>YOUR TRAVEL WORKSPACE</span>
          <div className="header-actions">
            <span className="save-status" aria-live="polite">
              {status === "All changes saved" ? (
                <CloudCheck size={13} />
              ) : (
                <AlertCircle size={13} />
              )}{" "}
              {status === "All changes saved"
                ? "Saved"
                : status === "Saving…"
                  ? "Saving…"
                  : "Unsaved"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="outline compact">
                  <Download /> Workspace
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() =>
                    download(
                      "elsewhere-backup.json",
                      JSON.stringify(latest.current, null, 2),
                    )
                  }
                >
                  Download backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => restoreInput.current?.click()}>
                  Restore backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void flush()}>
                  Retry saving
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.reload()}>
                  Reload workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="avatar">E</span>
          </div>
        </header>
        <input
          type="file"
          accept="application/json,.json"
          ref={restoreInput}
          hidden
          onChange={(e) => void restore(e.target.files?.[0])}
        />
        {status !== "All changes saved" &&
          status !== "Saving…" &&
          status !== "Unsaved changes" && (
            <div role="alert" className="error-banner">
              {status}
              <button onClick={() => void flush()}>Retry save</button>
              <button
                onClick={() =>
                  download(
                    "elsewhere-unsaved-backup.json",
                    JSON.stringify(latest.current, null, 2),
                  )
                }
              >
                Export edits
              </button>
            </div>
          )}
        {view !== "trips" && trip && (
          <>
            <div className="trip-heading">
              <div>
                <p className="eyebrow">
                  NEXT STOP · {trip.destination.toUpperCase()}
                  {trip.id === "lisbon" && (
                    <span className="sample-tag">SAMPLE TRIP</span>
                  )}
                </p>
                <h1>
                  {trip.name} <ArrowUpRight size={25} />
                </h1>
                <p>
                  {dateLabel(trip.start)} –{" "}
                  {dateLabel(trip.end, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {trip.travellers}{" "}
                  {trip.travellers === 1 ? "traveller" : "travellers"}
                </p>
              </div>
              <div className="heading-actions">
                <button
                  className="primary"
                  onClick={() =>
                    open(
                      view === "planner"
                        ? "activity"
                        : view === "wardrobe"
                          ? "item"
                          : view === "outfits"
                            ? "outfit"
                            : "extra",
                    )
                  }
                >
                  <Plus />
                  {view === "planner"
                    ? "Add activity"
                    : view === "wardrobe"
                      ? "Add item"
                      : view === "outfits"
                        ? "Create outfit"
                        : "Add essential"}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="outline icon-btn"
                      aria-label="Trip options"
                    >
                      <MoreHorizontal />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => open("trip", trip.id)}>
                      Edit trip
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const t = {
                          ...structuredClone(trip),
                          id: uid(),
                          name: trip.name + " (copy)",
                        };
                        change((d) => d.trips.push(t));
                        chooseTrip(t);
                      }}
                    >
                      Duplicate trip
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        download(
                          "trip-calendar.ics",
                          calendarICS(trip),
                          "text/calendar",
                        )
                      }
                    >
                      Export calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.print()}>
                      Print itinerary
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        ask(`Delete “${trip.name}” and its plans?`, () => {
                          change(
                            (d) =>
                              (d.trips = d.trips.filter(
                                (t) => t.id !== trip.id,
                              )),
                          );
                          const next = w.trips.find((t) => t.id !== trip.id);
                          if (next) chooseTrip(next);
                          else setView("trips");
                        })
                      }
                    >
                      Delete trip
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="stats">
              <div>
                <small>THE PLAN</small>
                <strong>
                  {dates.length} days · {trip.activities.length} activities
                </strong>
              </div>
              <div>
                <small>TRIP BUDGET</small>
                <strong>
                  {money(cost)} planned <span>/ {money(trip.budget)}</span>
                </strong>
                {cost > trip.budget && (
                  <p className="warning">
                    Over budget by {money(cost - trip.budget)}
                  </p>
                )}
              </div>
              <div>
                <small>PACKING</small>
                <strong>
                  {packedCount} of {pack.length} ready{" "}
                  <span>· {weight.toFixed(1)} kg</span>
                </strong>
              </div>
            </div>
          </>
        )}
        {(view === "planner" || view === "packing") && !trip && (
          <div className="empty-state">
            <Plane />
            <h2>Your next adventure starts here</h2>
            <p>Create a trip to plan activities and packing.</p>
            <button className="primary" onClick={() => open("trip")}>
              Plan a trip
            </button>
            <button className="outline" onClick={() => setView("trips")}>
              All trips
            </button>
          </div>
        )}
        {view === "planner" && trip && (
          <>
            <div className="view-toolbar">
              <h2>Your days, thoughtfully planned</h2>
              <Tabs value={calendarView} onValueChange={setCalendarView}>
                <TabsList>
                  <TabsTrigger value="calendar">Calendar</TabsTrigger>
                  <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="planner-grid">
              <section className="panel calendar-panel">
                {calendarView === "calendar" ? (
                  <>
                    <div className="section-title">
                      <h2>
                        {dateLabel(month + "-01", {
                          month: "long",
                          year: "numeric",
                        })}
                      </h2>
                      <div className="calendar-actions">
                        <button
                          className="text-btn"
                          onClick={() => setMonth(trip.start.slice(0, 7))}
                        >
                          Trip dates
                        </button>
                        <button
                          className="icon-btn"
                          aria-label="Previous month"
                          onClick={() =>
                            setMonth(
                              new Date(
                                Date.UTC(
                                  monthStart.getUTCFullYear(),
                                  monthStart.getUTCMonth() - 1,
                                  1,
                                ),
                              )
                                .toISOString()
                                .slice(0, 7),
                            )
                          }
                        >
                          <ChevronLeft />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label="Next month"
                          onClick={() =>
                            setMonth(
                              new Date(
                                Date.UTC(
                                  monthStart.getUTCFullYear(),
                                  monthStart.getUTCMonth() + 1,
                                  1,
                                ),
                              )
                                .toISOString()
                                .slice(0, 7),
                            )
                          }
                        >
                          <ChevronRight />
                        </button>
                      </div>
                    </div>
                    <div className="mobile-days">
                      {dates
                        .filter((d) => d.startsWith(month))
                        .map((d) => (
                          <button
                            key={d}
                            aria-label={`Select ${dateLabel(d, { weekday: "long", month: "long", day: "numeric" })}`}
                            aria-pressed={d === day}
                            className={d === day ? "selected" : ""}
                            onClick={() => setDay(d)}
                          >
                            <small>{dateLabel(d, { weekday: "short" })}</small>
                            <b>{new Date(d + "T12:00:00Z").getUTCDate()}</b>
                            <i
                              className={
                                trip.activities.some((a) => a.date === d)
                                  ? "has-plans"
                                  : ""
                              }
                            />
                          </button>
                        ))}
                      {!dates.some((d) => d.startsWith(month)) && (
                        <p className="muted">
                          No trip days this month. Use Trip dates to return.
                        </p>
                      )}
                    </div>
                    <div className="calendar">
                      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(
                        (x) => (
                          <small key={x}>{x}</small>
                        ),
                      )}
                      {calendarDays.map((n, i) => {
                        const d = month + "-" + String(n).padStart(2, "0"),
                          valid = n > 0 && n <= monthDays,
                          inTrip = valid && d >= trip.start && d <= trip.end,
                          activities = trip.activities.filter(
                            (a) => a.date === d,
                          );
                        return (
                          <button
                            key={i}
                            disabled={!inTrip}
                            aria-label={
                              valid
                                ? dateLabel(d, {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                  })
                                : "Outside month"
                            }
                            aria-pressed={d === day}
                            onClick={() => setDay(d)}
                            className={
                              d === day ? "selected" : inTrip ? "in-trip" : ""
                            }
                          >
                            <b>{valid ? n : ""}</b>
                            {activities.slice(0, 2).map((a) => (
                              <span
                                key={a.id}
                                className={`event-chip ${a.category === "Food & drink" ? "sand" : ""}`}
                              >
                                {a.title}
                              </span>
                            ))}
                            {activities.length > 2 && (
                              <span className="more-events">
                                +{activities.length - 2}
                              </span>
                            )}
                            {trip.days[d]?.outfitId && (
                              <Shirt className="day-shirt" />
                            )}
                            {inTrip && <span className="day-dot" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="calendar-legend">
                      <span>
                        <i /> Trip dates
                      </span>
                      <span>
                        <Shirt size={12} /> Outfit assigned
                      </span>
                      <span>{dates.length} days to make your own</span>
                    </div>
                  </>
                ) : (
                  <div className="itinerary">
                    {dates.map((d) => (
                      <section key={d}>
                        <button
                          className="itinerary-date"
                          onClick={() => {
                            setDay(d);
                            setMonth(d.slice(0, 7));
                            setCalendarView("calendar");
                          }}
                        >
                          {dateLabel(d, {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                          <ArrowUpRight size={15} />
                        </button>
                        {trip.activities
                          .filter((a) => a.date === d)
                          .sort((a, b) => a.time.localeCompare(b.time))
                          .map(activityCard)}
                        {!trip.activities.some((a) => a.date === d) && (
                          <p className="muted">
                            A little room for spontaneity.
                          </p>
                        )}
                        {trip.days[d]?.stay && (
                          <p className="muted">Stay · {trip.days[d].stay}</p>
                        )}
                        {trip.days[d]?.notes && (
                          <p className="muted">{trip.days[d].notes}</p>
                        )}
                      </section>
                    ))}
                  </div>
                )}
              </section>
              <section className="panel day-panel">
                <div className="between">
                  <p className="eyebrow">
                    {dateLabel(day, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }).toUpperCase()}
                  </p>
                  <button
                    className="icon-btn"
                    aria-label="Edit day details"
                    onClick={() => open("day")}
                  >
                    <Pencil />
                  </button>
                </div>
                <h2>
                  {plans.length
                    ? "A day with possibility"
                    : "Make this day your own"}
                </h2>
                <p className="muted">
                  {plans.length}{" "}
                  {plans.length === 1 ? "activity" : "activities"} · Day{" "}
                  {dates.indexOf(day) + 1} of {dates.length}
                </p>
                {plans.map(activityCard)}
                {!plans.length && (
                  <div className="empty-day">
                    <MapPin />
                    <p>A new place, a slow morning, or something unexpected.</p>
                  </div>
                )}
                <button className="outline" onClick={() => open("activity")}>
                  <Plus /> Add to this day
                </button>
                <div className="daily-look">
                  <div className="between">
                    <p className="eyebrow">OUTFIT OF THE DAY</p>
                    <button className="text-btn" onClick={() => open("day")}>
                      Change
                    </button>
                  </div>
                  {dayData.outfitId &&
                  w.outfits.find((o) => o.id === dayData.outfitId) ? (
                    outfitCard(
                      w.outfits.find((o) => o.id === dayData.outfitId)!,
                    )
                  ) : (
                    <button className="assign-look" onClick={() => open("day")}>
                      <Shirt /> Pick a look for this day
                    </button>
                  )}
                </div>
                {dayData.stay && (
                  <div className="stay">
                    <small>STAYING AT</small>
                    <p>{dayData.stay}</p>
                  </div>
                )}
                {dayData.notes && (
                  <div className="day-notes">
                    <small>DAY NOTES</small>
                    <p>{dayData.notes}</p>
                  </div>
                )}
              </section>
            </div>
            <section className="ready-looks">
              <div className="section-title">
                <h2>A look for every little adventure</h2>
                <button className="text-btn" onClick={() => setView("outfits")}>
                  All outfits <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="look-grid">
                {w.outfits.slice(0, 3).map(outfitCard)}
                {!w.outfits.length && (
                  <div className="empty-state">
                    <Shirt />
                    <p>
                      Create an outfit to connect your calendar and packing
                      list.
                    </p>
                    <button className="outline" onClick={() => open("outfit")}>
                      Create outfit
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
        {view === "wardrobe" && (
          <>
            {!trip && (
              <div className="trip-heading">
                <h1>Your wardrobe</h1>
                <button className="primary" onClick={() => open("item")}>
                  <Plus /> Add item
                </button>
              </div>
            )}
            <div className="view-toolbar">
              <div>
                <h2>Your wardrobe, ready to wander</h2>
                <p className="muted">
                  {w.items.length} pieces · Ready for your next trip
                </p>
              </div>
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="Search wardrobe"
                  placeholder="Find a piece…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <div className="filters">
              {[
                "All",
                "Tops",
                "Bottoms",
                "Layers",
                "Shoes",
                "Accessories",
                "Gear",
              ].map((x) => (
                <button
                  className={filter === x ? "active" : ""}
                  key={x}
                  onClick={() => setFilter(x)}
                >
                  {x}
                </button>
              ))}
            </div>
            <div className="wardrobe-grid">
              {w.items
                .filter(
                  (i) =>
                    (filter === "All" || i.category === filter) &&
                    i.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((i) => (
                  <article className="wardrobe-card" key={i.id}>
                    <button
                      className="piece-button"
                      onClick={() => open("item", i.id)}
                    >
                      <Piece item={i} large />
                    </button>
                    <div className="look-caption">
                      <div>
                        <h3>{i.name}</h3>
                        <p>
                          {i.category} · {i.weight} g
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="icon-btn"
                            aria-label={`${i.name} options`}
                          >
                            <MoreHorizontal />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => open("item", i.id)}>
                            Edit item
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              ask(
                                `Delete “${i.name}” from your wardrobe and outfits?`,
                                () => change((d) => removeItem(d, i.id)),
                              )
                            }
                          >
                            Delete item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </article>
                ))}
            </div>
            {!w.items.some(
              (i) =>
                (filter === "All" || i.category === filter) &&
                i.name.toLowerCase().includes(search.toLowerCase()),
            ) && (
              <div className="empty-state">
                <Shirt />
                <h2>No pieces here yet</h2>
                <p>Add a piece or try another search.</p>
                <button className="outline" onClick={() => open("item")}>
                  Add item
                </button>
              </div>
            )}
          </>
        )}
        {view === "outfits" && (
          <>
            {!trip && (
              <div className="trip-heading">
                <h1>Your outfits</h1>
                <button className="primary" onClick={() => open("outfit")}>
                  <Plus /> Create outfit
                </button>
              </div>
            )}
            <div className="view-toolbar">
              <div>
                <h2>Good days start with a good outfit</h2>
                <p className="muted">
                  Combine your pieces. Reuse your favourites.
                </p>
              </div>
            </div>
            <div className="look-grid all-looks">
              {w.outfits.map((o) => (
                <article key={o.id}>
                  {outfitCard(o)}
                  <div className="outfit-actions">
                    <button
                      className="outline compact"
                      disabled={!trip}
                      onClick={() => {
                        updateTrip(
                          (t) => (t.days[day] = { ...dayData, outfitId: o.id }),
                        );
                        toast.success(`Assigned to ${dateLabel(day)}`);
                      }}
                    >
                      <CalendarDays /> Wear{" "}
                      {trip ? dateLabel(day) : "on a trip"}
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Duplicate ${o.name}`}
                      onClick={() =>
                        change((d) =>
                          d.outfits.push({
                            ...structuredClone(o),
                            id: uid(),
                            name: o.name + " (copy)",
                          }),
                        )
                      }
                    >
                      <Copy />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Delete ${o.name}`}
                      onClick={() =>
                        ask(`Delete “${o.name}” and its day assignments?`, () =>
                          change((d) => removeOutfit(d, o.id)),
                        )
                      }
                    >
                      <Trash2 />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!w.outfits.length && (
              <div className="empty-state">
                <Layers />
                <h2>Your first look is waiting</h2>
                <p>
                  Add clothes to your wardrobe, then bring them together here.
                </p>
                <button className="primary" onClick={() => open("outfit")}>
                  Create outfit
                </button>
              </div>
            )}
          </>
        )}
        {view === "packing" && trip && (
          <>
            <div className="packing-overview">
              <div>
                <p className="eyebrow">A PLACE FOR EVERYTHING</p>
                <h2>
                  {packedCount === pack.length && pack.length
                    ? "You’re ready to go"
                    : "One less thing to think about"}
                </h2>
                <p className="muted">
                  Outfits and activity gear appear here automatically. Reused
                  pieces count once.
                </p>
                <div className="packing-progress">
                  <Progress
                    value={pack.length ? (packedCount / pack.length) * 100 : 0}
                  />
                  <span>
                    {packedCount}/{pack.length} packed
                  </span>
                </div>
              </div>
              <div className="weight-summary">
                <Luggage />
                <strong>
                  {weight.toFixed(2)} <span>kg</span>
                </strong>
                <small>of {trip.weightLimit} kg target</small>
                {weight > trip.weightLimit && (
                  <p className="warning">
                    {(weight - trip.weightLimit).toFixed(2)} kg over target
                  </p>
                )}
              </div>
            </div>
            <div className="view-toolbar">
              <div className="filters">
                {["All", "To pack", "Packed"].map((x) => (
                  <button
                    className={filter === x ? "active" : ""}
                    key={x}
                    onClick={() => setFilter(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="header-actions">
                <label className="search">
                  <Search size={15} />
                  <input
                    aria-label="Search packing list"
                    placeholder="Find an item…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button
                  className="outline compact"
                  onClick={() =>
                    download(
                      "packing-list.csv",
                      packingCSV(w, trip),
                      "text/csv",
                    )
                  }
                >
                  <Download /> CSV
                </button>
              </div>
            </div>
            <div className="panel pack-list">
              {pack
                .filter(
                  (i) =>
                    (filter === "All" || i.packed === (filter === "Packed")) &&
                    i.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((i) => (
                  <div
                    className={`pack-row ${i.packed ? "packed" : ""}`}
                    key={i.id}
                  >
                    <Checkbox
                      aria-label={`Pack ${i.name}`}
                      checked={i.packed}
                      onCheckedChange={(checked) =>
                        updateTrip((t) => {
                          if (i.automatic)
                            t.packed = checked
                              ? [...new Set([...t.packed, i.id])]
                              : t.packed.filter((x) => x !== i.id);
                          else {
                            const x = t.extras.find((x) => x.id === i.id);
                            if (x) x.packed = !!checked;
                          }
                        })
                      }
                    />
                    <div className="pack-icon">
                      {i.automatic ? <Shirt /> : <Package />}
                    </div>
                    <div className="pack-name">
                      <h3>{i.name}</h3>
                      <small>
                        {i.category} ·{" "}
                        {i.automatic ? "From your plans" : "Added essential"}
                      </small>
                    </div>
                    <span className="quantity">×{i.quantity}</span>
                    <span className="pack-weight">
                      {i.weight * i.quantity} g
                    </span>
                    {!i.automatic && (
                      <>
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${i.name}`}
                          onClick={() => open("extra", i.id)}
                        >
                          <Pencil />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`Remove ${i.name}`}
                          onClick={() =>
                            ask(`Remove “${i.name}” from packing?`, () =>
                              updateTrip(
                                (t) =>
                                  (t.extras = t.extras.filter(
                                    (x) => x.id !== i.id,
                                  )),
                              ),
                            )
                          }
                        >
                          <Trash2 />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              {!pack.length && (
                <div className="empty-state">
                  <Luggage />
                  <h2>Let’s pack for your plans</h2>
                  <p>Assign outfits to days or add an essential.</p>
                </div>
              )}
              {pack.length > 0 &&
                !pack.some(
                  (i) =>
                    (filter === "All" || i.packed === (filter === "Packed")) &&
                    i.name.toLowerCase().includes(search.toLowerCase()),
                ) && (
                  <div className="empty-state">
                    <Check />
                    <p>No items match this view.</p>
                  </div>
                )}
              <button
                className="text-btn add-essential"
                onClick={() => open("extra")}
              >
                <Plus size={15} /> Add an essential
              </button>
            </div>
          </>
        )}
        {view === "trips" && (
          <>
            <div className="trip-heading">
              <div>
                <p className="eyebrow">NEAR, FAR, AND EVERYWHERE</p>
                <h1>Your next chapter</h1>
                <p>All your trips, in one little corner of the world.</p>
              </div>
              <button className="primary" onClick={() => open("trip")}>
                <Plus /> Plan a trip
              </button>
            </div>
            <div className="trips-grid">
              {w.trips.map((t, i) => (
                <button
                  className="trip-card"
                  key={t.id}
                  onClick={() => chooseTrip(t)}
                >
                  <div className={`trip-art art-${i % 3}`}>
                    <Compass strokeWidth={0.8} />
                    <span>{t.destination}</span>
                    <ArrowUpRight />
                  </div>
                  <div className="trip-card-body">
                    <p className="eyebrow">
                      {dateLabel(t.start)} – {dateLabel(t.end)}
                    </p>
                    <h2>{t.name}</h2>
                    <p>
                      {tripDates(t).length} days · {t.travellers} travellers ·{" "}
                      {t.activities.length} activities
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {!w.trips.length && (
              <div className="empty-state">
                <Plane />
                <h2>A whole world of possibilities</h2>
                <p>Plan your first trip to begin.</p>
              </div>
            )}
          </>
        )}
        <footer className="workspace-footer">
          <span>Made for the journey, and everything you bring.</span>
          <span>Elsewhere / Travel thoughtfully</span>
        </footer>
      </main>
      <nav className="mobile-nav">
        {(["planner", "wardrobe", "outfits", "packing", "trips"] as View[]).map(
          (v) => {
            const Icon = icons[v];
            return (
              <button
                className={view === v ? "active" : ""}
                onClick={() => {
                  setView(v);
                  setSearch("");
                  setFilter("All");
                }}
                key={v}
              >
                <Icon />
                <span>
                  {v === "planner"
                    ? "Planner"
                    : v === "packing"
                      ? "Packing"
                      : v === "trips"
                        ? "Trips"
                        : labels[v]}
                </span>
              </button>
            );
          },
        )}
      </nav>
      <Editor
        modal={modal}
        setModal={setModal}
        title={title}
        form={form}
        f={f}
        w={w}
        trip={trip}
        day={day}
        dateLabel={dateLabel}
        outfitOptions={outfitOptions}
        savingForm={savingForm}
        submit={submit}
        upload={upload}
      />
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(o) => {
          if (!o) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            This changes your saved workspace. Download a backup first if you’d
            like to keep a copy.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmation?.action();
                setConfirmation(null);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className="print-only">
        <h1>{trip?.name}</h1>
        <p>
          {trip?.destination} · {trip?.start} – {trip?.end}
        </p>
        {trip &&
          dates.map((d) => (
            <section key={d}>
              <h2>
                {dateLabel(d, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              {trip.activities
                .filter((a) => a.date === d)
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((a) => (
                  <p key={a.id}>
                    {a.time} — {a.title} · {a.place} · {money(a.cost)}
                    <br />
                    {a.notes}
                    {a.outfitId &&
                      ` · Outfit: ${w.outfits.find((o) => o.id === a.outfitId)?.name}`}
                  </p>
                ))}
              <p>
                {trip.days[d]?.stay} {trip.days[d]?.notes}
              </p>
            </section>
          ))}
        <h2>Packing list</h2>
        {pack.map((i) => (
          <p key={i.id}>
            {i.packed ? "☑" : "☐"} {i.name} ×{i.quantity} ·{" "}
            {i.weight * i.quantity} g
          </p>
        ))}
      </section>
    </SidebarProvider>
  );
}
