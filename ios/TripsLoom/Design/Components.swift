import SwiftUI

// MARK: Text

struct SectionLabel: View {
    var text: String
    var color: Color = .textMuted
    @Environment(\.dynamicTypeSize) private var typeSize

    init(_ text: String, color: Color = .textMuted) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text)
            .font(.sf(12, .semibold))
            .tracking(0.6)
            .textCase(.uppercase)
            .foregroundStyle(color)
            .lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
    }
}

/// "€705" with ".00" in the faint colour. Decimals are always muted.
struct MonoAmount: View {
    var whole: String
    var fraction: String
    var size: CGFloat
    var weight: Font.Weight = .semibold

    var body: some View {
        // Rendered a little under the design size: big mono numbers read
        // heavier than their point size suggests.
        Text("\(Text(whole))\(Text(fraction).foregroundStyle(Color.textFaint))")
            .font(.mono(size * 0.82, weight))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .contentTransition(.numericText())
            .animation(.spring(duration: 0.5, bounce: 0.1), value: whole + fraction)
    }
}

/// Title block used at the top of tab screens.
struct ScreenHeader: View {
    var title: String
    var meta: String? = nil
    var eyebrow: String? = nil
    var size: CGFloat = 34
    @Environment(\.headerCollapse) private var collapse

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let eyebrow {
                SectionLabel(eyebrow, color: .lime)
                    .padding(.bottom, 8)
            }
            Text(title)
                .displayTitle(size)
                .fixedSize(horizontal: false, vertical: true)
            if let meta {
                Text(meta)
                    .metaStyle(12)
                    .padding(.top, 6)
            }
        }
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Hands off to the toolbar title as it scrolls away.
        .opacity(1 - collapse)
        .scaleEffect(1 - collapse * 0.06, anchor: .bottomLeading)
        .blur(radius: collapse * 3)
    }
}

// MARK: Chips

struct Chip: View {
    enum Tone {
        /// Coloured text on a dark translucent pill, for chips on photos.
        case onPhoto(Color)
        /// Coloured text on a 14% tint of the same colour.
        case tint(Color)
        /// Lime fill with ink text.
        case solid
        /// White text on white/.1.
        case neutral
    }

    var text: String
    var tone: Tone = .tint(.mint)
    @Environment(\.dynamicTypeSize) private var typeSize

    init(_ text: String, tone: Tone = .tint(.mint)) {
        self.text = text
        self.tone = tone
    }

    var body: some View {
        Text(text)
            .font(.sf(11, .semibold))
            .tracking(0.7)
            .textCase(.uppercase)
            // Never squeezed at normal sizes; at accessibility sizes it may
            // wrap and shrink rather than push the layout off screen.
            .lineLimit(typeSize.isAccessibilitySize ? 2 : 1)
            .minimumScaleFactor(typeSize.isAccessibilitySize ? 0.6 : 1)
            .fixedSize(horizontal: !typeSize.isAccessibilitySize, vertical: true)
            .padding(.horizontal, 9)
            .padding(.vertical, 4).frame(minHeight: 24)
            .foregroundStyle(foreground)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(background))
    }

    private var foreground: Color {
        switch tone {
        case .onPhoto(let c), .tint(let c): c
        case .solid: .ink
        case .neutral: .white
        }
    }

    private var background: Color {
        switch tone {
        case .onPhoto: Color(hex: 0x0A0C10, opacity: 0.6)
        case .tint(let c): c.opacity(0.14)
        case .solid: .lime
        case .neutral: .white.opacity(0.1)
        }
    }
}

// MARK: Buttons

struct PressScale: ViewModifier {
    var pressed: Bool
    func body(content: Content) -> some View {
        content
            .scaleEffect(pressed ? 0.97 : 1)
            .animation(Motion.quick, value: pressed)
    }
}

/// 36pt glass pill: rgba(255,255,255,.12) with a top highlight.
struct GlassPillStyle: ButtonStyle {
    var height: CGFloat = 36
    var tint: Color = .white

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.sf(14, .semibold))
            .foregroundStyle(tint)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .frame(minHeight: max(height, 44))
            .background(Capsule().fill(Color.white.opacity(configuration.isPressed ? 0.18 : 0.12)))
            .overlay(TopHighlight(shape: Capsule(), opacity: 0.12))
            .contentShape(Capsule())
            .modifier(PressScale(pressed: configuration.isPressed))
    }
}

/// Lime pill with ink text, used for the active filter and money buttons.
struct LimePillStyle: ButtonStyle {
    var height: CGFloat = 36
    var mono = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(mono ? .mono(14, .bold) : .sf(14, .bold))
            .foregroundStyle(Color.ink)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .frame(minHeight: max(height, 44))
            .background(Capsule().fill(Color.lime))
            .contentShape(Capsule())
            .modifier(PressScale(pressed: configuration.isPressed))
    }
}

/// Outline pill with a trailing plus: "New +", "Invite +".
struct OutlinePillStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.sf(14, .semibold))
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .frame(minHeight: 44)
            .background(Capsule().strokeBorder(Color.white.opacity(0.24), lineWidth: 1))
            .contentShape(Capsule())
            .modifier(PressScale(pressed: configuration.isPressed))
    }
}

struct OutlinePlusLabel: View {
    var text: String
    var body: some View {
        HStack(spacing: 6) {
            Text(text)
            Image(systemName: "plus").font(.system(size: 13, weight: .bold))
        }
    }
}

/// 56pt call to action. Lime is the one thing to do next.
struct CTAStyle: ButtonStyle {
    enum Kind { case lime, glass, white }
    var kind: Kind = .lime
    var height: CGFloat = 56

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.sf(17, kind == .glass ? .semibold : .bold))
            .foregroundStyle(kind == .glass ? Color.white : Color.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .frame(minHeight: max(height, 44))
            .background {
                switch kind {
                case .lime:
                    Capsule().fill(Color.lime)
                        .shadow(color: .lime.opacity(0.25), radius: 16, y: 12)
                case .white:
                    Capsule().fill(Color.white)
                case .glass:
                    Capsule().fill(Color.clear).glassCapsule()
                }
            }
            .contentShape(Capsule())
            .opacity(configuration.isPressed ? 0.9 : 1)
            .modifier(PressScale(pressed: configuration.isPressed))
    }
}

/// 34pt round ↗ button used in card corners.
struct CornerArrow: View {
    var body: some View {
        Image(systemName: "arrow.up.right")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 34, height: 34)
            .background(Circle().fill(Color.white.opacity(0.08)))
            .overlay(Circle().strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
    }
}

/// 34pt round icon button inside rows (swap, etc.).
struct RoundIcon: View {
    var symbol: String
    var size: CGFloat = 34
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Circle().fill(Color.white.opacity(0.08)))
    }
}

struct TopHighlight<S: InsettableShape>: View {
    var shape: S
    var opacity: Double = 0.14
    var body: some View {
        shape.strokeBorder(
            LinearGradient(
                stops: [.init(color: .white.opacity(opacity), location: 0), .init(color: .clear, location: 0.2)],
                startPoint: .top,
                endPoint: .bottom
            ),
            lineWidth: 1
        )
        .allowsHitTesting(false)
    }
}

// MARK: Icon tiles

struct IconTile: View {
    enum Size {
        case large, medium, small
        var side: CGFloat { switch self { case .large: 40; case .medium: 36; case .small: 28 } }
        var radius: CGFloat { switch self { case .large: 13; case .medium: 12; case .small: 9 } }
        var glyph: CGFloat { switch self { case .large: 17; case .medium: 15; case .small: 12 } }
    }

    var symbol: String
    var color: Color
    var size: Size = .large

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: size.radius, style: .continuous)
        Image(systemName: symbol)
            .font(.system(size: size.glyph, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size.side, height: size.side)
            .background(shape.fill(color))
            .overlay(TopHighlight(shape: shape, opacity: 0.22))
            // Decorative: the row's text says what it is.
            .accessibilityHidden(true)
    }
}

/// Initials in a coloured circle.
struct Avatar: View {
    var initials: String
    var color: Color
    var size: CGFloat = 34
    var ring = true
    /// Grows a little with the text size; the initials shrink to fit the rest.
    @ScaledMetric(relativeTo: .body) private var textScale: CGFloat = 1

    var body: some View {
        let side = size * min(max(textScale, 1), 1.5)
        Text(initials)
            .font(.sf(size * (initials.count > 2 ? 0.3 : 0.36), .bold))
            .lineLimit(1)
            .minimumScaleFactor(0.3)
            .foregroundStyle(.white)
            .frame(width: side * 0.78, height: side * 0.78)
            .frame(width: side, height: side)
            .background(Circle().fill(color))
            .overlay {
                if ring { Circle().stroke(Color(hex: 0x0E1016, opacity: 0.9), lineWidth: 2) }
            }
    }
}

/// Photo thumbnail with a rounded rect.
struct PhotoThumb: View {
    var photo: Photo
    var size: CGFloat = 44
    var radius: CGFloat = 14

    var body: some View {
        Color.photoPlaceholder
            .overlay { RemotePhoto(photo: photo, width: 200) }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

/// A colour swatch standing in for a garment.
struct Swatch: View {
    var color: Color
    var size: CGFloat = 40
    var radius: CGFloat = 13
    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(color)
            .frame(width: size, height: size)
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(Color(hex: 0x14161C, opacity: 0.9), lineWidth: 2))
    }
}

struct SwatchStack: View {
    var colors: [Color]
    var body: some View {
        HStack(spacing: -10) {
            ForEach(Array(colors.prefix(3).enumerated()), id: \.offset) { _, color in
                Swatch(color: color)
            }
        }
    }
}

// MARK: Lists

/// A glass group with an optional header and hairlines between rows.
struct GlassList<Trailing: View, Content: View>: View {
    var title: String?
    var trailing: Trailing
    var content: Content

    init(_ title: String? = nil, @ViewBuilder trailing: () -> Trailing = { EmptyView() }, @ViewBuilder content: () -> Content) {
        self.title = title
        self.trailing = trailing()
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title {
                HStack {
                    Text(title).font(.sf(17, .semibold)).foregroundStyle(.white)
                    Spacer(minLength: 8)
                    trailing
                }
                .frame(minHeight: 36)
            }
            Group(subviews: content) { rows in
                ForEach(rows) { row in
                    row
                    if row.id != rows.last?.id {
                        Rectangle().fill(Color.hairline).frame(height: 1)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, title == nil ? 2 : 14)
        .padding(.bottom, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glass(28)
    }
}

/// Icon · title/meta · trailing. 12pt vertical padding.
struct ListRow<Leading: View, Trailing: View>: View {
    var title: String
    var meta: String?
    var leading: Leading
    var trailing: Trailing

    init(_ title: String, meta: String? = nil, @ViewBuilder leading: () -> Leading = { EmptyView() }, @ViewBuilder trailing: () -> Trailing = { EmptyView() }) {
        self.title = title
        self.meta = meta
        self.leading = leading()
        self.trailing = trailing()
    }

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // At accessibility text sizes the trailing control drops under the
        // text so the title keeps the full width instead of breaking words.
        let stacked = typeSize.isAccessibilitySize
        HStack(spacing: 12) {
            leading
            VStack(alignment: .leading, spacing: 3) {
                Group {
                    if stacked {
                        WordFittingTitle(text: title, size: 16, weight: .medium, localized: true, serif: false)
                    } else {
                        Text(LocalizedStringKey(title)).font(.sf(16, .medium))
                    }
                }
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                if let meta {
                    Text(meta).metaStyle()
                }
                if stacked { trailing.padding(.top, 6) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if !stacked { trailing }
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

// MARK: Controls

struct CheckCircle: View {
    var isOn: Bool
    var size: CGFloat = 28

    var body: some View {
        ZStack {
            if isOn {
                Circle().fill(Color.lime)
                    .shadow(color: .lime.opacity(0.45), radius: 6)
                    .transition(.scale(scale: 0.4).combined(with: .opacity))
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.46, weight: .heavy))
                    .foregroundStyle(Color.ink)
                    .transition(.scale(scale: 0.2).combined(with: .opacity))
            } else {
                Circle().strokeBorder(Color.white.opacity(0.32), lineWidth: 1.5)
            }
        }
        .frame(width: size, height: size)
        .scaleEffect(isOn ? 1 : 0.96)
        .animation(.spring(duration: 0.35, bounce: 0.5), value: isOn)
        .sensoryFeedback(.impact(weight: .light), trigger: isOn)
    }
}

/// 52×32 lime switch with an ink knob.
struct LimeToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            withAnimation(.spring(duration: 0.35, bounce: 0.35)) { configuration.isOn.toggle() }
        } label: {
            HStack(spacing: 12) {
                configuration.label
                ZStack(alignment: configuration.isOn ? .trailing : .leading) {
                    Capsule().fill(configuration.isOn ? Color.lime : Color.white.opacity(0.16))
                    Circle()
                        .fill(configuration.isOn ? Color.ink : Color.white)
                        .frame(width: 28, height: 28)
                        .padding(2)
                }
                .frame(width: 52, height: 32)
                .shadow(color: configuration.isOn ? .lime.opacity(0.35) : .clear, radius: 8)
            }
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: configuration.isOn)
        .accessibilityValue(configuration.isOn ? "On" : "Off")
    }
}

/// Pill segmented control: glass track, white/.16 selected pill.
struct PillSegmented<T: Hashable>: View {
    var options: [(T, String)]
    @Binding var selection: T
    var height: CGFloat = 38
    @Namespace private var ns
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // At accessibility text sizes the labels can't share one row; a menu
        // keeps every option readable.
        if typeSize.isAccessibilitySize {
            Picker("Show", selection: $selection) {
                ForEach(options, id: \.0) { value, label in Text(label).tag(value) }
            }
            .pickerStyle(.menu)
            .tint(.white)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .sensoryFeedback(.selection, trigger: selection)
        } else {
            pills
        }
    }

    private var pills: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.0) { value, label in
                let selected = value == selection
                Button {
                    withAnimation(.spring(duration: 0.4, bounce: 0.25)) { selection = value }
                } label: {
                    Text(label)
                        .font(.sf(14, selected ? .semibold : .regular))
                        .foregroundStyle(selected ? Color.white : Color.textMuted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .padding(.horizontal, 8)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background {
                            if selected {
                                Capsule().fill(Color.white.opacity(0.16))
                                    .overlay(TopHighlight(shape: Capsule()))
                                    .matchedGeometryEffect(id: "pill", in: ns)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(3)
        .frame(height: height)
        .background(Capsule().fill(Color.white.opacity(0.07)))
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
        .sensoryFeedback(.selection, trigger: selection)
    }
}

/// Horizontally scrolling filter pills; the active one is lime.
struct FilterPills<T: Hashable>: View {
    var options: [(T, String)]
    @Binding var selection: T
    @Namespace private var ns

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(options, id: \.0) { value, label in
                        let selected = value == selection
                        Button {
                            withAnimation(.spring(duration: 0.4, bounce: 0.25)) {
                                selection = value
                                proxy.scrollTo(value, anchor: .center)
                            }
                        } label: {
                            Text(label)
                                .font(.sf(14, selected ? .bold : .semibold))
                                .foregroundStyle(selected ? Color.ink : .white)
                                .lineLimit(1)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 4).frame(minHeight: 36)
                                .background {
                                    if selected {
                                        Capsule().fill(Color.lime)
                                            .matchedGeometryEffect(id: "filter", in: ns)
                                    } else {
                                        Capsule().fill(Color.white.opacity(0.12))
                                            .overlay(TopHighlight(shape: Capsule(), opacity: 0.12))
                                    }
                                }
                                .contentShape(Capsule())
                        }
                        .buttonStyle(.card)
                        .id(value)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
            }
            .scrollIndicators(.hidden)
            .scrollClipDisabled()
        }
        .sensoryFeedback(.selection, trigger: selection)
    }
}

/// +/− stepper in a pill.
struct PillStepper: View {
    @Binding var value: Int
    var range: ClosedRange<Int>

    var body: some View {
        HStack(spacing: 14) {
            Button { if value > range.lowerBound { value -= 1 } } label: { Text("−") }
                .accessibilityLabel("Decrease")
            Text("\(value)").contentTransition(.numericText())
            Button { if value < range.upperBound { value += 1 } } label: { Text("+") }
                .accessibilityLabel("Increase")
        }
        .buttonStyle(.plain)
        .font(.mono(15, .semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 4).frame(minHeight: 36)
        .background(Capsule().fill(Color.white.opacity(0.1)))
        .animation(Motion.quick, value: value)
    }
}

// MARK: Data

/// Round progress with butt ends, matching the design's conic rings.
struct ProgressRing<Label: View>: View {
    var progress: Double
    var color: Color = .lime
    var size: CGFloat = 56
    var lineWidth: CGFloat = 5
    var label: Label

    init(progress: Double, color: Color = .lime, size: CGFloat = 56, lineWidth: CGFloat = 5, @ViewBuilder label: () -> Label) {
        self.progress = progress
        self.color = color
        self.size = size
        self.lineWidth = lineWidth
        self.label = label()
    }

    @State private var drawn = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Grows with the text inside it, up to 1.6×, so large text stays in the ring.
    @ScaledMetric(relativeTo: .body) private var textScale: CGFloat = 1
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var labelWidth: CGFloat = 0
    private var side: CGFloat {
        let scaled = size * min(max(textScale, 1), 1.6)
        // At accessibility sizes the ring grows to fit its label rather than
        // shrinking the number.
        guard typeSize.isAccessibilitySize else { return scaled }
        return max(scaled, labelWidth + lineWidth * 2 + 12)
    }

    var body: some View {
        let shownProgress = drawn || reduceMotion ? max(0, min(1, progress)) : 0
        ZStack {
            Circle().stroke(Color.white.opacity(0.12), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: shownProgress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .butt))
                .rotationEffect(.degrees(-90))
                .shadow(color: color.opacity(shownProgress > 0 ? 0.35 : 0), radius: 4)
            label
                .lineLimit(1)
                .minimumScaleFactor(typeSize.isAccessibilitySize ? 1 : 0.4)
                .fixedSize(horizontal: typeSize.isAccessibilitySize, vertical: false)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { labelWidth = $0 }
                .frame(maxWidth: side - lineWidth * 2 - 6)
                .contentTransition(.numericText())
                .opacity(drawn || reduceMotion ? 1 : 0)
                .scaleEffect(drawn || reduceMotion ? 1 : 0.8)
        }
        .padding(lineWidth / 2)
        .frame(width: side, height: side)
        .animation(.draw, value: progress)
        .onAppear {
            guard !drawn, !reduceMotion else { return }
            withAnimation(.draw.delay(0.2)) { drawn = true }
        }
    }
}

extension ProgressRing where Label == Text {
    init(progress: Double, color: Color = .lime, size: CGFloat = 56, lineWidth: CGFloat = 5, text: String, fontSize: CGFloat = 14) {
        self.init(progress: progress, color: color, size: size, lineWidth: lineWidth) {
            Text(text).font(.mono(fontSize, .bold)).foregroundStyle(.white)
        }
    }
}

struct ProgressBar: View {
    var value: Double
    var color: Color = .lime
    var height: CGFloat = 6
    var track: Double = 0.1
    var glow = false

    @State private var grown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(track))
                Capsule()
                    .fill(color)
                    .frame(width: geo.size.width * (grown || reduceMotion ? max(0, min(1, value)) : 0))
                    .shadow(color: glow ? color.opacity(0.4) : .clear, radius: 5)
            }
        }
        .frame(height: height)
        .animation(.draw, value: value)
        .onAppear {
            guard !grown, !reduceMotion else { return }
            withAnimation(.draw.delay(0.25)) { grown = true }
        }
    }
}

/// A glowing colour bar at the left edge of a plan card.
struct CategoryBar: View {
    var color: Color
    var inset: CGFloat = 14
    var body: some View {
        UnevenRoundedRectangle(bottomTrailingRadius: 3, topTrailingRadius: 3)
            .fill(color)
            .frame(width: 4)
            .shadow(color: color, radius: 6)
            .padding(.vertical, inset)
    }
}

/// Empty state: short title plus one sentence.
struct EmptyNote: View {
    var title: String
    var message: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.sf(17, .semibold)).foregroundStyle(.white)
            Text(message).font(.sf(14)).foregroundStyle(Color.textMuted)
        }
        .glassCard()
    }
}

/// A labelled number field that starts empty instead of "0", so typing
/// replaces rather than appends.
struct NumberRow: View {
    var label: String
    @Binding var value: Double
    var decimals = true
    @State private var text = ""
    @FocusState private var focused: Bool

    init(_ label: String, value: Binding<Double>, decimals: Bool = true) {
        self.label = label
        _value = value
        self.decimals = decimals
    }

    init(_ label: String, value: Binding<Int>) {
        self.label = label
        _value = Binding(get: { Double(value.wrappedValue) }, set: { value.wrappedValue = Int(exactly: $0) ?? Int.max })
        decimals = false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
        HStack {
            Text(label)
            Spacer()
            TextField("0", text: $text)
                .accessibilityLabel(label)
                .keyboardType(decimals ? .decimalPad : .numberPad)
                .multilineTextAlignment(.trailing)
                .focused($focused)
                .frame(maxWidth: 160)
        }
        if !text.isEmpty, Fmt.parseAmount(text).map({ $0.isFinite && (decimals || Int(exactly: $0) != nil) }) != true {
            Text(decimals ? "Enter a valid number." : "Enter a whole number.")
                .font(.footnote).foregroundStyle(Color.coral)
        }
        }
        .onAppear { text = Self.display(value) }
        .onChange(of: text) { _, new in
            let parsed = new.isEmpty ? 0 : Fmt.parseAmount(new)
            value = parsed.flatMap { decimals || Int(exactly: $0) != nil ? $0 : nil } ?? .nan
        }
        .onChange(of: focused) { _, isFocused in
            if !isFocused, value.isFinite, value < Double(Int.max) { text = Self.display(value) }
        }
    }

    private static func display(_ value: Double) -> String {
        guard value.isFinite, value != 0 else { return "" }
        return Fmt.amountInput(value)
    }
}

extension View {
    /// Focuses a field shortly after a sheet appears, for new-item editors.
    func autofocus(_ focus: FocusState<Bool>.Binding, when enabled: Bool = true) -> some View {
        onAppear {
            guard enabled else { return }
            Task {
                try? await Task.sleep(for: .milliseconds(350))
                focus.wrappedValue = true
            }
        }
    }
}

/// Editing stored metric values in the user's units. Stored values stay
/// metric; an invalid entry passes through as NaN / Int.max so editors can
/// keep Save disabled.
extension Binding where Value == Int {
    /// Item grams, shown as grams or ounces.
    var inItemWeightUnits: Binding<Double> {
        Binding<Double>(
            get: { Fmt.metric ? Double(wrappedValue) : (Double(wrappedValue) / 28.3495 * 10).rounded() / 10 },
            set: { new in
                let grams = Fmt.metric ? new : new * 28.3495
                wrappedValue = grams.isFinite && abs(grams) < 1e9 ? Int(grams.rounded()) : Int.max
            }
        )
    }
}

extension Binding where Value == Double {
    /// Kilograms, shown as kg or lb.
    var inWeightUnits: Binding<Double> {
        Binding<Double>(
            get: { Fmt.metric ? wrappedValue : (wrappedValue * 2.20462 * 10).rounded() / 10 },
            set: { wrappedValue = Fmt.metric ? $0 : $0 / 2.20462 }
        )
    }

    /// Kilometres, shown as km or mi.
    var inDistanceUnits: Binding<Double> {
        Binding<Double>(
            get: { Fmt.metric ? wrappedValue : (wrappedValue * 0.621371 * 10).rounded() / 10 },
            set: { wrappedValue = Fmt.metric ? $0 : $0 / 0.621371 }
        )
    }
}

extension Fmt {
    static var itemWeightUnit: String { metric ? "g" : "oz" }
}
