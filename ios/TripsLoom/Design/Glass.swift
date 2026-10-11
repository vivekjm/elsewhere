import SwiftUI

// Frosted surfaces: rgba(255,255,255,.07) over a 30px blur, a 1px white/.09 edge
// and a brighter top highlight.

struct GlassSurface<S: InsettableShape>: ViewModifier {
    var shape: S
    var fill: Color = .white.opacity(0.07)
    var edge: Double = 0.09
    var highlight: Double = 0.14
    var blur = true
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    func body(content: Content) -> some View {
        content.background {
            ZStack {
                if reduceTransparency { shape.fill(Color(hex: 0x242A32)) }
                if blur && !reduceTransparency {
                    shape.fill(.ultraThinMaterial).opacity(0.5)
                }
                shape.fill(fill)
            }
            .overlay { shape.strokeBorder(Color.white.opacity(contrast == .increased ? max(edge, 0.35) : edge), lineWidth: 1) }
            .overlay {
                shape.strokeBorder(
                    LinearGradient(
                        stops: [
                            .init(color: .white.opacity(highlight), location: 0),
                            .init(color: .white.opacity(0), location: 0.12),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 1
                )
            }
        }
    }
}

extension View {
    func glass(_ radius: CGFloat = 28, fill: Color = .white.opacity(0.07), blur: Bool = true) -> some View {
        modifier(GlassSurface(shape: RoundedRectangle(cornerRadius: radius, style: .continuous), fill: fill, blur: blur))
    }

    func glassCapsule(fill: Color = .white.opacity(0.07)) -> some View {
        modifier(GlassSurface(shape: Capsule(), fill: fill))
    }

    /// Standard glass card: 28 radius, 16 padding.
    func glassCard(radius: CGFloat = 28, padding: CGFloat = 16) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glass(radius)
    }
}

// MARK: Backgrounds

/// Every screen sits on the trip photo, blurred 40px, under a dark overlay.
struct PhotoBackdrop: View {
    var photo: Photo
    var top: Double = 0.5
    var bottom: Double = 0.85

    var body: some View {
        ZStack {
            Color(hex: 0x1A1E24)
            Color.clear
                .overlay {
                    RemotePhoto(photo: photo, width: 600)
                        .blur(radius: 40, opaque: true)
                        .saturation(1.3)
                        .scaleEffect(1.15)
                }
                .clipped()
            LinearGradient(
                colors: [Color(hex: 0x080A0E, opacity: top), Color(hex: 0x080A0E, opacity: bottom)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
    }
}

/// The sharp photo at the top of detail screens, fading out below 45%.
struct HeroPhoto: View {
    var photo: Photo
    var height: CGFloat = 380
    /// That day's weather, animated over the photo.
    var sky: WeatherService.Day? = nil

    var body: some View {
        Color.clear
            .frame(height: height)
            .overlay { RemotePhoto(photo: photo, width: 900) }
            .overlay { if let sky { WeatherSky(day: sky).transition(.opacity) } }
            .animation(.easeInOut(duration: 0.8), value: sky?.code)
            .clipped()
            .mask {
                LinearGradient(
                    stops: [.init(color: .black, location: 0.45), .init(color: .clear, location: 1)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            .frame(maxWidth: .infinity)
            .allowsHitTesting(false)
    }
}

/// A screen scaffold: backdrop, scrolling content with the design's gutters,
/// and room at the bottom for the floating tab bar.
///
/// With a `hero`, the sharp photo runs under the status bar and toolbar, and
/// the content starts `heroContentTop` points below the toolbar. Design
/// values assume the toolbar ends 102pt from the top of the screen. Pulling
/// down stretches the hero; scrolling up drifts it at half speed.
///
/// With a `title`, the big header collapses into the toolbar as it scrolls
/// away, like a system large title.
///
/// Each top-level child rises in, one after another, the first time the
/// screen appears, and eases back as it scrolls under the bars.
struct NightScreen<Content: View>: View {
    var photo: Photo
    var top: Double = 0.5
    var bottom: Double = 0.85
    var hero: CGFloat? = nil
    var heroContentTop: CGFloat = 0
    var spacing: CGFloat = 14
    var bottomInset: CGFloat = 24
    var title: String? = nil
    /// Shown under the toolbar title once the header has collapsed.
    var subtitle: String? = nil
    /// Weather animated over the hero photo.
    var sky: WeatherService.Day? = nil
    /// A control (like section tabs) that follows the header and then sticks
    /// under the bar. Pass the same control as the second child of the page.
    var pinned: AnyView? = nil
    /// The pinned control's selection. When it changes while pinned, the new
    /// section starts from its top, with the control still pinned.
    var pinnedKey: AnyHashable? = nil
    @ViewBuilder var content: Content

    @State private var safeTop: CGFloat = 0
    /// Height of the hero header (the first child), for the folded position.
    @State private var headerHeight: CGFloat = 0
    /// Room added below a short page so it can scroll to the folded position.
    @State private var extra: CGFloat = 0
    @State private var insetTop: CGFloat = 0
    @State private var isPinned = false
    @State private var pinnedHeight: CGFloat = 0
    @State private var collapse: Double = 0
    @State private var shown = false
    @State private var scroll = ScrollPull()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollViewReader { proxy in
        ScrollView {
            stack
                .padding(.top, hero == nil ? 0 : heroContentTop)
                // Invisible marks at the open and folded positions, for settling.
                .background(alignment: .top) {
                    if hero != nil {
                        VStack(spacing: 0) {
                            Color.clear.frame(height: 1).id(HeroMark.open)
                            Color.clear.frame(height: max(foldedOffset - 1, 0))
                            Color.clear.frame(height: 1).id(HeroMark.folded)
                        }
                        .allowsHitTesting(false)
                    }
                }
                .background(alignment: .top) {
                    if let hero {
                        heroPhoto(hero + safeTop - 102)
                    }
                }
        }
        .scrollIndicators(.hidden)
        .background { PhotoBackdrop(photo: photo, top: top, bottom: bottom) }
        // Under the bar, content fades into a copy of the page's own blurred
        // backdrop, so there's no seam or colour step. It appears as the
        // header folds away; at rest the hero photo shows through.
        .overlay(alignment: .top) {
            PhotoBackdrop(photo: photo, top: top, bottom: bottom)
                .mask(alignment: .top) {
                    // Solid behind the status bar, then easing out by the
                    // bar's bottom edge; the system's progressive blur does
                    // the rest, so content reappears right under the bar.
                    VStack(spacing: 0) {
                        Rectangle().frame(height: safeTop)
                        LinearGradient(
                            stops: [
                                .init(color: .black, location: 0),
                                .init(color: .black.opacity(0.75), location: 0.35),
                                .init(color: .black.opacity(0.3), location: 0.7),
                                .init(color: .clear, location: 1),
                            ],
                            startPoint: .top, endPoint: .bottom
                        )
                        .frame(height: 30)
                        Spacer(minLength: 0)
                    }
                    .ignoresSafeArea()
                }
                .opacity(hero == nil ? collapse : max(0, (collapse - 0.35) / 0.65))
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        // The sticky control: once the in-page copy reaches the bar, this
        // copy takes over on the page's own backdrop, so nothing scrolling
        // underneath shows above or behind it.
        .overlay(alignment: .top) {
            if let pinned, isPinned {
                ZStack(alignment: .top) {
                    PhotoBackdrop(photo: photo, top: top, bottom: bottom)
                        .mask(alignment: .top) {
                            VStack(spacing: 0) {
                                Rectangle().frame(height: insetTop + Self.pinGap + pinnedHeight + 8)
                                LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom).frame(height: 18)
                                Spacer(minLength: 0)
                            }
                            .ignoresSafeArea()
                        }
                        .allowsHitTesting(false)
                    pinned
                        .padding(.horizontal, Metrics.gutter)
                        .padding(.top, insetTop + Self.pinGap)
                        .ignoresSafeArea(edges: .top)
                }
                .ignoresSafeArea(edges: .top)
            }
        }
        .scrollEdgeEffectStyle(.soft, for: .top)
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { safeTop = $0 }
        // Over a hero the scroll rests only open or folded, never with the
        // next section half under the bar.
        .scrollTargetBehavior(HeaderSnap(folded: hero == nil ? 0 : foldedOffset, insetTop: insetTop))
        // A slow drag that ends mid-way has no momentum to snap; settle it
        // once scrolling stops.
        .onScrollPhaseChange { [hero, foldedOffset] _, phase, context in
            guard hero != nil, phase == .idle else { return }
            let y = context.geometry.contentOffset.y + context.geometry.contentInsets.top
            guard y > 1, y < foldedOffset + 26, abs(y - foldedOffset) > 1 else { return }
            withAnimation(.spring(duration: 0.35, bounce: 0)) {
                proxy.scrollTo(y > foldedOffset / 2 ? HeroMark.folded : HeroMark.open, anchor: .top)
            }
        }
        .onScrollGeometryChange(for: CGFloat.self) { $0.contentInsets.top } action: { _, value in insetTop = value }
        .onScrollGeometryChange(for: Bool.self) { [pinned, foldedOffset] geo in
            pinned != nil && geo.contentOffset.y + geo.contentInsets.top >= foldedOffset - 0.5
        } action: { _, value in isPinned = value }
        .onScrollGeometryChange(for: CGFloat.self) { [hero, extra, foldedOffset] geo in
            // A short page gets exactly enough room to reach the folded position.
            guard hero != nil else { return 0 }
            let natural = geo.contentSize.height - extra
            // containerSize already excludes the bars' insets.
            let reach = natural - geo.containerSize.height
            // A little spare, so a section switch never lands short of folded.
            return max(0, (foldedOffset - reach + 24).rounded())
        } action: { _, value in extra = value }
        .onScrollGeometryChange(for: Double.self) { [hero, foldedOffset] geo in
            // Quantised so the title fades in steps without redrawing the
            // whole screen on every scrolled point. Over a hero, the header
            // hands over across the first two thirds of the way to folded.
            let y = Double(geo.contentOffset.y + geo.contentInsets.top)
            let progress = hero == nil
                ? (y - 24) / 48
                : (y - Double(foldedOffset) * 0.1) / (Double(foldedOffset) * 0.6)
            return (max(0, min(1, progress)) * 20).rounded() / 20
        } action: { _, value in
            collapse = value
        }
        .onScrollGeometryChange(for: CGFloat.self) { geo in
            -(geo.contentOffset.y + geo.contentInsets.top)
        } action: { _, value in
            // Only the hero layer reads this, so scrolling doesn't redraw
            // the rest of the screen.
            if hero != nil { scroll.pull = value }
        }
        // Design titles live in the content; the bar never takes large-title space.
        .navigationBarTitleDisplayMode(.inline)
        .environment(\.headerCollapse, title == nil ? 0 : collapse)
        .toolbar {
            if let title {
                ToolbarItem(placement: .principal) {
                    // Bar titles stop growing at accessibility sizes, as system
                    // bars do; a long press shows them in the large content viewer.
                    VStack(spacing: 1) {
                        Text(title)
                            .font(.system(size: min(TypeScale.scaled(17), 24), weight: .semibold))
                            .foregroundStyle(.white)
                        if let subtitle {
                            Text(subtitle)
                                .font(.system(size: min(TypeScale.scaled(12), 17), weight: .medium))
                                .foregroundStyle(Color.white.opacity(0.7))
                        }
                    }
                    .lineLimit(1)
                    .accessibilityShowsLargeContentViewer {
                        Text(subtitle.map { "\(title)\n\($0)" } ?? title)
                    }
                    .opacity(collapse)
                    .offset(y: (1 - collapse) * 10)
                    .scaleEffect(0.92 + collapse * 0.08)
                    .accessibilityHidden(collapse < 0.5)
                }
            }
        }
        .onAppear {
            guard !shown else { return }
            if reduceMotion { shown = true } else { withAnimation { shown = true } }
        }
        .onChange(of: pinnedKey) {
            guard isPinned else { return }
            // After the new section has laid out (and the page's scroll room
            // has been recomputed), go to the folded position without animation.
            Task { @MainActor in
                var instant = Transaction()
                instant.disablesAnimations = true
                await Task.yield()
                withTransaction(instant) { proxy.scrollTo(HeroMark.folded, anchor: .top) }
                // Again once the switch animation has settled the layout.
                try? await Task.sleep(for: .milliseconds(450))
                withTransaction(instant) { proxy.scrollTo(HeroMark.folded, anchor: .top) }
            }
        }
        }
    }

    private var stack: some View {
        VStack(alignment: .leading, spacing: spacing) {
            Group(subviews: content) { children in
                ForEach(Array(children.enumerated()), id: \.element.id) { index, child in
                    child
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                            if index == 0 { headerHeight = height }
                            if index == 1, pinned != nil { pinnedHeight = height }
                        }
                        // The in-page copy hides while the sticky one shows.
                        .opacity(index == 1 && isPinned ? 0 : 1)
                        .modifier(Entrance(index: index, shown: shown))
                        // The hero header runs its own collapse.
                        .modifier(ScrollDepth(enabled: !(hero != nil && index == 0)))
                }
            }
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.bottom, bottomInset)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, extra)
    }

    /// Space between the bar and a pinned control.
    static var pinGap: CGFloat { 6 }

    /// Scroll position where the header has folded away and the next
    /// section sits right under the bar.
    private var foldedOffset: CGFloat {
        max(heroContentTop + headerHeight + spacing - Self.pinGap, 1)
    }

    private func heroPhoto(_ height: CGFloat) -> some View {
        HeroLayer(photo: photo, height: height, safeTop: safeTop, scroll: scroll, still: reduceMotion, sky: sky)
    }
}

private enum HeroMark: Hashable { case open, folded }

/// Snaps a released scroll inside the header zone to open or folded.
struct HeaderSnap: ScrollTargetBehavior {
    var folded: CGFloat
    var insetTop: CGFloat

    func updateTarget(_ target: inout ScrollTarget, context: TargetContext) {
        // Only flicks: layout changes (like the bar's inset arriving as the
        // page opens) also pass through here with no velocity. Slow releases
        // are settled when scrolling stops.
        let velocity = context.velocity.dy
        guard folded > 1, insetTop > 0, abs(velocity) > 0.3 else { return }
        let y = target.rect.minY + insetTop
        // Up to the spare room past folded counts as folded.
        guard y > 0, y < folded + 26 else { return }
        target.rect.origin.y = (velocity > 0 || y >= folded ? folded : 0) - insetTop
    }
}

@Observable
final class ScrollPull {
    /// > 0 while pulling down past the top, < 0 once scrolled.
    var pull: CGFloat = 0
}

/// The hero photo: stretches when pulled down, drifts at half speed and
/// fades as the content scrolls over it.
private struct HeroLayer: View {
    var photo: Photo
    var height: CGFloat
    var safeTop: CGFloat
    var scroll: ScrollPull
    var still: Bool
    var sky: WeatherService.Day?

    var body: some View {
        let pull = still ? 0 : scroll.pull
        HeroPhoto(photo: photo, height: height, sky: sky)
            .scaleEffect(pull > 0 ? (height + pull) / max(height, 1) : 1, anchor: .top)
            .offset(y: -safeTop + (pull > 0 ? -pull : -pull * 0.45))
            .opacity(pull < 0 ? max(0.25, 1 + pull / (height * 1.2)) : 1)
    }
}


extension View {
    /// System forms pushed from Profile: the app's photo backdrop instead of
    /// plain black, and no tab bar over the last rows.
    func formScreen(photo: Photo = .tram) -> some View {
        scrollContentBackground(.hidden)
            .background { PhotoBackdrop(photo: photo).ignoresSafeArea() }
            .toolbar(.hidden, for: .tabBar)
    }
}
