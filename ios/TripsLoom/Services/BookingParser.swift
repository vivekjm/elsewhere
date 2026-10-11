import Foundation

struct ParsedBooking: Identifiable, Hashable {
    var id = UUID()
    var category: PlanCategory
    var title: String
    var meta: String
    var date: Date?
    var time: String?
    var flight: FlightInfo?
}

/// Pulls flights, stays and bookings out of confirmation text (pasted or
/// scanned). It looks for flight numbers, booking references, check-in words,
/// dates and times.
enum BookingParser {
    static func parse(_ text: String) -> [ParsedBooking] {
        // Clipboard and OCR input are untrusted and can be very large.
        guard text.utf8.count <= 100_000 else { return [] }
        let cleaned = text.replacingOccurrences(of: "\r", with: "\n")
        guard !cleaned.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
        let lower = cleaned.lowercased()
        let dates = detectDates(in: cleaned)
        // Codes are upper case or digits ("K7XQ2P", "4829301", a 10-digit
        // IRCTC PNR); the label may be any case.
        let reference = cleaned.firstMatch(of: /(?:[Pp][Nn][Rr](?: [Nn]o\.?)?|[Bb]ooking [Rr]ef(?:erence)?|[Bb]ooking [Ii][Dd]|[Cc]onfirmation(?: [Nn]umber| [Cc]ode| [Nn]o\.?)?|[Rr]eservation(?: [Nn]umber)?|[Tt]icket [Nn]o\.?)[:\s#]*([A-Z0-9]{5,10})\b/).map { String($0.1) }
        var results: [ParsedBooking] = []

        // Trains (IRCTC and others): number/name, stations, PNR, coach/berth.
        if lower.contains("irctc") || lower.contains("train no") || lower.contains("train name") || lower.contains("e-ticket") && lower.contains("berth") {
            let train = cleaned.firstMatch(of: /(?i)train\s*(?:no\.?)?\s*(?:\/\s*name)?\s*[:\s]*(\d{4,5})\s*[\/\-]?\s*([A-Za-z][A-Za-z .]+)?/)
            let number = train.map { String($0.1) }
            let name = train.flatMap { $0.2 }.map { String($0).trimmingCharacters(in: .whitespaces).capitalized }
            let codes = cleaned.matches(of: /\(([A-Z]{2,5})\)/).map { String($0.1) }
            let route = codes.count >= 2 ? "\(codes[0]) → \(codes[1])" : nil
            let berth = cleaned.firstMatch(of: /(?i)coach\s*([A-Z]?\d{1,2})[,\s]*(?:berth|seat)\s*(?:no\.?)?\s*(\d{1,3})/).map { "Coach \($0.1), berth \($0.2)" }
            let pnr = cleaned.firstMatch(of: /(?i)pnr\s*(?:no\.?)?\s*[:\s]*(\d{10})/).map { "PNR \($0.1)" }
            results.append(ParsedBooking(
                category: .transit,
                title: ["Train", number, name.map { "· \($0)" }].compactMap(\.self).joined(separator: " "),
                meta: [route, berth, pnr].compactMap(\.self).joined(separator: " · "),
                date: dates.first,
                time: timeString(dates.first)
            ))
            return results
        }

        // Buses (redBus, state transport): route and seats.
        if lower.contains("redbus") || lower.contains("bus ticket") || lower.contains("bus:") || lower.contains("volvo") && lower.contains("seat") {
            let route = cleaned.firstMatch(of: /(?i)([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+to\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/)
            let seats = cleaned.firstMatch(of: /(?i)seats?\s*(?:no\.?)?\s*[:\s]*([\dA-Z]{1,3}(?:\s*,\s*[\dA-Z]{1,3})*)/).map { "Seat \($0.1)" }
            results.append(ParsedBooking(
                category: .transit,
                title: route.map { "Bus \($0.1) → \($0.2)" } ?? "Bus",
                meta: [seats, reference.map { "Ticket \($0)" }].compactMap(\.self).joined(separator: " · "),
                date: dates.first,
                time: timeString(dates.first)
            ))
            return results
        }

        // Flight numbers, but not the booking reference ("QA1234") and each only once.
        var seenNumbers = Set<String>()
        let flights = cleaned.matches(of: /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/).filter { match in
            let compact = "\(match.1)\(match.2)"
            guard reference.map({ !$0.contains(compact) }) ?? true else { return false }
            return seenNumbers.insert(compact).inserted
        }
        if lower.contains("flight") || lower.contains("boarding") || lower.contains("departure") {
            for match in flights.prefix(2) {
                let number = "\(match.1) \(match.2)"
                let route = cleaned.firstMatch(of: /\b([A-Z]{3})\s*(?:→|->|-|to)\s*([A-Z]{3})\b/)
                let destination = route.map { String($0.2) } ?? "Destination"
                let time = timeString(dates.first)
                let gate = cleaned.firstMatch(of: /(?i)gate[:\s]*([A-Z]?\d{1,3}[A-Z]?)/).map { String($0.1) } ?? "TBC"
                let seat = cleaned.firstMatch(of: /(?i)seat[:\s]*(\d{1,2}[A-K])/).map { String($0.1) } ?? "TBC"
                var metaParts = [number]
                if let route { metaParts.append("\(route.1) → \(route.2)") }
                if let reference { metaParts.append("PNR \(reference)") }
                results.append(ParsedBooking(
                    category: .flight,
                    title: route.map { "Flight \($0.1) → \($0.2)" } ?? "Flight \(number)",
                    meta: metaParts.joined(separator: " · "),
                    date: dates.first,
                    time: time,
                    flight: FlightInfo(number: number, destination: destination, boards: time ?? "TBC", gate: gate, seat: seat)
                ))
            }
        }

        if lower.contains("check-in") || lower.contains("check in") || lower.contains("hotel") || lower.contains("nights") || lower.contains("stay") {
            // Nights as stated, else from the check-in and check-out dates.
            var nights = cleaned.firstMatch(of: /(\d{1,2})\s*nights?/).map { "\($0.1) nights" }
            if nights == nil, dates.count >= 2 {
                let n = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: dates[0]), to: Calendar.current.startOfDay(for: dates[1])).day ?? 0
                if n > 0 { nights = n == 1 ? "1 night" : "\(n) nights" }
            }
            let name = firstLine(containing: ["hotel", "hostel", "apartment", "resort", "guesthouse", "homestay", "inn", "villa"], in: cleaned)
                .map { $0.replacingOccurrences(of: #"(?i)^(hotel name|property)\s*[:\-]\s*"#, with: "", options: .regularExpression) }
                ?? "Stay"
            // "Check-in: … (from 14:00)"
            let checkIn = cleaned.firstMatch(of: /(?i)check[- ]?in[^\n]*?(\d{1,2}:\d{2})/).map { String($0.1) }
            results.append(ParsedBooking(
                category: .stay,
                title: "Check in, \(name)",
                meta: [nights, reference.map { "Ref \($0)" }].compactMap(\.self).joined(separator: " · "),
                date: dates.first,
                time: checkIn.map { $0.count == 4 ? "0" + $0 : $0 } ?? "14:00"
            ))
        }

        if results.isEmpty {
            let title = firstLine(containing: ["tour", "ticket", "reservation", "table", "booking"], in: cleaned)
                ?? cleaned.split(separator: "\n").first.map(String.init)
                ?? "Booking"
            results.append(ParsedBooking(
                category: .activity,
                title: String(title.prefix(48)),
                meta: reference.map { "Ref \($0)" } ?? "From your confirmation",
                date: dates.first,
                time: timeString(dates.first)
            ))
        }
        return results
    }

    static func sameBooking(_ lhs: ParsedBooking, _ rhs: ParsedBooking) -> Bool {
        lhs.category == rhs.category && lhs.title == rhs.title && lhs.meta == rhs.meta
            && lhs.date == rhs.date && lhs.time == rhs.time
    }

    /// A detected calendar date belongs to the printed confirmation, rather
    /// than the phone's midnight converted into the destination time zone.
    static func dayOffset(_ booking: ParsedBooking, in trip: Trip) -> Int? {
        guard let date = booking.date,
              let destinationDate = trip.calendar.date(from: Calendar.current.dateComponents([.year, .month, .day], from: date)) else { return nil }
        return trip.calendar.dateComponents([.day], from: trip.calendar.startOfDay(for: trip.civilStart), to: trip.calendar.startOfDay(for: destinationDate)).day
    }

    static func importedPlans(_ bookings: [ParsedBooking], into trip: Trip) -> [Plan] {
        var plans: [Plan] = []
        for booking in bookings {
            let day = max(0, min(dayOffset(booking, in: trip) ?? 0, max(0, trip.dayCount - 1)))
            let time = booking.time ?? "12:00"
            guard !(trip.plans + plans).contains(where: { $0.day == day && $0.time == time && $0.title == booking.title && $0.meta == booking.meta && $0.category == booking.category }) else { continue }
            plans.append(Plan(day: day, time: time, title: booking.title, meta: booking.meta, category: booking.category,
                              action: booking.category == .flight ? "Ticket" : booking.category == .stay ? "Map" : nil,
                              addedAt: .now, flight: booking.flight))
        }
        return plans
    }

    private static func detectDates(in text: String) -> [Date] {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue) else { return [] }
        return detector.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap(\.date)
    }

    private static func timeString(_ date: Date?) -> String? {
        guard let date else { return nil }
        let comps = Calendar.current.dateComponents([.hour, .minute], from: date)
        guard let h = comps.hour, let m = comps.minute, h + m > 0 else { return nil }
        return String(format: "%02d:%02d", h, m)
    }

    private static func firstLine(containing words: [String], in text: String) -> String? {
        text.split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first { line in words.contains { line.lowercased().contains($0) } && line.count < 60 }
    }
}
