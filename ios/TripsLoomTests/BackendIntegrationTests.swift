import XCTest
import UIKit
@testable import TripsLoom

/// Runs only against the local fault-injection replica. Never writes to production.
nonisolated final class BackendIntegrationTests: XCTestCase {
    @MainActor func testDeletingTripDuringPhotoUploadDoesNotResurrectItOrCrash() async throws {
        try await reset(); try await login()
        let store = store()
        defer { store.sync.didSignOut(); AuthClient.shared.signOut() }
        await store.didSignIn(via: .email)
        var trip = Trip(name: "Photo race", place: "Paris", kind: .city, start: .now, dayCount: 2, photo: .lisbon)
        let jpeg = UIGraphicsImageRenderer(size: CGSize(width: 8, height: 8)).jpegData(withCompressionQuality: 0.8) { context in
            UIColor.blue.setFill(); context.fill(CGRect(x: 0, y: 0, width: 8, height: 8))
        }
        trip.coverFile = try XCTUnwrap(CoverStore.shared.save(jpeg, for: trip.id))
        store.add(trip)
        _ = try await admin("delay-next", body: ["path": "/api/images", "method": "POST", "ms": 250])
        async let upload: Void = store.sync.sync()
        try await Task.sleep(for: .milliseconds(80))
        store.delete(trip.id)
        await upload
        await store.sync.sync()
        XCTAssertNil(store.trip(trip.id))
        let state = try await admin("state")
        XCTAssertTrue((state["extras"] as? [Any])?.isEmpty == true)
    }

    @MainActor private func admin(_ path: String, body: [String: Any]? = nil) async throws -> [String: Any] {
        guard Backend.baseURL.host() == "127.0.0.1" else { throw XCTSkip("Start ios/scripts/e2e/run.sh and use the shared test scheme.") }
        var request = URLRequest(url: Backend.baseURL.appending(path: "__admin/" + path))
        if let body { request.httpMethod = "POST"; request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, _) = try await HTTP.send(request)
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    @MainActor private func login(ttl: Int = 3600) async throws {
        var components = URLComponents(url: Backend.baseURL.appending(path: "__admin/mint"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "ttl", value: String(ttl))]
        let request = URLRequest(url: components.url!)
        let (data, _) = try await HTTP.send(request)
        let tokens = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let access = try XCTUnwrap(tokens["access_token"] as? String)
        let refresh = try XCTUnwrap(tokens["refresh_token"] as? String)
        let callback = URL(string: "tripsloom://auth/callback#access_token=\(access)&refresh_token=\(refresh)&expires_in=\(ttl)")!
        _ = try await AuthClient.shared.handle(url: callback)
    }

    @MainActor private func store() -> TripStore {
        let store = TripStore(fileURL: URL.temporaryDirectory.appending(path: "integration-\(UUID().uuidString).json"))
        store.sync.attach(store)
        return store
    }

    @MainActor private func reset() async throws {
        _ = try await admin("reset")
        AuthClient.shared.signOut()
        // Keep background logout from consuming the next injected response.
        try await Task.sleep(for: .milliseconds(80))
    }

    @MainActor func testExtrasFailureKeepsEditsPendingAndRetryUploadsNativeDetails() async throws {
        try await reset(); try await login()
        let store = store()
        defer { store.sync.didSignOut(); AuthClient.shared.signOut() }
        await store.didSignIn(via: .email)
        var trip = Trip(name: "Native extras test", place: "Paris", kind: .city, start: .now, dayCount: 3, photo: .lisbon)
        trip.currency = "EUR"
        trip.expenses = [Expense(title: "Train", category: .transport, amount: 12.50)]
        store.add(trip)
        _ = try await admin("fail-next", body: ["path": "/rest/v1/trip_extras", "method": "POST", "status": 503])
        await store.sync.sync()
        XCTAssertTrue(store.sync.pendingChanges)
        if case .failed = store.sync.status {} else { XCTFail("Extras failure must not report synced") }
        await store.sync.sync()
        XCTAssertFalse(store.sync.pendingChanges)
        let state = try await admin("state")
        let extras = try XCTUnwrap(state["extras"] as? [[String: Any]])
        XCTAssertTrue(extras.contains { $0["name"] as? String == trip.name })
        store.delete(trip.id); await store.sync.sync()
        let deleted = try await admin("state")
        XCTAssertTrue((deleted["extras"] as? [Any])?.isEmpty == true)
    }

    @MainActor func testRateLimitedRefreshRetainsSessionAndCanRetry() async throws {
        try await reset(); try await login(ttl: 10)
        defer { AuthClient.shared.signOut() }
        let user = AuthClient.shared.session?.userID
        _ = try await admin("fail-next", body: ["path": "/auth/v1/token", "method": "POST", "status": 429])
        do { _ = try await AuthClient.shared.validToken(); XCTFail("Expected rate limit") }
        catch let error as BackendError { XCTAssertEqual(error.status, 429) }
        XCTAssertEqual(AuthClient.shared.session?.userID, user)
        _ = try await AuthClient.shared.validToken()
        XCTAssertTrue(AuthClient.shared.session?.isExpiring == false)
    }

    @MainActor func testConcurrentRefreshUsesOneRotatingToken() async throws {
        try await reset(); try await login(ttl: 10)
        defer { AuthClient.shared.signOut() }
        _ = try await admin("delay-next", body: ["path": "/auth/v1/token", "method": "POST", "ms": 150])
        async let first = AuthClient.shared.validToken()
        async let second = AuthClient.shared.validToken()
        let pair = try await (first, second)
        XCTAssertEqual(pair.0, pair.1)
        XCTAssertEqual(AuthClient.shared.session?.accessToken, pair.0)
    }

    @MainActor func testDelayedLogoutCannotClearNewLogin() async throws {
        try await reset(); try await login()
        defer { AuthClient.shared.signOut() }
        _ = try await admin("delay-next", body: ["path": "/auth/v1/logout", "ms": 250])
        AuthClient.shared.signOut()
        try await login()
        let newToken = AuthClient.shared.session?.accessToken
        try await Task.sleep(for: .milliseconds(400))
        XCTAssertNotNil(newToken)
        XCTAssertEqual(AuthClient.shared.session?.accessToken, newToken)
        _ = try await AuthClient.shared.validToken()
    }

    @MainActor func testPreferencesRemainPendingAfterFailureAndSyncOnRetry() async throws {
        try await reset(); try await login()
        let store = store()
        defer { store.sync.didSignOut(); AuthClient.shared.signOut() }
        await store.didSignIn(via: .email)
        store.profile.name = "Traveller"
        store.profile.diet = "Vegan"
        store.profile.pace = "Relaxed"
        store.profile.onboardingCompleted = true
        _ = try await admin("fail-next", body: ["path": "/rest/v1/profiles", "method": "POST", "status": 503])
        await store.sync.sync()
        XCTAssertTrue(store.sync.pendingChanges)
        await store.sync.sync()
        XCTAssertFalse(store.sync.pendingChanges)
        let state = try await admin("state")
        let remote = try XCTUnwrap(state["profile"] as? [String: Any])
        let prefs = try XCTUnwrap(remote["native_preferences"] as? [String: Any])
        XCTAssertEqual(prefs["diet"] as? String, "Vegan")
        XCTAssertEqual(prefs["pace"] as? String, "Relaxed")
        XCTAssertEqual(prefs["onboardingCompleted"] as? Bool, true)
    }

    @MainActor func testPrivatePhotoRejectsExternalAddressesBeforeSendingCredentials() async throws {
        do { _ = try await PhotoAPI.download("https://example.test/steal"); XCTFail("Expected rejection") }
        catch let error as BackendError { XCTAssertEqual(error.message, "Invalid private photo address.") }
    }

    @MainActor func testExistingTripReceivesNativeEditsEvenWhenWorkspaceRevisionIsUnchanged() async throws {
        try await reset(); try await login()
        let store = store()
        defer { store.sync.didSignOut(); AuthClient.shared.signOut() }
        await store.didSignIn(via: .email)
        var t = Trip(name: "Across devices", place: "Paris", kind: .city, start: .now, dayCount: 3, photo: .lisbon)
        t.currency = "EUR"; store.add(t); await store.sync.sync()
        // A second device finishes its extras upload after workspace was read.
        t.expenses = [Expense(title: "Added elsewhere", category: .transport, amount: 7.25)]
        try await TripExtrasAPI.upsert([(WorkspaceMapper.key(t.id), try JSONEncoder.store.encode(t.cloudCopy))])
        await store.sync.sync()
        XCTAssertEqual(store.trip(t.id)?.expenses.first?.amount, 7.25)
    }

    /// Like the app across launches: the store and sync state are reloaded
    /// from disk before each round of edits and syncs.
    @MainActor func testRelaunchesWithClimbEditsNeverCreateRecoveredCopies() async throws {
        try await reset(); try await login()
        let file = URL.temporaryDirectory.appending(path: "integration-relaunch-\(UUID().uuidString).json")
        var store = TripStore(fileURL: file)
        store.sync.attach(store)
        defer { store.sync.didSignOut(); AuthClient.shared.signOut() }
        await store.didSignIn(via: .email)
        var t = Trip(name: "Island Peak relaunch", place: "Lukla, Nepal", kind: .climb, start: .now.addingTimeInterval(14 * 86_400), dayCount: 4, photo: .himalaya)
        t.stages = [Stage(day: 1, title: "Arrival and acclimatisation", meta: "", km: 8.5, ascent: 450, altitude: 3_400, hours: "4–5 h"),
                    Stage(day: 2, title: "Scenic traverse and overnight stay", meta: "", km: 12, ascent: 450, altitude: 3_400, hours: "4–5 h")]
        t.gear = PackingSuggestions.gear(for: .climb)
        t.adventure = Adventure()
        t.adventure?.summit = Summit(peak: "Island Peak", altitude: 6_189, forecast: [], dawnTemp: -15, leaveTime: "02:00", highCamp: 5_600, turnaround: "11:00")
        store.add(t); await store.sync.sync(); await store.sync.sync()
        guard case .synced = store.sync.status else { return XCTFail("First sync didn't finish: \(store.sync.status)") }
        for round in 0..<3 {
            // Relaunch: a fresh store and sync engine read everything back from disk.
            store = TripStore(fileURL: file)
            store.sync.attach(store)
            await store.sync.sync()
            store.update(t.id) { trip in
                // Like ClimbView's live refresh, dawn temperatures included.
                let days = (0..<5).map { WindDay(date: .now.addingTimeInterval(Double($0) * 86_400), kmh: 7 + round) }
                trip.adventure?.summit?.forecast = days
                trip.adventure?.summit?.dawnTemps = Dictionary(uniqueKeysWithValues: days.map { ($0.id, -15 - round) })
                trip.adventure?.summit?.updated = .now
            }
            await store.sync.sync()
            await store.sync.sync()
            guard case .synced = store.sync.status else { return XCTFail("Round \(round) didn't sync: \(store.sync.status)") }
        }
        XCTAssertFalse(store.trips.contains { $0.name.contains("recovered edits") }, store.trips.map(\.name).joined(separator: ", "))
        XCTAssertNil(store.sync.recoveryNotice)
    }

    @MainActor func testRepeatedLocalEditsOnASyncedClimbNeverCreateRecoveredCopies() async throws {
        try await reset(); try await login()
        let store = store()
        defer { store.sync.didSignOut(); AuthClient.shared.signOut() }
        await store.didSignIn(via: .email)
        var t = Trip(name: "Island Peak QA", place: "Chhukung, Nepal", kind: .climb, start: .now.addingTimeInterval(10 * 86_400), dayCount: 4, photo: .himalaya)
        t.currency = "USD"
        t.stages = [Stage(day: 1, title: "Chhukung → Base camp", meta: "", km: 6, ascent: 400, altitude: 5_087, hours: "4 h"),
                    Stage(day: 2, title: "Base camp → High camp", meta: "", km: 3, ascent: 500, altitude: 5_600, hours: "3 h")]
        t.gear = PackingSuggestions.gear(for: .climb)
        t.adventure = Adventure()
        t.adventure?.summit = Summit(peak: "Island Peak", altitude: 6_189, forecast: [], dawnTemp: -12, leaveTime: "02:00", highCamp: 5_600, turnaround: "11:00")
        store.add(t); await store.sync.sync()
        for round in 0..<3 {
            // Like ClimbView refreshing the live forecast, and packing a piece of gear.
            store.update(t.id) { trip in
                trip.adventure?.summit?.forecast = (0..<5).map { WindDay(date: .now.addingTimeInterval(Double($0) * 86_400), kmh: 10 + round) }
                trip.adventure?.summit?.updated = .now
                if !trip.gear.isEmpty { trip.gear[round % trip.gear.count].packed.toggle() }
            }
            await store.sync.sync()
            await store.sync.sync()
        }
        XCTAssertFalse(store.trips.contains { $0.name.contains("recovered edits") }, store.trips.map(\.name).joined(separator: ", "))
        XCTAssertNil(store.sync.recoveryNotice)
    }

    @MainActor func testConcurrentTripEditsRecoverBothVersionsInsteadOfOverwriting() async throws {
        try await reset(); try await login()
        let store = store()
        defer { store.sync.didSignOut(); AuthClient.shared.signOut() }
        await store.didSignIn(via: .email)
        var t = Trip(name: "Original", place: "Paris", kind: .city, start: .now, dayCount: 3, photo: .lisbon)
        t.currency = "EUR"; store.add(t); await store.sync.sync()
        store.update(t.id) { $0.name = "Local edit" }
        let state = try await admin("state")
        var workspace = try XCTUnwrap(state["workspace"] as? [String: Any])
        var rows = try XCTUnwrap(workspace["trips"] as? [[String: Any]])
        rows[0]["name"] = "Web edit"; workspace["trips"] = rows
        _ = try await admin("web-edit", body: workspace)
        await store.sync.sync()
        XCTAssertEqual(store.trip(t.id)?.name, "Web edit")
        XCTAssertTrue(store.trips.contains { $0.name == "Local edit (recovered edits)" })
        XCTAssertNotNil(store.sync.recoveryNotice)
        XCTAssertFalse(store.sync.pendingChanges)
    }
    @MainActor func testConcurrentWardrobeEditsRecoverLocalOutfitReferences() async throws {
        try await reset(); try await login()
        let store = store()
        defer { store.sync.didSignOut(); AuthClient.shared.signOut() }
        await store.didSignIn(via: .email)
        let item = WardrobeItem(name: "Original shirt", category: .tops, color: 0xFFFFFF)
        var t = Trip(name: "With outfits", place: "Paris", kind: .city, start: .now, dayCount: 3, photo: .lisbon)
        t.currency = "EUR"; t.outfits = [Outfit(day: 0, title: "Morning", items: [item.id])]; t.capsule = [item.id]
        t.packing = [PackItem(name: item.name, section: "Clothes", wardrobeID: item.id)]
        store.wardrobe = [item]; store.add(t); await store.sync.sync()
        store.wardrobe[0].name = "Local linen shirt"
        store.update(t.id) { $0.outfits[0].title = "Local afternoon" }
        let server = try await admin("state")
        var workspace = try XCTUnwrap(server["workspace"] as? [String: Any])
        var items = try XCTUnwrap(workspace["items"] as? [[String: Any]])
        items[0]["name"] = "Web cotton shirt"; workspace["items"] = items
        _ = try await admin("web-edit", body: workspace)
        await store.sync.sync()
        XCTAssertEqual(store.wardrobe.first { $0.id == item.id }?.name, "Web cotton shirt")
        let recovered = try XCTUnwrap(store.wardrobe.first { $0.name == "Local linen shirt (recovered edits)" })
        XCTAssertEqual(store.trip(t.id)?.outfits.first?.items, [recovered.id])
        XCTAssertEqual(store.trip(t.id)?.capsule, [recovered.id])
        XCTAssertEqual(store.trip(t.id)?.packing.first?.wardrobeID, recovered.id)
        XCTAssertFalse(store.sync.pendingChanges)
        await store.sync.sync()
        XCTAssertEqual(store.wardrobe.count, 2, "A repeated sync must not create another recovered copy")
    }

}
