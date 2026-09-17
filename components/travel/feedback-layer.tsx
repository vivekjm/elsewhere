"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
  return () => observer.disconnect();
}
function activeDialog() {
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  return dialogs.item(dialogs.length - 1)?.querySelector<HTMLDivElement>(".ew-dialog-feedback") || null;
}
const serverDialog = () => null;

/** Keep notices and Undo in the active dialog's focus scope, not the inert page. */
export function FeedbackLayer({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, activeDialog, serverDialog);
  return target ? createPortal(children, target) : children;
}
