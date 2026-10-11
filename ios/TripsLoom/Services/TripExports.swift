import Foundation

/// Calendar files work offline, without requesting access to the user's calendar.
enum TripExports {
    static func calendar(_ trip: Trip) -> String {
        var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trips Loom//Travel plans//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
        let stamp = utc(.now)
        let end = trip.calendar.date(byAdding: .day, value: 1, to: trip.end) ?? trip.end
        lines += ["BEGIN:VEVENT", "UID:trip-\(trip.id.uuidString)@tripsloom.com", "DTSTAMP:\(stamp)",
                  "DTSTART;VALUE=DATE:\(trip.dayKey(0).replacingOccurrences(of: "-", with: ""))",
                  "DTEND;VALUE=DATE:\(TravelDates.key(end, in: trip.timeZone).replacingOccurrences(of: "-", with: ""))",
                  "SUMMARY:\(escape(trip.name))", "LOCATION:\(escape(trip.place))", "END:VEVENT"]
        for plan in trip.plans {
            guard let start = trip.startDate(of: plan), let end = trip.calendar.date(byAdding: .hour, value: 1, to: start) else { continue }
            lines += ["BEGIN:VEVENT", "UID:plan-\(plan.id.uuidString)@tripsloom.com", "DTSTAMP:\(stamp)",
                      "DTSTART:\(utc(start))", "DTEND:\(utc(end))", "SUMMARY:\(escape(plan.title))",
                      "LOCATION:\(escape(plan.meta))", "DESCRIPTION:\(escape(plan.notes))", "END:VEVENT"]
        }
        lines.append("END:VCALENDAR")
        return lines.map(fold).joined(separator: "\r\n") + "\r\n"
    }

    /// A temporary file people will see by name when they share or save it
    /// ("Goa with friends.ics"); its own folder keeps the name unique.
    static func exportURL(named name: String, ext: String) throws -> URL {
        let folder = URL.temporaryDirectory.appending(path: "export-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let safe = name.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>")).joined(separator: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines).prefix(80)
        return folder.appending(path: "\(safe.isEmpty ? "Trips Loom" : String(safe)).\(ext)")
    }

    static func calendarFile(_ trip: Trip) throws -> URL {
        let file = try exportURL(named: trip.name, ext: "ics")
        try Data(calendar(trip).utf8).write(to: file, options: [.atomic, .completeFileProtection])
        return file
    }

    private static func utc(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = TravelDates.calendar(TimeZone(secondsFromGMT: 0)!)
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
        return f.string(from: date)
    }

    static func escape(_ value: String) -> String {
        value.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: "\n", with: "\\n").replacingOccurrences(of: ";", with: "\\;")
            .replacingOccurrences(of: ",", with: "\\,")
    }

    /// RFC 5545: fold at 75 UTF-8 octets without splitting a scalar.
    static func fold(_ line: String) -> String {
        var result = "", length = 0
        for scalar in line.unicodeScalars {
            let text = String(scalar), size = text.utf8.count
            if length + size > 75 { result += "\r\n "; length = 1 }
            result += text
            length += size
        }
        return result
    }
}
