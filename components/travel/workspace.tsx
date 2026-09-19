"use client";
import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  packing,
  validDate,
  removeItem,
  removeOutfit,
  type Workspace,
  type Trip,
  type Activity,
  type Item,
  type Outfit,
  type Day,
  type Extra,
} from "@/lib/model";
import { duplicateTrip, resizeTrip, today, money } from "@/lib/planning";
import { calendarICS, packingCSV, filename, download } from "@/lib/exports";
import { exportBackup } from "@/lib/backup";
import { Editor, type Modal as EditorModal, type EditorResult } from "./editor";
import { Button, Icon, IconButton, Modal } from "./primitives";
import { Select } from "./pickers";
import {
  Planner,
  Wardrobe,
  Essentials,
  Packing,
  Trips,
  PrintPlan,
  VIEW_LABELS,
  type View,
  type ScreenProps,
} from "./views";
import { NAV as nav } from "./screen";
import {
  AuthProvider,
  useAuth,
  type AuthProfile,
} from "@/components/auth/auth-context";
import { AuthLoading, AuthScreen } from "@/components/auth/auth-screen";
import { OnboardingFlow } from "@/components/auth/onboarding";
type Route = { view: View; tripId: string; day: string; month: string };
type ColorTheme = "olive" | "coast" | "terracotta" | "lavender";
const COLOR_THEMES: { id: ColorTheme; label: string; description: string }[] = [
  { id: "olive", label: "Forest", description: "Calm olive and warm paper" },
  { id: "coast", label: "Coast", description: "Sea blue and cool mist" },
  {
    id: "terracotta",
    label: "Terracotta",
    description: "Clay, sand and soft cream",
  },
  { id: "lavender", label: "Lavender", description: "Plum and pale lilac" },
];
function readRoute(w: Workspace): Route {
  const [path, query] = window.location.hash.slice(1).split("?"),
    params = new URLSearchParams(query);
  const view = (
    [
      "planner",
      "wardrobe",
      "outfits",
      "essentials",
      "packing",
      "trips",
      "settings",
    ].includes(path)
      ? path
      : "planner"
  ) as View;
  const trip = w.trips.find((t) => t.id === params.get("trip")) || w.trips[0];
  const date = params.get("day") || trip?.start || today();
  const day =
    trip && (date < trip.start || date > trip.end || !validDate(date))
      ? trip.start
      : date;
  const candidate = params.get("month") || day.slice(0, 7),
    month =
      /^\d{4}-(0[1-9]|1[0-2])$/.test(candidate) &&
      candidate >= "1900-01" &&
      candidate <= "2200-12"
        ? candidate
        : day.slice(0, 7);
  return { view, tripId: trip?.id || "", day, month };
}
const href = (r: Route) =>
  `#${r.view}?${new URLSearchParams({ trip: r.tripId, day: r.day, month: r.month })}`;
function Brand() {
  return (
    <span className="ew-wordmark">
      trips loom<span>.</span>
    </span>
  );
}
class Boundary extends React.Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="ew ew-startup">
        <Brand />
        <h1>Something got in the way.</h1>
        <p>Reload to reopen the latest version saved to your workspace.</p>
        <Button onClick={() => window.location.reload()}>
          Reload Trips Loom
        </Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function WorkspaceApp({
  accessToken,
  profile,
  accountEmail,
  onSignOut,
  onEditProfile,
}: {
  accessToken?: string | null;
  profile?: AuthProfile | null;
  accountEmail?: string;
  onSignOut?: () => Promise<void>;
  onEditProfile?: () => void;
}) {
  const [route, setRoute] = useState<Route>(() => {
    const day = today();
    return { view: "planner", tripId: "", day, month: day.slice(0, 7) };
  });
  const store = useWorkspace((w) => setRoute(readRoute(w)), accessToken);
  const [editor, setEditor] = useState<
      (EditorModal & { tripId?: string }) | null
    >(null),
    [duplicateDraft, setDuplicateDraft] = useState<{
      source: Trip;
      name: string;
    } | null>(null),
    [duplicateError, setDuplicateError] = useState(""),
    [exportOpen, setExportOpen] = useState(false),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: () => void | Promise<void>;
      label?: string;
      dangerous?: boolean;
    } | null>(null);
  const [toast, setToast] = useState<{
      message: string;
      error?: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [includePhotos, setIncludePhotos] = useState(true),
    [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
      if (typeof window === "undefined") return "olive";
      try {
        const saved = window.localStorage.getItem("tripsloom-color-theme");
        return COLOR_THEMES.some((theme) => theme.id === saved)
          ? (saved as ColorTheme)
          : "olive";
      } catch {
        return "olive";
      }
    }),
    [reducedMotion, setReducedMotion] = useState(() => {
      if (typeof window === "undefined") return false;
      try {
        return (
          window.localStorage.getItem("tripsloom-reduced-motion") ||
          window.localStorage.getItem("elsewhere-reduced-motion")
        ) === "true";
      } catch {
        return false;
      }
    }),
    [online, setOnline] = useState(
      () => typeof navigator === "undefined" || navigator.onLine,
    ),
    [undo, setUndo] = useState<Workspace | null>(null);
  const main = useRef<HTMLElement>(null);
  const w = store.w,
    trip = w?.trips.find((t) => t.id === route.tripId) || w?.trips[0];
  function notify(message: string, error = false) {
    setToast({ message, error });
  }
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.error ? 10000 : 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("tripsloom-color-theme", colorTheme);
    } catch {
      // Local preference storage can be unavailable in private browsing.
    }
  }, [colorTheme]);
  useEffect(() => {
    document.documentElement.classList.toggle("ew-reduced-motion", reducedMotion);
    try {
      window.localStorage.setItem(
        "tripsloom-reduced-motion",
        String(reducedMotion),
      );
    } catch {
      // Local preference storage can be unavailable in private browsing.
    }
    return () => document.documentElement.classList.remove("ew-reduced-motion");
  }, [reducedMotion]);
  useEffect(() => {
    const restoreRoute = () => {
      if (store.latest.current) setRoute(readRoute(store.latest.current));
    };
    window.addEventListener("hashchange", restoreRoute);
    window.addEventListener("popstate", restoreRoute);
    return () => {
      window.removeEventListener("hashchange", restoreRoute);
      window.removeEventListener("popstate", restoreRoute);
    };
  }, [store.latest]);
  useEffect(() => {
    document.title = `${nav.find((n) => n.view === route.view)?.label || "Settings"} — Trips Loom`;
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route.view]);
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => Workspace;
        },
        options: { signal: AbortSignal },
      ) => unknown;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "read_trip_workspace",
            description:
              "Read this visitor’s trips, wardrobe, outfits and packing.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object.");
              if (!store.latest.current)
                throw new Error("Workspace is loading.");
              return structuredClone(store.latest.current);
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional host capability; never required for the planner. */
    }
    return () => controller.abort();
  }, [store.latest]);
  function go(next: Route, replace = false) {
    const current = store.latest.current;
    const t =
      current?.trips.find((t) => t.id === next.tripId) || current?.trips[0];
    if (
      t &&
      (t.id !== next.tripId ||
        !validDate(next.day) ||
        next.day < t.start ||
        next.day > t.end)
    )
      next = {
        ...next,
        tripId: t.id,
        day: t.start,
        month: t.start.slice(0, 7),
      };
    if (!t) next = { ...next, tripId: "" };
    if (replace) window.history.replaceState(null, "", href(next));
    else if (window.location.hash !== href(next))
      window.history.pushState(null, "", href(next));
    setRoute(next);
  }
  function navigate(view: View, selected?: Trip) {
    go({
      ...route,
      view,
      ...(selected
        ? {
            tripId: selected.id,
            day: selected.start,
            month: selected.start.slice(0, 7),
          }
        : {}),
    });
  }
  function selectDay(day: string) {
    if (!trip || day < trip.start || day > trip.end) return;
    go({ ...route, day, month: day.slice(0, 7) });
  }
  function open(modal: EditorModal) {
    setEditor({ ...modal, tripId: trip?.id, date: modal.date || route.day });
  }
  function mutate(fn: (w: Workspace) => void) {
    try {
      store.change(fn);
      setUndo(null);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not apply this change.",
        true,
      );
    }
  }
  function submitDuplicate(e: React.FormEvent) {
    e.preventDefault();
    if (!duplicateDraft) return;
    const name = duplicateDraft.name.trim();
    if (!name) {
      setDuplicateError("Enter a name for the copied trip.");
      return;
    }
    try {
      const copy = duplicateTrip(duplicateDraft.source);
      copy.name = name;
      store.change((d) => {
        d.trips.push(copy);
      });
      setDuplicateDraft(null);
      setDuplicateError("");
      setUndo(null);
      navigate("planner", copy);
      notify("Trip duplicated. Packing and completion checks have been reset.");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not duplicate trip.",
        true,
      );
    }
  }
  function saveEditor(result: EditorResult) {
    if (!editor) return;
    const kind = result.kind,
      value = result.value,
      targetTripId = editor.tripId,
      selectedDate = editor.date || route.day;
    store.change((d) => {
      const t = d.trips.find((t) => t.id === targetTripId);
      if (kind === "trip") {
        const input = value as Trip,
          current = d.trips.find((t) => t.id === input.id);
        const next = current
          ? resizeTrip(current, input.start, input.end, result.shiftPlans)
          : { ...input, activities: [], days: {}, extras: [], packed: [] };
        Object.assign(next, {
          name: input.name,
          destination: input.destination,
          start: input.start,
          end: input.end,
          travellers: input.travellers,
          budget: input.budget,
          currency: input.currency,
          weightLimit: input.weightLimit,
          theme: input.theme,
          notes: input.notes,
        });
        if (current)
          d.trips[d.trips.findIndex((t) => t.id === current.id)] = next;
        else d.trips.push(next);
      } else if (kind === "item") {
        const item = value as Item,
          i = d.items.findIndex((x) => x.id === item.id);
        if (i < 0) d.items.push(item);
        else d.items[i] = item;
      } else if (kind === "outfit") {
        const outfit = value as Outfit,
          i = d.outfits.findIndex((x) => x.id === outfit.id);
        if (i < 0) d.outfits.push(outfit);
        else d.outfits[i] = outfit;
      } else {
        if (!t)
          throw new Error(
            "This trip no longer exists. Close the editor and select a trip.",
          );
        if (kind === "activity") {
          const a = value as Activity,
            i = t.activities.findIndex((x) => x.id === a.id);
          if (i < 0) t.activities.push(a);
          else t.activities[i] = a;
        }
        if (kind === "day") t.days[selectedDate] = value as Day;
        if (kind === "extra") {
          const extra = value as Extra,
            i = t.extras.findIndex((x) => x.id === extra.id);
          if (i < 0) t.extras.push(extra);
          else t.extras[i] = extra;
        }
      }
    });
    setUndo(null);
    setEditor(null);
    notify("Changes added.");
    if (kind === "trip")
      navigate(
        "planner",
        store.latest.current!.trips.find((t) => t.id === (value as Trip).id),
      );
    if (kind === "activity")
      go({
        ...route,
        view: "planner",
        tripId: targetTripId!,
        day: (value as Activity).date,
        month: (value as Activity).date.slice(0, 7),
      });
  }
  function remove(
    kind: "trip" | "activity" | "item" | "outfit" | "extra",
    id: string,
  ) {
    setConfirm({
      title: `Delete this ${kind === "extra" ? "packing item" : kind}?`,
      description:
        kind === "item"
          ? "The piece will also be removed from outfits, daily essentials and packing. Other pieces and plans will stay."
          : kind === "outfit"
            ? "This removes the look from its assigned days and activities. Wardrobe pieces will stay."
            : kind === "trip"
              ? "The itinerary and its packing list will be removed. Your wardrobe and reusable outfits will stay."
              : "This removes the entry from the selected trip.",
      label: "Delete",
      dangerous: true,
      action: () => {
        const snapshot = structuredClone(store.latest.current!);
        store.change((d) => {
          if (kind === "item") removeItem(d, id);
          if (kind === "outfit") removeOutfit(d, id);
          if (kind === "trip") d.trips = d.trips.filter((t) => t.id !== id);
          const t = d.trips.find((t) => t.id === trip?.id);
          if (kind === "activity" && t)
            t.activities = t.activities.filter((a) => a.id !== id);
          if (kind === "extra" && t)
            t.extras = t.extras.filter((e) => e.id !== id);
        });
        setUndo(snapshot);
        notify("Removed. Undo is available until your next edit.");
        if (kind === "trip") navigate("trips");
      },
    });
  }
  async function backup() {
    if (!store.latest.current || busy) return;
    setBusy(true);
    try {
      const content = await exportBackup(
        structuredClone(store.latest.current),
        includePhotos,
      );
      download(`trips-loom-backup-${today()}.json`, content);
      notify(
        includePhotos
          ? "Backup downloaded, including your uploaded photos."
          : "Data-only backup downloaded. Photo references remain private to this visitor.",
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Backup failed.", true);
    } finally {
      setBusy(false);
    }
  }
  const retryReload = () =>
    setConfirm({
      title: "Reload the server version?",
      description: store.dirty
        ? "You have local edits that are not saved. Download a backup before reloading; this replaces those edits with the server copy."
        : "This retrieves the latest version of your workspace.",
      label: "Reload server version",
      dangerous: store.dirty,
      action: () => store.load(),
    });
  if (!w)
    return (
      <main className="ew ew-startup">
        <Brand />
        <span className="ew-startup-icon">
          <Icon name={store.loadError ? "warning" : "compass"} size={33} />
        </span>
        <h1>
          {store.loadError ? "A small detour." : "Making room for the journey."}
        </h1>
        <p>{store.loadError || "Getting your plans together…"}</p>
        {store.loadError && (
          <Button variant="primary" onClick={() => void store.load()}>
            Try again
          </Button>
        )}
      </main>
    );
  const rows = trip ? packing(w, trip) : [],
    activeNav = route.view === "outfits" ? "wardrobe" : route.view,
    firstName = profile?.display_name.trim().split(/\s+/)[0] || "there",
    pageTitle =
      route.view === "planner" && profile
        ? `Good to have you back, ${firstName}.`
        : VIEW_LABELS[route.view],
    pageDescription =
      route.view === "planner" && profile
        ? `${profile.travel_style} · planning from ${profile.home_base}`
        : "A LITTLE SPACE FOR THE JOURNEY";
  const props: ScreenProps = {
    w,
    trip,
    day: route.day,
    month: route.month,
    open,
    selectDay,
    setMonth: (month) => go({ ...route, month }),
    navigate,
    change: mutate,
    remove,
    duplicate: (t) => {
      setDuplicateError("");
      setDuplicateDraft({
        source: t,
        name: `${t.name.slice(0, 190)} (copy)`,
      });
    },
    exportTrip: () => setExportOpen(true),
  };
  const navLinks = (mobile = false) =>
    nav
      .filter((n) => !mobile || n.view !== "outfits")
      .map((n) => (
        <a
          key={n.view}
          href={href({ ...route, view: n.view })}
          aria-current={
            (mobile ? activeNav : route.view) === n.view ? "page" : undefined
          }
          onClick={(e) => {
            e.preventDefault();
            navigate(n.view);
          }}
        >
          <Icon name={n.icon} size={mobile ? 21 : 18} />
          <span>{mobile && n.view === "packing" ? "Packing" : n.label}</span>
          {!mobile && n.view === "packing" && rows.length > 0 && (
            <small>
              {rows.filter((i) => i.packed).length}/{rows.length}
            </small>
          )}
        </a>
      ));
  const tripSelect = (mobile = false) =>
    w.trips.length > 0 && (
      <div className={mobile ? "ew-mobile-trip" : "ew-trip-select"}>
        {!mobile && <span className="ew-eyebrow">CURRENT TRIP</span>}
        <Select
          label={mobile ? "Current trip on mobile" : "Current trip"}
          value={trip?.id || ""}
          search={w.trips.length > 5}
          onChange={(id) => {
            const t = w.trips.find((t) => t.id === id);
            if (t) navigate(route.view, t);
          }}
          options={w.trips.map((t) => ({
            value: t.id,
            label: t.name,
            icon: "compass" as const,
          }))}
        />
      </div>
    );
  return (
    <div className="ew" data-color-theme={colorTheme}>
      <a
        className="ew-skip"
        href="#ew-main"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="ew-shell">
        <aside className="ew-sidebar">
          <a
            className="ew-brand"
            href={href({ ...route, view: "trips" })}
            onClick={(e) => {
              e.preventDefault();
              navigate("trips");
            }}
            aria-label="Trips Loom, all trips"
          >
            <Brand />
            <span>THE TRIP, ALL TOGETHER.</span>
          </a>
          <nav aria-label="Main navigation">{navLinks()}</nav>
          {tripSelect()}
          <div className="ew-sidebar-spacer" />
          <div className="ew-sidebar-note">
            <Icon name="leaf" size={25} />
            <h2>
              A little planning.
              <br />A lot of possibility.
            </h2>
            <p>Make room for the things you’ll remember.</p>
            <Button variant="quiet" onClick={() => open({ kind: "trip" })}>
              Plan your next trip <Icon name="arrow" size={14} />
            </Button>
          </div>
          <button
            className="ew-settings-link"
            onClick={() => navigate("settings")}
            aria-current={route.view === "settings" ? "page" : undefined}
          >
            <Icon name="settings" />
            Settings
          </button>
        </aside>
        <header className="ew-mobile-header">
          <a
            href={href({ ...route, view: "trips" })}
            onClick={(e) => {
              e.preventDefault();
              navigate("trips");
            }}
            aria-label="Trips Loom, all trips"
          >
            <Brand />
          </a>
          {tripSelect(true)}
          <IconButton
            icon="settings"
            label="Settings"
            onClick={() => navigate("settings")}
          />
        </header>
        <main className="ew-main" id="ew-main" tabIndex={-1} ref={main}>
          {(store.error || !online) && (
            <div className="ew-save-banner" role="alert">
              <Icon name="warning" />
              <div>
                <strong>
                  {store.state === "conflict"
                    ? "Your edits need a little attention."
                    : !online
                      ? "You’re offline."
                      : "Not saved yet."}
                </strong>
                <p>
                  {store.error ||
                    "New edits remain in this tab. Keep it open until you reconnect, or export a backup."}
                </p>
              </div>
              <div className="ew-actions">
                <Button onClick={() => void backup()} disabled={busy}>
                  Back up edits
                </Button>
                {store.state === "conflict" ? (
                  <Button onClick={retryReload}>Reload</Button>
                ) : (
                  <Button onClick={() => void store.flush()}>Retry save</Button>
                )}
              </div>
            </div>
          )}
          <div className="ew-page-header">
            <div>
              <p className="ew-eyebrow">{pageDescription}</p>
              <h1>{pageTitle}</h1>
            </div>
            <div className="ew-header-actions">
              {["planner", "packing"].includes(route.view) && trip && (
                <Button icon="download" onClick={() => setExportOpen(true)}>
                  Export
                </Button>
              )}
              {route.view !== "settings" && (
                <Button
                  variant="primary"
                  icon="plus"
                  onClick={() =>
                    open({
                      kind:
                        route.view === "wardrobe"
                          ? "item"
                          : route.view === "outfits"
                            ? "outfit"
                            : route.view === "essentials" && trip
                              ? "extra"
                              : route.view === "packing" && trip
                                ? "extra"
                                : route.view === "planner" && trip
                                  ? "activity"
                                  : "trip",
                    })
                  }
                >
                  {route.view === "wardrobe"
                    ? "Add a piece"
                    : route.view === "outfits"
                      ? "Create outfit"
                      : route.view === "essentials" && trip
                        ? "Add an essential"
                        : route.view === "packing" && trip
                          ? "Add an essential"
                          : route.view === "planner" && trip
                            ? "Add a plan"
                            : "New trip"}
                </Button>
              )}
            </div>
          </div>
          <div className="ew-view" key={route.view}>
          {route.view === "planner" && <Planner props={props} />}
          {(route.view === "wardrobe" || route.view === "outfits") && (
            <Wardrobe
              key={route.view}
              props={props}
              outfitsOnly={route.view === "outfits"}
            />
          )}
          {route.view === "essentials" && <Essentials props={props} />}
          {route.view === "packing" && <Packing props={props} />}
          {route.view === "trips" && <Trips props={props} />}
          {route.view === "settings" && (
            <div className="ew-settings-grid">
              {profile && (
                <section className="ew-settings-card ew-account-card">
                  <div className="ew-settings-icon">
                    <Icon name="compass" size={27} />
                  </div>
                  <p className="ew-eyebrow">YOUR TRAVEL PROFILE</p>
                  <h2>{profile.display_name}, this is your space.</h2>
                  <p>
                    Signed in as <strong>{accountEmail || "your account"}</strong>.
                    Your trips and preferences follow you to any browser.
                  </p>
                  <div className="ew-account-preferences">
                    <span><b>Home base</b>{profile.home_base}</span>
                    <span><b>Travel rhythm</b>{profile.travel_style}</span>
                    <span><b>Packing</b>{profile.packing_style}</span>
                  </div>
                  <div className="ew-settings-buttons">
                    {onEditProfile && (
                      <Button icon="edit" onClick={onEditProfile}>
                        Edit travel profile
                      </Button>
                    )}
                    {onSignOut && (
                      <Button icon="logout" onClick={() => void onSignOut()}>
                        Sign out
                      </Button>
                    )}
                  </div>
                </section>
              )}
              <section className="ew-settings-card">
                <div className="ew-settings-icon">
                  <Icon name="settings" size={27} />
                </div>
                <p className="ew-eyebrow">APPEARANCE</p>
                <h2>Make it feel like yours.</h2>
                <p>
                  Choose a color story for your journeys. Your choice stays on
                  this browser.
                </p>
                <div
                  className="ew-theme-picker"
                  role="group"
                  aria-label="Color theme"
                >
                  {COLOR_THEMES.map((theme) => (
                    <button
                      type="button"
                      key={theme.id}
                      className="ew-theme-option"
                      data-theme-preview={theme.id}
                      aria-pressed={colorTheme === theme.id}
                      onClick={() => setColorTheme(theme.id)}
                    >
                      <span className="ew-theme-swatches" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>
                        <strong>{theme.label}</strong>
                        <small>{theme.description}</small>
                      </span>
                      {colorTheme === theme.id && <Icon name="check" size={17} />}
                    </button>
                  ))}
                </div>
                <div className="ew-motion-setting">
                  <div>
                    <strong>Reduce motion</strong>
                    <small>Use simpler transitions throughout the app.</small>
                  </div>
                  <label className="ew-check-line">
                    <input
                      type="checkbox"
                      checked={reducedMotion}
                      onChange={(e) => setReducedMotion(e.target.checked)}
                      aria-label="Reduce motion"
                    />
                  </label>
                </div>
              </section>
              <section className="ew-settings-card">
                <div className="ew-settings-icon">
                  <Icon name="compass" size={27} />
                </div>
                <p className="ew-eyebrow">OVERVIEW</p>
                <h2>Your workspace</h2>
                <div className="ew-settings-stats">
                  <span><b>{w.trips.length}</b> trips</span>
                  <span><b>{w.items.length}</b> wardrobe pieces</span>
                  <span><b>{w.outfits.length}</b> outfits</span>
                  <span>
                    <b>{w.trips.reduce((total, item) => total + item.activities.length, 0)}</b>{" "}
                    plans
                  </span>
                </div>
              </section>
            </div>
          )}
          </div>
          {trip && route.view === "planner" && (
            <section
              className={`ew-budget-bar ${trip.budget > 0 && trip.activities.reduce((n, a) => n + a.cost, 0) > trip.budget ? "ew-over-budget" : ""}`}
            >
              <Icon name="note" size={18} />
              <div>
                <strong>
                  {money(
                    trip.activities.reduce((n, a) => n + a.cost, 0),
                    trip.currency,
                  )}{" "}
                  in planned activities
                </strong>
                <span>
                  {trip.budget
                    ? `Trip budget: ${money(trip.budget, trip.currency)}`
                    : "No trip budget set. Add one in trip details."}{" "}
                  · Estimates, not transactions.
                </span>
              </div>
              <Button
                variant="quiet"
                onClick={() => open({ kind: "trip", id: trip.id })}
              >
                Edit budget
              </Button>
            </section>
          )}
          <footer className="ew-page-footer">
            <span>THE TRIP, ALL TOGETHER.</span>
          </footer>
        </main>
        <nav className="ew-mobile-nav" aria-label="Mobile navigation">
          {navLinks(true)}
        </nav>
      </div>
      <PrintPlan w={w} trip={trip} />
      {editor && (
        <Editor
          key={`${editor.kind}:${editor.id || "new"}:${editor.date}`}
          modal={editor}
          w={w}
          trip={w.trips.find((t) => t.id === editor.tripId)}
          day={editor.date || route.day}
          accessToken={accessToken}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}
      {duplicateDraft && (
        <Modal
          title="Name your copied trip"
          description="Choose a name before adding this itinerary to your trips."
          onDismiss={() => {
            setDuplicateDraft(null);
            setDuplicateError("");
          }}
        >
          <form onSubmit={submitDuplicate}>
            <div className="ew-editor-body">
              <div className="ew-field">
                <label htmlFor="duplicate-trip-name">Trip name</label>
                <input
                  id="duplicate-trip-name"
                  autoFocus
                  required
                  maxLength={200}
                  value={duplicateDraft.name}
                  onChange={(e) => {
                    setDuplicateError("");
                    setDuplicateDraft((current) =>
                      current ? { ...current, name: e.target.value } : current,
                    );
                  }}
                  placeholder="A little time in the mountains"
                />
                {duplicateError && (
                  <p className="ew-inline-error" role="alert">
                    {duplicateError}
                  </p>
                )}
              </div>
            </div>
            <footer className="ew-dialog-footer">
              <Button
                onClick={() => {
                  setDuplicateDraft(null);
                  setDuplicateError("");
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" icon="copy" type="submit">
                Duplicate trip
              </Button>
            </footer>
          </form>
        </Modal>
      )}
      {exportOpen && trip && (
        <Modal
          title="A plan you can take with you."
          onDismiss={() => {
            if (!busy) setExportOpen(false);
          }}
          description="Export the selected trip, or back up the whole workspace."
        >
          <div className="ew-export-options">
            <button
              onClick={() => {
                download(
                  `${filename(trip.name)}.ics`,
                  calendarICS(trip),
                  "text/calendar;charset=utf-8",
                );
                notify(
                  "Calendar file downloaded. Times are destination-local.",
                );
              }}
            >
              <Icon name="calendar" />
              <span>
                <strong>Add to a calendar</strong>
                <small>
                  Activities as an .ics file. Times are local wall times, not
                  timezone conversions.
                </small>
              </span>
              <Icon name="download" />
            </button>
            <button
              onClick={() => {
                download(
                  `${filename(trip.name)}-packing.csv`,
                  "\uFEFF" + packingCSV(w, trip),
                  "text/csv;charset=utf-8",
                );
                notify("Packing CSV downloaded.");
              }}
            >
              <Icon name="bag" />
              <span>
                <strong>Packing spreadsheet</strong>
                <small>
                  Quantities, weights, categories and packing status.
                </small>
              </span>
              <Icon name="download" />
            </button>
            <button
              onClick={() => {
                setExportOpen(false);
                requestAnimationFrame(() => window.print());
              }}
            >
              <Icon name="print" />
              <span>
                <strong>Print itinerary & packing</strong>
                <small>
                  Every day, its plans, outfits and essentials. Save as PDF from
                  your browser.
                </small>
              </span>
              <Icon name="arrow" />
            </button>
            <button disabled={busy} onClick={() => void backup()}>
              <Icon name="shield" />
              <span>
                <strong>
                  {busy ? "Preparing backup…" : "Full workspace backup"}
                </strong>
                <small>
                  All trips, wardrobe and outfits
                  {includePhotos
                    ? ", including uploaded photos"
                    : " (photo references only)"}
                  .
                </small>
              </span>
              <Icon name="download" />
            </button>
            <label className="ew-check-line">
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
              />
              Include photos in the workspace backup
            </label>
          </div>
          <footer className="ew-dialog-footer">
            <Button onClick={() => setExportOpen(false)} disabled={busy}>
              Done
            </Button>
          </footer>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          description={confirm.description}
          onDismiss={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <footer className="ew-dialog-footer">
            <Button disabled={busy} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              variant={confirm.dangerous ? "danger" : "primary"}
              onClick={async () => {
                setBusy(true);
                try {
                  await confirm.action();
                  setConfirm(null);
                } catch (e) {
                  notify(
                    e instanceof Error
                      ? e.message
                      : "The action could not be completed.",
                    true,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Working…" : confirm.label || "Continue"}
            </Button>
          </footer>
        </Modal>
      )}
      <div className="ew-feedback" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className={`ew-toast ${toast.error ? "ew-toast-error" : ""}`}>
            <Icon name={toast.error ? "warning" : "check"} size={18} />
            <span>{toast.message}</span>
            <IconButton
              icon="close"
              label="Dismiss notification"
              onClick={() => setToast(null)}
            />
          </div>
        )}
        {undo && (
          <button
            className="ew-undo"
            onClick={() => {
              try {
                const old = undo!;
                store.change((d) => Object.assign(d, old));
                setUndo(null);
                notify("Deletion undone.");
              } catch (e) {
                notify(
                  e instanceof Error ? e.message : "Could not undo.",
                  true,
                );
              }
            }}
          >
            <Icon name="undo" size={16} />
            Undo last deletion
          </button>
        )}
      </div>
    </div>
  );
}
function AppEntry() {
  const auth = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  if (auth.phase === "loading") return <AuthLoading />;
  if (auth.recovery) return <AuthScreen key="recover" />;
  if (!auth.user && !auth.guestMode)
    return <AuthScreen key={auth.recovery ? "recover" : "auth"} />;
  if (auth.guestMode)
    return <WorkspaceApp key="visitor" />;
  const user = auth.user;
  if (!user) return <AuthScreen key={auth.recovery ? "recover" : "auth"} />;
  if (auth.profileLoading) return <AuthLoading message="Getting your plans together." />;
  if (auth.profileError)
    return (
      <main className="ew ew-startup">
        <Brand />
        <span className="ew-startup-icon">
          <Icon name="warning" size={33} />
        </span>
        <h1>We couldn’t open your travel profile.</h1>
        <p>{auth.profileError}</p>
        <Button variant="primary" onClick={() => void auth.refreshProfile()}>
          Try again
        </Button>
      </main>
    );
  if (!auth.profile?.onboarding_completed)
    return <OnboardingFlow onComplete={() => setEditingProfile(false)} />;
  if (editingProfile)
    return (
      <OnboardingFlow
        onCancel={() => setEditingProfile(false)}
        onComplete={() => setEditingProfile(false)}
      />
    );
  return (
    <WorkspaceApp
      key={user.id}
      accessToken={auth.session?.access_token}
      profile={auth.profile}
      accountEmail={user.email}
      onSignOut={auth.signOut}
      onEditProfile={() => setEditingProfile(true)}
    />
  );
}

export default function TripsLoom() {
  return (
    <Boundary>
      <AuthProvider>
        <AppEntry />
      </AuthProvider>
    </Boundary>
  );
}
