"use client";
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";
import {
  formatDate,
  formatTime,
  isDate,
  isTime,
  monthGrid,
  parseDate,
  parseTime,
  shiftMonth,
  shiftTime,
} from "@/lib/time";
export { isDate, isTime };
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export type Placement = "bottom" | "top";
/** Anchored popover shared by every custom picker. */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  className = "",
  align = "start",
  width,
  labelledBy,
  minHeight = 0,
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  width?: number | "anchor";
  labelledBy?: string;
  /** Height the panel needs for anchored content, e.g. a full calendar row. */
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null),
    // The panel stays un-painted until it has been measured, so the first paint
    // is never a jump from a guessed corner of the screen.
    [panel, setPanel] = useState<{
      style: React.CSSProperties;
      placement: Placement;
      placed: boolean;
    }>({ style: { top: 0, left: 0 }, placement: "bottom", placed: false }),
    { style, placement, placed } = panel,
    // Outside a dialog the panel is portalled straight to the body, which needs
    // no extra render. Inside one, a layout effect re-parents it into that
    // dialog so it shares the modal top layer instead of hiding behind it.
    [host, setHost] = useState<HTMLElement | null>(() =>
      typeof document === "undefined" ? null : document.body,
    ),
    hostRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const next =
      anchor.current?.closest<HTMLElement>("dialog[open]") || document.body;
    if (next !== hostRef.current) {
      hostRef.current = next;
      setHost(next);
    }
  }, [open, anchor]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = anchor.current?.getBoundingClientRect(),
        element = ref.current;
      if (!trigger || !element) return;
      const gap = 8,
        viewport = window.visualViewport,
        originX = viewport?.offsetLeft ?? 0,
        originY = viewport?.offsetTop ?? 0,
        vw = viewport?.width ?? window.innerWidth,
        vh = viewport?.height ?? window.innerHeight,
        maxWidth = Math.max(1, vw - 20),
        maxHeight = Math.max(1, vh - 20);
      // Measure layout size, not the animated/scaled bounding box.
      const height = Math.min(Math.max(element.offsetHeight, minHeight), maxHeight);
      const below = originY + vh - trigger.bottom - gap;
      const above = trigger.top - originY - gap;
      // Prefer the roomier side, and the row below when the anchor is a
      // calendar cell so the panel does not cover the day it describes.
      const next: Placement =
        below >= height
          ? "bottom"
          : above >= height
            ? "top"
            : below >= above
              ? "bottom"
              : "top";
      const boxWidth = Math.min(width === "anchor" ? trigger.width : typeof width === "number" ? width : element.offsetWidth, maxWidth);
      let left =
        align === "end"
          ? trigger.right - boxWidth
          : align === "center"
            ? trigger.left + trigger.width / 2 - boxWidth / 2
            : trigger.left;
      left = Math.max(originX + 10, Math.min(left, originX + vw - boxWidth - 10));
      const top =
        next === "top" ? trigger.top - height - gap : trigger.bottom + gap;
      setPanel({
        placement: next,
        placed: true,
        style: {
          top: Math.max(originY + 10, Math.min(top, originY + vh - height - 10)),
          left,
          width: width === "anchor" ? boxWidth : width,
          maxWidth,
          minWidth: 0,
          maxHeight,
        },
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (ref.current) observer.observe(ref.current);
    if (anchor.current) observer.observe(anchor.current);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, align, width, minHeight, host]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        anchor.current?.focus?.();
        // Date/time inputs open on focus; close after restoring focus.
        onClose();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor.current?.contains(target))
        return;
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    const timer = window.setTimeout(
      () => document.addEventListener("mousedown", onPointer, true),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer, true);
    };
  }, [open, onClose, anchor]);
  if (!open || !host) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={labelledBy}
      className={`ew-popover ew-popover-${placement} ${className}`}
      style={style}
      data-placed={placed ? "true" : "false"}
      data-open="true"
    >
      {children}
    </div>,
    host,
  );
}
type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  autoFocus?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};
export type Option = { value: string; label: string; icon?: IconName };
export function Select({
  value,
  onChange,
  options,
  placeholder = "Choose",
  label,
  search = false,
  id,
  "aria-describedby": describedBy,
  autoFocus,
  disabled,
  className = "",
}: ControlProps & {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  label?: string;
  search?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0),
    trigger = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null),
    listId = useId();
  const shown = useMemo(
    () =>
      search && query
        ? options.filter((o) =>
            o.label.toLowerCase().includes(query.toLowerCase()),
          )
        : options,
    [options, query, search],
  );
  const selected = options.find((o) => o.value === value);
  const openMenu = useCallback(
    (index: number) => {
      setActive(index);
      setQuery("");
      setOpen(true);
    },
    [],
  );
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  const pick = (option: Option) => {
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu(
          Math.max(
            0,
            options.findIndex((o) => o.value === value),
          ),
        );
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        Math.min(
          shown.length - 1,
          Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)),
        ),
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(shown.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };
  return (
    <div className={`ew-select ${className}`}>
      <button
        ref={trigger}
        type="button"
        id={id}
        aria-describedby={describedBy}
        aria-label={label || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        className="ew-select-trigger"
        onClick={() => (open ? setOpen(false) : openMenu(Math.max(0, options.findIndex((o) => o.value === value))))}
        onKeyDown={onKeyDown}
      >
        {selected?.icon && <Icon name={selected.icon} size={15} />}
        <span className={selected ? "" : "ew-select-placeholder"}>
          {selected?.label || placeholder}
        </span>
        <Icon name="down" size={14} className="ew-select-caret" />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={trigger}
        width="anchor"
        className="ew-select-panel"
      >
        {search && (
          <label className="ew-select-search">
            <Icon name="search" size={14} />
            <input
              autoFocus
              value={query}
              placeholder="Filter…"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </label>
        )}
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label || placeholder}
          tabIndex={-1}
          className="ew-select-list"
        >
          {shown.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              data-active={index === active}
              className={`ew-select-option ${option.value === value ? "ew-selected" : ""}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(option)}
            >
              {option.icon && <Icon name={option.icon} size={15} />}
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={14} />}
            </button>
          ))}
          {!shown.length && <p className="ew-select-empty">No matches.</p>}
        </div>
      </Popover>
    </div>
  );
}
function CalendarGrid({
  value,
  min,
  max,
  onSelect,
  autoFocus = false,
  keepFocus = false,
}: {
  value: string;
  min?: string;
  max?: string;
  onSelect: (date: string) => void;
  autoFocus?: boolean;
  /** Anchored to a text input: keep that input focused so typing continues. */
  keepFocus?: boolean;
}) {
  const initial = isDate(value) ? value : today();
  const [view, setView] = useState(initial.slice(0, 7));
  const [focus, setFocus] = useState(initial);
  const days = useMemo(() => monthGrid(view), [view]);
  const grid = useRef<HTMLDivElement>(null);
  const label = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${view}-01T12:00:00Z`));
  useEffect(() => {
    if (!autoFocus) return;
    grid.current
      ?.querySelector<HTMLButtonElement>('[data-focus="true"]')
      ?.focus();
  }, [autoFocus, focus]);
  const move = (amount: number) => {
    const date = new Date(`${focus}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    const next = date.toISOString().slice(0, 10);
    setFocus(next);
    if (next.slice(0, 7) !== view) setView(next.slice(0, 7));
  };
  return (
    <div className="ew-datepicker">
      <div className="ew-datepicker-head">
        <IconButton
          icon="left"
          label="Previous month"
          onClick={() => setView(shiftMonth(view, -1))}
        />
        <b aria-live="polite">{label}</b>
        <IconButton
          icon="right"
          label="Next month"
          onClick={() => setView(shiftMonth(view, 1))}
        />
      </div>
      <div className="ew-datepicker-week" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div
        ref={grid}
        className="ew-datepicker-grid"
        role="grid"
        aria-label={label}
        onKeyDown={(e) => {
          const amount = (
            {
              ArrowLeft: -1,
              ArrowRight: 1,
              ArrowUp: -7,
              ArrowDown: 7,
            } as Record<string, number>
          )[e.key];
          if (amount !== undefined) {
            e.preventDefault();
            move(amount);
          } else if (e.key === "PageUp" || e.key === "PageDown") {
            e.preventDefault();
            const amount = e.key === "PageUp" ? -1 : 1;
            const next = shiftMonth(focus.slice(0, 7), amount);
            setView(next);
            setFocus(`${next}-${focus.slice(-2)}`);
          }
        }}
      >
        {days.map((date) => {
          const outside = date.slice(0, 7) !== view;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              data-date={date}
              data-focus={focus === date}
              tabIndex={focus === date ? 0 : -1}
              aria-selected={date === value}
              aria-current={date === today() ? "date" : undefined}
              aria-label={formatDate(date)}
              disabled={Boolean((min && date < min) || (max && date > max))}
              className={`ew-day-cell ${outside ? "ew-outside" : ""} ${date === value ? "ew-selected" : ""} ${date === today() ? "ew-today" : ""}`}
              onMouseDown={(e) => {
                if (keepFocus) e.preventDefault();
              }}
              onClick={() => {
                setFocus(date);
                if (outside) setView(date.slice(0, 7));
                onSelect(date);
              }}
            >
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>
      <div className="ew-datepicker-foot">
        <button type="button" onClick={() => onSelect(today())}>
          Today
        </button>
        {value && (
          <button type="button" onClick={() => setView(value.slice(0, 7))}>
            Back to {formatDate(value)}
          </button>
        )}
      </div>
    </div>
  );
}
export function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = "Add a date",
  label = "Date",
  id,
  "aria-describedby": describedBy,
  autoFocus,
  required,
  disabled,
  className = "",
}: ControlProps & {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(isDate(value) ? formatDate(value) : ""),
    [invalid, setInvalid] = useState(false),
    panelId = useId(),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!input.current || document.activeElement === input.current) return;
    setText(isDate(value) ? formatDate(value) : "");
    setInvalid(false);
  }, [value]);
  const commit = (raw: string) => {
    if (!raw.trim()) {
      if (!required) {
        onChange("");
        setInvalid(false);
      } else setText(isDate(value) ? formatDate(value) : "");
      return;
    }
    const parsed = parseDate(raw);
    const outside =
      parsed && ((min && parsed < min) || (max && parsed > max));
    if (!parsed || outside) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatDate(parsed));
    if (parsed !== value) onChange(parsed);
  };
  const openCalendar = () => {
    if (disabled) return;
    setOpen(true);
  };
  return (
    <div className={`ew-datefield ${className}`}>
      <div className={`ew-picker-input ${invalid ? "ew-invalid" : ""}`}>
        <Icon name="calendar" size={15} />
        <input
          ref={input}
          id={id}
          aria-describedby={describedBy}
          aria-label={label}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-autocomplete="none"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          onFocus={openCalendar}
          onClick={openCalendar}
          onBlur={() => {
            commit(text);
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
              setOpen(false);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              openCalendar();
            }
          }}
        />
        {value && !required ? (
          <button
            type="button"
            className="ew-picker-clear"
            aria-label="Clear the date"
            onClick={() => {
              onChange("");
              setText("");
              input.current?.focus();
            }}
          >
            <Icon name="close" size={13} />
          </button>
        ) : (
          <button
            type="button"
            className="ew-picker-toggle"
            aria-label="Open the calendar"
            onClick={() => (open ? setOpen(false) : openCalendar())}
          >
            <Icon name="down" size={14} />
          </button>
        )}
      </div>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={input}
        className="ew-calendar-popover"
      >
        <div id={panelId}>
        <CalendarGrid
          value={isDate(value) ? value : min || today()}
          min={min}
          max={max}
          autoFocus
          keepFocus
          onSelect={(date) => {
            onChange(date);
            setText(formatDate(date));
            setInvalid(false);
            setOpen(false);
          }}
        />
        </div>
      </Popover>
    </div>
  );
}
const hours12 = Array.from({ length: 12 }, (_, i) => i + 1);
const hourValues = Array.from({ length: 24 }, (_, i) => i);
const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
export function TimeField({
  value,
  onChange,
  label = "Time",
  id,
  "aria-describedby": describedBy,
  autoFocus,
  disabled,
  className = "",
  hour12 = false,
  placeholder = "Set a time",
}: ControlProps & {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hour12?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(isTime(value) ? formatTime(value, hour12) : ""),
    [invalid, setInvalid] = useState(false),
    panelId = useId(),
    input = useRef<HTMLInputElement>(null),
    columns = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!input.current || document.activeElement === input.current) return;
    setText(isTime(value) ? formatTime(value, hour12) : "");
    setInvalid(false);
  }, [value, hour12]);
  useEffect(() => {
    if (!open) return;
    columns.current
      ?.querySelectorAll<HTMLElement>("[data-selected='true']")
      .forEach((el) => el.scrollIntoView({ block: "center" }));
  }, [open]);
  const commit = (raw: string) => {
    if (!raw.trim()) {
      onChange("");
      setInvalid(false);
      return;
    }
    const parsed = parseTime(raw);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatTime(parsed, hour12));
    onChange(parsed);
  };
  const hour = isTime(value) ? Number(value.slice(0, 2)) : -1,
    minute = isTime(value) ? Number(value.slice(3, 5)) : -1;
  const pick = (h: number, m: number) => {
    const next = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onChange(next);
    setText(formatTime(next, hour12));
    setInvalid(false);
  };
  const displayHours = hour12
    ? hours12.map((h) => ({ value: h === 12 ? 0 : h + 12, label: h }))
    : hourValues.map((h) => ({ value: h, label: h }));
  return (
    <div className={`ew-timefield ${className}`}>
      <div className={`ew-picker-input ${invalid ? "ew-invalid" : ""}`}>
        <Icon name="clock" size={15} />
        <input
          ref={input}
          id={id}
          aria-describedby={describedBy}
          aria-label={label}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onClick={() => !disabled && setOpen(true)}
          onBlur={() => {
            commit(text);
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
              setOpen(false);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
            if (
              (e.key === "ArrowUp" || e.key === "ArrowDown") &&
              isTime(value) &&
              e.altKey
            ) {
              e.preventDefault();
              const next = shiftTime(value, e.key === "ArrowUp" ? 15 : -15);
              onChange(next);
              setText(formatTime(next, hour12));
            }
          }}
        />
        {value ? (
          <button
            type="button"
            className="ew-picker-clear"
            aria-label="Clear the time"
            onClick={() => {
              onChange("");
              setText("");
              input.current?.focus();
            }}
          >
            <Icon name="close" size={13} />
          </button>
        ) : (
          <button
            type="button"
            className="ew-picker-toggle"
            aria-label="Choose a time"
            onClick={() => (open ? setOpen(false) : setOpen(true))}
          >
            <Icon name="down" size={14} />
          </button>
        )}
      </div>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={input}
        className="ew-timepicker-popover"
      >
        <div className="ew-timepicker" id={panelId}>
          <div className="ew-timepicker-quick">
            {[
              ["Morning", "09:00"],
              ["Noon", "12:00"],
              ["Afternoon", "15:00"],
              ["Evening", "19:00"],
            ].map(([name, time]) => (
              <button
                key={time}
                type="button"
                aria-pressed={value === time}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const [h, m] = time.split(":").map(Number);
                  pick(h, m);
                }}
              >
                {name}
                <small>{formatTime(time, hour12)}</small>
              </button>
            ))}
          </div>
          <div className="ew-timepicker-columns" ref={columns}>
            <div role="listbox" aria-label={`${label} hour`} tabIndex={-1}>
              {displayHours.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  role="option"
                  aria-selected={hour === h.value}
                  data-selected={hour === h.value}
                  onMouseDown={(e) => e.preventDefault()}
                  className={hour === h.value ? "ew-selected" : ""}
                  onClick={() => pick(h.value, minute < 0 ? 0 : minute)}
                >
                  {String(h.label).padStart(2, "0")}
                </button>
              ))}
            </div>
            <div role="listbox" aria-label={`${label} minute`} tabIndex={-1}>
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={minute === m}
                  data-selected={minute === m}
                  onMouseDown={(e) => e.preventDefault()}
                  className={minute === m ? "ew-selected" : ""}
                  onClick={() => pick(hour < 0 ? 9 : hour, m)}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
          <p className="ew-timepicker-hint">
            <Icon name="clock" size={13} />
            {isTime(value) ? formatTime(value, hour12) : "No time set — all-day"}
          </p>
        </div>
      </Popover>
    </div>
  );
}
const SWATCHES = [
  "#2f3826",
  "#4c5a3a",
  "#6f7a56",
  "#9aa383",
  "#c2ae88",
  "#8b6f4e",
  "#6b4a3a",
  "#3d443c",
  "#2c3e50",
  "#466c82",
  "#7596b0",
  "#c9d6dd",
  "#dedbd0",
  "#f0ece1",
  "#8c526b",
  "#954b3b",
  "#b4543f",
  "#d8a05a",
] as const;
export function ColorField({
  value,
  onChange,
  label = "Colour",
  id,
  "aria-describedby": describedBy,
  disabled,
  className = "",
}: ControlProps & {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    trigger = useRef<HTMLButtonElement>(null),
    picker = useRef<HTMLInputElement>(null);
  const current = value || "#8b8b73";
  return (
    <div className={`ew-colorfield ${className}`}>
      <button
        ref={trigger}
        type="button"
        id={id}
        aria-describedby={describedBy}
        aria-label={`${label}, ${current}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        className="ew-color-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <i style={{ background: current }} />
        <span>{current.toUpperCase()}</span>
        <Icon name="down" size={13} />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={trigger}
        className="ew-color-popover"
      >
        <div className="ew-swatches" role="group" aria-label={label}>
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch}`}
              aria-pressed={current.toLowerCase() === swatch}
              className={current.toLowerCase() === swatch ? "ew-selected" : ""}
              style={{ background: swatch }}
              onClick={() => {
                onChange(swatch);
                setOpen(false);
              }}
            />
          ))}
        </div>
        <div className="ew-color-custom">
          <span
            className="ew-color-preview"
            style={{ background: current }}
            aria-hidden="true"
          />
          <label>
            <span>Custom</span>
            <input
              ref={picker}
              type="color"
              aria-label={`Custom ${label}`}
              value={current}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ew-color-done"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      </Popover>
    </div>
  );
}
function IconButton({
  icon,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
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
