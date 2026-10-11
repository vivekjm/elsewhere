import Foundation
import UserNotifications

/// Local notifications: the evening before each trip, and timed trail check-ins.
enum Reminders {
    private static let tripPrefix = "trip-"
    private static let checkInPrefix = "checkin-"

    /// Sample trips are there to explore the app; they never notify.
    static func remindable(_ trips: [Trip]) -> [Trip] { trips.filter { $0.isSample != true } }

    /// Reschedules "starts tomorrow" reminders. Returns a short status line.
    /// With `prompt` false, it only schedules if permission was already given.
    static func sync(enabled: Bool, trips: [Trip], prompt: Bool) async -> String? {
        let center = UNUserNotificationCenter.current()
        await removePending(prefix: tripPrefix)
        guard enabled else { return nil }
        guard await authorize(prompt: prompt) else { return "Allow notifications in Settings" }

        let capacity = remainingSlots(pendingCount: await center.pendingNotificationRequests().count)
        for trip in remindable(trips).filter({ $0.status == .upcoming }).sorted(by: { $0.start < $1.start }).prefix(min(30, capacity)) {
            guard let eve = trip.calendar.date(byAdding: .day, value: -1, to: trip.civilStart),
                  let fire = trip.calendar.date(bySettingHour: 18, minute: 0, second: 0, of: eve),
                  fire > .now
            else { continue }
            let content = UNMutableNotificationContent()
            content.title = "\(trip.name) starts tomorrow"
            let left = trip.packing.count - trip.packedCount
            content.body = left > 0 ? "\(left) items left to pack." : "You're packed. Have a good trip."
            content.sound = .default
            var components = trip.calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fire)
            components.timeZone = trip.timeZone
            let trigger = UNCalendarNotificationTrigger(
                dateMatching: components,
                repeats: false
            )
            try? await center.add(UNNotificationRequest(identifier: tripPrefix + trip.id.uuidString, content: content, trigger: trigger))
        }
        return "Evening before each trip"
    }

    /// Daily reminder at a check-in time ("16:00") while on the trail.
    static func scheduleCheckIn(enabled: Bool, time: String, trip: Trip, contacts: String, prompt: Bool) async -> Bool {
        let center = UNUserNotificationCenter.current()
        await removePending(prefix: checkInPrefix + trip.id.uuidString)
        guard enabled, trip.isSample != true else { return true }
        guard await authorize(prompt: prompt) else { return !prompt }

        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]) else { return false }
        let content = UNMutableNotificationContent()
        content.title = "Time to check in"
        content.body = contacts.isEmpty ? "Let someone know you're safe on \(trip.name)." : "Let \(contacts) know you're safe on \(trip.name)."
        content.sound = .default
        content.interruptionLevel = .timeSensitive
        // Finite reminders end with the trip, and use destination time even
        // when the device moves into another time zone.
        let capacity = remainingSlots(pendingCount: await center.pendingNotificationRequests().count)
        for (index, date) in checkInDates(time: time, trip: trip).prefix(min(30, capacity)).enumerated() {
            var components = trip.calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
            components.timeZone = trip.timeZone
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            do {
                try await center.add(UNNotificationRequest(identifier: checkInPrefix + trip.id.uuidString + "-\(index)", content: content, trigger: trigger))
            } catch { return false }
        }
        return true
    }

    static func checkInDates(time: String, trip: Trip, now: Date = .now) -> [Date] {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]) else { return [] }
        return trip.dayIndices.compactMap {
            trip.calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: trip.date(ofDay: $0))
        }.filter { $0 > now }
    }

    /// Leave room under iOS's pending-notification limit across every trip.
    static func remainingSlots(pendingCount: Int) -> Int { max(0, 60 - max(0, pendingCount)) }

    static func removeAllTripReminders() async {
        await removePending(prefix: tripPrefix)
        await removePending(prefix: checkInPrefix)
    }

    static func reconcile(enabled: Bool, trips: [Trip]) async {
        _ = await sync(enabled: enabled, trips: trips, prompt: false)
        await removePending(prefix: checkInPrefix)
        for trip in remindable(trips).sorted(by: { $0.civilStart < $1.civilStart }) where trip.status != .past && trip.adventure?.checkInReminders == true {
            _ = await scheduleCheckIn(enabled: true, time: trip.adventure?.nextCheckIn ?? "16:00", trip: trip, contacts: trip.adventure?.contacts ?? "", prompt: false)
        }
    }

    static var isAuthorized: Bool {
        get async {
            let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
            return status == .authorized || status == .provisional || status == .ephemeral
        }
    }

    private static func authorize(prompt: Bool) async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: return true
        case .denied: return false
        default:
            guard prompt else { return false }
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        }
    }

    private static func removePending(prefix: String) async {
        let center = UNUserNotificationCenter.current()
        let ids = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }
}
