"use client";
import { useState, useEffect, useRef } from "react";
import { workspaceSchema, type Workspace } from "@/lib/model";
export function useWorkspace(onLoaded: (w: Workspace) => void) {
  const [w, setW] = useState<Workspace | null>(null),
    [status, setStatus] = useState("Loading workspace…"),
    [loadError, setLoadError] = useState("");
  const latest = useRef<Workspace | null>(null),
    revision = useRef(0),
    generation = useRef(0),
    saved = useRef(0),
    busy = useRef(false),
    blocked = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    restoreInput = useRef<HTMLInputElement>(null);
  async function load() {
    setLoadError("");
    setStatus("Loading workspace…");
    try {
      const r = await fetch("/api/workspace"),
        d = (await r.json()) as {
          error?: string;
          workspace: unknown;
          revision: number;
          url: string;
        };
      if (!r.ok) throw Error(d.error);
      const data = workspaceSchema.parse(d.workspace);
      latest.current = data;
      revision.current = d.revision;
      generation.current = 0;
      saved.current = 0;
      blocked.current = false;
      setW(data);
      onLoaded(data);
      setStatus("All changes saved");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load workspace");
      setStatus("Workspace unavailable");
    }
  }
  async function flush() {
    if (
      busy.current ||
      blocked.current ||
      !latest.current ||
      generation.current === saved.current
    )
      return;
    busy.current = true;
    setStatus("Saving…");
    const g = generation.current,
      data = latest.current;
    try {
      const r = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace: data, revision: revision.current }),
        }),
        d = (await r.json()) as {
          error?: string;
          workspace: unknown;
          revision: number;
          url: string;
        };
      if (!r.ok) {
        if (r.status === 409) blocked.current = true;
        throw Error(d.error || "Save failed");
      }
      revision.current = d.revision;
      saved.current = g;
      setStatus(generation.current === g ? "All changes saved" : "Saving…");
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Couldn’t save. Retry when you’re online.",
      );
    } finally {
      busy.current = false;
      if (!blocked.current && saved.current === g && generation.current !== g)
        void flush();
    }
  }
  function change(fn: (d: Workspace) => void) {
    if (!latest.current) return;
    const next = structuredClone(latest.current);
    fn(next);
    latest.current = next;
    setW(next);
    generation.current++;
    setStatus("Unsaved changes");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 450);
  }
  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (saved.current !== generation.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("online", online);
    };
  }, []);
  return { w, status, loadError, latest, load, flush, change };
}
