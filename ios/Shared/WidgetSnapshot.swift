import Foundation

/// What the home-screen widget shows: the next or current trip and its
/// remaining plans. Written by the app into the shared App Group.
nonisolated struct WidgetSnapshot: Codable, Equatable, Sendable {
    struct Plan: Codable, Equatable, Sendable {
        var title: String
        var start: Date
    }

    var tripName: String
    var place: String
    /// Midnight of the first and last day, at the destination.
    var firstDay: Date
    var lastDay: Date
    var timeZoneID: String
    var packed: Int
    var packingTotal: Int
    /// Remaining timed plans, soonest first.
    var plans: [Plan]

    static let appGroup = "group.com.tripsloom.ios"
    private static let key = "widget.nextTrip"

    private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    static func load() -> WidgetSnapshot? {
        defaults?.data(forKey: key).flatMap { try? JSONDecoder().decode(WidgetSnapshot.self, from: $0) }
    }

    /// Saves it and says whether anything changed.
    @discardableResult
    static func store(_ snapshot: WidgetSnapshot?) -> Bool {
        guard let defaults else { return false }
        guard snapshot != load() else { return false }
        if let snapshot, let data = try? JSONEncoder().encode(snapshot) { defaults.set(data, forKey: key) } else { defaults.removeObject(forKey: key) }
        return true
    }

    var timeZone: TimeZone { TimeZone(identifier: timeZoneID) ?? .current }

    var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    /// "In 4 days", "Tomorrow", "Day 2 of 5", or "Trip complete".
    func status(at date: Date) -> String {
        let today = calendar.startOfDay(for: date)
        let total = (calendar.dateComponents([.day], from: firstDay, to: lastDay).day ?? 0) + 1
        if today < firstDay {
            let days = calendar.dateComponents([.day], from: today, to: firstDay).day ?? 0
            return days == 1 ? "Tomorrow" : "In \(days) days"
        }
        if today > lastDay { return "Trip complete" }
        let day = (calendar.dateComponents([.day], from: firstDay, to: today).day ?? 0) + 1
        return "Day \(day) of \(total)"
    }

    func upcoming(after date: Date) -> [Plan] { plans.filter { $0.start > date.addingTimeInterval(-30 * 60) } }
}
