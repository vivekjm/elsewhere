import StoreKit
import SwiftUI

/// L3. Big mono numbers, a lime progress ring and a weight bar. Lime check
/// circles, and a glass Pack button on each row.
struct PackingView: View {
    @Binding var trip: Trip
    @Environment(TripStore.self) private var store
    @State private var filter: Filter = .all
    @State private var adding = false
    @State private var suggesting = false
    @State private var editing: PackItem?
    @State private var editingLimit = false
    @State private var confirmUnpack = false

    enum Filter: Hashable { case toPack, all, packed }

    private let sectionOrder = ["Clothes", "Essentials", "Toiletries"]
    @State private var celebrate = false
    @State private var pulse = false
    @Environment(\.requestReview) private var requestReview
    /// Asked at most once per app version, and only on a real trip.
    @AppStorage("review.askedVersion") private var reviewAskedVersion = ""

    private var allPacked: Bool { !trip.packing.isEmpty && trip.packedCount == trip.packing.count }

    var body: some View {
        NightScreen(photo: trip.photo, spacing: 12, title: "Packing") {
            ScreenHeader(title: "Packing", meta: trip.name)

            summary

            PillSegmented(
                options: [
                    (.toPack, "To pack · \(trip.packing.count - trip.packedCount)"),
                    (.all, "All"),
                    (.packed, "Packed · \(trip.packedCount)"),
                ],
                selection: $filter
            )

            let items = trip.packing.filter { item in
                switch filter {
                case .toPack: !item.packed
                case .all: true
                case .packed: item.packed
                }
            }

            if trip.packing.isEmpty {
                EmptyNote(title: "Nothing to pack yet", message: "Add items with the plus button, or let suggestions start the list.")
            } else if items.isEmpty {
                EmptyNote(title: filter == .toPack ? "All packed" : "Nothing packed yet", message: filter == .toPack ? "Every item is in the bag." : "Tick items as they go in the bag.")
            }

            ForEach(sections(of: items), id: \.self) { section in
                GlassList(section) {
                    ForEach(items.filter { $0.section == section }) { item in
                        PackRow(item: item) { toggle(item) }
                            .contextMenu {
                                Button("Edit", systemImage: "pencil") { editing = item }
                                Button(item.required ? "Not required" : "Mark required", systemImage: "exclamationmark.circle") {
                                    update(item) { $0.required.toggle() }
                                }
                                Button("Delete", systemImage: "trash", role: .destructive) {
                                    withAnimation { trip.packing.removeAll { $0.id == item.id } }
                                }
                            }
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Suggest items", systemImage: "sparkles") { suggesting = true }
                    Button("Bag limit", systemImage: "scalemass") { editingLimit = true }
                    if trip.packedCount > 0 {
                        Button("Unpack all", systemImage: "arrow.uturn.backward") { confirmUnpack = true }
                    }
                } label: { Image(systemName: "ellipsis") }
                    .accessibilityLabel("More")
            }
            ToolbarSpacer(.fixed, placement: .topBarTrailing)
            ToolbarItem(placement: .topBarTrailing) {
                LimeToolbarButton(symbol: "plus", label: "Add item") { adding = true }
            }
        }
        .sensoryFeedback(.success, trigger: allPacked) { _, new in new }
        .onChange(of: allPacked) { _, done in
            guard done else { celebrate = false; return }
            pulse = false
            withAnimation(.spring(duration: 0.4, bounce: 0.6)) { celebrate = true }
            withAnimation(.easeOut(duration: 0.9)) { pulse = true }
            Task {
                try? await Task.sleep(for: .milliseconds(450))
                withAnimation(.spring(duration: 0.5)) { celebrate = false }
                // A good moment to ask: everything is packed.
                let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1"
                if trip.isSample != true, trip.packing.count >= 8, reviewAskedVersion != version {
                    try? await Task.sleep(for: .seconds(1.2))
                    reviewAskedVersion = version
                    requestReview()
                }
            }
        }
        .sheet(isPresented: $adding) { PackItemEditor(trip: $trip, item: PackItem(name: "", section: "Clothes"), isNew: true) }
        .sheet(item: $editing) { PackItemEditor(trip: $trip, item: $0, isNew: false) }
        .sheet(isPresented: $editingLimit) { BagLimitEditor(trip: $trip) }
        .confirmationDialog("Unpack all \(trip.packedCount) items?", isPresented: $confirmUnpack, titleVisibility: .visible) {
            Button("Unpack all", role: .destructive) {
                withAnimation(Motion.snappy) { for i in trip.packing.indices { trip.packing[i].packed = false } }
            }
        } message: {
            Text("Handy for the trip home. Your list stays as it is.")
        }
        .sheet(isPresented: $suggesting) { PackingSuggestionsSheet(trip: $trip) }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    MonoAmount(whole: "\(trip.packedCount)", fraction: "/\(trip.packing.count)", size: 44)
                    Text(allPacked ? "All packed" : "items packed")
                        .font(.sf(14, allPacked ? .semibold : .regular))
                        .foregroundStyle(allPacked ? Color.lime : Color.textMuted)
                        .contentTransition(.opacity)
                }
                Spacer()
                ZStack {
                    // A lime pulse when the last item goes in the bag.
                    Circle()
                        .stroke(Color.lime, lineWidth: 2)
                        .frame(width: 70, height: 70)
                        .scaleEffect(pulse ? 1.7 : 1)
                        .opacity(pulse ? 0 : (celebrate ? 0.9 : 0))
                    ProgressRing(progress: trip.packedFraction, size: 70, lineWidth: 6) {
                        if allPacked {
                            Image(systemName: "checkmark")
                                .font(.system(size: 22, weight: .heavy))
                                .foregroundStyle(Color.lime)
                                .transition(.scale.combined(with: .opacity))
                        } else {
                            Text("\(Int((trip.packedFraction * 100).rounded()))%").font(.mono(16, .bold)).foregroundStyle(.white)
                        }
                    }
                    .scaleEffect(celebrate ? 1.08 : 1)
                }
            }
            Button { editingLimit = true } label: {
            HStack {
                Text("Bag weight").font(.sf(14, .semibold)).foregroundStyle(.white)
                Spacer()
                Text("\(Fmt.weightValue(trip.bagWeightKg)) / \(Fmt.weightValue(trip.bagLimitKg).replacingOccurrences(of: ".0", with: "")) \(Fmt.weightUnit)")
                    .font(.mono(13))
                    .foregroundStyle(trip.bagWeightKg > trip.bagLimitKg ? Color.coral : .white)
                Image(systemName: "pencil").font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.textFaint)
            }
            .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Changes the bag limit")
            .padding(.top, 16)
            ProgressBar(value: trip.bagWeightKg / max(trip.bagLimitKg, 1), color: trip.bagWeightKg > trip.bagLimitKg ? .coral : .lime)
                .padding(.top, 8)
        }
        .glassCard()
        .accessibilityElement(children: .combine)
    }

    private func sections(of items: [PackItem]) -> [String] {
        let present = Set(items.map(\.section))
        return sectionOrder.filter(present.contains) + present.subtracting(sectionOrder).sorted()
    }

    private func toggle(_ item: PackItem) {
        update(item) { $0.packed.toggle() }
    }

    private func update(_ item: PackItem, _ change: (inout PackItem) -> Void) {
        guard let i = trip.packing.firstIndex(where: { $0.id == item.id }) else { return }
        withAnimation(Motion.snappy) { change(&trip.packing[i]) }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

struct PackRow: View {
    var item: PackItem
    var toggle: () -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // At accessibility text sizes the name gets the full width; the whole
        // row still packs on tap, so only the Required chip stays, underneath.
        let large = typeSize.isAccessibilitySize
        HStack(spacing: 12) {
            Button(action: toggle) { CheckCircle(isOn: item.packed) }
                .buttonStyle(.plain)
                .accessibilityLabel(item.packed ? "Packed" : "Not packed")
            VStack(alignment: .leading, spacing: 3) {
                Group {
                    if large {
                        WordFittingTitle(text: item.name, size: 16, weight: .medium)
                    } else {
                        Text(item.name).font(.sf(16, .medium)).lineLimit(2)
                    }
                }
                    .foregroundStyle(item.packed ? Color.textMuted : .white)
                Text(meta).metaStyle()
                if large && !item.packed && item.required {
                    Chip("Required", tone: .tint(.coral)).padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if !item.packed && !large {
                if item.required {
                    Chip("Required", tone: .tint(.coral))
                } else {
                    Button("Pack", action: toggle).buttonStyle(GlassPillStyle())
                }
            }
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .onTapGesture(perform: toggle)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityValue(item.packed ? "Packed" : "Not packed")
    }

    private var meta: String {
        [item.meta, item.grams > 0 ? Fmt.kg(item.grams) : nil].compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: " · ")
    }
}

struct PackItemEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    @State var item: PackItem
    var isNew: Bool
    @Environment(\.dismiss) private var dismiss

    private var sections: [String] {
        let base = ["Clothes", "Essentials", "Toiletries", "Tech", "Documents"]
        return base.contains(item.section) ? base : base + [item.section]
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Item", text: $item.name)
                    .focused($firstFieldFocused)
                Picker("Section", selection: $item.section) {
                    ForEach(sections, id: \.self) { Text($0) }
                }
                TextField("Note, e.g. 2 pairs", text: $item.meta)
                NumberRow("Weight (\(Fmt.itemWeightUnit))", value: $item.grams.inItemWeightUnits)
                Toggle("Required", isOn: $item.required)
                if !isNew {
                    Toggle("Packed", isOn: $item.packed)
                    Button("Delete item", role: .destructive) {
                        trip.packing.removeAll { $0.id == item.id }
                        dismiss()
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isNew ? "Add item" : "Edit item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNew ? "Add" : "Save") {
                        item.name = item.name.trimmingCharacters(in: .whitespacesAndNewlines)
                        item.meta = item.meta.trimmingCharacters(in: .whitespacesAndNewlines)
                        if let i = trip.packing.firstIndex(where: { $0.id == item.id }) { trip.packing[i] = item } else { trip.packing.append(item) }
                        dismiss()
                    }
                    .disabled(item.name.trimmingCharacters(in: .whitespaces).isEmpty || item.name.count > 200 || item.meta.count > 200 || !(0...1_000_000).contains(item.grams))
                }
            }
        }
        .autofocus($firstFieldFocused, when: isNew)
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium, .large])
    }
}

/// The bag's weight allowance, in the user's units.
struct BagLimitEditor: View {
    @Binding var trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var limit: Double

    init(trip: Binding<Trip>) {
        _trip = trip
        _limit = State(initialValue: trip.wrappedValue.bagLimitKg)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    NumberRow("Limit (\(Fmt.weightUnit))", value: $limit.inWeightUnits)
                } footer: {
                    Text("Check your airline's allowance. Cabin bags are often 7–10 kg, checked bags 20–23 kg.")
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Bag limit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { trip.bagLimitKg = limit; dismiss() }
                        .disabled(!limit.isFinite || !(0.5...1000).contains(limit))
                }
            }
        }
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium])
    }
}

struct PackingSuggestionsSheet: View {
    @Binding var trip: Trip
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var picked: Set<UUID> = []
    @State private var suggestions: [PackItem] = []

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Based on a \(trip.dayCount)-day \(trip.kind.title.lowercased()) and your wardrobe.")
                        .font(.sf(14))
                        .foregroundStyle(Color.textMuted)
                        .padding(.horizontal, 4)
                    if suggestions.isEmpty {
                        EmptyNote(title: "Nothing missing", message: "Your list already covers the basics for this trip.")
                    } else {
                        GlassList {
                            ForEach(suggestions) { item in
                                Button {
                                    if picked.contains(item.id) { picked.remove(item.id) } else { picked.insert(item.id) }
                                } label: {
                                    ListRow(item.name, meta: item.meta) {
                                        CheckCircle(isOn: picked.contains(item.id))
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(Metrics.gutter)
            }
            .navigationTitle("Suggestions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add \(picked.count)") {
                        let added = suggestions.filter { picked.contains($0.id) }
                        trip.packing.append(contentsOf: added)
                        for id in added.compactMap(\.wardrobeID) where !trip.capsule.contains(id) {
                            trip.capsule.append(id)
                        }
                        dismiss()
                    }
                    .disabled(picked.isEmpty)
                }
            }
            .onAppear {
                suggestions = PackingSuggestions.missing(for: trip, wardrobe: store.wardrobe)
                picked = Set(suggestions.map(\.id))
            }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground { SheetGlass(photo: trip.photo) }
    }
}
