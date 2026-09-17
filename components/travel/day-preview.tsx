"use client";
import React from "react";
import { tripDates } from "@/lib/model";
import { dateLabel, daySnapshot, overlaps } from "@/lib/planning";
import type { ScreenProps } from "./views";
import { Button, Icon, IconButton, Modal, OutfitArt, Piece } from "./primitives";
import { activityIcon } from "./icons";
import { Landscape } from "./landscape";
import { ActivityCard } from "./activity-card";

function QuickAdd({ props }: { props: ScreenProps }) {
  const { day, open } = props;
  return <div className="ew-day-quick-add" aria-label="Add to this day">
    <button type="button" onClick={() => open({ kind: "activity", date: day })}><Icon name="plus" size={16} />Plan</button>
    <button type="button" onClick={() => open({ kind: "day", date: day, section: "outfits" })}><Icon name="hanger" size={16} />Outfit</button>
    <button type="button" onClick={() => open({ kind: "day", date: day, section: "gear" })}><Icon name="bag" size={16} />Essentials</button>
  </div>;
}
function DayNavigation({ props }: { props: ScreenProps }) {
  const { trip, day, selectDay } = props;
  if (!trip) return null;
  const dates = tripDates(trip), index = dates.indexOf(day);
  return <div className="ew-day-navigation"><IconButton label="Previous day" icon="left" disabled={index <= 0} onClick={() => selectDay(dates[index - 1])} /><span>Day <b>{index + 1}</b> of {dates.length}</span><IconButton label="Next day" icon="right" disabled={index === dates.length - 1} onClick={() => selectDay(dates[index + 1])} /></div>;
}
export function DaySummary({ props, onExpand }: { props: ScreenProps; onExpand: () => void }) {
  const { w, trip, day, open } = props;
  if (!trip) return null;
  const snapshot = daySnapshot(w, trip, day);
  return <aside className="ew-day-panel ew-day-summary" aria-label="Selected day">
    <DayNavigation props={props} />
    <div className="ew-day-summary-heading"><div><h2>{dateLabel(day, { weekday: "long", day: "numeric", month: "short" })}</h2>{snapshot.title && <p>{snapshot.title}</p>}</div><IconButton label="Edit day details" icon="edit" onClick={() => open({ kind: "day", date: day })} /></div>
    <QuickAdd props={props} />
    <div key={day} className="ew-day-summary-content ew-enter">
      <div className="ew-summary-plans"><h3>The plan <small>{snapshot.activities.length}</small></h3>{snapshot.activities.slice(0, 3).map(a => <button type="button" key={a.id} onClick={onExpand} className="ew-summary-plan"><span className={`ew-activity-icon ew-type-${a.category.replaceAll(/[^a-z]/gi, "").toLowerCase()}`}><Icon name={activityIcon(a.category)} size={15} /></span><span><small>{a.time || "All day"}</small><strong>{a.title}</strong>{a.place && <span>{a.place}</span>}</span><Icon name="right" size={12} /></button>)}
        {!snapshot.activities.length && <button type="button" className="ew-empty-tile" onClick={() => open({ kind: "activity", date: day })}><Icon name="compass" size={24} /><span>A place to go, a thing to do.</span><Icon name="plus" size={16} /></button>}
        {snapshot.activities.length > 3 && <button type="button" className="ew-summary-more" onClick={onExpand}>+{snapshot.activities.length - 3} more plans</button>}
      </div>
      <div className="ew-summary-looks"><h3>What to wear <small>{snapshot.outfits.length}</small></h3><div className="ew-preview-looks">{snapshot.outfits.slice(0, 2).map(o => <button type="button" key={o.id} onClick={onExpand}><OutfitArt w={w} outfit={o} /><strong>{o.name}</strong><small>{o.occasion || `${o.items.length} pieces`}</small></button>)}</div>
        {!snapshot.outfits.length && <button type="button" className="ew-empty-tile" onClick={() => open({ kind: "day", date: day, section: "outfits" })}><Icon name="hanger" size={24} /><span>Choose a look</span><Icon name="plus" size={16} /></button>}
      </div>
      {!!snapshot.gear.length && <div className="ew-summary-essentials"><h3>Bring along</h3><div className="ew-day-gear">{snapshot.gear.slice(0, 4).map(item => <button type="button" key={item.id} onClick={onExpand}><Piece item={item} /><span>{item.name}</span></button>)}</div></div>}
      {snapshot.stay && <button type="button" className="ew-summary-stay" onClick={onExpand}><Icon name="stay" size={16} /><span>{snapshot.stay}</span><Icon name="right" size={12} /></button>}
      {snapshot.notes && <button type="button" className="ew-summary-note" onClick={onExpand}><Icon name="note" size={14} /><span>{snapshot.notes}</span></button>}
    </div>
    <Button className="ew-open-day" variant="primary" onClick={onExpand}>View full day<Icon name="arrow" size={15} /></Button>
  </aside>;
}

export function DayPreview({ props, onDismiss }: { props: ScreenProps; onDismiss: () => void }) {
  const { w, trip, day, open } = props;
  if (!trip) return null;
  const dates = tripDates(trip), snapshot = daySnapshot(w, trip, day), conflicts = overlaps(snapshot.activities);
  return <Modal className="ew-day-dialog" title={dateLabel(day, { weekday: "long", day: "numeric", month: "long" })} eyebrow={`DAY ${dates.indexOf(day) + 1} / ${dates.length}`} onDismiss={onDismiss} wide>
    <div className="ew-day-preview-toolbar"><DayNavigation props={props} /><Button variant="quiet" icon="edit" onClick={() => open({ kind: "day", date: day })}>Edit day</Button></div>
    <div className={`ew-day-scene ew-mood-${trip.theme || "mountains"}`}><Landscape theme={trip.theme || "mountains"} /><div><span>{trip.destination}</span><h3>{snapshot.title || "A little room for adventure."}</h3></div></div>
    <QuickAdd props={props} />
    <div key={day} className="ew-day-preview-body ew-enter">
      <section className="ew-preview-timeline" aria-label="Day timeline"><div className="ew-section-heading"><h3>The plan <span>{snapshot.activities.length}</span></h3><Button variant="quiet" icon="plus" onClick={() => open({ kind: "activity", date: day })}>Add</Button></div>
        {snapshot.activities.map(a => <ActivityCard key={a.id} a={a} props={props} conflict={conflicts.has(a.id)} />)}
        {!snapshot.activities.length && <button type="button" className="ew-empty-tile ew-empty-tile-tall" onClick={() => open({ kind: "activity", date: day })}><Icon name="compass" size={30} /><strong>Leave room for something good.</strong><span>Add your first plan <Icon name="plus" size={14} /></span></button>}
        <button type="button" className="ew-preview-stay" onClick={() => open({ kind: "day", date: day, section: "details" })}><Icon name="stay" size={20} /><span><small>STAYING AT</small><strong>{snapshot.stay || "Add a place to stay"}</strong></span><Icon name={snapshot.stay ? "edit" : "plus"} size={14} /></button>
        <button type="button" className="ew-preview-note" onClick={() => open({ kind: "day", date: day, section: "details" })}><Icon name="note" size={18} /><span><strong>{snapshot.notes ? "A note for the day" : "Add a little reminder"}</strong>{snapshot.notes && <span>{snapshot.notes}</span>}</span><Icon name={snapshot.notes ? "edit" : "plus"} size={14} /></button>
      </section>
      <section className="ew-preview-wardrobe" aria-label="Outfits and essentials"><div className="ew-section-heading"><h3>What to wear <span>{snapshot.outfits.length}</span></h3><Button variant="quiet" onClick={() => open({ kind: "day", date: day, section: "outfits" })}>{snapshot.outfits.length ? "Change" : "Add"}</Button></div>
        <div className="ew-preview-looks">{snapshot.outfits.map(o => <button type="button" key={o.id} onClick={() => open({ kind: "outfit", id: o.id })} aria-label={`Edit outfit ${o.name}`}><OutfitArt w={w} outfit={o} /><strong>{o.name}</strong><small>{o.occasion || "Everyday"} · {o.items.length} pieces</small></button>)}</div>
        {!snapshot.outfits.length && <button type="button" className="ew-empty-tile ew-empty-tile-tall" onClick={() => open({ kind: "day", date: day, section: "outfits" })}><Icon name="hanger" size={34} /><strong>A look for the day.</strong><span>Choose an outfit <Icon name="plus" size={14} /></span></button>}
        <div className="ew-section-heading"><h3>Bring along <span>{snapshot.gear.length}</span></h3><Button variant="quiet" onClick={() => open({ kind: "day", date: day, section: "gear" })}>{snapshot.gear.length ? "Change" : "Add"}</Button></div>
        {snapshot.gear.length ? <div className="ew-preview-gear">{snapshot.gear.map(item => <button type="button" key={item.id} onClick={() => open({ kind: "item", id: item.id })}><Piece item={item} /><span>{item.name}</span></button>)}</div> : <button type="button" className="ew-empty-tile" onClick={() => open({ kind: "day", date: day, section: "gear" })}><Icon name="bag" size={22} /><span>A camera, a layer, your essentials.</span><Icon name="plus" size={15} /></button>}
      </section>
    </div>
  </Modal>;
}
