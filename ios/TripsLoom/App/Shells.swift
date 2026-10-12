import SwiftUI

/// Global tabs, shown when no trip is open: Trips · Discover · Shared · Profile,
/// plus the separate search circle.
struct GlobalShell: View {
    enum Tab: Hashable { case trips, discover, shared, profile, search }
    @State private var tab: Tab = .trips

    var body: some View {
        TabView(selection: $tab) {
            SwiftUI.Tab("Trips", systemImage: "suitcase", value: Tab.trips) {
                NavigationStack { TripsHomeView() }
            }
            SwiftUI.Tab("Discover", systemImage: "safari", value: Tab.discover) {
                NavigationStack { DiscoverView() }
            }
            SwiftUI.Tab("Shared", systemImage: "person.2", value: Tab.shared) {
                NavigationStack { SharedView() }
            }
            SwiftUI.Tab("Profile", systemImage: "person", value: Tab.profile) {
                NavigationStack { ProfileView() }
            }
            SwiftUI.Tab(value: Tab.search, role: .search) {
                NavigationStack { SearchView(tripID: nil) }
            }
        }
        .tint(.lime)
        .tabBarMinimizeBehavior(.onScrollDown)
    }
}

/// Trip tabs. The set changes with the trip type:
/// city (Trip·Days·Wardrobe·Packing), trek/camp (Trip·Route·Gear·Safety),
/// climb (Trip·Climb·Gear·Safety), beach (Trip·Days·Tides·Packing),
/// road (Trip·Route·Stops·Packing).
struct TripShell: View {
    let tripID: UUID
    @Environment(TripStore.self) private var store
    @State private var tab: Tab = .section(.trip)
    @State private var selectAction = SelectTripTabAction()

    enum Tab: Hashable { case section(TripTab), search }

    var body: some View {
        if let trip = store.binding(tripID) {
            TabView(selection: $tab) {
                ForEach(trip.wrappedValue.kind.tabs, id: \.self) { section in
                    SwiftUI.Tab(section.title, systemImage: section.symbol, value: Tab.section(section)) {
                        NavigationStack { screen(section, trip: trip) }
                    }
                }
                SwiftUI.Tab(value: Tab.search, role: .search) {
                    NavigationStack { SearchView(tripID: tripID) }
                }
            }
            .tint(.lime)
            .tripCover(trip.wrappedValue)
            .tabBarMinimizeBehavior(.onScrollDown)
            .environment(\.selectTripTab, selectAction)
            // Forecasts for every screen of the trip; re-checked when the
            // dates or stays change.
            .task(id: "\(trip.wrappedValue.start)|\(trip.wrappedValue.plans.filter { $0.category == .stay }.map(\.meta))") {
                WeatherService.shared.prefetch(trip.wrappedValue)
            }
            .onAppear {
                selectAction = SelectTripTabAction(run: { section in
                    withAnimation(Motion.snappy) { tab = .section(section) }
                })
                if let pending = store.pendingTab, trip.wrappedValue.kind.tabs.contains(pending) {
                    tab = .section(pending)
                }
                store.pendingTab = nil
            }
        }
    }

    @ViewBuilder
    private func screen(_ section: TripTab, trip: Binding<Trip>) -> some View {
        switch section {
        case .trip:
            if trip.wrappedValue.kind.isAdventure {
                AdventureTripView(trip: trip)
            } else {
                TripOverviewView(trip: trip)
            }
        case .days: DaysView(trip: trip)
        case .wardrobe: WardrobeView(trip: trip)
        case .packing: PackingView(trip: trip)
        case .route: RouteView(trip: trip)
        case .gear: GearView(trip: trip)
        case .safety: SafetyView(trip: trip)
        case .climb: ClimbView(trip: trip)
        case .tides: TidesView(trip: trip)
        case .stops: StopsView(trip: trip)
        }
    }
}

/// Lets a screen jump to another tab of the open trip.
struct SelectTripTabAction: Equatable {
    fileprivate var id = UUID()
    fileprivate var run: (TripTab) -> Void = { _ in }

    func callAsFunction(_ tab: TripTab) { run(tab) }

    static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id }
}

extension EnvironmentValues {
    @Entry var selectTripTab = SelectTripTabAction()
}

/// Glass round toolbar buttons are native in iOS 26; this keeps the lime
/// "primary" circle consistent.
struct LimeToolbarButton: View {
    var symbol: String
    var label: String
    var action: () -> Void
    @State private var taps = 0

    var body: some View {
        Button {
            taps += 1
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Color.ink)
                .symbolEffect(.bounce, value: taps)
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: taps)
        .buttonStyle(.glassProminent)
        .tint(.lime)
        .accessibilityLabel(label)
    }
}

/// Back to the global tabs from inside a trip.
struct CloseTripButton: View {
    @Environment(TripStore.self) private var store
    var body: some View {
        Button { store.closeTrip() } label: {
            Image(systemName: "chevron.left")
        }
        .accessibilityLabel("All trips")
    }
}
