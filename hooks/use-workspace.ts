"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceSchema, type Workspace } from "@/lib/model";
export type SaveState =
  | "loading"
  | "saved"
  | "pending"
  | "saving"
  | "error"
  | "conflict";
/** Serialised optimistic writes. A failed or conflicting PUT never discards local edits. */
export function useWorkspace(
  onLoaded: (w: Workspace) => void,
  accessToken?: string | null,
) {
  const [w, setW] = useState<Workspace | null>(null),
    [state, setState] = useState<SaveState>("loading"),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [dirty, setDirty] = useState(false);
  const latest = useRef<Workspace | null>(null),
    revision = useRef(0),
    generation = useRef(0),
    saved = useRef(0),
    blocked = useRef(false),
    callback = useRef(onLoaded),
    alive = useRef(false),
    epoch = useRef(0);
  const flight = useRef<Promise<void> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    aborters = useRef(new Set<AbortController>()),
    accessTokenRef = useRef(accessToken || "");
  useEffect(() => {
    accessTokenRef.current = accessToken || "";
  }, [accessToken]);
  useEffect(() => {
    callback.current = onLoaded;
  }, [onLoaded]);
  const request = useCallback(async (method = "GET", body?: string) => {
    const controller = new AbortController();
    aborters.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const requestHeaders: Record<string, string> = body
        ? { "Content-Type": "application/json" }
        : {};
      if (accessTokenRef.current)
        requestHeaders.Authorization = `Bearer ${accessTokenRef.current}`;
      const r = await fetch("/api/workspace", {
        method,
        credentials: "same-origin",
        headers: requestHeaders,
        body,
        signal: controller.signal,
      });
      const data = (await r.json().catch(() => ({}))) as {
        workspace?: unknown;
        revision?: number;
        error?: string;
      };
      if (!r.ok) {
        const e = new Error(
          data.error || `Workspace request failed (${r.status}).`,
        ) as Error & { status: number };
        e.status = r.status;
        throw e;
      }
      if (!Number.isSafeInteger(data.revision) || (data.revision ?? -1) < 0)
        throw new Error("The server returned an invalid workspace revision.");
      return data;
    } finally {
      clearTimeout(timeout);
      aborters.current.delete(controller);
    }
  }, []);
  const load = useCallback(async () => {
    if (flight.current) return;
    const token = ++epoch.current;
    if (timer.current) clearTimeout(timer.current);
    try {
      const data = await request(),
        next = workspaceSchema.parse(data.workspace);
      if (!alive.current || token !== epoch.current) return;
      latest.current = next;
      revision.current = data.revision!;
      generation.current = 0;
      saved.current = 0;
      blocked.current = false;
      setW(next);
      setLoadError("");
      setError("");
      setState("saved");
      setDirty(false);
      callback.current(next);
    } catch (e) {
      if (!alive.current || token !== epoch.current) return;
      const message =
        e instanceof Error ? e.message : "Could not load the workspace.";
      setLoadError(message);
      setError(message);
      setState("error");
    }
  }, [request]);
  const flush = useCallback(async () => {
    if (flight.current) return flight.current;
    if (
      blocked.current ||
      !latest.current ||
      saved.current === generation.current
    )
      return;
    flight.current = (async () => {
      while (
        alive.current &&
        !blocked.current &&
        saved.current !== generation.current &&
        latest.current
      ) {
        const g = generation.current,
          token = epoch.current,
          snapshot = latest.current;
        setState("saving");
        setError("");
        try {
          const data = await request(
            "PUT",
            JSON.stringify({ workspace: snapshot, revision: revision.current }),
          );
          if (!alive.current || token !== epoch.current) return;
          revision.current = data.revision!;
          saved.current = g;
          setState(saved.current === generation.current ? "saved" : "pending");
          setDirty(saved.current !== generation.current);
        } catch (e) {
          if (!alive.current || token !== epoch.current) return;
          blocked.current = (e as Error & { status?: number }).status === 409;
          setState(blocked.current ? "conflict" : "error");
          setError(
            blocked.current
              ? "Another tab saved newer changes. Back up your edits, then reload the server version."
              : "Your edits are still here, but the save failed. Check your connection and retry.",
          );
          return;
        }
      }
    })().finally(() => {
      flight.current = null;
    });
    return flight.current;
  }, [request]);
  const change = useCallback(
    (fn: (draft: Workspace) => void) => {
      if (!latest.current) throw new Error("The workspace is still loading.");
      if (blocked.current)
        throw new Error(
          "Resolve the save conflict before making more changes.",
        );
      const draft = structuredClone(latest.current);
      fn(draft);
      const next = workspaceSchema.parse(draft);
      if (
        new TextEncoder().encode(
          JSON.stringify({ workspace: next, revision: revision.current }),
        ).length > 1490000
      )
        throw new Error(
          "This workspace is full. Export a backup before removing old trips.",
        );
      latest.current = next;
      generation.current++;
      setW(next);
      setDirty(true);
      setState("pending");
      setError("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 400);
    },
    [flush],
  );
  const reload = useCallback(async () => {
    if (flight.current) {
      setError("Wait for the current save before reloading.");
      return;
    }
    setLoadError("");
    setState("loading");
    await load();
  }, [load]);
  const dispose = useCallback(() => {
    alive.current = false;
    epoch.current++;
    if (timer.current) clearTimeout(timer.current);
    aborters.current.forEach((controller) => controller.abort());
  }, []);
  useEffect(() => {
    alive.current = true;
    // A cancellable startup task avoids duplicate guest initialization in Strict Mode.
    const initialLoad = setTimeout(() => {
      void load();
    }, 0);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (generation.current !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const online = () => {
      void flush();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(initialLoad);
      dispose();
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load, flush, dispose]);
  const status = (
    {
      loading: "Loading workspace…",
      saved: "All changes saved",
      pending: "Unsaved changes",
      saving: "Saving…",
      error: "Save needs attention",
      conflict: "Save conflict",
    } as const
  )[state];
  return {
    w,
    state,
    status,
    error,
    loadError,
    latest,
    load: reload,
    flush,
    change,
    dirty,
  };
}
