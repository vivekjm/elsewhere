import Foundation

/// Wind and temperature at a summit's height, from Open-Meteo's
/// pressure-level forecast (free, no key), interpolated between the levels
/// above and below the peak. Daily figures are for the summit push, 01:00 to
/// 11:00 local time.
@MainActor
enum SummitForecast {
    struct Day: Hashable {
        var date: Date
        /// Strongest wind during the push.
        var kmh: Int
        /// Temperature at 06:00.
        var dawnTemp: Int?
    }

    private static let levels = [700, 600, 500, 400, 300]

    static func fetch(latitude: Double, longitude: Double, altitude: Int) async -> [Day]? {
        var parts = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        let variables = levels.flatMap { ["wind_speed_\($0)hPa", "temperature_\($0)hPa", "geopotential_height_\($0)hPa"] }
        parts.queryItems = [
            .init(name: "latitude", value: String(latitude)),
            .init(name: "longitude", value: String(longitude)),
            .init(name: "hourly", value: variables.joined(separator: ",")),
            .init(name: "forecast_days", value: "16"),
            .init(name: "timezone", value: "auto"),
        ]
        guard let url = parts.url,
              let (data, _) = try? await URLSession.shared.data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let hourly = json["hourly"] as? [String: Any],
              let times = hourly["time"] as? [String]
        else { return nil }
        func series(_ key: String) -> [Double?] { (hourly[key] as? [Any])?.map { $0 as? Double } ?? [] }
        let wind = levels.map { series("wind_speed_\($0)hPa") }
        let temp = levels.map { series("temperature_\($0)hPa") }
        let height = levels.map { series("geopotential_height_\($0)hPa") }

        /// Value at the summit's height for one hour.
        func atSummit(_ values: [[Double?]], _ i: Int) -> Double? {
            var samples: [(h: Double, v: Double)] = []
            for level in levels.indices {
                guard i < values[level].count, i < height[level].count,
                      let h = height[level][i], let v = values[level][i] else { continue }
                samples.append((h, v))
            }
            samples.sort { $0.h < $1.h }
            guard let lowest = samples.first, let highest = samples.last else { return nil }
            let a = Double(altitude)
            if a <= lowest.h { return lowest.v }
            if a >= highest.h { return highest.v }
            for (below, above) in zip(samples, samples.dropFirst()) where a >= below.h && a <= above.h {
                let t = (a - below.h) / max(above.h - below.h, 1)
                return below.v + (above.v - below.v) * t
            }
            return nil
        }

        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd'T'HH:mm"
        var byDay: [String: (winds: [Double], dawn: Double?)] = [:]
        var order: [String] = []
        for (i, time) in times.enumerated() {
            let day = String(time.prefix(10))
            guard let hour = Int(time.dropFirst(11).prefix(2)), (1...11).contains(hour) else { continue }
            if byDay[day] == nil { order.append(day); byDay[day] = ([], nil) }
            if let w = atSummit(wind, i) { byDay[day]?.winds.append(w) }
            if hour == 6, let t = atSummit(temp, i) { byDay[day]?.dawn = t }
        }
        let dayParser = DateFormatter()
        dayParser.locale = Locale(identifier: "en_US_POSIX")
        dayParser.dateFormat = "yyyy-MM-dd"
        return order.compactMap { key in
            guard let entry = byDay[key], let top = entry.winds.max(), let date = dayParser.date(from: key) else { return nil }
            return Day(date: Calendar.current.startOfDay(for: date), kmh: Int(top.rounded()), dawnTemp: entry.dawn.map { Int($0.rounded()) })
        }
    }
}
