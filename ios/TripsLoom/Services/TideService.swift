import Foundation
import Observation

/// Sea level for a trip day from Open-Meteo Marine (free, no key). The API
/// covers roughly the past three months to two weeks ahead; outside that the
/// screen falls back to a lunar estimate and says so.
@MainActor
@Observable
final class TideService {
    static let shared = TideService()

    enum Source: Equatable {
        /// Hourly sea level from the marine model.
        case live
        /// Lunar-cycle estimate: the date is outside the model's range, or the
        /// phone is offline.
        case estimate
        /// The trip's place has no sea nearby.
        case inland
    }

    struct Day: Equatable {
        var source: Source
        var points: [Tides.Point]
    }

    private var days: [String: Day] = [:]
    private var loading: Set<String> = []

    func day(for trip: Trip, index: Int) -> Day? { days[key(trip, index)] }

    func load(_ trip: Trip, index: Int) async {
        let k = key(trip, index)
        guard days[k] == nil, !loading.contains(k) else { return }
        loading.insert(k)
        defer { loading.remove(k) }
        let date = trip.date(ofDay: index)
        let estimate = Day(source: .estimate, points: Tides.curve(for: date, seed: trip.id, calendar: trip.calendar))
        var place = await Places.lookup(trip.place)
        if place == nil { place = await Places.lookup(trip.name) }
        guard let place else {
            days[k] = estimate
            return
        }
        days[k] = await fetch(lat: place.latitude, lon: place.longitude, date: date, timeZone: trip.timeZone) ?? estimate
    }

    private func key(_ trip: Trip, _ index: Int) -> String {
        "\(trip.place.lowercased())|\(trip.timeZone.identifier)|\(Self.dayString(trip.date(ofDay: index), trip.timeZone))"
    }

    private static func dayString(_ date: Date, _ zone: TimeZone) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = zone
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    /// nil when the request fails or the date is out of range (estimate);
    /// `.inland` when the model has no sea at this point.
    private func fetch(lat: Double, lon: Double, date: Date, timeZone: TimeZone) async -> Day? {
        let day = Self.dayString(date, timeZone)
        var components = URLComponents(string: "https://marine-api.open-meteo.com/v1/marine")!
        components.queryItems = [
            .init(name: "latitude", value: String(format: "%.4f", lat)),
            .init(name: "longitude", value: String(format: "%.4f", lon)),
            .init(name: "hourly", value: "sea_level_height_msl"),
            .init(name: "timezone", value: timeZone.identifier),
            .init(name: "start_date", value: day),
            .init(name: "end_date", value: day),
        ]
        struct Response: Decodable {
            struct Hourly: Decodable {
                var time: [String]
                var sea_level_height_msl: [Double?]
            }
            var hourly: Hourly?
        }
        guard let url = components.url,
              let (data, response) = try? await URLSession.shared.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let hourly = (try? JSONDecoder().decode(Response.self, from: data))?.hourly
        else { return nil }
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = timeZone
        parser.dateFormat = "yyyy-MM-dd'T'HH:mm"
        let points = zip(hourly.time, hourly.sea_level_height_msl).compactMap { time, height -> Tides.Point? in
            guard let height, let date = parser.date(from: time) else { return nil }
            return Tides.Point(date: date, height: height)
        }
        if points.count < 6 { return Day(source: .inland, points: []) }
        return Day(source: .live, points: points)
    }
}
