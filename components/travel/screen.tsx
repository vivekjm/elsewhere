import type { Trip, Workspace } from "@/lib/model";
import type { Modal as EditorModal } from "./editor";
export type View =
  | "planner"
  | "wardrobe"
  | "outfits"
  | "essentials"
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
  essentials: "The little things that matter.",
  packing: "A little lighter. A lot readier.",
  trips: "Somewhere worth going.",
  settings: "Your plans, in good hands.",
};
export const NAV: { view: View; label: string; icon: "calendar" | "hanger" | "layers" | "bag" | "shield" | "compass" }[] = [
  { view: "planner", label: "Calendar", icon: "calendar" },
  { view: "wardrobe", label: "Wardrobe", icon: "hanger" },
  { view: "outfits", label: "Outfits", icon: "layers" },
  { view: "essentials", label: "Essentials", icon: "shield" },
  { view: "packing", label: "Packing list", icon: "bag" },
  { view: "trips", label: "All trips", icon: "compass" },
];
