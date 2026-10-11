import Foundation

/// Trip days are civil dates in the destination, independent of the phone's
/// current calendar and time zone. Fixed-format keys are only used on the wire.
enum TravelDates {
    /// A plan time as "HH:mm". Also reads "9:00 AM" / "9:00 pm", which older
    /// builds saved on 12-hour phones. nil when it isn't a time at all.
    static func clock(_ text: String) -> String? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let m = t.wholeMatch(of: /(\d{1,2}):(\d{2})/), let h = Int(m.1), let min = Int(m.2), (0...23).contains(h), (0...59).contains(min) {
            return String(format: "%02d:%02d", h, min)
        }
        if let m = t.wholeMatch(of: /(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?/), let h = Int(m.1), let min = Int(m.2),
           (1...12).contains(h), (0...59).contains(min) {
            let pm = m.3.lowercased() == "p"
            return String(format: "%02d:%02d", (h % 12) + (pm ? 12 : 0), min)
        }
        return nil
    }

    static func calendar(_ zone: TimeZone = .current) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar
    }

    static func key(_ date: Date, in zone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar(zone)
        formatter.timeZone = zone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func date(_ key: String, in zone: TimeZone = .current) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar(zone)
        formatter.timeZone = zone
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        guard let date = formatter.date(from: key), self.key(date, in: zone) == key else { return nil }
        return date
    }
}

extension Trip {
    /// Health logs and local filenames belong to the device, not account sync.
    var cloudCopy: Trip {
        var copy = self
        copy.coverFile = nil
        copy.adventure?.checkIns = []
        copy.adventure?.readiness = nil
        return copy
    }
    var timeZone: TimeZone { timeZoneID.flatMap(TimeZone.init(identifier:)) ?? .current }
    var calendar: Calendar { TravelDates.calendar(timeZone) }
    var civilStart: Date { startDayKey.flatMap { TravelDates.date($0, in: timeZone) } ?? start }
    func dayKey(_ index: Int) -> String { TravelDates.key(date(ofDay: index), in: timeZone) }

    /// Reinterpret the same civil departure day when changing destination zone.
    mutating func setTimeZone(_ identifier: String) {
        let key = dayKey(0)
        timeZoneID = identifier
        startDayKey = key
        start = TravelDates.date(key, in: timeZone) ?? start
    }
}
