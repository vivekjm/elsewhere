import { z } from "zod";
const id = z.string().min(1).max(100),
  short = z.string().max(200),
  note = z.string().max(5000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Invalid date",
  );
const image = z
  .string()
  .refine((s) => s === "" || /^\/api\/images\/[a-f0-9-]{36}$/.test(s));
export const itemSchema = z.object({
  id,
  name: short.min(1),
  category: z.enum([
    "Tops",
    "Bottoms",
    "Layers",
    "Shoes",
    "Accessories",
    "Gear",
  ]),
  weight: z.number().min(0).max(50000),
  image,
});
export const outfitSchema = z.object({
  id,
  name: short.min(1),
  items: z.array(id).max(100),
});
export const activitySchema = z.object({
  id,
  date,
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .refine((t) => Number(t.slice(0, 2)) < 24 && Number(t.slice(3)) < 60),
  title: short.min(1),
  place: short,
  category: z.enum(["Explore", "Food & drink", "Travel", "Stay", "Other"]),
  cost: z.number().min(0).max(10000000),
  link: z
    .string()
    .max(2000)
    .refine((s) => !s || /^https?:\/\//i.test(s)),
  notes: note,
  outfitId: short,
  gear: z.array(id).max(100),
});
export const extraSchema = z.object({
  id,
  name: short.min(1),
  quantity: z.number().int().min(1).max(999),
  weight: z.number().min(0).max(50000),
  packed: z.boolean(),
});
export const tripSchema = z
  .object({
    id,
    name: short.min(1),
    destination: short.min(1),
    start: date,
    end: date,
    travellers: z.number().int().min(1).max(100),
    budget: z.number().min(0).max(10000000),
    currency: z.enum(["EUR", "USD", "INR", "GBP"]),
    weightLimit: z.number().min(0).max(1000),
    activities: z.array(activitySchema).max(2000),
    days: z.record(z.object({ outfitId: short, stay: short, notes: note })),
    extras: z.array(extraSchema).max(500),
    packed: z.array(id).max(2000),
  })
  .refine(
    (t) => t.end >= t.start && daysBetween(t.start, t.end) <= 365,
    "Choose a trip of 1 to 366 days",
  )
  .refine(
    (t) =>
      t.activities.every((a) => a.date >= t.start && a.date <= t.end) &&
      Object.keys(t.days).every(
        (d) => date.safeParse(d).success && d >= t.start && d <= t.end,
      ),
    "All plans must be within trip dates",
  );
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    trips: z.array(tripSchema).max(100),
    items: z.array(itemSchema).max(2000),
    outfits: z.array(outfitSchema).max(500),
  })
  .superRefine((w, c) => {
    for (const list of [
      w.trips,
      w.items,
      w.outfits,
      ...w.trips.map((t) => t.activities),
      ...w.trips.map((t) => t.extras),
    ])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        c.addIssue({ code: "custom", message: "Duplicate IDs" });
    const items = new Set(w.items.map((x) => x.id)),
      outfits = new Set(w.outfits.map((x) => x.id));
    if (
      w.outfits.some((o) => o.items.some((i) => !items.has(i))) ||
      w.trips.some(
        (t) =>
          Object.values(t.days).some(
            (d) => d.outfitId && !outfits.has(d.outfitId),
          ) ||
          t.activities.some(
            (a) =>
              (a.outfitId && !outfits.has(a.outfitId)) ||
              a.gear.some((i) => !items.has(i)),
          ),
      )
    )
      c.addIssue({
        code: "custom",
        message: "Missing wardrobe item or outfit",
      });
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export type Trip = Workspace["trips"][number];
export type Item = Workspace["items"][number];
export type Outfit = Workspace["outfits"][number];
export type Activity = Trip["activities"][number];
export const uid = () => crypto.randomUUID();
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
export function tripDates(t: Pick<Trip, "start" | "end">) {
  return Array.from({ length: daysBetween(t.start, t.end) + 1 }, (_, i) =>
    new Date(Date.parse(t.start) + i * 86400000).toISOString().slice(0, 10),
  );
}
export function packing(w: Workspace, t: Trip) {
  const needed = new Set<string>();
  const add = (o: string) =>
    w.outfits.find((x) => x.id === o)?.items.forEach((i) => needed.add(i));
  Object.values(t.days).forEach((d) => add(d.outfitId));
  t.activities.forEach((a) => {
    add(a.outfitId);
    a.gear.forEach((i) => needed.add(i));
  });
  return [
    ...w.items
      .filter((i) => needed.has(i.id))
      .map((i) => ({
        ...i,
        quantity: 1,
        packed: t.packed.includes(i.id),
        automatic: true,
      })),
    ...t.extras.map((i) => ({
      ...i,
      category: "Essentials",
      image: "",
      automatic: false,
    })),
  ];
}
export function removeItem(w: Workspace, id: string) {
  w.items = w.items.filter((i) => i.id !== id);
  w.outfits.forEach((o) => (o.items = o.items.filter((i) => i !== id)));
  w.trips.forEach((t) => {
    t.packed = t.packed.filter((i) => i !== id);
    t.activities.forEach((a) => (a.gear = a.gear.filter((i) => i !== id)));
  });
  return w;
}
export function removeOutfit(w: Workspace, id: string) {
  w.outfits = w.outfits.filter((o) => o.id !== id);
  w.trips.forEach((t) => {
    Object.values(t.days).forEach((d) => {
      if (d.outfitId === id) d.outfitId = "";
    });
    t.activities.forEach((a) => {
      if (a.outfitId === id) a.outfitId = "";
    });
  });
  return w;
}
export function seed(): Workspace {
  return {
    version: 1,
    items: [
      {
        id: "linen",
        name: "Linen shirt",
        category: "Tops",
        weight: 180,
        image: "",
      },
      {
        id: "trousers",
        name: "Everyday trousers",
        category: "Bottoms",
        weight: 380,
        image: "",
      },
      {
        id: "trainers",
        name: "Walking trainers",
        category: "Shoes",
        weight: 620,
        image: "",
      },
      {
        id: "jacket",
        name: "Light jacket",
        category: "Layers",
        weight: 320,
        image: "",
      },
      {
        id: "camera",
        name: "Camera",
        category: "Gear",
        weight: 450,
        image: "",
      },
      {
        id: "dress",
        name: "Evening dress",
        category: "Tops",
        weight: 260,
        image: "",
      },
    ],
    outfits: [
      {
        id: "city",
        name: "The city wanderer",
        items: ["linen", "trousers", "trainers"],
      },
      {
        id: "coast",
        name: "A breezy afternoon",
        items: ["linen", "trousers", "jacket", "trainers"],
      },
      { id: "evening", name: "Dinner at sunset", items: ["dress", "jacket"] },
    ],
    trips: [
      {
        id: "lisbon",
        name: "A week in Lisbon",
        destination: "Lisbon, Portugal",
        start: "2026-09-21",
        end: "2026-09-27",
        travellers: 2,
        budget: 1500,
        currency: "EUR",
        weightLimit: 8,
        days: {
          "2026-09-21": {
            outfitId: "city",
            stay: "Casa do Pátio · Alfama",
            notes: "Take it slow on our first day.",
          },
          "2026-09-23": { outfitId: "coast", stay: "", notes: "" },
        },
        activities: [
          {
            id: "alfama",
            date: "2026-09-21",
            time: "10:00",
            title: "Wander through Alfama",
            place: "Alfama, Lisbon",
            category: "Explore",
            cost: 0,
            link: "",
            notes: "Narrow streets, tiled façades, a coffee or two.",
            outfitId: "city",
            gear: ["camera"],
          },
          {
            id: "dinner",
            date: "2026-09-21",
            time: "18:30",
            title: "Dinner by the river",
            place: "Cais do Sodré",
            category: "Food & drink",
            cost: 45,
            link: "",
            notes: "Find a table around golden hour.",
            outfitId: "evening",
            gear: [],
          },
          {
            id: "sintra",
            date: "2026-09-23",
            time: "09:00",
            title: "Day trip to Sintra",
            place: "Sintra",
            category: "Explore",
            cost: 35,
            link: "",
            notes: "Comfortable shoes for the hills.",
            outfitId: "coast",
            gear: ["camera"],
          },
        ],
        extras: [
          {
            id: "passport",
            name: "Passport & travel documents",
            quantity: 1,
            weight: 80,
            packed: false,
          },
          {
            id: "charger",
            name: "Phone charger",
            quantity: 1,
            weight: 120,
            packed: false,
          },
          {
            id: "toiletries",
            name: "Toiletries",
            quantity: 1,
            weight: 350,
            packed: false,
          },
        ],
        packed: [],
      },
    ],
  };
}
