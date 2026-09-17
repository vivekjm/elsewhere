"use client";
import React from "react";
import type { Activity } from "@/lib/model";
import { money } from "@/lib/planning";
import type { ScreenProps } from "./views";
import { Icon, IconButton } from "./primitives";
import { activityIcon } from "./icons";
export function ActivityCard({
  a,
  props,
  conflict,
}: {
  a: Activity;
  props: ScreenProps;
  conflict?: boolean;
}) {
  const { w, trip, open, remove, change } = props;
  return (
    <article className={`ew-activity ${a.completed ? "ew-completed" : ""}`}>
      <span
        className={`ew-activity-icon ew-type-${a.category.replaceAll(/[^a-z]/gi, "").toLowerCase()}`}
      >
        <Icon name={activityIcon(a.category)} size={15} />
      </span>
      <div className="ew-activity-body">
        <span className="ew-activity-time">
          {a.time || "All day"}
          {a.endTime ? ` – ${a.endTime}` : ""}
          <i>·</i>
          {a.category}
        </span>
        <button
          className="ew-activity-title"
          onClick={() => open({ kind: "activity", id: a.id, date: a.date })}
        >
          {a.title}
        </button>
        {a.place && (
          <a
            className="ew-place"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.place)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="location" size={12} />
            {a.place}
            <Icon name="external" size={11} />
          </a>
        )}
        {a.cost > 0 && (
          <span className="ew-small">{money(a.cost, trip?.currency)}</span>
        )}
        {a.outfitId && (
          <span className="ew-activity-outfit">
            <Icon name="hanger" size={13} />
            {w.outfits.find((o) => o.id === a.outfitId)?.name}
          </span>
        )}
        {a.notes && <p className="ew-activity-notes">{a.notes}</p>}
        {a.link && (
          <a
            className="ew-text-link"
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Reference <Icon name="external" size={12} />
          </a>
        )}
        {conflict && (
          <span className="ew-overlap">
            <Icon name="warning" size={12} />
            Overlaps another plan
          </span>
        )}
        <div className="ew-activity-tools">
          <label className="ew-check-line">
            <input
              type="checkbox"
              checked={!!a.completed}
              onChange={(e) =>
                change((d) => {
                  const activity = d.trips
                    .find((t) => t.id === trip?.id)
                    ?.activities.find((i) => i.id === a.id);
                  if (activity) activity.completed = e.target.checked;
                })
              }
            />
            Done
          </label>
          <IconButton
            icon="trash"
            label={`Delete ${a.title}`}
            onClick={() => remove("activity", a.id)}
          />
        </div>
      </div>
      <IconButton
        icon="edit"
        label={`Edit ${a.title}`}
        onClick={() => open({ kind: "activity", id: a.id, date: a.date })}
      />
    </article>
  );
}
