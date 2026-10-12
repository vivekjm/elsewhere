import SwiftUI

/// Animated weather drawn over a trip's hero photo, like Apple Weather:
/// falling rain, drifting cloud, snow, fog, a storm's lightning or the sun's
/// glow, from that day's forecast. Particles are computed from the time, so
/// nothing is stored between frames. With Reduce Motion it holds still.
struct WeatherSky: View {
    var day: WeatherService.Day
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    enum Effect: Equatable {
        case clear, partly, cloudy, fog, drizzle, rain, heavyRain, snow, storm
    }

    static func effect(_ code: Int) -> Effect {
        switch code {
        case 0: .clear
        case 1, 2: .partly
        case 45, 48: .fog
        case 51...57: .drizzle
        case 65, 82: .heavyRain
        case 61...67, 80, 81: .rain
        case 71...77, 85, 86: .snow
        case 95...99: .storm
        default: .cloudy
        }
    }

    var body: some View {
        let effect = Self.effect(day.code)
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { timeline in
            let t = reduceMotion ? 12 : timeline.date.timeIntervalSinceReferenceDate
            Canvas { context, size in
                Self.draw(effect, in: &context, size: size, time: t)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: Drawing

    private static func draw(_ effect: Effect, in context: inout GraphicsContext, size: CGSize, time t: Double) {
        switch effect {
        case .clear:
            sun(&context, size, t, strength: 1)
        case .partly:
            sun(&context, size, t, strength: 0.7)
            clouds(&context, size, t, count: 3, opacity: 0.13)
        case .cloudy:
            dim(&context, size, 0.12)
            clouds(&context, size, t, count: 6, opacity: 0.16)
        case .fog:
            dim(&context, size, 0.1)
            fog(&context, size, t)
        case .drizzle:
            dim(&context, size, 0.16)
            clouds(&context, size, t, count: 5, opacity: 0.14)
            rain(&context, size, t, count: 70, speed: 380...520, length: 7...12, opacity: 0.28)
        case .rain:
            dim(&context, size, 0.22)
            clouds(&context, size, t, count: 5, opacity: 0.14)
            rain(&context, size, t, count: 140, speed: 750...1050, length: 14...24, opacity: 0.34)
        case .heavyRain:
            dim(&context, size, 0.3)
            clouds(&context, size, t, count: 6, opacity: 0.16)
            rain(&context, size, t, count: 230, speed: 950...1300, length: 18...30, opacity: 0.4)
        case .snow:
            dim(&context, size, 0.1)
            clouds(&context, size, t, count: 4, opacity: 0.12)
            snow(&context, size, t)
        case .storm:
            dim(&context, size, 0.34)
            clouds(&context, size, t, count: 6, opacity: 0.18)
            rain(&context, size, t, count: 200, speed: 1000...1350, length: 18...30, opacity: 0.4)
            lightning(&context, size, t)
        }
    }

    /// A stable pseudo-random number in 0..<1 for particle `i`.
    private static func rnd(_ i: Int, _ salt: Int) -> Double {
        let x = sin(Double(i &* 127 &+ salt &* 311) * 12.9898) * 43758.5453
        return x - x.rounded(.down)
    }

    private static func dim(_ context: inout GraphicsContext, _ size: CGSize, _ amount: Double) {
        context.fill(
            Path(CGRect(origin: .zero, size: size)),
            with: .linearGradient(
                Gradient(colors: [Color(hex: 0x0A1420, opacity: amount), Color(hex: 0x0A1420, opacity: amount * 0.3)]),
                startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height)
            )
        )
    }

    private static func sun(_ context: inout GraphicsContext, _ size: CGSize, _ t: Double, strength: Double) {
        let center = CGPoint(x: size.width * 0.82, y: size.height * 0.1)
        let pulse = 0.9 + 0.1 * sin(t * 0.8)
        let radius = size.width * 0.55 * pulse
        context.fill(
            Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)),
            with: .radialGradient(
                Gradient(colors: [Color(hex: 0xFFE9A8, opacity: 0.42 * strength), Color(hex: 0xFFC76B, opacity: 0.12 * strength), .clear]),
                center: center, startRadius: 0, endRadius: radius
            )
        )
        // Slowly turning rays.
        var rays = context
        rays.blendMode = .plusLighter
        rays.translateBy(x: center.x, y: center.y)
        rays.rotate(by: .radians(t * 0.05))
        let length = size.width * 0.9
        for i in 0..<12 {
            let angle = Double(i) / 12 * 2 * .pi + rnd(i, 3) * 0.2
            let width = 0.03 + rnd(i, 4) * 0.04
            var ray = Path()
            ray.move(to: .zero)
            ray.addLine(to: CGPoint(x: cos(angle - width) * length, y: sin(angle - width) * length))
            ray.addLine(to: CGPoint(x: cos(angle + width) * length, y: sin(angle + width) * length))
            ray.closeSubpath()
            let flicker = 0.5 + 0.5 * sin(t * 0.6 + Double(i))
            rays.fill(ray, with: .radialGradient(
                Gradient(colors: [Color(hex: 0xFFF1C9, opacity: 0.12 * strength * flicker), .clear]),
                center: .zero, startRadius: 0, endRadius: length
            ))
        }
    }

    private static func clouds(_ context: inout GraphicsContext, _ size: CGSize, _ t: Double, count: Int, opacity: Double) {
        context.drawLayer { layer in
            layer.addFilter(.blur(radius: 22))
            for i in 0..<count {
                let w = size.width * (0.5 + rnd(i, 1) * 0.5)
                let h = w * (0.28 + rnd(i, 2) * 0.12)
                let speed = 6 + rnd(i, 3) * 10
                let span = size.width + w * 2
                let x = (rnd(i, 4) * span + t * speed).truncatingRemainder(dividingBy: span) - w
                let y = size.height * (0.02 + rnd(i, 5) * 0.4)
                // Each cloud is a few overlapping puffs.
                for p in 0..<3 {
                    let px = x + w * (0.2 + Double(p) * 0.25)
                    let py = y + h * (p == 1 ? -0.25 : 0.05)
                    let r = h * (p == 1 ? 0.8 : 0.6)
                    layer.fill(Path(ellipseIn: CGRect(x: px - r, y: py - r * 0.7, width: r * 2, height: r * 1.4)),
                               with: .color(.white.opacity(opacity)))
                }
            }
        }
    }

    private static func fog(_ context: inout GraphicsContext, _ size: CGSize, _ t: Double) {
        context.drawLayer { layer in
            layer.addFilter(.blur(radius: 26))
            for i in 0..<5 {
                let w = size.width * 1.4
                let h = size.height * (0.1 + rnd(i, 1) * 0.08)
                let drift = sin(t * (0.05 + rnd(i, 2) * 0.05) + Double(i)) * size.width * 0.2
                let y = size.height * (0.15 + Double(i) * 0.16)
                layer.fill(Path(roundedRect: CGRect(x: -size.width * 0.2 + drift, y: y, width: w, height: h), cornerRadius: h / 2),
                           with: .color(.white.opacity(0.1 + rnd(i, 3) * 0.06)))
            }
        }
    }

    private static func rain(_ context: inout GraphicsContext, _ size: CGSize, _ t: Double, count: Int,
                             speed: ClosedRange<Double>, length: ClosedRange<Double>, opacity: Double) {
        let slant = 0.16
        var near = Path(), far = Path()
        for i in 0..<count {
            let v = speed.lowerBound + rnd(i, 1) * (speed.upperBound - speed.lowerBound)
            let len = length.lowerBound + rnd(i, 2) * (length.upperBound - length.lowerBound)
            let span = size.height + len
            let y = (rnd(i, 3) * span + t * v).truncatingRemainder(dividingBy: span) - len
            let x = rnd(i, 4) * (size.width + size.height * slant) - y * slant
            let start = CGPoint(x: x, y: y), end = CGPoint(x: x - len * slant, y: y + len)
            if i % 3 == 0 {
                near.move(to: start); near.addLine(to: end)
            } else {
                far.move(to: start); far.addLine(to: end)
            }
        }
        context.stroke(far, with: .color(.white.opacity(opacity * 0.6)), style: StrokeStyle(lineWidth: 0.9, lineCap: .round))
        context.stroke(near, with: .color(.white.opacity(opacity)), style: StrokeStyle(lineWidth: 1.4, lineCap: .round))
    }

    private static func snow(_ context: inout GraphicsContext, _ size: CGSize, _ t: Double) {
        for i in 0..<90 {
            let v = 22 + rnd(i, 1) * 40
            let r = 1.2 + rnd(i, 2) * 2.2
            let span = size.height + r * 2
            let y = (rnd(i, 3) * span + t * v).truncatingRemainder(dividingBy: span) - r
            let x = rnd(i, 4) * size.width + sin(t * (0.6 + rnd(i, 5) * 0.6) + Double(i)) * 14
            context.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)),
                         with: .color(.white.opacity(0.45 + rnd(i, 6) * 0.4)))
        }
    }

    private static func lightning(_ context: inout GraphicsContext, _ size: CGSize, _ t: Double) {
        // A double flash every seven seconds or so.
        let phase = t.truncatingRemainder(dividingBy: 7.3)
        var flash = 0.0
        if phase < 0.12 { flash = 1 - phase / 0.12 }
        else if phase > 0.22, phase < 0.34 { flash = 0.6 * (1 - (phase - 0.22) / 0.12) }
        guard flash > 0 else { return }
        context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.white.opacity(0.28 * flash)))
    }
}

/// "☁ 25° Drizzle · L 13° · 80% rain" for a trip's hero, with where and when.
private struct BadgeShape: ViewModifier {
    var rounded: Bool

    func body(content: Content) -> some View {
        if rounded {
            content.glass(22, fill: Color(hex: 0x0A0C10, opacity: 0.35))
        } else {
            content.glassCapsule(fill: Color(hex: 0x0A0C10, opacity: 0.35))
        }
    }
}

struct HeroWeatherBadge: View {
    var day: WeatherService.Day
    /// "Wed 30 · Lisbon"
    var when: String
    @Environment(\.dynamicTypeSize) private var typeSize

    private var detail: String {
        var parts: [String] = ["L \(day.low)°"]
        if day.typical == true { parts.append("last year") } else if day.rainChance >= 20 { parts.append("\(day.rainChance)% rain") }
        if !when.isEmpty { parts.append(when) }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: day.symbol)
                .symbolRenderingMode(.multicolor)
                .font(.system(size: 22))
            VStack(alignment: .leading, spacing: 1) {
                Text(day.typical == true ? "Usually \(day.high)° · \(day.summary.lowercased())" : "\(day.high)° · \(day.summary)")
                    .font(.sf(16, .semibold))
                    .foregroundStyle(.white)
                Text(detail)
                    .font(.sf(12))
                    .foregroundStyle(.white.opacity(0.75))
                    .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
            }
        }
        .padding(.leading, 12)
        .padding(.trailing, 16)
        .padding(.vertical, typeSize.isAccessibilitySize ? 12 : 8)
        // Wrapped lines at accessibility sizes would run into a capsule's ends.
        .modifier(BadgeShape(rounded: typeSize.isAccessibilitySize))
        .accessibilityElement(children: .combine)
    }
}

/// The title block over a hero photo. As the page scrolls it lifts faster
/// than the content, shrinks and fades, handing over to the toolbar title.
struct HeroHeader<Badge: View>: View {
    var chip: String
    var chipColor: Color
    var title: String
    var titleSize: CGFloat = 36
    var meta: String
    let badge: Badge
    @Environment(\.headerCollapse) private var collapse

    init(chip: String, chipColor: Color, title: String, titleSize: CGFloat = 36, meta: String,
         @ViewBuilder badge: () -> Badge) {
        self.chip = chip; self.chipColor = chipColor; self.title = title
        self.titleSize = titleSize; self.meta = meta
        self.badge = badge()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Chip(chip, tone: .onPhoto(chipColor))
            WordFittingTitle(text: title, size: min(titleSize, 36), tracking: -min(titleSize, 36) * 0.025)
                .foregroundStyle(.white)
                .padding(.top, 10)
                .fixedSize(horizontal: false, vertical: true)
            Text(meta).metaStyle(12).padding(.top, 6)
            badge.padding(.top, 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .opacity(max(0, 1 - collapse * 1.4))
        .scaleEffect(1 - collapse * 0.12, anchor: .bottomLeading)
        .offset(y: -collapse * 28)
        .blur(radius: collapse * 1.5)
    }
}
