import SwiftUI

/// First run after sign-in: three short steps that set the planner's real
/// inputs. Every step can be skipped; Profile → Travel preferences edits the
/// same values later.
struct OnboardingView: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var step = 0
    @State private var forward = true
    @State private var name = ""
    @State private var base = ""
    @State private var style = "A bit of everything"
    @State private var pace = "Balanced"
    @State private var diet = "No preference"
    @State private var budget = "Mid-range"
    @State private var metric = true
    @FocusState private var focus: Field?

    private enum Field { case name, base }
    private let steps = 3

    var body: some View {
        ZStack {
            BrandBackdrop()
            VStack(spacing: 0) {
                topBar
                ScrollView {
                    Group {
                        switch step {
                        case 0: aboutYou
                        case 1: howYouTravel
                        default: details
                        }
                    }
                    .id(step)
                    .transition(.asymmetric(
                        insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
                        removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)))
                    .padding(.horizontal, 24)
                    .padding(.top, 28)
                    .padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)
                .scrollBounceBehavior(.basedOnSize)
                .safeAreaInset(edge: .bottom, spacing: 0) { bottomBar }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            name = store.profile.name; base = store.profile.homeAirport
            style = store.profile.travelStyle; pace = store.profile.pace
            diet = store.profile.diet; budget = store.profile.budgetStyle; metric = store.profile.metric
        }
    }

    // MARK: Chrome

    private var topBar: some View {
        HStack(spacing: 14) {
            Button { go(step - 1) } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .glassCapsule()
            }
            .opacity(step == 0 ? 0 : 1)
            .disabled(step == 0)
            .accessibilityLabel("Back")
            HStack(spacing: 6) {
                ForEach(0..<steps, id: \.self) { i in
                    Capsule()
                        .fill(i <= step ? Color.lime : Color.white.opacity(0.18))
                        .frame(height: 5)
                }
            }
            .animation(Motion.snappy, value: step)
            .accessibilityElement()
            .accessibilityLabel("Step \(step + 1) of \(steps)")
            Button("Set up later") { finish(save: false) }
                .font(.sf(15, .semibold))
                .foregroundStyle(Color.textMuted)
                .frame(minHeight: 44)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var bottomBar: some View {
        Group {
            if step < steps - 1 {
                Button("Next") { go(step + 1) }
                    .buttonStyle(CTAStyle())
            } else {
                Button("Start planning") { finish(save: true) }
                    .buttonStyle(CTAStyle())
                    .accessibilityIdentifier("save-travel-preferences")
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 20)
        .padding(.bottom, 8)
        .background(alignment: .bottom) {
            // Content fades out under the button rather than being cut.
            LinearGradient(colors: [Color(hex: 0x06080B, opacity: 0), Color(hex: 0x06080B, opacity: 0.92)], startPoint: .top, endPoint: .center)
                .ignoresSafeArea()
        }
    }

    // MARK: Steps

    private var aboutYou: some View {
        VStack(alignment: .leading, spacing: 22) {
            heading(name.isEmpty ? "Welcome aboard." : "Hi, \(firstName).",
                    "A couple of details to tailor plans, packing and suggestions to you.")
            field("Your name", "What should we call you?", text: $name, icon: "person.fill")
                .textContentType(.name)
                .focused($focus, equals: .name)
                .submitLabel(.next)
                .onSubmit { focus = .base }
            field("Home city or airport", "e.g. Bengaluru or BLR", text: $base, icon: "house.fill")
                .textInputAutocapitalization(.words)
                .focused($focus, equals: .base)
                .submitLabel(.done)
                .onSubmit { focus = nil }
            Text("Both are optional, and stay with your account.")
                .font(.sf(13))
                .foregroundStyle(Color.textFaint)
        }
    }

    private var howYouTravel: some View {
        VStack(alignment: .leading, spacing: 22) {
            heading("How do you like to travel?", "Discover shows these trips first, and plans follow your pace.")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
                ForEach(PreferenceOptions.styles, id: \.self) { option in
                    StyleTile(title: option, symbol: Self.symbol(for: option), selected: style == option) {
                        withAnimation(Motion.snappy) { style = option }
                    }
                }
            }
            section("Pace") {
                ChoiceChips(options: PreferenceOptions.paces, selection: $pace)
            }
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 24) {
            heading("A few last details.", "Used for food suggestions, cost estimates and the weather.")
            section("Food") {
                ChoiceChips(options: PreferenceOptions.diets, selection: $diet)
            }
            section("Budget") {
                ChoiceChips(options: PreferenceOptions.budgets, selection: $budget)
            }
            section("Units") {
                ChoiceChips(options: ["Metric", "Imperial"], selection: Binding(
                    get: { metric ? "Metric" : "Imperial" },
                    set: { metric = $0 == "Metric" }))
            }
        }
    }

    // MARK: Pieces

    private var firstName: String {
        name.split(separator: " ").first.map(String.init) ?? name
    }

    private func heading(_ title: String, _ subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            WordFittingTitle(text: title, size: 34, tracking: -0.8)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(subtitle)
                .font(.sf(16))
                .foregroundStyle(Color.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.mono(12, .semibold))
                .textCase(.uppercase)
                .foregroundStyle(Color.textFaint)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }

    private func field(_ label: String, _ prompt: String, text: Binding<String>, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.mono(12, .semibold))
                .textCase(.uppercase)
                .foregroundStyle(Color.textFaint)
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(Color.textMuted)
                    .accessibilityHidden(true)
                TextField(label, text: text, prompt: Text(prompt).foregroundStyle(Color.textFaint))
                    .font(.sf(17))
                    .foregroundStyle(.white)
                    .tint(.lime)
                    .accessibilityLabel(label)
                    .accessibilityIdentifier(label)
            }
            .padding(.horizontal, 18)
            .frame(minHeight: 56)
            .glass(18)
        }
    }

    private static func symbol(for style: String) -> String {
        switch style {
        case "City + Trek": "figure.hiking"
        case "City": "building.2.fill"
        case "Trek and climb": "mountain.2.fill"
        case "Beach": "beach.umbrella.fill"
        case "Road trips": "car.fill"
        default: "sparkles"
        }
    }

    private func go(_ next: Int) {
        guard (0..<steps).contains(next) else { return }
        focus = nil
        forward = next > step
        withAnimation(Motion.snappy) { step = next }
    }

    private func finish(save: Bool) {
        if save {
            store.profile.name = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
            store.profile.homeAirport = String(base.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
            store.profile.travelStyle = style; store.profile.pace = pace
            store.profile.diet = diet; store.profile.budgetStyle = budget; store.profile.metric = metric
            if store.hasAccount, !store.profile.name.isEmpty {
                let name = store.profile.name
                Task { await AuthClient.shared.updateDisplayName(name) }
            }
        }
        store.profile.onboardingCompleted = true
        store.saveNow()
        dismiss()
    }
}

/// A travel-style card with an icon; lime when chosen.
private struct StyleTile: View {
    var title: String
    var symbol: String
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(selected ? Color.ink : .white)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(selected ? Color.ink.opacity(0.12) : Color.white.opacity(0.08)))
                Text(title)
                    .font(.sf(15, .semibold))
                    .foregroundStyle(selected ? Color.ink : .white)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
            .padding(.horizontal, 12)
            .background {
                if selected {
                    RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.lime)
                } else {
                    RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.clear).glass(20)
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Single-choice pills that wrap onto new lines.
private struct ChoiceChips: View {
    var options: [String]
    @Binding var selection: String

    var body: some View {
        WrapLayout(spacing: 8) {
            ForEach(options.contains(selection) ? options : options + [selection], id: \.self) { option in
                let selected = option == selection
                Button {
                    withAnimation(Motion.snappy) { selection = option }
                } label: {
                    Text(option)
                        .font(.sf(15, .semibold))
                        .foregroundStyle(selected ? Color.ink : .white)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 44)
                        .background {
                            if selected { Capsule().fill(Color.lime) } else { Capsule().fill(Color.clear).glassCapsule() }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }
}

/// Lays children out left to right, starting a new row when one is full.
struct WrapLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = rows(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(size.width, bounds.width), height: size.height))
                x += min(size.width, bounds.width) + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func rows(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(ProposedViewSize(width: width, height: nil))
            let itemWidth = min(size.width, width)
            if !current.indices.isEmpty, current.width + spacing + itemWidth > width {
                rows.append(current)
                current = Row()
            }
            current.width += (current.indices.isEmpty ? 0 : spacing) + itemWidth
            current.height = max(current.height, size.height)
            current.indices.append(index)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
