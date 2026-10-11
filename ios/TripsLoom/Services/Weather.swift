import Foundation
import Observation

/// Daily forecasts from Open-Meteo (free, no key). Each day uses where you
/// sleep that night (the latest stay's place), falling back to the trip's
/// destination. Days beyond the 16-day forecast window have no entry.
@MainActor
@Observable
final class WeatherService {
    static let shared = WeatherService()

    struct Day: Codable, Hashable, Sendable {
        var place: String
        var code: Int
        var high: Int
        var low: Int
        var rainChance: Int
        /// Last year's weather on the same date, for trips beyond the forecast.
        var typical: Bool?

        var sky: Stylist.Sky {
            switch code {
            case 0, 1: .sun
            case 71...77, 85, 86: .snow
            case 51...67, 80...82, 95...99: .rain
            default: .cloud
            }
        }

        var symbol: String {
            switch code {
            case 0: "sun.max.fill"
            case 1, 2: "cloud.sun.fill"
            case 45, 48: "cloud.fog.fill"
            case 51...57: "cloud.drizzle.fill"
            case 61...67, 80...82: "cloud.rain.fill"
            case 71...77, 85, 86: "cloud.snow.fill"
            case 95...99: "cloud.bolt.rain.fill"
            default: "cloud.fill"
            }
        }

        var summary: String {
            switch code {
            case 0: "Clear"
            case 1, 2: "Partly cloudy"
            case 3: "Overcast"
            case 45, 48: "Fog"
            case 51...57: "Drizzle"
            case 61...67, 80...82: "Rain"
            case 71...77, 85, 86: "Snow"
            case 95...99: "Thunderstorms"
            default: "Cloudy"
            }
        }
    }

    private struct Cached: Codable {
        var key: String
        var fetched: Date
        var days: [Int: Day]
    }

    /// Day index → forecast, per trip.
    private(set) var forecasts: [UUID: [Int: Day]] = [:]
    @ObservationIgnored private var cache: [UUID: Cached] = [:]
    @ObservationIgnored private var inflight: Set<UUID> = []

    private init() {
        if let data = UserDefaults.standard.data(forKey: "weather.cache"),
           let saved = try? JSONDecoder().decode([UUID: Cached].self, from: data) {
            cache = saved
            forecasts = saved.mapValues(\.days)
        }
    }

    func day(_ trip: Trip, _ index: Int) -> Day? { forecasts[trip.id]?[index] }

    /// The day a trip's header shows: today during the trip, else day one.
    func headline(_ trip: Trip) -> (index: Int, day: Day)? {
        guard trip.status != .past else { return nil }
        let index = trip.todayIndex ?? 0
        return day(trip, index).map { (index, $0) }
    }

    /// Starts a load that finishes even if the screen asking for it closes
    /// (a cancelled request would otherwise leave no forecast until the
    /// trip is opened again).
    func prefetch(_ trip: Trip) {
        Task { await load(trip) }
    }

    /// Live forecast for days within 16 days; for later days, what the
    /// weather actually was on the same dates last year (marked `typical`).
    /// Re-fetched when stale (3 h for forecasts, a week for last year) or
    /// when the dates or stays change.
    func load(_ trip: Trip) async {
        let calendar = trip.calendar
        let today = calendar.startOfDay(for: .now)
        guard trip.end >= today,
              let horizon = calendar.date(byAdding: .day, value: 15, to: today),
              let farthest = calendar.date(byAdding: .day, value: 400, to: today), trip.start <= farthest
        else { return }
        // Treks and road trips: where you sleep each night along the route.
        var routeStops: [Int: RouteWaypoints.Point] = [:]
        if trip.kind.isAdventure || trip.kind == .road, !trip.stages.isEmpty {
            let points = await RouteWaypoints.resolve(trip)
            for day in trip.dayIndices {
                let stage = trip.stages.lastIndex { $0.day <= day + 1 } ?? -1
                if let point = points.last(where: { $0.stage <= stage }) ?? points.first { routeStops[day] = point }
            }
        }
        let places = trip.dayIndices.map { routeStops[$0]?.name ?? place(for: trip, day: $0) }
        let key = "v3|\(trip.name)|\(trip.dayKey(0))|\(trip.timeZone.identifier)|\(places.joined(separator: ","))"
        let usesForecast = trip.start <= horizon
        let maxAge: TimeInterval = usesForecast ? 3 * 3600 : 7 * 86_400
        if let hit = cache[trip.id], hit.key == key, hit.fetched > .now.addingTimeInterval(-maxAge) { return }
        guard !inflight.contains(trip.id) else { return }
        inflight.insert(trip.id)
        defer { inflight.remove(trip.id) }

        var days: [Int: Day] = [:]
        for place in Set(places) {
            let indices = places.indices.filter { places[$0] == place }
            var spot: Places.Place?
            if let stop = indices.lazy.compactMap({ routeStops[$0] }).first {
                spot = Places.Place(latitude: stop.coordinate.latitude, longitude: stop.coordinate.longitude, country: nil)
            } else {
                spot = await Places.lookup(place)
                if spot == nil, place != trip.place { spot = await Places.lookup(trip.place) }
            }
            // "India" as a destination means the middle of the country; the
            // trip's name ("Sikkim") is often the real place.
            var label = Self.shortName(place)
            if let country = spot?.country, country.caseInsensitiveCompare(Self.shortName(place)) == .orderedSame,
               let byName = await Places.lookup(trip.name), byName.country == country {
                spot = byName
                label = trip.name
            }
            guard let spot else { continue }
            let dates = indices.map { trip.date(ofDay: $0) }
            let live = dates.contains { $0 <= horizon } ? await fetch(lat: spot.latitude, lon: spot.longitude) : nil
            let later = dates.filter { $0 > horizon }
            let lastYear = later.isEmpty ? nil : await fetchLastYear(lat: spot.latitude, lon: spot.longitude, from: later.min()!, to: later.max()!, timeZone: trip.timeZone)
            for index in indices {
                let date = trip.date(ofDay: index)
                var day: Day?
                if date <= horizon {
                    day = live?[trip.dayKey(index)]
                } else if let shifted = calendar.date(byAdding: .year, value: -1, to: date) {
                    day = lastYear?[TravelDates.key(shifted, in: trip.timeZone)]
                    day?.typical = true
                }
                if var day {
                    day.place = label
                    days[index] = day
                }
            }
        }
        guard !days.isEmpty else { return }
        forecasts[trip.id] = days
        cache[trip.id] = Cached(key: key, fetched: .now, days: days)
        if let data = try? JSONEncoder().encode(cache) {
            UserDefaults.standard.set(data, forKey: "weather.cache")
        }
    }

    /// Where you are on a day: the place of the latest stay on or before it
    /// ("Lachung · 2 nights" → "Lachung"), else the trip's destination.
    func place(for trip: Trip, day: Int) -> String {
        let stay = trip.plans
            .filter { $0.category == .stay && $0.day <= day }
            .sorted { ($0.day, $0.sortTime) < ($1.day, $1.sortTime) }
            .last
        if let first = stay?.meta.split(separator: "·").first?.trimmingCharacters(in: .whitespaces),
           !first.isEmpty, first.first?.isUppercase == true, !first.contains(where: \.isNumber),
           first.split(separator: " ").count <= 3 {
            return first
        }
        return trip.place
    }

    static func shortName(_ place: String) -> String {
        place.split(separator: ",").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? place
    }

    // MARK: Network

    private func fetch(lat: Double, lon: Double) async -> [String: Day]? {
        var parts = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        parts.queryItems = [
            .init(name: "latitude", value: String(lat)),
            .init(name: "longitude", value: String(lon)),
            .init(name: "daily", value: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"),
            .init(name: "timezone", value: "auto"),
            .init(name: "forecast_days", value: "16"),
        ]
        struct Response: Decodable {
            struct Daily: Decodable {
                var time: [String]
                var weather_code: [Int?]
                var temperature_2m_max: [Double?]
                var temperature_2m_min: [Double?]
                var precipitation_probability_max: [Int?]
            }
            var daily: Daily
        }
        guard let url = parts.url,
              let (data, _) = try? await URLSession.shared.data(from: url),
              let d = (try? JSONDecoder().decode(Response.self, from: data))?.daily
        else { return nil }
        var out: [String: Day] = [:]
        for (i, key) in d.time.enumerated() {
            guard d.weather_code.indices.contains(i), d.temperature_2m_max.indices.contains(i),
                  d.temperature_2m_min.indices.contains(i), d.precipitation_probability_max.indices.contains(i) else { continue }
            guard let high = d.temperature_2m_max[i], let low = d.temperature_2m_min[i] else { continue }
            guard high.isFinite, low.isFinite, abs(high) < 200, abs(low) < 200 else { continue }
            out[key] = Day(place: "", code: d.weather_code[i] ?? 3, high: Int(high.rounded()), low: Int(low.rounded()), rainChance: d.precipitation_probability_max[i] ?? 0)
        }
        return out
    }
}

extension WeatherService {
    /// Daily weather a year before the given dates (Open-Meteo archive).
    fileprivate func fetchLastYear(lat: Double, lon: Double, from: Date, to: Date, timeZone: TimeZone) async -> [String: Day]? {
        let calendar = TravelDates.calendar(timeZone)
        guard let start = calendar.date(byAdding: .year, value: -1, to: from),
              let end = calendar.date(byAdding: .year, value: -1, to: to) else { return nil }
        var parts = URLComponents(string: "https://archive-api.open-meteo.com/v1/archive")!
        parts.queryItems = [
            .init(name: "latitude", value: String(lat)),
            .init(name: "longitude", value: String(lon)),
            .init(name: "start_date", value: TravelDates.key(start, in: timeZone)),
            .init(name: "end_date", value: TravelDates.key(end, in: timeZone)),
            .init(name: "daily", value: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum"),
            .init(name: "timezone", value: "auto"),
        ]
        struct Response: Decodable {
            struct Daily: Decodable {
                var time: [String]
                var weather_code: [Int?]
                var temperature_2m_max: [Double?]
                var temperature_2m_min: [Double?]
                var precipitation_sum: [Double?]
            }
            var daily: Daily
        }
        guard let url = parts.url,
              let (data, _) = try? await URLSession.shared.data(from: url),
              let d = (try? JSONDecoder().decode(Response.self, from: data))?.daily
        else { return nil }
        var out: [String: Day] = [:]
        for (i, key) in d.time.enumerated() {
            guard d.weather_code.indices.contains(i), d.temperature_2m_max.indices.contains(i),
                  d.temperature_2m_min.indices.contains(i), d.precipitation_sum.indices.contains(i) else { continue }
            guard let high = d.temperature_2m_max[i], let low = d.temperature_2m_min[i] else { continue }
            guard high.isFinite, low.isFinite, abs(high) < 200, abs(low) < 200 else { continue }
            let rain = d.precipitation_sum[i] ?? 0
            out[key] = Day(place: "", code: d.weather_code[i] ?? 3, high: Int(high.rounded()), low: Int(low.rounded()),
                           rainChance: rain >= 5 ? 80 : rain >= 1 ? 50 : 10)
        }
        return out
    }
}

extension Date {
    /// "2026-09-30" in the current calendar, matching Open-Meteo's local dates.
    var dayKey: String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: self)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
