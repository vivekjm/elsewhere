import Foundation

/// An offline, versioned export. Sessions and purchase entitlements are excluded.
/// Version 2 includes locally available photos and documents. Exported JSON is
/// not password encrypted: the user must keep shared copies privately.
enum DataPortability {
    struct Archive: Codable {
        var version = 1
        var exportedAt = Date()
        var trips: [Trip]
        var wardrobe: [WardrobeItem]
        var profile: Profile
        var assets: [Asset]?
        var documents: [TripDocuments.Document]?
    }

    static func encode(trips: [Trip], wardrobe: [WardrobeItem], profile: Profile) throws -> Data {
        var profile = profile
        profile.isPro = false
        profile.proPlan = nil
        profile.email = nil
        let archive = Archive(trips: trips, wardrobe: wardrobe, profile: profile)
        try validate(archive)
        return try JSONEncoder.store.encode(archive)
    }

    static func decode(_ data: Data) throws -> Archive {
        guard data.count <= 24 * 1024 * 1024 else { throw BackendError(message: "Choose a backup smaller than 24 MB.") }
        var archive = try JSONDecoder.store.decode(Archive.self, from: data)
        try validate(archive)
        // A filename or account URL from another device is not a local asset.
        for i in archive.trips.indices {
            archive.trips[i].coverFile = nil
            archive.trips[i].coverRemote = nil
            archive.trips[i].isSample = nil
        }
        for i in archive.wardrobe.indices {
            archive.wardrobe[i].imageFile = nil
            archive.wardrobe[i].remotePhoto = nil
            archive.wardrobe[i].isSample = nil
        }
        archive.profile.isPro = false
        archive.profile.proPlan = nil
        archive.profile.email = nil
        return archive
    }

    static func validate(_ archive: Archive) throws {
        func unique<T: Hashable>(_ ids: [T]) -> Bool { Set(ids).count == ids.count }
        guard (1...2).contains(archive.version), archive.trips.count <= 500, archive.wardrobe.count <= 5000,
              unique(archive.trips.map(\.id)), unique(archive.wardrobe.map(\.id)) else {
            throw BackendError(message: "This backup has an unsupported version, duplicate records or too many items.")
        }
        let wardrobe = Set(archive.wardrobe.map(\.id))
        guard archive.wardrobe.allSatisfy({ !$0.name.isEmpty && $0.name.count <= 200 && (0...1_000_000).contains($0.grams) }),
              archive.profile.name.count <= 200, archive.profile.homeAirport.count <= 200 else {
            throw BackendError(message: "This backup contains invalid wardrobe items or preferences.")
        }
        for trip in archive.trips {
            guard (1...366).contains(trip.dayCount), (1...100).contains(trip.travellers),
                  !trip.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  trip.name.count <= 200, trip.place.count <= 200,
                  trip.start.timeIntervalSince1970.isFinite,
                  trip.budgetLimit.isFinite, (0...10_000_000).contains(trip.budgetLimit),
                  trip.bagLimitKg.isFinite, (0...1000).contains(trip.bagLimitKg),
                  trip.timeZoneID.map({ TimeZone(identifier: $0) != nil }) ?? true,
                  trip.startDayKey.map({ TravelDates.date($0, in: trip.timeZone) != nil }) ?? true,
                  unique(trip.plans.map(\.id)), unique(trip.outfits.map(\.id)), unique(trip.packing.map(\.id)),
                  unique(trip.expenses.map(\.id)), unique(trip.companions.map(\.id)),
                  unique(trip.stages.map(\.id)), unique(trip.gear.map(\.id)),
                  trip.plans.count <= 5000, trip.packing.count <= 5000, trip.expenses.count <= 5000,
                  trip.stages.count <= 366, trip.gear.count <= 5000, trip.stops.count <= 5000, trip.dives.count <= 5000,
                  trip.plans.allSatisfy({ trip.dayIndices.contains($0.day) && ($0.time.isEmpty || TravelDates.clock($0.time) != nil) && $0.cost.isFinite && (0...10_000_000).contains($0.cost) && $0.walkKm.isFinite && (0...1000).contains($0.walkKm) && $0.title.count <= 200 }),
                  trip.expenses.allSatisfy({ $0.amount.isFinite && (0...10_000_000).contains($0.amount) && $0.title.count <= 200 && ($0.day.map(trip.dayIndices.contains) ?? true) }),
                  trip.outfits.allSatisfy({ trip.dayIndices.contains($0.day) && Set($0.items).isSubset(of: wardrobe) }),
                  Set(trip.capsule).isSubset(of: wardrobe),
                  trip.packing.allSatisfy({ (0...1_000_000).contains($0.grams) && ($0.wardrobeID.map(wardrobe.contains) ?? true) }),
                  trip.stages.allSatisfy({ (1...trip.dayCount).contains($0.day) && $0.km.isFinite && (0...10_000).contains($0.km) && (0...100_000).contains($0.ascent) && (-500...10_000).contains($0.altitude) && $0.title.count <= 200 }),
                  trip.gear.allSatisfy({ (0...1_000_000).contains($0.grams) && $0.name.count <= 200 && ($0.rentPerDay.map { (0...10_000_000).contains($0) } ?? true) }),
                  trip.stops.allSatisfy({ trip.dayIndices.contains($0.day) && $0.name.count <= 200 }),
                  trip.dives.allSatisfy({ trip.dayIndices.contains($0.day) && (0...500).contains($0.depthM) && (0...1440).contains($0.minutes) }),
                  trip.settlements?.allSatisfy({ $0.amount.isFinite && abs($0.amount) <= 10_000_000 }) ?? true,
                  trip.adventure?.permits.allSatisfy({ $0.fee.map { $0.isFinite && (0...10_000_000).contains($0) } ?? true }) ?? true,
                  trip.adventure?.checkIns.allSatisfy({ $0.symptoms.count == AltitudeCheckIn.symptomNames.count && $0.symptoms.allSatisfy({ (0...3).contains($0) }) && (0...100).contains($0.spo2) }) ?? true else {
                throw BackendError(message: "This backup contains invalid dates, amounts or missing wardrobe items. Nothing has been changed.")
            }
        }
        try validateAssets(archive)
    }

    @MainActor
    static func exportFile(_ store: TripStore) throws -> URL {
        let data = try encodeBundle(store)
        let file = try TripExports.exportURL(named: "Trips Loom backup \(TravelDates.key(.now))", ext: "json")
        try data.write(to: file, options: [.atomic, .completeFileProtection])
        return file
    }
}
