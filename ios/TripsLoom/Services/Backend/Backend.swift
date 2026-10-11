import Foundation
import Security

/// The Trips Loom backend: the Worker at tripsloom.com (workspace and
/// photos) and its Supabase project (accounts and profiles). The app only
/// ever holds the publishable key, which the Worker hands out.
enum Backend {
    static var baseURL: URL {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["TRIPSLOOM_TEST_BACKEND"], let url = URL(string: raw) { return url }
        // Debug builds can point at a local copy of the backend for testing:
        // launch with `-backend-url http://127.0.0.1:8787`.
        if let raw = UserDefaults.standard.string(forKey: "backend-url"), let url = URL(string: raw) { return url }
        #endif
        return URL(string: "https://tripsloom.com")!
    }

    /// The Worker only accepts writes whose Origin is its own.
    static var origin: String {
        let url = baseURL
        return "\(url.scheme ?? "https")://\(url.host() ?? "")" + (url.port.map { ":\($0)" } ?? "")
    }
    static let callbackURL = "tripsloom://auth/callback"
    static let resetURL = "tripsloom://auth/reset"
}

struct BackendError: LocalizedError, Sendable {
    var message: String
    var status: Int = 0

    var errorDescription: String? { message }

    static let offline = BackendError(message: "You're offline. Changes are saved on this iPhone and will sync later.")
    static let expired = BackendError(message: "Your session has expired. Please sign in again.", status: 401)
    static let conflict = BackendError(message: "Your trips changed on another device.", status: 409)
}

// MARK: Config

struct SupabaseConfig: Codable, Sendable {
    var url: URL
    var publishableKey: String
}

enum ConfigLoader {
    private static var cacheKey: String { "tripsloom.supabase.config.v1.\(Backend.baseURL.host() ?? "")" }

    /// Fetched from the Worker so staging and production stay in step; the
    /// last good value is cached for launches without a connection.
    static func load() async throws -> SupabaseConfig {
        struct Response: Decodable { var configured: Bool; var url: String?; var publishableKey: String? }
        do {
            let (data, response) = try await HTTP.session.data(from: Backend.baseURL.appending(path: "api/auth/config"))
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw BackendError(message: "Accounts are unavailable right now.") }
            let body = try JSONDecoder().decode(Response.self, from: data)
            guard body.configured, let raw = body.url, let url = URL(string: raw), let key = body.publishableKey else {
                throw BackendError(message: "Accounts are unavailable right now.")
            }
            let config = SupabaseConfig(url: url, publishableKey: key)
            UserDefaults.standard.set(try? JSONEncoder().encode(config), forKey: cacheKey)
            return config
        } catch {
            if let data = UserDefaults.standard.data(forKey: cacheKey),
               let cached = try? JSONDecoder().decode(SupabaseConfig.self, from: data) {
                return cached
            }
            throw HTTP.wrap(error)
        }
    }
}

// MARK: HTTP

enum HTTP {
    static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = false
        config.httpCookieStorage = nil
        return URLSession(configuration: config)
    }()

    static func wrap(_ error: any Error) -> BackendError {
        if let error = error as? BackendError { return error }
        if let url = error as? URLError,
           [.notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotFindHost, .cannotConnectToHost, .dataNotAllowed].contains(url.code) {
            return .offline
        }
        return BackendError(message: error.localizedDescription)
    }

    /// Sends a request and returns the body, turning error responses into a
    /// readable message (the Worker returns `error`, Supabase returns `msg`,
    /// `error_description` or `message`).
    static func send(_ request: URLRequest) async throws -> (Data, Int) {
        do {
            let (data, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if (200..<300).contains(status) { return (data, status) }
            let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let message = ["error_description", "msg", "message", "error"]
                .compactMap { body?[$0] as? String }
                .first ?? "Request failed (\(status))."
            throw BackendError(message: friendly(message), status: status)
        } catch {
            throw wrap(error)
        }
    }

    private static func friendly(_ message: String) -> String {
        switch message.lowercased() {
        case let m where m.contains("invalid login credentials"): "That email and password don't match."
        case let m where m.contains("email not confirmed"): "Confirm your email first. We sent you a link."
        case let m where m.contains("user already registered"): "That email already has an account. Sign in instead."
        case let m where m.contains("password should be at least"): "Use a longer password that meets the account's password requirements."
        default: message
        }
    }
}

// MARK: Keychain

enum Keychain {
    private static let service = "com.tripsloom.ios"

    static func save<T: Encodable>(_ value: T?, for account: String) {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
        guard let value, let data = try? JSONEncoder().encode(value) else { return }
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    static func load<T: Decodable>(_ type: T.Type, for account: String) -> T? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
            kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
