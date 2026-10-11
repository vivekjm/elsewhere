import SwiftUI

/// C6 → C9. Describe the trip, get a draft, refine it, save it as a trip
/// with its plans, packing list and budget.
struct PlannerFlow: View {
    var initialPrompt: String
    @Environment(\.dismiss) private var dismiss
    @Environment(TripStore.self) private var store
    @State private var prompt: String
    @State private var path: [ItineraryDraft] = []
    @State private var drafting = false
    @State private var paywall = false
    @FocusState private var focused: Bool

    init(initialPrompt: String) {
        self.initialPrompt = initialPrompt
        _prompt = State(initialValue: initialPrompt)
    }

    private struct Idea: Identifiable {
        let id = UUID()
        var title: String
        var meta: String
        var kind: TripKind
    }

    private let ideas = [
        Idea(title: "10 days trekking in Nepal", meta: "October · tea houses · ₹1.2L", kind: .trek),
        Idea(title: "4 slow days in Kyoto", meta: "April · food · walking", kind: .city),
        Idea(title: "A long weekend by the sea", meta: "No flights · from Bangalore", kind: .beach),
    ]

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(store.profile.firstName.isEmpty ? "Where to\nnext?" : "Where to next,\n\(store.profile.firstName)?").displayTitle(36)
                        Text("Describe the trip. I'll draft the days, stays, gear and packing.")
                            .font(.sf(15))
                            .foregroundStyle(Color.textMuted)
                            .lineSpacing(2)
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 20)

                    SectionLabel("Try")
                    GlassList {
                        ForEach(ideas) { idea in
                            Button {
                                prompt = idea.title
                                Task { await send() }
                            } label: {
                                ListRow(idea.title, meta: idea.meta) {
                                    IconTile(symbol: idea.kind.symbol, color: idea.kind.tile, size: .medium)
                                } trailing: {
                                    CornerArrow()
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    SectionLabel("From your profile")
                    HStack(spacing: 8) {
                        ForEach([store.profile.budgetStyle, store.profile.diet, store.profile.pace], id: \.self) { tag in
                            Text(tag)
                                .font(.sf(14, .semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 4).frame(minHeight: 36)
                                .background(Capsule().fill(Color.white.opacity(0.12)))
                        }
                    }

                    if TripDrafter.usesOnDeviceModel, let left = store.draftsLeft {
                        Button { paywall = true } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "sparkles").foregroundStyle(Color.lime)
                                Text(left == 0 ? "No free AI drafts left this month · " : "\(Fmt.count(left, "free AI draft")) left this month · ")
                                    .foregroundStyle(Color.textMuted)
                                Text("Go unlimited").foregroundStyle(Color.lime)
                            }
                            .font(.sf(13))
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 4)
                        .padding(.top, 4)
                    }

                    if !TripDrafter.usesOnDeviceModel {
                        Text("Apple Intelligence is off or unavailable here, so drafts use a simple template. Turn it on in Settings for fuller plans.")
                            .font(.sf(13))
                            .foregroundStyle(Color.textFaint)
                            .padding(.horizontal, 4)
                            .padding(.top, 4)
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.bottom, 24)
                .opacity(drafting ? 0.15 : 1)
                .blur(radius: drafting ? 8 : 0)
                .overlay(alignment: .top) {
                    if drafting {
                        DraftingPlaceholder(prompt: prompt)
                            .padding(.horizontal, Metrics.gutter)
                            .padding(.top, 20)
                            .transition(.scale(scale: 0.96, anchor: .top).combined(with: .opacity))
                    }
                }
                .animation(.spring(duration: 0.5, bounce: 0.15), value: drafting)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background { PhotoBackdrop(photo: .tram) }
            .safeAreaInset(edge: .bottom) { inputBar }
            .fullScreenCover(isPresented: $paywall) { PaywallView(reason: .drafts) }
            .navigationTitle("Plan with AI")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                }
            }
            .navigationDestination(for: ItineraryDraft.self) { draft in
                DraftView(draft: draft, prompt: prompt) { trip in
                    store.add(trip)
                    dismiss()
                    Task {
                        try? await Task.sleep(for: .milliseconds(350))
                        store.open(trip.id)
                    }
                } onRefine: {
                    path.removeAll()
                    focused = true
                }
            }
            .task {
                if !initialPrompt.isEmpty { await send() }
            }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 6) {
            TextField("Describe your trip", text: $prompt, prompt: Text("A week in Portugal, food and tiles").foregroundStyle(Color.textFaint), axis: .vertical)
                .accessibilityLabel("Describe your trip")
                .font(.sf(16))
                .lineLimit(1...4)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit { Task { await send() } }
                .tint(.lime)
            Button {
                Task { await send() }
            } label: {
                Group {
                    if drafting {
                        ProgressView().tint(.ink)
                    } else {
                        Image(systemName: "arrow.up").font(.system(size: 18, weight: .bold))
                    }
                }
                .foregroundStyle(Color.ink)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.lime))
                .shadow(color: .lime.opacity(0.3), radius: 12, y: 8)
            }
            .buttonStyle(.plain)
            .disabled(drafting || prompt.trimmingCharacters(in: .whitespaces).isEmpty)
            .accessibilityLabel("Draft trip")
        }
        .padding(.leading, 20)
        .padding(.trailing, 7)
        .padding(.vertical, 7)
        .glass(32, fill: Color(hex: 0x14161C, opacity: 0.6))
        .overlay(RoundedRectangle(cornerRadius: 32, style: .continuous).strokeBorder(Color.lime.opacity(0.5), lineWidth: 1.5))
        .shadow(color: .lime.opacity(0.14), radius: 12)
        .padding(.horizontal, Metrics.gutter)
        .padding(.bottom, 8)
    }

    private func send() async {
        let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !drafting else { return }
        // Template drafts (no Apple Intelligence) are free; AI drafts count.
        if TripDrafter.usesOnDeviceModel, !store.useDraft() {
            focused = false
            paywall = true
            return
        }
        focused = false
        drafting = true
        // Even the instant template draft shows its working briefly, so the
        // jump to the result doesn't feel like a glitch.
        async let minimum: Void = { try? await Task.sleep(for: .milliseconds(900)) }()
        let draft = await TripDrafter.draft(prompt: text, profile: store.profile)
        await minimum
        drafting = false
        path = [draft]
    }
}

/// C9. Swap any day, use a quick prompt to refine, and save it to create the
/// trip, packing list and budget together.
struct DraftView: View {
    @State var draft: ItineraryDraft
    var prompt: String
    var onSave: (Trip) -> Void
    var onRefine: () -> Void

    @Environment(TripStore.self) private var store
    @State private var refinements: [String] = []
    @State private var working = false
    @State private var swapping: UUID?

    var body: some View {
        NightScreen(photo: draft.photo ?? draft.kind.defaultPhoto, hero: 330, heroContentTop: 108, spacing: 12, title: draft.title) {
            VStack(alignment: .leading, spacing: 6) {
                Text(draft.title).displayTitle(36).fixedSize(horizontal: false, vertical: true)
                Text("\(Fmt.count(draft.days.count, "day")) · \(draft.travellers) \(draft.travellers == 1 ? "traveller" : "travellers") · \(Fmt.moneyShort(draft.estimate, draft.currency)) est.")
                    .metaStyle(12)
            }

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    // "Beach day" only where there's likely a beach.
                    ForEach(draft.kind.isAdventure ? ["Cheaper"] : draft.kind == .beach || draft.kind == .city ? ["Less walking", "Beach day", "Cheaper"] : ["Less walking", "Cheaper"], id: \.self) { chip in
                        let on = refinements.contains(chip)
                        Button {
                            Task { await refine(chip) }
                        } label: {
                            HStack(spacing: 6) {
                                Text(chip)
                                Image(systemName: on ? "checkmark" : "plus").font(.system(size: 13, weight: .bold))
                            }
                            .foregroundStyle(on ? Color.lime : .white)
                        }
                        .buttonStyle(OutlinePillStyle())
                        .disabled(working)
                    }
                }
            }
            .scrollIndicators(.hidden)
            .scrollClipDisabled()

            GlassList {
                ForEach(Array(draft.days.enumerated()), id: \.element.id) { index, day in
                    ListRow(day.title, meta: day.stops.joined(separator: " · ")) {
                        Text("\(index + 1)")
                            .font(.mono(14, .bold))
                            .foregroundStyle(index == 0 ? Color.ink : .white)
                            .frame(width: 32, height: 32)
                            .background(Circle().fill(index == 0 ? Color.lime : Color.white.opacity(0.1)))
                    } trailing: {
                        Button {
                            Task { await swap(day, index: index) }
                        } label: {
                            if swapping == day.id {
                                ProgressView().frame(width: 34, height: 34)
                            } else {
                                RoundIcon(symbol: "arrow.left.arrow.right")
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Swap day \(index + 1)")
                    }
                }
            }
            .opacity(working ? 0.5 : 1)
        }
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 10) {
                Button("Refine", action: onRefine)
                    .buttonStyle(CTAStyle(kind: .glass))
                    .frame(width: 139)
                Button("Save as trip") { onSave(makeTrip()) }
                    .buttonStyle(CTAStyle())
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.bottom, 8)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Label(draft.source == .onDevice ? "AI draft" : "Quick draft", systemImage: "sparkles")
                    .labelStyle(.titleAndIcon)
                    .font(.sf(15, .semibold))
                    .foregroundStyle(.white)
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(Color.lime, .white)
                    .padding(.horizontal, 6)
            }
        }
    }

    private func refine(_ chip: String) async {
        if let i = refinements.firstIndex(of: chip) { refinements.remove(at: i) } else { refinements.append(chip) }
        working = true
        let updated = await TripDrafter.draft(prompt: prompt, profile: store.profile, refinements: refinements)
        withAnimation(Motion.snappy) { draft = updated }
        working = false
    }

    private func swap(_ day: DraftDay, index: Int) async {
        swapping = day.id
        let replacement = await TripDrafter.alternative(for: day, in: draft, index: index)
        withAnimation(Motion.snappy) {
            if let i = draft.days.firstIndex(where: { $0.id == day.id }) { draft.days[i] = replacement }
        }
        swapping = nil
    }

    private func makeTrip() -> Trip {
        let start = draft.start ?? Calendar.current.date(byAdding: .day, value: 14, to: Calendar.current.startOfDay(for: .now)) ?? .now
        // Morning, midday, evening, unless the stop says when it happens.
        let slots = ["09:30", "12:30", "16:30", "19:00"]
        var plans: [Plan] = []
        for (dayIndex, day) in draft.days.enumerated() {
            var last = "00:00"
            for (i, stop) in day.stops.enumerated() {
                let category = PlanCategory.guess(from: stop) ?? (draft.kind.isAdventure ? .activity : .sight)
                var time = category.typicalTime(for: stop) ?? slots[min(i, slots.count - 1)]
                if time <= last { time = slots.first { $0 > last } ?? time }
                last = time
                plans.append(Plan(day: dayIndex, time: time, title: stop, meta: day.area ?? "", category: category,
                                  action: category == .stay ? "Map" : nil, addedAt: .now))
            }
        }
        var trip = Trip(
            name: draft.title,
            place: draft.place,
            kind: draft.kind,
            start: start,
            dayCount: draft.days.count,
            travellers: draft.travellers,
            photo: draft.photo ?? draft.kind.defaultPhoto,
            currency: draft.currency,
            budgetLimit: max(draft.estimate, 100),
            plans: plans
        )
        trip.packing = PackingSuggestions.items(for: draft.kind, days: draft.days.count, wardrobe: store.wardrobe)
        trip.capsule = trip.packing.compactMap(\.wardrobeID)
        if draft.kind.isAdventure {
            trip.gear = PackingSuggestions.gear(for: draft.kind)
            trip.adventure = Adventure()
            trip.stages = draft.days.enumerated().map { i, day in
                Stage(day: i + 1, title: day.title, meta: day.stops.joined(separator: " · "), km: 0, ascent: 0, altitude: 0)
            }
        }
        return trip
    }
}

/// Shown while a draft is being written: the prompt, animated sparkles and
/// shimmering day rows.
private struct DraftingPlaceholder: View {
    var prompt: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.lime)
                    .symbolEffect(.variableColor.iterative.reversing, options: .repeating)
                Text("Drafting your trip")
                    .font(.sf(20, .bold))
                    .foregroundStyle(.white)
            }
            Text(prompt)
                .font(.sf(15))
                .foregroundStyle(Color.textMuted)
                .lineLimit(2)
            VStack(spacing: 0) {
                ForEach(0..<4, id: \.self) { index in
                    HStack(spacing: 12) {
                        Circle().fill(Color.white.opacity(index == 0 ? 0.3 : 0.1)).frame(width: 32, height: 32)
                        VStack(alignment: .leading, spacing: 6) {
                            Capsule().fill(Color.white.opacity(0.16)).frame(width: 150 + CGFloat(index * 17 % 60), height: 12)
                            Capsule().fill(Color.white.opacity(0.08)).frame(width: 210 - CGFloat(index * 23 % 70), height: 9)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 12)
                    if index < 3 { Rectangle().fill(Color.hairline).frame(height: 1) }
                }
            }
            .padding(.horizontal, 16)
            .glass(28)
            .shimmer()
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Drafting your trip")
    }
}
