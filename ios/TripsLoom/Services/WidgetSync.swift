import Foundation
import WidgetKit

/// Keeps the home-screen widget's snapshot in step with the trips.
@MainActor
enum WidgetSync {
    static func update(trips: [Trip], signedOut: Bool) {
        let candidates = signedOut ? [] : trips.filter { $0.status != .past }.sorted { $0.start < $1.start }
        // Your own trips before the samples.
        let trip = candidates.first { $0.isSample != true } ?? candidates.first
        let snapshot = trip.map { trip in
            let progress = trip.packingProgress
            return WidgetSnapshot(
                tripName: trip.name,
                place: trip.place,
                firstDay: trip.calendar.startOfDay(for: trip.date(ofDay: 0)),
                lastDay: trip.calendar.startOfDay(for: trip.end),
                timeZoneID: trip.timeZone.identifier,
                packed: progress.packed,
                packingTotal: progress.total,
                plans: trip.plans.compactMap { plan in trip.startDate(of: plan).map { WidgetSnapshot.Plan(title: plan.title, start: $0) } }
                    .filter { $0.start > .now.addingTimeInterval(-3600) }
                    .sorted { $0.start < $1.start }
                    .prefix(24)
                    .map { $0 }
            )
        }
        if WidgetSnapshot.store(snapshot) { WidgetCenter.shared.reloadAllTimelines() }
    }
}
