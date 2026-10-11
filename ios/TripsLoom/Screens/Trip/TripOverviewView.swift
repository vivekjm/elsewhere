import SwiftUI

/// L1. The first tab for city, beach and road trips: readiness rings, then
/// today's bookings. Itinerary and Budget are one tap away.
struct TripOverviewView: View {
    @Binding var trip: Trip
    @State private var actions = TripActions()
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.selectTripTab) private var selectTab
    @Environment(TripStore.self) private var store
    @State private var showBudget = false
    @Environment(\.openURL) private var openURL
    @State private var segment: Segment = .overview
    /// The section on screen. Follows `segment` without animation, so the pill
    /// slides while the sections swap instantly.
    @State private var shown: Segment = .overview
    @State private var ticketPlan: IdentifiedID?
    @State private var addingPlanDay: IdentifiedDay?
    @State private var inviting = false

    struct IdentifiedDay: Identifiable { let id: Int }

    enum Segment: Hashable { case overview, itinerary, budget }

    var body: some View {
        let headline = WeatherService.shared.headline(trip)
        NightScreen(photo: trip.photo, top: 0.45, bottom: 0.8, hero: 380, heroContentTop: 132, title: trip.name,
                    subtitle: headline.map { "\($0.day.high)° · \($0.day.summary)" } ?? trip.dateRange,
                    sky: headline?.day, pinned: AnyView(tabs), pinnedKey: shown) {
            HeroHeader(chip: trip.countdownLabel, chipColor: .lime, title: trip.name, titleSize: 36, meta: "\(trip.dateRange) · \(trip.place)") {
                if let headline {
                    HeroWeatherBadge(day: headline.day, when: TripOverviewView.when(trip, headline.index, headline.day))
                }
            }

            tabs

            // Sections swap without a crossfade: the old one goes at once and
            // the new one fades in where it will stay, so the two never overlap.
            VStack(alignment: .leading, spacing: 14) {
                switch shown {
                case .overview: overview
                case .itinerary: itinerary
                case .budget: budget
                }
            }
            .modifier(FadeInOnAppear())
            .id(shown)
        }
        .onChange(of: segment) { _, new in
            var instant = Transaction()
            instant.disablesAnimations = true
            withTransaction(instant) { shown = new }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { CloseTripButton() }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Menu {
                    Button("Invite people", systemImage: "person.badge.plus") { inviting = true }
                    ShareLink(item: shareText) { Label("Share as text", systemImage: "text.alignleft") }
                } label: { Image(systemName: "square.and.arrow.up") }
                    .accessibilityLabel("Share trip")
                TripActionsMenu(trip: $trip, actions: actions)
            }
        }
        .tripActions(trip: $trip, actions)
        .navigationDestination(for: BudgetRoute.self) { _ in BudgetView(trip: $trip) }
        .navigationDestination(for: DocumentsRoute.self) { _ in DocumentsView(trip: $trip) }
        .navigationDestination(isPresented: $showBudget) { BudgetView(trip: $trip) }
        .onAppear {
            if store.pendingBudget {
                store.pendingBudget = false
                showBudget = true
            }
        }
        .sheet(item: $addingPlanDay) { route in PlanEditor(trip: $trip, planID: nil, defaultDay: route.id) }
        .sheet(item: $ticketPlan) { item in TicketSheet(trip: $trip, planID: item.id) }
        .sheet(isPresented: $inviting) { InviteShareSheet(trip: trip) }
    }

    private var tabs: some View {
        PillSegmented(options: [(.overview, "Overview"), (.itinerary, "Itinerary"), (.budget, "Budget")], selection: $segment)
    }

    /// "Today · Gangtok" or "Wed 30 · Gangtok".
    static func when(_ trip: Trip, _ index: Int, _ day: WeatherService.Day) -> String {
        let date = trip.date(ofDay: index)
        let label = trip.todayIndex == index ? "Today" : "\(Fmt.weekday(date)) \(Fmt.dayNumber(date))"
        return day.place.isEmpty ? label : "\(label) · \(day.place)"
    }

    private var shareText: String {
        let days = trip.dayIndices.map { day in
            let plans = trip.plans(on: day).map { "\($0.time) \($0.title)" }.joined(separator: ", ")
            return "Day \(day + 1): \(plans.isEmpty ? "free" : plans)"
        }
        return ([trip.name, trip.dateRange + " · " + trip.place] + days).joined(separator: "\n")
    }

    // MARK: Overview

    @ViewBuilder
    private var overview: some View {
        // Side by side normally; stacked at accessibility text sizes so labels fit.
        (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 10)) : AnyLayout(HStackLayout(spacing: 10))) {
            ring(value: trip.plannedDays, of: trip.dayCount, label: "Plans", color: .lime) { selectTab(trip.kind.tabs.contains(.days) ? .days : .route) }
            switch trip.kind {
            case .city:
                ring(value: trip.outfitDays, of: trip.dayCount, label: "Outfits", color: .mint) { selectTab(.wardrobe) }
            case .road:
                ring(value: trip.stops.filter(\.done).count, of: max(trip.stops.count, 1), label: "Stops", color: .mint) { selectTab(.stops) }
            default:
                if trip.budgetLimit > 0 {
                    ringPercent(trip.totalPlanned / trip.budgetLimit, label: "Budget", color: .mint) { segment = .budget }
                } else {
                    ring(value: min(trip.dives.count, trip.dayCount), of: trip.dayCount, label: "Dives", color: .mint) { selectTab(.tides) }
                }
            }
            ringPercent(trip.packedFraction, label: "Packed", color: .coral) { selectTab(.packing) }
        }

        let day = trip.todayIndex ?? 0
        GlassList(trip.todayIndex == nil ? "Day 1 · \(Fmt.weekday(trip.date(ofDay: 0), timeZone: trip.timeZone)) \(Fmt.dayNumber(trip.date(ofDay: 0), timeZone: trip.timeZone))" : "Today · \(Fmt.weekday(.now)) \(Fmt.dayNumber(.now))") {
            let plans = trip.plans(on: day)
            if plans.isEmpty {
                HStack {
                    Text("Nothing booked yet.")
                        .font(.sf(15))
                        .foregroundStyle(Color.textMuted)
                    Spacer()
                    Button("Add a plan") {
                        // Adventure trips plan by route stage instead.
                        if trip.kind.tabs.contains(.days) { addingPlanDay = IdentifiedDay(id: day) } else { selectTab(.route) }
                    }
                    .buttonStyle(GlassPillStyle())
                }
                .padding(.vertical, 12)
            }
            ForEach(plans) { plan in
                ListRow(plan.title, meta: plan.meta) {
                    IconTile(symbol: plan.category.symbol, color: plan.category.tile)
                } trailing: {
                    if let action = plan.action {
                        Button(action) { perform(action, plan: plan) }
                            .buttonStyle(GlassPillStyle())
                    }
                }
            }
        }

        GlassList {
            DocumentsRow(trip: trip)
        }
    }

    private func ring(value: Int, of total: Int, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ProgressRing(progress: Double(value) / Double(max(total, 1)), color: color, text: "\(value)/\(total)")
                Text(label).font(.sf(13, .semibold)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity)
            .glass(22)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label): \(value) of \(total)")
    }

    private func ringPercent(_ value: Double, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ProgressRing(progress: value, color: color, text: "\(Int((value * 100).rounded()))%")
                Text(label).font(.sf(13, .semibold)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity)
            .glass(22)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label): \(Int(value * 100)) percent")
    }

    private func perform(_ action: String, plan: Plan) {
        switch action {
        case "Ticket" where plan.flight != nil:
            ticketPlan = IdentifiedID(id: plan.id)
        default:
            if let url = PlanLinks.maps(plan, in: trip, directions: action == "Go") { openURL(url) }
        }
    }

    // MARK: Itinerary

    private var itinerary: some View {
        GlassList {
            ForEach(trip.dayIndices, id: \.self) { day in
                let plans = trip.plans(on: day)
                Button { selectTab(trip.kind.tabs.contains(.days) ? .days : .route) } label: {
                    ListRow(plans.first?.title ?? "Free day", meta: "\(Fmt.weekday(trip.date(ofDay: day), timeZone: trip.timeZone)) \(Fmt.monthDay(trip.date(ofDay: day), timeZone: trip.timeZone)) · \(Fmt.count(plans.count, "plan"))") {
                        Text("D\(day + 1)")
                            .font(.mono(13, .bold))
                            .foregroundStyle(day == (trip.todayIndex ?? -1) ? Color.lime : Color.textMuted)
                            .lineLimit(1).fixedSize().frame(minWidth: 36, alignment: .leading)
                    } trailing: {
                        if day == trip.todayIndex { Chip("Today", tone: .solid) }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Budget

    private var budget: some View {
        NavigationLink(value: BudgetRoute()) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    SectionLabel("Total planned")
                    Spacer()
                    CornerArrow()
                }
                let total = Fmt.money(trip.totalPlanned, trip.currency)
                MonoAmount(whole: total.whole, fraction: total.fraction, size: 36)
                if trip.budgetLimit > 0 {
                    ProgressBar(value: trip.totalPlanned / trip.budgetLimit, color: trip.totalPlanned > trip.budgetLimit ? .coral : .lime)
                    Text("of \(Fmt.moneyShort(trip.budgetLimit, trip.currency)) · \(Fmt.moneyShort(max(trip.budgetLimit - trip.totalPlanned, 0), trip.currency)) left")
                        .metaStyle(12)
                } else {
                    Text("No budget set · add expenses and a limit").metaStyle(12)
                }
            }
            .glassCard()
        }
        .buttonStyle(.plain)
    }
}

struct BudgetRoute: Hashable {}

/// Fades a view in once when it appears.
private struct FadeInOnAppear: ViewModifier {
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(shown || reduceMotion ? 1 : 0)
            .onAppear { withAnimation(.easeOut(duration: 0.2)) { shown = true } }
    }
}
