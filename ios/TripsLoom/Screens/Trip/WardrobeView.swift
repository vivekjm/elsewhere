import PhotosUI
import SwiftUI

/// L5. Filter pills with the active one in lime, and glass item cards with a
/// corner ↗ button.
struct WardrobeView: View {
    @Binding var trip: Trip
    @Environment(TripStore.self) private var store
    @State private var filter: GarmentCategory?
    @State private var selected: WardrobeItem?
    @State private var adding = false
    @Environment(\.zoomNamespace) private var zoomNamespace
    @Environment(\.dynamicTypeSize) private var textSize

    var body: some View {
        let items = store.wardrobe.filter { filter == nil || $0.category == filter }
        NightScreen(photo: trip.photo, spacing: 12, title: "Wardrobe") {
            ScreenHeader(title: "Wardrobe", meta: "\(Fmt.count(store.wardrobe.count, "piece")) · \(trip.capsule.count) for \(city)")

            FilterPills(
                options: [(GarmentCategory?.none, "All")] + GarmentCategory.allCases.map { (Optional($0), $0.title) },
                selection: $filter
            )

            if items.isEmpty {
                EmptyNote(title: "No \(filter?.title.lowercased() ?? "pieces") yet", message: "Add clothes with the plus button to build outfits.")
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: textSize.isAccessibilitySize ? 1 : 2), spacing: 10) {
                ForEach(items) { item in
                    Button { selected = item } label: {
                        GarmentCard(item: item, tripLabel: trip.capsule.contains(item.id) ? city : nil)
                    }
                    .buttonStyle(.card)
                    .accessibilityLabel("\(item.name), \(item.category.title), worn \(item.worn) times")
                    .zoomSource("garment-\(item.id)", radius: 24)
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: StylistRoute()) { Image(systemName: "sparkles") }
                    .accessibilityLabel("AI stylist")
            }
            ToolbarSpacer(.fixed, placement: .topBarTrailing)
            ToolbarItem(placement: .topBarTrailing) {
                LimeToolbarButton(symbol: "plus", label: "Add piece") { adding = true }
            }
        }
        .navigationDestination(for: StylistRoute.self) { _ in StylistView(trip: $trip) }
        .sheet(item: $selected) { item in
            GarmentSheet(itemID: item.id, trip: $trip)
                .zoomTransition("garment-\(item.id)", in: zoomNamespace)
        }
        .sheet(isPresented: $adding) { GarmentEditor() }
    }

    private var city: String {
        trip.place.split(separator: ",").first.map(String.init) ?? trip.name
    }
}

struct GarmentCard: View {
    var item: WardrobeItem
    var tripLabel: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            GarmentImage(item: item)
                .frame(height: 130)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
                .overlay(alignment: .topTrailing) {
                    CornerArrow()
                        .background(Circle().fill(Color.ink.opacity(item.isLight && item.imageFile == nil ? 0.35 : 0)))
                        .padding(8)
                }
                .overlay(alignment: .topLeading) {
                    if let tripLabel { Chip(tripLabel, tone: .onPhoto(.lime)).padding(8) }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name).font(.sf(15, .semibold)).foregroundStyle(.white).lineLimit(2)
                Text("\(item.category.title) · worn \(item.worn)×").metaStyle(11)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 6)
        }
        .padding(8)
        .glass(24)
        .contentShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

struct GarmentImage: View {
    var item: WardrobeItem
    var body: some View {
        Color(hex: item.color)
        .overlay {
            if let image = WardrobePhotos.image(item.imageFile) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Image(systemName: item.category.symbol)
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(item.isLight ? Color.ink.opacity(0.5) : Color.white.opacity(0.75))
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

/// Detail for one piece: pack it for this trip, count wears, delete.
struct GarmentSheet: View {
    let itemID: UUID
    @Binding var trip: Trip
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var confirmDelete = false
    @State private var editing = false

    var body: some View {
        NavigationStack {
            // Looked up by ID, never by index: the piece can be deleted (here
            // or by a sync) while this sheet is still on screen.
            if let item = store.wardrobe.first(where: { $0.id == itemID }) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        GarmentImage(item: item)
                            .frame(height: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                        GlassList {
                            Toggle(isOn: Binding(get: { trip.capsule.contains(itemID) }, set: { setPacked($0, item: item) })) {
                                ListRow("Pack for \(trip.name)", meta: "Adds it to the packing list")
                            }
                            .toggleStyle(LimeToggleStyle())
                            ListRow("Worn", meta: "Times worn on trips") {} trailing: {
                                PillStepper(value: Binding(
                                    get: { store.wardrobe.first { $0.id == itemID }?.worn ?? 0 },
                                    set: { worn in
                                        if let i = store.wardrobe.firstIndex(where: { $0.id == itemID }) { store.wardrobe[i].worn = worn }
                                    }
                                ), range: 0...999)
                            }
                            ListRow("Category") {} trailing: {
                                Text(item.category.title).font(.mono(15, .semibold)).foregroundStyle(.white)
                            }
                        }
                        Button("Edit piece") { editing = true }.buttonStyle(GlassPillStyle())
                        Button("Delete piece", role: .destructive) { confirmDelete = true }
                        .foregroundStyle(Color.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)
                    }
                    .padding(Metrics.gutter)
                }
                .confirmationDialog("Delete \(item.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                    Button("Delete piece", role: .destructive) {
                        dismiss()
                        store.deleteWardrobeItem(itemID)
                    }
                } message: {
                    Text(store.hasAccount
                         ? "It comes out of your wardrobe, outfits and packing lists, here and on tripsloom.com."
                         : "It comes out of your wardrobe, outfits and packing lists.")
                }
                .navigationTitle(item.name)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .sheet(isPresented: $editing) {
            if let item = store.wardrobe.first(where: { $0.id == itemID }) { GarmentEditor(existing: item) }
        }
        .presentationBackground { SheetGlass(photo: trip.photo) }
    }

    private func setPacked(_ on: Bool, item: WardrobeItem) {
        if on {
            trip.capsule.append(item.id)
            if !trip.packing.contains(where: { $0.wardrobeID == item.id }) {
                trip.packing.append(PackItem(name: item.name, section: "Clothes", meta: "\(item.category.title) · from wardrobe", grams: item.grams, wardrobeID: item.id))
            }
        } else {
            trip.capsule.removeAll { $0 == item.id }
            trip.packing.removeAll { $0.wardrobeID == item.id }
        }
    }
}

struct GarmentEditor: View {
    var existing: WardrobeItem?
    @FocusState private var firstFieldFocused: Bool
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var category: GarmentCategory = .tops
    @State private var color = Color(hex: 0xE8DCC4)
    @State private var grams = 300
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var error: String?

    init(existing: WardrobeItem? = nil) {
        self.existing = existing
        _name = State(initialValue: existing?.name ?? "")
        _category = State(initialValue: existing?.category ?? .tops)
        _color = State(initialValue: Color(hex: existing?.color ?? 0xE8DCC4))
        _grams = State(initialValue: existing?.grams ?? 300)
    }

    var body: some View {
        let swatch = color
        let preview = photoData.flatMap(UIImage.init(data:)) ?? WardrobePhotos.image(existing?.imageFile)
        NavigationStack {
            Form {
                Section {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        HStack(spacing: 12) {
                            ZStack {
                                swatch
                                if let preview {
                                    Image(uiImage: preview).resizable().scaledToFill()
                                }
                            }
                            .frame(width: 56, height: 56)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            Text(preview == nil ? "Add a photo" : "Change photo")
                        }
                    }
                    TextField("Name", text: $name)
                    .focused($firstFieldFocused)
                    Picker("Category", selection: $category) {
                        ForEach(GarmentCategory.allCases) { Text($0.title).tag($0) }
                    }
                    ColorPicker("Colour", selection: $color, supportsOpacity: false)
                    NumberRow("Weight (\(Fmt.itemWeightUnit))", value: $grams.inItemWeightUnits)
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(existing == nil ? "Add piece" : "Edit piece")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(existing == nil ? "Add" : "Save") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || name.count > 200 || !(0...50_000).contains(grams))
                }
            }
            .onChange(of: photoItem) { _, item in
                Task { photoData = try? await item?.loadTransferable(type: Data.self) }
            }
        }
        .autofocus($firstFieldFocused, when: true)
        .alert("Photo could not be saved", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("OK") { error = nil }
        } message: { Text(error ?? "") }
        .presentationBackground(Color(hex: 0x12141A, opacity: 0.94))
    }

    private func save() {
        var item = existing ?? WardrobeItem(name: "", category: category, color: color.hexValue)
        item.name = name.trimmingCharacters(in: .whitespacesAndNewlines); item.category = category
        item.color = color.hexValue; item.grams = grams
        if let photoData {
            // A new filename keeps cancellation and a failed save from replacing the old image.
            guard let file = WardrobePhotos.save(photoData, for: UUID()) else { error = "Choose a valid photo and check available storage."; return }
            item.imageFile = file; item.remotePhoto = nil
        }
        if let i = store.wardrobe.firstIndex(where: { $0.id == item.id }) {
            store.wardrobe[i] = item
            for ti in store.trips.indices {
                for pi in store.trips[ti].packing.indices where store.trips[ti].packing[pi].wardrobeID == item.id {
                    store.trips[ti].packing[pi].name = item.name; store.trips[ti].packing[pi].grams = item.grams
                }
            }
        } else if existing == nil { store.wardrobe.append(item) }
        dismiss()
    }
}

extension WardrobeItem {
    /// True for pale colours, where white glyphs need a darker backing.
    var isLight: Bool {
        let r = Double((color >> 16) & 0xFF), g = Double((color >> 8) & 0xFF), b = Double(color & 0xFF)
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7
    }
}

extension Color {
    var hexValue: UInt32 {
        let ui = UIColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        ui.getRed(&r, green: &g, blue: &b, alpha: &a)
        func c(_ v: CGFloat) -> UInt32 { UInt32(max(0, min(255, (v * 255).rounded()))) }
        return (c(r) << 16) | (c(g) << 8) | c(b)
    }
}
