import Foundation

/// What a one-line trip request says outright: length, dates, who's going,
/// budget, currency and interests. Used by both the on-device model and the
/// template, so a stated budget or date is never ignored.
struct PromptFacts {
    var days: Int?
    var start: Date?
    var travellers: Int?
    var budget: Double?
    /// Symbol, e.g. "₹". From the prompt, else the phone's currency.
    var currency: String
    var interests: [String]

    static func parse(_ prompt: String, now: Date = .now) -> PromptFacts {
        let text = prompt.lowercased()
        let currency = currency(in: text)
        return PromptFacts(
            days: days(in: text),
            start: start(in: prompt, now: now),
            travellers: travellers(in: text),
            budget: budget(in: text),
            currency: currency,
            interests: Interest.all.filter { interest in interest.words.contains { startsWord(text, $0) } }.map(\.name)
        )
    }

    // MARK: Length

    static func days(in text: String) -> Int? {
        if let match = text.firstMatch(of: /(\d{1,2})\s*(?:[a-z-]+\s+)?(?:day|night)/), let n = Int(match.1) {
            // "4 nights" is a 5-day trip.
            let nights = text[match.range].contains("night")
            return max(1, min(nights ? n + 1 : n, 21))
        }
        let words = ["two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10]
        for (word, n) in words where text.contains("\(word) day") || text.contains("\(word)-day") { return n }
        if text.contains("fortnight") || text.contains("two weeks") { return 14 }
        if text.contains("long weekend") { return 4 }
        if text.contains("weekend") { return 3 }
        // "a week in Lisbon", not "next week".
        if text.range(of: #"\b(a|one|1)\s+week\b|week-long|weeklong|\bweek in\b"#, options: .regularExpression) != nil { return 7 }
        return nil
    }

    // MARK: Dates

    static let months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

    /// An explicit date ("from 12 Dec", "on 5 January"), else a month ("in
    /// December" → its first Saturday), else "next week" / "this weekend".
    static func start(in prompt: String, now: Date) -> Date? {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        let text = prompt.lowercased()

        if let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue) {
            for match in detector.matches(in: prompt, range: NSRange(prompt.startIndex..., in: prompt)) {
                guard let date = match.date, let range = Range(match.range, in: prompt) else { continue }
                let phrase = prompt[range].lowercased()
                // A bare month name is handled below; a weekday alone isn't a start date.
                let hasDay = phrase.contains(where: \.isNumber)
                if hasDay, calendar.startOfDay(for: date) >= today { return calendar.startOfDay(for: date) }
            }
        }
        for (i, name) in months.enumerated() where monthMentioned(text, name) {
            var components = calendar.dateComponents([.year], from: today)
            components.month = i + 1
            components.day = 1
            guard var first = calendar.date(from: components) else { continue }
            if let end = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: first), end < today {
                first = calendar.date(byAdding: .year, value: 1, to: first) ?? first
            }
            // The first Saturday, or today if we're already in that month.
            var day = max(first, today)
            while calendar.component(.weekday, from: day) != 7, calendar.component(.month, from: day) == i + 1 {
                day = calendar.date(byAdding: .day, value: 1, to: day) ?? day
            }
            return calendar.startOfDay(for: day)
        }
        if text.contains("this weekend") {
            return nextWeekday(7, from: today)
        }
        if text.contains("next weekend") {
            return nextWeekday(7, from: calendar.date(byAdding: .day, value: 7, to: today) ?? today)
        }
        if text.contains("next week") {
            return nextWeekday(2, from: calendar.date(byAdding: .day, value: 1, to: today) ?? today)
        }
        if text.contains("next month") {
            let next = calendar.date(byAdding: .month, value: 1, to: today) ?? today
            var c = calendar.dateComponents([.year, .month], from: next)
            c.day = 1
            return calendar.date(from: c).map { nextWeekday(7, from: $0) }
        }
        return nil
    }

    private static func nextWeekday(_ weekday: Int, from date: Date) -> Date {
        let calendar = Calendar.current
        var day = calendar.startOfDay(for: date)
        while calendar.component(.weekday, from: day) != weekday {
            day = calendar.date(byAdding: .day, value: 1, to: day) ?? day
        }
        return day
    }

    /// "in December", "Dec" — and "may" only as a month ("in May", "May 12").
    private static func monthMentioned(_ text: String, _ name: String) -> Bool {
        if name == "may" {
            return text.range(of: #"\b(in|during|early|late|mid|this|next|by)\s+may\b|\bmay\s+\d"#, options: .regularExpression) != nil
        }
        return containsWord(text, name) || containsWord(text, String(name.prefix(3)))
    }

    /// "monaster" matches "monastery" but "art" doesn't match "party".
    /// A place name as a whole word ("Bath", "Bath's"), not inside another
    /// word ("bathroom").
    static func namesPlace(_ text: String, _ name: String) -> Bool {
        text.range(of: "\\b" + NSRegularExpression.escapedPattern(for: name) + "(?:'s|s)?\\b", options: .regularExpression) != nil
    }

    static func startsWord(_ text: String, _ word: String) -> Bool {
        text.range(of: "\\b" + NSRegularExpression.escapedPattern(for: word), options: .regularExpression) != nil
    }

    private static func containsWord(_ text: String, _ word: String) -> Bool {
        text.range(of: "\\b\(word)\\b", options: .regularExpression) != nil
    }

    // MARK: People

    static func travellers(in text: String) -> Int? {
        if let match = text.firstMatch(of: /(?:family|group) of (\d{1,2})/), let n = Int(match.1) { return min(n, 20) }
        if let match = text.firstMatch(of: /(\d{1,2})\s*(?:people|persons|adults|travellers|travelers|of us|pax)/), let n = Int(match.1) { return max(1, min(n, 20)) }
        if let match = text.firstMatch(of: /with (\d{1,2}) (?:friends|colleagues|others)/), let n = Int(match.1) { return min(n + 1, 20) }
        if text.contains("solo") || text.contains("alone") || text.contains("by myself") { return 1 }
        var count = 1
        var mentioned = false
        if text.contains("parents") || text.contains("mum and dad") || text.contains("mom and dad") { count += 2; mentioned = true }
        if ["wife", "husband", "partner", "girlfriend", "boyfriend", "fiancé", "fiance", "spouse"].contains(where: text.contains) { count += 1; mentioned = true }
        if text.contains("kids") || text.contains("children") { count += 2; mentioned = true }
        else if ["my son", "my daughter", "my kid", "my child", "baby"].contains(where: text.contains) { count += 1; mentioned = true }
        if text.contains("couple") || text.contains("honeymoon") || text.contains("two of us") { return 2 }
        if text.contains("friends") && !mentioned { return 4 }
        return mentioned ? min(count, 20) : nil
    }

    // MARK: Money

    static func currency(in text: String) -> String {
        if text.contains("€") || text.contains("euro") { return "€" }
        if text.contains("£") || text.contains("pound") || text.contains("gbp") { return "£" }
        if text.contains("$") || text.contains("dollar") || text.contains("usd") { return "$" }
        return CurrencyService.symbol(for: CurrencyService.home)
    }

    /// "budget 6000", "under €1.2k", "for $2k", "3k euros".
    static func budget(in text: String) -> Double? {
        let pattern = /(?:budget(?:\s+of)?|under|within|max|upto|up to|around|about|for)?\s*(?:\$|€|£)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:dollars|euros|pounds|usd|eur|gbp)?/
        for match in text.matches(of: pattern) {
            let whole = String(text[match.range]).trimmingCharacters(in: .whitespaces)
            let hasMoneyWord = ["budget", "under", "within", "$", "€", "£", "dollar", "euro", "pound"].contains { whole.contains($0) }
                || match.2 != nil
            guard hasMoneyWord, var value = Double(match.1.replacingOccurrences(of: ",", with: "")) else { continue }
            switch match.2.map(String.init) {
            case "k": value *= 1_000
            default: break
            }
            // "5 days" and similar never reach here; still skip tiny numbers.
            if value >= 50 { return value }
        }
        return nil
    }
}

/// Interest words in a prompt, each with a day of stops for the template.
struct Interest {
    var name: String
    var words: [String]
    var day: DraftDay

    static let all: [Interest] = [
        Interest(name: "backwaters", words: ["backwater", "houseboat"], day: DraftDay(title: "Backwaters by boat", stops: ["Houseboat check-in", "Backwater cruise", "Dinner on board"])),
        Interest(name: "tea", words: ["tea garden", "tea estate", "tea plantation", "tea country", "tea gardens"], day: DraftDay(title: "Tea country", stops: ["Tea estate walk", "Tea factory tour", "Sunset viewpoint"])),
        Interest(name: "temples", words: ["temple", "monaster", "church", "mosque", "gurudwara", "spiritual"], day: DraftDay(title: "Temples and old quarter", stops: ["Morning temple visit", "Old quarter walk", "Evening aarti or prayers"])),
        Interest(name: "beach", words: ["beach", "sea", "coast", "island"], day: DraftDay(title: "Beach day", stops: ["Beach morning", "Seafood lunch", "Sunset by the water"])),
        Interest(name: "food", words: ["food", "street food", "cuisine", "foodie", "cafés", "cafes"], day: DraftDay(title: "Food trail", stops: ["Local breakfast", "Street food walk", "Dinner at a local favourite"])),
        Interest(name: "wildlife", words: ["wildlife", "safari", "tiger", "elephant", "bird"], day: DraftDay(title: "Wildlife safari", stops: ["Early morning safari", "Lunch at the lodge", "Evening nature walk"])),
        Interest(name: "museums", words: ["museum", "art ", "art,", "history", "heritage", "fort", "palace"], day: DraftDay(title: "Forts and history", stops: ["Fort or palace visit", "Museum", "Heritage walk at dusk"])),
        Interest(name: "markets", words: ["market", "shopping", "bazaar", "souk"], day: DraftDay(title: "Markets and shopping", stops: ["Morning market", "Craft shops", "Night market"])),
        Interest(name: "hiking", words: ["hike", "hiking", "trek", "walk", "nature", "hills", "mountain"], day: DraftDay(title: "Into the hills", stops: ["Morning hike", "Picnic lunch", "Viewpoint at sunset"])),
        Interest(name: "lakes", words: ["lake"], day: DraftDay(title: "Lakes", stops: ["Lakeside walk", "Boat ride", "Lakeside dinner"])),
        Interest(name: "waterfalls", words: ["waterfall", "falls"], day: DraftDay(title: "Waterfalls", stops: ["Drive to the falls", "Waterfall walk", "Village lunch"])),
        Interest(name: "nightlife", words: ["nightlife", "party", "bars", "club"], day: DraftDay(title: "Out after dark", stops: ["Late lunch", "Sunset drinks", "Night out"])),
        Interest(name: "wellness", words: ["yoga", "spa", "ayurveda", "wellness", "relax", "slow"], day: DraftDay(title: "Slow and restful", stops: ["Morning yoga", "Spa or Ayurveda treatment", "Quiet dinner"])),
        Interest(name: "snow", words: ["snow", "ski", "skiing"], day: DraftDay(title: "Snow day", stops: ["Cable car up", "Snow play or skiing", "Hot chocolate by the fire"])),
        Interest(name: "adventure", words: ["rafting", "paraglid", "zipline", "adventure", "scuba", "dive", "diving", "surf"], day: DraftDay(title: "Adventure day", stops: ["Morning adventure activity", "Lunch nearby", "Easy evening"])),
    ]
}

extension PlanCategory {
    /// A best guess from a plan's title, for new plans and drafted ones.
    static func guess(from title: String) -> PlanCategory? {
        let t = title.lowercased()
        func has(_ words: [String]) -> Bool { words.contains { t.contains($0) } }
        if has(["flight", "fly to", "boarding", "airport check-in"]) { return .flight }
        if has(["check in", "check-in", "hotel", "homestay", "resort", "hostel", "houseboat", "overnight", "stay at", "guesthouse", "camp at"]) { return .stay }
        if has(["breakfast", "lunch", "dinner", "brunch", "café", "cafe", "coffee", "food", "restaurant", "street food", "sadya", "tea at", "drinks"]) { return .food }
        if has(["train", "bus", "drive", "transfer", "taxi", "cab", "ferry", "metro", "tram", "pickup", "pick up", "check out", "airport", "station"]) { return .transit }
        if has(["sunset", "night", "aarti", "music", "show", "concert", "evening", "bar", "fado", "kathakali", "light show"]) { return .evening }
        if has(["hike", "trek", "safari", "rafting", "dive", "snorkel", "kayak", "cruise", "boat", "cycle", "yoga", "spa", "class", "tour", "walk", "ride", "canoe"]) { return .activity }
        return nil
    }

    /// When a plan of this kind usually happens.
    func typicalTime(for title: String) -> String? {
        let t = title.lowercased()
        if t.contains("breakfast") { return "08:30" }
        if t.contains("sunrise") { return "05:30" }
        if t.contains("lunch") { return "13:00" }
        if t.contains("dinner") { return "19:30" }
        if t.contains("sunset") { return "17:45" }
        if t.contains("aarti") { return "18:30" }
        switch self {
        case .stay: return t.contains("check out") ? "10:00" : "14:00"
        case .evening: return "19:00"
        default: return nil
        }
    }
}
