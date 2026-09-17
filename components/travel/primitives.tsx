"use client";
import React, {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import type { Item, Outfit, Workspace } from "@/lib/model";
import { Garment } from "./garment";
import { Select } from "./pickers";
import { Icon, type IconName } from "./icons";
export { Icon } from "./icons";
export function Button({
  children,
  icon,
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName;
  variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return (
    <button
      type="button"
      {...props}
      className={`ew-button ew-${variant} ${className}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  icon,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: IconName;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`ew-icon-button ${props.className || ""}`}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} />
    </button>
  );
}
export function Choice({
  value,
  onChange,
  options,
  placeholder = "Choose",
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  label?: string;
}) {
  return (
    <Select
      aria-label={label || placeholder}
      value={value}
      onChange={onChange}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
export function Piece({
  item,
  large = false,
}: {
  item: Item;
  large?: boolean;
}) {
  return (
    <div className={`ew-piece ${large ? "ew-piece-large" : ""}`}>
      <Garment item={item} />
    </div>
  );
}
export function OutfitArt({ outfit, w }: { outfit: Outfit; w: Workspace }) {
  const items = outfit.items
    .map((id) => w.items.find((i) => i.id === id))
    .filter((i): i is Item => !!i);
  return (
    <div
      className={`ew-outfit-art ew-count-${Math.min(items.length, 5)}`}
      role="group"
      aria-label={`${outfit.name}: ${items.map((i) => i.name).join(", ")}`}
    >
      {items.slice(0, 5).map((i, index) => (
        <div className={`ew-outfit-piece ew-piece-${index}`} key={i.id}>
          <Garment item={i} />
        </div>
      ))}
      {!items.length && (
        <div className="ew-art-empty">
          <Icon name="hanger" size={38} />
          <span>No pieces yet</span>
        </div>
      )}
      {items.length > 5 && (
        <span className="ew-art-more">+{items.length - 5} more pieces</span>
      )}
    </div>
  );
}
export function Empty({
  icon = "compass",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ew-empty">
      <span className="ew-empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  eyebrow = "THE DETAILS MAKE THE TRIP",
  description,
  children,
  onDismiss,
  wide = false,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  onDismiss: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    heading = React.useId(),
    desc = React.useId();
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    document.documentElement.classList.add("ew-modal-open");
    return () => {
      d.close();
      if (!document.querySelector("dialog[open]"))
        document.documentElement.classList.remove("ew-modal-open");
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`ew-dialog ${wide ? "ew-dialog-wide" : ""} ${className}`}
      aria-labelledby={heading}
      aria-describedby={description ? desc : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      onClick={(e) => {
        if (e.target !== ref.current) return;
        const r = ref.current.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onDismiss();
      }}
    >
      <div className="ew-dialog-header">
        <div>
          <p className="ew-eyebrow">{eyebrow}</p>
          <h2 id={heading}>{title}</h2>
          {description && (
            <p className="ew-muted" id={desc}>
              {description}
            </p>
          )}
        </div>
        <IconButton icon="close" label={`Close ${title}`} onClick={onDismiss} />
      </div>
      <div className="ew-dialog-feedback" />
      {children}
    </dialog>
  );
}
export function Search({
  value,
  onChange,
  label = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="ew-search">
      <Icon name="search" />
      <span className="ew-sr-only">{label}</span>
      <input
        type="search"
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export const toggleId = (values: string[], id: string) =>
  values.includes(id) ? values.filter((i) => i !== id) : [...values, id];
export function ItemPicker({
  w,
  selected,
  onChange,
  label = "Choose wardrobe pieces",
}: {
  w: Workspace;
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const [query, setQuery] = React.useState("");
  const items = w.items.filter((i) =>
    `${i.name} ${i.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <fieldset className="ew-picker">
      <legend>
        {label}
        <small>{selected.length} selected</small>
      </legend>
      <Search value={query} onChange={setQuery} label="Find a piece" />
      <div className="ew-item-picker">
        {items.map((i) => (
          <label
            className={`ew-pick-item ${selected.includes(i.id) ? "ew-selected" : ""}`}
            key={i.id}
          >
            <input
              type="checkbox"
              aria-label={i.name}
              checked={selected.includes(i.id)}
              onChange={() => onChange(toggleId(selected, i.id))}
            />
            <Piece item={i} />
            <span>{i.name}</span>
            <small>
              {i.category} · {i.weight} g
            </small>
          </label>
        ))}
      </div>
      {!items.length && (
        <p className="ew-muted">
          {w.items.length
            ? "No pieces match your search."
            : "Add clothes or equipment in Wardrobe first."}
        </p>
      )}
    </fieldset>
  );
}
export function OutfitPicker({
  w,
  selected,
  onChange,
}: {
  w: Workspace;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="ew-picker">
      <legend>
        Outfits for this day<small>{selected.length} selected</small>
      </legend>
      <div className="ew-look-picker">
        {w.outfits.map((o) => (
          <label
            className={`ew-pick-look ${selected.includes(o.id) ? "ew-selected" : ""}`}
            key={o.id}
          >
            <input
              type="checkbox"
              aria-label={o.name}
              checked={selected.includes(o.id)}
              onChange={() => onChange(toggleId(selected, o.id))}
            />
            <OutfitArt w={w} outfit={o} />
            <strong>{o.name}</strong>
            <small>
              {o.occasion || "Everyday"} · {o.items.length} pieces
            </small>
          </label>
        ))}
      </div>
      {!w.outfits.length && (
        <p className="ew-muted">
          Create an outfit in Wardrobe to assign it here.
        </p>
      )}
    </fieldset>
  );
}
