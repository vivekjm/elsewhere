/** A screen to open once Home appears, set when onboarding finishes (e.g. "/planner"). */
let pending: string | null = null;
export function setPendingLanding(route: string | null) { pending = route; }
export function takePendingLanding(): string | null { const r = pending; pending = null; return r; }
