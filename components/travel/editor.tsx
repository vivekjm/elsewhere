"use client";
import type { FormEvent } from "react";
import { Upload, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Choice, Piece } from "./primitives";
import type { Workspace, Trip } from "@/lib/model";
export type Modal = {
  kind: "trip" | "activity" | "item" | "outfit" | "day" | "extra";
  id?: string;
};
// The editor holds a draft spanning the six validated domain record types.
export type FormDraft = {
  id?: string;
  name?: string;
  title?: string;
  destination?: string;
  start?: string;
  end?: string;
  date?: string;
  time?: string;
  travellers?: number;
  budget?: number;
  currency?: string;
  weightLimit?: number;
  category?: string;
  weight?: number;
  image?: string;
  items?: string[];
  place?: string;
  cost?: number;
  link?: string;
  notes?: string;
  outfitId?: string;
  gear?: string[];
  stay?: string;
  quantity?: number;
  packed?: boolean;
};
type Props = {
  modal: Modal | null;
  setModal: (m: Modal | null) => void;
  title: string;
  form: FormDraft;
  f: (key: keyof FormDraft, v: string | number | boolean | string[]) => void;
  w: Workspace;
  trip?: Trip;
  day: string;
  dateLabel: (d: string, options?: Intl.DateTimeFormatOptions) => string;
  outfitOptions: { value: string; label: string }[];
  savingForm: boolean;
  submit: (e: FormEvent) => Promise<void>;
  upload: (f?: File) => Promise<void>;
};
export function Editor({
  modal,
  setModal,
  title,
  form,
  f,
  w,
  trip,
  day,
  dateLabel,
  outfitOptions,
  savingForm,
  submit,
  upload,
}: Props) {
  return (
    <Dialog
      open={!!modal}
      onOpenChange={(o) => {
        if (!o && !savingForm) setModal(null);
      }}
    >
      <DialogContent className="editor">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {modal?.kind === "activity"
            ? "Make a plan. Leave room for the unexpected."
            : modal?.kind === "outfit"
              ? "Pick pieces from your wardrobe. Assigned outfits connect to packing."
              : modal?.kind === "item"
                ? "Add the things you love to travel with."
                : "Keep the details in one place."}
        </DialogDescription>
        <form onSubmit={(e) => void submit(e)}>
          {modal?.kind === "trip" && (
            <>
              <label>
                Trip name
                <input
                  required
                  maxLength={200}
                  value={form.name || ""}
                  onChange={(e) => f("name", e.target.value)}
                  placeholder="A long weekend in…"
                />
              </label>
              <label>
                Destination
                <input
                  required
                  maxLength={200}
                  value={form.destination || ""}
                  onChange={(e) => f("destination", e.target.value)}
                  placeholder="City, country"
                />
              </label>
              <div className="form-grid">
                <label>
                  Departure
                  <input
                    type="date"
                    onInput={(e) =>
                      f(
                        (e.currentTarget.getAttribute("data-field") ||
                          "date") as keyof FormDraft,
                        e.currentTarget.value,
                      )
                    }
                    required
                    data-field="start"
                    value={form.start || ""}
                    onChange={(e) => f("start", e.target.value)}
                  />
                </label>
                <label>
                  Return
                  <input
                    type="date"
                    onInput={(e) =>
                      f(
                        (e.currentTarget.getAttribute("data-field") ||
                          "date") as keyof FormDraft,
                        e.currentTarget.value,
                      )
                    }
                    required
                    min={form.start}
                    data-field="end"
                    value={form.end || ""}
                    onChange={(e) => f("end", e.target.value)}
                  />
                </label>
                <label>
                  Travellers
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={form.travellers ?? 1}
                    onChange={(e) => f("travellers", Number(e.target.value))}
                  />
                </label>
                <label>
                  Budget
                  <input
                    type="number"
                    min="0"
                    max="10000000"
                    required
                    value={form.budget ?? 0}
                    onChange={(e) => f("budget", Number(e.target.value))}
                  />
                </label>
                <label>
                  Currency
                  <Choice
                    value={form.currency || "EUR"}
                    onChange={(v) => f("currency", v)}
                    label="Currency"
                    options={["EUR", "USD", "INR", "GBP"].map((v) => ({
                      value: v,
                      label: v,
                    }))}
                  />
                </label>
                <label>
                  Luggage target (kg)
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="0.1"
                    required
                    value={form.weightLimit ?? 8}
                    onChange={(e) => f("weightLimit", Number(e.target.value))}
                  />
                </label>
              </div>
            </>
          )}
          {modal?.kind === "activity" && (
            <>
              <label>
                Activity
                <input
                  required
                  maxLength={200}
                  value={form.title || ""}
                  onChange={(e) => f("title", e.target.value)}
                  placeholder="What’s the plan?"
                />
              </label>
              <div className="form-grid">
                <label>
                  Date
                  <input
                    type="date"
                    onInput={(e) =>
                      f(
                        (e.currentTarget.getAttribute("data-field") ||
                          "date") as keyof FormDraft,
                        e.currentTarget.value,
                      )
                    }
                    required
                    min={trip?.start}
                    max={trip?.end}
                    value={form.date || ""}
                    onChange={(e) => f("date", e.target.value)}
                  />
                </label>
                <label>
                  Time
                  <input
                    type="time"
                    onInput={(e) => f("time", e.currentTarget.value)}
                    required
                    value={form.time || "10:00"}
                    onChange={(e) => f("time", e.target.value)}
                  />
                </label>
                <label>
                  Category
                  <Choice
                    value={form.category || "Explore"}
                    onChange={(v) => f("category", v)}
                    label="Activity category"
                    options={[
                      "Explore",
                      "Food & drink",
                      "Travel",
                      "Stay",
                      "Other",
                    ].map((v) => ({ value: v, label: v }))}
                  />
                </label>
                <label>
                  Cost ({trip?.currency})
                  <input
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    required
                    value={form.cost ?? 0}
                    onChange={(e) => f("cost", Number(e.target.value))}
                  />
                </label>
              </div>
              <label>
                Place
                <input
                  maxLength={200}
                  value={form.place || ""}
                  onChange={(e) => f("place", e.target.value)}
                  placeholder="Address or meeting point"
                />
              </label>
              <label>
                Reference link
                <input
                  type="url"
                  value={form.link || ""}
                  onChange={(e) => f("link", e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label>
                Notes
                <textarea
                  maxLength={5000}
                  value={form.notes || ""}
                  onChange={(e) => f("notes", e.target.value)}
                />
              </label>
              <label>
                Outfit
                <Choice
                  value={form.outfitId || ""}
                  label="Activity outfit"
                  onChange={(v) => f("outfitId", v)}
                  options={outfitOptions}
                />
              </label>
              <fieldset>
                <legend>Extra gear for this activity</legend>
                <div className="selection-list">
                  {w.items
                    .filter(
                      (i) =>
                        i.category === "Gear" || i.category === "Accessories",
                    )
                    .map((i) => (
                      <label key={i.id}>
                        <Checkbox
                          checked={form.gear?.includes(i.id) || false}
                          onCheckedChange={(v) =>
                            f(
                              "gear",
                              v
                                ? [...(form.gear || []), i.id]
                                : (form.gear || []).filter(
                                    (x: string) => x !== i.id,
                                  ),
                            )
                          }
                        />
                        {i.name}
                      </label>
                    ))}
                  {!w.items.some(
                    (i) =>
                      i.category === "Gear" || i.category === "Accessories",
                  ) && (
                    <p className="muted">Add gear in your wardrobe first.</p>
                  )}
                </div>
              </fieldset>
            </>
          )}
          {modal?.kind === "item" && (
            <>
              <label>
                Item name
                <input
                  required
                  maxLength={200}
                  value={form.name || ""}
                  onChange={(e) => f("name", e.target.value)}
                  placeholder="Your favourite linen shirt"
                />
              </label>
              <div className="form-grid">
                <label>
                  Category
                  <Choice
                    value={form.category || "Tops"}
                    label="Item category"
                    onChange={(v) => f("category", v)}
                    options={[
                      "Tops",
                      "Bottoms",
                      "Layers",
                      "Shoes",
                      "Accessories",
                      "Gear",
                    ].map((v) => ({ value: v, label: v }))}
                  />
                </label>
                <label>
                  Weight (g)
                  <input
                    type="number"
                    min="0"
                    max="50000"
                    required
                    value={form.weight ?? 0}
                    onChange={(e) => f("weight", Number(e.target.value))}
                  />
                </label>
              </div>
              <label className="photo-upload">
                <Upload size={20} />
                {savingForm ? "Uploading photo…" : "Add a photo"}
                <small>JPEG, PNG or WebP · up to 5 MB</small>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={savingForm}
                  onChange={(e) => void upload(e.target.files?.[0])}
                />
              </label>
              {form.image && (
                <div className="photo-preview">
                  <img src={form.image} alt="Item preview" />
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => f("image", "")}
                  >
                    Remove photo
                  </button>
                </div>
              )}
            </>
          )}
          {modal?.kind === "outfit" && (
            <>
              <label>
                Outfit name
                <input
                  required
                  maxLength={200}
                  value={form.name || ""}
                  onChange={(e) => f("name", e.target.value)}
                  placeholder="The city wanderer"
                />
              </label>
              <fieldset>
                <legend>Choose your pieces</legend>
                <div className="outfit-picker">
                  {w.items.map((i) => (
                    <label
                      key={i.id}
                      className={form.items?.includes(i.id) ? "picked" : ""}
                    >
                      <Piece item={i} />
                      <span>{i.name}</span>
                      <Checkbox
                        aria-label={`Include ${i.name}`}
                        checked={form.items?.includes(i.id) || false}
                        onCheckedChange={(v) =>
                          f(
                            "items",
                            v
                              ? [...(form.items || []), i.id]
                              : (form.items || []).filter(
                                  (x: string) => x !== i.id,
                                ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                {!w.items.length && (
                  <p className="muted">
                    Add wardrobe items before creating an outfit.
                  </p>
                )}
              </fieldset>
            </>
          )}
          {modal?.kind === "day" && (
            <>
              <p className="muted">
                {dateLabel(day, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <label>
                Outfit for this day
                <Choice
                  value={form.outfitId || ""}
                  label="Day outfit"
                  onChange={(v) => f("outfitId", v)}
                  options={outfitOptions}
                />
              </label>
              <label>
                Accommodation
                <input
                  maxLength={200}
                  value={form.stay || ""}
                  onChange={(e) => f("stay", e.target.value)}
                  placeholder="Hotel, apartment, or a place to call home"
                />
              </label>
              <label>
                Day notes
                <textarea
                  maxLength={5000}
                  value={form.notes || ""}
                  onChange={(e) => f("notes", e.target.value)}
                  placeholder="Reservations, reminders, little things to remember"
                />
              </label>
            </>
          )}
          {modal?.kind === "extra" && (
            <>
              <label>
                Essential
                <input
                  required
                  maxLength={200}
                  value={form.name || ""}
                  onChange={(e) => f("name", e.target.value)}
                  placeholder="Passport, charger, sunscreen…"
                />
              </label>
              <div className="form-grid">
                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max="999"
                    required
                    value={form.quantity ?? 1}
                    onChange={(e) => f("quantity", Number(e.target.value))}
                  />
                </label>
                <label>
                  Weight per item (g)
                  <input
                    type="number"
                    min="0"
                    max="50000"
                    required
                    value={form.weight ?? 0}
                    onChange={(e) => f("weight", Number(e.target.value))}
                  />
                </label>
              </div>
            </>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="outline"
              onClick={() => setModal(null)}
              disabled={savingForm}
            >
              Cancel
            </button>
            <button type="submit" className="primary" disabled={savingForm}>
              <Check /> Save{" "}
              {modal?.kind === "day"
                ? "day"
                : modal?.kind === "extra"
                  ? "item"
                  : modal?.kind}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
