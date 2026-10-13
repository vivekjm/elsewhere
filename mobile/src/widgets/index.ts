/** Platforms without widgets (web). */
import type { NextTripProps, TripDayProps } from './snapshot';

export function publishWidgets(_timeline: { date: Date; props: NextTripProps }[]) {}
export async function syncLiveActivity(_props: TripDayProps | null) {}
export const widgetsSupported = false;
