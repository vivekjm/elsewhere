import Foundation
import UIKit

/// Keeps a signed-in account's trips in step with tripsloom.com.
///
/// Edits save on the phone first and push shortly after. Every push carries
/// the revision it was based on; if the account changed elsewhere, the app
/// fetches the newer copy, preserves both versions of conflicting trip edits,
/// and pushes again with web-only fields preserved by the mapper.
@Observable
@MainActor
final class SyncEngine {
    nonisolated deinit {}
    enum Status: Equatable {
        case local
        case syncing
        case synced(Date)
        case offline
        case failed(String)
        case expired
    }

    private(set) var status: Status = .local
    private(set) var pendingChanges = false
    private(set) var recoveryNotice: String?

    @ObservationIgnored private weak var store: TripStore?
    @ObservationIgnored private var state: SyncState
    @ObservationIgnored private var pushTask: Task<Void, Never>?
    @ObservationIgnored private var profileTask: Task<Void, Never>?
    @ObservationIgnored private var running = false
    /// A change arrived while a sync was running; run once more after it.
    @ObservationIgnored private var rerun = false
    @ObservationIgnored private var applyingRemote = false
    @ObservationIgnored private var generation = UUID()
    @ObservationIgnored private var localEditVersion = 0

    struct SyncState: Codable {
        var userID: String?
        var revision = 0
        /// Last workspace the server confirmed, as JSON.
        var base: Data?
        var syncedTrips: Set<String> = []
        var syncedItems: Set<String> = []
        /// Fingerprints of each trip's app-only details last uploaded.
        var extrasHashes: [String: Int] = [:]
        /// Fingerprints of each trip and piece as last synced, so a merge can
        /// tell which ones this phone has changed since.
        var syncedTripPrints: [String: Int]?
        var syncedItemPrints: [String: Int]?
        var dirty = false
        var profileDirty: Bool?
    }

    private static let printEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        // Same whole-second dates as the trips file, so a trip reads the same
        // after a relaunch.
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    static func fingerprint(_ value: some Encodable) -> Int {
        guard let data = try? printEncoder.encode(value) else { return 0 }
        return data.reduce(5381) { ($0 &* 33) &+ Int($1) }
    }

    private static var stateURL: URL { URL.applicationSupportDirectory.appending(path: "tripsloom-sync\(TripStore.testScope).json") }

    init() {
        state = (try? Data(contentsOf: Self.stateURL)).flatMap { try? JSONDecoder().decode(SyncState.self, from: $0) } ?? SyncState()
        pendingChanges = state.dirty || state.profileDirty == true
    }

    func attach(_ store: TripStore) {
        self.store = store
        if AuthClient.shared.session != nil { status = state.dirty ? .offline : .local }
    }

    var isSignedIn: Bool { AuthClient.shared.session != nil }
    var accountEmail: String? { AuthClient.shared.session?.email }

    private func persist() {
        pendingChanges = state.dirty || state.profileDirty == true
        guard let data = try? JSONEncoder().encode(state) else { return }
        try? data.write(to: Self.stateURL, options: [.atomic, .completeFileProtection])
    }

    // MARK: Triggers

    /// Called by the store after any change to trips or the wardrobe.
    func localChange() {
        // With an account whose session lapsed, note the edit so it goes up
        // after signing in again.
        guard !applyingRemote, isSignedIn || state.userID != nil else { return }
        localEditVersion += 1
        state.dirty = true
        persist()
        guard isSignedIn else { return }
        pushTask?.cancel()
        pushTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1.5))
            guard !Task.isCancelled else { return }
            await self?.sync()
        }
    }

    /// Called after profile edits; pushes the fields the web app shares.
    func profileChange() {
        guard !applyingRemote, isSignedIn || state.userID != nil else { return }
        state.profileDirty = true
        persist()
        guard isSignedIn else { return }
        profileTask?.cancel()
        profileTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            await self?.sync()
        }
    }

    // MARK: Sign in and out

    /// After signing in: take the account's profile, drop untouched sample
    /// trips, and merge this phone's own trips into the account.
    func didSignIn() async {
        guard let store, let session = AuthClient.shared.session else { return }
        generation = UUID()
        let epoch = generation
        let switching = state.userID != nil && state.userID != session.userID
        if state.userID != session.userID {
            // A different account: nothing on this phone has been synced to it.
            state = SyncState(userID: session.userID)
            persist()
        }
        applyingRemote = true
        if switching {
            // The last account's trips live in that account; don't copy
            // them into this one.
            store.trips = []
            store.wardrobe = []
            store.openTripID = nil
        }
        store.profile.email = session.email
        if store.profile.sampleNoticeDismissed != true {
            store.trips.removeAll { $0.isSample == true }
            let used = Self.usedItems(store.trips)
            store.wardrobe.removeAll { $0.isSample == true && !used.contains($0.id) }
            store.profile.sampleNoticeDismissed = true
        }
        var remote: RemoteProfile?
        var profileFetched = false
        do { remote = try await ProfileAPI.fetch(); profileFetched = true } catch { /* retry without overwriting server preferences */ }
        guard epoch == generation, AuthClient.shared.session?.userID == session.userID else { return }
        if let remote, state.profileDirty != true {
            if !remote.display_name.isEmpty { store.profile.name = remote.display_name }
            if !remote.home_base.isEmpty { store.profile.homeAirport = remote.home_base }
            store.profile.metric = remote.unit != "imperial"
            remote.native_preferences?.apply(to: &store.profile)
        }
        applyingRemote = false
        // No profile yet (never used the website): share what's set here.
        if profileFetched, remote == nil, !store.profile.name.isEmpty {
            state.profileDirty = true
            persist()
        }
        // The merge marks trips that are new here; nothing to send otherwise.
        await sync()
    }

    /// Signing out removes the account's trips from this phone.
    func didSignOut() {
        generation = UUID()
        pushTask?.cancel()
        profileTask?.cancel()
        rerun = false
        applyingRemote = false
        state = SyncState()
        persist()
        status = .local
    }

    // MARK: Sync

    func sync(retrying: Bool = false) async {
        guard isSignedIn, let store else { return }
        guard !running else { rerun = true; return }
        if FeedbackAPI.pendingCount > 0 { Task { await FeedbackAPI.flushPending() } }
        let epoch = generation
        running = true
        status = .syncing
        defer {
            running = false
            if rerun {
                rerun = false
                Task { await self.sync() }
            }
        }
        do {
            if state.profileDirty == true {
                let profile = store.profile
                let fingerprint = Self.fingerprint(profile)
                try await ProfileAPI.save(ProfilePatch(profile))
                try checkAccount(epoch)
                state.profileDirty = Self.fingerprint(store.profile) != fingerprint
                persist()
                // Account metadata is secondary to the saved profile.
                await AuthClient.shared.updateDisplayName(profile.name)
                try checkAccount(epoch)
            }
            try await uploadPhotos()
            try checkAccount(epoch)
            let remote = try await WorkspaceAPI.fetch()
            try checkAccount(epoch)
            // Extras are a separate write from the versioned workspace. They
            // may arrive after that revision, so reconcile on every sync.
            try await merge(remote.workspace, revision: remote.revision)
            if state.dirty {
                try await push()
            }
            await downloadPhotos()
            try checkAccount(epoch)
            status = .synced(.now)
        } catch is CancellationError {
            return
        } catch let error as BackendError {
            guard epoch == generation else { return }
            if error.status == 401, !retrying, await AuthClient.shared.forceRefresh() {
                running = false
                await sync(retrying: true)
                return
            }
            switch error.status {
            case 401: status = AuthClient.shared.session == nil ? .expired : .failed("Your account could not be refreshed. Your trips are kept here; try again shortly.")
            case 0 where error.message == BackendError.offline.message: status = .offline
            default: status = .failed(error.message)
            }
        } catch {
            guard epoch == generation else { return }
            status = .failed(error.localizedDescription)
        }
        _ = store
    }

    /// Brings in the server copy, record by record:
    /// - edited on both sides: retain the account trip and a recovered local
    ///   copy, rather than silently discarding either person's changes;
    /// - deleted on this phone: stays deleted;
    /// - otherwise the server's version, including deletions made elsewhere;
    /// - new on this phone (never synced): kept to be pushed.
    private func merge(_ workspace: [String: Any], revision: Int) async throws {
        guard let store else { return }
        let key = WorkspaceMapper.key
        let epoch = generation
        let extras = try await TripExtrasAPI.fetchAll()
        try checkAccount(epoch)
        let imported = WorkspaceMapper.importWorkspace(workspace, known: store.trips, wardrobe: store.wardrobe, extras: extras)
        let remoteTrips = Set(imported.trips.map { key($0.id) })
        let remoteItems = Set(imported.wardrobe.map { key($0.id) })

        let tripPrints = state.syncedTripPrints ?? [:]
        let localTrips = Dictionary(store.trips.map { (key($0.id), $0) }, uniquingKeysWith: { a, _ in a })
        let changedTrips = Set(localTrips.filter { tripPrints[$0.key] != Self.fingerprint($0.value) }.keys)
        let base = state.base.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        func records(_ json: [String: Any]?, key: String) -> [String: [String: Any]] {
            Dictionary(((json?[key] as? [[String: Any]]) ?? []).compactMap { row in
                (row["id"] as? String).map { (WorkspaceMapper.canonical($0), row) }
            }, uniquingKeysWith: { a, _ in a })
        }
        func differs(_ a: [String: Any]?, _ b: [String: Any]?) -> Bool {
            guard let a, let b else { return false }
            return (try? JSONSerialization.data(withJSONObject: a, options: .sortedKeys)) !=
                (try? JSONSerialization.data(withJSONObject: b, options: .sortedKeys))
        }
        let prior = records(base, key: "trips"), received = records(workspace, key: "trips")
        func recovered(_ original: Trip) -> Trip {
            var copy = original
            copy.id = UUID()
            copy.name = String(original.name.prefix(170)) + " (recovered edits)"
            copy.coverFile = nil
            state.dirty = true
            recoveryNotice = "Concurrent changes were preserved in a trip named ‘recovered edits’. Review both copies in Trips."
            return copy
        }
        var trips: [Trip] = []
        var localTripIDs = Set<UUID>()
        var arrivedWithoutZone: [UUID] = []
        for trip in imported.trips {
            let id = key(trip.id)
            if let local = localTrips[id] {
                let nativeChanged = extras[id].flatMap { try? JSONDecoder.store.decode(Trip.self, from: $0) }.map { remoteExtra in
                    guard let baseline = state.extrasHashes[id] else { return false }
                    return baseline != Self.fingerprint(remoteExtra.cloudCopy)
                } ?? false
                // A baseline is required: the first merge of trips made before sign-in is not a conflict.
                let bothChanged = changedTrips.contains(id) && state.syncedTrips.contains(id)
                    && (differs(prior[id], received[id]) || nativeChanged == true)
                if bothChanged {
                    trips.append(trip)
                    let copy = recovered(local); trips.append(copy); localTripIDs.insert(copy.id)
                } else {
                    trips.append(changedTrips.contains(id) ? local : trip)
                    if changedTrips.contains(id) { localTripIDs.insert(local.id) }
                }
            } else if !state.syncedTrips.contains(id) {
                trips.append(trip)          // new elsewhere
                if trip.timeZoneID == nil { arrivedWithoutZone.append(trip.id) }
            }                               // else: deleted on this phone
        }
        for (id, trip) in localTrips where !remoteTrips.contains(id) {
            if !state.syncedTrips.contains(id) { trips.append(trip); localTripIDs.insert(trip.id) }
            else if changedTrips.contains(id) {
                let copy = recovered(trip); trips.append(copy); localTripIDs.insert(copy.id)
            }
        }

        let itemPrints = state.syncedItemPrints ?? [:]
        let localItems = Dictionary(store.wardrobe.map { (key($0.id), $0) }, uniquingKeysWith: { a, _ in a })
        let changedItems = Set(localItems.filter { itemPrints[$0.key] != Self.fingerprint($0.value) }.keys)
        let priorItems = records(base, key: "items"), receivedItems = records(workspace, key: "items")
        var recoveredItems: [UUID: UUID] = [:]
        func recoverItem(_ original: WardrobeItem) -> WardrobeItem {
            var copy = original; copy.id = UUID()
            copy.name = String(original.name.prefix(170)) + " (recovered edits)"
            // Each record owns its local photo; deleting either copy is safe.
            if let image = WardrobePhotos.image(original.imageFile), let data = image.jpegData(compressionQuality: 0.85) {
                copy.imageFile = WardrobePhotos.save(data, for: copy.id)
            }
            recoveredItems[original.id] = copy.id
            state.dirty = true
            recoveryNotice = "Concurrent changes were preserved as recovered edits. Review both copies in Trips and Wardrobe."
            return copy
        }
        var wardrobe: [WardrobeItem] = []
        for item in imported.wardrobe {
            let id = key(item.id)
            if let local = localItems[id] {
                if changedItems.contains(id), state.syncedItems.contains(id), differs(priorItems[id], receivedItems[id]) {
                    // Explicit recovery preserves both edits and their outfit references.
                    wardrobe.append(item); wardrobe.append(recoverItem(local))
                } else { wardrobe.append(changedItems.contains(id) ? local : item) }
            } else if !state.syncedItems.contains(id) {
                wardrobe.append(item)
            }
        }
        for item in store.wardrobe where !remoteItems.contains(key(item.id)) {
            if !state.syncedItems.contains(key(item.id)) { wardrobe.append(item) }
            else if changedItems.contains(key(item.id)) { wardrobe.append(recoverItem(item)) }
        }
        for i in trips.indices where localTripIDs.contains(trips[i].id) {
            for j in trips[i].outfits.indices {
                trips[i].outfits[j].items = trips[i].outfits[j].items.map { recoveredItems[$0] ?? $0 }
            }
            trips[i].capsule = trips[i].capsule.map { recoveredItems[$0] ?? $0 }
            for j in trips[i].packing.indices {
                if let id = trips[i].packing[j].wardrobeID, let replacement = recoveredItems[id] {
                    trips[i].packing[j].wardrobeID = replacement
                }
            }
        }

        let pendingTrips = Set(trips.map { key($0.id) }).intersection(changedTrips)
        let pendingItems = Set(wardrobe.map { key($0.id) }).intersection(changedItems)
        let deletedHere = state.syncedTrips.subtracting(localTrips.keys).intersection(remoteTrips)
            .union(state.syncedItems.subtracting(localItems.keys).intersection(remoteItems))
        if !pendingTrips.isEmpty || !pendingItems.isEmpty || !deletedHere.isEmpty { state.dirty = true }

        applyingRemote = true
        store.trips = trips.sorted { $0.start < $1.start }
        store.wardrobe = wardrobe
        applyingRemote = false
        if let open = store.openTripID, store.trip(open) == nil { store.openTripID = nil }
        // Trips made on the website have dates but no time zone; find the destination's.
        for id in arrivedWithoutZone { store.adoptDestinationTimeZone(id) }

        state.base = try JSONSerialization.data(withJSONObject: workspace)
        state.revision = revision
        state.syncedTrips = remoteTrips
        state.syncedItems = remoteItems
        // Records taken from the server are now in step; ones still waiting
        // to be pushed keep their old fingerprint so they stay "changed".
        var newTripPrints: [String: Int] = [:]
        for trip in trips where remoteTrips.contains(key(trip.id)) {
            let id = key(trip.id)
            newTripPrints[id] = pendingTrips.contains(id) ? tripPrints[id] : Self.fingerprint(trip)
        }
        var newItemPrints: [String: Int] = [:]
        for item in wardrobe where remoteItems.contains(key(item.id)) {
            let id = key(item.id)
            newItemPrints[id] = pendingItems.contains(id) ? itemPrints[id] : Self.fingerprint(item)
        }
        state.syncedTripPrints = newTripPrints
        state.syncedItemPrints = newItemPrints
        for trip in trips where remoteTrips.contains(key(trip.id)) && !pendingTrips.contains(key(trip.id)) {
            if let raw = extras[key(trip.id)].flatMap({ try? JSONDecoder.store.decode(Trip.self, from: $0) }) {
                state.extrasHashes[key(trip.id)] = Self.fingerprint(raw)
            }
        }
        persist()
    }

    private func push() async throws {
        guard store != nil else { return }
        let base = state.base.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        do {
            try await save(over: base, revision: state.revision)
        } catch let error as BackendError where error.status == 409 {
            // Changed elsewhere: take the newer copy, then push once more.
            let remote = try await WorkspaceAPI.fetch()
            try await merge(remote.workspace, revision: remote.revision)
            try await save(over: remote.workspace, revision: remote.revision)
        }
    }

    /// Wardrobe pieces the account's trips use, sample or not.
    private static func usedItems(_ trips: [Trip]) -> Set<UUID> {
        Set(trips.filter { $0.isSample != true }.flatMap { trip in
            trip.packing.compactMap(\.wardrobeID) + trip.outfits.flatMap(\.items) + trip.capsule
        })
    }

    /// Your own pieces, plus sample pieces once one of your trips uses them.
    private func uploadable(_ store: TripStore) -> [WardrobeItem] {
        let used = Self.usedItems(store.trips)
        return store.wardrobe.filter { $0.isSample != true || used.contains($0.id) }
    }

    private func save(over base: [String: Any]?, revision: Int) async throws {
        guard let store else { return }
        let epoch = generation
        let editVersion = localEditVersion
        let trips = store.trips.filter { $0.isSample != true }
        let wardrobe = uploadable(store)
        let workspace = WorkspaceMapper.export(trips: trips, wardrobe: wardrobe, base: base)
        let savedRevision = try await WorkspaceAPI.save(workspace, revision: revision)
        try checkAccount(epoch)
        state.revision = savedRevision
        state.base = try JSONSerialization.data(withJSONObject: workspace)
        state.syncedTrips = Set(trips.map { WorkspaceMapper.key($0.id) })
        state.syncedItems = Set(wardrobe.map { WorkspaceMapper.key($0.id) })
        // What was just sent is the new common ground.
        state.syncedTripPrints = Dictionary(trips.map { (WorkspaceMapper.key($0.id), Self.fingerprint($0)) }, uniquingKeysWith: { a, _ in a })
        state.syncedItemPrints = Dictionary(wardrobe.map { item in
            var sent = item
            sent.isSample = nil
            return (WorkspaceMapper.key(item.id), Self.fingerprint(sent))
        }, uniquingKeysWith: { a, _ in a })
        // Uploaded sample pieces are yours now.
        let adopted = Set(wardrobe.filter { $0.isSample == true }.map(\.id))
        if !adopted.isEmpty {
            applyingRemote = true
            for index in store.wardrobe.indices where adopted.contains(store.wardrobe[index].id) {
                store.wardrobe[index].isSample = nil
            }
            applyingRemote = false
        }
        try await pushExtras(trips)
        try checkAccount(epoch)
        state.dirty = editVersion != localEditVersion
        if state.dirty { rerun = true }
        persist()
    }

    private func pushExtras(_ trips: [Trip]) async throws {
        let epoch = generation
        var confirmedHashes = state.extrasHashes
        var rows: [(tripID: String, data: Data)] = []
        for trip in trips {
            let cloud = trip.cloudCopy
            let data = try JSONEncoder.store.encode(cloud)
            // Sorted keys, so an unchanged trip hashes the same every time.
            let id = WorkspaceMapper.key(trip.id), hash = Self.fingerprint(cloud)
            if state.extrasHashes[id] != hash {
                rows.append((id, data))
                confirmedHashes[id] = hash
            }
        }
        let removed = Set(state.extrasHashes.keys).subtracting(trips.map { WorkspaceMapper.key($0.id) })
        for id in removed { confirmedHashes[id] = nil }
        try await TripExtrasAPI.upsert(rows)
        try checkAccount(epoch)
        try await TripExtrasAPI.delete(Array(removed))
        try checkAccount(epoch)
        state.extrasHashes = confirmedHashes
        persist()
    }

    // MARK: Photos

    private func checkAccount(_ epoch: UUID) throws {
        guard generation == epoch, isSignedIn, state.userID == AuthClient.shared.session?.userID else {
            throw CancellationError()
        }
    }

    private func uploadPhotos() async throws {
        guard let store else { return }
        let epoch = generation
        for trip in store.trips where trip.isSample != true && trip.coverFile != nil && trip.coverRemote == nil {
            guard let jpeg = CoverStore.shared.data(trip.coverFile) else { continue }
            let path = try await PhotoAPI.upload(jpeg: jpeg)
            try checkAccount(epoch)
            guard let index = store.trips.firstIndex(where: { $0.id == trip.id && $0.coverFile == trip.coverFile && $0.coverRemote == nil }) else { continue }
            applyingRemote = true
            store.trips[index].coverRemote = path
            applyingRemote = false
            state.dirty = true
        }
        for item in uploadable(store) where item.remotePhoto == nil {
            guard let image = WardrobePhotos.image(item.imageFile), let jpeg = image.jpegData(compressionQuality: 0.8) else { continue }
            let path = try await PhotoAPI.upload(jpeg: jpeg)
            try checkAccount(epoch)
            guard let index = store.wardrobe.firstIndex(where: { $0.id == item.id && $0.imageFile == item.imageFile && $0.remotePhoto == nil }) else { continue }
            applyingRemote = true
            store.wardrobe[index].remotePhoto = path
            applyingRemote = false
            state.dirty = true
        }
    }

    private func downloadPhotos() async {
        guard let store else { return }
        let epoch = generation
        for trip in store.trips {
            let file = trip.coverFile ?? CoverStore.fileName(for: trip.id)
            guard let path = trip.coverRemote, !CoverStore.shared.exists(file),
                  let data = try? await PhotoAPI.download(path),
                  (try? checkAccount(epoch)) != nil,
                  let index = store.trips.firstIndex(where: { $0.id == trip.id && $0.coverRemote == path }),
                  let saved = CoverStore.shared.save(data, for: trip.id) else { continue }
            applyingRemote = true
            store.trips[index].coverFile = saved
            applyingRemote = false
        }
        for item in store.wardrobe {
            guard let path = item.remotePhoto, WardrobePhotos.image(item.imageFile) == nil,
                  let data = try? await PhotoAPI.download(path),
                  (try? checkAccount(epoch)) != nil,
                  let index = store.wardrobe.firstIndex(where: { $0.id == item.id && $0.remotePhoto == path }),
                  let name = WardrobePhotos.save(data, for: item.id) else { continue }
            let id = WorkspaceMapper.key(item.id)
            let wasInStep = state.syncedItemPrints?[id] == Self.fingerprint(store.wardrobe[index])
            applyingRemote = true
            store.wardrobe[index].imageFile = name
            applyingRemote = false
            if wasInStep { state.syncedItemPrints?[id] = Self.fingerprint(store.wardrobe[index]) }
        }
    }
}
