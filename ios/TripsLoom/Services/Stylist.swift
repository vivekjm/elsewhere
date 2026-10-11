import SwiftUI
import UIKit

/// Builds a capsule and daily outfits from the wardrobe. Day weather is the
/// live forecast where there is one, else a typical-season estimate.
enum Stylist {
    enum Sky: Codable, Sendable { case sun, cloud, rain, snow }

    struct DayWeather: Identifiable {
        var id: Int
        var date: Date
        var sky: Sky
        var high: Int
        /// From the live forecast.
        var live = false
        /// What the weather was on this date last year.
        var lastYear = false
    }

    @MainActor
    static func weather(for trip: Trip) -> [DayWeather] {
        estimate(for: trip).map { day in
            guard let real = WeatherService.shared.day(trip, day.id) else { return day }
            return DayWeather(id: day.id, date: day.date, sky: real.sky, high: real.high, live: real.typical != true, lastYear: real.typical == true)
        }
    }

    private static func estimate(for trip: Trip) -> [DayWeather] {
        var generator = SeededGenerator(seed: trip.id.uuidString.utf8.reduce(UInt64(5381)) { ($0 &* 33) &+ UInt64($1) })
        let month = Calendar.current.component(.month, from: trip.start)
        let base: Int = switch trip.kind {
        case .beach: 30
        case .trek, .climb, .camp: 8
        default: [3, 5, 6, 8, 3, 1].contains(month) ? 14 : (6...9).contains(month) ? 26 : 22
        }
        return trip.dayIndices.prefix(7).map { day in
            let roll = Int.random(in: 0..<10, using: &generator)
            let sky: Sky = roll < 6 ? .sun : roll < 8 ? .cloud : .rain
            let high = base + Int.random(in: -3...3, using: &generator) - (sky == .rain ? 4 : 0)
            return DayWeather(id: day, date: trip.date(ofDay: day), sky: sky, high: high)
        }
    }

    @MainActor
    static func outfits(for trip: Trip, wardrobe: [WardrobeItem], shuffle: Int = 0) -> [Outfit] {
        let capsule = trip.capsule.isEmpty ? wardrobe : wardrobe.filter { trip.capsule.contains($0.id) }
        let tops = capsule.filter { $0.category == .tops }
        let bottoms = capsule.filter { $0.category == .bottoms }
        let dresses = capsule.filter { $0.category == .dresses }
        let shoes = capsule.filter { $0.category == .shoes }
        let layers = capsule.filter { $0.category == .layers }
        let weather = weather(for: trip)

        return trip.dayIndices.map { day in
            let i = day + shuffle
            var items: [UUID] = []
            let evening = trip.plans(on: day).contains { $0.category == .evening }
            if evening, !dresses.isEmpty, i % 3 == 2 {
                items.append(dresses[i % dresses.count].id)
            } else {
                if !tops.isEmpty { items.append(tops[i % tops.count].id) }
                if !bottoms.isEmpty { items.append(bottoms[(i / 2) % bottoms.count].id) }
            }
            let sky = weather.first { $0.id == day }?.sky
            let wet = sky == .rain || sky == .snow
            if (wet || i % 2 == 1), !layers.isEmpty {
                items.append((wet ? layers.last! : layers[i % layers.count]).id)
            } else if !shoes.isEmpty {
                items.append(shoes[i % shoes.count].id)
            }
            let highlight = trip.plans(on: day).first { $0.category == .sight || $0.category == .evening || $0.category == .activity }
            let fromMeta = highlight?.meta.split(separator: "·").first.map { $0.trimmingCharacters(in: .whitespaces) }
            let place = (fromMeta?.isEmpty == false ? fromMeta : highlight?.title).map { String($0.prefix(24)) }
            let title = [place, wet ? "rain" : nil].compactMap(\.self).joined(separator: ", ")
            return Outfit(day: day, title: title.isEmpty ? "Easy layers" : title, items: items)
        }
    }

    /// Outfit combinations the capsule makes (tops × bottoms + dresses).
    static func combinations(_ items: [WardrobeItem]) -> Int {
        let tops = items.filter { $0.category == .tops }.count
        let bottoms = items.filter { $0.category == .bottoms }.count
        let dresses = items.filter { $0.category == .dresses }.count
        return tops * bottoms + dresses
    }
}

struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed == 0 ? 0x9E3779B97F4A7C15 : seed }
    mutating func next() -> UInt64 {
        state ^= state << 13
        state ^= state >> 7
        state ^= state << 17
        return state
    }
}

/// Wardrobe photos live in Application Support.
enum WardrobePhotos {
    static var directory: URL {
        let dir = URL.applicationSupportDirectory.appending(path: "wardrobe", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func save(_ data: Data, for id: UUID) -> String? {
        guard let image = UIImage(data: data),
              let jpeg = image.preparingThumbnail(of: CGSize(width: 800, height: 800 * image.size.height / max(image.size.width, 1)))?.jpegData(compressionQuality: 0.8)
        else { return nil }
        let name = "\(id.uuidString).jpg"
        do { try jpeg.write(to: directory.appending(path: name), options: [.atomic, .completeFileProtection]) }
        catch { return nil }
        return name
    }

    static func image(_ name: String?) -> UIImage? {
        guard let name, isSafeFileName(name) else { return nil }
        return UIImage(contentsOfFile: directory.appending(path: name).path(percentEncoded: false))
    }

    static func delete(_ name: String?) {
        guard let name, isSafeFileName(name) else { return }
        try? FileManager.default.removeItem(at: directory.appending(path: name))
    }

    static func isSafeFileName(_ name: String) -> Bool {
        name.hasSuffix(".jpg") && UUID(uuidString: String(name.dropLast(4))) != nil
    }
}
