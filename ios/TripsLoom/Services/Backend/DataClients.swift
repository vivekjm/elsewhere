import Foundation

enum AccountAPI {
    @MainActor
    static func delete() async throws {
        var request = URLRequest(url: Backend.baseURL.appending(path: "api/account"))
        request.httpMethod = "DELETE"
        request.setValue(Backend.origin, forHTTPHeaderField: "Origin")
        request.setValue("Bearer \(try await AuthClient.shared.validToken())", forHTTPHeaderField: "Authorization")
        _ = try await HTTP.send(request)
    }
}

enum FeedbackAPI {
    static var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(version) (\(build))"
    }

    @MainActor static func send(kind: String, message: String) async throws {
        let message = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard ["issue", "idea", "question"].contains(kind), (10...4000).contains(message.count) else {
            throw BackendError(message: "Enter between 10 and 4,000 characters.")
        }
        let auth = AuthClient.shared
        guard let user = auth.session?.userID else { throw BackendError.expired }
        let config = try await auth.supabase()
        var request = try auth.endpoint(config, "rest/v1/feedback")
        request.httpMethod = "POST"
        request.setValue("Bearer \(try await auth.validToken())", forHTTPHeaderField: "Authorization")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["id": UUID().uuidString, "user_id": user,
            "kind": kind, "message": message, "app_version": appVersion, "locale": Locale.current.identifier])
        _ = try await HTTP.send(request)
    }

    // Guests' feedback waits on this iPhone and goes out after sign-in.
    private struct Pending: Codable { var kind: String; var message: String }
    private static let pendingKey = "feedback.pending"

    static var pendingCount: Int { pending.count }

    private static var pending: [Pending] {
        get {
            guard let data = UserDefaults.standard.data(forKey: pendingKey) else { return [] }
            return (try? JSONDecoder().decode([Pending].self, from: data)) ?? []
        }
        set { UserDefaults.standard.set(try? JSONEncoder().encode(Array(newValue.suffix(10))), forKey: pendingKey) }
    }

    static func queue(kind: String, message: String) {
        pending.append(Pending(kind: kind, message: String(message.trimmingCharacters(in: .whitespacesAndNewlines).prefix(4000))))
    }

    /// Sends queued feedback once signed in; keeps what fails for next time.
    @MainActor private static var flushing = false

    @MainActor static func flushPending() async {
        guard AuthClient.shared.session != nil, !flushing else { return }
        flushing = true
        defer { flushing = false }
        var left: [Pending] = []
        for item in pending {
            do { try await send(kind: item.kind, message: item.message) } catch { left.append(item) }
        }
        pending = left
    }
}

// MARK: Profiles (Supabase `public.profiles`, row-level secured per user)

struct RemoteProfile: Codable, Sendable {
    var display_name: String
    var home_base: String
    var travel_style: String
    var interests: [String]
    var packing_style: String
    var unit: String
    var onboarding_completed: Bool
    var native_preferences: NativePreferences?
}

struct NativePreferences: Codable, Sendable {
    var travelStyle: String?
    var diet: String?
    var pace: String?
    var budgetStyle: String?
    var onboardingCompleted: Bool?

    init(_ profile: Profile) {
        travelStyle = String(profile.travelStyle.prefix(80))
        diet = String(profile.diet.prefix(80))
        pace = String(profile.pace.prefix(80))
        budgetStyle = String(profile.budgetStyle.prefix(80))
        onboardingCompleted = profile.onboardingCompleted
    }

    func apply(to profile: inout Profile) {
        if let travelStyle { profile.travelStyle = travelStyle }
        if let diet { profile.diet = diet }
        if let pace { profile.pace = pace }
        if let budgetStyle { profile.budgetStyle = budgetStyle }
        if let onboardingCompleted { profile.onboardingCompleted = onboardingCompleted }
    }
}

/// The profile fields the app shares with the website. Interests, packing
/// style and the web's onboarding flag stay the website's to set.
struct ProfilePatch: Encodable, Sendable {
    var display_name: String
    var home_base: String
    var unit: String
    var native_preferences: NativePreferences

    init(_ profile: Profile) {
        display_name = String(profile.name.prefix(80))
        home_base = String(profile.homeAirport.prefix(80))
        unit = profile.metric ? "metric" : "imperial"
        native_preferences = NativePreferences(profile)
    }
}

enum ProfileAPI {
    private static let columns = "display_name,home_base,travel_style,interests,packing_style,unit,onboarding_completed,native_preferences"

    @MainActor
    static func fetch() async throws -> RemoteProfile? {
        let auth = AuthClient.shared
        guard let userID = auth.session?.userID else { throw BackendError.expired }
        let config = try await auth.supabase()
        var request = try auth.endpoint(config, "rest/v1/profiles", query: ["id": "eq.\(userID)", "select": columns])
        request.setValue("Bearer \(try await auth.validToken())", forHTTPHeaderField: "Authorization")
        let (data, _) = try await HTTP.send(request)
        return try JSONDecoder().decode([RemoteProfile].self, from: data).first
    }

    @MainActor
    static func save(_ profile: ProfilePatch) async throws {
        let auth = AuthClient.shared
        guard let userID = auth.session?.userID else { throw BackendError.expired }
        let config = try await auth.supabase()
        var request = try auth.endpoint(config, "rest/v1/profiles", query: ["on_conflict": "id"])
        request.httpMethod = "POST"
        request.setValue("Bearer \(try await auth.validToken())", forHTTPHeaderField: "Authorization")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        var body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(profile)) as? [String: Any] ?? [:]
        body["id"] = userID
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await HTTP.send(request)
    }
}

// MARK: Workspace (Worker `/api/workspace`, one versioned document per account)

enum WorkspaceAPI {
    /// The workspace as raw JSON, so fields the app doesn't know survive a
    /// round trip, and its revision for optimistic concurrency.
    @MainActor
    static func fetch() async throws -> (workspace: [String: Any], revision: Int) {
        var request = URLRequest(url: Backend.baseURL.appending(path: "api/workspace"))
        request.setValue("Bearer \(try await AuthClient.shared.validToken())", forHTTPHeaderField: "Authorization")
        let (data, _) = try await HTTP.send(request)
        guard let body = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let workspace = body["workspace"] as? [String: Any],
              let revision = body["revision"] as? Int
        else { throw BackendError(message: "Your trips came back in an unexpected format.") }
        return (workspace, revision)
    }

    /// Saves and returns the new revision. Throws `.conflict` (409) when the
    /// account changed elsewhere since `revision`.
    @MainActor
    static func save(_ workspace: [String: Any], revision: Int) async throws -> Int {
        var request = URLRequest(url: Backend.baseURL.appending(path: "api/workspace"))
        request.httpMethod = "PUT"
        request.setValue("Bearer \(try await AuthClient.shared.validToken())", forHTTPHeaderField: "Authorization")
        request.setValue(Backend.origin, forHTTPHeaderField: "Origin")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["workspace": workspace, "revision": revision])
        do {
            let (data, _) = try await HTTP.send(request)
            let body = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            return body?["revision"] as? Int ?? revision + 1
        } catch let error as BackendError where error.status == 409 {
            throw BackendError.conflict
        }
    }
}

// MARK: Photos (Worker `/api/images`, private to the account)

enum PhotoAPI {
    @MainActor
    static func upload(jpeg: Data) async throws -> String {
        let boundary = "tripsloom-\(UUID().uuidString)"
        var body = Data()
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"image\"; filename=\"wardrobe.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8))
        body.append(jpeg)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        var request = URLRequest(url: Backend.baseURL.appending(path: "api/images"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(try await AuthClient.shared.validToken())", forHTTPHeaderField: "Authorization")
        request.setValue(Backend.origin, forHTTPHeaderField: "Origin")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        let (data, _) = try await HTTP.send(request)
        guard let url = (try JSONSerialization.jsonObject(with: data) as? [String: Any])?["url"] as? String,
              url.wholeMatch(of: /\/api\/images\/[a-f0-9-]{36}/) != nil
        else { throw BackendError(message: "The photo upload returned an invalid path.") }
        return url
    }

    @MainActor
    static func download(_ path: String) async throws -> Data {
        guard path.wholeMatch(of: /\/api\/images\/[a-f0-9-]{36}/) != nil else {
            throw BackendError(message: "Invalid private photo address.")
        }
        var request = URLRequest(url: Backend.baseURL.appending(path: String(path.dropFirst())))
        request.setValue("Bearer \(try await AuthClient.shared.validToken())", forHTTPHeaderField: "Authorization")
        return try await HTTP.send(request).0
    }
}

// MARK: Trip extras (Supabase `public.trip_extras`)

/// The web workspace has no place for trip type, route stages, gear, safety,
/// expenses and the like, so the app keeps them per trip in its own table.
/// Failures are surfaced to the sync engine; pending edits remain on the phone.
enum TripExtrasAPI {
    @MainActor
    static func fetchAll() async throws -> [String: Data] {
        let auth = AuthClient.shared
        let config = try await auth.supabase()
        var request = try auth.endpoint(config, "rest/v1/trip_extras", query: ["select": "trip_id,data"])
        request.setValue("Bearer \(try await auth.validToken())", forHTTPHeaderField: "Authorization")
        let (data, _) = try await HTTP.send(request)
        guard let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            throw BackendError(message: "Your trip details could not be read. Please try again.")
        }
        var result: [String: Data] = [:]
        for row in rows {
            if let id = row["trip_id"] as? String, let payload = row["data"],
               let json = try? JSONSerialization.data(withJSONObject: payload) {
                result[id.lowercased()] = json
            }
        }
        return result
    }

    @MainActor
    static func upsert(_ rows: [(tripID: String, data: Data)]) async throws {
        guard !rows.isEmpty else { return }
        let auth = AuthClient.shared
        guard let userID = auth.session?.userID else { throw BackendError.expired }
        let config = try await auth.supabase()
        var request = try auth.endpoint(config, "rest/v1/trip_extras", query: ["on_conflict": "user_id,trip_id"])
        let token = try await auth.validToken()
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        let body: [[String: Any]] = rows.compactMap { row in
            guard let json = try? JSONSerialization.jsonObject(with: row.data) else { return nil }
            return ["user_id": userID, "trip_id": row.tripID, "data": json]
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await HTTP.send(request)
    }

    @MainActor
    static func delete(_ tripIDs: [String]) async throws {
        guard !tripIDs.isEmpty else { return }
        let auth = AuthClient.shared
        let config = try await auth.supabase()
        let token = try await auth.validToken()
        // IDs originate in the web workspace. Quote filter values rather than
        // allowing punctuation in a legacy ID to alter the PostgREST filter.
        let quoted = tripIDs.map { "\"" + $0.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") + "\"" }
        var request = try auth.endpoint(config, "rest/v1/trip_extras", query: ["trip_id": "in.(\(quoted.joined(separator: ",")))"])
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        _ = try await HTTP.send(request)
    }
}
