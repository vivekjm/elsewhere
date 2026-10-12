import SwiftUI
import UserNotifications

@main
struct TripsLoomApp: App {
    @State private var store = TripStore()
    @State private var router = AppRouter()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        URLCache.shared = URLCache(memoryCapacity: 40 * 1024 * 1024, diskCapacity: 300 * 1024 * 1024)
        UNUserNotificationCenter.current().delegate = NotificationPresenter.shared
        #if DEBUG
        SyncSelfTest.runIfRequested()
        #endif
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(router)
                .preferredColorScheme(.dark)
                .tint(.white)
                .onAppear {
                    store.sync.attach(store)
                    Entitlements.start(store)
                }
                .task(id: store.trips.map { "\($0.id)-\($0.dayKey(0))-\($0.dayCount)-\($0.adventure?.nextCheckIn ?? "")-\($0.adventure?.checkInReminders ?? false)" }.joined() + "\(store.profile.reminders)-\(store.session)") {
                    await Reminders.reconcile(enabled: store.profile.reminders, trips: store.session == .signedOut ? [] : store.trips)
                }
                .onOpenURL { url in
                    // Trip invites arrive as a link or a .tripsloom file.
                    if let invite = url.isFileURL ? TripInvite.from(file: url) : TripInvite.from(link: url) {
                        // A trip on screen would hide the sheet: close it first.
                        if store.openTripID != nil {
                            store.closeTrip()
                            Task {
                                try? await Task.sleep(for: .milliseconds(600))
                                router.joining = invite
                            }
                        } else {
                            router.joining = invite
                        }
                    } else if url.isFileURL || url.host() == "join" {
                        router.authMessage = "This trip link couldn't be read. Ask for it to be shared again."
                    } else {
                        Task { await router.handleAuthLink(url, store: store) }
                    }
                }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await store.sync.sync() }
                Task { await Entitlements.refresh(store) }
                Task { await LiveActivities.refresh(trips: store.trips) }
            } else {
                store.saveNow()
                // The "starts tomorrow" note says how much is left to pack.
                if phase == .background {
                    Task { await Reminders.reconcile(enabled: store.profile.reminders, trips: store.session == .signedOut ? [] : store.trips) }
                }
            }
        }
    }
}

/// App-wide modals, so any screen can start them.
@Observable
final class AppRouter {
    var newTrip = false
    var planner: PlannerRequest?
    var paywall = false
    var importTripID: UUID?
    /// A trip invite that was just opened.
    var joining: TripInvite?
    /// The view a modal zooms out of, if any.
    var zoomSource: String?
    /// Set when a password-reset email link opens the app.
    var resettingPassword = false
    var authMessage: String?

    func handleAuthLink(_ url: URL, store: TripStore) async {
        do {
            guard let type = try await AuthClient.shared.handle(url: url) else { return }
            // Also after an expired session, so the sync picks up again (or
            // switches cleanly if this is a different account).
            await store.didSignIn(via: store.session.isAccount ? store.session : .email)
            if type == "recovery" { resettingPassword = true } else { authMessage = "Your email is confirmed. You're signed in." }
        } catch {
            authMessage = error.localizedDescription
        }
    }

    func plan(_ prompt: String = "", from source: String? = nil) {
        zoomSource = source
        planner = PlannerRequest(prompt: prompt, source: source)
    }

    func startNewTrip(from source: String? = nil) {
        zoomSource = source
        newTrip = true
    }

    func showPaywall(from source: String? = nil) {
        zoomSource = source
        paywall = true
    }
}

struct PlannerRequest: Identifiable {
    let id = UUID()
    var prompt: String
    var source: String?
}

struct RootView: View {
    @Environment(TripStore.self) private var store
    @Environment(AppRouter.self) private var router
    /// Rebuilds the tree when the text size changes, since fonts are sized
    /// when views are built.
    @Environment(\.dynamicTypeSize) private var typeSize
    @Namespace private var zoom

    var body: some View {
        ZStack {
            Color.night.ignoresSafeArea()
            if store.session == .signedOut {
                SignInView()
                    .transition(.opacity)
            } else {
                GlobalShell()
            }
        }
        .environment(\.zoomNamespace, zoom)
        .safeAreaInset(edge: .top) {
            if let error = store.storageError {
                VStack(alignment: .leading, spacing: 8) {
                    Text(error).font(.callout)
                    Button("Retry saving") { store.saveNow() }.frame(minHeight: 44)
                }
                .padding().frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.red.opacity(0.25))
                .accessibilityElement(children: .contain)
            }
        }
        // Trips zoom out of the card that opened them and pull down to close.
        .fullScreenCover(item: Binding(
            get: { store.openTripID.flatMap { store.trip($0) != nil ? IdentifiedID(id: $0) : nil } },
            set: { if $0 == nil { store.openTripID = nil } }
        )) { item in
            TripShell(tripID: item.id)
                .environment(store)
                .environment(router)
                .environment(\.zoomNamespace, zoom)
                .zoomTransition(store.openSource ?? "trip-\(item.id)", in: zoom)
        }
        .id(typeSize)
        .animation(Motion.snappy, value: store.session)
        .fullScreenCover(isPresented: Bindable(router).newTrip) {
            NewTripFlow().zoomTransition(router.zoomSource, in: zoom)
        }
        .fullScreenCover(item: Bindable(router).planner) { request in
            PlannerFlow(initialPrompt: request.prompt).zoomTransition(request.source, in: zoom)
        }
        .fullScreenCover(isPresented: Bindable(router).paywall) {
            PaywallView().zoomTransition(router.zoomSource, in: zoom)
        }
        .sheet(item: Binding(
            get: { router.importTripID.map(IdentifiedID.init) },
            set: { router.importTripID = $0?.id }
        )) { item in ImportBookingsView(tripID: item.id) }
        .sheet(isPresented: Bindable(router).resettingPassword) { NewPasswordSheet() }
        .fullScreenCover(isPresented: Binding(get: { store.session != .signedOut && store.profile.onboardingCompleted != true && store.trips.isEmpty && !router.newTrip && router.planner == nil }, set: { if !$0 { store.profile.onboardingCompleted = true } })) { OnboardingView() }
        .sheet(item: Bindable(router).joining) { invite in JoinTripSheet(invite: invite) }
        .alert("Trips Loom", isPresented: Binding(get: { router.authMessage != nil }, set: { if !$0 { router.authMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(router.authMessage ?? "")
        }
    }
}

struct IdentifiedID: Identifiable {
    let id: UUID
}

/// Shows check-in and trip reminders as banners even while the app is open.
final class NotificationPresenter: NSObject, UNUserNotificationCenterDelegate, Sendable {
    static let shared = NotificationPresenter()

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}
