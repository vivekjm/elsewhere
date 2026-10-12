import SwiftUI

/// A2. Gear replaces Wardrobe in trek mode. A stacked weight bar tracks the
/// porter limit; Rent marks an item as rented at the trailhead.
struct GearView: View {
    @Binding var trip: Trip
    @Environment(\.dynamicTypeSize) private var dynamicType
    @State private var filter: GearStatus = .need
    @State private var adding = false
    @State private var editing: GearItem?
    @State private var editingLimit = false

    var body: some View {
        let items = trip.gear.filter { $0.status == filter }
        NightScreen(photo: trip.photo, spacing: 12, title: "Gear") {
            ScreenHeader(title: "Gear", meta: "\(shortPlace) · \(month) · \(Fmt.count(trip.gear.count, "item"))")

            porterCard

            PillSegmented(
                options: GearStatus.allCases.map { status in (status, "\(status.title) · \(trip.gear.filter { $0.status == status }.count)") },
                selection: $filter
            )

            if items.isEmpty {
                EmptyNote(title: "Nothing here", message: filter == .need ? "Everything you need is owned or rented." : "Items you mark as \(filter.title.lowercased()) appear here.")
            }

            ForEach(GearGroup.allCases.filter { group in items.contains { $0.group == group } }) { group in
                GlassList(group.title) {
                    ForEach(items.filter { $0.group == group }) { item in
                        GearRow(item: item, currency: trip.currency) {
                            update(item) { $0.packed.toggle() }
                        } rent: {
                            update(item) { $0.status = .rent }
                        }
                        .contextMenu {
                            Button("Edit", systemImage: "pencil") { editing = item }
                            ForEach(GearStatus.allCases.filter { $0 != item.status }) { status in
                                Button("Move to \(status.title)") { update(item) { $0.status = status } }
                            }
                            Button("Delete", systemImage: "trash", role: .destructive) {
                                withAnimation { trip.gear.removeAll { $0.id == item.id } }
                            }
                        }
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                LimeToolbarButton(symbol: "plus", label: "Add gear") { adding = true }
            }
        }
        .sheet(isPresented: $adding) { GearEditor(trip: $trip, item: GearItem(name: "", group: .layers, grams: 300, status: filter), isNew: true) }
        .sheet(item: $editing) { GearEditor(trip: $trip, item: $0, isNew: false) }
        .sheet(isPresented: $editingLimit) { PorterLimitEditor(trip: $trip) }
    }

    private var shortPlace: String { trip.place.split(separator: ",").first.map(String.init) ?? trip.name }
    private var month: String {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("MMMM")
        return f.string(from: trip.start)
    }

    private var porterCard: some View {
        let byGroup = Dictionary(grouping: trip.gear, by: \.group).mapValues { $0.reduce(0) { $0 + $1.grams } }
        let total = Double(trip.gear.reduce(0) { $0 + $1.grams }) / 1000
        let limit = trip.porterLimitKg
        let over = total > limit
        let shown = GearGroup.allCases.filter { (byGroup[$0] ?? 0) > 0 }
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Porter bag").font(.sf(15, .semibold)).foregroundStyle(.white)
                Spacer()
                Chip(over ? "Over limit" : "Under limit", tone: .tint(over ? .coral : .mint))
                Button { editingLimit = true } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.textMuted)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Change porter limit")
            }
            MonoAmount(whole: Fmt.weightValue(total), fraction: " / \(Fmt.weightValue(limit).replacingOccurrences(of: ".0", with: "")) \(Fmt.weightUnit)", size: 36)
                .padding(.top, 8)
            GeometryReader { geo in
                HStack(spacing: 3) {
                    ForEach(shown) { group in
                        Capsule()
                            .fill(group.color)
                            .frame(width: max(4, (geo.size.width - CGFloat(shown.count) * 3) * CGFloat(byGroup[group] ?? 0) / 1000 / max(limit, total)))
                    }
                    if !over {
                        StripeTrack(radius: 5, opacity: 0.12)
                            .background(Capsule().fill(Color.white.opacity(0.04)))
                            .clipShape(Capsule())
                    }
                }
            }
            .frame(height: 10)
            .padding(.top, 12)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: dynamicType.isAccessibilitySize ? 1 : 2), alignment: .leading, spacing: 8) {
                ForEach(shown) { group in
                    Text("● \(group.short) \(Fmt.weightValue(Double(byGroup[group] ?? 0) / 1000))")
                        .foregroundStyle(group == .sleep ? Color.textMuted : group.color)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .font(.mono(11))
            .textCase(.uppercase)
            .padding(.top, 10)
        }
        .glassCard()
        .accessibilityElement(children: .contain)
    }

    private func update(_ item: GearItem, _ change: (inout GearItem) -> Void) {
        guard let i = trip.gear.firstIndex(where: { $0.id == item.id }) else { return }
        withAnimation(Motion.snappy) { change(&trip.gear[i]) }
    }
}

struct GearRow: View {
    var item: GearItem
    var currency: String
    var toggle: () -> Void
    var rent: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: toggle) { CheckCircle(isOn: item.packed) }
                .buttonStyle(.plain)
                .accessibilityLabel(item.packed ? "Packed" : "Not packed")
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name).font(.sf(16, .medium)).foregroundStyle(.white).lineLimit(1)
                Text(item.note.isEmpty ? "\(item.group.short) · \(Fmt.kg(item.grams))" : item.note).metaStyle()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if item.required && !item.packed {
                Chip("Required", tone: .tint(.coral))
            } else if item.status == .need, let rate = item.rentPerDay {
                Button("Rent \(Fmt.moneyShort(Double(rate), currency))/d", action: rent).buttonStyle(GlassPillStyle())
            } else if item.status == .rent {
                Chip("Renting", tone: .tint(.apricot))
            }
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .onTapGesture(perform: toggle)
    }
}

struct GearEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    @State var item: GearItem
    var isNew: Bool
    @Environment(\.dismiss) private var dismiss

    private var rentRate: Binding<Double> {
        Binding(get: { Double(item.rentPerDay ?? 0) },
                set: { item.rentPerDay = $0.isFinite && $0 >= 0 && $0 < 1e7 ? ($0 == 0 ? nil : Int($0.rounded())) : -1 })
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Item", text: $item.name)
                        .focused($firstFieldFocused)
                    Picker("Group", selection: $item.group) {
                        ForEach(GearGroup.allCases) { Text($0.title).tag($0) }
                    }
                    Picker("Status", selection: $item.status) {
                        ForEach(GearStatus.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    NumberRow("Weight (\(Fmt.itemWeightUnit))", value: $item.grams.inItemWeightUnits)
                    Toggle("Required", isOn: $item.required)
                }
                Section {
                    NumberRow("Rent per day (\(trip.currency))", value: rentRate, decimals: false)
                    TextField("Note, e.g. rent in Yuksom", text: $item.note)
                } footer: {
                    Text("Rented gear counts toward the trip budget for every day of the trip.")
                }
                if !isNew {
                    Toggle("Packed", isOn: $item.packed)
                    Button("Delete item", role: .destructive) {
                        trip.gear.removeAll { $0.id == item.id }
                        dismiss()
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isNew ? "Add gear" : "Edit gear")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNew ? "Add" : "Save") {
                        item.name = item.name.trimmingCharacters(in: .whitespacesAndNewlines)
                        if let i = trip.gear.firstIndex(where: { $0.id == item.id }) { trip.gear[i] = item } else { trip.gear.append(item) }
                        dismiss()
                    }
                    .disabled(item.name.trimmingCharacters(in: .whitespaces).isEmpty || item.name.count > 200 || item.note.count > 200
                              || !(0...1_000_000).contains(item.grams) || (item.rentPerDay ?? 0) < 0)
                }
            }
        }
        .autofocus($firstFieldFocused, when: isNew)
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium, .large])
    }
}

/// What the porter (or your own pack) can carry, in the user's units.
struct PorterLimitEditor: View {
    @Binding var trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var limit: Double

    init(trip: Binding<Trip>) {
        _trip = trip
        _limit = State(initialValue: trip.wrappedValue.porterLimitKg)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    NumberRow("Limit (\(Fmt.weightUnit))", value: $limit.inWeightUnits)
                } footer: {
                    Text("Porters on Himalayan and Andean treks usually carry 15–20 kg each; a pack you carry yourself is often 8–12 kg.")
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Porter limit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { trip.porterLimitKg = limit; dismiss() }
                        .disabled(!limit.isFinite || !(0.5...1000).contains(limit))
                }
            }
        }
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium])
    }
}
