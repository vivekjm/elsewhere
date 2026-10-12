import Foundation

import Observation

/// Profile → Units, observable so every screen that formats a distance or
/// weight redraws when it changes.
@Observable
final class UnitsSetting {
    static let shared = UnitsSetting()
    var metric = true
}

enum Fmt {
    /// Mirrors Profile → Units. Set by `TripStore`.
    static var metric: Bool {
        get { UnitsSetting.shared.metric }
        set { if UnitsSetting.shared.metric != newValue { UnitsSetting.shared.metric = newValue } }
    }
    private static func formatter(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = .autoupdatingCurrent
        f.setLocalizedDateFormatFromTemplate(format)
        return f
    }

    private static let monthDayF = formatter("MMM d")
    private static let dayOnly = formatter("d")
    private static let weekdayMonthDay = formatter("EEEE MMM d")
    private static let weekdayDayMonth: DateFormatter = {
        let f = DateFormatter()
        f.locale = .autoupdatingCurrent
        f.setLocalizedDateFormatFromTemplate("EEEE d MMMM")
        return f
    }()
    private static let shortWeekday = formatter("EEE")
    private static let time = formatter("jm")

    /// "Sep 21 – 27" or "Sep 28 – Oct 4"
    static func range(_ start: Date, _ end: Date, timeZone: TimeZone = .current) -> String {
        let f = DateIntervalFormatter()
        f.locale = .autoupdatingCurrent
        f.timeZone = timeZone
        f.dateTemplate = "MMM d"
        return f.string(from: start, to: end)
    }

    static func monthDay(_ date: Date, timeZone: TimeZone = .current) -> String {
        monthDayF.timeZone = timeZone
        return monthDayF.string(from: date)
    }

    /// "Monday, Sep 22"
    static func dayTitle(_ date: Date, timeZone: TimeZone = .current) -> String {
        weekdayMonthDay.timeZone = timeZone
        return weekdayMonthDay.string(from: date)
    }

    /// "Monday 15 September" for the lock screen.
    static func lockScreenDate(_ date: Date) -> String { weekdayDayMonth.string(from: date) }

    /// "Sun"
    static func weekday(_ date: Date, timeZone: TimeZone = .current) -> String {
        shortWeekday.timeZone = timeZone
        return shortWeekday.string(from: date)
    }

    /// "S"
    static func weekdayLetter(_ date: Date, timeZone: TimeZone = .current) -> String { String(weekday(date, timeZone: timeZone).prefix(1)) }

    static func dayNumber(_ date: Date, timeZone: TimeZone = .current) -> String {
        dayOnly.timeZone = timeZone
        return dayOnly.string(from: date)
    }

    /// Strict localised amount input. Never interpret commas as decimal points
    /// in one place and thousands separators in another, or accept a prefix of
    /// malformed input. Also supports the Indian 12,34,567 grouping pattern.
    static func parseAmount(_ text: String, locale: Locale = .autoupdatingCurrent) -> Double? {
        let f = NumberFormatter()
        f.locale = locale; f.numberStyle = .decimal
        var raw = text.trimmingCharacters(in: .whitespacesAndNewlines)
        var sign = 1.0
        if raw.first == "-" { sign = -1; raw.removeFirst() }
        else if raw.first == "+" { raw.removeFirst() }
        let parts = raw.components(separatedBy: f.decimalSeparator ?? ".")
        guard (1...2).contains(parts.count) else { return nil }
        func digits(_ s: String) -> Bool { !s.isEmpty && s.allSatisfy { $0.isASCII && $0.isNumber } }
        let separator = f.groupingSeparator ?? ","
        let groups = parts[0].components(separatedBy: separator)
        guard groups.allSatisfy(digits) else { return nil }
        if groups.count > 1 {
            let primary = max(1, f.groupingSize)
            let secondary = f.secondaryGroupingSize > 0 ? f.secondaryGroupingSize : primary
            guard groups.last!.count == primary, (1...secondary).contains(groups[0].count),
                  groups.dropFirst().dropLast().allSatisfy({ $0.count == secondary }) else { return nil }
        }
        if parts.count == 2, !digits(parts[1]) { return nil }
        let normalized = groups.joined() + (parts.count == 2 ? "." + parts[1] : "")
        guard let number = Double(normalized), number.isFinite else { return nil }
        return sign * number
    }

    static func amountInput(_ value: Double) -> String {
        let f = NumberFormatter(); f.locale = .autoupdatingCurrent; f.numberStyle = .decimal
        f.usesGroupingSeparator = false; f.maximumFractionDigits = 3
        return f.string(from: NSNumber(value: value)) ?? ""
    }

    static func roundedCurrency(_ value: Double, _ currency: String) -> Double {
        let factor = pow(10, Double(currencyFormatter(currency).maximumFractionDigits))
        return (value * factor).rounded() / factor
    }

    static func clock(_ date: Date) -> String { time.string(from: date) }

    /// Clock time at the destination, e.g. tide turns.
    static func clock(_ date: Date, timeZone: TimeZone) -> String {
        guard timeZone != .current else { return clock(date) }
        let f = formatter("jm")
        f.timeZone = timeZone
        return f.string(from: date)
    }

    /// "€705" and ".00"
    static func money(_ amount: Double, _ currency: String) -> (whole: String, fraction: String) {
        let text = currencyFormatter(currency).string(from: NSNumber(value: amount.isFinite ? amount : 0)) ?? "–"
        return (text, "")
    }

    static func currencyFormatter(_ currency: String, locale: Locale = .autoupdatingCurrent) -> NumberFormatter {
        let f = NumberFormatter()
        f.locale = locale
        f.numberStyle = .currency
        f.currencyCode = CurrencyService.code(for: currency) ?? currency
        if CurrencyService.code(for: currency) == nil { f.currencySymbol = currency }
        return f
    }

    static func moneyShort(_ amount: Double, _ currency: String) -> String {
        let f = currencyFormatter(currency)
        f.maximumFractionDigits = 0
        f.minimumFractionDigits = 0
        return f.string(from: NSNumber(value: amount.isFinite ? amount : 0)) ?? "–"
    }

    /// "€1.2k" for tight spaces.
    static func moneyCompact(_ amount: Double, _ currency: String) -> String {
        guard amount >= 1000 else { return moneyShort(amount, currency) }
        // The currency's own symbol and placement ("$1.2k", "1.2k €"), never the stored code.
        let f = currencyFormatter(currency)
        f.maximumFractionDigits = 0
        let symbol = f.currencySymbol ?? currency
        let number = String(format: "%.1f", amount / 1000) + "k"
        let sample = f.string(from: 1) ?? "\(symbol)1"
        return sample.hasPrefix(symbol) || !sample.hasSuffix(symbol) ? "\(symbol)\(number)" : "\(number) \(symbol)"
    }

    /// "1 stage", "3 stages"
    static func count(_ n: Int, _ singular: String, _ plural: String? = nil) -> String {
        "\(n) \(n == 1 ? singular : (plural ?? singular + "s"))"
    }

    static func grouped(_ value: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = .autoupdatingCurrent
        return f.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    /// "11.2"
    static func km(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        return rounded.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(rounded)) : String(format: "%.1f", rounded)
    }

    /// Item weight: "620 g", "1.4 kg", or "1.4 lb" / "8 oz" in imperial.
    static func kg(_ grams: Int) -> String {
        if metric {
            return grams >= 1000 ? String(format: "%.1f kg", Double(grams) / 1000) : "\(grams) g"
        }
        let ounces = Double(grams) / 28.3495
        return ounces >= 16 ? String(format: "%.1f lb", ounces / 16) : String(format: "%.0f oz", ounces)
    }

    /// Dive depth: "12 m" or "39 ft".
    static func depth(_ metres: Int) -> String {
        metric ? "\(metres) m" : "\(Int((Double(metres) * 3.28084).rounded())) ft"
    }

    static var distanceUnit: String { metric ? "km" : "mi" }
    static var weightUnit: String { metric ? "kg" : "lb" }

    /// A distance given in km, in the user's units, without the unit.
    static func distanceValue(_ km: Double) -> String {
        Fmt.km(metric ? km : km * 0.621371)
    }

    /// "11.2 km" or "7 mi"
    static func distance(_ km: Double) -> String {
        "\(distanceValue(km)) \(distanceUnit)"
    }

    /// A weight given in kg, in the user's units, one decimal, without the unit.
    static func weightValue(_ kg: Double) -> String {
        String(format: "%.1f", metric ? kg : kg * 2.20462)
    }
}
