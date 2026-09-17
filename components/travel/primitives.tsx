"use client";
import { Shirt, Footprints, Camera, Package } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { Item } from "@/lib/model";
export function Choice({
  value,
  onChange,
  options,
  placeholder = "Choose",
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  label?: string;
}) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
    >
      <SelectTrigger aria-label={label || placeholder} className="choice">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem value={o.value || "none"} key={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
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
  const Icon =
    item.category === "Shoes"
      ? Footprints
      : item.category === "Gear"
        ? Camera
        : item.category === "Accessories"
          ? Package
          : Shirt;
  return (
    <div
      className={`piece ${large ? "large" : ""} ${item.category.toLowerCase()}`}
    >
      {item.image ? (
        <img src={item.image} alt={item.name} loading="lazy" />
      ) : (
        <Icon strokeWidth={1.15} />
      )}
    </div>
  );
}
