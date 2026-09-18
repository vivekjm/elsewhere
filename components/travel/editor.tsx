"use client";
import React, { useState, type ReactNode } from "react";
import {
  ACTIVITY_TYPES,
  CATEGORIES,
  CURRENCIES,
  EXTRA_CATEGORIES,
  SHAPES,
  blankDay,
  dayOutfits,
  defaultShape,
  uid,
  type Workspace,
  type Trip,
  type Item,
  type Outfit,
  type Activity,
  type Day,
  type Extra,
} from "@/lib/model";
import { emptyTrip } from "@/lib/planning";
import { MOODS, Landscape } from "./landscape";
import { activityIcon } from "./icons";
import { ColorField, DateField, Select, TimeField } from "./pickers";
import {
  Button,
  Icon,
  Modal as Dialog,
  Piece,
  ItemPicker,
  OutfitPicker,
} from "./primitives";
export type Modal = {
  kind: "trip" | "activity" | "item" | "outfit" | "day" | "extra";
  id?: string;
  date?: string;
  /** Pre-filled values for a new entry, e.g. a quick-add starting point. */
  draft?: Record<string, unknown>;
};
export type FormDraft = {
  id?: string;
  name?: string;
  title?: string;
  destination?: string;
  start?: string;
  end?: string;
  date?: string;
  time?: string;
  endTime?: string;
  travellers?: number;
  budget?: number;
  currency?: Trip["currency"];
  weightLimit?: number;
  theme?: Trip["theme"];
  sample?: boolean;
  category?: string;
  weight?: number;
  image?: string;
  color?: string;
  shape?: Item["shape"];
  items?: string[];
  occasion?: string;
  place?: string;
  cost?: number;
  link?: string;
  notes?: string;
  outfitId?: string;
  outfitIds?: string[];
  gear?: string[];
  stay?: string;
  quantity?: number;
  packed?: boolean;
  completed?: boolean;
  days?: Trip["days"];
  activities?: Activity[];
  extras?: Extra[];
};
export type EditorResult = {
  kind: Modal["kind"];
  value: Trip | Item | Outfit | Activity | Day | Extra;
  shiftPlans: boolean;
};
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div className="ew-field">
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const type = String(child.type);
        // Native inputs and the custom pickers both accept id/aria-describedby.
        if (
          !["input", "select", "textarea", "button"].includes(type) &&
          typeof child.type !== "function"
        )
          return child;
        return React.cloneElement(
          child as React.ReactElement<{
            id?: string;
            "aria-describedby"?: string;
          }>,
          { id, "aria-describedby": hint ? `${id}-hint` : undefined },
        );
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Editor({
  modal,
  w,
  trip,
  day,
  onClose,
  onSave,
}: {
  modal: Modal;
  w: Workspace;
  trip?: Trip;
  day: string;
  onClose: () => void;
  onSave: (result: EditorResult) => void;
}) {
  const date = modal.date || day || trip?.start || emptyTrip().start;
  const [initial] = useState<FormDraft>(
    () =>
      structuredClone(
        modal.kind === "trip"
          ? w.trips.find((t) => t.id === modal.id) || emptyTrip()
          : modal.kind === "item"
            ? w.items.find((i) => i.id === modal.id) || {
                id: uid(),
                name: "",
                category: "Tops",
                weight: 0,
                image: "",
                color: "#a79e87",
                shape: "shirt",
                notes: "",
              }
            : modal.kind === "outfit"
              ? w.outfits.find((o) => o.id === modal.id) || {
                  id: uid(),
                  name: "",
                  items: [],
                  occasion: "Everyday",
                  notes: "",
                }
              : modal.kind === "day"
                ? {
                    ...blankDay(),
                    ...trip?.days[date],
                    outfitIds: dayOutfits(trip?.days[date]),
                  }
                : modal.kind === "activity"
                  ? trip?.activities.find((a) => a.id === modal.id) || {
                      id: uid(),
                      date,
                      time: "10:00",
                      endTime: "",
                      title: "",
                      category: "Explore",
                      place: "",
                      cost: 0,
                      link: "",
                      notes: "",
                      outfitId: "",
                      gear: [],
                      completed: false,
                    }
                  : trip?.extras.find((e) => e.id === modal.id) || {
                      id: uid(),
                      name: "",
                      quantity: 1,
                      weight: 0,
                      packed: false,
                      category: "Essentials",
                    },
      ) as FormDraft,
  );
  const [form, setForm] = useState(() => ({
      ...initial,
      ...(modal.draft || {}),
    })),
    [shift, setShift] = useState(false),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false),
    [discard, setDiscard] = useState(false);
  const f = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };
  const dirty = JSON.stringify(initial) !== JSON.stringify(form) || shift;
  const dismiss = () => {
    if (uploading) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  const names = {
    trip: "trip",
    activity: "activity",
    item: "wardrobe piece",
    outfit: "outfit",
    day: "day details",
    extra: "packing item",
  };
  const title =
    modal.kind === "day"
      ? "Make this day yours"
      : `${modal.id ? "Edit" : "New"} ${names[modal.kind]}`;
  async function upload(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Choose a JPEG, PNG or WebP photo under 5 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const data = new FormData();
      data.set("image", file);
      const r = await fetch("/api/images", {
        method: "POST",
        credentials: "same-origin",
        body: data,
      });
      const body = (await r.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!r.ok || !body.url)
        throw new Error(
          body.error || "The photo could not be uploaded. Please try again.",
        );
      f("image", body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return;
    try {
      if (modal.kind === "outfit" && !form.items?.length)
        throw new Error("Choose at least one wardrobe piece.");
      const value = { ...form };
      if (modal.kind === "day") value.outfitId = value.outfitIds?.[0] || "";
      onSave({
        kind: modal.kind,
        value: value as EditorResult["value"],
        shiftPlans: shift,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please check the form.");
    }
  }
  const notes = (
    label = "Notes",
    placeholder = "The little things worth remembering…",
  ) => (
    <Field label={label}>
      <textarea
        maxLength={5000}
        rows={3}
        value={form.notes || ""}
        onChange={(e) => f("notes", e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
  const number = (
    key: string,
    label: string,
    value: number,
    max: number,
    min = 0,
    step = "1",
  ) => (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        required
        value={value}
        onChange={(e) =>
          f(key, e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    </Field>
  );
  const outfit = (
    <Field label="Outfit for this activity">
      <Select
        label="Outfit for this activity"
        value={form.outfitId || ""}
        onChange={(value) => f("outfitId", value)}
        placeholder="No outfit chosen"
        search={w.outfits.length > 6}
        options={[
          { value: "", label: "No activity-specific outfit" },
          ...w.outfits.map((o) => ({
            value: o.id,
            label: o.name,
            icon: "hanger" as const,
          })),
        ]}
      />
    </Field>
  );
  return (
    <Dialog
      title={title}
      onDismiss={dismiss}
      wide={["item", "outfit", "day", "activity"].includes(modal.kind)}
      description={
        modal.kind === "activity"
          ? "A place, a plan, and the things you’ll need."
          : modal.kind === "outfit"
            ? "Pieces you love. A look you can use again."
            : "Everything in its place, before you go."
      }
    >
      <form onSubmit={submit}>
        <fieldset disabled={uploading} className="ew-editor-body">
          {modal.kind === "trip" && (
            <>
              <Field label="Trip name">
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={form.name || ""}
                  onChange={(e) => f("name", e.target.value)}
                  placeholder="A little time in the mountains"
                />
              </Field>
              <Field label="Destination">
                <input
                  required
                  maxLength={200}
                  value={form.destination || ""}
                  onChange={(e) => f("destination", e.target.value)}
                  placeholder="City, region or country"
                />
              </Field>
              <div className="ew-form-grid">
                <Field label="Departure">
                  <DateField
                    required
                    label="Departure"
                    min="1900-01-01"
                    max="2200-12-31"
                    value={form.start || ""}
                    onChange={(value) => f("start", value)}
                  />
                </Field>
                <Field label="Return">
                  <DateField
                    required
                    label="Return"
                    min={form.start || "1900-01-01"}
                    max="2200-12-31"
                    value={form.end || ""}
                    onChange={(value) => f("end", value)}
                  />
                </Field>
              </div>
              {modal.id && form.start !== initial.start && (
                <label className="ew-check-line">
                  <input
                    type="checkbox"
                    checked={shift}
                    onChange={(e) => setShift(e.target.checked)}
                  />
                  Move all existing plans by the same number of days
                </label>
              )}
              <div className="ew-form-grid">
                {number(
                  "travellers",
                  "Travellers",
                  form.travellers ?? 1,
                  100,
                  1,
                )}
                {number(
                  "budget",
                  "Trip budget",
                  form.budget ?? 0,
                  10000000,
                  0,
                  "0.01",
                )}
                <Field label="Currency">
                  <Select
                    label="Currency"
                    value={form.currency || "INR"}
                    onChange={(value) => f("currency", value)}
                    search
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  />
                </Field>
                {number(
                  "weightLimit",
                  "Luggage target (kg)",
                  form.weightLimit ?? 15,
                  1000,
                  0,
                  "0.1",
                )}
              </div>
              <p className="ew-hint">
                A zero budget or luggage target means you haven’t set one yet.
              </p>
              <fieldset className="ew-mood-picker">
                <legend>
                  Cover mood<small>{MOODS.find((m) => m.id === form.theme)?.label || "Quiet mountains"}</small>
                </legend>
                <div className="ew-mood-grid">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={(form.theme || "mountains") === m.id}
                      aria-label={m.label}
                      onClick={() => f("theme", m.id)}
                      className={
                        (form.theme || "mountains") === m.id ? "ew-selected" : ""
                      }
                    >
                      <span className="ew-mood-art">
                        <Landscape theme={m.id} />
                      </span>
                      <span className="ew-mood-label">{m.label}</span>
                      <Icon name="check" size={13} />
                    </button>
                  ))}
                </div>
              </fieldset>
              {notes("Trip notes")}
            </>
          )}
          {modal.kind === "activity" && (
            <>
              <Field label="Activity">
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={form.title || ""}
                  onChange={(e) => f("title", e.target.value)}
                  placeholder="What’s the plan?"
                />
              </Field>
              <div className="ew-form-grid">
                <Field label="Date">
                  <DateField
                    required
                    label="Date"
                    min={trip?.start}
                    max={trip?.end}
                    value={form.date || date}
                    onChange={(value) => f("date", value)}
                  />
                </Field>
                <Field label="Activity type">
                  <Select
                    label="Activity type"
                    value={form.category || "Explore"}
                    onChange={(value) => f("category", value)}
                    options={ACTIVITY_TYPES.map((c) => ({
                      value: c,
                      label: c,
                      icon: activityIcon(c),
                    }))}
                  />
                </Field>
                <Field
                  label="Start time"
                  hint="Leave empty for an all-day plan."
                >
                  <TimeField
                    label="Start time"
                    value={form.time || ""}
                    onChange={(value) => {
                      f("time", value);
                      if (!value) f("endTime", "");
                    }}
                  />
                </Field>
                <Field label="End time (optional)">
                  <TimeField
                    label="End time (optional)"
                    value={form.endTime || ""}
                    onChange={(value) => f("endTime", value)}
                  />
                </Field>
              </div>
              <Field label="Place">
                <input
                  maxLength={200}
                  value={form.place || ""}
                  onChange={(e) => f("place", e.target.value)}
                  placeholder="Venue, neighbourhood or meeting point"
                />
              </Field>
              <div className="ew-form-grid">
                {number(
                  "cost",
                  `Estimated cost (${trip?.currency || "INR"})`,
                  form.cost ?? 0,
                  10000000,
                  0,
                  "0.01",
                )}
                {outfit}
              </div>
              <Field label="Reference link (optional)">
                <input
                  type="url"
                  maxLength={2000}
                  value={form.link || ""}
                  onChange={(e) => f("link", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              {notes()}
              <ItemPicker
                w={w}
                label="Clothes & equipment for this activity"
                selected={form.gear || []}
                onChange={(v) => f("gear", v)}
              />
            </>
          )}
          {modal.kind === "day" && (
            <>
              <Field label="Day title">
                <input
                  autoFocus
                  maxLength={200}
                  value={form.title || ""}
                  onChange={(e) => f("title", e.target.value)}
                  placeholder="A slow morning, a new adventure"
                />
              </Field>
              <Field label="Accommodation">
                <input
                  maxLength={200}
                  value={form.stay || ""}
                  onChange={(e) => f("stay", e.target.value)}
                  placeholder="Where you’re staying tonight"
                />
              </Field>
              {notes("Day notes")}
              <OutfitPicker
                w={w}
                selected={form.outfitIds || []}
                onChange={(v) => f("outfitIds", v)}
              />
              <ItemPicker
                w={w}
                label="Daily essentials"
                selected={form.gear || []}
                onChange={(v) => f("gear", v)}
              />
            </>
          )}
          {modal.kind === "item" && (
            <div className="ew-item-editor">
              <div>
                <div className="ew-item-preview">
                  <Piece item={form as Item} large />
                </div>
                <label className="ew-button ew-secondary ew-upload">
                  <input
                    className="ew-sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      void upload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {uploading ? "Uploading photo…" : "Upload your own photo"}
                </label>
                <p className="ew-hint">
                  JPEG, PNG or WebP · up to 5 MB.
                  <br />
                  Photos stay private to this workspace.
                </p>
                {form.image && (
                  <Button variant="quiet" onClick={() => f("image", "")}>
                    Remove photo
                  </Button>
                )}
              </div>
              <div>
                <Field label="Item name">
                  <input
                    autoFocus
                    required
                    maxLength={200}
                    value={form.name || ""}
                    onChange={(e) => f("name", e.target.value)}
                    placeholder="Your favourite linen shirt"
                  />
                </Field>
                <Field label="Category">
                  <Select
                    label="Category"
                    value={form.category || "Tops"}
                    onChange={(value) => {
                      f("category", value);
                      f("shape", defaultShape(value));
                    }}
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </Field>
                <div className="ew-form-grid">
                  <Field label="Illustration">
                    <Select
                      label="Illustration"
                      value={String(
                        form.shape || defaultShape(form.category || "Tops"),
                      )}
                      onChange={(value) => f("shape", value)}
                      search
                      options={SHAPES.map((c) => ({
                        value: String(c),
                        label: c[0].toUpperCase() + c.slice(1),
                      }))}
                    />
                  </Field>
                  <Field label="Colour">
                    <ColorField
                      label="Colour"
                      value={form.color || "#8b8b73"}
                      onChange={(value) => f("color", value)}
                    />
                  </Field>
                </div>
                {number(
                  "weight",
                  "Weight (g)",
                  form.weight ?? 0,
                  50000,
                  0,
                  "0.1",
                )}
                {notes("Item notes")}
              </div>
            </div>
          )}
          {modal.kind === "outfit" && (
            <>
              <div className="ew-form-grid">
                <Field label="Outfit name">
                  <input
                    autoFocus
                    required
                    maxLength={200}
                    value={form.name || ""}
                    onChange={(e) => f("name", e.target.value)}
                    placeholder="The mountain morning"
                  />
                </Field>
                <Field label="Occasion">
                  <input
                    maxLength={100}
                    list="ew-occasions"
                    value={form.occasion || ""}
                    onChange={(e) => f("occasion", e.target.value)}
                  />
                  <datalist id="ew-occasions">
                    {[
                      "Everyday",
                      "Exploring",
                      "Travel",
                      "Evening",
                      "Hiking",
                      "Work",
                      "Formal",
                    ].map((o) => (
                      <option value={o} key={o} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <ItemPicker
                w={w}
                selected={form.items || []}
                onChange={(v) => f("items", v)}
              />
              {notes("Outfit notes")}
            </>
          )}
          {modal.kind === "extra" && (
            <>
              <Field label="Packing item">
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={form.name || ""}
                  onChange={(e) => f("name", e.target.value)}
                  placeholder="Passport, charger, toiletries…"
                />
              </Field>
              <Field label="Packing category">
                <Select
                  label="Packing category"
                  value={form.category || "Essentials"}
                  onChange={(value) => f("category", value)}
                  options={EXTRA_CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <div className="ew-form-grid">
                {number("quantity", "Quantity", form.quantity ?? 1, 999, 1)}
                {number(
                  "weight",
                  "Weight per item (g)",
                  form.weight ?? 0,
                  50000,
                  0,
                  "0.1",
                )}
              </div>
              <label className="ew-check-line">
                <input
                  type="checkbox"
                  checked={form.packed || false}
                  onChange={(e) => f("packed", e.target.checked)}
                />
                Already packed
              </label>
              <p className="ew-hint">
                Clothes assigned to plans appear automatically. Add other
                essentials here.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="ew-inline-error">
              {error}
            </p>
          )}
          {discard && (
            <div className="ew-inline-error" role="alert">
              <p>Discard your unsaved form changes?</p>
              <div className="ew-actions">
                <Button variant="danger" onClick={onClose}>
                  Discard changes
                </Button>
                <Button onClick={() => setDiscard(false)}>Keep editing</Button>
              </div>
            </div>
          )}
        </fieldset>
        <footer className="ew-dialog-footer">
          <Button onClick={dismiss} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon="check"
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Save changes"}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
