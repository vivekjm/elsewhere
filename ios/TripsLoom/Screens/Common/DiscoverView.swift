import SwiftUI

struct DiscoverIdea: Identifiable, Hashable {
    var id: String { "\(title)|\(meta)" }
    var title: String
    var meta: String
    var photo: Photo
    /// A rough guide price per person; nil when there isn't a fair one.
    var price: Double?
    var currency: String
    var kind: TripKind
    var category: PlanCategory
    /// Matches trips at this place ("amalfi", "lisbon").
    var placeKeys: [String] = []
}

struct FeaturedIdea: Hashable {
    var title: String
    var meta: String
    var chip: String
    var photo: Photo
    var prompt: String
}

/// C3. Ideas for every trip type. "Plan" hands the idea to the AI planner;
/// a price pill adds the experience to one of your trips.
struct DiscoverView: View {
    @Environment(TripStore.self) private var store
    @Environment(AppRouter.self) private var router
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var filter: Filter = .forYou
    @State private var adding: DiscoverIdea?
    @State private var added: String?

    enum Filter: Hashable, CaseIterable {
        case forYou, treks, cities, beaches, road

        var title: String {
            switch self {
            case .forYou: "For you"
            case .treks: "Treks"
            case .cities: "Cities"
            case .beaches: "Beaches"
            case .road: "Road trips"
            }
        }

        func matches(_ kind: TripKind) -> Bool {
            switch self {
            case .forYou: true
            case .treks: kind.isAdventure
            case .cities: kind == .city
            case .beaches: kind == .beach
            case .road: kind == .road
            }
        }
    }

    var body: some View {
        NightScreen(photo: featured.photo, title: "Discover") {
            ScreenHeader(title: "Discover")
            FilterPills(options: Filter.allCases.map { ($0, $0.title) }, selection: $filter)

            featuredCard

            GlassList(filter == .forYou ? "Ideas for you" : "Ideas") {
                let ideas = Array(ranked(Self.ideas.filter { filter.matches($0.kind) }, keys: \.placeKeys, kind: \.kind).prefix(filter == .forYou ? 10 : 30))
                if ideas.isEmpty {
                    Text("No ideas for this filter yet.")
                        .font(.sf(15))
                        .foregroundStyle(Color.textMuted)
                        .padding(.vertical, 14)
                }
                ForEach(ideas) { idea in
                    ListRow(idea.title, meta: idea.meta) {
                        PhotoThumb(photo: idea.photo)
                    } trailing: {
                        Button(idea.price.map { _ in displayPrice(idea) } ?? "Add") { adding = idea }
                            .buttonStyle(GlassPillStyle())
                            .font(.mono(14, .semibold))
                            .accessibilityLabel(idea.price.map { _ in "Add, about \(displayPrice(idea))" } ?? "Add")
                            .accessibilityHint("Adds it to one of your trips")
                    }
                }
            }

            let places = Array(ranked(Destination.all.filter { filter.matches($0.kind) }, keys: \.keys, kind: \.kind).prefix(filter == .forYou ? 6 : 12))
            if !places.isEmpty {
                GlassList("Places to plan") {
                    ForEach(places, id: \.place) { place in
                        ListRow(place.place, meta: "\(Fmt.count(place.days.count, "day")) · about \(Fmt.moneyShort(place.perDay, place.currency))/day") {
                            PhotoThumb(photo: place.photo)
                        } trailing: {
                            Button("Plan") { router.plan(Self.prompt(for: place), from: nil) }
                                .buttonStyle(GlassPillStyle())
                                .font(.sf(14, .semibold))
                                .accessibilityLabel("Plan \(place.place)")
                        }
                    }
                }
            }

            Text("Prices are rough per-person guides, not quotes. Check before you book.")
                .font(.sf(13))
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)
        }
        .overlay(alignment: .bottom) {
            if let added {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.lime)
                    Text(added).foregroundStyle(.white).lineLimit(2)
                }
                    .font(.sf(14, .semibold))
                    .padding(.horizontal, 16)
                    .frame(minHeight: 44)
                    .glassCapsule(fill: Color(hex: 0x14161C, opacity: 0.8))
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .accessibilityAddTraits(.isStaticText)
            }
        }
        .sheet(item: $adding) { idea in
            AddIdeaSheet(idea: idea, trips: tripsFor(idea)) { trip, day, time in
                add(idea, to: trip, day: day, time: time)
            }
        }
    }

    /// "For you": the user's travel style and past trip kinds first, places
    /// in their home currency next, places they've already been last.
    private func ranked<T>(_ items: [T], keys: KeyPath<T, [String]>, kind: KeyPath<T, TripKind>) -> [T] {
        guard filter == .forYou else { return items }
        let styleKinds = PreferenceOptions.kinds(for: store.profile.travelStyle)
        let pastKinds = Set(store.trips.filter { $0.isSample != true }.map(\.kind))
        let homeSymbol = CurrencyService.symbol(for: CurrencyService.home)
        let visited = store.trips.filter { $0.isSample != true }.map { "\($0.place) \($0.name)".lowercased() }
        func score(_ item: T) -> Int {
            var s = 0
            let k = item[keyPath: kind]
            if styleKinds.contains(k) || (k.isAdventure && styleKinds.contains(where: \.isAdventure)) { s += 3 }
            if (store.profile.focus ?? []).contains("adventure"), k.isAdventure { s += 2 }
            if pastKinds.contains(k) { s += 2 }
            if let idea = item as? DiscoverIdea, idea.currency == homeSymbol { s += 1 }
            if let place = item as? Destination, place.currency == homeSymbol { s += 1 }
            if item[keyPath: keys].contains(where: { key in visited.contains { $0.contains(key) } }) { s -= 4 }
            return s
        }
        return items.enumerated()
            .sorted { a, b in
                let (sa, sb) = (score(a.element), score(b.element))
                return sa != sb ? sa > sb : a.offset < b.offset
            }
            .map(\.element)
    }

    static func prompt(for place: Destination) -> String {
        "\(min(place.days.count, 6)) days in \(place.place)"
    }

    private var featured: FeaturedIdea {
        switch filter {
        case .forYou:
            if let top = ranked(Destination.all, keys: \.keys, kind: \.kind).first {
                let short = top.place.split(separator: ",").first.map(String.init) ?? top.place
                return FeaturedIdea(title: short, meta: "\(Fmt.count(min(top.days.count, 6), "day")) · \(top.days.prefix(2).map(\.title).joined(separator: " · "))",
                             chip: "For you · \(top.kind.label.lowercased())", photo: top.photo, prompt: Self.prompt(for: top))
            }
            return FeaturedIdea(title: "Tour du Mont Blanc", meta: "6 days · 2,665 m · moderate", chip: "Trending · trek", photo: .himalaya, prompt: "6 days on the Tour du Mont Blanc, moderate, mountain refuges")
        case .treks:
            return FeaturedIdea(title: "Tour du Mont Blanc", meta: "6 days · 2,665 m · moderate", chip: "Trending · trek", photo: .himalaya, prompt: "6 days on the Tour du Mont Blanc, moderate, mountain refuges")
        case .cities:
            return FeaturedIdea(title: "Lisbon in autumn", meta: "5 days · food · tiles", chip: "Trending · city", photo: .lisbon, prompt: "5 days in Lisbon in autumn, food and tiles")
        case .beaches:
            return FeaturedIdea(title: "Amalfi Coast in May", meta: "4 days · boats · quiet coves", chip: "Trending · beach", photo: .beach, prompt: "A long weekend on the Amalfi Coast in May, boats and quiet coves")
        case .road:
            return FeaturedIdea(title: "Pacific Coast Highway", meta: "5 days · 1,050 km · Big Sur", chip: "Trending · road", photo: .himalaya, prompt: "5 day road trip down the Pacific Coast Highway from San Francisco to Los Angeles")
        }
    }

    private var featuredCard: some View {
        // The photo sits behind a stacked layout, so large text makes the card
        // taller instead of running the title into the chip.
        let large = typeSize.isAccessibilitySize
        return VStack(alignment: .leading, spacing: 0) {
            Chip(featured.chip, tone: .onPhoto(.lime)).padding(12)
            Spacer(minLength: 24)
            (large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10)) : AnyLayout(HStackLayout(spacing: 12))) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(featured.title).font(.sf(21, .bold)).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(featured.meta).metaStyle()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button("Plan") { router.plan(featured.prompt, from: "discover-featured") }
                    .buttonStyle(LimePillStyle(height: 40))
                    .font(.sf(15, .bold))
            }
            .padding(14)
            .glass(22, fill: Color(hex: 0x12141A, opacity: 0.5))
            .padding(10)
        }
        .frame(maxWidth: .infinity, minHeight: 300, alignment: .leading)
        .background {
            Color.photoPlaceholder
                .overlay {
                    // Cross-fades when the filter changes the featured idea.
                    RemotePhoto(photo: featured.photo, width: 900)
                        .id(featured.photo)
                        .transition(.opacity)
                        .scaleEffect(1.2)
                        .parallax(0.1, limit: 28)
                }
                .clipped()
        }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
            .zoomSource("discover-featured")
            .contentTransition(.opacity)
            .animation(.smooth(duration: 0.45), value: filter)
    }

    /// The idea's price in the phone's currency where a rate is known.
    private func displayPrice(_ idea: DiscoverIdea) -> String {
        let price = idea.price ?? 0
        let home = CurrencyService.home
        guard let from = CurrencyService.code(for: idea.currency), from != home,
              let rate = CurrencyService.shared.rate(from: from, to: home)
        else { return Fmt.moneyShort(price, idea.currency) }
        let value = price * rate
        let rounded = value >= 100 ? (value / 10).rounded() * 10 : value.rounded()
        return Fmt.moneyShort(rounded, CurrencyService.symbol(for: home))
    }

    /// Trips at the idea's place first ("Lisbon" → trips in Lisbon).
    private func tripsFor(_ idea: DiscoverIdea) -> [Trip] {
        let keys = idea.placeKeys
        let here = store.upcoming.filter { trip in
            let text = "\(trip.place) \(trip.name)".lowercased()
            return keys.contains { text.contains($0) }
        }
        let sameKind = store.upcoming.filter { trip in trip.kind == idea.kind && !here.contains { $0.id == trip.id } }
        let picked = here + sameKind
        return picked + store.upcoming.filter { trip in !picked.contains { $0.id == trip.id } }
    }

    private func add(_ idea: DiscoverIdea, to trip: Trip, day: Int, time: String) {
        let key = idea.title.split(separator: ",").first.map { $0.lowercased() } ?? idea.title.lowercased()
        if trip.plans.contains(where: { $0.title.lowercased().hasPrefix(key) }) {
            toast("\(idea.title) is already on \(trip.name).")
            return
        }
        // Priced in the trip's currency, so the budget adds up.
        var cost = idea.price ?? 0
        var meta = idea.meta
        if let price = idea.price, idea.currency != trip.currency {
            if let from = CurrencyService.code(for: idea.currency), let to = CurrencyService.code(for: trip.currency),
               let rate = CurrencyService.shared.rate(from: from, to: to) {
                cost = (price * rate * Double(max(trip.travellers, 1))).rounded()
            } else {
                cost = 0
                meta += " · about \(Fmt.moneyShort(price, idea.currency)) each"
            }
        } else {
            cost *= Double(max(trip.travellers, 1))
        }
        // A plan on a day the trip doesn't have would never show anywhere.
        let day = min(max(day, 0), max(trip.dayCount - 1, 0))
        store.update(trip.id) { t in
            t.plans.append(Plan(day: day, time: time, title: idea.title, meta: meta, category: idea.category, cost: Fmt.roundedCurrency(cost, t.currency), addedAt: .now))
        }
        toast("Added \(idea.title) to day \(day + 1) of \(trip.name).")
    }

    private func toast(_ text: String) {
        withAnimation { added = text }
        UIAccessibility.post(notification: .announcement, argument: text)
        Task {
            try? await Task.sleep(for: .seconds(3))
            withAnimation { if added == text { added = nil } }
        }
    }

    /// Hand-picked experiences with rough prices, plus a highlight from each
    /// destination the drafter knows.
    static let ideas: [DiscoverIdea] = {
        let curated = [
            DiscoverIdea(title: "Sunset sail from Positano", meta: "Amalfi Coast · 3 h", photo: .beach, price: 85, currency: "€", kind: .beach, category: .evening, placeKeys: ["amalfi", "positano", "sorrento"]),
            DiscoverIdea(title: "Alfama food walk", meta: "Lisbon · 3 h", photo: .lisbon, price: 35, currency: "€", kind: .city, category: .food, placeKeys: ["lisbon"]),
            DiscoverIdea(title: "Tea house hike, Ghorepani", meta: "Nepal · 1 day", photo: .himalaya, price: 25, currency: "$", kind: .trek, category: .activity, placeKeys: ["nepal", "pokhara", "ghorepani", "annapurna"]),
            DiscoverIdea(title: "Glacier lagoon kayak", meta: "Jökulsárlón · 2 h", photo: .aurora, price: 110, currency: "€", kind: .road, category: .activity, placeKeys: ["iceland", "jokulsarlon", "reykjavik"]),
            DiscoverIdea(title: "Refuge night, Alta Badia", meta: "Dolomites · 1 night", photo: .himalaya, price: 70, currency: "€", kind: .trek, category: .stay, placeKeys: ["dolomites", "alta badia", "cortina"]),
            DiscoverIdea(title: "Big Sur coast drive", meta: "Highway 1 · 1 day", photo: .beach, price: 40, currency: "$", kind: .road, category: .transit, placeKeys: ["big sur", "highway 1", "pacific coast", "california"]),
            DiscoverIdea(title: "Laugavegur trail", meta: "Iceland · 4 days", photo: .aurora, price: nil, currency: "€", kind: .trek, category: .activity, placeKeys: ["iceland", "laugavegur", "landmannalaugar"]),
            DiscoverIdea(title: "W Trek, Torres del Paine", meta: "Patagonia · 5 days", photo: .himalaya, price: nil, currency: "$", kind: .trek, category: .activity, placeKeys: ["patagonia", "torres del paine", "puerto natales"]),
            DiscoverIdea(title: "Breithorn summit day", meta: "Zermatt · 1 day", photo: .himalaya, price: 180, currency: "CHF", kind: .climb, category: .activity, placeKeys: ["zermatt", "breithorn", "switzerland"]),
            DiscoverIdea(title: "Fjord camping, Lofoten", meta: "Norway · 1 night", photo: .aurora, price: nil, currency: "€", kind: .camp, category: .stay, placeKeys: ["lofoten", "norway"]),
            DiscoverIdea(title: "Kaiseki dinner, Gion", meta: "Kyoto · 2 h", photo: .aurora, price: 12_000, currency: "¥", kind: .city, category: .food, placeKeys: ["kyoto", "gion"]),
            DiscoverIdea(title: "Harbour kayak at dusk", meta: "Sydney · 2 h", photo: .beach, price: 60, currency: "A$", kind: .beach, category: .activity, placeKeys: ["sydney", "australia"]),
        ]
        let skip = ["drive", "check in", "arrive", "fly", "ferry", "train", "pickup", "transfer", "back to", "easy evening",
                    "lunch", "dinner", "short walk", "café", "beach morning", "walk the", "spa"]
        let highlights = Destination.all.compactMap { place -> DiscoverIdea? in
            for day in place.days {
                if let stop = day.stops.first(where: { stop in !skip.contains { stop.lowercased().hasPrefix($0) } }) {
                    let short = place.place.split(separator: ",").first.map(String.init) ?? place.place
                    return DiscoverIdea(title: stop, meta: "\(short) · \(day.title)", photo: place.photo, price: nil, currency: place.currency,
                                        kind: place.kind, category: PlanCategory.guess(from: stop) ?? .sight, placeKeys: place.keys)
                }
            }
            return nil
        }
        return curated + highlights.filter { h in !curated.contains { $0.title == h.title } }
    }()
}

/// Picks the trip, day and time for an idea from Discover.
private struct AddIdeaSheet: View {
    var idea: DiscoverIdea
    var trips: [Trip]
    var onAdd: (Trip, Int, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(AppRouter.self) private var router
    @State private var tripID: UUID?
    @State private var day = 0
    @State private var time = Date.now

    private var trip: Trip? { trips.first { $0.id == tripID } }

    var body: some View {
        NavigationStack {
            Form {
                if trips.isEmpty {
                    Section {
                        Text("Create a trip first, then add ideas to it.")
                        Button("New trip") {
                            dismiss()
                            router.startNewTrip()
                        }
                    }
                } else {
                    Section {
                        Picker("Trip", selection: $tripID) {
                            ForEach(trips) { Text($0.name).tag(Optional($0.id)) }
                        }
                        if let trip {
                            Picker("Day", selection: $day) {
                                ForEach(trip.dayIndices, id: \.self) { d in
                                    Text("Day \(d + 1) · \(Fmt.monthDay(trip.date(ofDay: d), timeZone: trip.timeZone))").tag(d)
                                }
                            }
                            DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                        }
                    } footer: {
                        if let price = idea.price, let trip {
                            Text("Adds about \(Fmt.moneyShort(price, idea.currency)) per person for \(Fmt.count(max(trip.travellers, 1), "traveller")) to the budget.")
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(idea.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let trip else { return }
                        let parts = Calendar.current.dateComponents([.hour, .minute], from: time)
                        onAdd(trip, day, String(format: "%02d:%02d", parts.hour ?? 18, parts.minute ?? 0))
                        dismiss()
                    }
                    .disabled(trip == nil)
                }
            }
            .onAppear {
                guard tripID == nil, let first = trips.first else { return }
                tripID = first.id
                day = first.todayIndex ?? 0
                let typical = idea.category.typicalTime(for: idea.title) ?? Self.defaultTime(idea.category)
                let parts = typical.split(separator: ":").compactMap { Int($0) }
                time = Calendar.current.date(bySettingHour: parts.first ?? 18, minute: parts.last ?? 0, second: 0, of: .now) ?? .now
            }
            .onChange(of: tripID) { _, _ in
                if let trip, !trip.dayIndices.contains(day) { day = 0 }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground { SheetGlass(photo: idea.photo) }
    }

    private static func defaultTime(_ category: PlanCategory) -> String {
        switch category {
        case .food: "13:00"
        case .transit: "08:30"
        case .sight, .activity: "10:00"
        case .evening: "19:00"
        case .stay: "14:00"
        case .flight: "09:00"
        }
    }
}
