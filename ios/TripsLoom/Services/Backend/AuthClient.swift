import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

/// A signed-in Supabase session. Kept in the Keychain, never in the trips file.
struct AuthSession: Codable, Sendable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userID: String
    var email: String?

    var isExpiring: Bool { expiresAt.timeIntervalSinceNow < 60 }
}

/// Supabase Auth over its REST API: email and password, Sign in with Apple
/// (ID token), Google (OAuth in the system web sheet), password recovery,
/// refresh and email links.
@MainActor
final class AuthClient {
    static let shared = AuthClient()
    static let minimumPasswordLength = 8
    private static let keychainKey = "auth.session.v1" + TripStore.testScope

    private(set) var session: AuthSession?
    private var config: SupabaseConfig?
    private var refreshing: Task<AuthSession, any Error>?
    private var refreshIdentity: UUID?

    init() {
        // The Keychain outlives the app; a fresh install starts signed out
        // rather than syncing a stale session into an empty phone.
        let installedKey = "tripsloom.installed"
        if !UserDefaults.standard.bool(forKey: installedKey) {
            Keychain.save(Optional<AuthSession>.none, for: Self.keychainKey)
            UserDefaults.standard.set(true, forKey: installedKey)
        }
        session = Keychain.load(AuthSession.self, for: Self.keychainKey)
    }

    func supabase() async throws -> SupabaseConfig {
        if let config { return config }
        let loaded = try await ConfigLoader.load()
        config = loaded
        return loaded
    }

    /// Providers switched on in the Supabase project, from its public
    /// settings. Sign in with Apple only shows when "apple" is here.
    func enabledProviders() async -> Set<String> {
        guard let config = try? await supabase(), let request = try? endpoint(config, "auth/v1/settings"),
              let (data, _) = try? await HTTP.send(request),
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let external = body["external"] as? [String: Bool]
        else { return ["email"] }
        return Set(external.filter(\.value).keys)
    }

    // MARK: Sign in and up

    enum SignUpResult { case signedIn(AuthSession), confirmEmail }

    func signIn(email: String, password: String) async throws -> AuthSession {
        try await token(grant: "password", body: ["email": email, "password": password])
    }

    func signUp(email: String, password: String, name: String) async throws -> SignUpResult {
        let config = try await supabase()
        var request = try endpoint(config, "auth/v1/signup", query: ["redirect_to": Backend.callbackURL])
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": email, "password": password, "data": ["display_name": name],
        ])
        let (data, _) = try await HTTP.send(request)
        if let session = try? decodeSession(data) {
            store(session)
            return .signedIn(session)
        }
        return .confirmEmail
    }

    /// Exchanges an Apple identity token. Needs the Apple provider enabled in
    /// the Supabase project with this app's bundle ID.
    func signInWithApple(idToken: String, nonce: String) async throws -> AuthSession {
        try await token(grant: "id_token", body: ["provider": "apple", "id_token": idToken, "nonce": nonce])
    }

    /// Signs in through Supabase's OAuth page for `provider` ("google") in the
    /// system's secure web sheet. Supabase sends the tokens back to
    /// `tripsloom://auth/callback`, handled like an email link.
    func signInWithOAuth(provider: String) async throws {
        let config = try await supabase()
        var components = URLComponents(url: config.url.appending(path: "auth/v1/authorize"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "provider", value: provider), URLQueryItem(name: "redirect_to", value: Backend.callbackURL)]
        guard let url = components?.url else { throw BackendError(message: "Sign-in is unavailable right now.") }
        let callback = try await WebSignIn.run(url: url, scheme: "tripsloom")
        guard try await handle(url: callback) != nil else {
            throw BackendError(message: "Sign-in didn't finish. Try again.")
        }
    }

    func sendPasswordReset(email: String) async throws {
        let config = try await supabase()
        var request = try endpoint(config, "auth/v1/recover", query: ["redirect_to": Backend.resetURL])
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email])
        _ = try await HTTP.send(request)
    }

    func updatePassword(_ password: String) async throws {
        let config = try await supabase()
        var request = try endpoint(config, "auth/v1/user")
        request.httpMethod = "PUT"
        request.setValue("Bearer \(try await validToken())", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["password": password])
        _ = try await HTTP.send(request)
    }

    func updateDisplayName(_ name: String) async {
        guard let config = try? await supabase(), let token = try? await validToken(),
              var request = try? endpoint(config, "auth/v1/user") else { return }
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["data": ["display_name": name]])
        _ = try? await HTTP.send(request)
    }

    /// The name the account carries, such as the one Google shares.
    func displayName() async -> String? {
        guard let config = try? await supabase(), let token = try? await validToken(),
              var request = try? endpoint(config, "auth/v1/user") else { return nil }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, _) = try? await HTTP.send(request),
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let meta = body["user_metadata"] as? [String: Any]
        else { return nil }
        let name = ((meta["display_name"] ?? meta["full_name"] ?? meta["name"]) as? String)?.trimmingCharacters(in: .whitespaces)
        return name?.isEmpty == false ? name : nil
    }

    func signOut() {
        let oldSession = session
        // Clear immediately. An old logout request must never clear a newer login.
        refreshing?.cancel()
        refreshing = nil
        refreshIdentity = nil
        store(nil)
        Task {
            guard let oldSession, let config = try? await supabase(), var request = try? endpoint(config, "auth/v1/logout") else { return }
            request.httpMethod = "POST"
            request.setValue("Bearer \(oldSession.accessToken)", forHTTPHeaderField: "Authorization")
            _ = try? await HTTP.send(request)
        }
    }

    /// Handles `tripsloom://auth/callback` and `tripsloom://auth/reset`
    /// links from confirmation and recovery emails. Returns the link type.
    func handle(url: URL) async throws -> String? {
        guard url.scheme == "tripsloom", url.host() == "auth" else { return nil }
        var params: [String: String] = [:]
        for part in [url.fragment, URLComponents(url: url, resolvingAgainstBaseURL: false)?.query].compactMap(\.self) {
            for pair in part.split(separator: "&") {
                let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
                if kv.count == 2 { params[kv[0]] = kv[1].removingPercentEncoding ?? kv[1] }
            }
        }
        if let message = params["error_description"] {
            throw BackendError(message: message.replacingOccurrences(of: "+", with: " "))
        }
        guard let access = params["access_token"], let refresh = params["refresh_token"] else { return nil }
        let expires = Double(params["expires_in"] ?? "3600") ?? 3600
        let user = try await fetchUser(accessToken: access)
        let session = AuthSession(accessToken: access, refreshToken: refresh, expiresAt: .now.addingTimeInterval(expires), userID: user.id, email: user.email)
        store(session)
        return params["type"] ?? (url.path().contains("reset") ? "recovery" : "signup")
    }

    // MARK: Tokens

    /// A current access token, refreshed when close to expiry.
    func validToken() async throws -> String {
        guard let current = session else { throw BackendError.expired }
        if !current.isExpiring { return current.accessToken }
        return try await refresh(current).accessToken
    }

    private func refresh(_ current: AuthSession) async throws -> AuthSession {
        if refreshing == nil {
            refreshing = Task { try await self.token(grant: "refresh_token", body: ["refresh_token": current.refreshToken], persist: false) }
            refreshIdentity = UUID()
        }
        let identity = refreshIdentity
        let task = refreshing!
        defer {
            if identity == refreshIdentity { refreshing = nil; refreshIdentity = nil }
        }
        do {
            let renewed = try await task.value
            guard session?.userID == current.userID,
                  session?.refreshToken == current.refreshToken || session?.refreshToken == renewed.refreshToken else { throw CancellationError() }
            if session?.refreshToken == current.refreshToken { store(renewed) }
            return renewed
        } catch let error as BackendError where error.status == 400 || error.status == 401 {
            if session?.refreshToken == current.refreshToken { store(nil) }
            throw BackendError.expired
        }
    }

    /// Swaps the refresh token for a new session after the server turned the
    /// access token down early. Signs out if the refresh token is gone too.
    func forceRefresh() async -> Bool {
        guard let current = session else { return false }
        do {
            _ = try await refresh(current)
            return true
        } catch let error as BackendError where error.status == 400 || error.status == 401 {
            if session?.refreshToken == current.refreshToken { store(nil) }
            return false
        } catch { return false }
    }

    private func token(grant: String, body: [String: String], persist: Bool = true) async throws -> AuthSession {
        let config = try await supabase()
        var request = try endpoint(config, "auth/v1/token", query: ["grant_type": grant])
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await HTTP.send(request)
        let session = try decodeSession(data)
        if persist { store(session) }
        return session
    }

    private func fetchUser(accessToken: String) async throws -> (id: String, email: String?) {
        let config = try await supabase()
        var request = try endpoint(config, "auth/v1/user")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (data, _) = try await HTTP.send(request)
        let body = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let id = body?["id"] as? String else { throw BackendError(message: "Couldn't read your account.") }
        return (id, body?["email"] as? String)
    }

    private func decodeSession(_ data: Data) throws -> AuthSession {
        guard let body = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = body["access_token"] as? String,
              let refresh = body["refresh_token"] as? String,
              let user = body["user"] as? [String: Any],
              let id = user["id"] as? String
        else { throw BackendError(message: "No session returned.") }
        let expires = (body["expires_in"] as? Double) ?? 3600
        return AuthSession(accessToken: access, refreshToken: refresh, expiresAt: .now.addingTimeInterval(expires), userID: id, email: user["email"] as? String)
    }

    private func store(_ session: AuthSession?) {
        self.session = session
        Keychain.save(session, for: Self.keychainKey)
    }

    func endpoint(_ config: SupabaseConfig, _ path: String, query: [String: String] = [:]) throws -> URLRequest {
        var components = URLComponents(url: config.url.appending(path: path), resolvingAgainstBaseURL: false)
        if !query.isEmpty { components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }
        guard let url = components?.url else { throw BackendError(message: "Bad address.") }
        var request = URLRequest(url: url)
        request.setValue(config.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }

    // MARK: Apple nonce

    static func makeNonce() -> (raw: String, hashed: String) {
        let raw = (0..<32).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
        let hashed = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
        return (raw, hashed)
    }
}

/// One sign-in in ASWebAuthenticationSession: shares Safari's cookies, so a
/// Google account already signed in on this iPhone is offered straight away.
@MainActor
private enum WebSignIn {
    private final class Anchor: NSObject, ASWebAuthenticationPresentationContextProviding {
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
        }
    }

    private static var current: (session: ASWebAuthenticationSession, anchor: Anchor)?

    static func run(url: URL, scheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callback: .customScheme(scheme)) { callback, error in
                Task { @MainActor in
                    current = nil
                    if let callback {
                        continuation.resume(returning: callback)
                    } else if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                        continuation.resume(throwing: CancellationError())
                    } else {
                        continuation.resume(throwing: BackendError(message: "Sign-in couldn't open. Check your connection and try again."))
                    }
                }
            }
            let anchor = Anchor()
            session.presentationContextProvider = anchor
            current = (session, anchor)
            if !session.start() {
                current = nil
                continuation.resume(throwing: BackendError(message: "Sign-in couldn't open. Try again."))
            }
        }
    }
}
