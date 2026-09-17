"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { MOODS, type Mood } from "@/lib/model";
import { Landscape } from "./landscape";
import { Icon } from "./icons";
import { PickerPanel } from "./pickers";

export const MOOD_LABELS: Record<Mood, string> = {
  mountains: "Quiet mountains", coast: "By the coast", city: "City wandering", forest: "Into the forest",
  desert: "Desert days", snow: "Snow & silence", sunset: "Golden hour", night: "Under the stars",
};
export function MoodPicker({ value, onChange, onCommit }: { value: Mood; onChange: (value: Mood) => void; onCommit?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div className="ew-mood-grid" role="radiogroup" aria-label="Cover mood" ref={ref} onKeyDown={e => {
    const index = MOODS.indexOf(value);
    const direction = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (direction || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const next = e.key === "Home" ? 0 : e.key === "End" ? MOODS.length - 1 : (index + direction + MOODS.length) % MOODS.length;
      onChange(MOODS[next]);
      ref.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
    }
  }}>{MOODS.map(mood => <button type="button" key={mood} role="radio" aria-checked={value === mood} tabIndex={value === mood ? 0 : -1} onClick={() => { onChange(mood); onCommit?.(); }}>
    <span className="ew-mood-art"><Landscape theme={mood} animated={false} />{value === mood && <i><Icon name="check" size={13} /></i>}</span><span>{MOOD_LABELS[mood]}</span>
  </button>)}</div>;
}
export function HeroMood({ value, onChange }: { value: Mood; onChange: (value: Mood) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const close = useCallback((restore = true) => { setOpen(false); if (restore) anchor.current?.focus({ preventScroll: true }); }, []);
  return <div className="ew-hero-mood">
    <button ref={anchor} type="button" onClick={() => setOpen(!open)} aria-label="Change cover mood" aria-expanded={open} aria-haspopup="dialog"><Icon name="leaf" size={14} /><span>{MOOD_LABELS[value]}</span><Icon name="down" size={12} /></button>
    {open && <PickerPanel anchor={anchor} onClose={close} label="Cover mood" width={380}><div className="ew-mood-popover"><div className="ew-picker-heading"><strong>Set the mood</strong><span>8 little escapes</span></div><MoodPicker value={value} onChange={onChange} onCommit={close} /></div></PickerPanel>}
  </div>;
}
export function MotionToggle() {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let value = document.documentElement.dataset.ewMotion === "paused";
    try { value = localStorage.getItem("elsewhere-motion") === "paused"; } catch { /* storage is optional */ }
    document.documentElement.dataset.ewMotion = value ? "paused" : "playing";
    // Keep the initial server-rendered tree deterministic; this is browser preference hydration.
    const frame = requestAnimationFrame(() => setPaused(value));
    return () => cancelAnimationFrame(frame);
  }, []);
  function toggle() {
    const next = !paused;
    setPaused(next);
    document.documentElement.dataset.ewMotion = next ? "paused" : "playing";
    try { localStorage.setItem("elsewhere-motion", next ? "paused" : "playing"); } catch { /* storage is optional */ }
  }
  return <button type="button" className="ew-motion-toggle" onClick={toggle} aria-label={paused ? "Resume animations" : "Pause animations"} aria-pressed={paused} title={paused ? "Resume animations" : "Pause animations"}>
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">{paused ? <path d="m5 3 8 5-8 5Z" fill="currentColor" /> : <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}</svg>
  </button>;
}
