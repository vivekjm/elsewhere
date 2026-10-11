import Foundation
import FoundationModels
import OSLog

private let log = Logger(subsystem: "com.tripsloom.ios", category: "planner")

struct ItineraryDraft: Hashable {
    enum Source: Hashable { case onDevice, template }

    var title: String
    var place: String
    var kind: TripKind
    var travellers: Int
    var estimate: Double
    var currency = "€"
    var days: [DraftDay]
    var source: Source
    /// From the prompt ("in December", "from 12 Dec"); nil means two weeks out.
    var start: Date?
    var photo: Photo?
}

struct DraftDay: Identifiable, Hashable {
    var id = UUID()
    var title: String
    var stops: [String]
    /// Where the day happens ("Munnar"), shown under each plan.
    var area: String?
}

@Generable
nonisolated struct GeneratedDay {
    @Guide(description: "A short title for the day, like 'Alfama and fado night'")
    var title: String
    @Guide(description: "Two or three stops, bookings or activities for the day, each a few words")
    var stops: [String]
}

@Generable
nonisolated struct GeneratedTrip {
    @Guide(description: "A short trip title, like 'Lisbon & Porto'")
    var title: String
    @Guide(description: "Main destination as 'City, Country' or 'Region, Country'")
    var place: String
    @Guide(description: "Trip type", .anyOf(["trek", "climb", "camp", "road", "beach", "city"]))
    var kind: String
    @Guide(description: "Number of travellers, 1 if not stated")
    var travellers: Int
    @Guide(description: "Estimated total cost in euros for the whole group, excluding flights")
    var estimateEuros: Int
    @Guide(description: "One entry per day of the trip, in order")
    var days: [GeneratedDay]
}

/// Drafts an itinerary from a sentence. Uses Apple's on-device model when
/// Apple Intelligence is available, otherwise a simple rule-based template.
enum TripDrafter {
    static var usesOnDeviceModel: Bool { SystemLanguageModel.default.isAvailable }

    static func draft(prompt: String, profile: Profile, refinements: [String] = []) async -> ItineraryDraft {
        if usesOnDeviceModel {
            do {
                return try await modelDraft(prompt: prompt, profile: profile, refinements: refinements)
            } catch {
                log.error("On-device draft failed: \(String(describing: error), privacy: .public)")
            }
        } else {
            log.info("On-device model unavailable: \(String(describing: SystemLanguageModel.default.availability), privacy: .public)")
        }
        var draft = TemplateDrafter.draft(prompt: prompt, refinements: refinements, profile: profile)
        // A place the destination list doesn't know: confirm it with Apple
        // Maps and add the country ("Shimla" → "Shimla, India").
        if !draft.place.contains(","), draft.place != "Somewhere new",
           let found = await Places.lookup(draft.place), let country = found.country {
            draft.place = "\(draft.place), \(country)"
        }
        return draft
    }

    static func alternative(for day: DraftDay, in draft: ItineraryDraft, index: Int) async -> DraftDay {
        if draft.source == .onDevice, usesOnDeviceModel {
            let session = LanguageModelSession(instructions: instructions)
            let others = draft.days.map(\.title).joined(separator: "; ")
            let prompt = "Trip: \(draft.title) in \(draft.place). Other days: \(others). Suggest a different plan for day \(index + 1), replacing '\(day.title)'."
            if let response = try? await session.respond(to: prompt, generating: GeneratedDay.self) {
                return DraftDay(title: response.content.title, stops: Array(response.content.stops.prefix(3)))
            }
        }
        return TemplateDrafter.alternative(kind: draft.kind, index: index, avoiding: Set(draft.days.map(\.title)))
    }

    private static let instructions = """
    You plan trips for a travel app. Be specific and practical: name real neighbourhoods, sights, \
    restaurants, trails or transport. Keep titles short, in sentence case, without emoji or exclamation marks.
    """

    private static func modelDraft(prompt: String, profile: Profile, refinements: [String]) async throws -> ItineraryDraft {
        let session = LanguageModelSession(instructions: instructions)
        var request = "Plan this trip: \(prompt)\nTraveller preferences: \(profile.budgetStyle), \(profile.diet), \(profile.pace). Home base \(profile.homeAirport)."
        if !refinements.isEmpty {
            request += "\nAdjust the plan: \(refinements.joined(separator: ", "))."
        }
        let response = try await session.respond(to: request, generating: GeneratedTrip.self)
        let trip = response.content
        let days = trip.days.prefix(21).map { DraftDay(title: $0.title, stops: Array($0.stops.prefix(3))) }
        guard !days.isEmpty else { throw CancellationError() }
        // What the person said outright wins over the model's guesses.
        let facts = PromptFacts.parse(prompt)
        let kind = TripKind(rawValue: trip.kind) ?? .city
        var estimate = Double(max(trip.estimateEuros, 0))
        if let code = CurrencyService.code(for: facts.currency), code != "EUR" {
            estimate *= await CurrencyService.shared.rate(from: "EUR", to: code) ?? TemplateDrafter.fallbackRate(code)
        }
        return ItineraryDraft(
            title: trip.title,
            place: trip.place,
            kind: kind,
            travellers: facts.travellers ?? max(1, min(trip.travellers, 20)),
            estimate: facts.budget ?? TemplateDrafter.round(estimate),
            currency: facts.currency,
            days: days,
            source: .onDevice,
            start: facts.start,
            photo: Destination.match(prompt)?.photo
        )
    }
}

/// The offline fallback: reads the length, type and place from the prompt and
/// fills days from a template for that trip type.
enum TemplateDrafter {
    static func draft(prompt: String, refinements: [String], profile: Profile = Profile()) -> ItineraryDraft {
        let text = prompt.lowercased()
        let facts = PromptFacts.parse(prompt)
        let destination = Destination.match(prompt)
        let kind = explicitKind(in: text) ?? destination?.kind ?? .city
        let days = facts.days ?? (kind.isAdventure ? 8 : 5)
        let place = destination?.place ?? place(in: prompt)
        let travellers = facts.travellers ?? 2

        var draftDays = assemble(days: days, kind: kind, place: place, destination: destination, interests: facts.interests)

        if refinements.contains("Beach day"), draftDays.count > 2 {
            draftDays[draftDays.count / 2] = DraftDay(title: "Beach day", stops: ["Nearest beach", "Long lunch by the water", "Sunset swim"])
        }
        if refinements.contains("Less walking") {
            draftDays = draftDays.map { day in
                var day = day
                day.stops = Array(day.stops.prefix(2)).map { $0.replacingOccurrences(of: " walk", with: " by cab") }
                return day
            }
        }

        // Per person per day, in the trip's currency.
        var perDay: Double
        if let destination, destination.currency == facts.currency {
            perDay = destination.perDay
        } else {
            let euros: Double = switch kind {
            case .city: 110
            case .beach: 90
            case .road: 95
            case .trek, .camp: 60
            case .climb: 180
            }
            let code = CurrencyService.code(for: facts.currency) ?? "EUR"
            // Travelling within India costs far less than the euro guide suggests.
            perDay = code == "INR" && (destination?.currency ?? "₹") == "₹" ? 3_500 : euros * fallbackRate(code)
        }
        switch profile.budgetStyle.lowercased() {
        case let style where style.contains("budget") || style.contains("backpack"): perDay *= 0.6
        case let style where style.contains("luxury") || style.contains("splurge"): perDay *= 2
        default: break
        }
        if refinements.contains("Cheaper") { perDay *= 0.75 }
        let estimate = facts.budget ?? round(perDay * Double(days * travellers))

        return ItineraryDraft(
            title: title(place: place.split(separator: ",").first.map(String.init) ?? place, kind: kind, days: days),
            place: place,
            kind: kind,
            travellers: travellers,
            estimate: estimate,
            currency: facts.currency,
            days: draftDays,
            source: .template,
            start: facts.start,
            photo: destination?.photo ?? (facts.interests.contains("beach") || facts.interests.contains("backwaters") ? .beach : nil)
        )
    }

    /// Arrival day, the destination's highlights, then the traveller's
    /// interests, then generic days for the trip type; a travel-home day last.
    private static func assemble(days: Int, kind: TripKind, place: String, destination: Destination?, interests: [String]) -> [DraftDay] {
        let short = place.split(separator: ",").first.map(String.init) ?? place
        if kind.isAdventure {
            let pool = templates(kind)
            return (0..<days).map { pool[$0 % pool.count] }
        }
        var middle: [DraftDay] = []
        if let destination {
            // The destination's first day usually is its own arrival day.
            middle += destination.days
        }
        middle += Interest.all.filter { interests.contains($0.name) }.map(\.day)
            .filter { day in !middle.contains { $0.title == day.title } }
        middle += templates(kind).dropFirst().filter { day in !day.title.lowercased().contains("last") && !day.title.lowercased().contains("check out") }

        var result: [DraftDay] = []
        let arrival = destination?.days.first.map { day in
            var day = day
            if !day.stops.contains(where: { PlanCategory.guess(from: $0) == .stay }) {
                day.stops = ["Arrive and check in"] + Array(day.stops.prefix(2))
            }
            return day
        } ?? DraftDay(title: "Arrive in \(short)", stops: ["Arrive and check in", "Walk around the neighbourhood", "Dinner nearby"], area: short)
        result.append(arrival)
        var pool = middle.filter { $0.title != arrival.title }
        while result.count < days - (days >= 3 ? 1 : 0) {
            if pool.isEmpty { pool = middle.filter { $0.title != arrival.title } + extras(kind) }
            result.append(pool.removeFirst())
        }
        if days >= 3 {
            let lastArea = result.last?.area ?? short
            result.append(DraftDay(title: "Last morning and home", stops: ["Breakfast", "Check out", "Transfer home"], area: lastArea))
        }
        return Array(result.prefix(days))
    }

    static func round(_ value: Double) -> Double {
        value >= 10_000 ? (value / 1_000).rounded() * 1_000 : value >= 1_000 ? (value / 100).rounded() * 100 : (value / 10).rounded() * 10
    }

    /// Euro to other currencies, for when live rates haven't loaded.
    static func fallbackRate(_ code: String) -> Double {
        ["EUR": 1, "INR": 95, "USD": 1.1, "GBP": 0.85, "JPY": 160, "AUD": 1.65, "SGD": 1.45, "AED": 4, "THB": 38, "NPR": 150][code] ?? 1
    }

    static func alternative(kind: TripKind, index: Int, avoiding: Set<String>) -> DraftDay {
        let options = templates(kind) + extras(kind)
        return options.first { !avoiding.contains($0.title) } ?? options[(index + 3) % options.count]
    }

    /// The trip type if the prompt says it; nil lets the destination decide.
    private static func explicitKind(in text: String) -> TripKind? {
        func has(_ w: String) -> Bool { PromptFacts.startsWord(text, w) }
        if has("summit") || has("climb") || has("peak") { return .climb }
        if has("trek") || has("trail") { return .trek }
        if has("camping") || has("camp ") { return .camp }
        if has("road trip") || has("drive") || has("roadtrip") { return .road }
        if has("beach") || has("dive") || has("diving") || has("snorkel") { return .beach }
        return nil
    }

    /// Words that follow "in" or "to" but aren't places.
    private static let notPlaces: Set<String> = Set(PromptFacts.months + PromptFacts.months.map { String($0.prefix(3)) } + [
        "a", "an", "the", "my", "our", "with", "for", "and", "winter", "summer", "spring", "autumn", "monsoon",
        "march", "may", "next", "this", "early", "late", "mid", "october", "hills", "mountains", "beach", "beaches",
        "city", "town", "style", "comfort", "budget", "luxury", "peace", "nature",
    ])

    static func place(in prompt: String) -> String {
        // Capitalised names after "in", "to", …, then any capitalised name.
        for match in prompt.matches(of: /(?:in|to|through|around|from|visit|visiting|explore|exploring)\s+(?:the\s+)?([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)*)/)
        where !notPlaces.contains(match.1.lowercased()) {
            return String(match.1)
        }
        // Typed in lower case: "3 days in shimla".
        for match in prompt.lowercased().matches(of: /(?:in|to|through|around|visit|visiting|explore|exploring)\s+(?:the\s+)?([\p{L}'-]{3,}(?:\s+[\p{L}'-]{3,})?)/) {
            var words = match.1.split(separator: " ").map(String.init)
            if words.count == 2, notPlaces.contains(words[1]) || PromptFacts.startsWord(words[1], "with") { words.removeLast() }
            guard let first = words.first, !notPlaces.contains(first) else { continue }
            return words.map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
        }
        for match in prompt.matches(of: /([A-Z][\p{L}'-]{2,}(?:\s+[A-Z][\p{L}'-]+)*)/)
        where !notPlaces.contains(match.1.lowercased()) && match.1 != prompt.prefix(match.1.count) {
            return String(match.1)
        }
        return "Somewhere new"
    }

    private static func title(place: String, kind: TripKind, days: Int) -> String {
        if place == "Somewhere new" {
            let length = days <= 4 ? "long weekend" : days >= 7 ? "week" : "\(days) days"
            return switch kind {
            case .beach: "A \(length) by the sea"
            case .trek: "A \(length) trekking"
            case .climb: "A \(length) climbing"
            case .camp: "A \(length) camping"
            case .road: "A \(length) on the road"
            case .city: "A \(length) away"
            }
        }
        return switch kind {
        case .trek: "\(place) trek"
        case .climb: "\(place) climb"
        case .camp: "Camping in \(place)"
        case .road: "\(place) road trip"
        case .beach: "\(place) by the sea"
        case .city: days >= 7 ? "A week in \(place)" : "\(days) days in \(place)"
        }
    }

    private static func templates(_ kind: TripKind) -> [DraftDay] {
        switch kind {
        case .city:
            [
                DraftDay(title: "Arrive and walk the old town", stops: ["Check in", "Old town walk", "Dinner nearby"]),
                DraftDay(title: "Markets and a food walk", stops: ["Morning market", "Food walk", "Rooftop sunset"]),
                DraftDay(title: "Museums and a long lunch", stops: ["Main museum", "Long lunch", "Evening music"]),
                DraftDay(title: "Day trip out of town", stops: ["Morning train", "Palace or old village", "Train back 18:10"]),
                DraftDay(title: "Neighbourhoods by tram", stops: ["Tram across town", "Cafés and shops", "Viewpoint at dusk"]),
                DraftDay(title: "Slow morning, riverside", stops: ["Late breakfast", "Riverside walk", "Farewell dinner"]),
                DraftDay(title: "Last walk and home", stops: ["Pack and check out", "Coffee stop", "Airport transfer"]),
            ]
        case .beach:
            [
                DraftDay(title: "Arrive and first swim", stops: ["Check in", "Beach afternoon", "Sunset drinks"]),
                DraftDay(title: "Dive or snorkel morning", stops: ["Boat out 08:00", "Two dives", "Beach shack dinner"]),
                DraftDay(title: "Old town and market", stops: ["Old quarter walk", "Spice market", "Sunset cruise"]),
                DraftDay(title: "Quiet beach day", stops: ["Hidden cove", "Long lunch", "Night market"]),
                DraftDay(title: "Check out", stops: ["Breakfast by the sea", "Train home"]),
            ]
        case .road:
            [
                DraftDay(title: "Drive out, first stop", stops: ["Leave by 06:00", "Breakfast on the highway", "Check in"]),
                DraftDay(title: "Scenic loop", stops: ["Viewpoint", "Waterfall", "Local dinner"]),
                DraftDay(title: "Next town", stops: ["Morning drive", "Old town walk", "Guesthouse"]),
                DraftDay(title: "Slow day", stops: ["Estate or farm visit", "Afternoon rest", "Stargazing"]),
                DraftDay(title: "Drive home", stops: ["Early start", "Lunch stop", "Home by evening"]),
            ]
        case .trek, .camp, .climb:
            [
                DraftDay(title: "Arrive at the trailhead", stops: ["Transfer to trailhead", "Gear check", "Early night"]),
                DraftDay(title: "First stage", stops: ["Start 07:00", "Lunch at the halfway village", "Tea house"]),
                DraftDay(title: "Climb to the next village", stops: ["Steady ascent", "Viewpoint", "Tea house"]),
                DraftDay(title: "Acclimatisation day", stops: ["Climb high", "Sleep low", "Rest"]),
                DraftDay(title: "High pass or summit day", stops: ["Alpine start", "Summit or pass", "Descend"]),
                DraftDay(title: "Walk out", stops: ["Descend to the valley", "Celebrate", "Transfer back"]),
            ]
        }
    }

    private static func extras(_ kind: TripKind) -> [DraftDay] {
        switch kind {
        case .city: [DraftDay(title: "Gardens and a food hall", stops: ["Botanic garden", "Food hall lunch", "Live music"])]
        case .beach: [DraftDay(title: "Island hop", stops: ["Ferry out", "Snorkel", "Seafood lunch"])]
        case .road: [DraftDay(title: "Detour to the coast", stops: ["Coast road", "Fish lunch", "Beach stop"])]
        default: [DraftDay(title: "Rest day in the village", stops: ["Bakery", "Short hike", "Early night"])]
        }
    }
}
