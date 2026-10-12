import PhotosUI
import SwiftUI

/// C5 → C8. Pick the trip type (which picks the tab bar), then fill in the
/// details in a glass sheet. Saving opens the new trip.
struct NewTripFlow: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(TripStore.self) private var store
    @State private var kind: TripKind = .trek
    @State private var showForm = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ScreenHeader(title: "What kind\nof trip?", size: 34)
                        .padding(.top, 8)

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(TripKind.allCases) { option in
                            Button { withAnimation(Motion.snappy) { kind = option } } label: {
                                KindCard(kind: option, selected: option == kind)
                            }
                            .buttonStyle(.card)
                            .accessibilityIdentifier("trip-kind-\(option.rawValue)")
                            .accessibilityLabel(option.title)
                            .accessibilityAddTraits(option == kind ? .isSelected : [])
                        }
                    }

                    SectionLabel("Your tabs for this trip")
                        .padding(.top, 2)
                    TabPreview(tabs: kind.tabs)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.bottom, 110)
            }
            .scrollIndicators(.hidden)
            .background { PhotoBackdrop(photo: kind.defaultPhoto) }
            .safeAreaInset(edge: .bottom) {
                Button("Continue") { showForm = true }
                    .buttonStyle(CTAStyle())
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.bottom, 8)
            }
            .navigationTitle("New trip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                }
            }
            .sheet(isPresented: $showForm) {
                NewTripForm(kind: kind) { trip in
                    store.add(trip)
                    dismiss()
                    Task {
                        try? await Task.sleep(for: .milliseconds(350))
                        store.open(trip.id)
                    }
                }
            }
        }
    }
}

private struct KindCard: View {
    var kind: TripKind
    var selected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            IconTile(symbol: kind.symbol, color: kind.tile)
            VStack(alignment: .leading, spacing: 3) {
                Text(kind.title).font(.sf(16, .semibold)).foregroundStyle(.white)
                Text(kind.hint).metaStyle(11)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glass(24)
        .overlay {
            if selected {
                RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Color.lime, lineWidth: 2)
            }
        }
        .overlay(alignment: .topTrailing) {
            if selected {
                CheckCircle(isOn: true).padding(12)
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

/// A static copy of the floating tab bar, so the choice is visible before
/// continuing.
struct TabPreview: View {
    var tabs: [TripTab]

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 0) {
                ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                    VStack(spacing: 3) {
                        Image(systemName: tab.symbol).font(.system(size: 19))
                        Text(tab.title).font(.sf(10, index == 0 ? .semibold : .medium))
                    }
                    .foregroundStyle(index == 0 ? Color.white : Color.textMuted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background {
                        if index == 0 {
                            Capsule().fill(Color.white.opacity(0.15)).overlay(TopHighlight(shape: Capsule()))
                        }
                    }
                }
            }
            .padding(5)
            .frame(height: 64)
            .glassCapsule(fill: Color(hex: 0x1C1E24, opacity: 0.55))
            Image(systemName: "magnifyingglass")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 64, height: 64)
                .glassCapsule(fill: Color(hex: 0x1C1E24, opacity: 0.55))
        }
        .accessibilityElement()
        .accessibilityLabel("Tabs: \(tabs.map(\.title).joined(separator: ", "))")
        .animation(Motion.snappy, value: tabs)
    }
}

/// C8. Glass rows, mono date pills, a stepper, a lime switch, and a cover
/// photo with a lime ring.
struct NewTripForm: View {
    var kind: TripKind
    var onSave: (Trip) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(TripStore.self) private var store
    @State private var name = ""
    @State private var place = ""
    @State private var start = Calendar.current.date(byAdding: .day, value: 14, to: .now) ?? .now
    @State private var end = Calendar.current.date(byAdding: .day, value: 17, to: .now) ?? .now
    @State private var travellers = 2
    @State private var suggestPacking = true
    @State private var photo: Photo
    @State private var coverItem: PhotosPickerItem?
    @State private var coverData: Data?
    @State private var editingDate: DateField?
    @FocusState private var focus: Field?

    enum Field { case name, place }
    enum DateField: Identifiable { case start, end; var id: Self { self } }

    init(kind: TripKind, onSave: @escaping (Trip) -> Void) {
        self.kind = kind
        self.onSave = onSave
        _photo = State(initialValue: kind.defaultPhoto)
    }

    private var canSave: Bool {
        let days = TravelDates.calendar().dateComponents([.day], from: TravelDates.calendar().startOfDay(for: start), to: TravelDates.calendar().startOfDay(for: end)).day ?? -1
        return !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && name.count <= 200
            && !place.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && place.count <= 200 && (0...365).contains(days)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    GlassList {
                        VStack(alignment: .leading, spacing: 3) {
                            TextField("Trip name", text: $name, prompt: Text("Weekend in Lisbon").foregroundStyle(Color.textFaint))
                                .accessibilityLabel("Trip name")
                                .font(.sf(16, .semibold))
                                .focused($focus, equals: .name)
                                .submitLabel(.next)
                                .onSubmit { focus = .place }
                            Text("Trip name").metaStyle()
                        }
                        .padding(.vertical, 12)

                        HStack(spacing: 12) {
                            IconTile(symbol: "mappin", color: Tile.teal, size: .medium)
                            VStack(alignment: .leading, spacing: 3) {
                                TextField("Destination", text: $place, prompt: Text("Lisbon, Portugal").foregroundStyle(Color.textFaint))
                                    .accessibilityLabel("Destination")
                                    .font(.sf(16, .semibold))
                                    .textContentType(.addressCity)
                                    .focused($focus, equals: .place)
                                    .submitLabel(.done)
                                Text("Destination").metaStyle()
                            }
                        }
                        .padding(.vertical, 12)
                    }

                    GlassList {
                        ListRow("Starts") {} trailing: {
                            Button { editingDate = .start } label: {
                                Text(Fmt.monthDay(start)).font(.mono(14, .semibold)).textCase(.uppercase)
                            }
                            .buttonStyle(GlassPillStyle(tint: .lime))
                        }
                        ListRow("Ends") {} trailing: {
                            Button { editingDate = .end } label: {
                                Text(Fmt.monthDay(end)).font(.mono(14, .semibold)).textCase(.uppercase)
                            }
                            .buttonStyle(GlassPillStyle(tint: end < start ? .coral : .white))
                        }
                        ListRow("Travellers") {} trailing: {
                            PillStepper(value: $travellers, range: 1...20)
                        }
                    }

                    GlassList {
                        Toggle(isOn: $suggestPacking) {
                            ListRow("Suggest a packing list", meta: kind.isAdventure ? "Gear for this trip type" : "From your wardrobe")
                        }
                        .toggleStyle(LimeToggleStyle())
                    }

                    SectionLabel("Cover")
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                        ForEach(Photo.allCases) { option in
                            Button {
                                withAnimation(Motion.snappy) { photo = option; coverData = nil; coverItem = nil }
                            } label: {
                                CoverTile(selected: coverData == nil && option == photo) {
                                    Color.photoPlaceholder.overlay { RemotePhoto(photo: option, width: 200) }
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Stock cover \(Photo.allCases.firstIndex(of: option).map { $0 + 1 } ?? 1)")
                            .accessibilityAddTraits(coverData == nil && option == photo ? .isSelected : [])
                        }
                        PhotosPicker(selection: $coverItem, matching: .images) {
                            CoverTile(selected: coverData != nil) {
                                if let coverData, let image = UIImage(data: coverData) {
                                    Image(uiImage: image).resizable().scaledToFill()
                                } else {
                                    ZStack {
                                        Color.white.opacity(0.08)
                                        VStack(spacing: 4) {
                                            Image(systemName: "photo.badge.plus").font(.system(size: 20, weight: .semibold))
                                            Text("Your photo").font(.sf(12, .semibold))
                                        }
                                        .foregroundStyle(.white)
                                    }
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(coverData == nil ? "Use your own photo" : "Your photo, selected. Choose another")
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("New trip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    LimeToolbarButton(symbol: "checkmark", label: "Create trip") { save() }
                        .disabled(!canSave)
                        .opacity(canSave ? 1 : 0.5)
                }
            }
            .sheet(item: $editingDate) { field in
                DatePickerSheet(date: field == .start ? $start : $end, title: field == .start ? "Starts" : "Ends", minimum: field == .end ? start : nil)
            }
            .onChange(of: start) { _, newStart in
                if end < newStart { end = Calendar.current.date(byAdding: .day, value: 3, to: newStart) ?? newStart }
            }
            .onAppear { focus = .name }
            .onChange(of: coverItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self), UIImage(data: data) != nil {
                        withAnimation(Motion.snappy) { coverData = data }
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(40)
        .presentationBackground { SheetGlass(photo: photo) }
    }

    private func save() {
        let startDay = TravelDates.calendar().startOfDay(for: start)
        let days = (TravelDates.calendar().dateComponents([.day], from: startDay, to: TravelDates.calendar().startOfDay(for: end)).day ?? 0) + 1
        guard canSave, (1...366).contains(days) else { return }
        var trip = Trip(
            name: name.trimmingCharacters(in: .whitespaces),
            place: place.trimmingCharacters(in: .whitespaces),
            kind: kind,
            start: startDay,
            dayCount: max(days, 1),
            travellers: travellers,
            photo: photo,
            currency: CurrencyService.home,
            budgetLimit: 0
        )
        trip.timeZoneID = TimeZone.current.identifier
        trip.startDayKey = TravelDates.key(startDay)
        if suggestPacking {
            trip.packing = PackingSuggestions.items(for: kind, days: days, wardrobe: store.wardrobe)
            trip.capsule = trip.packing.compactMap(\.wardrobeID)
            if kind.isAdventure { trip.gear = PackingSuggestions.gear(for: kind) }
        }
        if kind.isAdventure { trip.adventure = Adventure() }
        if let coverData, let file = CoverStore.shared.save(coverData, for: trip.id) { trip.coverFile = file }
        onSave(trip)
    }
}

/// The dark glass behind sheets: the photo, blurred, under a dark wash.
struct SheetGlass: View {
    var photo: Photo
    var body: some View {
        ZStack {
            PhotoBackdrop(photo: photo, top: 0.55, bottom: 0.9)
            Color(hex: 0x12141A, opacity: 0.5)
        }
    }
}

struct DatePickerSheet: View {
    @Binding var date: Date
    var title: String
    var minimum: Date?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            DatePicker(title, selection: $date, in: (minimum ?? .distantPast)..., displayedComponents: .date)
                .datePickerStyle(.graphical)
                .tint(.lime)
                .padding(.horizontal)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
        .presentationDetents([.medium])
    }
}

private struct CoverTile<Content: View>: View {
    var selected: Bool
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(height: 76)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .padding(2)
            .overlay {
                if selected {
                    RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color.lime, lineWidth: 2)
                }
            }
            .contentShape(Rectangle())
    }
}
