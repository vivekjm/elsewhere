import Foundation
import Observation

/// Daily exchange rates (open.er-api.com, free, no key), cached for 12 h
/// and kept for offline use.
@MainActor
@Observable
final class CurrencyService {
    static let shared = CurrencyService()

    private struct Cached: Codable {
        var fetched: Date
        var rates: [String: Double]
    }

    /// Base ISO code → rates.
    private var cache: [String: Cached] = [:]
    @ObservationIgnored private var inflight: Set<String> = []

    private init() {
        if let data = UserDefaults.standard.data(forKey: "currency.cache"),
           let saved = try? JSONDecoder().decode([String: Cached].self, from: data) {
            cache = saved
        }
    }

    /// The currency chosen in the profile, else the phone's, e.g. "EUR".
    nonisolated static var home: String { preferred ?? Locale.current.currency?.identifier ?? "USD" }

    nonisolated private static let preferredKey = "currency.preferred"
    /// Kept in UserDefaults so `home` can be read from any thread.
    nonisolated static var preferred: String? {
        get { UserDefaults.standard.string(forKey: preferredKey) }
        set { UserDefaults.standard.set(newValue, forKey: preferredKey) }
    }

    /// Currencies offered in onboarding and Profile, most used first.
    nonisolated static let common = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "SGD", "AED", "INR", "CNY", "KRW", "THB", "MXN", "BRL", "ZAR", "SEK", "NOK", "DKK", "NZD"]

    /// "Euro", "US Dollar"; the code when the locale has no name.
    nonisolated static func name(for code: String) -> String {
        Locale.current.localizedString(forCurrencyCode: code) ?? code
    }

    /// "€" → "EUR". Trips store a symbol; unknown symbols pass through if
    /// they already look like a code.
    nonisolated static func code(for symbol: String) -> String? {
        let known = ["€": "EUR", "₹": "INR", "$": "USD", "£": "GBP", "¥": "JPY", "฿": "THB", "₩": "KRW",
                     "A$": "AUD", "S$": "SGD", "C$": "CAD", "CHF": "CHF", "AED": "AED", "Rp": "IDR", "RM": "MYR", "₫": "VND", "NPR": "NPR", "Rs": "NPR"]
        if let code = known[symbol] { return code }
        return symbol.count == 3 && symbol.allSatisfy(\.isUppercase) ? symbol : nil
    }

    nonisolated static func symbol(for code: String) -> String {
        let locale = Locale(identifier: Locale.identifier(fromComponents: [NSLocale.Key.currencyCode.rawValue: code]))
        return ["INR": "₹", "EUR": "€", "USD": "$", "GBP": "£", "JPY": "¥"][code] ?? locale.currencySymbol ?? code
    }

    /// Rate from one code to another, if known. Triggers a refresh when stale.
    func rate(from: String, to: String) -> Double? {
        if from == to { return 1 }
        if cache[from].map({ $0.fetched < .now.addingTimeInterval(-12 * 3600) }) ?? true {
            Task { await refresh(from) }
        }
        return cache[from]?.rates[to]
    }

    func updated(_ base: String) -> Date? { cache[base]?.fetched }

    private func refresh(_ base: String) async {
        guard !inflight.contains(base) else { return }
        inflight.insert(base)
        defer { inflight.remove(base) }
        struct Response: Decodable { var result: String; var rates: [String: Double]? }
        guard let url = URL(string: "https://open.er-api.com/v6/latest/\(base)"),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let response = try? JSONDecoder().decode(Response.self, from: data),
              response.result == "success", let raw = response.rates
        else { return }
        // A zero or nonsense rate would wipe every amount on a currency change.
        let rates = raw.filter { $0.value.isFinite && $0.value > 0 }
        guard !rates.isEmpty else { return }
        cache[base] = Cached(fetched: .now, rates: rates)
        if let data = try? JSONEncoder().encode(cache) {
            UserDefaults.standard.set(data, forKey: "currency.cache")
        }
    }
}
