import type { Workspace } from "../lib/model.ts";

/** Rich test-only data for model, export and migration coverage. */
export function testWorkspace(): Workspace {
  return {
    version: 1,
    items: [
      { id: "linen", name: "Linen shirt", category: "Tops", weight: 180, image: "", shape: "shirt", color: "#c2ae88" },
      { id: "trousers", name: "Everyday trousers", category: "Bottoms", weight: 380, image: "", shape: "pants", color: "#3d443c" },
      { id: "trainers", name: "Walking trainers", category: "Shoes", weight: 620, image: "", shape: "sneakers", color: "#dedbd0" },
      { id: "jacket", name: "Light jacket", category: "Layers", weight: 320, image: "", shape: "coat", color: "#85907c" },
      { id: "camera", name: "Camera", category: "Gear", weight: 450, image: "", shape: "camera", color: "#40433e" },
      { id: "dress", name: "Evening dress", category: "Tops", weight: 260, image: "", shape: "dress", color: "#c3ad99" },
    ],
    outfits: [
      { id: "city", name: "City walk", items: ["linen", "trousers", "trainers"], occasion: "Everyday" },
      { id: "coast", name: "Afternoon out", items: ["linen", "trousers", "jacket", "trainers"], occasion: "Exploring" },
      { id: "evening", name: "Evening meal", items: ["dress", "jacket"], occasion: "Evening" },
    ],
    trips: [
      {
        id: "test-journey",
        name: "Test journey",
        destination: "Test City",
        start: "2026-09-21",
        end: "2026-09-27",
        travellers: 2,
        budget: 1500,
        currency: "EUR",
        weightLimit: 8,
        theme: "coast",
        days: {
          "2026-09-21": { outfitId: "city", title: "A first day", stay: "Test House", notes: "Take it slowly." },
          "2026-09-23": { outfitId: "coast", stay: "", notes: "" },
        },
        activities: [
          { id: "walk", date: "2026-09-21", time: "10:00", title: "Morning walk", place: "Old Town", category: "Explore", cost: 0, link: "", notes: "A useful test activity.", outfitId: "city", gear: ["camera"] },
          { id: "dinner", date: "2026-09-21", time: "18:30", title: "Dinner", place: "Riverside", category: "Food & drink", cost: 45, link: "", notes: "A useful evening test.", outfitId: "evening", gear: [] },
          { id: "day-trip", date: "2026-09-23", time: "09:00", title: "Day trip", place: "The Hills", category: "Explore", cost: 35, link: "", notes: "Comfortable shoes.", outfitId: "coast", gear: ["camera"] },
        ],
        extras: [
          { id: "passport", name: "Travel documents", quantity: 1, weight: 80, packed: false },
          { id: "charger", name: "Phone charger", quantity: 1, weight: 120, packed: false },
          { id: "toiletries", name: "Toiletries", quantity: 1, weight: 350, packed: false },
        ],
        packed: [],
      },
    ],
  };
}
