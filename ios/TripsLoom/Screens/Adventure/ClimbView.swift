import SwiftUI

/// A5. Mountaineering swaps Route for Climb. Summit wind uses the pill chart:
/// calm days in lime, dangerous days in coral.
struct ClimbView: View {
    @Binding var trip: Trip
    @State private var settingUp = false
    @State private var loading = false

    private let times = stride(from: 0, to: 24, by: 1).flatMap { h in ["\(String(format: "%02d", h)):00", "\(String(format: "%02d", h)):30"] }

    var body: some View {
        NightScreen(photo: trip.photo, spacing: 14) {
            if let summit = trip.adventure?.summit, summit.forecast.isEmpty {
                ScreenHeader(title: summit.peak, meta: "\(Fmt.grouped(summit.altitude)) m")
                HStack(spacing: 12) {
                    if loading { ProgressView().tint(.white) }
                    Text(loading ? "Getting the forecast at \(Fmt.grouped(summit.altitude)) m…" : "Couldn't reach the forecast. Pull down to try again.")
                        .font(.sf(15))
                        .foregroundStyle(Color.textMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .glassCard()
            } else if let summit = trip.adventure?.summit {
                content(summit)
            } else {
                ScreenHeader(title: "Climb")
                VStack(alignment: .leading, spacing: 12) {
                    Text("Add your peak to see the wind at the summit for the next 16 days, the calmest window, and your high-camp and turnaround times.")
                        .font(.sf(15))
                        .foregroundStyle(Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Set up summit") { settingUp = true }
                        .buttonStyle(LimePillStyle(height: 40))
                }
                .glassCard()
            }
        }
        .navigationTitle(trip.adventure?.summit.map { "\($0.peak) · \(Fmt.grouped($0.altitude)) m" } ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if trip.adventure?.summit != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { settingUp = true } label: { Image(systemName: "slider.horizontal.3") }
                        .accessibilityLabel("Edit summit")
                }
            }
        }
        .sheet(isPresented: $settingUp) { SummitEditor(trip: $trip) }
        .task(id: trip.adventure?.summit?.peak) { await refresh() }
        .refreshable { await refresh(force: true) }
    }

    /// Days of the trip when a summit push can happen: around the highest
    /// stage, else the last week.
    private var summitDays: ClosedRange<Date> {
        let calendar = Calendar.current
        // The highest stage with a height, else one called "summit", else near the end.
        let top = trip.stages.filter { $0.altitude > 0 }.max { $0.altitude < $1.altitude }
            ?? trip.stages.last { $0.title.localizedCaseInsensitiveContains("summit") }
        let center = top.map { $0.day - 1 } ?? max(trip.dayCount - 2, 0)
        // Forecast days are calendar dates at the phone's midnight; match the
        // trip's dates the same way, whatever the destination's time zone.
        func local(_ day: Int) -> Date {
            TravelDates.date(trip.dayKey(day), in: .current) ?? calendar.startOfDay(for: trip.date(ofDay: day))
        }
        let from = local(max(center - 3, 0)), to = local(min(center + 3, trip.dayCount - 1))
        return from...max(from, to)
    }

    private var isLive: Bool { trip.adventure?.summit?.updated != nil }

    /// Fetches the live forecast at most every 3 hours. Sample climbs keep
    /// their sample data.
    private func refresh(force: Bool = false) async {
        guard trip.isSample != true, let summit = trip.adventure?.summit, !loading else { return }
        if !force, let updated = summit.updated, updated > .now.addingTimeInterval(-3 * 3600) { return }
        loading = true
        defer { loading = false }
        var place = await Places.lookup("\(summit.peak), \(trip.place)")
        if place == nil { place = await Places.lookup(summit.peak) }
        if place == nil { place = await Places.lookup(trip.place) }
        guard let place,
              let days = await SummitForecast.fetch(latitude: place.latitude, longitude: place.longitude, altitude: summit.altitude),
              !days.isEmpty
        else { return }
        let forecast = days.map { WindDay(date: $0.date, kmh: $0.kmh) }
        var temps: [UUID: Int] = [:]
        for (day, source) in zip(forecast, days) { if let t = source.dawnTemp { temps[day.id] = t } }
        trip.adventure?.summit?.forecast = forecast
        trip.adventure?.summit?.dawnTemps = temps
        trip.adventure?.summit?.updated = .now
    }

    @ViewBuilder
    private func content(_ summit: Summit) -> some View {
        // Live forecasts only count days you're on the mountain.
        let inTrip = isLive ? summit.forecast.filter { summitDays.contains($0.date) } : summit.forecast
        let window = summit.window(in: inTrip)
        let opens = Calendar.current.date(byAdding: .day, value: -15, to: summitDays.lowerBound) ?? summitDays.lowerBound
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(isLive && inTrip.isEmpty ? "Summit forecast" : "Lower-wind outlook", color: .lime)
            Text(isLive && inTrip.isEmpty ? "Opens \(Fmt.monthDay(opens))" : windowTitle(window)).displayTitle(34).padding(.top, 8)
            Text(isLive && inTrip.isEmpty
                 ? "Your summit days are more than 16 days away. Below is the live outlook at \(Fmt.grouped(summit.altitude)) m."
                 : windowMeta(window, summit))
                .metaStyle(12)
                .padding(.top, 6)
                .lineLimit(3)
        }
        .padding(.horizontal, 4)
        .padding(.top, 12)

        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Summit wind").font(.sf(17, .semibold)).foregroundStyle(.white)
                Spacer()
                Text("km/h").font(.mono(12)).foregroundStyle(Color.textMuted)
            }
            PillBarChart(bars: bars(summit), height: 230)
            Text(isLive
                 ? "Live forecast at \(Fmt.grouped(summit.altitude)) m · updated \((summit.updated ?? .now).formatted(.relative(presentation: .named))) · pull to refresh"
                 : "Sample forecast · check a mountain forecast before you commit")
                .font(.sf(12))
                .foregroundStyle(Color.textFaint)
        }
        .glassCard()

        GlassList {
            ListRow("Leave high camp", meta: "Headlamps on · \(Fmt.grouped(summit.highCamp)) m") {
                IconTile(symbol: "flashlight.on.fill", color: Tile.indigo)
            } trailing: {
                timeMenu(Binding(get: { trip.adventure?.summit?.leaveTime ?? "" }, set: { trip.adventure?.summit?.leaveTime = $0 })) {
                    Text(summit.leaveTime).font(.mono(16, .semibold)).foregroundStyle(.white)
                }
            }
            ListRow("Turnaround time", meta: "Head down by then, summit or not") {
                IconTile(symbol: "mountain.2.fill", color: Tile.red)
            } trailing: {
                timeMenu(Binding(get: { trip.adventure?.summit?.turnaround ?? "" }, set: { trip.adventure?.summit?.turnaround = $0 })) {
                    Text(summit.turnaround)
                        .font(.mono(14, .bold))
                        .foregroundStyle(Color.lime)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 4).frame(minHeight: 36)
                        .background(Capsule().fill(Color.lime.opacity(0.14)))
                }
            }
        }
    }

    private func timeMenu<L: View>(_ selection: Binding<String>, @ViewBuilder label: () -> L) -> some View {
        Menu {
            Picker("Time", selection: selection) {
                ForEach(times, id: \.self) { Text($0) }
            }
        } label: {
            label()
        }
    }

    private func bars(_ summit: Summit) -> [PillBar] {
        let inTrip = isLive ? summit.forecast.filter { summitDays.contains($0.date) } : summit.forecast
        let window = summit.window(in: inTrip)
        let windowIDs = Set(window.map(\.id))
        let firstWindow = window.first?.id
        // Live: the trip's summit days if the forecast reaches them, else the next 8 days.
        let shown = isLive ? Array((inTrip.isEmpty ? summit.forecast : inTrip).prefix(8)) : summit.forecast
        return shown.enumerated().map { i, day in
            PillBar(
                id: i,
                value: Double(day.kmh),
                label: "\(day.kmh)",
                badge: Fmt.weekdayLetter(day.date),
                style: windowIDs.contains(day.id) ? .highlight : day.kmh > 40 ? .danger : .normal,
                callout: day.id == firstWindow ? "Lower wind" : nil
            )
        }
    }

    private func windowTitle(_ window: [WindDay]) -> String {
        guard let first = window.first, let last = window.last else { return "No calm window" }
        let a = "\(Fmt.weekday(first.date)) \(Fmt.dayNumber(first.date))"
        if first.id == last.id { return a }
        return "\(a) – \(Fmt.weekday(last.date)) \(Fmt.dayNumber(last.date))"
    }

    private func windowMeta(_ window: [WindDay], _ summit: Summit) -> String {
        let speeds = window.map(\.kmh)
        guard let lo = speeds.min(), let hi = speeds.max() else { return "Wind stays above \(summit.calmLimit) km/h" }
        let dawn = window.first.flatMap { summit.dawnTemps?[$0.id] } ?? summit.dawnTemp
        return "Wind \(lo == hi ? "\(lo)" : "\(lo)–\(hi)") km/h · \(dawn)°C at dawn"
    }
}

/// Peak, heights and times for a climb.
struct SummitEditor: View {
    @Binding var trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var peak = ""
    @State private var altitude = ""
    @State private var highCamp = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Peak, like Island Peak", text: $peak)
                    TextField("Summit height (m)", text: $altitude).keyboardType(.numberPad)
                    TextField("High camp height (m)", text: $highCamp).keyboardType(.numberPad)
                } footer: {
                    Text(campProblem ?? "The wind is read from the forecast at the summit's height, for the early hours of each day.")
                        .foregroundStyle(campProblem == nil ? Color.textMuted : Color.coral)
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Summit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!valid)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .onAppear {
            let summit = trip.adventure?.summit
            // The highest named stage, else the destination ("Stok Kangri, India" → "Stok Kangri").
            let highest = trip.stages.filter { $0.altitude > 0 }.max { $0.altitude < $1.altitude }
            peak = summit?.peak
                ?? highest.map { $0.title.components(separatedBy: "→").last?.trimmingCharacters(in: .whitespaces) ?? "" }
                ?? WeatherService.shortName(trip.place)
            let height: Int? = summit?.altitude ?? trip.maxAltitude
            altitude = height.map { $0 > 0 ? String($0) : "" } ?? ""
            highCamp = summit.map { String($0.highCamp) } ?? ""
        }
    }

    /// High camp is optional, but if given it must sit below the summit.
    private var campProblem: String? {
        guard let camp = Int(highCamp), !highCamp.isEmpty else { return nil }
        let summit = Int(altitude) ?? 0
        if camp < 1000 { return "High camp looks too low: \(camp) m." }
        if summit > 0, camp >= summit { return "High camp should be below the summit." }
        return nil
    }

    private var valid: Bool {
        !peak.trimmingCharacters(in: .whitespaces).isEmpty && (Int(altitude) ?? 0) >= 1000 && (Int(altitude) ?? 0) <= 8849 && campProblem == nil
    }

    private func save() {
        let height = Int(altitude) ?? 0
        let camp = Int(highCamp) ?? max(height - 600, 0)
        if trip.adventure == nil { trip.adventure = Adventure() }
        let name = peak.trimmingCharacters(in: .whitespaces)
        if var summit = trip.adventure?.summit {
            let moved = summit.peak != name || summit.altitude != height
            summit.peak = name
            summit.altitude = height
            summit.highCamp = camp
            if moved { summit.updated = nil; summit.forecast = []; summit.dawnTemps = nil }
            trip.adventure?.summit = summit
        } else {
            trip.adventure?.summit = Summit(peak: name, altitude: height, forecast: [], dawnTemp: 0, leaveTime: "02:00", highCamp: camp, turnaround: "11:00")
        }
        dismiss()
    }
}
