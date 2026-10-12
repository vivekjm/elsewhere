import SwiftUI
import UIKit

// Design tokens. The system is editorial and flat: deep ink backdrop, the
// display serif for titles, a champagne-gold accent, content separated by
// hairline rules rather than boxed in cards, and small radii only on
// controls and media.

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }

    /// Primary / selected: a warm champagne gold. Text on it is `ink`. The
    /// token keeps its original name; every screen reads the accent from here.
    static let lime = Color(hex: 0xE6C76A)
    /// Go, safe, charts.
    static let mint = Color(hex: 0x3DF5A8)
    /// Warnings, SOS, required.
    static let coral = Color(hex: 0xFF6B6B)
    static let ink = Color(hex: 0x0B0E12)
    static let night = Color(hex: 0x0A0D11)
    static let sky = Color(hex: 0x8AB8FF)
    static let amber = Color(hex: 0xF5A524)
    static let violet = Color(hex: 0x8B7BFF)
    static let sun = Color(hex: 0xF5C542)
    static let marker = Color(hex: 0xF5E14A)
    static let apricot = Color(hex: 0xFFB86B)
    static let photoPlaceholder = Color(hex: 0x2A2E36)

    /// Hairline rules that separate sections and rows.
    static let rule = Color.white.opacity(0.12)
    static let textMuted = Color.white.opacity(0.62)
    static let textFaint = Color.white.opacity(0.45)
    static let hairline = Color.white.opacity(0.07)
}

/// Solid tile colours used behind white icons.
enum Tile {
    static let indigo = Color(hex: 0x4636E8)
    static let plum = Color(hex: 0x7A2FA0)
    static let teal = Color(hex: 0x127C8C)
    static let green = Color(hex: 0x2E8B4A)
    static let amber = Color(hex: 0xC77A12)
    static let bronze = Color(hex: 0x8A6A3E)
    static let red = Color(hex: 0xC0392B)
}

extension Font {
    /// SF Pro at a design size, following the user's text size.
    static func sf(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: TypeScale.scaled(size), weight: weight)
    }

    /// New York, the editorial serif used for titles and the wordmark. The
    /// website sets its headings in a serif too, so the brand reads the same.
    static func display(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .system(size: TypeScale.scaled(size), weight: weight, design: .serif)
    }

    /// Numbers and meta: SF with figures of equal width, so columns of
    /// amounts and times line up without looking like code.
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: TypeScale.scaled(size), weight: weight).monospacedDigit()
    }
}

extension UIFont {
    /// The UIKit twin of `Font.display`, for measuring and `WordFittingTitle`.
    static func display(ofSize size: CGFloat, weight: UIFont.Weight) -> UIFont {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        guard let serif = base.fontDescriptor.withDesign(.serif) else { return base }
        return UIFont(descriptor: serif, size: size)
    }
}

/// Scales all text with Dynamic Type, including accessibility sizes.
enum TypeScale {
    static func scaled(_ size: CGFloat) -> CGFloat {
        let style: UIFont.TextStyle = size >= 28 ? .largeTitle : size >= 22 ? .title2 : .body
        let scaled = UIFontMetrics(forTextStyle: style).scaledValue(for: size)
        return (max(scaled, size * 0.88) * 2).rounded() / 2
    }
}

extension View {
    /// Large display title in the serif: semibold, slightly tight. Capped at
    /// 36pt so long trip names still fit on one or two lines.
    func displayTitle(_ size: CGFloat = 34) -> some View {
        let size = min(size, 36)
        return font(.display(size))
            .tracking(-size * 0.015)
            .foregroundStyle(.white)
    }

    /// Small tracked capitals above a title or section: "YOUR KIND OF TRIP".
    func eyebrow(_ color: Color = .textMuted) -> some View {
        font(.sf(11.5, .semibold))
            .tracking(1.4)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }

    /// Secondary line under a title: SF, sentence case, muted. Mono is kept
    /// for numbers, times and codes, where columns should line up.
    func metaStyle(_ size: CGFloat = 11.5, color: Color = .textMuted) -> some View {
        font(.sf(max(size + 2, 13)))
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
    }
}

enum Motion {
    static let snappy = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.24)
    static let quick = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.16)
}

/// Corner radii. Surfaces are flat and ruled; only controls and media round.
enum Radius {
    static let control: CGFloat = 10
    static let media: CGFloat = 12
    static let chip: CGFloat = 4
}

enum Metrics {
    static let gutter: CGFloat = 16
    static let tabBarClearance: CGFloat = 110
}

/// A title that shrinks just enough for its longest word to fit on one line,
/// so very large text never breaks a word in the middle. Otherwise it wraps
/// like any text and follows the user's text size.
struct WordFittingTitle: View {
    var text: String
    var size: CGFloat
    var weight: UIFont.Weight = .semibold
    var tracking: CGFloat = 0
    /// Looks the text up in the string catalog, for fixed labels.
    var localized = false
    /// The serif display face (default), or SF.
    var serif = true
    @State private var width: CGFloat = 0
    /// Read so the title re-measures when the text size changes.
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let scaled = TypeScale.scaled(size)
        let fit = factor(scaled)
        (localized ? Text(LocalizedStringKey(text)) : Text(verbatim: text))
            .font(Font(face(scaled * fit) as CTFont))
            .tracking(tracking * fit)
            .frame(maxWidth: .infinity, alignment: .leading)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
    }

    private func face(_ size: CGFloat) -> UIFont {
        serif ? .display(ofSize: size, weight: weight) : .systemFont(ofSize: size, weight: weight)
    }

    private func factor(_ scaled: CGFloat) -> CGFloat {
        guard width > 0 else { return 1 }
        let attributes: [NSAttributedString.Key: Any] = [.font: face(scaled), .kern: tracking]
        let longest = text.split(whereSeparator: \.isWhitespace)
            .map { (String($0) as NSString).size(withAttributes: attributes).width }
            .max() ?? 0
        // SwiftUI sets text a little wider than UIKit measures it; keep a margin.
        let room = width * 0.92
        guard longest > room else { return 1 }
        return max(0.5, room / longest)
    }
}
