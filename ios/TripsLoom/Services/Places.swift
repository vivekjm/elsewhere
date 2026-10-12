import CoreLocation
import Foundation
import MapKit

/// Place names → coordinates and country, via Apple Maps. Understands
/// regions and states ("Kerala", "Sikkim") as well as towns, and prefers
/// the phone's country when a name is ambiguous. Results are cached on disk.
@MainActor
enum Places {
    struct Place: Codable, Hashable, Sendable {
        var latitude: Double
        var longitude: Double
        var country: String?
        /// IANA zone ("Asia/Tokyo"); missing on places cached by older versions.
        var timeZone: String?
    }

    private static var cache: [String: Place] = {
        guard let data = UserDefaults.standard.data(forKey: "places.cache"),
              let saved = try? JSONDecoder().decode([String: Place].self, from: data)
        else { return [:] }
        return saved
    }()
    private static var misses: Set<String> = []

    static func cached(_ name: String) -> Place? { cache[key(name)] }

    static func lookup(_ name: String) async -> Place? {
        let k = key(name)
        guard !k.isEmpty else { return nil }
        // Older cache entries lack a time zone; look those up again once.
        if let hit = cache[k], hit.timeZone != nil { return hit }
        if misses.contains(k) { return nil }
        var found = await appleMaps(name)
        if found == nil { found = await openMeteo(name) }
        if let found {
            cache[k] = found
            if let data = try? JSONEncoder().encode(cache) { UserDefaults.standard.set(data, forKey: "places.cache") }
        } else {
            misses.insert(k)
        }
        return found
    }

    private static func key(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func appleMaps(_ name: String) async -> Place? {
        guard let request = MKGeocodingRequest(addressString: name),
              let items = try? await request.mapItems, !items.isEmpty
        else { return nil }
        // Ambiguous names ("Kerala", "Georgia"): prefer a match in the phone's country.
        let home = Locale.current.region?.identifier
        let item = items.first { $0.addressRepresentations?.region?.identifier == home } ?? items[0]
        let coordinate = item.location.coordinate
        return Place(latitude: coordinate.latitude, longitude: coordinate.longitude, country: item.addressRepresentations?.regionName,
                     timeZone: item.timeZone?.identifier)
    }

    /// Fallback when Apple Maps has no answer: Open-Meteo's gazetteer, keeping
    /// only populated places and preferring the phone's country and the most
    /// populous match.
    private static func openMeteo(_ name: String) async -> Place? {
        let parts = name.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard let first = parts.first, !first.isEmpty else { return nil }
        var components = URLComponents(string: "https://geocoding-api.open-meteo.com/v1/search")!
        components.queryItems = [.init(name: "name", value: first), .init(name: "count", value: "10")]
        struct Response: Decodable {
            struct Result: Decodable {
                var latitude: Double
                var longitude: Double
                var country: String?
                var country_code: String?
                var admin1: String?
                var population: Int?
                var timezone: String?
            }
            var results: [Result]?
        }
        guard let url = components.url,
              let (data, _) = try? await URLSession.shared.data(from: url),
              let results = (try? JSONDecoder().decode(Response.self, from: data))?.results, !results.isEmpty
        else { return nil }
        let hint = parts.dropFirst().joined(separator: " ").lowercased()
        let home = Locale.current.region?.identifier
        func score(_ r: Response.Result) -> Double {
            var s = log10(Double(max(r.population ?? 1, 1)))
            if !hint.isEmpty, let admin = r.admin1?.lowercased(), hint.contains(admin) || admin.contains(hint) { s += 10 }
            if !hint.isEmpty, let country = r.country?.lowercased(), hint.contains(country) { s += 10 }
            if r.country_code == home { s += 3 }
            return s
        }
        guard let best = results.max(by: { score($0) < score($1) }) else { return nil }
        return Place(latitude: best.latitude, longitude: best.longitude, country: best.country, timeZone: best.timezone)
    }
}
