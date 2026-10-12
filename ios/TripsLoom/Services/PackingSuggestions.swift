import Foundation

/// Rule-based starting lists by trip type and length. Wardrobe pieces are
/// matched by category so the list uses what you own.
enum PackingSuggestions {
    private static let generic: [GarmentCategory: (name: String, grams: Int)] = [
        .tops: ("T-shirts", 150), .bottoms: ("Trousers", 450), .shoes: ("Walking shoes", 700), .layers: ("Light jacket", 400),
    ]

    static func items(for kind: TripKind, days: Int, wardrobe: [WardrobeItem]) -> [PackItem] {
        var items: [PackItem] = []

        /// Pieces you own, or a plain suggestion when the wardrobe has none.
        func fromWardrobe(_ category: GarmentCategory, count: Int) {
            let owned = wardrobe.filter { $0.category == category }.prefix(count)
            for piece in owned {
                items.append(PackItem(name: piece.name, section: "Clothes", meta: "\(category.title) · from wardrobe", grams: piece.grams, wardrobeID: piece.id))
            }
            guard owned.isEmpty, count > 0, let generic = generic[category] else { return }
            let name = count > 1 ? "\(generic.name) × \(count)" : generic.name
            items.append(PackItem(name: name, section: "Clothes", meta: category.title, grams: generic.grams * count))
        }

        switch kind {
        case .city, .road:
            fromWardrobe(.tops, count: min(3, days))
            fromWardrobe(.bottoms, count: 2)
            fromWardrobe(.shoes, count: 1)
            fromWardrobe(.layers, count: 1)
        case .beach:
            items.append(PackItem(name: "Swimwear × 2", section: "Clothes", meta: "Beach", grams: 200))
            fromWardrobe(.tops, count: 2)
            fromWardrobe(.bottoms, count: 1)
            items.append(PackItem(name: "Reef-safe sunscreen", section: "Toiletries", meta: "Wash bag", grams: 180))
            items.append(PackItem(name: "Mask and snorkel", section: "Essentials", meta: "Water", grams: 350))
        case .trek, .climb, .camp:
            items.append(PackItem(name: "Merino tees × 2", section: "Clothes", meta: "Base layer", grams: 300))
            items.append(PackItem(name: "Hiking socks × 3", section: "Clothes", meta: "Wool", grams: 240))
        }

        let nights = max(days - 1, 1)
        items.append(PackItem(name: "Socks × \(min(nights + 1, 7))", section: "Clothes", meta: "Basics", grams: 50 * min(nights + 1, 7)))
        items.append(PackItem(name: "Underwear × \(min(nights + 1, 7))", section: "Clothes", meta: "Basics", grams: 50 * min(nights + 1, 7)))
        items.append(PackItem(name: "ID or passport", section: "Essentials", meta: "Documents", grams: 40, required: true))
        items.append(PackItem(name: "Phone charger", section: "Essentials", meta: "Tech", grams: 90))
        items.append(PackItem(name: "Power bank", section: "Essentials", meta: "Tech", grams: 220))
        items.append(PackItem(name: "Toothbrush and paste", section: "Toiletries", meta: "Wash bag", grams: 120))
        // Beach trips already pack reef-safe sunscreen.
        if kind != .beach { items.append(PackItem(name: "Sunscreen", section: "Toiletries", meta: "Wash bag", grams: 150)) }
        return items
    }

    static func gear(for kind: TripKind) -> [GearItem] {
        var gear: [GearItem] = [
            GearItem(name: "Down jacket", group: .layers, grams: 600, status: .need),
            GearItem(name: "Rain shell", group: .layers, grams: 350, status: .need),
            GearItem(name: "Sleeping bag", group: .sleep, grams: 1400, status: .need),
            GearItem(name: "Headlamp", group: .safety, grams: 100, status: .need, required: true),
            GearItem(name: "First aid kit", group: .safety, grams: 400, status: .need, required: true),
            GearItem(name: "Water filter", group: .safety, grams: 120, status: .need),
            GearItem(name: "Trekking poles", group: .traction, grams: 480, status: .need),
        ]
        switch kind {
        case .camp:
            gear.append(GearItem(name: "Tent, 2 person", group: .sleep, grams: 1800, status: .need))
            gear.append(GearItem(name: "Sleeping mat", group: .sleep, grams: 450, status: .need))
            gear.append(GearItem(name: "Stove and gas", group: .other, grams: 500, status: .need))
        case .climb:
            gear.append(GearItem(name: "Crampons", group: .traction, grams: 900, status: .rent))
            gear.append(GearItem(name: "Harness", group: .safety, grams: 400, status: .need, required: true))
            gear.append(GearItem(name: "Helmet", group: .safety, grams: 350, status: .need, required: true))
        default:
            break
        }
        return gear
    }

    /// Items the list is missing, compared with a fresh suggestion.
    static func missing(for trip: Trip, wardrobe: [WardrobeItem]) -> [PackItem] {
        let names = Set(trip.packing.map { $0.name.lowercased() })
        return items(for: trip.kind, days: trip.dayCount, wardrobe: wardrobe)
            .filter { !names.contains($0.name.lowercased()) }
    }
}
