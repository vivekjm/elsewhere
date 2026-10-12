import PhotosUI
import SwiftUI

/// What the trip's "…" menu has asked to show. Owned by the trip screen, not
/// the toolbar: toolbar content is rebuilt (a new cover photo does it) and
/// would drop a sheet it was about to present.
@Observable
final class TripActions {
    /// One sheet at a time, through a single presenter, so choosing another
    /// action while a sheet is closing still opens it.
    enum Sheet: Identifiable {
        case edit, share(URL), invite, importing
        var id: String {
            switch self {
            case .edit: "edit"
            case .share(let url): "share-\(url.path(percentEncoded: false))"
            case .invite: "invite"
            case .importing: "import"
            }
        }
    }
    var sheet: Sheet?
    var confirmDelete = false
    var liveError: String?
    var paywall = false
}

/// The "…" menu on a trip's first tab.
struct TripActionsMenu: View {
    @Binding var trip: Trip
    var actions: TripActions
    @Environment(TripStore.self) private var store

    var body: some View {
        Menu {
            Button("Edit trip", systemImage: "pencil") { actions.sheet = .edit }
            Button("Add bookings", systemImage: "tray.and.arrow.down") { actions.sheet = .importing }
            Button("Export to calendar", systemImage: "calendar.badge.plus") {
                do { actions.sheet = .share(try TripExports.calendarFile(trip)) }
                catch { actions.liveError = error.localizedDescription }
            }
            Button("Invite people", systemImage: "person.badge.plus") { actions.sheet = .invite }
            Button("Itinerary PDF", systemImage: "doc.richtext") {
                if store.profile.isPro {
                    if let url = ItineraryPDF.make(trip) { actions.sheet = .share(url) }
                } else {
                    actions.paywall = true
                }
            }
            if trip.kind.isAdventure, !trip.stages.isEmpty {
                Button("Show trail day on Lock Screen", systemImage: "mountain.2") {
                    do { try LiveActivities.startTrail(trip: trip) } catch { actions.liveError = error.localizedDescription }
                }
            }
            if LiveActivities.isRunning {
                Button("End Live Activities", systemImage: "xmark.circle") { Task { await LiveActivities.endAll() } }
            }
            Divider()
            Button("Delete trip", systemImage: "trash", role: .destructive) { actions.confirmDelete = true }
        } label: {
            Image(systemName: "ellipsis")
        }
        .accessibilityLabel("Trip options")
    }
}

extension View {
    /// The sheets and dialogs behind the trip's "…" menu.
    func tripActions(trip: Binding<Trip>, _ actions: TripActions) -> some View {
        modifier(TripActionSheets(trip: trip, actions: actions))
    }
}

private struct TripActionSheets: ViewModifier {
    @Binding var trip: Trip
    @Bindable var actions: TripActions
    @Environment(TripStore.self) private var store

    func body(content: Content) -> some View {
        content
            .sheet(item: $actions.sheet) { sheet in
                switch sheet {
                case .edit: TripEditSheet(trip: $trip)
                case .share(let url): ShareSheet(items: [url]).presentationDetents([.medium, .large])
                case .invite: InviteShareSheet(trip: trip)
                case .importing: ImportBookingsView(tripID: trip.id)
                }
            }
            .fullScreenCover(isPresented: $actions.paywall) { PaywallView(reason: .export) }
            .confirmationDialog("Delete \(trip.name)?", isPresented: $actions.confirmDelete, titleVisibility: .visible) {
                Button("Delete trip", role: .destructive) { store.delete(trip.id) }
            } message: {
                Text(store.deleteTripMessage)
            }
            .alert("Live Activity", isPresented: Binding(get: { actions.liveError != nil }, set: { if !$0 { actions.liveError = nil } })) {
                Button("OK") {}
            } message: {
                Text(actions.liveError ?? "")
            }
    }
}

struct IdentifiedURL: Identifiable {
    let url: URL
    var id: URL { url }
}

/// The system share sheet, for files made on the spot.
struct ShareSheet: UIViewControllerRepresentable {
    var items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        // Sharing closes the system sheet; close the SwiftUI sheet holding it
        // too, or it comes back on the next redraw.
        let dismiss = context.environment.dismiss
        controller.completionWithItemsHandler = { _, _, _, _ in dismiss() }
        return controller
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

struct TripEditSheet: View {
    @Binding var trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var draft: Trip
    @State private var confirmShorten = false
    @State private var convertAmounts = true
    @State private var newPerson = ""
    @FocusState private var personFocused: Bool
    @State private var coverItem: PhotosPickerItem?
    /// A newly picked cover, written to disk only on Save.
    @State private var newCover: Data?
    @State private var removeCover = false
    @State private var choosingTimeZone = false

    private func addPerson() {
        let name = newPerson.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, name != Trip.me, !draft.companions.contains(where: { $0.name == name }) else { return }
        let palette: [UInt32] = [0xC77A12, 0x2E8B4A, 0x7A2FA0, 0x127C8C, 0xC0392B, 0x4636E8, 0x8A6A3E]
        draft.companions.append(Person(name: name, color: palette[draft.companions.count % palette.count]))
        draft.travellers = max(draft.travellers, draft.companions.count + 1)
        newPerson = ""
    }

    init(trip: Binding<Trip>) {
        _trip = trip
        _draft = State(initialValue: trip.wrappedValue)
    }

    /// Plans and outfits on days the shorter trip no longer has.
    private var dropped: (plans: Int, other: Int) {
        let plans = draft.plans.filter { $0.day >= draft.dayCount }.count
        let other = draft.outfits.filter { $0.day >= draft.dayCount }.count
            + draft.stops.filter { $0.day >= draft.dayCount }.count
            + draft.dives.filter { $0.day >= draft.dayCount }.count
            + draft.stages.filter { $0.day > draft.dayCount }.count
        return (plans, other)
    }

    private var currencyChanged: Bool { draft.currency != trip.currency }
    private var rate: Double? {
        guard let from = CurrencyService.code(for: trip.currency), let to = CurrencyService.code(for: draft.currency) else { return nil }
        return CurrencyService.shared.rate(from: from, to: to)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Trip name", text: $draft.name)
                    TextField("Destination", text: $draft.place)
                }
                Section {
                    DatePicker("Starts", selection: $draft.start, displayedComponents: .date).environment(\.timeZone, draft.timeZone)
                    Button("Time zone: \(draft.timeZoneID ?? TimeZone.current.identifier)") { choosingTimeZone = true }
                    Stepper("\(draft.dayCount) days", value: $draft.dayCount, in: 1...60)
                    Stepper("\(draft.travellers) \(draft.travellers == 1 ? "traveller" : "travellers")", value: $draft.travellers, in: 1...20)
                }
                Section {
                    ForEach(draft.companions) { person in
                        HStack(spacing: 10) {
                            Avatar(initials: person.initials, color: Color(hex: person.color), size: 28)
                            Text(person.name)
                        }
                    }
                    .onDelete { draft.companions.remove(atOffsets: $0) }
                    HStack {
                        TextField("Add someone by name", text: $newPerson)
                            .focused($personFocused)
                            .submitLabel(.next)
                            .onSubmit {
                                addPerson()
                                // Stay in the field to add the next person.
                                personFocused = true
                            }
                        if !newPerson.trimmingCharacters(in: .whitespaces).isEmpty {
                            Button("Add", action: addPerson)
                        }
                    }
                } header: {
                    Text("Travelling with")
                } footer: {
                    Text("Split costs and vote on plans with them in the Shared tab.")
                }
                Section {
                    NumberRow("Budget (\(draft.currency))", value: $draft.budgetLimit)
                    Picker("Currency", selection: $draft.currency) {
                        ForEach(Array(Set(Locale.commonISOCurrencyCodes + [draft.currency])).sorted(), id: \.self) { code in
                            Text("\(code) · \(Locale.current.localizedString(forCurrencyCode: code) ?? code)").tag(code)
                        }
                    }
                    if currencyChanged, let rate {
                        Toggle("Convert amounts at today's rate", isOn: $convertAmounts)
                            .tint(.lime)
                        if convertAmounts {
                            Text("1 \(trip.currency) = \(String(format: rate < 10 ? "%.3f" : "%.1f", rate)) \(draft.currency)")
                                .font(.sf(13))
                                .foregroundStyle(Color.textMuted)
                        }
                    } else if currencyChanged {
                        // Without a rate the amounts can't be converted; say so
                        // rather than quietly relabelling €100 as ¥100.
                        Text("Today's rate isn't available yet, so amounts keep their numbers in \(draft.currency). Connect to the internet to convert them.")
                            .font(.sf(13))
                            .foregroundStyle(Color.coral)
                    }
                } header: {
                    Text("Budget")
                } footer: {
                    Text("Leave at 0 for no limit.")
                }
                Section {
                    let custom = newCover.flatMap(UIImage.init(data:)) ?? (removeCover ? nil : CoverStore.shared.image(draft.coverFile))
                    if let custom {
                        Image(uiImage: custom)
                            .resizable()
                            .scaledToFill()
                            .frame(height: 140)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    }
                    PhotosPicker(selection: $coverItem, matching: .images) {
                        Label(custom == nil ? "Use your own photo" : "Choose another photo", systemImage: "photo")
                    }
                    if custom != nil {
                        Button("Remove photo", role: .destructive) {
                            newCover = nil
                            removeCover = true
                        }
                    } else {
                        Picker("Stock photo", selection: $draft.photo) {
                            ForEach(Photo.allCases) { photo in
                                Text(photoName(photo)).tag(photo)
                            }
                        }
                    }
                } header: {
                    Text("Cover")
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Edit trip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let lost = dropped
                        if lost.plans + lost.other > 0 { confirmShorten = true } else { save(moveToLastDay: false) }
                    }
                    .disabled(draft.name.trimmingCharacters(in: .whitespaces).isEmpty || draft.name.count > 200 || draft.place.count > 200 || !draft.budgetLimit.isFinite || !(0...10_000_000).contains(draft.budgetLimit))
                }
            }
        }
        .presentationBackground { SheetGlass(photo: draft.photo) }
        .onChange(of: coverItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), UIImage(data: data) != nil {
                    newCover = data
                    removeCover = false
                }
                coverItem = nil
            }
        }
        .sheet(isPresented: $choosingTimeZone) {
            TimeZonePicker(identifier: Binding(get: { draft.timeZoneID ?? TimeZone.current.identifier }, set: { draft.setTimeZone($0) }))
        }
        .confirmationDialog(
            "\(Fmt.count(dropped.plans + dropped.other, "item")) on days after day \(draft.dayCount)",
            isPresented: $confirmShorten,
            titleVisibility: .visible
        ) {
            Button("Move to day \(draft.dayCount)") { save(moveToLastDay: true) }
            Button("Delete them", role: .destructive) { save(moveToLastDay: false) }
        } message: {
            Text("The trip is shorter now. Keep those plans on the last day, or delete them.")
        }
    }

    private func save(moveToLastDay: Bool) {
        let last = draft.dayCount - 1
        draft.start = draft.calendar.startOfDay(for: draft.start)
        draft.startDayKey = TravelDates.key(draft.start, in: draft.timeZone)
        draft.fitToLength(movingLaterDays: moveToLastDay)
        for i in draft.expenses.indices where (draft.expenses[i].day ?? 0) > last {
            draft.expenses[i].day = nil
        }
        // "5 days in Kerala" follows the new length; names people typed stay.
        if draft.dayCount != trip.dayCount, draft.name == trip.name,
           let match = trip.name.firstMatch(of: /^(\d+) days in (.+)$/), Int(match.1) == trip.dayCount {
            draft.name = draft.dayCount >= 7 && trip.dayCount < 7 ? "A week in \(match.2)" : "\(draft.dayCount) days in \(match.2)"
        }
        if currencyChanged, convertAmounts, let rate {
            draft.budgetLimit = Fmt.roundedCurrency(draft.budgetLimit * rate, draft.currency)
            for i in draft.plans.indices { draft.plans[i].cost = Fmt.roundedCurrency(draft.plans[i].cost * rate, draft.currency) }
            for i in draft.expenses.indices { draft.expenses[i].amount = Fmt.roundedCurrency(draft.expenses[i].amount * rate, draft.currency) }
            for i in draft.balances.indices { draft.balances[i].amount = Fmt.roundedCurrency(draft.balances[i].amount * rate, draft.currency) }
            if draft.settlements != nil {
                for i in draft.settlements!.indices { draft.settlements![i].amount = Fmt.roundedCurrency(draft.settlements![i].amount * rate, draft.currency) }
            }
            for i in draft.gear.indices { draft.gear[i].rentPerDay = draft.gear[i].rentPerDay.map { Int((Double($0) * rate).rounded()) } }
            if let dayRate = draft.adventure?.guide?.dayRate { draft.adventure?.guide?.dayRate = Int((Double(dayRate) * rate).rounded()) }
            if let permits = draft.adventure?.permits {
                draft.adventure?.permits = permits.map { var p = $0; p.fee = p.fee.map { Fmt.roundedCurrency($0 * rate, draft.currency) }; return p }
            }
        }
        if let newCover, let file = CoverStore.shared.save(newCover, for: draft.id) {
            draft.coverFile = file
            draft.coverRemote = nil
        } else if removeCover {
            CoverStore.shared.delete(draft.coverFile)
            draft.coverFile = nil
            draft.coverRemote = nil
        }
        trip = draft
        dismiss()
    }

    private func photoName(_ photo: Photo) -> String {
        switch photo {
        case .lisbon: "City streets"
        case .himalaya: "Mountains"
        case .aurora: "Night sky"
        case .tram: "Tram"
        case .beach: "Beach"
        }
    }
}

/// Flight details with the Live Activity button (C13).
struct TicketSheet: View {
    @Binding var trip: Trip
    let planID: UUID
    @Environment(\.dismiss) private var dismiss
    @State private var message: String?

    private var index: Int? { trip.plans.firstIndex { $0.id == planID } }

    var body: some View {
        NavigationStack {
            if let index, let flight = trip.plans[index].flight {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 10) {
                        IconTile(symbol: "airplane", color: Tile.indigo)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(flight.number) → \(flight.destination)").font(.sf(18, .bold))
                            Text(Fmt.dayTitle(trip.date(ofDay: trip.plans[index].day), timeZone: trip.timeZone)).metaStyle()
                        }
                        Spacer()
                        Chip(flight.status, tone: .tint(flight.status.lowercased() == "on time" ? .mint : .coral))
                    }
                    HStack(alignment: .bottom) {
                        editable("Boards", text: binding(\.boards), alignment: .leading)
                        editable("Gate", text: binding(\.gate), alignment: .center)
                        editable("Seat", text: binding(\.seat), alignment: .trailing)
                    }
                    .glassCard()

                    Button("Show on Lock Screen") {
                        do {
                            try LiveActivities.startFlight(flight, plan: trip.plans[index], trip: trip)
                            message = "Added to your Lock Screen and Dynamic Island."
                        } catch {
                            message = error.localizedDescription
                        }
                    }
                    .buttonStyle(CTAStyle())

                    if let message {
                        Text(message).font(.sf(14)).foregroundStyle(Color.textMuted)
                    }
                    Spacer()
                }
                .foregroundStyle(.white)
                .padding(16)
                .navigationTitle("Ticket")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground { SheetGlass(photo: trip.photo) }
    }

    /// By ID: a sync can remove the plan while this sheet is open.
    private func binding(_ key: WritableKeyPath<FlightInfo, String>) -> Binding<String> {
        Binding(
            get: { trip.plans.first { $0.id == planID }?.flight?[keyPath: key] ?? "" },
            set: { value in
                if let i = trip.plans.firstIndex(where: { $0.id == planID }) { trip.plans[i].flight?[keyPath: key] = value.uppercased() }
            }
        )
    }

    private func editable(_ label: String, text: Binding<String>, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 4) {
            SectionLabel(label)
            TextField(label, text: text)
                .font(.mono(26, .semibold))
                .multilineTextAlignment(alignment == .leading ? .leading : alignment == .center ? .center : .trailing)
                .textInputAutocapitalization(.characters)
        }
        .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .bottom))
    }
}

/// Add or edit a plan.
struct PlanEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    var planID: UUID?
    var defaultDay: Int
    @Environment(\.dismiss) private var dismiss
    @State private var plan: Plan
    @State private var time: Date
    /// Once the person picks a type or time, typing no longer changes it.
    @State private var pickedCategory = false
    @State private var pickedTime = false

    init(trip: Binding<Trip>, planID: UUID?, defaultDay: Int) {
        _trip = trip
        self.planID = planID
        self.defaultDay = defaultDay
        let existing = planID.flatMap { id in trip.wrappedValue.plans.first { $0.id == id } }
        // A new plan starts 90 minutes after the day's last one.
        let lastTime = trip.wrappedValue.plans(on: defaultDay).last?.time
        let defaultTime: String = lastTime.flatMap { t -> String? in
            let p = t.split(separator: ":").compactMap { Int($0) }
            guard p.count == 2 else { return nil }
            let minutes = min(p[0] * 60 + p[1] + 90, 22 * 60)
            return String(format: "%02d:%02d", minutes / 60, (minutes % 60) / 30 * 30)
        } ?? "09:00"
        let plan = existing ?? Plan(day: defaultDay, time: defaultTime, title: "", category: .sight, addedAt: .now)
        _plan = State(initialValue: plan)
        let parts = (TravelDates.clock(plan.time) ?? defaultTime).split(separator: ":").compactMap { Int($0) }
        _time = State(initialValue: Calendar.current.date(bySettingHour: parts.first ?? 10, minute: parts.last ?? 0, second: 0, of: .now) ?? .now)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What's the plan?", text: $plan.title)
                    .focused($firstFieldFocused)
                    TextField("Where · details", text: $plan.meta)
                }
                Section {
                    Picker("Day", selection: $plan.day) {
                        ForEach(trip.dayIndices, id: \.self) { d in
                            Text("Day \(d + 1) · \(Fmt.dayTitle(trip.date(ofDay: d), timeZone: trip.timeZone))").tag(d)
                        }
                    }
                    DatePicker("Time", selection: Binding(get: { time }, set: { time = $0; pickedTime = true }), displayedComponents: .hourAndMinute)
                    Picker("Type", selection: Binding(get: { plan.category }, set: { plan.category = $0; pickedCategory = true })) {
                        ForEach(PlanCategory.allCases) { category in
                            Label(category.title, systemImage: category.symbol).tag(category)
                        }
                    }
                }
                if plan.category == .flight {
                    Section {
                        TextField("Flight number, like 6E 2451", text: flightField(\.number))
                            .textInputAutocapitalization(.characters)
                        TextField("To", text: flightField(\.destination))
                        TextField("Seat", text: flightField(\.seat))
                            .textInputAutocapitalization(.characters)
                    } header: {
                        Text("Flight")
                    } footer: {
                        Text("Adds a boarding pass with gate and seat, and a Live Activity on the day.")
                    }
                }
                Section {
                    NumberRow("Cost (\(trip.currency))", value: $plan.cost)
                    NumberRow("On foot (\(Fmt.distanceUnit))", value: $plan.walkKm.inDistanceUnits)
                }
                Section("Notes") {
                    TextField("Booking codes, reminders", text: $plan.notes, axis: .vertical)
                        .lineLimit(2...6)
                }
                if planID != nil {
                    Section {
                        Button("Delete plan", role: .destructive) {
                            trip.plans.removeAll { $0.id == planID }
                            dismiss()
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(planID == nil ? "New plan" : "Edit plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(plan.title.trimmingCharacters(in: .whitespaces).isEmpty || plan.title.count > 200
                                  || !plan.cost.isFinite || !(0...10_000_000).contains(plan.cost)
                                  || !plan.walkKm.isFinite || !(0...1000).contains(plan.walkKm))
                }
            }
        }
        .autofocus($firstFieldFocused, when: planID == nil)
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .onChange(of: plan.title) { _, title in
            // "Dinner at …" becomes Food at 19:30 until the person picks otherwise.
            guard planID == nil else { return }
            if !pickedCategory, let guess = PlanCategory.guess(from: title) { plan.category = guess }
            if !pickedTime, let typical = PlanCategory.guess(from: title)?.typicalTime(for: title) {
                let p = typical.split(separator: ":").compactMap { Int($0) }
                if p.count == 2, let date = Calendar.current.date(bySettingHour: p[0], minute: p[1], second: 0, of: time) { time = date }
            }
        }
    }

    private func flightField(_ key: WritableKeyPath<FlightInfo, String>) -> Binding<String> {
        Binding(
            get: { plan.flight?[keyPath: key] ?? "" },
            set: { value in
                if plan.flight == nil { plan.flight = FlightInfo(number: "", destination: "", boards: "TBC", gate: "TBC", seat: "TBC") }
                plan.flight?[keyPath: key] = key == \FlightInfo.destination ? value : value.uppercased()
            }
        )
    }

    private func save() {
        // Stored as "HH:mm" whatever the phone's clock style; shown localised.
        let parts = Calendar.current.dateComponents([.hour, .minute], from: time)
        plan.time = String(format: "%02d:%02d", parts.hour ?? 9, parts.minute ?? 0)
        if plan.category == .flight, var flight = plan.flight {
            flight.boards = plan.time
            if flight.seat.isEmpty { flight.seat = "TBC" }
            if flight.destination.isEmpty { flight.destination = trip.place }
            plan.flight = flight.number.trimmingCharacters(in: .whitespaces).isEmpty ? nil : flight
            if plan.flight != nil { plan.action = "Ticket" }
        } else if plan.category != .flight {
            plan.flight = nil
            if plan.action == "Ticket" { plan.action = nil }
        }
        if let index = trip.plans.firstIndex(where: { $0.id == plan.id }) {
            trip.plans[index] = plan
        } else {
            trip.plans.append(plan)
        }
        dismiss()
    }
}
