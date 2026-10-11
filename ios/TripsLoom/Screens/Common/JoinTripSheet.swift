import SwiftUI

/// Shown when a trip link or `.tripsloom` file is opened: what the trip is,
/// who sent it, and which of the travellers you are.
struct JoinTripSheet: View {
    var invite: TripInvite
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var me: String?

    private var existing: Trip? { store.trip(invite.trip.id) }
    /// Your own trip's invite, opened on your own iPhone: nothing to join.
    private var isOwn: Bool {
        guard let existing else { return false }
        return !existing.companions.contains { $0.name == invite.from }
            && (store.profile.name == invite.from || existing.companions.map(\.name).sorted() == invite.trip.companions.map(\.name).sorted())
    }
    /// Everyone on the trip except the sender, for "Which one is you?".
    private var candidates: [String] { invite.trip.companions.map(\.name).filter { $0 != invite.from } }

    var body: some View {
        if isOwn { ownTrip } else { joinView }
    }

    private var ownTrip: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                SectionLabel("Your trip", color: .lime)
                Text(invite.trip.name).displayTitle(32)
                Text("This is the invite for your own trip. Send it to the people on it; opening it here changes nothing.")
                    .font(.sf(15))
                    .foregroundStyle(Color.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer()
                Button("Open trip") {
                    dismiss()
                    Task {
                        try? await Task.sleep(for: .milliseconds(400))
                        store.open(invite.trip.id, from: nil)
                    }
                }
                .buttonStyle(CTAStyle())
            }
            .padding(Metrics.gutter)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground { SheetGlass(photo: invite.trip.photo) }
    }

    private var joinView: some View {
        let trip = invite.trip
        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    SectionLabel(existing == nil ? "\(invite.from) invited you" : "Update from \(invite.from)", color: .lime)
                    Text(trip.name).displayTitle(32)
                    Text("\(trip.dateRange) · \(trip.place)").metaStyle(13)

                    GlassList {
                        ListRow(Fmt.count(trip.kind.isAdventure ? trip.stages.count : trip.plans.count, trip.kind.isAdventure ? "stage" : "plan"), meta: "\(Fmt.count(trip.dayCount, "day")) · \(trip.kind.title)") {
                            IconTile(symbol: trip.kind.symbol, color: trip.kind.tile)
                        }
                        ListRow(Fmt.count(max(trip.travellers, trip.companions.count + 1), "person", "people"), meta: ([invite.from] + candidates).joined(separator: ", ")) {
                            IconTile(symbol: "person.2.fill", color: Tile.plum)
                        }
                        if !trip.expenses.isEmpty {
                            ListRow(Fmt.count(trip.expenses.count, "expense"), meta: "\(Fmt.moneyShort(trip.totalPlanned, trip.currency)) planned") {
                                IconTile(symbol: "creditcard.fill", color: Tile.amber)
                            }
                        }
                    }

                    if !candidates.isEmpty {
                        SectionLabel("Which one is you?").padding(.top, 4)
                        GlassList {
                            ForEach(candidates + [""], id: \.self) { name in
                                Button { me = name } label: {
                                    ListRow(name.isEmpty ? "Someone else" : name) {
                                        Avatar(initials: name.isEmpty ? "?" : Person(name: name, color: 0).initials, color: name.isEmpty ? .white.opacity(0.2) : Tile.teal, size: 30, ring: false)
                                    } trailing: {
                                        if me == name { Image(systemName: "checkmark").foregroundStyle(Color.lime) }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        Text("So split costs show what you owe and are owed.")
                            .font(.sf(13))
                            .foregroundStyle(Color.textFaint)
                            .padding(.horizontal, 4)
                    }

                    Text(existing == nil
                         ? "You get your own copy. When \(invite.from) shares the trip again, opening it updates yours."
                         : "Plans, dates and costs are replaced with \(invite.from)'s latest. Your packing, outfits and cover stay.")
                        .font(.sf(13))
                        .foregroundStyle(Color.textFaint)
                        .padding(.horizontal, 4)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.vertical, 12)
            }
            .scrollIndicators(.hidden)
            .safeAreaInset(edge: .bottom) {
                Button(existing == nil ? "Add to my trips" : "Update my copy") { join() }
                    .buttonStyle(CTAStyle())
                    .disabled(!candidates.isEmpty && me == nil)
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.bottom, 8)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Not now") { dismiss() } }
            }
        }
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .onAppear {
            if candidates.isEmpty { me = "" }
            // Joined before: remember who you were.
            if let existing, let known = candidates.first(where: { name in !existing.companions.contains { $0.name == name } }) { me = known }
        }
    }

    private func join() {
        let name = me?.isEmpty == false ? me : nil
        let trip = invite.tripForJoining(as: name, existing: existing)
        if existing != nil {
            store.update(trip.id) { $0 = trip }
        } else {
            store.trips.append(trip)
        }
        dismiss()
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            store.open(trip.id, from: nil)
        }
    }
}

/// Builds the invite and shows the share sheet: a message with the link,
/// plus the `.tripsloom` file for apps that don't open links.
struct InviteShareSheet: View {
    var trip: Trip
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @FocusState private var focused: Bool

    var body: some View {
        if !store.profile.name.isEmpty {
            let invite = TripInvite.make(trip, senderName: store.profile.name)
            ShareSheet(items: [invite.message] + (invite.file().map { [$0] } ?? []))
                .presentationDetents([.medium, .large])
        } else {
            NavigationStack {
                Form {
                    Section {
                        TextField("Your name", text: $name)
                            .focused($focused)
                            .textContentType(.name)
                            .submitLabel(.done)
                            .onSubmit(save)
                    } footer: {
                        Text("So everyone on \(trip.name) knows who invited them and who paid for what.")
                    }
                }
                .scrollContentBackground(.hidden)
                .scrollDismissesKeyboard(.interactively)
                .navigationTitle("Invite people")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Next", action: save).disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
            .presentationDetents([.medium])
            .presentationBackground { SheetGlass(photo: trip.photo) }
            .onAppear { focused = true }
        }
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        store.profile.name = trimmed
    }
}
