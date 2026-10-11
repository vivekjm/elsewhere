import SwiftUI

/// L4. The stylist builds a capsule from your wardrobe and the season, then
/// an outfit for each day. Gaps (like a rain layer) are flagged.
struct StylistView: View {
    @Binding var trip: Trip
    @Environment(TripStore.self) private var store
    @State private var shuffle = 0
    @State private var editing: Outfit?
    @Environment(\.zoomNamespace) private var zoomNamespace

    var body: some View {
        let capsule = store.wardrobe.filter { trip.capsule.contains($0.id) }
        let weather = Stylist.weather(for: trip)
        let grams = capsule.reduce(0) { $0 + $1.grams }

        NightScreen(photo: trip.photo, spacing: 12, title: "Capsule") {
            ScreenHeader(
                title: "Capsule for \(city)",
                meta: capsule.isEmpty ? "Clothes for every day, from your wardrobe" : "\(Fmt.count(capsule.count, "piece")) → \(Fmt.count(max(Stylist.combinations(capsule), Set(trip.outfits.map(\.items)).count), "outfit")) · \(Fmt.weightValue(Double(grams) / 1000)) \(Fmt.weightUnit)",
                eyebrow: "AI stylist",
                size: 34
            )
            .padding(.top, 8)

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    ForEach(weather) { day in
                        VStack(spacing: 6) {
                            Text(Fmt.weekdayLetter(day.date)).font(.mono(11)).foregroundStyle(Color.textMuted)
                            Image(systemName: symbol(day.sky))
                                .font(.system(size: 18))
                                .foregroundStyle(color(day.sky))
                                .frame(height: 20)
                            Text("\(day.high)°").font(.mono(13, .semibold)).foregroundStyle(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .accessibilityElement(children: .combine)
                    }
                }
                Text(weatherNote(weather))
                    .font(.sf(12))
                    .foregroundStyle(Color.textFaint)
                    .frame(maxWidth: .infinity)
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 8)
            .glass(28)

            VStack(alignment: .leading, spacing: 12) {
                SectionLabel(capsule.isEmpty ? "No capsule yet" : "Pack these \(capsule.count)")
                if capsule.isEmpty {
                    Text(store.wardrobe.isEmpty ? "Add clothes in Wardrobe first, then build a capsule here." : "Pick the pieces yourself in Wardrobe, or let the stylist choose from what you own.")
                        .font(.sf(14))
                        .foregroundStyle(Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    if !store.wardrobe.isEmpty {
                        Button("Build a capsule for me") { buildCapsule() }
                            .buttonStyle(LimePillStyle(height: 40))
                    }
                } else {
                    HStack(spacing: 8) {
                        ForEach(capsule) { item in
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color(hex: item.color))
                                .frame(maxWidth: 44)
                                .frame(height: 36)
                                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.white.opacity(0.12), lineWidth: 1))
                                .accessibilityLabel(item.name)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .glassCard(padding: 14)

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ForEach(trip.outfits.sorted { $0.day < $1.day }) { outfit in
                    let pieces = outfit.items.compactMap { store.wardrobeItem($0) }
                    Button { editing = outfit } label: {
                        VStack(alignment: .leading, spacing: 0) {
                            SwatchStack(colors: pieces.map { Color(hex: $0.color) })
                            Text("\(Fmt.weekday(trip.date(ofDay: outfit.day), timeZone: trip.timeZone)) · \(outfit.title)")
                                .font(.sf(15, .semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                                .padding(.top, 12)
                            Text(pieces.map { $0.name.split(separator: " ").last.map(String.init) ?? $0.name }.joined(separator: " · "))
                                .metaStyle(11)
                                .padding(.top, 3)
                        }
                        .glassCard(padding: 14)
                    }
                    .buttonStyle(.card)
                    .zoomSource("outfit-\(outfit.id)", radius: 28)
                    .transition(.scale(scale: 0.9).combined(with: .opacity))
                }
            }

            if let gap = gapItem(capsule: capsule, weather: weather) {
                GlassList {
                    ListRow(gap.name, meta: gap.reason) {
                        RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(hex: 0xC9CFD6)).frame(width: 44, height: 44)
                    } trailing: {
                        Button("Add") {
                            trip.packing.append(PackItem(name: gap.name, section: "Clothes", meta: "Stylist gap", grams: 300))
                        }
                        .buttonStyle(LimePillStyle())
                        .disabled(trip.packing.contains { $0.name == gap.name })
                        .opacity(trip.packing.contains { $0.name == gap.name } ? 0.5 : 1)
                    }
                }
            }
        }
        .toolbar(.hidden, for: .tabBar)
        .task(id: trip.start) { WeatherService.shared.prefetch(trip) }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    shuffle += 1
                    withAnimation(Motion.snappy) {
                        trip.outfits = Stylist.outfits(for: trip, wardrobe: store.wardrobe, shuffle: shuffle)
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles").foregroundStyle(Color.lime)
                        Text("Restyle")
                    }
                    .font(.sf(15, .semibold))
                    .padding(.horizontal, 6)
                }
                .disabled(trip.capsule.isEmpty)
            }
        }
        .sheet(item: $editing) { outfit in
            OutfitEditor(trip: $trip, outfitID: outfit.id)
                .zoomTransition("outfit-\(outfit.id)", in: zoomNamespace)
        }
        .onAppear {
            if trip.outfits.isEmpty, !trip.capsule.isEmpty {
                trip.outfits = Stylist.outfits(for: trip, wardrobe: store.wardrobe)
            }
        }
    }

    private var city: String { trip.place.split(separator: ",").first.map(String.init) ?? trip.name }

    /// Picks a small capsule from the wardrobe, adds it to packing, and
    /// builds an outfit for each day.
    private func buildCapsule() {
        let quotas: [GarmentCategory: Int] = [.tops: 3, .bottoms: 2, .dresses: 1, .shoes: 1, .layers: 2]
        var picked: [WardrobeItem] = []
        for (category, count) in quotas {
            picked += store.wardrobe.filter { $0.category == category }.sorted { $0.worn > $1.worn }.prefix(count)
        }
        withAnimation(Motion.snappy) {
            trip.capsule = picked.map(\.id)
            for item in picked where !trip.packing.contains(where: { $0.wardrobeID == item.id }) {
                trip.packing.append(PackItem(name: item.name, section: "Clothes", meta: "\(item.category.title) · from wardrobe", grams: item.grams, wardrobeID: item.id))
            }
            trip.outfits = Stylist.outfits(for: trip, wardrobe: store.wardrobe)
        }
    }

    private func weatherNote(_ weather: [Stylist.DayWeather]) -> String {
        if weather.allSatisfy(\.live) { return "Live forecast" }
        if weather.allSatisfy(\.lastYear) { return "Last year's weather on these dates · live forecast from 16 days out" }
        if weather.contains(where: \.live) { return "Live forecast, then last year's weather on later dates" }
        return "Typical for the season · live forecast from 16 days out"
    }

    private func symbol(_ sky: Stylist.Sky) -> String {
        switch sky {
        case .sun: "sun.max"
        case .cloud: "cloud"
        case .rain: "cloud.rain"
        case .snow: "snowflake"
        }
    }

    private func color(_ sky: Stylist.Sky) -> Color {
        switch sky {
        case .sun: .sun
        case .cloud: .white.opacity(0.8)
        case .rain, .snow: .sky
        }
    }

    private func gapItem(capsule: [WardrobeItem], weather: [Stylist.DayWeather]) -> (name: String, reason: String)? {
        if let wet = weather.first(where: { $0.sky == .rain }),
           !capsule.contains(where: { $0.category == .layers && $0.name.lowercased().contains("rain") }) {
            return ("Light rain jacket", "Rain likely on \(wet.date.formatted(.dateTime.weekday(.wide))) · not in capsule")
        }
        if weather.contains(where: { $0.high < 12 }), !capsule.contains(where: { $0.category == .layers }) {
            return ("Warm layer", "Cool evenings · not in capsule")
        }
        return nil
    }
}

struct OutfitEditor: View {
    @Binding var trip: Trip
    let outfitID: UUID
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private func edit(_ change: (inout Outfit) -> Void) {
        if let i = trip.outfits.firstIndex(where: { $0.id == outfitID }) { change(&trip.outfits[i]) }
    }

    var body: some View {
        NavigationStack {
            // By ID, never a captured index: a sync can remove the outfit
            // while this editor is open.
            if let outfit = trip.outfits.first(where: { $0.id == outfitID }) {
                Form {
                    Section {
                        TextField("Title", text: Binding(
                            get: { trip.outfits.first { $0.id == outfitID }?.title ?? "" },
                            set: { title in edit { $0.title = title } }
                        ))
                    }
                    Section("Pieces") {
                        ForEach(store.wardrobe) { item in
                            let on = outfit.items.contains(item.id)
                            Button {
                                edit { if on { $0.items.removeAll { $0 == item.id } } else { $0.items.append(item.id) } }
                            } label: {
                                HStack(spacing: 12) {
                                    Swatch(color: Color(hex: item.color), size: 28, radius: 9)
                                    Text(item.name).foregroundStyle(.white)
                                    Spacer()
                                    if on { Image(systemName: "checkmark").foregroundStyle(Color.lime) }
                                }
                            }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
                .scrollDismissesKeyboard(.interactively)
                .navigationTitle("Day \(outfit.day + 1) outfit")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                }
            }
        }
        .presentationBackground { SheetGlass(photo: trip.photo) }
    }
}
