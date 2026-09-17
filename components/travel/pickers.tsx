"use client";

import React, { Children, isValidElement, useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { addDays, validDate } from "@/lib/model";
import { dateLabel, monthDays, shiftMonth, today } from "@/lib/planning";
import { Icon } from "./icons";

type ControlProps = {
  id?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
};
type Anchor = React.RefObject<HTMLElement | null>;

/** A custom, anchored surface in the top layer, including inside modal editors.
 * It stays in the DOM beside its trigger, so the enclosing dialog's focus scope
 * still contains it. Escape, outside click and focus leaving all dismiss it.
 */
export function PickerPanel({ anchor, children, onClose, label, className = "", width = 320 }: {
  anchor: Anchor;
  children: ReactNode;
  onClose: (restoreFocus?: boolean) => void;
  label: string;
  className?: string;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    document.dispatchEvent(new CustomEvent("ew:picker-open", { detail: id }));
    panel.showPopover?.();
    function position() {
      if (!panel || !anchor.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const vw = viewport?.width ?? window.innerWidth;
      const vh = viewport?.height ?? window.innerHeight;
      const w = Math.min(width, vw - 24);
      panel.style.width = `${w}px`;
      const below = top + vh - rect.bottom - 18;
      const above = rect.top - top - 18;
      const useAbove = below < Math.min(panel.scrollHeight, 280) && above > below;
      const maxHeight = Math.max(100, useAbove ? above : below);
      panel.style.maxHeight = `${Math.min(maxHeight, vh - 24)}px`;
      const height = panel.getBoundingClientRect().height;
      panel.style.left = `${Math.max(left + 12, Math.min(rect.left, left + vw - w - 12))}px`;
      panel.style.top = `${Math.max(top + 12, useAbove ? rect.top - height - 8 : Math.min(rect.bottom + 8, top + vh - height - 12))}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    if (anchor.current) observer.observe(anchor.current);
    {
      ["[data-autofocus]", "button[aria-selected='true']", "button[tabindex='0']", "input", "button"].map(selector => panel.querySelector<HTMLElement>(selector)).find(Boolean)?.focus({ preventScroll: true });
      // Reveal selected times/options without moving the page or editor beneath us.
      panel.querySelectorAll<HTMLElement>("[role=listbox]").forEach(list => {
        const selected = list.querySelector<HTMLElement>("[aria-selected=true]");
        if (selected && list.scrollHeight > list.clientHeight) {
          list.scrollTop += selected.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - selected.offsetHeight) / 2;
        }
      });
    }
    function outside(e: Event) {
      const target = e.target;
      if (target instanceof Node && !panel?.contains(target) && !anchor.current?.contains(target)) onClose(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose(true);
    }
    function other(e: Event) {
      if ((e as CustomEvent<string>).detail !== id) onClose(false);
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("ew:picker-open", other);
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("ew:picker-open", other);
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      panel.hidePopover?.();
    };
  }, [anchor, id, onClose, width]);
  return <div ref={ref} popover="manual" className={`ew-picker-panel ${className}`} role="dialog" aria-label={label}>{children}</div>;
}

export function Select({ value = "", onChange, children, placeholder = "Choose", ...props }: ControlProps & {
  value?: string;
  onChange: (value: string) => void;
  children: ReactNode;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const anchor = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const typeahead = useRef({ text: "", at: 0 });
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>(child)) return [];
    const text = Children.toArray(child.props.children).join("");
    return [{ value: child.props.value ?? text, label: text, disabled: !!child.props.disabled }];
  });
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  const selected = options.find(o => o.value === value);
  const close = useCallback((restore = true) => {
    setOpen(false);
    setQuery("");
    if (restore) anchor.current?.focus({ preventScroll: true });
  }, []);
  function choose(next: string) { onChange(next); close(); }
  function keys(e: React.KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role='option']:not(:disabled)"));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (e.key === "ArrowDown") next = Math.min(index + 1, buttons.length - 1);
    if (e.key === "ArrowUp") next = index <= 0 ? buttons.length - 1 : index - 1;
    if (e.key === "Home" && !(e.target instanceof HTMLInputElement)) next = 0;
    if (e.key === "End" && !(e.target instanceof HTMLInputElement)) next = buttons.length - 1;
    if (next !== undefined) { e.preventDefault(); buttons[next]?.focus(); return; }
    if (e.key.length === 1 && !(e.target instanceof HTMLInputElement) && !e.metaKey && !e.ctrlKey) {
      const now = Date.now();
      typeahead.current = { text: (now - typeahead.current.at > 600 ? "" : typeahead.current.text) + e.key.toLowerCase(), at: now };
      const match = buttons.find(b => b.textContent?.trim().toLowerCase().startsWith(typeahead.current.text));
      if (match) { e.preventDefault(); match.focus(); }
    }
  }
  return <div className="ew-picker-control">
    <button {...props} ref={anchor} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} className="ew-picker-trigger" onClick={() => setOpen(!open)} onKeyDown={e => {
      if (["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); setOpen(true); }
    }}><span>{selected?.label || placeholder}</span><Icon name="down" size={15} /></button>
    {open && <PickerPanel anchor={anchor} onClose={close} label={props["aria-label"] || "Choose an option"} width={300}>
      <div onKeyDown={keys}>
        {options.length > 7 && <div className="ew-picker-search"><Icon name="search" size={16} /><input data-autofocus aria-label="Filter options" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find…" /></div>}
        <div id={listId} role="listbox" aria-label={props["aria-label"] || "Options"} className="ew-picker-options">
          {filtered.map(o => <button key={o.value} type="button" role="option" aria-selected={o.value === value} disabled={o.disabled} tabIndex={o.value === value || (!selected && o === filtered[0]) ? 0 : -1} onClick={() => choose(o.value)}><span>{o.label}</span>{o.value === value && <Icon name="check" size={16} />}</button>)}
          {!filtered.length && <p className="ew-picker-empty">No matches</p>}
        </div>
      </div>
    </PickerPanel>}
  </div>;
}

export function DatePicker({ value, onChange, min = "1900-01-01", max = "2200-12-31", ...props }: ControlProps & {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((validDate(value) ? value : today()).slice(0, 7));
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [focusDate, setFocusDate] = useState(value);
  const anchor = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback((restore = true) => { setOpen(false); if (restore) anchor.current?.focus({ preventScroll: true }); }, []);
  // Commit roving focus before paint so a quick Arrow + Enter uses the new date.
  useLayoutEffect(() => {
    if (open && view === "days") grid.current?.querySelector<HTMLButtonElement>(`[data-picker-date="${focusDate}"]`)?.focus({ preventScroll: true });
  }, [open, view, month, focusDate]);
  const allowed = (d: string) => d >= min && d <= max;
  const clamp = (d: string) => d < min ? min : d > max ? max : d;
  const year = Number(month.slice(0, 4));
  const decade = Math.floor(year / 10) * 10;
  function show() {
    const d = clamp(validDate(value) ? value : today());
    setMonth(d.slice(0, 7)); setFocusDate(d); setView("days"); setOpen(true);
  }
  function choose(d: string) { if (allowed(d)) { onChange(d); close(); } }
  function focus(d: string) {
    const next = clamp(d); setFocusDate(next); setMonth(next.slice(0, 7));
  }
  function keys(e: React.KeyboardEvent, d: string) {
    const day = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
    const amounts: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -day, End: 6 - day };
    if (amounts[e.key] !== undefined) { e.preventDefault(); focus(addDays(d, amounts[e.key])); }
    if (["PageUp", "PageDown"].includes(e.key)) {
      e.preventDefault();
      const nextMonth = shiftMonth(d.slice(0, 7), (e.key === "PageDown" ? 1 : -1) * (e.shiftKey ? 12 : 1));
      const last = new Date(Date.parse(`${shiftMonth(nextMonth, 1)}-01`) - 86400000).getUTCDate();
      focus(`${nextMonth}-${String(Math.min(Number(d.slice(-2)), last)).padStart(2, "0")}`);
    }
  }
  const movement = view === "days" ? 1 : view === "months" ? 12 : 120;
  const move = (direction: number) => {
    const m = shiftMonth(month, movement * direction);
    const bounded = m < min.slice(0, 7) ? min.slice(0, 7) : m > max.slice(0, 7) ? max.slice(0, 7) : m;
    setMonth(bounded);
    setFocusDate(clamp(`${bounded}-01`));
  };
  return <div className="ew-picker-control">
    <button {...props} ref={anchor} type="button" className="ew-picker-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => open ? close() : show()}><Icon name="calendar" size={17} /><span>{validDate(value) ? dateLabel(value, { day: "numeric", month: "short", year: "numeric" }) : "Choose a date"}</span><Icon name="down" size={14} /></button>
    {open && <PickerPanel anchor={anchor} onClose={close} label={props["aria-label"] || "Choose a date"}>
      <div id={id} className="ew-date-picker" ref={grid}>
        <div className="ew-picker-heading">
          <button type="button" aria-label={view === "days" ? "Previous month" : view === "months" ? "Previous year" : "Previous decade"} disabled={month <= min.slice(0, 7)} onClick={() => move(-1)}><Icon name="left" size={18} /></button>
          <button className="ew-picker-period" type="button" aria-live="polite" onClick={() => setView(view === "days" ? "months" : view === "months" ? "years" : "days")}>{view === "days" ? dateLabel(`${month}-01`, { month: "long", year: "numeric" }) : view === "months" ? year : `${decade}–${decade + 9}`}<Icon name="down" size={13} /></button>
          <button type="button" aria-label={view === "days" ? "Next month" : view === "months" ? "Next year" : "Next decade"} disabled={month >= max.slice(0, 7)} onClick={() => move(1)}><Icon name="right" size={18} /></button>
        </div>
        {view === "days" ? <>
          <div className="ew-picker-weekdays" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((v, i) => <span key={i}>{v}</span>)}</div>
          <div className="ew-picker-dates" role="grid" aria-label={dateLabel(`${month}-01`, { month: "long", year: "numeric" })}>
            {Array.from({ length: 6 }, (_, week) => <div role="row" key={week}>{monthDays(month).slice(week * 7, week * 7 + 7).map(d => <div role="gridcell" key={d} aria-selected={d === value}><button type="button" data-picker-date={d} tabIndex={d === focusDate ? 0 : -1} disabled={!allowed(d)} aria-label={dateLabel(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} aria-current={d === today() ? "date" : undefined} className={`${d === value ? "is-selected" : ""} ${d.slice(0, 7) !== month ? "is-muted" : ""}`} onClick={() => choose(d)} onKeyDown={e => keys(e, d)}>{Number(d.slice(-2))}</button></div>)}</div>)}
          </div>
          <div className="ew-picker-bottom"><button type="button" disabled={!allowed(today())} onClick={() => choose(today())}>Today</button><button type="button" onClick={() => close()}>Done</button></div>
        </> : <div className="ew-picker-periods">
          {view === "months" ? Array.from({ length: 12 }, (_, i) => {
            const m = `${year}-${String(i + 1).padStart(2, "0")}`;
            return <button type="button" key={m} disabled={m < min.slice(0, 7) || m > max.slice(0, 7)} className={m === month ? "is-selected" : ""} onClick={() => { setMonth(m); setFocusDate(clamp(`${m}-01`)); setView("days"); }}>{dateLabel(`${m}-01`, { month: "short" })}</button>;
          }) : Array.from({ length: 12 }, (_, i) => decade - 1 + i).map(y => <button type="button" key={y} disabled={y < Number(min.slice(0, 4)) || y > Number(max.slice(0, 4))} className={y === year ? "is-selected" : ""} onClick={() => { setMonth(`${y}-01`); setView("months"); }}>{y}</button>)}
        </div>}
      </div>
    </PickerPanel>}
  </div>;
}

export function TimePicker({ value, onChange, min, ...props }: ControlProps & { value: string; onChange: (value: string) => void; min?: string }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const close = useCallback((restore = true) => { setOpen(false); if (restore) input.current?.focus({ preventScroll: true }); }, []);
  const hour = /^\d{2}:\d{2}$/.test(value) ? value.slice(0, 2) : (min?.slice(0, 2) || "10");
  const minute = /^\d{2}:\d{2}$/.test(value) ? value.slice(3) : "00";
  function pick(h: string, m: string) { const next = `${h}:${m}`; if (!min || next >= min) onChange(next); }
  return <div className="ew-time-control" ref={anchor}>
    <input {...props} ref={input} type="text" inputMode="numeric" autoComplete="off" placeholder="Any time" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" maxLength={5} value={value} onChange={e => onChange(e.target.value)} onBlur={e => {
      const text = e.target.value.trim();
      if (/^\d:[0-5]\d$/.test(text)) onChange(`0${text}`);
    }} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }} />
    <button type="button" disabled={props.disabled} aria-label={`Choose ${props["aria-label"]?.toLowerCase() || "time"}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}><Icon name="clock" size={17} /></button>
    {open && <PickerPanel anchor={anchor} onClose={close} label="Choose time" width={264}>
      <div className="ew-time-picker"><div className="ew-picker-heading"><strong>Time</strong><small>24-hour</small></div>
        <div className="ew-time-columns">{(["Hour", "Minute"] as const).map((label, column) => <div key={label}><span>{label}</span><div role="listbox" aria-label={label} onKeyDown={e => {
          const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = e.key === "ArrowDown" ? index + 1 : e.key === "ArrowUp" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : undefined;
          if (next !== undefined) { e.preventDefault(); items[Math.max(0, Math.min(items.length - 1, next))]?.focus(); }
        }}>{Array.from({ length: column === 0 ? 24 : 60 }, (_, i) => String(i).padStart(2, "0")).map(v => {
          const selected = v === (column === 0 ? hour : minute);
          const disabled = !!min && (column === 0 ? `${v}:59` < min : `${hour}:${v}` < min);
          return <button type="button" key={v} role="option" aria-selected={selected} tabIndex={selected ? 0 : -1} disabled={disabled} onClick={() => column === 0 ? pick(v, min && `${v}:${minute}` < min ? min.slice(3) : minute) : pick(hour, v)}>{v}</button>;
        })}</div></div>)}</div>
        <div className="ew-time-quick">{["00", "15", "30", "45"].map(m => <button type="button" key={m} disabled={!!min && `${hour}:${m}` < min} onClick={() => { pick(hour, m); close(); }}>:{m}</button>)}</div>
        <div className="ew-picker-bottom"><button type="button" onClick={() => { onChange(""); close(); }}>Clear</button><button type="button" onClick={() => { if (!value) pick(hour, minute); close(); }}>Done</button></div>
      </div>
    </PickerPanel>}
  </div>;
}

const SWATCHES = [
  ["Chalk", "#eeeae0"], ["Sand", "#cab994"], ["Camel", "#a79068"], ["Cocoa", "#745745"], ["Ink", "#303932"], ["Black", "#252525"],
  ["Sage", "#96a58a"], ["Olive", "#778166"], ["Forest", "#3f6250"], ["Sky", "#aec4cc"], ["Denim", "#648496"], ["Navy", "#3d4f66"],
  ["Blush", "#d6b4ad"], ["Clay", "#b97b65"], ["Rust", "#995541"], ["Plum", "#7c6278"], ["Lilac", "#aaa2ba"], ["Saffron", "#d4b461"],
] as const;
export function ColorPicker({ value, onChange, ...props }: ControlProps & { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const anchor = useRef<HTMLButtonElement>(null);
  const close = useCallback((restore = true) => { setOpen(false); if (restore) anchor.current?.focus({ preventScroll: true }); }, []);
  const label = SWATCHES.find(([, color]) => color === value)?.[0] || value;
  return <div className="ew-picker-control">
    <button {...props} ref={anchor} type="button" className="ew-picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setHex(value); setOpen(!open); }}><i className="ew-color-swatch" style={{ background: value }} /><span>{label}</span><Icon name="down" size={14} /></button>
    {open && <PickerPanel anchor={anchor} onClose={close} label="Choose a colour" width={280}>
      <div className="ew-color-picker"><strong>A colour for your piece</strong><div className="ew-swatches">{SWATCHES.map(([name, color]) => <button key={color} type="button" aria-label={name} aria-pressed={value === color} title={name} style={{ background: color }} onClick={() => { onChange(color); close(); }}>{value === color && <Icon name="check" size={17} />}</button>)}</div>
        <label className="ew-hex-field"><span>Custom hex</span><input aria-label="Custom hex colour" value={hex} maxLength={7} spellCheck={false} placeholder="#a79e87" onChange={e => setHex(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (/^#[0-9a-f]{6}$/i.test(hex)) { onChange(hex.toLowerCase()); close(); } } }} /><button type="button" disabled={!/^#[0-9a-f]{6}$/i.test(hex)} onClick={() => { onChange(hex.toLowerCase()); close(); }}>Use</button></label>
      </div>
    </PickerPanel>}
  </div>;
}
