import type { Metadata } from "next";
import { supabaseConfig } from "@/lib/server";

/** A shared trip plan ("do it again"): https://tripsloom.com/r/<code>. With the app installed it opens there to copy. */

type Day = { title: string; stay: string; stops: { time: string; title: string; place: string }[] };
type Template = { name: string; author: string; destination: string; days: number; people: number; perPerson: number; currency: string; plan: Day[]; forks: number };

async function load(code: string): Promise<Template | null> {
  const config = supabaseConfig();
  if (!config || !/^[A-Za-z0-9]{10,16}$/.test(code)) return null;
  const r = await fetch(`${config.url}/rest/v1/rpc/get_template`, {
    method: "POST", cache: "no-store",
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_code: code }),
  }).catch(() => null);
  if (!r?.ok) return null;
  const t = (await r.json().catch(() => null)) as Template | null;
  return t && typeof t.name === "string" ? t : null;
}

const money = (n: number, c: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const t = await load((await params).code);
  if (!t) return { title: "Trip plan · Tripsloom", robots: { index: false } };
  const description = `${t.days} days${t.destination ? ` in ${t.destination}` : ""}${t.perPerson ? ` · about ${money(t.perPerson, t.currency)} each` : ""}. Copy this plan onto your own dates in Tripsloom.`;
  return { title: `${t.name} · a plan by ${t.author}`, description, openGraph: { title: t.name, description, siteName: "Tripsloom" }, robots: { index: false } };
}

export default async function TemplatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await load(code);
  const wrap = { minHeight: "100vh", background: "#EEEDEB", color: "#1E1E1E", fontFamily: "system-ui, -apple-system, sans-serif", padding: "24px 16px 80px" } as const;
  if (!t) return <main style={wrap}><div style={{ maxWidth: 560, margin: "40px auto", background: "#fff", borderRadius: 20, padding: 28 }}><h1 style={{ margin: 0 }}>This plan isn’t available</h1><p style={{ color: "#6E6A64" }}>It may have been removed by the person who shared it.</p></div></main>;
  return <main style={wrap}>
    <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 16 }}>
      <p style={{ margin: "8px 4px 0", fontWeight: 600, color: "#FF6A2B" }}>Tripsloom · a plan to copy</p>
      <section style={{ background: "linear-gradient(135deg, #FF8A4C, #FF6A2B)", color: "#fff", borderRadius: 24, padding: 24 }}>
        <p style={{ margin: 0, opacity: 0.9 }}>{t.author}’s trip{t.forks ? ` · copied ${t.forks} ${t.forks === 1 ? "time" : "times"}` : ""}</p>
        <h1 style={{ fontSize: 32, margin: "6px 0", letterSpacing: -0.6 }}>{t.name}</h1>
        <p style={{ margin: 0, opacity: 0.92 }}>{t.days} days{t.destination ? ` · ${t.destination}` : ""}{t.perPerson ? ` · about ${money(t.perPerson, t.currency)} each` : ""}</p>
        <a href={`tripsloom://r/${code}`} style={{ display: "block", marginTop: 20, background: "#fff", color: "#1E1E1E", borderRadius: 14, padding: "14px 16px", textAlign: "center", fontWeight: 600, textDecoration: "none" }}>Copy it in Tripsloom</a>
      </section>
      <section style={{ background: "#fff", borderRadius: 20, padding: 20 }}>
        {t.plan.slice(0, t.days).map((d, i) => <div key={i} style={{ borderTop: i ? "1px solid #E6E3DE" : "none", paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Day {i + 1}{d.title ? ` · ${d.title}` : ""}</p>
          {d.stops.length ? d.stops.map((s, j) => <p key={j} style={{ margin: "4px 0", color: "#6E6A64" }}><span style={{ color: "#1E1E1E" }}>{s.time || "Any time"}</span> · {s.title}{s.place ? ` · ${s.place}` : ""}</p>) : <p style={{ color: "#6E6A64", margin: 0 }}>A free day</p>}
          {d.stay ? <p style={{ margin: "6px 0 0", color: "#6E6A64" }}>Staying: {d.stay}</p> : null}
        </div>)}
      </section>
    </div>
  </main>;
}
