import SwiftUI

/// A6. Pushed from Trip in trek mode: permits, a guide and insurance.
struct BeforeYouGoView: View {
    @Binding var trip: Trip
    @Environment(\.openURL) private var openURL
    @State private var addingPermit = false
    @State private var editingPermit: Permit?
    @State private var editingGuide = false
    @State private var editingInsurance = false
    @State private var insuranceName = ""
    @State private var insuranceDetails = ""

    var body: some View {
        let adventure = trip.adventure ?? Adventure()
        NightScreen(photo: trip.photo, spacing: 14) {
            GlassList("Permits") {
                let pending = adventure.permits.filter { !$0.paid }.count
                if pending > 0 {
                    Chip("\(pending) pending", tone: .tint(.apricot))
                } else if !adventure.permits.isEmpty {
                    Chip("All paid", tone: .tint(.mint))
                }
            } content: {
                if adventure.permits.isEmpty {
                    Text("No permits added.")
                        .font(.sf(15))
                        .foregroundStyle(Color.textMuted)
                        .padding(.vertical, 14)
                }
                ForEach(adventure.permits) { permit in
                    ListRow(permit.name, meta: permit.meta) {
                        IconTile(symbol: "doc.text.fill", color: permit.paid ? Tile.green : Tile.amber)
                    } trailing: {
                        Button { setPaid(permit.id, !permit.paid) } label: { CheckCircle(isOn: permit.paid) }
                            .buttonStyle(.plain)
                            .accessibilityLabel(permit.paid ? "Paid" : "Mark as paid")
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { editingPermit = permit }
                    .accessibilityAction(named: "Edit") { editingPermit = permit }
                    .contextMenu {
                        Button("Edit", systemImage: "pencil") { editingPermit = permit }
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            withAnimation { trip.adventure?.permits.removeAll { $0.id == permit.id } }
                        }
                    }
                }
                Button { addingPermit = true } label: {
                    ListRow("Add a permit") {
                        IconTile(symbol: "plus", color: Color.white.opacity(0.12))
                    }
                }
                .buttonStyle(.plain)
            }

            GlassList("Guide") {
                Button { editingGuide = true } label: {
                    ListRow(adventure.guide?.name ?? "Add your guide", meta: adventure.guide.map {
                        "\(Fmt.moneyShort(Double($0.dayRate), trip.currency))/day · \($0.booked ? "Confirmed by you" : "Not confirmed")"
                    } ?? "Save details after arranging a guide independently") {
                        IconTile(symbol: "person.crop.circle", color: Tile.bronze)
                    } trailing: { CornerArrow() }
                }.buttonStyle(.plain)
            }
            GlassList("Travel insurance") {
                Button {
                    insuranceName = adventure.insurance
                    insuranceDetails = adventure.insuranceMeta
                    editingInsurance = true
                } label: {
                    ListRow(adventure.insurance.isEmpty ? "Add insurance details" : adventure.insurance,
                            meta: adventure.insuranceMeta.isEmpty ? "Provider, policy and assistance details" : adventure.insuranceMeta) {
                        IconTile(symbol: "shield.fill", color: Tile.red)
                    } trailing: { CornerArrow() }
                }.buttonStyle(.plain)
            }

        }
        .toolbar(.hidden, for: .tabBar)
        .navigationTitle("Before you go")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $editingGuide) { GuideDetailsEditor(trip: $trip) }
        .alert("Travel insurance", isPresented: $editingInsurance) {
            TextField("Provider or policy name", text: $insuranceName)
            TextField("Policy number and assistance contact", text: $insuranceDetails)
            Button("Save") {
                if trip.adventure == nil { trip.adventure = Adventure() }
                trip.adventure?.insurance = String(insuranceName.trimmingCharacters(in: .whitespaces).prefix(200))
                trip.adventure?.insuranceMeta = String(insuranceDetails.prefix(1000))
            }
            Button("Cancel", role: .cancel) { }
        } message: { Text("Check that your cover includes your destination, activities and altitude. These notes do not verify coverage.") }
        .sheet(isPresented: $addingPermit) { PermitEditor(trip: $trip, permit: Permit(name: "", meta: "Not paid", paid: false), isNew: true) }
        .sheet(item: $editingPermit) { PermitEditor(trip: $trip, permit: $0, isNew: false) }
    }

    private func setPaid(_ id: UUID, _ paid: Bool) {
        guard let i = trip.adventure?.permits.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(Motion.snappy) {
            trip.adventure?.permits[i].paid = paid
            if let meta = trip.adventure?.permits[i].meta {
                    trip.adventure?.permits[i].meta = PermitEditor.meta(notes: PermitEditor.notes(from: meta), paid: paid)
            }
        }
    }

    private func initials(_ name: String) -> String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined()
    }
}

/// Records a guide arranged elsewhere; Trips Loom does not make a reservation.
struct GuideDetailsEditor: View {
    @Binding var trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var dayRate: Int
    @State private var confirmed: Bool
    @State private var notes: String

    init(trip: Binding<Trip>) {
        _trip = trip
        let guide = trip.wrappedValue.adventure?.guide
        _name = State(initialValue: guide?.name ?? "")
        _dayRate = State(initialValue: guide?.dayRate ?? 0)
        _confirmed = State(initialValue: guide?.booked ?? false)
        _notes = State(initialValue: guide?.tags.joined(separator: " · ") ?? "")
    }
    var body: some View {
        NavigationStack {
            Form {
                TextField("Guide name", text: $name)
                NumberRow("Daily rate (\(trip.currency))", value: $dayRate)
                TextField("Contact and notes", text: $notes, axis: .vertical)
                Toggle("I have confirmed the arrangement", isOn: $confirmed)
                Section {
                    Text("Arrange and pay your guide independently. Saving these details does not contact the guide, verify credentials or make a booking. A confirmed guide's daily rate counts toward the trip budget.")
                        .font(.footnote)
                }
                if trip.adventure?.guide != nil {
                    Button("Remove guide", role: .destructive) {
                        trip.adventure?.guide = nil
                        dismiss()
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Guide details")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if trip.adventure == nil { trip.adventure = Adventure() }
                        trip.adventure?.guide = Guide(name: name.trimmingCharacters(in: .whitespaces), rating: 0, trips: 0,
                            tags: notes.isEmpty ? [] : [String(notes.prefix(1000))], dayRate: dayRate, booked: confirmed)
                        dismiss()
                    }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || name.count > 200 || !(0...10_000_000).contains(dayRate))
                }
            }
        }.presentationBackground { SheetGlass(photo: trip.photo) }
    }
}

/// A7. A plan counting down from the trek date. Numbers are entered by you.
struct TrainingView: View {
    @Binding var trip: Trip
    @State private var editing = false
    @State private var addingSession = false
    @State private var editingSession: TrainingSession?

    var body: some View {
        NightScreen(photo: trip.photo, top: 0.52, bottom: 0.87, spacing: 14, title: "Training") {
            ScreenHeader(title: "Ready for \(shortName)?", meta: countdown, size: 34)
                .padding(.top, 8)

            if let readiness = trip.adventure?.readiness {
                Button { editing = true } label: {
                    HStack(spacing: 18) {
                        ProgressRing(progress: Double(readiness.score) / 100, size: 110, lineWidth: 8) {
                            VStack(spacing: 4) {
                                Text("\(readiness.score)").font(.mono(32, .bold)).foregroundStyle(.white)
                                Text("readiness").font(.mono(11, .medium)).foregroundStyle(Color.textMuted)
                            }
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            metric("VO₂ max", value: "\(readiness.vo2)", change: readiness.vo2Change)
                            metric("Ascent/wk", value: "\(Fmt.grouped(readiness.ascentPerWeek)) m", change: readiness.ascentChange, suffix: "%")
                            metric("Long hike", value: "\(readiness.longHikeKm) km", change: 0, goal: "Goal \(readiness.longHikeGoal)")
                        }
                    }
                    .glassCard()
                }
                .buttonStyle(.plain)
                .accessibilityHint("Update your numbers")
            } else {
                EmptyNote(title: "No readiness yet", message: "Add your VO₂ max, weekly ascent and longest hike to see a score.")
                Button("Add my numbers") { editing = true }.buttonStyle(CTAStyle(kind: .glass))
            }

            let sessions = trip.adventure?.training ?? []
            GlassList("This week") {
                HStack(spacing: 8) {
                    if !sessions.isEmpty {
                        Chip("\(sessions.filter(\.done).count) / \(sessions.count)", tone: .solid)
                    }
                    Button { addingSession = true } label: { OutlinePlusLabel(text: "Add") }
                        .buttonStyle(OutlinePillStyle())
                        .accessibilityLabel("Add session")
                }
            } content: {
                if sessions.isEmpty {
                    Text("No sessions planned.")
                        .font(.sf(15))
                        .foregroundStyle(Color.textMuted)
                        .padding(.vertical, 14)
                }
                ForEach(sessions) { session in
                    Button { toggle(session.id) } label: {
                        ListRow(session.title, meta: session.meta) {
                            CheckCircle(isOn: session.done)
                        } trailing: {
                            if session.key { Chip("Key", tone: .tint(.lime)) }
                        }
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button("Edit", systemImage: "pencil") { editingSession = session }
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            withAnimation { trip.adventure?.training.removeAll { $0.id == session.id } }
                        }
                    }
                }
                if sessions.contains(where: \.done) {
                    Button("Start a new week") {
                        withAnimation(Motion.snappy) {
                            for i in trip.adventure?.training.indices ?? 0..<0 { trip.adventure?.training[i].done = false }
                        }
                    }
                    .font(.sf(14, .medium))
                    .foregroundStyle(Color.lime)
                    .padding(.vertical, 12)
                }
            }

            Text("Enter numbers from Apple Health or your watch. Health sync isn't connected in this build.")
                .font(.sf(12))
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)
        }
        .toolbar(.hidden, for: .tabBar)
        .sheet(isPresented: $editing) { ReadinessEditor(trip: $trip) }
        .sheet(isPresented: $addingSession) { TrainingSessionEditor(trip: $trip, session: TrainingSession(title: "", meta: ""), isNew: true) }
        .sheet(item: $editingSession) { TrainingSessionEditor(trip: $trip, session: $0, isNew: false) }
    }

    private var shortName: String {
        let words = trip.name.split(separator: " ")
        if words.count > 2, words.allSatisfy({ $0.first?.isUppercase == true }) {
            return words.map { String($0.prefix(1)) }.joined()
        }
        return trip.name
    }

    private var countdown: String {
        switch trip.status {
        case .upcoming:
            let weeks = trip.daysUntil / 7
            return weeks >= 2 ? "\(trip.kind.label) starts in \(weeks) weeks" : "\(trip.kind.label) starts in \(trip.daysUntil) days"
        case .active: return "On the trail now"
        case .past: return "Trip complete"
        }
    }

    private func metric(_ label: String, value: String, change: Int, suffix: String = "", goal: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(label).font(.sf(13)).foregroundStyle(Color.textMuted)
                Spacer()
                if change != 0 {
                    Text("\(change > 0 ? "↑" : "↓") \(abs(change))\(suffix)")
                        .font(.mono(11))
                        .foregroundStyle(change > 0 ? Color.mint : Color.coral)
                        .accessibilityLabel("\(change > 0 ? "up" : "down") \(abs(change))\(suffix == "%" ? " percent" : "")")
                }
                if let goal { Text(goal).font(.mono(11)).textCase(.uppercase).foregroundStyle(Color.textMuted) }
            }
            Text(value).font(.mono(17, .semibold)).foregroundStyle(.white)
        }
    }

    private func toggle(_ id: UUID) {
        guard let i = trip.adventure?.training.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(Motion.snappy) { trip.adventure?.training[i].done.toggle() }
    }
}

private struct ReadinessEditor: View {
    @Binding var trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var vo2 = 40
    @State private var ascent = 1000
    @State private var longHike = 12
    @State private var goal = 20

    var body: some View {
        NavigationStack {
            Form {
                Stepper("VO₂ max: \(vo2)", value: $vo2, in: 20...80)
                Stepper("Ascent per week: \(Fmt.grouped(ascent)) m", value: $ascent, in: 0...10_000, step: 50)
                Stepper("Longest hike: \(longHike) km", value: $longHike, in: 0...60)
                Stepper("Goal: \(goal) km", value: $goal, in: 5...60)
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Your numbers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
            }
            .onAppear {
                if let r = trip.adventure?.readiness {
                    vo2 = r.vo2
                    ascent = r.ascentPerWeek
                    longHike = r.longHikeKm
                    goal = r.longHikeGoal
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func save() {
        let old = trip.adventure?.readiness
        let score = min(100, Int((Double(vo2) / 55 * 40 + Double(ascent) / 2500 * 30 + Double(longHike) / Double(max(goal, 1)) * 30).rounded()))
        if trip.adventure == nil { trip.adventure = Adventure() }
        trip.adventure?.readiness = Readiness(
            score: score,
            vo2: vo2,
            vo2Change: old.map { vo2 - $0.vo2 } ?? 0,
            ascentPerWeek: ascent,
            ascentChange: old.map { $0.ascentPerWeek > 0 ? Int((Double(ascent - $0.ascentPerWeek) / Double($0.ascentPerWeek) * 100).rounded()) : 0 } ?? 0,
            longHikeKm: longHike,
            longHikeGoal: goal
        )
        if trip.adventure?.training.isEmpty == true {
            trip.adventure?.training = [
                TrainingSession(title: "Stair intervals, 45 min", meta: "Weekday · 8 kg pack"),
                TrainingSession(title: "Hill loop", meta: "Weekend · 15 km"),
                TrainingSession(title: "Back-to-back long hikes", meta: "Sat–Sun · \(goal) km each", key: true),
            ]
        }
        dismiss()
    }
}

private struct TrainingSessionEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    @State var session: TrainingSession
    var isNew: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                TextField("Session, e.g. Hill loop", text: $session.title)
                    .focused($firstFieldFocused)
                TextField("When and details, e.g. Sat · 15 km", text: $session.meta)
                Toggle("Key session", isOn: $session.key)
                if !isNew {
                    Toggle("Done", isOn: $session.done)
                    Button("Delete session", role: .destructive) {
                        trip.adventure?.training.removeAll { $0.id == session.id }
                        dismiss()
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isNew ? "Add session" : "Edit session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNew ? "Add" : "Save") {
                        session.title = session.title.trimmingCharacters(in: .whitespacesAndNewlines)
                        if trip.adventure == nil { trip.adventure = Adventure() }
                        if let i = trip.adventure?.training.firstIndex(where: { $0.id == session.id }) {
                            trip.adventure?.training[i] = session
                        } else {
                            trip.adventure?.training.append(session)
                        }
                        dismiss()
                    }
                    .disabled(session.title.trimmingCharacters(in: .whitespaces).isEmpty || session.title.count > 200 || session.meta.count > 200)
                }
            }
        }
        .autofocus($firstFieldFocused, when: isNew)
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium])
    }
}

struct PermitEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    @State private var permit: Permit
    @State private var notes: String
    var isNew: Bool
    @Environment(\.dismiss) private var dismiss

    init(trip: Binding<Trip>, permit: Permit, isNew: Bool) {
        _trip = trip
        _permit = State(initialValue: permit)
        _notes = State(initialValue: Self.notes(from: permit.meta))
        self.isNew = isNew
    }

    /// The user's own text, without the paid marker the list adds.
    static func notes(from meta: String) -> String {
        meta.replacingOccurrences(of: " · paid", with: "")
            .replacingOccurrences(of: "Not paid", with: "")
            .replacingOccurrences(of: "Paid", with: "", options: .anchored)
            .trimmingCharacters(in: .whitespaces)
    }

    static func meta(notes: String, paid: Bool) -> String {
        paid ? (notes.isEmpty ? "Paid" : "\(notes) · paid") : (notes.isEmpty ? "Not paid" : notes)
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Permit name", text: $permit.name)
                    .focused($firstFieldFocused)
                NumberRow("Fee (\(trip.currency))", value: Binding(get: { permit.fee ?? 0 }, set: { permit.fee = $0 > 0 ? $0 : nil }))
                TextField("Office or reference", text: $notes, axis: .vertical)
                Toggle("Paid", isOn: $permit.paid)
                if !isNew {
                    Button("Delete permit", role: .destructive) {
                        trip.adventure?.permits.removeAll { $0.id == permit.id }
                        dismiss()
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isNew ? "Add a permit" : "Edit permit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNew ? "Add" : "Save") {
                        permit.name = permit.name.trimmingCharacters(in: .whitespacesAndNewlines)
                        permit.meta = Self.meta(notes: notes.trimmingCharacters(in: .whitespacesAndNewlines), paid: permit.paid)
                        if trip.adventure == nil { trip.adventure = Adventure() }
                        if let i = trip.adventure?.permits.firstIndex(where: { $0.id == permit.id }) {
                            trip.adventure?.permits[i] = permit
                        } else {
                            trip.adventure?.permits.append(permit)
                        }
                        dismiss()
                    }
                    .disabled(permit.name.trimmingCharacters(in: .whitespaces).isEmpty || permit.name.count > 200 || notes.count > 500
                              || !(permit.fee ?? 0).isFinite || !(0...10_000_000).contains(permit.fee ?? 0))
                }
            }
        }
        .autofocus($firstFieldFocused, when: isNew)
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium])
    }
}
