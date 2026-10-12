import SwiftUI

/// L2. A week strip of glass pills with the selected day in lime. Plans are
/// glass cards with a glowing colour bar for their category.
struct DaysView: View {
    @Binding var trip: Trip
    @State private var day: Int
    @State private var editor: PlanEditorRoute?
    @State private var ticketPlan: IdentifiedID?
    @State private var forward = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL

    struct PlanEditorRoute: Identifiable {
        let id = UUID()
        var planID: UUID?
    }

    init(trip: Binding<Trip>) {
        _trip = trip
        _day = State(initialValue: trip.wrappedValue.todayIndex ?? 0)
    }

    var body: some View {
        let plans = trip.plans(on: day)
        let km = plans.reduce(0) { $0 + $1.walkKm }
        // "Next" only once the trip is close; weeks out it's just the first plan.
        let next = trip.status == .active || trip.daysUntil <= 1 ? trip.nextPlan?.id : nil

        NightScreen(photo: trip.photo, spacing: 10) {
            WeekStrip(trip: trip, selection: Binding(
                get: { day },
                set: { new in
                    forward = new > day
                    day = new
                }
            ))
                .padding(.top, 12)

            if let weather = WeatherService.shared.day(trip, day) {
                DayWeatherRow(weather: weather)
            }

            // The day's plans slide in from the side you're moving towards,
            // and a sideways swipe moves between days.
            VStack(alignment: .leading, spacing: 10) {
            if plans.isEmpty {
                EmptyNote(title: "Nothing planned", message: "Add a plan with the plus button, or paste a booking from the Trip tab's menu.")
            } else {
                SectionLabel("\(Fmt.count(plans.count, "plan"))\(km > 0 ? " · \(Fmt.distance(km)) on foot" : "")")
                    .padding(.top, 2)
            }

            ForEach(plans) { plan in
                PlanCard(plan: plan, isNext: plan.id == next, currency: trip.currency) {
                    if plan.flight != nil {
                        ticketPlan = IdentifiedID(id: plan.id)
                    } else if let url = PlanLinks.maps(plan, in: trip, directions: plan.action == "Go") {
                        openURL(url)
                    }
                }
                .onTapGesture { editor = PlanEditorRoute(planID: plan.id) }
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { editor = PlanEditorRoute(planID: plan.id) }
                .contextMenu {
                    Button("Edit", systemImage: "pencil") { editor = PlanEditorRoute(planID: plan.id) }
                    Button("Duplicate", systemImage: "plus.square.on.square") {
                        var copy = plan
                        copy.id = UUID()
                        copy.addedAt = .now
                        trip.plans.append(copy)
                    }
                    if let url = PlanLinks.maps(plan, in: trip, directions: false) {
                        Button("Open in Maps", systemImage: "map") { openURL(url) }
                    }
                    if let url = PlanLinks.maps(plan, in: trip, directions: true) {
                        Button("Directions", systemImage: "arrow.triangle.turn.up.right.diamond") { openURL(url) }
                    }
                    if plan.day > 0 {
                        Button("Move to previous day", systemImage: "arrow.left") {
                            if let i = trip.plans.firstIndex(where: { $0.id == plan.id }) { trip.plans[i].day -= 1 }
                        }
                    }
                    if plan.day + 1 < trip.dayCount {
                        Button("Move to next day", systemImage: "arrow.right") {
                            if let i = trip.plans.firstIndex(where: { $0.id == plan.id }) { trip.plans[i].day += 1 }
                        }
                    }
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        withAnimation { trip.plans.removeAll { $0.id == plan.id } }
                    }
                }
            }

            if trip.kind == .city {
                OutfitCard(trip: trip, day: day)
            }
            }
            .id(day)
            .transition(reduceMotion ? .opacity : .asymmetric(
                insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
                removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)
            ))
            .contentShape(Rectangle())
            .simultaneousGesture(
                DragGesture(minimumDistance: 24).onEnded { drag in
                    let dx = drag.translation.width
                    guard abs(dx) > 60, abs(dx) > abs(drag.translation.height) * 1.5 else { return }
                    let target = day + (dx < 0 ? 1 : -1)
                    guard trip.dayIndices.contains(target) else { return }
                    forward = target > day
                    withAnimation(.spring(duration: 0.45, bounce: 0.15)) { day = target }
                }
            )
        }
        .navigationTitle(Fmt.dayTitle(trip.date(ofDay: day), timeZone: trip.timeZone))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { CloseTripButton() }
            ToolbarItem(placement: .topBarTrailing) {
                LimeToolbarButton(symbol: "plus", label: "Add plan") { editor = PlanEditorRoute(planID: nil) }
            }
        }
        .navigationDestination(for: StylistRoute.self) { _ in StylistView(trip: $trip) }
        .sheet(item: $editor) { route in PlanEditor(trip: $trip, planID: route.planID, defaultDay: day) }
        .sheet(item: $ticketPlan) { item in TicketSheet(trip: $trip, planID: item.id) }
        .sensoryFeedback(.selection, trigger: day)
        .onChange(of: trip.dayCount) { _, count in
            if day >= count { day = max(count - 1, 0) }
        }
    }
}

/// "☁ Partly cloudy · 18° / 11° · 60% rain · Lisbon"
struct DayWeatherRow: View {
    var weather: WeatherService.Day
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: weather.symbol)
                .symbolRenderingMode(.multicolor)
                .font(.system(size: 20))
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(weather.typical == true ? "Usually " + weather.summary.lowercased() : weather.summary) · \(weather.high)° / \(weather.low)°")
                    .font(.sf(15, .medium))
                    .foregroundStyle(.white)
                Text([weather.typical == true ? "Last year on this date" : nil,
                      weather.typical != true && weather.rainChance >= 20 ? "\(weather.rainChance)% chance of rain" : nil,
                      weather.place.isEmpty ? nil : weather.place]
                    .compactMap(\.self).joined(separator: " · "))
                    .metaStyle()
                if shell && typeSize.isAccessibilitySize {
                    Chip("Pack a shell", tone: .tint(.sky)).padding(.top, 4)
                }
            }
            Spacer(minLength: 0)
            if shell && !typeSize.isAccessibilitySize {
                Chip("Pack a shell", tone: .tint(.sky))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .glass(22)
        .accessibilityElement(children: .combine)
    }

    private var shell: Bool { weather.rainChance >= 50 && weather.typical != true }
}

struct WeekStrip: View {
    var trip: Trip
    @Binding var selection: Int
    @Namespace private var ns
    @Environment(\.dynamicTypeSize) private var typeSize

    /// Long trips, and any trip at accessibility text sizes, scroll sideways
    /// so each day number shows at full size.
    private var scrolls: Bool { trip.dayCount > 7 || typeSize.isAccessibilitySize }

    var body: some View {
        let content = HStack(spacing: 6) {
            ForEach(trip.dayIndices, id: \.self) { day in
                pill(day)
            }
        }
        if scrolls {
            ScrollViewReader { proxy in
                ScrollView(.horizontal) {
                    content
                }
                .scrollIndicators(.hidden)
                .scrollClipDisabled()
                .onAppear { proxy.scrollTo(selection, anchor: .center) }
                .onChange(of: selection) { _, day in
                    withAnimation(.spring(duration: 0.45, bounce: 0.15)) { proxy.scrollTo(day, anchor: .center) }
                }
            }
        } else {
            content
        }
    }

    private func pill(_ day: Int) -> some View {
        let date = trip.date(ofDay: day)
        let selected = day == selection
        let hasPlans = !trip.plans(on: day).isEmpty
        return Button {
            withAnimation(.spring(duration: 0.45, bounce: 0.2)) { selection = day }
        } label: {
            VStack(spacing: 3) {
                Text(Fmt.weekdayLetter(date, timeZone: trip.timeZone))
                    .font(.mono(11))
                    .foregroundStyle(selected ? Color.lime : Color.textMuted)
                Text(Fmt.dayNumber(date, timeZone: trip.timeZone))
                    .font(.display(22))
                    .foregroundStyle(selected ? Color.lime : .white)
                    .lineLimit(1)
                    .fixedSize()
                Circle()
                    .fill(hasPlans ? Color.lime : .clear)
                    .frame(width: 4, height: 4)
            }
            .padding(.horizontal, typeSize.isAccessibilitySize ? 12 : 0)
            .frame(maxWidth: .infinity)
            .frame(minWidth: scrolls ? 46 : nil)
            // Grows with the text size so the weekday letter stays inside.
            .padding(.vertical, 6)
            .frame(minHeight: 66)
            // One gold rule slides between days; the section rule below is the baseline.
            .overlay(alignment: .bottom) {
                if selected {
                    Rectangle().fill(Color.lime).frame(height: 2)
                        .matchedGeometryEffect(id: "selected-day", in: ns)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.card)
        .id(day)
        .accessibilityLabel(Fmt.dayTitle(date, timeZone: trip.timeZone))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct PlanCard: View {
    var plan: Plan
    var isNext: Bool
    var currency = "€"
    var action: () -> Void = {}
    @Environment(\.dynamicTypeSize) private var typeSize

    /// Details, plus the price unless the details already mention it.
    private var meta: String {
        let cost = plan.cost > 0 ? Fmt.moneyShort(plan.cost, currency) : nil
        guard !plan.meta.isEmpty else { return cost ?? "" }
        guard let cost, !plan.meta.contains(currency) else { return plan.meta }
        return "\(plan.meta) · \(cost)"
    }

    var body: some View {
        // At accessibility text sizes time, title and action stack so the
        // title keeps the full width.
        let large = typeSize.isAccessibilitySize
        (large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 6)) : AnyLayout(HStackLayout(spacing: 12))) {
            Text(TravelDates.clock(plan.time) ?? plan.time)
                .font(.mono(13, .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .fixedSize()
                .frame(minWidth: 44, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
                Group {
                    if large {
                        WordFittingTitle(text: plan.title, size: 16, weight: .medium, serif: false)
                    } else {
                        Text(plan.title).font(.sf(16, .medium)).lineLimit(2)
                    }
                }
                    .foregroundStyle(.white)
                if !meta.isEmpty { Text(meta).metaStyle() }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if isNext {
                Chip("Next", tone: .solid)
            } else if let label = plan.action {
                Button(label, action: action)
                    .buttonStyle(GlassPillStyle())
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 14)
        .padding(.leading, 18)
        .padding(.trailing, 16)
        .overlay(alignment: .leading) { CategoryBar(color: plan.category.color) }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .glass(24)
        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityHint("Edit plan")
    }
}

struct StylistRoute: Hashable {}

/// The day's outfit as stacked swatches, linking to the stylist.
struct OutfitCard: View {
    var trip: Trip
    var day: Int
    @Environment(TripStore.self) private var store

    var body: some View {
        let outfit = trip.outfits.first { $0.day == day }
        let colors = (outfit?.items ?? []).compactMap { store.wardrobeItem($0) }.map { Color(hex: $0.color) }
        NavigationLink(value: StylistRoute()) {
            HStack(spacing: 12) {
                if colors.isEmpty {
                    IconTile(symbol: "tshirt", color: Tile.plum)
                } else {
                    SwatchStack(colors: colors)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(outfit?.title ?? "Pick an outfit").font(.sf(16, .medium)).foregroundStyle(.white)
                    Text(day == trip.todayIndex ? "Today's outfit" : "Outfit for day \(day + 1)").metaStyle()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                CornerArrow()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .glass(24)
        }
        .buttonStyle(.plain)
    }
}

/// Apple Maps links for a plan: search for the place, or directions to it.
enum PlanLinks {
    static func maps(_ plan: Plan, in trip: Trip, directions: Bool) -> URL? {
        guard plan.category != .flight else { return nil }
        let title = plan.title
            .replacingOccurrences(of: "Check in, ", with: "")
            .replacingOccurrences(of: "Lunch at ", with: "")
            .replacingOccurrences(of: "Dinner at ", with: "")
            .replacingOccurrences(of: " (optional)", with: "")
        let area = plan.meta.split(separator: "·").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        let place = trip.place.split(separator: ",").first.map(String.init) ?? trip.place
        let parts = [title, area.contains(where: \.isNumber) ? "" : area, place].filter { !$0.isEmpty }
        let query = parts.reduce(into: [String]()) { out, p in if !out.contains(where: { $0.localizedCaseInsensitiveContains(p) }) { out.append(p) } }
            .joined(separator: ", ")
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return nil }
        return URL(string: "maps://?\(directions ? "daddr" : "q")=\(encoded)")
    }
}
