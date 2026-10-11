import ActivityKit
import Foundation

/// Live Activity for a flight or a trail day (C13, A8). Shared by the app,
/// which starts it, and the widget extension, which draws it.
nonisolated struct TripActivityAttributes: ActivityAttributes {
    enum Kind: String, Codable, Hashable, Sendable {
        case flight, trail
    }

    struct Metric: Codable, Hashable, Sendable {
        var label: String
        var value: String
    }

    struct ContentState: Codable, Hashable, Sendable {
        /// "TP 1321 → Lisbon" or "Pheriche → Lobuche"
        var headline: String
        /// "On time" or "Day 7"
        var status: String
        var statusIsAlert = false
        /// Three columns: boards / gate / seat, or to camp / climb / sleep.
        var metrics: [Metric]
        var progress: Double
        var footnote: String?
        /// Dynamic Island compact text.
        var islandLeading: String
        var islandTrailing: String
    }

    var kind: Kind
    var tripName: String
    /// So the app can update or end it later; nil on activities from older builds.
    var tripID: UUID?
}
