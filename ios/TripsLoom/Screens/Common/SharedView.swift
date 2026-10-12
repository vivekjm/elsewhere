import SwiftUI

/// C11. The global Shared tab: group trips, votes on plans, and split costs.
struct SharedView: View {
    @Environment(TripStore.self) private var store
    @State private var settling: (tripID: UUID, person: String, amount: Double)?
    @State private var inviting: Trip?
    @State private var editingPoll: Trip?

    private var sharedTrips: [Trip] {
        store.trips.filter { !$0.companions.isEmpty && $0.status != .past }.sorted { $0.start < $1.start }
    }

    var body: some View {
        NightScreen(photo: sharedTrips.first?.photo ?? .beach, title: "Shared") {
            ScreenHeader(title: "Shared")

            if sharedTrips.isEmpty {
                EmptyNote(title: "No shared trips", message: "Invite friends to a trip to vote on plans and split costs.")
            }

            ForEach(sharedTrips) { trip in
                Button { store.open(trip.id, from: "shared-\(trip.id)") } label: {
                    SharedTripCard(trip: trip)
                }
                .buttonStyle(.card)
                .zoomSource("shared-\(trip.id)", radius: 28)

                if let poll = trip.poll {
                    PollCard(poll: poll) { optionID in vote(optionID, in: trip.id) }
                        .contextMenu {
                            Button("Edit vote", systemImage: "pencil") { editingPoll = trip }
                            Button("Remove vote", systemImage: "trash", role: .destructive) {
                                store.update(trip.id) { $0.poll = nil }
                            }
                        }
                } else {
                    Button { editingPoll = trip } label: {
                        Label("Start a vote", systemImage: "checklist")
                    }
                    .buttonStyle(GlassPillStyle())
                    .accessibilityHint("Ask everyone on \(trip.name) to pick between options")
                }

                let ledger = trip.ledger
                ForEach(ledger, id: \.person) { entry in
                    BalanceCard(person: entry.person, amount: entry.amount, currency: trip.currency) {
                        settling = (trip.id, entry.person, entry.amount)
                    }
                }
                if ledger.isEmpty, trip.hasSplits {
                    HStack(spacing: 10) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.mint)
                        Text("All settled up").font(.sf(15, .medium)).foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .glassCard()
                } else if !trip.hasSplits {
                    Text("Add an expense in Budget and split it to see who owes whom.")
                        .font(.sf(13))
                        .foregroundStyle(Color.textFaint)
                        .padding(.horizontal, 4)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                // One trip: share it. Several: pick which.
                let candidates = store.upcoming.filter { $0.isSample != true }
                if candidates.count == 1, let only = candidates.first {
                    Button { inviting = only } label: { OutlinePlusLabel(text: "Invite") }
                        .buttonStyle(OutlinePillStyle())
                } else {
                    Menu {
                        ForEach(candidates.isEmpty ? store.upcoming : candidates) { trip in
                            Button(trip.name) { inviting = trip }
                        }
                    } label: { OutlinePlusLabel(text: "Invite") }
                    .buttonStyle(OutlinePillStyle())
                    .disabled(store.upcoming.isEmpty)
                }
            }
            .sharedBackgroundVisibility(.hidden)
        }
        .sheet(item: $inviting) { trip in InviteShareSheet(trip: trip) }
        .sheet(item: $editingPoll) { trip in
            PollEditor(poll: trip.poll) { poll in store.update(trip.id) { $0.poll = poll } }
        }
        .confirmationDialog(settlingTitle, isPresented: Binding(get: { settling != nil }, set: { if !$0 { settling = nil } }), titleVisibility: .visible) {
            Button("Mark as settled") {
                guard let settling else { return }
                store.update(settling.tripID) { trip in
                    trip.settlements = (trip.settlements ?? []) + [Settlement(person: settling.person, amount: settling.amount)]
                }
            }
        } message: {
            Text("Pay in your usual app (UPI, bank or cash), then mark it settled here.")
        }
    }

    private var settlingTitle: String {
        guard let settling, let trip = store.trip(settling.tripID) else { return "Mark as settled?" }
        let money = Fmt.moneyShort(abs(settling.amount), trip.currency)
        return settling.amount > 0 ? "Paid \(settling.person) \(money)?" : "\(settling.person) paid you \(money)?"
    }

    private func vote(_ optionID: UUID, in tripID: UUID) {
        store.update(tripID) { trip in trip.poll?.vote(optionID) }
    }
}

struct SharedTripCard: View {
    var trip: Trip
    @Environment(TripStore.self) private var store

    var body: some View {
        VStack(spacing: 0) {
            Color.photoPlaceholder
                .overlay { RemotePhoto(photo: trip.photo, width: 900).tripCover(trip) }
                .frame(height: 120)
                .clipped()
                .overlay(alignment: .topLeading) {
                    Chip(trip.dateRange, tone: .onPhoto(.lime)).padding(10)
                }
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(trip.name).font(.sf(18, .bold)).foregroundStyle(.white)
                    Text("\(trip.kind.label) · \(max(trip.travellers, trip.companions.count + 1)) people").metaStyle()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: -9) {
                    // "Me" fits the overlapped circle where "You" would clip.
                    Avatar(initials: store.profile.initials.isEmpty ? "Me" : store.profile.initials, color: Tile.indigo)
                    ForEach(trip.companions) { person in
                        Avatar(initials: person.initials, color: Color(hex: person.color))
                    }
                }
                .accessibilityElement()
                .accessibilityLabel("You and \(trip.companions.map(\.name).formatted())")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .glass(28)
    }
}

struct PollCard: View {
    var poll: Poll
    var vote: (UUID) -> Void

    var body: some View {
        let total = max(poll.total, 1)
        let top = poll.options.map { poll.count($0.id) }.max() ?? 0
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(poll.question).font(.sf(17, .semibold)).foregroundStyle(.white)
                Spacer()
                Chip(poll.myVote == nil ? "Vote" : "Voted", tone: .solid)
            }
            VStack(spacing: 12) {
                ForEach(poll.options) { option in
                    let count = poll.count(option.id)
                    let leads = count > 0 && count == top
                    let names = poll.voters(option.id)
                    Button { vote(option.id) } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(option.title)
                                    .font(.sf(15))
                                if poll.myVote == option.id {
                                    Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.lime)
                                }
                                Spacer()
                                Text("\(count)")
                                    .font(.mono(15, .semibold))
                                    .foregroundStyle(leads ? Color.white : Color.textMuted)
                            }
                            .foregroundStyle(.white)
                            ProgressBar(
                                value: Double(count) / Double(total),
                                color: leads ? .lime : .white.opacity(0.4),
                                track: 0.12,
                                glow: true
                            )
                            if !names.isEmpty, poll.votesBy != nil {
                                Text(names.formatted()).metaStyle(12)
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(option.title), \(count) \(count == 1 ? "vote" : "votes")\(names.isEmpty || poll.votesBy == nil ? "" : ": \(names.formatted())")")
                    .accessibilityAddTraits(poll.myVote == option.id ? .isSelected : [])
                }
            }
            if poll.votesBy != nil {
                Text("Share the trip again so everyone sees the latest votes.").metaStyle(12, color: .textFaint)
            }
        }
        .glassCard()
    }
}

/// Starts or edits a group vote: a question and two to six options.
struct PollEditor: View {
    var poll: Poll?
    var save: (Poll) -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var questionFocused: Bool
    @State private var question: String
    @State private var options: [PollOption]

    init(poll: Poll?, save: @escaping (Poll) -> Void) {
        self.poll = poll
        self.save = save
        _question = State(initialValue: poll?.question ?? "")
        _options = State(initialValue: poll?.options ?? [PollOption(title: "", votes: 0), PollOption(title: "", votes: 0)])
    }

    /// Options with text, each choice once: "Le Comptoir" and "le comptoir "
    /// would otherwise split the vote between two copies.
    private var filled: [PollOption] { Poll.distinctOptions(options) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Question, e.g. Where for dinner on day 2?", text: $question, axis: .vertical)
                        .focused($questionFocused)
                }
                Section {
                    ForEach($options) { $option in
                        TextField("Option", text: $option.title)
                    }
                    .onDelete { offsets in
                        guard options.count - offsets.count >= 2 else { return }
                        options.remove(atOffsets: offsets)
                    }
                    if options.count < 6 {
                        Button("Add option", systemImage: "plus") { options.append(PollOption(title: "", votes: 0)) }
                    }
                } header: {
                    Text("Options")
                } footer: {
                    Text(poll == nil ? "Everyone you share the trip with can vote." : "Changing an option's name keeps its votes.")
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(poll == nil ? "Start a vote" : "Edit vote")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let kept = filled.map { option in
                            var o = option
                            o.title = String(o.title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(120))
                            return o
                        }
                        let ids = Set(kept.map(\.id))
                        var result = poll ?? Poll(question: "", options: [], votesBy: [:])
                        result.question = String(question.trimmingCharacters(in: .whitespacesAndNewlines).prefix(200))
                        result.options = kept
                        if let mine = result.myVote, !ids.contains(mine) { result.myVote = nil }
                        result.votesBy = result.votesBy?.filter { ids.contains($0.value) }
                        save(result)
                        dismiss()
                    }
                    .disabled(question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || filled.count < 2)
                }
            }
        }
        .autofocus($questionFocused, when: poll == nil)
        .presentationDetents([.medium, .large])
    }
}

struct BalanceCard: View {
    var person: String
    /// Positive: you owe them.
    var amount: Double
    var currency: String
    var settle: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                SectionLabel(amount > 0 ? "You owe \(person)" : "\(person) owes you", color: amount > 0 ? .textMuted : .mint)
                let money = Fmt.money(abs(amount), currency)
                MonoAmount(whole: money.whole, fraction: money.fraction, size: 32)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(amount > 0 ? "Settle up" : "Got it", action: settle)
                .buttonStyle(LimePillStyle(height: 44))
                .font(.sf(15, .bold))
        }
        .glassCard()
    }
}
