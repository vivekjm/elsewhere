import SwiftUI

/// A1. The first tab in trek, camp and climb mode: the elevation profile with
/// the altitude-sickness line, today's stage, and what to prepare.
struct AdventureTripView: View {
    @Binding var trip: Trip
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var actions = TripActions()
    @Environment(\.selectTripTab) private var selectTab
    @Environment(TripStore.self) private var store
    @State private var showBudget = false
    @State private var chartMode: ElevationChart.Mode = .stages

    var body: some View {
        let headline = WeatherService.shared.headline(trip)
        NightScreen(photo: trip.photo, hero: 360, heroContentTop: 108, title: trip.name,
                    subtitle: headline.map { "\($0.day.high)° · \($0.day.summary)" } ?? trip.dateRange,
                    sky: headline?.day) {
            HeroHeader(chip: "\(trip.kind.label) · \(trip.countdownLabel)", chipColor: trip.kind.chipColor, title: trip.name, titleSize: 34, meta: summaryLine) {
                if let headline {
                    HeroWeatherBadge(day: headline.day, when: TripOverviewView.when(trip, headline.index, headline.day))
                }
            }

            if trip.stages.count >= 2, trip.stages.contains(where: { $0.altitude > 0 }) {
                VStack(alignment: .leading, spacing: 10) {
                    // Stacked at accessibility sizes so the title and switch both fit.
                    (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout())) {
                        Text(chartMode == .stages ? "Elevation" : "Distance").font(.sf(17, .semibold)).foregroundStyle(.white)
                        Spacer(minLength: 0)
                        PillSegmented(options: [(.stages, "Stages"), (.daily, "Daily")], selection: $chartMode, height: 32)
                            .frame(width: typeSize.isAccessibilitySize ? nil : 150)
                    }
                    ElevationChart(stages: trip.stages, current: trip.currentStageIndex, mode: chartMode, started: trip.status != .upcoming)
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 10)
                .glass(28)
            }

            if trip.stages.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Add your route").font(.sf(17, .semibold)).foregroundStyle(.white)
                        Text("Each day's distance, climb and sleeping altitude builds the elevation profile and the altitude warnings.")
                            .font(.sf(14))
                            .foregroundStyle(Color.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Button("Add stages") { openRoute() }
                        .buttonStyle(LimePillStyle(height: 40))
                }
                .glassCard()
            } else {
                GlassList {
                    ForEach(upcomingStages) { stage in
                        Button { openRoute() } label: {
                            StageRow(stage: stage, isCurrent: stage.id == trip.stages[trip.currentStageIndex].id, isActive: trip.status == .active)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            GlassList("Prepare") {
                if trip.kind == .climb {
                    NavigationLink(value: AdventureRoute.route) {
                        ListRow("Approach and route", meta: "\(Fmt.count(trip.stages.count, "stage")) · \(Fmt.distance(trip.totalKm))") {
                            IconTile(symbol: "point.topleft.down.to.point.bottomright.curvepath", color: Tile.teal)
                        } trailing: { CornerArrow() }
                    }
                }
                NavigationLink(value: AdventureRoute.beforeYouGo) {
                    ListRow("Before you go", meta: "Permits · guide · insurance") {
                        IconTile(symbol: "doc.text.fill", color: Tile.green)
                    } trailing: {
                        let pending = trip.adventure?.permits.filter { !$0.paid }.count ?? 0
                        if pending > 0 { Chip("\(pending) pending", tone: .tint(.apricot)) } else { CornerArrow() }
                    }
                }
                DocumentsRow(trip: trip)
                NavigationLink(value: AdventureRoute.training) {
                    ListRow("Training", meta: trip.status == .upcoming ? "Starts in \(trip.daysUntil) days" : "Readiness") {
                        IconTile(symbol: "figure.hiking", color: Tile.indigo)
                    } trailing: {
                        if let score = trip.adventure?.readiness?.score {
                            Text("\(score)").font(.mono(16, .semibold)).foregroundStyle(Color.lime)
                        } else {
                            CornerArrow()
                        }
                    }
                }
                NavigationLink(value: BudgetRoute()) {
                    ListRow("Budget", meta: trip.budgetLimit > 0 ? "\(Fmt.moneyShort(trip.totalPlanned, trip.currency)) of \(Fmt.moneyShort(trip.budgetLimit, trip.currency))" : "\(Fmt.moneyShort(trip.totalPlanned, trip.currency)) planned · no limit") {
                        IconTile(symbol: "creditcard.fill", color: Tile.amber)
                    } trailing: { CornerArrow() }
                }
            }
            .buttonStyle(.plain)
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { CloseTripButton() }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { selectTab(.safety) } label: { Image(systemName: "map") }
                    .accessibilityLabel("Offline map and safety")
                TripActionsMenu(trip: $trip, actions: actions)
            }
        }
        .tripActions(trip: $trip, actions)
        .navigationDestination(for: AdventureRoute.self) { route in
            switch route {
            case .beforeYouGo: BeforeYouGoView(trip: $trip)
            case .training: TrainingView(trip: $trip)
            case .checkIn: AltitudeCheckInView(trip: $trip)
            case .route: RouteView(trip: $trip).toolbar(.hidden, for: .tabBar)
            }
        }
        .navigationDestination(for: BudgetRoute.self) { _ in BudgetView(trip: $trip) }
        .navigationDestination(for: DocumentsRoute.self) { _ in DocumentsView(trip: $trip) }
        .navigationDestination(isPresented: $showBudget) { BudgetView(trip: $trip) }
        .navigationDestination(isPresented: $routePushed) { RouteView(trip: $trip).toolbar(.hidden, for: .tabBar) }
        .onAppear {
            if store.pendingBudget {
                store.pendingBudget = false
                showBudget = true
            }
        }
    }

    private var summaryLine: String {
        guard trip.totalKm > 0 else { return "\(trip.dateRange) · \(trip.place)" }
        var parts = [Fmt.distance(trip.totalKm)]
        if trip.totalAscent > 0 { parts.append("↑ \(Fmt.grouped(trip.totalAscent)) m") }
        if trip.maxAltitude > 0 { parts.append("max \(Fmt.grouped(trip.maxAltitude)) m") }
        return parts.joined(separator: " · ")
    }

    @State private var routePushed = false

    private func openRoute() {
        if trip.kind.tabs.contains(.route) {
            selectTab(.route)
        } else {
            routePushed = true
        }
    }

    private var upcomingStages: [Stage] {
        let start = trip.currentStageIndex
        return Array(trip.stages[start..<min(start + 2, trip.stages.count)])
    }
}

enum AdventureRoute: Hashable { case beforeYouGo, training, checkIn, route }

struct StageRow: View {
    var stage: Stage
    var isCurrent: Bool
    var isActive: Bool
    var done = false

    var body: some View {
        ListRow(stage.title, meta: stage.displayMeta) {
            Text("D\(stage.day)")
                .font(.mono(13, .bold))
                .foregroundStyle(isCurrent ? Color.lime : Color.textMuted)
                .lineLimit(1).fixedSize().frame(minWidth: 36, alignment: .leading)
        } trailing: {
            if isCurrent {
                Chip(isActive ? "Today" : "First", tone: .solid)
            } else if done {
                CheckCircle(isOn: true, size: 24)
            } else {
                CornerArrow()
            }
        }
    }
}

/// Trek, camp and road: every stage with the profile on top. Stages can be
/// added, edited and removed here.
struct RouteView: View {
    @Binding var trip: Trip
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var mode: ElevationChart.Mode
    @State private var editing: StageEditorRoute?

    init(trip: Binding<Trip>) {
        _trip = trip
        _mode = State(initialValue: trip.wrappedValue.kind == .road ? .daily : .stages)
    }

    private var hasAltitude: Bool { trip.stages.contains { $0.altitude > 0 } && trip.kind != .road }

    var body: some View {
        NightScreen(photo: trip.photo, spacing: 12, title: "Route") {
            ScreenHeader(title: "Route", meta: "\(Fmt.count(trip.stages.count, "stage")) · \(Fmt.distance(trip.totalKm))\(trip.totalAscent > 0 ? " · ↑ \(Fmt.grouped(trip.totalAscent)) m" : "")")

            if trip.stages.count >= 2, trip.stages.contains(where: { $0.km > 0 || $0.altitude > 0 }) {
                VStack(alignment: .leading, spacing: 10) {
                    // Stacked at accessibility sizes so the title and switch both fit.
                    (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout())) {
                        Text(hasAltitude && mode == .stages ? "Elevation" : "Distance").font(.sf(17, .semibold)).foregroundStyle(.white)
                        Spacer(minLength: 0)
                        if hasAltitude {
                            PillSegmented(options: [(.stages, "Stages"), (.daily, "Daily")], selection: $mode, height: 32)
                                .frame(width: typeSize.isAccessibilitySize ? nil : 150)
                        }
                    }
                    ElevationChart(stages: trip.stages, current: trip.currentStageIndex, mode: hasAltitude ? mode : .daily, started: trip.status != .upcoming)
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 10)
                .glass(28)
            }

            if trip.stages.isEmpty {
                EmptyNote(title: "No stages yet", message: trip.kind == .road ? "Add each day's drive with the plus button." : "Add each day's walk, with its distance, climb and where you sleep.")
                Button("Add the first stage") { editing = StageEditorRoute(stageID: nil) }
                    .buttonStyle(CTAStyle(kind: .glass))
            } else {
                GlassList {
                    ForEach(Array(trip.stages.enumerated()), id: \.element.id) { index, stage in
                        Button { editing = StageEditorRoute(stageID: stage.id) } label: {
                            StageRow(
                                stage: stage,
                                isCurrent: index == trip.currentStageIndex && trip.status != .past,
                                isActive: trip.status == .active,
                                done: trip.status == .past || index < trip.currentStageIndex
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Edit stage")
                    }
                }
            }

            if trip.kind == .road, let url = mapsURL {
                Link(destination: url) {
                    Label("Open route in Maps", systemImage: "map")
                }
                .buttonStyle(GlassPillStyle())
                .padding(.horizontal, 4)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                LimeToolbarButton(symbol: "plus", label: "Add stage") { editing = StageEditorRoute(stageID: nil) }
            }
        }
        .sheet(item: $editing) { route in StageEditor(trip: $trip, stageID: route.stageID) }
    }

    private var mapsURL: URL? {
        let places = trip.stages.flatMap { $0.title.components(separatedBy: "→") }.map { $0.trimmingCharacters(in: .whitespaces) }
        var unique: [String] = []
        for place in places where unique.last != place { unique.append(place) }
        guard unique.count >= 2 else { return nil }
        let daddr = unique.dropFirst().joined(separator: " to:")
        var components = URLComponents(string: "maps://")
        components?.queryItems = [URLQueryItem(name: "saddr", value: unique[0]), URLQueryItem(name: "daddr", value: daddr)]
        return components?.url
    }
}

struct StageEditorRoute: Identifiable {
    let id = UUID()
    var stageID: UUID?
}

/// Add or edit one day of the route.
struct StageEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    var stageID: UUID?
    @Environment(\.dismiss) private var dismiss
    @State private var stage: Stage

    init(trip: Binding<Trip>, stageID: UUID?) {
        _trip = trip
        self.stageID = stageID
        let t = trip.wrappedValue
        let existing = stageID.flatMap { id in t.stages.first { $0.id == id } }
        let nextDay = min((t.stages.map(\.day).max() ?? 0) + 1, max(t.dayCount, 1))
        _stage = State(initialValue: existing ?? Stage(day: nextDay, title: "", meta: "", km: 0, ascent: 0, altitude: t.stages.last?.altitude ?? 0))
    }

    private var isRoad: Bool { trip.kind == .road }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(isRoad ? "From → To" : "From → To, or a rest day", text: $stage.title)
                    .focused($firstFieldFocused)
                    Stepper("Day \(stage.day)", value: $stage.day, in: 1...max(trip.dayCount, 1))
                }
                Section {
                    NumberRow("Distance (\(Fmt.distanceUnit))", value: $stage.km.inDistanceUnits)
                    if !isRoad {
                        NumberRow("Climb (m)", value: $stage.ascent)
                        NumberRow("Sleep altitude (m)", value: $stage.altitude)
                    }
                    TextField("Time, e.g. 5–6 h", text: $stage.hours)
                }
                if stageID != nil {
                    Section {
                        Button("Delete stage", role: .destructive) {
                            trip.stages.removeAll { $0.id == stageID }
                            dismiss()
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(stageID == nil ? "New stage" : "Edit stage")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(stage.title.trimmingCharacters(in: .whitespaces).isEmpty || stage.title.count > 200 || !stage.km.isFinite || !(0...10_000).contains(stage.km) || !(0...100_000).contains(stage.ascent) || !(-500...10_000).contains(stage.altitude))
                }
            }
        }
        .autofocus($firstFieldFocused, when: stageID == nil)
        .presentationBackground { SheetGlass(photo: trip.photo) }
    }

    private func save() {
        // Built from the numbers when shown, so it follows the units setting.
        stage.meta = ""
        if let i = trip.stages.firstIndex(where: { $0.id == stage.id }) {
            trip.stages[i] = stage
        } else {
            trip.stages.append(stage)
        }
        trip.stages.sort { $0.day < $1.day }
        dismiss()
    }
}
