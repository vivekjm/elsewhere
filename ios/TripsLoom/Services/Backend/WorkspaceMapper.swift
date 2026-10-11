import CryptoKit
import Foundation

/// Converts between the app's trips and the shared web workspace
/// (`lib/model.ts`, version 1).
///
/// Export starts from the last server copy of each record and overwrites only
/// the fields the app edits, so web-only details (links, notes, end times,
/// occasions) survive a round trip through the phone. Import keeps the app's
/// own details for records it already knows.
enum WorkspaceMapper {
    typealias JSON = [String: Any]

    static let day: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// A JSON number whether it arrived as an integer or a decimal.
    static func number(_ value: Any?) -> Double? {
        switch value {
        case let v as Int: Double(v)
        case let v as Double: v
        case let v as NSNumber where !(v is Bool): v.doubleValue
        default: nil
        }
    }

    static func key(_ id: UUID) -> String { id.uuidString.lowercased() }

    /// Web IDs are usually UUIDs; anything else maps to a stable UUID from a
    /// hash of its text.
    static func uuid(_ string: String) -> UUID {
        if let id = UUID(uuidString: string) { return id }
        var bytes = Array(SHA256.hash(data: Data(string.utf8)).prefix(16))
        bytes[6] = (bytes[6] & 0x0F) | 0x50
        bytes[8] = (bytes[8] & 0x3F) | 0x80
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }

    // MARK: Vocabulary

    static let currencies: [(symbol: String, code: String)] = [
        ("€", "EUR"), ("$", "USD"), ("₹", "INR"), ("£", "GBP"), ("रू", "NPR"), ("¥", "JPY"), ("AED", "AED"), ("C$", "CAD"), ("A$", "AUD"),
    ]
    static func code(_ symbol: String) -> String { CurrencyService.code(for: symbol) ?? currencies.first { $0.symbol == symbol }?.code ?? "EUR" }
    static func symbol(_ code: String) -> String { code }

    static func activityType(_ category: PlanCategory) -> String {
        switch category {
        case .food: "Food & drink"
        case .transit, .flight: "Travel"
        case .stay: "Stay"
        case .sight, .activity: "Explore"
        case .evening: "Event"
        }
    }

    static func planCategory(_ type: String) -> PlanCategory {
        switch type {
        case "Food & drink": .food
        case "Travel": .transit
        case "Stay": .stay
        case "Event": .evening
        case "Explore": .sight
        default: .activity
        }
    }

    static func itemCategory(_ category: GarmentCategory) -> String {
        switch category {
        case .tops, .dresses: "Tops"
        case .bottoms: "Bottoms"
        case .shoes: "Shoes"
        case .layers: "Layers"
        case .accessories: "Accessories"
        }
    }

    static func shape(_ category: GarmentCategory) -> String {
        switch category {
        case .tops: "shirt"
        case .dresses: "dress"
        case .bottoms: "pants"
        case .shoes: "sneakers"
        case .layers: "coat"
        case .accessories: "hat"
        }
    }

    static func garment(category: String, shape: String?) -> GarmentCategory {
        if shape == "dress" { return .dresses }
        switch category {
        case "Bottoms": return .bottoms
        case "Shoes": return .shoes
        case "Layers": return .layers
        case "Accessories", "Gear": return .accessories
        default: return .tops
        }
    }

    static func extraCategory(_ section: String) -> String {
        switch section {
        case "Documents": "Documents"
        case "Toiletries": "Toiletries"
        case "Tech": "Electronics"
        case "Health", "First aid": "Health & care"
        case "Clothes": "Other"
        default: "Essentials"
        }
    }

    static func section(_ category: String) -> String {
        switch category {
        case "Documents": "Documents"
        case "Toiletries": "Toiletries"
        case "Electronics": "Tech"
        case "Health & care": "Toiletries"
        case "Other": "Clothes"
        default: "Essentials"
        }
    }

    static func theme(_ photo: Photo, kind: TripKind) -> String {
        switch photo {
        case .himalaya: "mountains"
        case .beach: "coast"
        case .aurora: "aurora"
        case .lisbon, .tram: kind == .road ? "desert" : "city"
        }
    }

    static func photo(theme: String) -> Photo {
        switch theme {
        case "mountains", "forest", "lake": .himalaya
        case "coast", "island": .beach
        case "aurora": .aurora
        case "desert": .tram
        default: .lisbon
        }
    }

    /// Trips made on the website have no type. They open as city trips (or
    /// beach for coastal covers) so their days, plans and outfits have tabs.
    static func kind(theme: String) -> TripKind {
        switch theme {
        case "coast", "island": .beach
        default: .city
        }
    }

    static func hex(_ color: UInt32) -> String { String(format: "#%06x", color & 0xFFFFFF) }
    static func color(_ hex: String) -> UInt32 { UInt32(hex.dropFirst(), radix: 16) ?? 0x8B8B73 }

    private static func clip(_ text: String, _ max: Int = 200) -> String { String(text.prefix(max)) }
    private static func validTime(_ time: String) -> String { TravelDates.clock(time) ?? "" }
    private static func byID(_ list: Any?) -> [String: JSON] {
        var result: [String: JSON] = [:]
        for case let row as JSON in (list as? [Any]) ?? [] {
            if let id = row["id"] as? String { result[id.lowercased()] = row }
        }
        return result
    }

    // MARK: IDs

    /// Rewrites every ID in a workspace, records and references alike.
    static func rekey(_ workspace: JSON, _ map: (String) -> String) -> JSON {
        func one(_ value: Any?) -> Any? { (value as? String).map { $0.isEmpty ? $0 : map($0) } ?? value }
        func list(_ value: Any?) -> Any? { (value as? [Any])?.map { one($0) ?? $0 } ?? value }
        func rows(_ value: Any?, _ body: (inout JSON) -> Void) -> Any? {
            (value as? [Any])?.map { element -> Any in
                guard var row = element as? JSON else { return element }
                row["id"] = one(row["id"])
                body(&row)
                return row
            } ?? value
        }
        var result = workspace
        result["items"] = rows(workspace["items"]) { _ in }
        result["outfits"] = rows(workspace["outfits"]) { $0["items"] = list($0["items"]) }
        result["trips"] = rows(workspace["trips"]) { trip in
            trip["activities"] = rows(trip["activities"]) { a in
                a["outfitId"] = one(a["outfitId"])
                a["gear"] = list(a["gear"])
            }
            if let days = trip["days"] as? JSON {
                trip["days"] = days.mapValues { value -> Any in
                    guard var d = value as? JSON else { return value }
                    d["outfitId"] = one(d["outfitId"])
                    d["outfitIds"] = list(d["outfitIds"])
                    d["gear"] = list(d["gear"])
                    return d
                }
            }
            trip["extras"] = rows(trip["extras"]) { _ in }
            trip["packed"] = list(trip["packed"])
        }
        return result
    }

    /// The app's form of a web ID: a lowercased UUID.
    static func canonical(_ id: String) -> String { key(uuid(id)) }

    // MARK: Export

    /// Writes the app's trips over the last server copy. Records that came
    /// from the web keep their original IDs, even ones that aren't UUIDs.
    static func export(trips: [Trip], wardrobe: [WardrobeItem], base original: JSON?) -> JSON {
        var originals: [String: String] = [:]
        let base = original.map { rekey($0) { id in
            let key = canonical(id)
            originals[key] = originals[key] ?? id
            return key
        } }
        let result = exportCanonical(trips: trips, wardrobe: wardrobe, base: base)
        return originals.isEmpty ? result : rekey(result) { originals[$0.lowercased()] ?? $0 }
    }

    private static func exportCanonical(trips: [Trip], wardrobe: [WardrobeItem], base: JSON?) -> JSON {
        let baseItems = byID(base?["items"]), baseOutfits = byID(base?["outfits"]), baseTrips = byID(base?["trips"])

        // Wardrobe
        var items: [JSON] = []
        for item in wardrobe {
            var row = baseItems[key(item.id)] ?? [:]
            let category = itemCategory(item.category)
            row["id"] = key(item.id)
            row["name"] = clip(item.name.isEmpty ? "Item" : item.name)
            if row["category"] as? String != category || (item.category == .dresses) != (row["shape"] as? String == "dress") {
                row["shape"] = shape(item.category)
            }
            row["category"] = category
            row["weight"] = max(0, min(item.grams, 50_000))
            row["image"] = item.remotePhoto ?? ""
            row["color"] = hex(item.color)
            row["notes"] = row["notes"] as? String ?? ""
            items.append(row)
        }
        let itemIDs = Set(items.compactMap { $0["id"] as? String })

        // Outfits: the app keeps them per trip; the web keeps one list.
        var outfits: [JSON] = []
        var nativeOutfitIDs = Set<String>()
        for trip in trips {
            for outfit in trip.outfits where !nativeOutfitIDs.contains(key(outfit.id)) {
                nativeOutfitIDs.insert(key(outfit.id))
                var row = baseOutfits[key(outfit.id)] ?? [:]
                row["id"] = key(outfit.id)
                row["name"] = clip(outfit.title.isEmpty ? "Outfit" : outfit.title)
                row["items"] = Array(Set(outfit.items.map(key))).filter(itemIDs.contains).sorted()
                row["occasion"] = row["occasion"] as? String ?? "Everyday"
                row["notes"] = row["notes"] as? String ?? ""
                outfits.append(row)
            }
        }
        // Keep web outfits the app doesn't show, unless the app removed them
        // from one of its trips.
        let nativeTripIDs = Set(trips.map { key($0.id) })
        var removedOutfits = Set<String>()
        for (id, trip) in baseTrips where nativeTripIDs.contains(id) {
            for case let day as JSON in ((trip["days"] as? JSON) ?? [:]).values {
                for outfit in [day["outfitId"] as? String] + ((day["outfitIds"] as? [String]) ?? []) {
                    if let outfit, !outfit.isEmpty, !nativeOutfitIDs.contains(outfit.lowercased()) { removedOutfits.insert(outfit.lowercased()) }
                }
            }
        }
        for (id, var row) in baseOutfits where !nativeOutfitIDs.contains(id) && !removedOutfits.contains(id) {
            row["items"] = ((row["items"] as? [String]) ?? []).filter { itemIDs.contains($0.lowercased()) }
            outfits.append(row)
        }
        let outfitIDs = Set(outfits.compactMap { ($0["id"] as? String)?.lowercased() })

        // Trips
        var rows: [JSON] = []
        for trip in trips {
            var row = baseTrips[key(trip.id)] ?? [:]
            let dates = trip.dayIndices.map { trip.dayKey($0) }
            row["id"] = key(trip.id)
            row["name"] = clip(trip.name.isEmpty ? "Trip" : trip.name)
            row["destination"] = clip(trip.place.isEmpty ? trip.name : trip.place)
            row["start"] = dates.first
            row["end"] = dates.last
            row["travellers"] = max(1, min(trip.travellers, 100))
            row["budget"] = max(0, min(trip.budgetLimit, 10_000_000))
            row["currency"] = code(trip.currency)
            row["weightLimit"] = max(0, min(trip.bagLimitKg, 1000))
            if (row["theme"] as? String).map(photo(theme:)) != trip.photo { row["theme"] = theme(trip.photo, kind: trip.kind) }
            row["notes"] = row["notes"] as? String ?? ""

            let baseActivities = byID(row["activities"])
            row["activities"] = trip.plans.filter { trip.dayIndices.contains($0.day) }.map { plan -> JSON in
                var a = baseActivities[key(plan.id)] ?? [:]
                let time = validTime(plan.time)
                a["id"] = key(plan.id)
                a["date"] = dates[plan.day]
                a["time"] = time
                if let end = a["endTime"] as? String, !end.isEmpty, time.isEmpty || end <= time { a["endTime"] = "" }
                a["endTime"] = a["endTime"] as? String ?? ""
                a["title"] = clip(plan.title.isEmpty ? "Plan" : plan.title)
                a["place"] = clip(plan.meta)
                if (a["category"] as? String).map(planCategory) != plan.category || a["category"] == nil {
                    a["category"] = activityType(plan.category)
                }
                a["cost"] = max(0, min(plan.cost, 10_000_000))
                a["link"] = a["link"] as? String ?? ""
                a["notes"] = clip(plan.notes, 5000)
                if let outfit = a["outfitId"] as? String, !outfit.isEmpty, !outfitIDs.contains(outfit.lowercased()) { a["outfitId"] = "" }
                a["outfitId"] = a["outfitId"] as? String ?? ""
                a["gear"] = ((a["gear"] as? [String]) ?? []).filter { itemIDs.contains($0.lowercased()) }
                a["completed"] = a["completed"] as? Bool ?? false
                return a
            }

            // Days: outfits per date, the stay on the first day, and wardrobe
            // pieces packed outside any outfit as that day's gear.
            let baseDays = (row["days"] as? JSON) ?? [:]
            let inOutfits = Set(trip.outfits.flatMap(\.items))
            let loose = trip.packing.compactMap(\.wardrobeID).filter { !inOutfits.contains($0) }.map(key).filter(itemIDs.contains)
            var days: JSON = [:]
            for (index, date) in dates.enumerated() {
                var d = (baseDays[date] as? JSON) ?? [:]
                let dayOutfits = trip.outfits.filter { $0.day == index }.map { key($0.id) }
                d["outfitIds"] = dayOutfits
                d["outfitId"] = dayOutfits.first ?? ""
                d["title"] = d["title"] as? String ?? ""
                if index == 0, let stay = trip.stayName, (d["stay"] as? String ?? "").isEmpty { d["stay"] = clip(stay) }
                d["stay"] = d["stay"] as? String ?? ""
                d["notes"] = d["notes"] as? String ?? ""
                var gear = ((d["gear"] as? [String]) ?? []).filter { itemIDs.contains($0.lowercased()) }
                if index == 0 { gear = Array(Set(gear + loose)).sorted() }
                d["gear"] = gear
                let empty = dayOutfits.isEmpty && gear.isEmpty && (d["stay"] as? String ?? "").isEmpty
                    && (d["notes"] as? String ?? "").isEmpty && (d["title"] as? String ?? "").isEmpty
                if !empty || baseDays[date] != nil { days[date] = d }
            }
            row["days"] = days

            // Packing extras, plus adventure gear so the web packing list
            // shows it too.
            let baseExtras = byID(row["extras"])
            var extras: [JSON] = trip.packing.filter { $0.wardrobeID == nil }.map { item in
                var e = baseExtras[key(item.id)] ?? [:]
                e["id"] = key(item.id)
                e["name"] = clip(item.name.isEmpty ? "Item" : item.name)
                e["quantity"] = number(e["quantity"]).map { Int($0) } ?? 1
                e["weight"] = max(0, min(item.grams, 50_000))
                e["packed"] = item.packed
                if (e["category"] as? String).map(section) != item.section { e["category"] = extraCategory(item.section) }
                return e
            }
            extras += trip.gear.map { gear in
                var e = baseExtras[key(gear.id)] ?? [:]
                e["id"] = key(gear.id)
                e["name"] = clip(gear.name)
                e["quantity"] = number(e["quantity"]).map { Int($0) } ?? 1
                e["weight"] = max(0, min(gear.grams, 50_000))
                e["packed"] = gear.packed
                e["category"] = gear.group == .safety ? "Health & care" : "Essentials"
                return e
            }
            row["extras"] = extras
            row["packed"] = Array(Set(trip.packing.filter { $0.packed }.compactMap(\.wardrobeID).map(key)).filter(itemIDs.contains)).sorted()
            rows.append(row)
        }

        return ["version": 1, "trips": rows, "items": items, "outfits": outfits]
    }

    // MARK: Import

    struct Imported {
        var trips: [Trip]
        var wardrobe: [WardrobeItem]
    }

    /// `known` trips supply the app's own details; `extras` are the same
    /// details from another device, used for trips this iPhone hasn't seen.
    static func importWorkspace(_ original: JSON, known: [Trip], wardrobe local: [WardrobeItem], extras: [String: Data]) -> Imported {
        let workspace = rekey(original, canonical)
        let knownTrips = Dictionary(known.map { (key($0.id), $0) }, uniquingKeysWith: { a, _ in a })
        let knownItems = Dictionary(local.map { (key($0.id), $0) }, uniquingKeysWith: { a, _ in a })
        let webOutfits = byID(workspace["outfits"])

        var wardrobe: [WardrobeItem] = []
        var itemKinds: [String: String] = [:]
        for case let row as JSON in (workspace["items"] as? [Any]) ?? [] {
            guard let id = row["id"] as? String else { continue }
            var item = knownItems[id.lowercased()] ?? WardrobeItem(id: uuid(id), name: "", category: .tops, color: 0x8B8B73)
            let category = row["category"] as? String ?? "Tops"
            itemKinds[id.lowercased()] = category
            item.name = row["name"] as? String ?? item.name
            item.category = garment(category: category, shape: row["shape"] as? String)
            item.color = color(row["color"] as? String ?? "#8b8b73")
            item.grams = Int(number(row["weight"]) ?? Double(item.grams))
            let image = row["image"] as? String ?? ""
            if image != (item.remotePhoto ?? "") {
                item.remotePhoto = image.isEmpty ? nil : image
                item.imageFile = nil // The cached photo belongs to the previous remote image.
            }
            wardrobe.append(item)
        }

        var trips: [Trip] = []
        for case let row as JSON in (workspace["trips"] as? [Any]) ?? [] {
            guard let id = row["id"] as? String,
                  let startText = row["start"] as? String, let start = day.date(from: startText),
                  let endText = row["end"] as? String, let end = day.date(from: endText)
            else { continue }
            let mood = row["theme"] as? String ?? "mountains"
            let local = knownTrips[id.lowercased()]
            let base = extras[id.lowercased()].flatMap { try? JSONDecoder.store.decode(Trip.self, from: $0) }
                ?? local
            var trip = base ?? Trip(id: uuid(id), name: "", place: "", kind: kind(theme: mood), start: start, dayCount: 1, photo: photo(theme: mood))
            if trip.coverRemote == local?.coverRemote { trip.coverFile = local?.coverFile }
            else { trip.coverFile = nil }
            if let health = local?.adventure {
                if trip.adventure == nil { trip.adventure = Adventure() }
                trip.adventure?.checkIns = health.checkIns
                trip.adventure?.readiness = health.readiness
            } else {
                trip.adventure?.checkIns = []
                trip.adventure?.readiness = nil
            }
            if base == nil { trip.budgetLimit = 0 }
            let localStart = TravelDates.date(startText, in: trip.timeZone) ?? start
            let localEnd = TravelDates.date(endText, in: trip.timeZone) ?? end
            let count = (trip.calendar.dateComponents([.day], from: localStart, to: localEnd).day ?? 0) + 1
            trip.name = row["name"] as? String ?? trip.name
            trip.place = row["destination"] as? String ?? trip.place
            trip.startDayKey = startText
            trip.start = TravelDates.date(startText, in: trip.timeZone) ?? start
            trip.dayCount = min(366, max(1, count))
            trip.travellers = number(row["travellers"]).map { Int($0) } ?? trip.travellers
            trip.budgetLimit = number(row["budget"]) ?? trip.budgetLimit
            trip.currency = symbol(row["currency"] as? String ?? "EUR")
            trip.bagLimitKg = number(row["weightLimit"]) ?? trip.bagLimitKg
            // A cover changed on the web replaces the app's photo.
            if let base, theme(base.photo, kind: base.kind) != mood, photo(theme: mood) != base.photo {
                trip.photo = photo(theme: mood)
            }
            trip.isSample = nil

            // Plans
            let knownPlans = Dictionary(trip.plans.map { (key($0.id), $0) }, uniquingKeysWith: { a, _ in a })
            trip.plans = ((row["activities"] as? [Any]) ?? []).compactMap { value -> Plan? in
                guard let a = value as? JSON, let aid = a["id"] as? String,
                      let dateText = a["date"] as? String, let date = TravelDates.date(dateText, in: trip.timeZone) else { return nil }
                let index = trip.calendar.dateComponents([.day], from: localStart, to: date).day ?? 0
                let type = a["category"] as? String ?? "Other"
                var plan = knownPlans[aid.lowercased()] ?? Plan(id: uuid(aid), day: index, time: "", title: "", category: planCategory(type), addedAt: .now)
                plan.day = index
                plan.time = a["time"] as? String ?? plan.time
                plan.title = a["title"] as? String ?? plan.title
                plan.meta = a["place"] as? String ?? plan.meta
                if activityType(plan.category) != type { plan.category = planCategory(type) }
                plan.cost = number(a["cost"]) ?? plan.cost
                plan.notes = a["notes"] as? String ?? plan.notes
                return plan
            }

            // Outfits and stay from the days
            let days = (row["days"] as? JSON) ?? [:]
            var outfits: [Outfit] = []
            var seen = Set<String>()
            var gearByItem = Set<String>()
            for (dateText, value) in days.sorted(by: { $0.key < $1.key }) {
                guard let d = value as? JSON, let date = TravelDates.date(dateText, in: trip.timeZone) else { continue }
                let index = trip.calendar.dateComponents([.day], from: localStart, to: date).day ?? 0
                // `outfitId` is the first of `outfitIds`; count each once.
                var ids: [String] = []
                for oid in [d["outfitId"] as? String ?? ""] + ((d["outfitIds"] as? [String]) ?? [])
                where !oid.isEmpty && !ids.contains(where: { $0.caseInsensitiveCompare(oid) == .orderedSame }) {
                    ids.append(oid)
                }
                for oid in ids {
                    let lower = oid.lowercased()
                    guard let o = webOutfits[lower] else { continue }
                    // A web outfit worn on several days becomes one per day here.
                    let outfitID = seen.contains(lower) ? uuid("\(lower)-\(index)") : uuid(oid)
                    seen.insert(lower)
                    outfits.append(Outfit(id: outfitID, day: index, title: o["name"] as? String ?? "Outfit",
                                          items: ((o["items"] as? [String]) ?? []).map(uuid)))
                }
                ((d["gear"] as? [String]) ?? []).forEach { gearByItem.insert($0.lowercased()) }
                if index == 0, let stay = d["stay"] as? String, !stay.isEmpty { trip.stayName = stay }
            }
            trip.outfits = outfits
            for case let a as JSON in (row["activities"] as? [Any]) ?? [] {
                ((a["gear"] as? [String]) ?? []).forEach { gearByItem.insert($0.lowercased()) }
            }

            // Packing: extras, then wardrobe pieces from outfits and day gear.
            let gearIDs = Set(trip.gear.map { key($0.id) })
            let knownPack = Dictionary(trip.packing.map { (key($0.id), $0) }, uniquingKeysWith: { a, _ in a })
            let knownLinked = Dictionary(trip.packing.compactMap { p in p.wardrobeID.map { (key($0), p) } }, uniquingKeysWith: { a, _ in a })
            var packing: [PackItem] = []
            for case let e as JSON in (row["extras"] as? [Any]) ?? [] {
                guard let eid = e["id"] as? String else { continue }
                let lower = eid.lowercased()
                if gearIDs.contains(lower) {
                    if let i = trip.gear.firstIndex(where: { key($0.id) == lower }) { trip.gear[i].packed = e["packed"] as? Bool ?? false }
                    continue
                }
                var item = knownPack[lower] ?? PackItem(id: uuid(eid), name: "", section: section(e["category"] as? String ?? "Essentials"))
                item.name = e["name"] as? String ?? item.name
                item.grams = Int(number(e["weight"]) ?? Double(item.grams))
                item.packed = e["packed"] as? Bool ?? item.packed
                if item.meta.isEmpty { item.meta = e["category"] as? String ?? "" }
                if let quantity = number(e["quantity"]).map({ Int($0) }), quantity > 1, !item.name.contains("×") { item.name += " × \(quantity)" }
                packing.append(item)
            }
            let packed = Set(((row["packed"] as? [String]) ?? []).map { $0.lowercased() })
            let needed = Set(outfits.flatMap(\.items).map(key)).union(gearByItem)
            for itemID in needed.sorted() {
                guard let piece = wardrobe.first(where: { key($0.id) == itemID }) else { continue }
                var item = knownLinked[itemID] ?? PackItem(
                    name: piece.name,
                    section: itemKinds[itemID] == "Gear" || itemKinds[itemID] == "Accessories" ? "Essentials" : "Clothes",
                    meta: "\(piece.category.title) · from wardrobe",
                    grams: piece.grams,
                    wardrobeID: piece.id
                )
                item.name = piece.name
                item.grams = piece.grams
                item.packed = packed.contains(itemID)
                packing.append(item)
            }
            trip.packing = packing
            trip.capsule = packing.compactMap(\.wardrobeID)
            trips.append(trip)
        }
        return Imported(trips: trips, wardrobe: wardrobe)
    }
}
