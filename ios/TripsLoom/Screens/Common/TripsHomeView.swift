import SwiftUI

/// C2. Home with the global tabs. The next trip is a photo card with a
/// readiness ring, and trips of every type sit side by side.
struct TripsHomeView: View {
    @Environment(TripStore.self) private var store
    @Environment(AppRouter.self) private var router
    @State private var segment: Segment = .upcoming
    @State private var pendingDelete: Trip?
    @State private var confirmClear = false
    @Environment(\.zoomNamespace) private var zoomNamespace
    @Environment(\.dynamicTypeSize) private var textSize

    enum Segment: Hashable { case upcoming, past }

    private var headerLayout: AnyLayout {
        textSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12)) : AnyLayout(HStackLayout(alignment: .bottom, spacing: 12))
    }
    private var cardsLayout: AnyLayout {
        textSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 12)) : AnyLayout(HStackLayout(spacing: 12))
    }
    private var actionsLayout: AnyLayout {
        textSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 10)) : AnyLayout(HStackLayout(spacing: 10))
    }

    var body: some View {
        NightScreen(photo: store.nextTrip?.photo ?? .lisbon, title: "Trips") {
            headerLayout {
                Text("Trips").displayTitle(40)
                    .fixedSize(horizontal: false, vertical: true)
                if textSize.isAccessibilitySize {
                    Picker("Trips to show", selection: $segment) {
                        Text("Upcoming").tag(Segment.upcoming)
                        Text("Past").tag(Segment.past)
                    }
                    .pickerStyle(.menu)
                    .tint(.white)
                    .frame(minHeight: 44)
                } else {
                    Spacer()
                    PillSegmented(options: [(.upcoming, "Upcoming"), (.past, "Past")], selection: $segment, height: 36)
                        .frame(width: 180)
                }
            }
            .padding(.horizontal, 4)
            .padding(.top, 6)

            if store.profile.sampleNoticeDismissed != true, store.trips.contains(where: { $0.isSample == true }) {
                sampleNotice
                    .transition(.asymmetric(insertion: .opacity, removal: .scale(scale: 0.9, anchor: .top).combined(with: .opacity)))
            }

            Group {
                switch segment {
                case .upcoming: upcoming
                case .past: past
                }
            }
            .transition(.asymmetric(
                insertion: .move(edge: segment == .past ? .trailing : .leading).combined(with: .opacity),
                removal: .opacity
            ))
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Plan with AI", systemImage: "sparkles") { router.plan() }
                    Button("New trip", systemImage: "plus") { router.startNewTrip() }
                } label: {
                    Group {
                        if textSize.isAccessibilitySize {
                            Image(systemName: "plus").font(.system(size: 20, weight: .semibold))
                                .frame(minWidth: 44, minHeight: 44)
                        } else {
                            HStack(spacing: 8) {
                                Text(store.profile.badge)
                                    .font(.sf(13, .bold))
                                    .frame(width: 36, height: 36)
                                    .background(Circle().fill(Color.white.opacity(0.18)))
                                Text("\(store.upcoming.count) \(store.upcoming.count == 1 ? "trip" : "trips")")
                                    .font(.mono(13, .semibold))
                            }
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(.leading, -6)
                    .padding(.trailing, 4)
                }
                .accessibilityLabel("\(store.upcoming.count) upcoming trips, add a trip")
            }
        }
        .confirmationDialog(
            "Delete \(pendingDelete?.name ?? "trip")?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete trip", role: .destructive) {
                if let id = pendingDelete?.id { withAnimation { store.delete(id) } }
            }
        } message: {
            Text(store.deleteTripMessage)
        }
        .confirmationDialog("Start fresh?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Delete the sample trips", role: .destructive) { withAnimation { store.removeSamples() } }
        } message: {
            Text(store.trips.contains { $0.isSample != true }
                 ? "The sample trips and sample clothes are removed. Trips you made stay."
                 : "The sample trips and wardrobe are removed. You can restore them from Profile.")
        }
        .navigationDestination(for: RecapRoute.self) { route in
            if let trip = store.binding(route.id) {
                RecapView(trip: trip).zoomTransition("recap-\(route.id)", in: zoomNamespace)
            }
        }
    }

    private var sampleNotice: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("These are sample trips").font(.sf(17, .semibold)).foregroundStyle(.white)
                Text("Look around every trip type, then keep them or start with your own.")
                    .font(.sf(14))
                    .foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 10) {
                Button("Keep them") { withAnimation { store.profile.sampleNoticeDismissed = true } }
                    .buttonStyle(GlassPillStyle(height: 40))
                Button("Start fresh") { confirmClear = true }
                    .buttonStyle(LimePillStyle(height: 40))
            }
        }
        .glassCard()
    }

    // MARK: Upcoming

    @ViewBuilder
    private var upcoming: some View {
        if let next = store.nextTrip {
            Button { store.open(next.id, from: "home-\(next.id)") } label: {
                FeaturedTripCard(trip: next)
            }
            .buttonStyle(.card)
            .accessibilityLabel("Open \(next.name), \(next.dateRange), \(next.place)")
            .accessibilityIdentifier("trip-card-\(next.id)")
            .zoomSource("home-\(next.id)")
            .contextMenu { tripMenu(next) }

            cardsLayout {
                StatCard(title: "Trip days") {
                    Chip("\(store.upcoming.count) \(store.upcoming.count == 1 ? "trip" : "trips")", tone: .tint(.lime))
                        .padding(.top, 8)
                    MonoAmount(whole: "\(store.upcoming.reduce(0) { $0 + $1.dayCount })", fraction: " days", size: 30)
                        .padding(.top, 6)
                }
                .zoomSource("days-\(next.id)", radius: 28)
                .onTapGesture { store.open(next.id, tab: next.kind.tabs[1], from: "days-\(next.id)") }
                .accessibilityAddTraits(.isButton)

                StatCard(title: next.budgetLimit > 0 ? (next.totalPlanned > next.budgetLimit ? "Over budget" : "Budget left") : "Planned") {
                    let left = next.budgetLimit - next.totalPlanned
                    let money = Fmt.money(next.budgetLimit > 0 ? abs(left) : next.totalPlanned, next.currency)
                    MonoAmount(whole: money.whole, fraction: money.fraction, size: 30)
                        .padding(.top, 14)
                    if next.budgetLimit > 0 {
                        ProgressBar(value: next.totalPlanned / next.budgetLimit, color: left < 0 ? .coral : .lime)
                            .padding(.top, 10)
                    } else {
                        Text("No budget set").metaStyle(11)
                            .padding(.top, 6)
                    }
                }
                .zoomSource("budget-\(next.id)", radius: 28)
                .onTapGesture { store.open(next.id, budget: true, from: "budget-\(next.id)") }
                .accessibilityAddTraits(.isButton)
            }
            .modifier(RuledSection())

            GlassList("Up next") {
                Menu {
                    Button("Plan with AI", systemImage: "sparkles") { router.plan() }
                    Button("New trip", systemImage: "plus") { router.startNewTrip() }
                } label: {
                    OutlinePlusLabel(text: "New")
                }
                .buttonStyle(OutlinePillStyle())
            } content: {
                let rest = store.upcoming.dropFirst()
                if rest.isEmpty {
                    Text("Nothing else planned yet.")
                        .font(.sf(15))
                        .foregroundStyle(Color.textMuted)
                        .padding(.vertical, 14)
                }
                ForEach(Array(rest)) { trip in
                    Button { store.open(trip.id, from: "row-\(trip.id)") } label: {
                        TripRow(trip: trip, zoomID: "row-\(trip.id)")
                    }
                    .buttonStyle(.card)
                    .contextMenu { tripMenu(trip) }
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .scale(scale: 0.9).combined(with: .opacity)))
                }
            }
        } else {
            EmptyNote(title: "Your first trip starts here.", message: "Add one you've booked, or describe one and let the planner draft the days, stays and packing.")
            actionsLayout {
                Button("Plan with AI") { router.plan(from: "plan-ai") }.buttonStyle(CTAStyle(kind: .glass)).zoomSource("plan-ai", radius: 12)
                Button("New trip") { router.startNewTrip(from: "new-trip") }.buttonStyle(CTAStyle()).zoomSource("new-trip", radius: 12)
            }
        }
    }

    // MARK: Past

    @ViewBuilder
    private var past: some View {
        if store.past.isEmpty {
            EmptyNote(title: "No past trips", message: "When a trip ends, its recap appears here.")
        } else {
            GlassList {
                ForEach(store.past) { trip in
                    NavigationLink(value: RecapRoute(id: trip.id)) {
                        TripRow(trip: trip, showRecap: true, zoomID: "recap-\(trip.id)")
                    }
                    .buttonStyle(.card)
                    .contextMenu { tripMenu(trip) }
                }
            }
        }
    }

    @ViewBuilder
    private func tripMenu(_ trip: Trip) -> some View {
        Button("Open", systemImage: "arrow.up.right") { store.open(trip.id) }
        Button("Add bookings", systemImage: "tray.and.arrow.down") { router.importTripID = trip.id }
        Button("Delete", systemImage: "trash", role: .destructive) { pendingDelete = trip }
    }
}

struct RecapRoute: Hashable { var id: UUID }

/// The next trip as a 220pt photo card.
struct FeaturedTripCard: View {
    var trip: Trip
    var height: CGFloat = 220
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // The photograph stands alone; the words sit beneath it like a caption.
        VStack(alignment: .leading, spacing: 12) {
            Color.photoPlaceholder
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .overlay { RemotePhoto(photo: trip.photo, width: 900).scaleEffect(1.25).parallax().tripCover(trip) }
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: Radius.media, style: .continuous))
                .overlay(alignment: .topLeading) { Chip(trip.countdownLabel, tone: .onPhoto(.lime)).padding(12) }
            // At accessibility sizes the ring drops below so the name gets the full width.
            (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10)) : AnyLayout(HStackLayout(alignment: .top, spacing: 12))) {
                VStack(alignment: .leading, spacing: 4) {
                    Group {
                        if typeSize.isAccessibilitySize {
                            WordFittingTitle(text: trip.name, size: 24).lineLimit(4)
                        } else {
                            Text(trip.name).font(.display(28)).lineLimit(2)
                        }
                    }
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(trip.dateRange) · \(trip.kind.label) · \(trip.kind.isAdventure ? Fmt.count(trip.stages.count, "stage") : Fmt.count(trip.plans.count, "plan"))")
                        .metaStyle()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)
                ProgressRing(progress: trip.readiness, size: 44, text: "\(Int(trip.readiness * 100))%", fontSize: 11)
                    .accessibilityLabel("\(Int(trip.readiness * 100)) percent ready")
            }
            .padding(.horizontal, 2)
        }
        .contentShape(Rectangle())
    }
}

struct StatCard<Content: View>: View {
    var title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(title).eyebrow()
                Spacer()
                CornerArrow().accessibilityHidden(true)
            }
            content
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        // One element: "Planned, $0.00, No budget set".
        .accessibilityElement(children: .combine)
    }
}

struct TripRow: View {
    var trip: Trip
    var showRecap = false
    var zoomID: String? = nil

    var body: some View {
        ListRow(trip.name, meta: meta) {
            if let zoomID {
                PhotoThumb(photo: trip.photo).tripCover(trip).zoomSource(zoomID, radius: 14)
            } else {
                PhotoThumb(photo: trip.photo).tripCover(trip)
            }
        } trailing: {
            if showRecap {
                Chip("Recap", tone: .tint(.lime))
            } else {
                Chip(trip.kind.label, tone: .tint(trip.kind.chipColor))
            }
        }
    }

    private var meta: String {
        let who = trip.travellers > 1 ? "\(trip.travellers) people" : "\(trip.dayCount) days"
        return "\(trip.dateRange) · \(who)"
    }
}
