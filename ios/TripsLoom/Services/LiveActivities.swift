import ActivityKit
import Foundation

/// Starts the flight and trail Live Activities (C13, A8).
enum LiveActivities {
    enum Failure: LocalizedError {
        case disabled
        var errorDescription: String? { "Live Activities are turned off for Trips Loom in Settings." }
    }

    static var isRunning: Bool { !Activity<TripActivityAttributes>.activities.isEmpty }

    static func startFlight(_ flight: FlightInfo, plan: Plan, trip: Trip) throws {
        let boardDate = boardingDate(flight, plan: plan, trip: trip)
        let hours = boardDate.timeIntervalSinceNow / 3600
        let state = TripActivityAttributes.ContentState(
            headline: "\(flight.number) → \(flight.destination)",
            status: flight.status,
            statusIsAlert: flight.status.lowercased() != "on time",
            metrics: [.init(label: "Boards", value: flight.boards), .init(label: "Gate", value: flight.gate), .init(label: "Seat", value: flight.seat)],
            progress: max(0.05, min(1, 1 - hours / 24)),
            footnote: nil,
            islandLeading: flight.boards,
            islandTrailing: "Gate \(flight.gate)"
        )
        try start(kind: .flight, trip: trip, state: state, staleDate: boardDate.addingTimeInterval(3 * 3600))
    }

    static func startTrail(trip: Trip) throws {
        guard let state = trailState(trip) else { return }
        try start(kind: .trail, trip: trip, state: state, staleDate: trailStaleDate(trip))
    }

    /// Today's stage, with progress through the route.
    private static func trailState(_ trip: Trip) -> TripActivityAttributes.ContentState? {
        guard !trip.stages.isEmpty else { return nil }
        let index = trip.currentStageIndex
        let stage = trip.stages[index]
        let from = index > 0 ? trip.stages[index - 1].altitude : stage.altitude
        return TripActivityAttributes.ContentState(
            headline: stage.title,
            status: "Day \(stage.day)",
            metrics: [
                .init(label: "To camp", value: Fmt.distance(stage.km).replacingOccurrences(of: " ", with: "")),
                .init(label: "Climb", value: stage.ascent > 0 ? "↑\(stage.ascent)" : "–"),
                .init(label: "Sleep", value: Fmt.grouped(stage.altitude)),
            ],
            progress: max(0.02, Double(index) / Double(max(trip.stages.count, 1))),
            footnote: trip.adventure.map { "Check-in \($0.nextCheckIn)" },
            islandLeading: "\(Fmt.grouped(max(from, stage.altitude))) M",
            islandTrailing: Fmt.distance(stage.km).uppercased()
        )
    }

    /// The end of today at the destination.
    private static func trailStaleDate(_ trip: Trip) -> Date {
        trip.calendar.date(byAdding: .day, value: 1, to: trip.calendar.startOfDay(for: .now)) ?? .now.addingTimeInterval(86_400)
    }

    /// When the app comes to the front: moves trail activities on to today's
    /// stage, and ends ones whose trip is over or gone, or whose flight has left.
    @MainActor
    static func refresh(trips: [Trip]) async {
        for activity in Activity<TripActivityAttributes>.activities {
            let trip = activity.attributes.tripID.flatMap { id in trips.first { $0.id == id } }
            switch activity.attributes.kind {
            case .flight:
                // Ends once the flight has left, or when its trip was deleted
                // or signed out of this phone.
                let departed = activity.content.staleDate.map { $0 < .now } ?? false
                if departed || trip == nil { await activity.end(nil, dismissalPolicy: .immediate) }
            case .trail:
                guard let trip, trip.status != .past, let state = trailState(trip) else {
                    await activity.end(nil, dismissalPolicy: .immediate)
                    continue
                }
                if state != activity.content.state {
                    await activity.update(.init(state: state, staleDate: trailStaleDate(trip)))
                }
            }
        }
    }

    static func endAll() async {
        for activity in Activity<TripActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    private static func start(kind: TripActivityAttributes.Kind, trip: Trip, state: TripActivityAttributes.ContentState, staleDate: Date) throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw Failure.disabled }
        let attributes = TripActivityAttributes(kind: kind, tripName: trip.name, tripID: trip.id)
        let keep = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: staleDate)).id
        // One per trip and kind: showing it again replaces the old one.
        let tripID = trip.id, name = trip.name
        Task {
            for old in Activity<TripActivityAttributes>.activities where old.id != keep && old.attributes.kind == kind
                && (old.attributes.tripID == tripID || (old.attributes.tripID == nil && old.attributes.tripName == name)) {
                await old.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    private static func boardingDate(_ flight: FlightInfo, plan: Plan, trip: Trip) -> Date {
        let parts = flight.boards.split(separator: ":").compactMap { Int($0) }
        let day = trip.date(ofDay: plan.day)
        guard parts.count == 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]) else { return day }
        // Boarding time is local to the departure, like the rest of the trip.
        return trip.calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day) ?? day
    }
}
