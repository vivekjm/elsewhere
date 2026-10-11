import SwiftUI

/// App state, saved as JSON in Application Support after every change.
@Observable
final class TripStore {
    // No executor-bound cleanup is required. Explicitly nonisolated avoids
    // the older iOS runtime's isolated-deinit path when short-lived stores end.
    nonisolated deinit {}
    var trips: [Trip] {
        didSet {
            scheduleSave()
            sync.localChange()
            let kept = Set(trips.map(\.id))
            if !replacingData, oldValue.contains(where: { !kept.contains($0.id) }) {
                Task { @MainActor in
                    TripDocuments.shared.prune(keeping: kept)
                    CoverStore.shared.prune(keeping: kept)
                    RouteSnapshots.prune(keeping: kept)
                }
            }
        }
    }
    var wardrobe: [WardrobeItem] {
        didSet {
            scheduleSave()
            sync.localChange()
        }
    }
    var profile: Profile {
        didSet {
            Fmt.metric = profile.metric
            scheduleSave()
            if profile.name != oldValue.name || profile.homeAirport != oldValue.homeAirport
                || profile.metric != oldValue.metric || profile.travelStyle != oldValue.travelStyle
                || profile.diet != oldValue.diet || profile.pace != oldValue.pace
                || profile.budgetStyle != oldValue.budgetStyle || profile.onboardingCompleted != oldValue.onboardingCompleted {
                sync.profileChange()
            }
        }
    }
    /// Account sync with tripsloom.com; idle for guests.
    let sync = SyncEngine()
    var session: Session { didSet { scheduleSave() } }
    private(set) var storageError: String?

    /// The trip whose tab bar is showing. `nil` shows the global tabs.
    var openTripID: UUID?
    /// Where to land when a trip opens from a deep link (search, home cards).
    @ObservationIgnored var pendingTab: TripTab?
    @ObservationIgnored var pendingBudget = false
    /// The card the trip was opened from, for the zoom transition.
    @ObservationIgnored var openSource: String?

    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var savingBlocked = false
    @ObservationIgnored private var replacingData = false
    @ObservationIgnored private let fileURL: URL

    private struct Snapshot: Codable {
        var version = 1
        var trips: [Trip]
        var wardrobe: [WardrobeItem]
        var profile: Profile
        var session: Session
    }

    init(fileURL: URL = TripStore.defaultURL) {
        self.fileURL = fileURL
        var recoveryError: String?
        var blockSaving = false
        var savedData: Data?
        if FileManager.default.fileExists(atPath: fileURL.path) {
            do { savedData = try Data(contentsOf: fileURL) }
            catch {
                blockSaving = true
                recoveryError = "Your existing saved data could not be opened. It is being preserved. Try opening the app again after unlocking this iPhone, or contact support."
            }
        }
        if let data = savedData {
            do {
                let snapshot = try JSONDecoder.store.decode(Snapshot.self, from: data)
                // Older builds saved "9:00 AM" on 12-hour phones; keep "HH:mm".
                trips = snapshot.trips.map { trip in
                    var trip = trip
                    for i in trip.plans.indices {
                        if let clock = TravelDates.clock(trip.plans[i].time), clock != trip.plans[i].time { trip.plans[i].time = clock }
                    }
                    return trip
                }
                wardrobe = snapshot.wardrobe
                profile = snapshot.profile
                session = snapshot.session
                Fmt.metric = profile.metric
                return
            } catch {
                // Never overwrite data we can't read: keep a copy beside it.
                let stamp = Int(Date.now.timeIntervalSince1970)
                let backup = fileURL.deletingLastPathComponent().appending(path: "tripsloom-unreadable-\(stamp).json")
                do {
                    try FileManager.default.copyItem(at: fileURL, to: backup)
                    recoveryError = "Your saved data could not be read. A recovery copy was kept as \(backup.lastPathComponent). Restore a valid backup or contact support."
                } catch {
                    blockSaving = true
                    recoveryError = "Your saved data could not be read or copied. The original file is being preserved. Export any new plans before closing the app."
                }
            }
        }
        trips = []
        wardrobe = []
        profile = Profile()
        session = .signedOut
        storageError = recoveryError
        savingBlocked = blockSaving
        Fmt.metric = profile.metric
    }

    /// "-<id>" while a UI test runs with its own store, so its sync state
    /// and session don't leak into another test's store. Empty otherwise.
    nonisolated static var testScope: String {
        #if DEBUG
        if let testID = ProcessInfo.processInfo.environment["TRIPSLOOM_UI_TEST_ID"], UUID(uuidString: testID) != nil { return "-\(testID)" }
        #endif
        return ""
    }

    static var defaultURL: URL {
        #if DEBUG
        // UI tests use a unique file and never reset a traveller's real store.
        if let testID = ProcessInfo.processInfo.environment["TRIPSLOOM_UI_TEST_ID"],
           UUID(uuidString: testID) != nil {
            return URL.applicationSupportDirectory.appending(path: "ui-test-\(testID).json")
        }
        #endif
        let dir = URL.applicationSupportDirectory
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "tripsloom.json")
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            self?.saveNow()
        }
    }

    @discardableResult
    func saveNow() -> Bool {
        guard !savingBlocked else { return false }
        let snapshot = Snapshot(trips: trips, wardrobe: wardrobe, profile: profile, session: session)
        do {
            let data = try JSONEncoder.store.encode(snapshot)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
            storageError = nil
            WidgetSync.update(trips: trips, signedOut: session == .signedOut)
            return true
        } catch {
            storageError = "Your latest changes could not be saved on this iPhone. Free up storage and try again, or export your data before closing the app."
            return false
        }
    }

    /// Restores a backup without scheduling deletion of old assets before the
    /// new model has been committed. Failed writes preserve the original model.
    func replaceData(trips nextTrips: [Trip], wardrobe nextWardrobe: [WardrobeItem], profile nextProfile: Profile) -> Bool {
        let oldTrips = trips, oldWardrobe = wardrobe, oldProfile = profile
        replacingData = true
        defer { replacingData = false }
        trips = nextTrips; wardrobe = nextWardrobe; profile = nextProfile
        if saveNow() { return true }
        trips = oldTrips; wardrobe = oldWardrobe; profile = oldProfile
        return false
    }

    // MARK: Queries

    /// Upcoming and running trips first, soonest first, then past trips.
    var allSorted: [Trip] { upcoming + past }

    var upcoming: [Trip] {
        trips.filter { $0.status != .past }.sorted { $0.start < $1.start }
    }

    var past: [Trip] {
        trips.filter { $0.status == .past }.sorted { $0.start > $1.start }
    }

    var nextTrip: Trip? { upcoming.first }

    var openTrip: Trip? { openTripID.flatMap(trip) }

    func trip(_ id: UUID) -> Trip? { trips.first { $0.id == id } }

    func binding(_ id: UUID) -> Binding<Trip>? {
        guard let trip = trip(id) else { return nil }
        return Binding(
            get: { [weak self] in self?.trip(id) ?? trip },
            set: { [weak self] new in self?.update(id) { $0 = new } }
        )
    }

    func wardrobeItem(_ id: UUID) -> WardrobeItem? { wardrobe.first { $0.id == id } }

    // MARK: Mutations

    func update(_ id: UUID, _ change: (inout Trip) -> Void) {
        guard let index = trips.firstIndex(where: { $0.id == id }) else { return }
        change(&trips[index])
    }

    func add(_ trip: Trip) {
        trips.append(trip)
    }

    func delete(_ id: UUID) {
        if openTripID == id { openTripID = nil }
        trips.removeAll { $0.id == id }
    }

    /// Opens a trip's tab bar, optionally on a given tab or straight into
    /// its budget.
    func open(_ id: UUID, tab: TripTab? = nil, budget: Bool = false, from source: String? = nil) {
        pendingTab = tab
        pendingBudget = budget
        openSource = source
        openTripID = id
    }

    func closeTrip() {
        openTripID = nil
    }

    /// Removes the sample trips and the sample clothes no kept trip uses.
    /// Trips and pieces the person made themselves stay.
    func removeSamples() {
        if let open = openTripID, trips.first(where: { $0.id == open })?.isSample == true { openTripID = nil }
        trips.removeAll { $0.isSample == true }
        let used = Set(trips.flatMap { trip in
            trip.capsule + trip.packing.compactMap(\.wardrobeID) + trip.outfits.flatMap(\.items)
        })
        wardrobe.removeAll { $0.isSample == true && !used.contains($0.id) }
        for i in wardrobe.indices where wardrobe[i].isSample == true { wardrobe[i].isSample = nil }
        profile.sampleNoticeDismissed = true
    }

    /// Removes every trip and wardrobe piece, for starting from scratch.
    func clearAll() {
        openTripID = nil
        trips = []
        let files = wardrobe.compactMap(\.imageFile)
        wardrobe = []
        files.forEach { WardrobePhotos.delete($0) }
        profile.sampleNoticeDismissed = true
    }

    /// Signing out of an account removes its trips from this phone; a guest
    /// keeps theirs.
    func signOut() {
        openTripID = nil
        if session == .email || session == .apple {
            AuthClient.shared.signOut()
            sync.didSignOut()
            trips = []
            let files = wardrobe.compactMap(\.imageFile)
            wardrobe = []
            files.forEach { WardrobePhotos.delete($0) }
            profile = Profile()
        }
        session = .signedOut
        Task { await Reminders.removeAllTripReminders() }
    }

    /// Removes a piece from the wardrobe and from every trip that uses it.
    func deleteWardrobeItem(_ id: UUID) {
        guard let item = wardrobe.first(where: { $0.id == id }) else { return }
        for index in trips.indices where trips[index].capsule.contains(id)
            || trips[index].packing.contains(where: { $0.wardrobeID == id })
            || trips[index].outfits.contains(where: { $0.items.contains(id) }) {
            trips[index].capsule.removeAll { $0 == id }
            trips[index].packing.removeAll { $0.wardrobeID == id }
            for o in trips[index].outfits.indices { trips[index].outfits[o].items.removeAll { $0 == id } }
        }
        wardrobe.removeAll { $0.id == id }
        WardrobePhotos.delete(item.imageFile)
    }

    var hasAccount: Bool { session == .email || session == .apple }

    /// With an account, deleting reaches every device and the website.
    var deleteTripMessage: String {
        hasAccount
            ? "Its plans, packing list and budget are removed from your account, here and on tripsloom.com."
            : "Its plans, packing list and budget will be removed from this iPhone."
    }

    /// Called once an account session exists.
    func didSignIn(via method: Session) async {
        session = method
        await sync.didSignIn()
    }

    // MARK: Profile stats

    /// Countries of trips you've been on, from the geocoded place (so
    /// "Kodagu, Karnataka" counts as India, not "Karnataka").
    @MainActor
    var countriesVisited: Int {
        Set(trips.filter { $0.status == .past || $0.status == .active }.compactMap { trip in
            Places.cached(trip.place)?.country
                ?? trip.place.split(separator: ",").last?.trimmingCharacters(in: .whitespaces)
        }).count
    }

    var kmHiked: Int {
        Int(trips.filter { $0.kind.isAdventure && $0.status == .past }.reduce(0) { $0 + $1.totalKm })
    }
}

extension JSONEncoder {
    static var store: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }
}

extension JSONDecoder {
    static var store: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }
}
