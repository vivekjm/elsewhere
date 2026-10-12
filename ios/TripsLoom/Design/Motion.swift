import SwiftUI

// Motion system: zoom transitions, staged entrances, collapsing headers,
// parallax photos and press feedback. Everything checks Reduce Motion.

extension Animation {
    /// Springy but settled, for things arriving on screen.
    static let arrive = Animation.spring(duration: 0.55, bounce: 0.18)
    /// For data drawing in: rings, bars, lines.
    static let draw = Animation.spring(duration: 0.9, bounce: 0.05)
}

// MARK: Zoom transitions

extension EnvironmentValues {
    /// Shared namespace for zoom transitions into trips and modals.
    @Entry var zoomNamespace: Namespace.ID?
}

extension View {
    /// Marks this view as where a zoom transition starts and ends.
    func zoomSource(_ id: String, radius: CGFloat = 12) -> some View {
        modifier(ZoomSource(id: id, radius: radius))
    }

    /// Zooms this presented or pushed view out of the matching `zoomSource`.
    @ViewBuilder
    func zoomTransition(_ id: String?, in namespace: Namespace.ID?) -> some View {
        if let id, let namespace {
            navigationTransition(.zoom(sourceID: id, in: namespace))
        } else {
            self
        }
    }
}

private struct ZoomSource: ViewModifier {
    var id: String
    var radius: CGFloat
    @Environment(\.zoomNamespace) private var namespace

    func body(content: Content) -> some View {
        if let namespace {
            content.matchedTransitionSource(id: id, in: namespace) { source in
                source.clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            }
        } else {
            content
        }
    }
}

// MARK: Press feedback

/// Cards sink slightly and dim when pressed, like the system's tappable
/// platters, then spring back.
struct CardPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.965 : 1)
            .brightness(configuration.isPressed ? -0.04 : 0)
            .animation(.spring(duration: 0.3, bounce: 0.3), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == CardPressStyle {
    static var card: CardPressStyle { CardPressStyle() }
}

// MARK: Staged entrance

/// Rises and fades in once, a little after the item before it.
struct Entrance: ViewModifier {
    var index: Int
    var shown: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(shown || reduceMotion ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 22)
            .scaleEffect(shown || reduceMotion ? 1 : 0.98, anchor: .top)
            .animation(.arrive.delay(Double(min(index, 8)) * 0.045), value: shown)
    }
}

/// Cards ease back as they scroll under the top bar or up from the tab bar.
struct ScrollDepth: ViewModifier {
    var enabled = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion || !enabled {
            content
        } else {
            content.scrollTransition(.interactive.threshold(.visible(0.35)), axis: .vertical) { view, phase in
                // A slight settle only; fading is left to the bar's blur.
                view
                    .scaleEffect(phase.isIdentity ? 1 : 0.98, anchor: phase.value < 0 ? .bottom : .top)
            }
        }
    }
}

// MARK: Collapsing header

extension EnvironmentValues {
    /// 0 when a screen's big title is fully visible, 1 once it has scrolled
    /// under the toolbar.
    @Entry var headerCollapse: Double = 0
}

// MARK: Parallax

extension View {
    /// Drifts a photo against the scroll so it feels deeper than its card.
    /// The photo should be overscaled so its edges never show.
    func parallax(_ amount: CGFloat = 0.08, limit: CGFloat = 22) -> some View {
        modifier(Parallax(amount: amount, limit: limit))
    }
}

private struct Parallax: ViewModifier {
    var amount: CGFloat
    var limit: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content.visualEffect { view, proxy in
                let mid = proxy.frame(in: .global).midY
                let offset = max(-limit, min(limit, (mid - 420) * -amount))
                return view.offset(y: offset)
            }
        }
    }
}

// MARK: Loading shimmer

/// A soft light sweep for content that is on its way.
struct Shimmer: ViewModifier {
    var active: Bool
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .overlay {
                if active && !reduceMotion {
                    GeometryReader { geo in
                        LinearGradient(
                            colors: [.clear, .white.opacity(0.18), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geo.size.width * 0.6)
                        .offset(x: phase * geo.size.width * 1.6)
                        .blendMode(.plusLighter)
                    }
                    .allowsHitTesting(false)
                    .onAppear {
                        phase = -1
                        withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) { phase = 1 }
                    }
                }
            }
    }
}

extension View {
    func shimmer(_ active: Bool = true) -> some View { modifier(Shimmer(active: active)) }
}
