import SwiftUI

// MARK: Trip types and tabs

enum TripKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case trek, climb, camp, road, beach, city

    var id: String { rawValue }

    var title: String {
        switch self {
        case .trek: "Trek and hike"
        case .climb: "Mountaineering"
        case .camp: "Camping"
        case .road: "Road trip"
        case .beach: "Beach and dive"
        case .city: "City break"
        }
    }

    var hint: String {
        switch self {
        case .trek: "Trails · tea houses"
        case .climb: "Summits · glaciers"
        case .camp: "Wild or campsite"
        case .road: "Stops · drives"
        case .beach: "Tides · dive logs"
        case .city: "Stays · outfits"
        }
    }

    var label: String {
        switch self {
        case .trek: "Trek"
        case .climb: "Climb"
        case .camp: "Camp"
        case .road: "Road"
        case .beach: "Beach"
        case .city: "City"
        }
    }

    var symbol: String {
        switch self {
        case .trek: "mountain.2.fill"
        case .climb: "figure.climbing"
        case .camp: "tent.fill"
        case .road: "car.fill"
        case .beach: "water.waves"
        case .city: "building.2.fill"
        }
    }

    var tile: Color {
        switch self {
        case .trek: Tile.green
        case .climb: Tile.indigo
        case .camp: Tile.bronze
        case .road: Tile.amber
        case .beach: Tile.teal
        case .city: Tile.plum
        }
    }

    var chipColor: Color {
        switch self {
        case .trek, .camp: .mint
        case .climb: .coral
        case .road: .apricot
        case .beach: .sky
        case .city: .lime
        }
    }

    /// The tab bar changes with the trip type.
    var tabs: [TripTab] {
        switch self {
        case .city: [.trip, .days, .wardrobe, .packing]
        case .trek, .camp: [.trip, .route, .gear, .safety]
        case .climb: [.trip, .climb, .gear, .safety]
        case .beach: [.trip, .days, .tides, .packing]
        case .road: [.trip, .route, .stops, .packing]
        }
    }

    var isAdventure: Bool { self == .trek || self == .climb || self == .camp }

    var defaultPhoto: Photo {
        switch self {
        case .trek, .climb, .camp: .himalaya
        case .road: .tram
        case .beach: .beach
        case .city: .lisbon
        }
    }
}

enum TripTab: String, Hashable, CaseIterable, Sendable {
    case trip, days, wardrobe, packing, route, gear, safety, climb, tides, stops

    var title: String {
        switch self {
        case .trip: "Trip"
        case .days: "Days"
        case .wardrobe: "Wardrobe"
        case .packing: "Packing"
        case .route: "Route"
        case .gear: "Gear"
        case .safety: "Safety"
        case .climb: "Climb"
        case .tides: "Tides"
        case .stops: "Stops"
        }
    }

    var symbol: String {
        switch self {
        case .trip: "list.bullet.rectangle"
        case .days: "calendar"
        case .wardrobe: "tshirt"
        case .packing: "checklist"
        case .route: "point.topleft.down.to.point.bottomright.curvepath"
        case .gear: "backpack"
        case .safety: "shield"
        case .climb: "mountain.2"
        case .tides: "water.waves"
        case .stops: "mappin.and.ellipse"
        }
    }
}

// MARK: Trip

struct Trip: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var name: String
    var place: String
    var kind: TripKind
    var start: Date
    var dayCount: Int
    var travellers: Int = 1
    var photo: Photo
    var currency = "€"
    var budgetLimit: Double = 1000
    var plans: [Plan] = []
    var expenses: [Expense] = []
    var packing: [PackItem] = []
    var bagLimitKg: Double = 10
    var capsule: [UUID] = []
    var outfits: [Outfit] = []
    var companions: [Person] = []
    var poll: Poll?
    var balances: [Balance] = []
    /// Money paid back between you and someone, from Settle up.
    var settlements: [Settlement]?
    var stages: [Stage] = []
    var gear: [GearItem] = []
    var porterLimitKg: Double = 15
    var stops: [Stop] = []
    var dives: [Dive] = []
    var adventure: Adventure?
    var stayName: String?
    var stayRating: Int?
    /// Your own cover photo, `<id>.jpg` in Application Support/covers.
    var coverFile: String?
    /// `/api/images/<uuid>` once the cover is in the account.
    var coverRemote: String?
    var createdAt = Date()
    /// Sample trips aren't uploaded to an account unless the user keeps them.
    var isSample: Bool?
    var timeZoneID: String?
    var startDayKey: String?
}

extension Trip {
    var end: Date { date(ofDay: max(dayCount, 1) - 1) }

    func date(ofDay day: Int) -> Date {
        calendar.date(byAdding: .day, value: day, to: civilStart) ?? civilStart
    }

    var dayIndices: Range<Int> { 0..<max(dayCount, 1) }

    enum Status { case upcoming, active, past }

    var status: Status {
        let today = calendar.startOfDay(for: .now)
        if today < calendar.startOfDay(for: civilStart) { return .upcoming }
        if today > calendar.startOfDay(for: end) { return .past }
        return .active
    }

    var daysUntil: Int {
        calendar.dateComponents([.day], from: calendar.startOfDay(for: .now), to: calendar.startOfDay(for: civilStart)).day ?? 0
    }

    /// Zero-based index of today within the trip, if the trip is running.
    var todayIndex: Int? {
        guard status == .active else { return nil }
        return calendar.dateComponents([.day], from: calendar.startOfDay(for: civilStart), to: calendar.startOfDay(for: .now)).day
    }

    /// "IN 6 DAYS", "DAY 3 OF 12", "SEP 21 – 27"
    var countdownLabel: String {
        switch status {
        case .upcoming:
            daysUntil == 1 ? "Tomorrow" : "In \(daysUntil) days"
        case .active:
            "Day \((todayIndex ?? 0) + 1) of \(dayCount)"
        case .past:
            dateRange
        }
    }

    var dateRange: String { Fmt.range(civilStart, end, timeZone: timeZone) }

    func plans(on day: Int) -> [Plan] {
        plans.filter { $0.day == day }.sorted { $0.sortTime < $1.sortTime }
    }

    /// The first plan that has not started yet.
    var nextPlan: Plan? {
        let now = Date.now
        return plans
            .sorted { ($0.day, $0.sortTime) < ($1.day, $1.sortTime) }
            .first { plan in (startDate(of: plan) ?? .distantPast) > now }
    }

    func startDate(of plan: Plan) -> Date? {
        guard let clock = TravelDates.clock(plan.time), dayIndices.contains(plan.day) else { return nil }
        let parts = clock.split(separator: ":").compactMap { Int($0) }
        return calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: date(ofDay: plan.day))
    }

    // Readiness
    var plannedDays: Int { dayIndices.filter { !plans(on: $0).isEmpty }.count }
    var outfitDays: Int { Set(outfits.map(\.day)).count }
    var packedCount: Int { packing.filter(\.packed).count }
    var packedFraction: Double { packing.isEmpty ? 0 : Double(packedCount) / Double(packing.count) }
    /// What's packed out of what's needed: gear for treks, camps and climbs
    /// that list it, the packing list otherwise. Used by reminders and the widget.
    var packingProgress: (packed: Int, total: Int) {
        if kind.isAdventure && !gear.isEmpty { return (gear.filter(\.packed).count, gear.count) }
        return (packedCount, packing.count)
    }
    /// Share of days planned plus share packed. Adventure trips count route
    /// stages and packed gear instead of plans and the packing list.
    var readiness: Double {
        let days = Double(max(dayCount, 1))
        if kind.isAdventure {
            let route = min(Double(Set(stages.map(\.day)).count) / days, 1)
            let packed = gear.isEmpty ? packedFraction : Double(gear.filter(\.packed).count) / Double(gear.count)
            return (route + packed) / 2
        }
        return (Double(plannedDays) / days + packedFraction) / 2
    }
    var bagWeightKg: Double { Double(packing.reduce(0) { $0 + $1.grams }) / 1000 }

    // Budget
    var spendByCategory: [BudgetCategory: Double] {
        var totals: [BudgetCategory: Double] = [:]
        for plan in plans where plan.cost > 0 { totals[plan.category.budget, default: 0] += plan.cost }
        for expense in expenses { totals[expense.category, default: 0] += expense.amount }
        if gearRental > 0 { totals[.other, default: 0] += gearRental }
        if guideCost > 0 { totals[.activities, default: 0] += guideCost }
        if permitFees > 0 { totals[.other, default: 0] += permitFees }
        return totals
    }

    /// A guide you've confirmed, at their daily rate for every day of the trip.
    var guideCost: Double {
        guard let guide = adventure?.guide, guide.booked else { return 0 }
        return Double(max(guide.dayRate, 0)) * Double(max(dayCount, 1))
    }

    /// Permit fees entered as amounts.
    var permitFees: Double {
        (adventure?.permits ?? []).reduce(0) { $0 + max($1.fee ?? 0, 0) }
    }

    /// Gear marked Rent, at its daily rate for every day of the trip.
    var gearRental: Double {
        Double(gear.filter { $0.status == .rent }.reduce(0) { $0 + max($1.rentPerDay ?? 0, 0) }) * Double(max(dayCount, 1))
    }

    var totalPlanned: Double { spendByCategory.values.reduce(0, +) }

    // Split costs
    static let me = "You"

    /// You first, then everyone travelling with you.
    var people: [String] { [Trip.me] + companions.map(\.name) }

    /// What you and each person owe each other, from split expenses, older
    /// hand-entered balances and settlements. Positive: you owe them.
    var ledger: [(person: String, amount: Double)] {
        var net: [String: Double] = [:]
        for expense in expenses {
            guard let group = expense.splitWith, !group.isEmpty else { continue }
            let payer = expense.paidBy ?? Trip.me
            let share = expense.amount / Double(group.count)
            for person in group where person != payer {
                if payer == Trip.me { net[person, default: 0] -= share }
                else if person == Trip.me { net[payer, default: 0] += share }
            }
        }
        for balance in balances where !balance.settled { net[balance.person, default: 0] += balance.amount }
        for payment in settlements ?? [] { net[payment.person, default: 0] -= payment.amount }
        // Anything under half the currency's smallest unit is settled; amounts
        // rounded one by one (say, after a currency change) leave such crumbs.
        let digits = Fmt.currencyFormatter(currency).maximumFractionDigits
        let settledBelow = 0.5 / pow(10, Double(digits))
        return net.filter { abs($0.value) >= settledBelow }
            .map { (person: $0.key, amount: $0.value) }
            .sorted { abs($0.amount) != abs($1.amount) ? abs($0.amount) > abs($1.amount) : $0.person < $1.person }
    }

    /// Whether someone paid for, shares or settled any cost on this trip.
    func hasSharedCosts(with person: String) -> Bool {
        expenses.contains { $0.paidBy == person || $0.splitWith?.contains(person) == true }
            || balances.contains { $0.person == person && !$0.settled }
            || (settlements ?? []).contains { $0.person == person }
    }

    /// Whether anything on this trip is shared at all.
    var hasSplits: Bool { expenses.contains { $0.splitWith?.isEmpty == false } || !balances.isEmpty }

    /// Plans and expenses on that day, plus an even share of whole-trip
    /// expenses (like a stay booked for all nights).
    func spend(onDay day: Int) -> Double {
        let wholeTrip = expenses.filter { $0.day == nil }.reduce(0) { $0 + $1.amount } + gearRental + guideCost + permitFees
        return plans(on: day).reduce(0) { $0 + $1.cost }
            + expenses.filter { $0.day == day }.reduce(0) { $0 + $1.amount }
            + wholeTrip / Double(max(dayCount, 1))
    }

    var addedThisWeek: Double {
        let weekAgo = Date.now.addingTimeInterval(-7 * 86_400)
        return expenses.filter { $0.addedAt > weekAgo }.reduce(0) { $0 + $1.amount }
            + plans.filter { $0.addedAt > weekAgo }.reduce(0) { $0 + $1.cost }
    }

    var walkingKm: Double { plans.reduce(0) { $0 + $1.walkKm } }

    // Route
    var totalKm: Double { stages.reduce(0) { $0 + $1.km } }
    var totalAscent: Int { stages.reduce(0) { $0 + $1.ascent } }
    var maxAltitude: Int { stages.map(\.altitude).max() ?? 0 }
    /// Today's stage: the latest one on or before today (stage days count
    /// from 1), so rest days without a stage keep showing where you are.
    var currentStageIndex: Int {
        guard let today = todayIndex else { return status == .past ? max(stages.count - 1, 0) : 0 }
        return stages.lastIndex { $0.day <= today + 1 } ?? 0
    }
}

// MARK: Plans and budget

enum PlanCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case food, transit, sight, evening, activity, flight, stay

    var id: String { rawValue }

    var title: String {
        switch self {
        case .food: "Food and drink"
        case .transit: "Getting around"
        case .sight: "Sights"
        case .evening: "Evening"
        case .activity: "Activity"
        case .flight: "Flight"
        case .stay: "Stay"
        }
    }

    /// The glowing bar colour on plan cards.
    var color: Color {
        switch self {
        case .food: .amber
        case .transit: .mint
        case .sight, .evening: .violet
        case .activity: .sky
        case .flight: Tile.indigo
        case .stay: Tile.teal
        }
    }

    var tile: Color {
        switch self {
        case .food: Tile.amber
        case .transit: Tile.teal
        case .sight, .evening: Tile.plum
        case .activity: Tile.green
        case .flight: Tile.indigo
        case .stay: Tile.teal
        }
    }

    var symbol: String {
        switch self {
        case .food: "fork.knife"
        case .transit: "tram.fill"
        case .sight: "binoculars.fill"
        case .evening: "sunset.fill"
        case .activity: "figure.walk"
        case .flight: "airplane"
        case .stay: "bed.double.fill"
        }
    }

    var budget: BudgetCategory {
        switch self {
        case .food: .food
        case .transit, .flight: .transport
        case .stay: .stay
        case .sight, .evening, .activity: .activities
        }
    }
}

struct Plan: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var day: Int
    var time: String
    var title: String
    var meta: String = ""
    var category: PlanCategory
    var cost: Double = 0
    var walkKm: Double = 0
    var action: String?
    var notes: String = ""
    var addedAt = Date.distantPast
    var flight: FlightInfo?
}

struct FlightInfo: Codable, Hashable, Sendable {
    var number: String
    var destination: String
    /// Boarding time, "04:10"
    var boards: String
    var gate: String
    var seat: String
    var status = "On time"
}

enum BudgetCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case stay, food, transport, activities, other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .stay: "Stay"
        case .food: "Food and drink"
        case .transport: "Getting around"
        case .activities: "Things to do"
        case .other: "Other"
        }
    }

    var symbol: String {
        switch self {
        case .stay: "bed.double.fill"
        case .food: "fork.knife"
        case .transport: "tram.fill"
        case .activities: "ticket.fill"
        case .other: "creditcard.fill"
        }
    }

    var tile: Color {
        switch self {
        case .stay: Tile.indigo
        case .food: Tile.amber
        case .transport: Tile.teal
        case .activities: Tile.plum
        case .other: Tile.bronze
        }
    }
}

extension Plan {
    /// "HH:mm" for ordering; untimed plans go last in their day.
    var sortTime: String { TravelDates.clock(time) ?? "99:99" }
}

struct Expense: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var title: String
    var meta: String = ""
    var category: BudgetCategory
    var amount: Double
    var day: Int?
    var addedAt = Date.distantPast
    /// Who paid; nil is you.
    var paidBy: String?
    /// Who shares it equally (names, "You" included); nil is not split.
    var splitWith: [String]?
}

// MARK: Packing and wardrobe

struct PackItem: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var name: String
    var section: String
    var meta: String = ""
    var grams: Int = 0
    var packed = false
    var required = false
    var wardrobeID: UUID?
}

enum GarmentCategory: String, Codable, CaseIterable, Identifiable, Sendable {
    case tops, bottoms, dresses, shoes, layers, accessories
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var symbol: String {
        switch self {
        case .tops: "tshirt"
        case .bottoms: "figure.walk"
        case .dresses: "hanger"
        case .shoes: "shoeprints.fill"
        case .layers: "tshirt.fill"
        case .accessories: "eyeglasses"
        }
    }
}

struct WardrobeItem: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var name: String
    var category: GarmentCategory
    var color: UInt32
    var worn: Int = 0
    var grams: Int = 300
    var imageFile: String?
    /// `/api/images/<uuid>` once the photo is in the account.
    var remotePhoto: String?
    /// Part of the sample wardrobe; only uploaded once one of your own trips
    /// uses it.
    var isSample: Bool?
}

struct Outfit: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var day: Int
    var title: String
    var items: [UUID]
}

// MARK: People and sharing

struct Person: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var name: String
    var color: UInt32

    var initials: String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }
}

struct Poll: Codable, Hashable, Sendable {
    var question: String
    var options: [PollOption]
    var myVote: UUID?
    /// Everyone else's vote, by name. nil on older polls, whose option
    /// counts already include your vote.
    var votesBy: [String: UUID]?
}

extension Trip {
    /// Fits day-based items to `dayCount` after the trip got shorter. Moving
    /// puts later plans, stops, dives and stages on the last day, plus one
    /// outfit if the last day has none; otherwise they're removed.
    mutating func fitToLength(movingLaterDays: Bool) {
        let last = dayCount - 1
        if movingLaterDays {
            for i in plans.indices where plans[i].day > last { plans[i].day = last }
            for i in stops.indices where stops[i].day > last { stops[i].day = last }
            for i in dives.indices where dives[i].day > last { dives[i].day = last }
            // Stage days count from 1.
            for i in stages.indices where stages[i].day > dayCount { stages[i].day = dayCount }
            if !outfits.contains(where: { $0.day == last }),
               let latest = outfits.indices.filter({ outfits[$0].day > last }).max(by: { outfits[$0].day < outfits[$1].day }) {
                outfits[latest].day = last
            }
        }
        plans.removeAll { $0.day > last }
        outfits.removeAll { $0.day > last }
        stops.removeAll { $0.day > last }
        dives.removeAll { $0.day > last }
        stages.removeAll { $0.day > dayCount }
    }
}

extension Poll {
    /// Votes for an option: anonymous counts, named votes and yours.
    func count(_ id: UUID) -> Int {
        let base = options.first { $0.id == id }?.votes ?? 0
        guard let votesBy else { return base }
        return base + votesBy.values.filter { $0 == id }.count + (myVote == id ? 1 : 0)
    }

    /// Who voted for an option, by name ("You" first).
    func voters(_ id: UUID) -> [String] {
        (myVote == id ? [Trip.me] : []) + (votesBy ?? [:]).filter { $0.value == id }.map(\.key).sorted()
    }

    var total: Int { options.reduce(0) { $0 + count($1.id) } }

    mutating func vote(_ id: UUID) {
        if votesBy == nil {
            // Older poll: your vote is in the counts.
            if let previous = myVote, let i = options.firstIndex(where: { $0.id == previous }) { options[i].votes = max(0, options[i].votes - 1) }
            if myVote == id { myVote = nil; return }
            if let i = options.firstIndex(where: { $0.id == id }) { options[i].votes += 1; myVote = id }
        } else {
            myVote = myVote == id ? nil : id
        }
    }
}

struct PollOption: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var title: String
    var votes: Int
}

/// A payment between you and one person. Positive: you paid them.
extension Poll {
    /// Non-empty options, the first of each choice kept when two differ only
    /// in case, accents or surrounding spaces.
    static func distinctOptions(_ options: [PollOption]) -> [PollOption] {
        var seen = Set<String>()
        return options.filter { option in
            let key = option.title.trimmingCharacters(in: .whitespacesAndNewlines)
                .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
            return !key.isEmpty && seen.insert(key).inserted
        }
    }
}

struct Settlement: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var person: String
    var amount: Double
    var date = Date()
}

struct Balance: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var person: String
    /// Positive: you owe them. Negative: they owe you.
    var amount: Double
    var settled = false
}

// MARK: Adventure

struct Stage: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var day: Int
    var title: String
    var meta: String
    var km: Double
    var ascent: Int
    /// Sleeping altitude in metres.
    var altitude: Int
    var hours: String = ""
}

extension Stage {
    /// Stored text for sample stages, otherwise built from the numbers in
    /// the user's units.
    var displayMeta: String {
        if !meta.isEmpty { return meta }
        var parts: [String] = []
        if km > 0 { parts.append(Fmt.distance(km)) }
        if ascent > 0 { parts.append("↑ \(Fmt.grouped(ascent)) m") }
        if !hours.isEmpty { parts.append(hours) }
        if altitude > 0 { parts.append("Sleep \(Fmt.grouped(altitude)) m") }
        return parts.joined(separator: " · ")
    }
}

enum GearGroup: String, Codable, CaseIterable, Identifiable, Sendable {
    case sleep, layers, traction, safety, other
    var id: String { rawValue }

    var title: String {
        switch self {
        case .sleep: "Sleep and warmth"
        case .layers: "Layers"
        case .traction: "Traction"
        case .safety: "Safety and first aid"
        case .other: "Other"
        }
    }

    var short: String {
        switch self {
        case .sleep: "Sleep"
        case .layers: "Layers"
        case .traction: "Traction"
        case .safety: "Safety"
        case .other: "Other"
        }
    }

    var color: Color {
        switch self {
        case .sleep: Color(hex: 0x6E5BFF)
        case .layers: .mint
        case .safety: .lime
        case .traction: .sky
        case .other: .white.opacity(0.4)
        }
    }
}

enum GearStatus: String, Codable, CaseIterable, Identifiable, Sendable {
    case need, own, rent
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

struct GearItem: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var name: String
    var group: GearGroup
    var grams: Int
    var status: GearStatus
    var packed = false
    var rentPerDay: Int?
    var required = false
    var note: String = ""
}

struct Stop: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var day: Int
    var name: String
    var meta: String
    var category: PlanCategory
    var done = false
}

struct Dive: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var day: Int
    var site: String
    var depthM: Int
    var minutes: Int
}

struct Permit: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var name: String
    var meta: String
    var paid: Bool
    /// Fee in the trip's currency, counted in the budget; nil when unknown.
    var fee: Double?
}

struct Guide: Codable, Hashable, Sendable {
    var name: String
    var rating: Double
    var trips: Int
    var tags: [String]
    var dayRate: Int
    var booked = false
}

struct TrainingSession: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var title: String
    var meta: String
    var done = false
    var key = false
}

struct Readiness: Codable, Hashable, Sendable {
    var score: Int
    var vo2: Int
    var vo2Change: Int
    var ascentPerWeek: Int
    var ascentChange: Int
    var longHikeKm: Int
    var longHikeGoal: Int
}

struct AltitudeCheckIn: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var date = Date()
    var altitude: Int
    var spo2: Int
    var heartRate: Int
    /// Headache, nausea, fatigue, dizziness, sleep. Each 0–3.
    var symptoms: [Int]

    static let symptomNames = ["Headache", "Nausea", "Fatigue", "Dizziness", "Sleep"]

    var score: Int { symptoms.reduce(0, +) }

    enum Advice { case safe, caution, descend }

    var advice: Advice {
        if spo2 < 80 || score >= 7 || symptoms.first ?? 0 >= 3 { return .descend }
        // Lake Louise: a headache with a total of 3 or more is acute mountain
        // sickness, and the standard advice is not to go higher.
        let headache = symptoms.first ?? 0
        if spo2 < 85 || score >= 5 || (headache >= 1 && score >= 3) { return .caution }
        return .safe
    }

    var scoreLabel: String {
        switch score {
        case 0...2: "\(score) · None"
        case 3...5: "\(score) · Mild"
        case 6...9: "\(score) · Moderate"
        default: "\(score) · Severe"
        }
    }
}

struct WindDay: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var date: Date
    var kmh: Int
}

struct Summit: Codable, Hashable, Sendable {
    var peak: String
    var altitude: Int
    var forecast: [WindDay]
    var dawnTemp: Int
    var leaveTime: String
    var highCamp: Int
    var turnaround: String
    /// When the live forecast was last fetched; nil for sample data.
    var updated: Date?
    /// Dawn temperature per day from the live forecast, by `WindDay.id`.
    var dawnTemps: [UUID: Int]?

    /// Days with wind at or under 25 km/h make the go window.
    var calmLimit: Int { 25 }

    var window: [WindDay] { window(in: forecast) }

    /// The longest run of calm days among `days`.
    func window(in days: [WindDay]) -> [WindDay] {
        var best: [WindDay] = []
        var run: [WindDay] = []
        for day in days {
            if day.kmh <= calmLimit { run.append(day) } else { run = [] }
            if run.count > best.count { best = run }
        }
        return best
    }
}

// `dawnTemps` is written with string keys. A `[UUID: Int]` would encode as a
// key/value array in hash order, which changes every launch, so the same trip
// would look edited to sync each time and spawn "recovered edits" copies.
// The old array form still decodes.
extension Summit {
    private enum CodingKeys: String, CodingKey {
        case peak, altitude, forecast, dawnTemp, leaveTime, highCamp, turnaround, updated, dawnTemps
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        peak = try c.decode(String.self, forKey: .peak)
        altitude = try c.decode(Int.self, forKey: .altitude)
        forecast = try c.decode([WindDay].self, forKey: .forecast)
        dawnTemp = try c.decode(Int.self, forKey: .dawnTemp)
        leaveTime = try c.decode(String.self, forKey: .leaveTime)
        highCamp = try c.decode(Int.self, forKey: .highCamp)
        turnaround = try c.decode(String.self, forKey: .turnaround)
        updated = try c.decodeIfPresent(Date.self, forKey: .updated)
        if let keyed = try? c.decodeIfPresent([String: Int].self, forKey: .dawnTemps) {
            dawnTemps = Dictionary(keyed.compactMap { key, value in UUID(uuidString: key).map { ($0, value) } }, uniquingKeysWith: { a, _ in a })
        } else {
            dawnTemps = try? c.decodeIfPresent([UUID: Int].self, forKey: .dawnTemps)
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(peak, forKey: .peak)
        try c.encode(altitude, forKey: .altitude)
        try c.encode(forecast, forKey: .forecast)
        try c.encode(dawnTemp, forKey: .dawnTemp)
        try c.encode(leaveTime, forKey: .leaveTime)
        try c.encode(highCamp, forKey: .highCamp)
        try c.encode(turnaround, forKey: .turnaround)
        try c.encodeIfPresent(updated, forKey: .updated)
        try c.encodeIfPresent(dawnTemps.map { Dictionary(uniqueKeysWithValues: $0.map { ($0.key.uuidString, $0.value) }) }, forKey: .dawnTemps)
    }
}

struct Adventure: Codable, Hashable, Sendable {
    var permits: [Permit] = []
    var guide: Guide?
    var insurance: String = ""
    var insuranceMeta: String = ""
    var training: [TrainingSession] = []
    var readiness: Readiness?
    var checkIns: [AltitudeCheckIn] = []
    var checkInReminders = false
    var nextCheckIn = "16:00"
    /// Who to tell at check-in time, e.g. "Mum + Rahul". Empty until set.
    var contacts = ""
    var summit: Summit?
    var emergencyNumber: String?
}

// MARK: Profile

/// The choices offered for each travel preference, shared by Profile,
/// onboarding and Travel preferences so they always match.
enum PreferenceOptions {
    static let styles = ["City + Trek", "City", "Trek and climb", "Beach", "Road trips", "A bit of everything"]
    static let paces = ["Relaxed", "Balanced", "Walks a lot", "Packed days"]
    static let diets = ["No preference", "Vegetarian", "Vegan", "Pescatarian", "Gluten-free", "Dairy-free"]
    static let budgets = ["Budget", "Mid-range", "Luxury"]

    /// Older installs stored region-specific diets; fold them into the
    /// international list so Profile never shows a choice that isn't offered.
    static func currentDiet(_ diet: String) -> String {
        switch diet {
        case "Eggetarian", "Jain": "Vegetarian"
        case let d where diets.contains(d): d
        default: "No preference"
        }
    }

    /// What the person is here for; onboarding lands them accordingly.
    enum Intent: String, CaseIterable, Codable, Sendable {
        case booked, planning, exploring

        var title: String {
            switch self {
            case .booked: "A trip that's already booked"
            case .planning: "A trip I'm still shaping"
            case .exploring: "Just looking for now"
            }
        }
        var detail: String {
            switch self {
            case .booked: "Add the dates and bookings. We'll build the days around them."
            case .planning: "Describe it, and get a first draft of days, stays and packing."
            case .exploring: "Browse ideas, and start a trip whenever you're ready."
            }
        }
        var symbol: String {
            switch self {
            case .booked: "airplane.departure"
            case .planning: "sparkles"
            case .exploring: "safari"
            }
        }
    }

    /// The parts of a trip the app looks after. Chosen in onboarding; the
    /// home screen and Discover lead with these.
    struct Focus: Hashable, Identifiable, Sendable {
        var id: String
        var title: String
        var detail: String
        var symbol: String
    }
    static let focuses: [Focus] = [
        Focus(id: "days", title: "Day-by-day plans", detail: "Every stay, table and ticket in its place.", symbol: "calendar"),
        Focus(id: "packing", title: "Packing and outfits", detail: "What to wear, built from your wardrobe and the forecast.", symbol: "tshirt"),
        Focus(id: "money", title: "Budget and shared costs", detail: "Know what it costs, and who owes whom.", symbol: "creditcard"),
        Focus(id: "documents", title: "Bookings and documents", detail: "Tickets, passes and confirmations, offline.", symbol: "doc.text"),
        Focus(id: "adventure", title: "Treks, climbs and safety", detail: "Routes, altitude checks and check-ins at home.", symbol: "mountain.2"),
        Focus(id: "together", title: "Travelling together", detail: "Shared plans, polls and split costs.", symbol: "person.2"),
    ]

    /// Trip kinds a travel style leans toward, for Discover.
    static func kinds(for style: String) -> Set<TripKind> {
        switch style {
        case "City": [.city]
        case "Trek and climb": [.trek, .climb, .camp]
        case "Beach": [.beach]
        case "Road trips": [.road]
        case "City + Trek": [.city, .trek]
        default: []
        }
    }
}

struct Profile: Codable, Hashable, Sendable {
    var name: String = ""
    var isPro = false
    var proPlan: String?
    var travelStyle = "A bit of everything"
    var homeAirport = ""
    var metric = true
    var reminders = false
    var iCloudSync = false
    var diet = "No preference"
    var budgetStyle = "Mid-range"
    var pace = "Balanced"
    /// `nil` until the sample-trips notice has been answered.
    var sampleNoticeDismissed: Bool?
    /// The signed-in account's email, for display.
    var email: String?
    /// Free-plan AI drafts: the month counted ("2026-09") and how many.
    var aiDraftMonth: String?
    var aiDraftCount: Int?
    /// Pro: ask for Face ID before showing travel documents.
    var lockDocuments: Bool?
    var onboardingCompleted: Bool?
    /// Why they came (onboarding), and the parts of a trip they care about.
    var intent: PreferenceOptions.Intent?
    var focus: [String]?
    /// Currency for new trips and conversions, as a code ("EUR"). `nil`
    /// follows the phone's region.
    var currency: String?

    var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }
    var initials: String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }

    /// Initials, or "You" before a name is set.
    var badge: String { initials.isEmpty ? "You" : initials }
}

enum Session: String, Codable, Sendable {
    /// `guest` is only read from older installs; it's moved to `signedOut`
    /// on launch, keeping the trips so they join the account after sign-in.
    case signedOut, guest, apple, email, google

    /// Signed in with an account (the session may still need refreshing).
    var isAccount: Bool { self == .email || self == .apple || self == .google }
}
