import SwiftUI

/// First run after sign-in. Four short steps: who you are, what you're here
/// for, what matters on your trips, and units and currency. Every step can
/// be skipped. The last step lands the person in the right place: a new trip
/// form, the AI planner, or home.
struct OnboardingView: View {
    @Environment(TripStore.self) private var store
    @Environment(AppRouter.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var step = 0
    @State private var forward = true
    @State private var name = ""
    @State private var base = ""
    @State private var intent: PreferenceOptions.Intent = .planning
    @State private var focus: Set<String> = ["days", "packing"]
    @State private var metric = true
    @State private var currency = CurrencyService.home
    @FocusState private var field: Field?

    private enum Field { case name, base }
    private let steps = 4

    var body: some View {
        ZStack {
            BrandBackdrop()
            VStack(spacing: 0) {
                topBar
                ScrollView {
                    Group {
                        switch step {
                        case 0: aboutYou
                        case 1: whyHere
                        case 2: whatMatters
                        default: unitsAndCurrency
                        }
                    }
                    .id(step)
                    .transition(.asymmetric(
                        insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
                        removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)))
                    .padding(.horizontal, 24)
                    .padding(.top, 26)
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
            metric = store.profile.metric
            currency = store.profile.currency ?? CurrencyService.home
            if let saved = store.profile.intent { intent = saved }
            if let saved = store.profile.focus, !saved.isEmpty { focus = Set(saved) }
        }
    }

    // MARK: Chrome

    private var topBar: some View {
        HStack(spacing: 14) {
            Button { go(step - 1) } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .glassCapsule()
            }
            .opacity(step == 0 ? 0 : 1)
            .disabled(step == 0)
            .accessibilityLabel("Back")
            HStack(spacing: 5) {
                ForEach(0..<steps, id: \.self) { i in
                    Capsule()
                        .fill(i <= step ? Color.lime : Color.white.opacity(0.16))
                        .frame(height: 3)
                }
            }
            .animation(Motion.snappy, value: step)
            .accessibilityElement()
            .accessibilityLabel("Step \(step + 1) of \(steps)")
            Button("Set up later") { finish(save: false) }
                .font(.sf(14, .semibold))
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
                Button("Continue") { go(step + 1) }
                    .buttonStyle(CTAStyle())
            } else {
                Button(intent.cta) { finish(save: true) }
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
        VStack(alignment: .leading, spacing: 24) {
            heading("Welcome", name.isEmpty ? "Let's set things up." : "Good to have you, \(firstName).",
                    "Two details, so plans, packing lists and suggestions are made for you.")
            field("Your name", "First name is fine", text: $name, icon: "person")
                .textContentType(.name)
                .focused($field, equals: .name)
                .submitLabel(.next)
                .onSubmit { field = .base }
            field("Home base", "City or airport, like London or LHR", text: $base, icon: "house")
                .textInputAutocapitalization(.words)
                .focused($field, equals: .base)
                .submitLabel(.done)
                .onSubmit { field = nil }
            Text("Both are optional and stay with your account.")
                .font(.sf(13))
                .foregroundStyle(Color.textFaint)
        }
    }

    private var whyHere: some View {
        VStack(alignment: .leading, spacing: 24) {
            heading("Your next trip", "What brings you here?",
                    "We'll take you straight to the right place when you finish.")
            VStack(spacing: 10) {
                ForEach(PreferenceOptions.Intent.allCases, id: \.self) { option in
                    ChoiceCard(title: option.title, detail: option.detail, symbol: option.symbol, selected: intent == option) {
                        withAnimation(Motion.snappy) { intent = option }
                    }
                }
            }
        }
    }

    private var whatMatters: some View {
        VStack(alignment: .leading, spacing: 24) {
            heading("What matters", "What should every trip get right?",
                    "Choose as many as you like. Suggestions lead with these.")
            VStack(spacing: 10) {
                ForEach(PreferenceOptions.focuses) { option in
                    ChoiceCard(title: option.title, detail: option.detail, symbol: option.symbol, selected: focus.contains(option.id), multiple: true) {
                        withAnimation(Motion.snappy) {
                            if focus.contains(option.id) { focus.remove(option.id) } else { focus.insert(option.id) }
                        }
                    }
                }
            }
        }
    }

    private var unitsAndCurrency: some View {
        VStack(alignment: .leading, spacing: 24) {
            heading("Almost there", "How should we count?",
                    "Used for distances, pack weights and every budget. Change them any time in Profile.")
            section("Units") {
                HStack(spacing: 10) {
                    UnitChoice(title: "Metric", detail: "km · kg · °C", selected: metric) { withAnimation(Motion.snappy) { metric = true } }
                    UnitChoice(title: "Imperial", detail: "mi · lb · °F", selected: !metric) { withAnimation(Motion.snappy) { metric = false } }
                }
            }
            section("Currency") {
                Menu {
                    Picker("Currency", selection: $currency) {
                        ForEach(currencyChoices, id: \.self) { code in
                            Text("\(code) · \(CurrencyService.name(for: code))").tag(code)
                        }
                    }
                } label: {
                    HStack(spacing: 12) {
                        Text(CurrencyService.symbol(for: currency))
                            .font(.display(20))
                            .foregroundStyle(Color.lime)
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(Color.white.opacity(0.08)))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(CurrencyService.name(for: currency))
                                .font(.sf(16, .semibold))
                                .foregroundStyle(.white)
                            Text(currency)
                                .font(.sf(13))
                                .foregroundStyle(Color.textMuted)
                        }
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.textMuted)
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 64)
                    .glass(20)
                    .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .accessibilityLabel("Currency, \(CurrencyService.name(for: currency))")
            }
        }
    }

    // MARK: Pieces

    private var firstName: String {
        name.split(separator: " ").first.map(String.init) ?? name
    }

    /// The phone's currency first, then the common ones.
    private var currencyChoices: [String] {
        var codes = CurrencyService.common
        for extra in [currency, Locale.current.currency?.identifier ?? "USD"] where !codes.contains(extra) { codes.insert(extra, at: 0) }
        return codes
    }

    private func heading(_ eyebrow: String, _ title: String, _ subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(eyebrow).eyebrow(.lime)
            WordFittingTitle(text: title, size: 34, tracking: -0.5)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(subtitle)
                .font(.sf(16))
                .foregroundStyle(Color.textMuted)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).eyebrow()
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }

    private func field(_ label: String, _ prompt: String, text: Binding<String>, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).eyebrow()
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .medium))
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

    private func go(_ next: Int) {
        guard (0..<steps).contains(next) else { return }
        field = nil
        forward = next > step
        withAnimation(Motion.snappy) { step = next }
    }

    private func finish(save: Bool) {
        if save {
            store.profile.name = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
            store.profile.homeAirport = String(base.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
            store.profile.metric = metric
            store.profile.intent = intent
            store.profile.focus = Array(focus).sorted()
            store.profile.currency = currency
            CurrencyService.preferred = currency
            if store.hasAccount, !store.profile.name.isEmpty {
                let name = store.profile.name
                Task { await AuthClient.shared.updateDisplayName(name) }
            }
        }
        store.profile.onboardingCompleted = true
        store.saveNow()
        dismiss()
        guard save else { return }
        // The cover is still on its way out; present after it has gone.
        let landing = intent
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(550))
            switch landing {
            case .booked: router.startNewTrip(from: "onboarding")
            case .planning: router.plan(from: "onboarding")
            case .exploring: break
            }
        }
    }
}

private extension PreferenceOptions.Intent {
    var cta: String {
        switch self {
        case .booked: "Add my trip"
        case .planning: "Draft my trip"
        case .exploring: "Start exploring"
        }
    }
}

/// A full-width choice with an icon, title and one line of detail. Gold
/// when chosen; a tick for multiple-choice lists, a dot otherwise.
private struct ChoiceCard: View {
    var title: String
    var detail: String
    var symbol: String
    var selected: Bool
    var multiple = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: symbol)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(selected ? Color.ink : .white)
                    .frame(width: 42, height: 42)
                    .background(Circle().fill(selected ? Color.ink.opacity(0.1) : Color.white.opacity(0.08)))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.sf(16, .semibold))
                        .foregroundStyle(selected ? Color.ink : .white)
                    Text(detail)
                        .font(.sf(13))
                        .foregroundStyle(selected ? Color.ink.opacity(0.7) : Color.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .multilineTextAlignment(.leading)
                Spacer(minLength: 8)
                Image(systemName: multiple ? (selected ? "checkmark.circle.fill" : "circle") : (selected ? "largecircle.fill.circle" : "circle"))
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(selected ? Color.ink : Color.white.opacity(0.3))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                if selected {
                    RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color.lime)
                } else {
                    RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color.clear).glass(22)
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityLabel(title)
        .accessibilityHint(detail)
    }
}

private struct UnitChoice: View {
    var title: String
    var detail: String
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.sf(16, .semibold))
                    .foregroundStyle(selected ? Color.ink : .white)
                Text(detail)
                    .font(.sf(13))
                    .foregroundStyle(selected ? Color.ink.opacity(0.7) : Color.textMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .frame(minHeight: 64)
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
        .accessibilityLabel(title)
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
