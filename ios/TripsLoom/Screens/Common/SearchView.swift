import SwiftUI

/// The separate search circle next to the tab bar. Searches trips, plans,
/// packing and the wardrobe; inside a trip it searches that trip only.
struct SearchView: View {
    var tripID: UUID?
    @Environment(TripStore.self) private var store
    @Environment(\.selectTripTab) private var selectTripTab
    @State private var query = ""

    private var trips: [Trip] {
        if let tripID { return store.trip(tripID).map { [$0] } ?? [] }
        return store.allSorted
    }

    var body: some View {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        NightScreen(photo: trips.first?.photo ?? .lisbon, title: "Search") {
            ScreenHeader(title: "Search")

            if q.isEmpty {
                if tripID == nil {
                    GlassList("Trips") {
                        ForEach(trips) { trip in
                            Button { store.open(trip.id, from: "search-\(trip.id)") } label: { TripRow(trip: trip, zoomID: "search-\(trip.id)") }
                                .buttonStyle(.plain)
                        }
                    }
                }
                Text(tripID == nil ? "Search plans, packing, expenses and your wardrobe across every trip." : "Search this trip's plans, packing, gear and expenses.")
                    .font(.sf(14))
                    .foregroundStyle(Color.textMuted)
                    .padding(.horizontal, 4)
            } else {
                results(q)
            }
        }
        .searchable(text: $query, prompt: tripID == nil ? "Trips, plans, packing" : "Plans, packing, gear")
    }

    @ViewBuilder
    private func results(_ q: String) -> some View {
        // Ignores case and accents: "sacre" finds "Sacré-Cœur".
        let has: (String) -> Bool = { $0.localizedStandardContains(q) }
        let matchingTrips = tripID == nil ? trips.filter { has($0.name) || has($0.place) } : []
        let plans = trips.flatMap { trip in trip.plans.filter { has($0.title) || has($0.meta) || has($0.notes) }.map { (trip, $0) } }
        let packing = trips.flatMap { trip in trip.packing.filter { has($0.name) }.map { (trip, $0) } }
        let gear = trips.flatMap { trip in trip.gear.filter { has($0.name) }.map { (trip, $0) } }
        let expenses = trips.flatMap { trip in trip.expenses.filter { has($0.title) || has($0.meta) }.map { (trip, $0) } }
        let stops = trips.flatMap { trip in trip.stops.filter { has($0.name) || has($0.meta) }.map { (trip, $0) } }
        let wardrobe = tripID == nil ? store.wardrobe.filter { has($0.name) } : []

        if matchingTrips.isEmpty && plans.isEmpty && packing.isEmpty && gear.isEmpty && expenses.isEmpty && stops.isEmpty && wardrobe.isEmpty {
            EmptyNote(title: "No results", message: "Nothing matches \u{201C}\(query)\u{201D}.")
        }
        if !matchingTrips.isEmpty {
            GlassList("Trips") {
                ForEach(matchingTrips) { trip in
                    Button { store.open(trip.id, from: "search-\(trip.id)") } label: { TripRow(trip: trip, zoomID: "search-\(trip.id)") }.buttonStyle(.card)
                }
            }
        }
        if !plans.isEmpty {
            GlassList("Plans") {
                ForEach(plans.prefix(20), id: \.1.id) { trip, plan in
                    Button { open(trip, tab: trip.kind.tabs.contains(.days) ? .days : .trip) } label: {
                        ListRow(plan.title, meta: "\(trip.name) · Day \(plan.day + 1) · \(plan.time)") {
                            IconTile(symbol: plan.category.symbol, color: plan.category.tile, size: .medium)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        if !packing.isEmpty {
            GlassList("Packing") {
                ForEach(packing.prefix(20), id: \.1.id) { trip, item in
                    Button { open(trip, tab: .packing) } label: {
                        ListRow(item.name, meta: "\(trip.name) · \(item.section)") {
                            CheckCircle(isOn: item.packed)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        if !gear.isEmpty {
            GlassList("Gear") {
                ForEach(gear.prefix(20), id: \.1.id) { trip, item in
                    Button { open(trip, tab: .gear) } label: {
                        ListRow(item.name, meta: "\(trip.name) · \(item.group.short)") {
                            CheckCircle(isOn: item.packed)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        if !stops.isEmpty {
            GlassList("Stops") {
                ForEach(stops.prefix(20), id: \.1.id) { trip, stop in
                    Button { open(trip, tab: .stops) } label: {
                        ListRow(stop.name, meta: "\(trip.name) · Day \(stop.day + 1)") {
                            IconTile(symbol: stop.category.symbol, color: stop.category.tile, size: .medium)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        if !expenses.isEmpty {
            GlassList("Expenses") {
                ForEach(expenses.prefix(20), id: \.1.id) { trip, expense in
                    Button { open(trip, tab: .trip) } label: {
                        ListRow(expense.title, meta: "\(trip.name) · \(expense.day.map { "Day \($0 + 1)" } ?? "Whole trip")") {
                            IconTile(symbol: expense.category.symbol, color: expense.category.tile, size: .medium)
                        } trailing: {
                            Text(Fmt.moneyShort(expense.amount, trip.currency)).font(.mono(15, .semibold)).foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        if !wardrobe.isEmpty {
            GlassList("Wardrobe") {
                ForEach(wardrobe) { item in
                    ListRow(item.name, meta: "\(item.category.title) · worn \(item.worn)×") {
                        Swatch(color: Color(hex: item.color), size: 36, radius: 12)
                    }
                }
            }
        }
    }

    private func open(_ trip: Trip, tab: TripTab) {
        if tripID == trip.id {
            if trip.kind.tabs.contains(tab) { selectTripTab(tab) }
        } else {
            store.open(trip.id, tab: tab)
        }
    }
}
