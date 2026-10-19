import type { Metadata } from "next";
import { supabaseConfig } from "@/lib/server";

/**
 * The web Trip Room: what a shared trip link (https://tripsloom.com/t/<code>) shows in a browser, for friends who
 * don't have the app yet and for chat link previews. With the app installed, the same link opens the trip in it.
 */

type Plan = { date: string; time: string; title: string; place: string; category: string };
type Room = {
  name: string; destination: string; start: string; end: string; theme: string | null; currency: string; budget: number; travellers: number;
  plans: Plan[]; days: Record<string, { title: string | null; stay: string | null }>;
  members: { name: string; rsvp: "in" | "maybe" | "out" | null; organiser: boolean }[]; guests: string[];
  /** Opened with the family (view-only) link: no joining. */
  family?: boolean;
};

const CODE = /^[A-Za-z0-9]{10,16}$/;

async function load(code: string): Promise<Room | null> {
  const config = supabaseConfig();
  if (!config || !CODE.test(code)) return null;
  const response = await fetch(`${config.url}/rest/v1/rpc/view_shared_trip`, {
    method: "POST",
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_code: code }),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const room = (await response.json().catch(() => null)) as Room | null;
  return room && typeof room.name === "string" ? room : null;
}

const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const range = (a: string, b: string) => (a === b ? day(a, { weekday: "short", day: "numeric", month: "short" }) : `${day(a, { day: "numeric", month: "short" })} – ${day(b, { day: "numeric", month: "short", year: "numeric" })}`);
const money = (n: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

function going(room: Room) {
  const counted = room.members.filter((m) => m.rsvp !== "out").length + room.guests.length;
  return Math.max(1, counted || room.travellers);
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const room = await load(code);
  if (!room) return { title: "Trip invite · Tripsloom", robots: { index: false } };
  const each = room.budget > 0 ? ` · about ${money(room.budget / going(room), room.currency)} each` : "";
  const description = `${range(room.start, room.end)}${room.destination ? ` · ${room.destination}` : ""}${each}. Say if you're in, see the plan and split costs together.`;
  return {
    title: `${room.name} · Tripsloom`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: `Join “${room.name}”`, description, siteName: "Tripsloom", type: "website" },
    twitter: { card: "summary", title: `Join “${room.name}”`, description },
  };
}

const C = { ink: "#1E1E1E", stone: "#6E6A64", canvas: "#EEEDEB", card: "#FFFFFF", ember: "#FF6A2B", mint: "#E3F4EA", mintFg: "#2E7D5B", rule: "#E6E3DE" };
const RSVP: Record<string, string> = { in: "In", maybe: "Maybe", out: "Can’t make it" };

export default async function TripRoom({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await load(code);
  const open = `tripsloom://t/${code}`;
  if (!room) {
    return <main style={{ minHeight: "100vh", background: C.canvas, color: C.ink, fontFamily: "system-ui, -apple-system, sans-serif", padding: "64px 20px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: C.card, borderRadius: 20, padding: 28 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>This invite doesn’t work</h1>
        <p style={{ color: C.stone, lineHeight: 1.6 }}>It may have been turned off by the organiser. Ask them for a new link.</p>
      </div>
    </main>;
  }
  const days = new Map<string, Plan[]>();
  for (const p of room.plans) days.set(p.date, [...(days.get(p.date) ?? []), p]);
  const people = going(room);
  return <main style={{ minHeight: "100vh", background: C.canvas, color: C.ink, fontFamily: "system-ui, -apple-system, sans-serif", padding: "24px 16px 120px" }}>
    <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 16 }}>
      <p style={{ margin: "8px 4px 0", fontWeight: 600, color: C.ember }}>{room.family ? "Tripsloom · their trip plan" : "Tripsloom · you’re invited"}</p>
      <section style={{ background: `linear-gradient(135deg, #FF8A4C, ${C.ember})`, color: "#fff", borderRadius: 24, padding: 24 }}>
        <h1 style={{ fontSize: 32, lineHeight: 1.1, margin: "0 0 8px", letterSpacing: -0.6 }}>{room.name}</h1>
        <p style={{ margin: 0, opacity: 0.92 }}>{range(room.start, room.end)}{room.destination ? ` · ${room.destination}` : ""}</p>
        {room.budget > 0 && !room.family ? <p style={{ margin: "16px 0 0", fontSize: 20, fontWeight: 600 }}>About {money((room.budget / people) * 0.9, room.currency)}–{money((room.budget / people) * 1.1, room.currency)} each</p> : null}
        {room.family ? <p style={{ margin: "16px 0 0", opacity: 0.92 }}>Shared with you to follow along. This page always shows the latest plan.</p>
          : <a href={open} style={{ display: "block", marginTop: 20, background: "#fff", color: C.ink, borderRadius: 14, padding: "14px 16px", textAlign: "center", fontWeight: 600, textDecoration: "none" }}>Open in Tripsloom</a>}
      </section>
      <section style={{ background: C.card, borderRadius: 20, padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Who’s coming</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {room.members.map((m, i) => <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>{m.name}{m.organiser ? <span style={{ color: C.stone }}> · organiser</span> : null}</span>
            <span style={{ color: m.rsvp === "in" ? C.mintFg : C.stone, fontWeight: 600 }}>{m.rsvp ? RSVP[m.rsvp] : "Not yet"}</span>
          </li>)}
          {room.guests.map((g, i) => <li key={`g${i}`} style={{ display: "flex", justifyContent: "space-between", color: C.stone }}><span>{g}</span><span>Not joined</span></li>)}
        </ul>
        {room.family ? null : <p style={{ color: C.stone, margin: "14px 0 0", lineHeight: 1.5 }}>Open the trip in the app to say if you’re in, vote on plans and split costs.</p>}
      </section>
      <section style={{ background: C.card, borderRadius: 20, padding: 20 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>The plan</h2>
        {days.size === 0 ? <p style={{ color: C.stone }}>Nothing planned yet.</p> : [...days.entries()].map(([date, plans]) => <div key={date} style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 12, marginTop: 12 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>{day(date, { weekday: "long", day: "numeric", month: "short" })}{room.days[date]?.title ? ` · ${room.days[date].title}` : ""}</p>
          {plans.map((p, i) => <p key={i} style={{ margin: "4px 0", color: C.stone }}><span style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>{p.time || "Any time"}</span> · {p.title}{p.place && p.place.toLowerCase() !== p.title.toLowerCase() ? ` · ${p.place}` : ""}</p>)}
          {room.days[date]?.stay ? <p style={{ margin: "6px 0 0", color: C.stone }}>Staying: {room.days[date].stay}</p> : null}
        </div>)}
      </section>
      {room.family ? null : <p style={{ textAlign: "center", color: C.stone, fontSize: 14 }}>Don’t have Tripsloom? Get it on the App Store or Google Play, then open this link again.</p>}
    </div>
  </main>;
}
