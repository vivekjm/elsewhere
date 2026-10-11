import Charts
import SwiftUI

/// Beach mode's third tab: an estimated tide curve per day and a dive log.
struct TidesView: View {
    @Binding var trip: Trip
    @State private var day: Int
    @State private var addingDive = false

    init(trip: Binding<Trip>) {
        _trip = trip
        _day = State(initialValue: trip.wrappedValue.todayIndex ?? 0)
    }

    @State private var editingDive: Dive?

    private var tides: TideService.Day? { TideService.shared.day(for: trip, index: day) }

    var body: some View {
        let curve = tides?.points ?? []
        let turns = Tides.turns(in: curve)
        let low = (curve.map(\.height).min() ?? -1.2), high = (curve.map(\.height).max() ?? 1.2)
        let pad = max((high - low) * 0.35, 0.3)
        NightScreen(photo: trip.photo, spacing: 12, title: "Tides") {
            ScreenHeader(title: "Tides", meta: trip.place)

            WeekStrip(trip: trip, selection: $day)

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(Fmt.dayTitle(trip.date(ofDay: day), timeZone: trip.timeZone)).font(.sf(17, .semibold)).foregroundStyle(.white)
                    Spacer()
                    if let next = turns.first(where: { $0.date > .now }) ?? turns.first {
                        Chip("\(next.high ? "High" : "Low") \(Fmt.clock(next.date, timeZone: trip.timeZone))", tone: .tint(next.high ? .sky : .mint))
                    }
                }
                if tides == nil {
                    ProgressView().tint(.white).frame(maxWidth: .infinity, minHeight: 150)
                } else if tides?.source == .inland {
                    EmptyNote(title: "No sea here", message: "\(trip.place) is too far from the coast for tide data.")
                } else {
                Chart {
                    ForEach(curve) { point in
                        AreaMark(x: .value("Time", point.date), yStart: .value("Base", low - pad), yEnd: .value("Height", point.height))
                            .interpolationMethod(.catmullRom)
                            .foregroundStyle(LinearGradient(colors: [.mint.opacity(0.28), .mint.opacity(0)], startPoint: .top, endPoint: .bottom))
                        LineMark(x: .value("Time", point.date), y: .value("Height", point.height))
                            .interpolationMethod(.catmullRom)
                            .lineStyle(StrokeStyle(lineWidth: 2.5))
                            .foregroundStyle(Color.mint)
                    }
                    ForEach(turns) { turn in
                        PointMark(x: .value("Time", turn.date), y: .value("Height", turn.height))
                            .symbolSize(60)
                            .foregroundStyle(turn.high ? Color.sky : Color.lime)
                            .annotation(position: turn.high ? .top : .bottom, spacing: 4) {
                                Text(Fmt.clock(turn.date, timeZone: trip.timeZone)).font(.mono(10, .semibold)).foregroundStyle(.white)
                            }
                    }
                }
                .chartYScale(domain: (low - pad)...(high + pad * 0.6))
                .chartYAxis(.hidden)
                .chartXAxis {
                    AxisMarks(values: .stride(by: .hour, count: 6)) { value in
                        AxisValueLabel {
                            if let date = value.as(Date.self) {
                                Text(Fmt.clock(date, timeZone: trip.timeZone)).font(.mono(10)).foregroundStyle(Color.white.opacity(0.6))
                            }
                        }
                    }
                }
                .frame(height: 150)
                .accessibilityLabel("Tide curve")
                .accessibilityValue(turns.map { "\($0.high ? "High" : "Low") at \(Fmt.clock($0.date, timeZone: trip.timeZone))" }.joined(separator: ", "))
                Text(tides?.source == .live
                     ? "Sea level from Open-Meteo Marine · local time · check harbour tide tables before diving"
                     : "Estimate from the lunar cycle · live tides appear about two weeks before the day")
                    .font(.sf(12))
                    .foregroundStyle(Color.textFaint)
                }
            }
            .glassCard()
            .task(id: "\(trip.place)|\(day)|\(trip.startDayKey ?? "")") { await TideService.shared.load(trip, index: day) }

            GlassList("Dive log") {
                Button { addingDive = true } label: { OutlinePlusLabel(text: "Log") }
                    .buttonStyle(OutlinePillStyle())
            } content: {
                if trip.dives.isEmpty {
                    Text("No dives logged yet.")
                        .font(.sf(15))
                        .foregroundStyle(Color.textMuted)
                        .padding(.vertical, 14)
                }
                ForEach(trip.dives.sorted { $0.day < $1.day }) { dive in
                    Button { editingDive = dive } label: {
                        ListRow(dive.site, meta: "Day \(dive.day + 1) · \(Fmt.depth(dive.depthM)) · \(dive.minutes) min") {
                            IconTile(symbol: "water.waves", color: Tile.teal)
                        }
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button("Edit", systemImage: "pencil") { editingDive = dive }
                        Button("Delete", systemImage: "trash", role: .destructive) { withAnimation { trip.dives.removeAll { $0.id == dive.id } } }
                    }
                }
            }
        }
        .sheet(isPresented: $addingDive) { DiveEditor(trip: $trip, dive: Dive(day: day, site: "", depthM: 12, minutes: 40), isNew: true) }
        .sheet(item: $editingDive) { DiveEditor(trip: $trip, dive: $0, isNew: false) }
    }
}

enum Tides {
    struct Point: Identifiable, Equatable {
        var id: Date { date }
        var date: Date
        var height: Double
    }

    struct Turn: Identifiable {
        var id: Date { date }
        var date: Date
        var height: Double
        var high: Bool
    }

    /// Semi-diurnal estimate: two highs and two lows about 12h 25m apart,
    /// shifting ~50 minutes a day.
    static func curve(for day: Date, seed: UUID, calendar: Calendar = .current) -> [Point] {
        let start = calendar.startOfDay(for: day)
        let offset = Double(seed.uuidString.utf8.reduce(0) { ($0 + Int($1)) % 745 })
        let dayNumber = Double(calendar.ordinality(of: .day, in: .era, for: start) ?? 0)
        let period = 12.42 * 60
        return stride(from: 0.0, through: 24 * 60, by: 20).map { minute in
            let phase = (minute + dayNumber * 50 + offset) / period * 2 * .pi
            let spring = 1 + 0.25 * cos(dayNumber / 14.77 * 2 * .pi)
            return Point(date: start.addingTimeInterval(minute * 60), height: 1.2 * spring * cos(phase))
        }
    }

    static func turns(in curve: [Point]) -> [Turn] {
        guard curve.count > 2 else { return [] }
        var result: [Turn] = []
        for i in 1..<(curve.count - 1) {
            let a = curve[i - 1].height, b = curve[i].height, c = curve[i + 1].height
            guard (b > a && b >= c) || (b < a && b <= c) else { continue }
            // Fit a parabola through the three samples to place the turn between them.
            let step = curve[i + 1].date.timeIntervalSince(curve[i].date)
            let denominator = a - 2 * b + c
            let shift = denominator == 0 ? 0 : max(-0.5, min(0.5, (a - c) / (2 * denominator)))
            let height = b - (a - c) * shift / 4
            result.append(Turn(date: curve[i].date.addingTimeInterval(shift * step), height: height, high: b > a))
        }
        return result
    }
}

private struct DiveEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    @State var dive: Dive
    var isNew: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                TextField("Dive site", text: $dive.site)
                    .focused($firstFieldFocused)
                Picker("Day", selection: $dive.day) {
                    ForEach(trip.dayIndices, id: \.self) { Text("Day \($0 + 1)").tag($0) }
                }
                Stepper("Max depth: \(Fmt.depth(dive.depthM))", value: $dive.depthM, in: 1...60)
                Stepper("Bottom time: \(dive.minutes) min", value: $dive.minutes, in: 5...120, step: 5)
                if !isNew {
                    Button("Delete dive", role: .destructive) {
                        trip.dives.removeAll { $0.id == dive.id }
                        dismiss()
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isNew ? "Log a dive" : "Edit dive")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        dive.site = dive.site.trimmingCharacters(in: .whitespacesAndNewlines)
                        if let i = trip.dives.firstIndex(where: { $0.id == dive.id }) { trip.dives[i] = dive } else { trip.dives.append(dive) }
                        dismiss()
                    }
                    .disabled(dive.site.trimmingCharacters(in: .whitespaces).isEmpty || dive.site.count > 200)
                }
            }
        }
        .autofocus($firstFieldFocused, when: isNew)
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium, .large])
    }
}

/// Road mode's third tab: places to stop, by day.
struct StopsView: View {
    @Binding var trip: Trip
    @State private var adding = false
    @State private var editing: Stop?
    @Environment(\.openURL) private var openURL

    var body: some View {
        let done = trip.stops.filter(\.done).count
        NightScreen(photo: trip.photo, spacing: 12, title: "Stops") {
            ScreenHeader(title: "Stops", meta: "\(trip.stops.count) stops · \(done) visited · \(Fmt.distance(trip.totalKm))")

            if trip.stops.isEmpty {
                EmptyNote(title: "No stops yet", message: "Add fuel, food and viewpoints along the way.")
            }

            ForEach(trip.dayIndices.filter { d in trip.stops.contains { $0.day == d } }, id: \.self) { day in
                GlassList("Day \(day + 1) · \(Fmt.weekday(trip.date(ofDay: day), timeZone: trip.timeZone))") {
                    ForEach(trip.stops.filter { $0.day == day }) { stop in
                        Button { toggle(stop.id) } label: {
                            ListRow(stop.name, meta: stop.meta) {
                                IconTile(symbol: stop.category.symbol, color: stop.category.tile)
                            } trailing: {
                                CheckCircle(isOn: stop.done)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityValue(stop.done ? "Visited" : "Not visited")
                        .contextMenu {
                            if let url = mapsURL(stop, directions: true) {
                                Button("Directions", systemImage: "arrow.triangle.turn.up.right.diamond") { openURL(url) }
                            }
                            if let url = mapsURL(stop, directions: false) {
                                Button("Show in Maps", systemImage: "map") { openURL(url) }
                            }
                            Button("Edit", systemImage: "pencil") { editing = stop }
                            Button("Delete", systemImage: "trash", role: .destructive) { withAnimation { trip.stops.removeAll { $0.id == stop.id } } }
                        }
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                LimeToolbarButton(symbol: "plus", label: "Add stop") { adding = true }
            }
        }
        .sheet(isPresented: $adding) { StopEditor(trip: $trip, stop: Stop(day: trip.todayIndex ?? 0, name: "", meta: "", category: .food), isNew: true) }
        .sheet(item: $editing) { StopEditor(trip: $trip, stop: $0, isNew: false) }
    }

    private func mapsURL(_ stop: Stop, directions: Bool) -> URL? {
        let place = trip.place.split(separator: ",").first.map(String.init) ?? trip.place
        let query = stop.name.localizedCaseInsensitiveContains(place) ? stop.name : "\(stop.name), \(place)"
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return nil }
        return URL(string: "maps://?\(directions ? "daddr" : "q")=\(encoded)")
    }

    private func toggle(_ id: UUID) {
        guard let i = trip.stops.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(Motion.snappy) { trip.stops[i].done.toggle() }
    }
}

private struct StopEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    @State var stop: Stop
    var isNew: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                TextField("Place", text: $stop.name)
                    .focused($firstFieldFocused)
                TextField("Details", text: $stop.meta)
                Picker("Day", selection: $stop.day) {
                    ForEach(trip.dayIndices, id: \.self) { Text("Day \($0 + 1)").tag($0) }
                }
                Picker("Type", selection: $stop.category) {
                    ForEach([PlanCategory.food, .transit, .sight, .stay, .activity]) { Label($0.title, systemImage: $0.symbol).tag($0) }
                }
                if !isNew {
                    Toggle("Visited", isOn: $stop.done)
                    Button("Delete stop", role: .destructive) {
                        trip.stops.removeAll { $0.id == stop.id }
                        dismiss()
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isNew ? "Add stop" : "Edit stop")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNew ? "Add" : "Save") {
                        stop.name = stop.name.trimmingCharacters(in: .whitespacesAndNewlines)
                        if let i = trip.stops.firstIndex(where: { $0.id == stop.id }) { trip.stops[i] = stop } else { trip.stops.append(stop) }
                        dismiss()
                    }
                    .disabled(stop.name.trimmingCharacters(in: .whitespaces).isEmpty || stop.name.count > 200)
                }
            }
        }
        .autofocus($firstFieldFocused, when: isNew)
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium, .large])
    }
}
