import ActivityKit
import SwiftUI
import WidgetKit

@main
struct TripsLoomWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TripLiveActivity()
        NextTripWidget()
    }
}

private enum Palette {
    static let lime = Color(red: 0.831, green: 0.961, blue: 0.290)
    static let mint = Color(red: 0.239, green: 0.961, blue: 0.659)
    static let coral = Color(red: 1, green: 0.42, blue: 0.42)
    static let muted = Color.white.opacity(0.62)
    static let faint = Color.white.opacity(0.12)
    static let indigo = Color(red: 0.275, green: 0.212, blue: 0.910)
    static let green = Color(red: 0.180, green: 0.545, blue: 0.290)
}

struct TripLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TripActivityAttributes.self) { context in
            LockScreenCard(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color(red: 0.055, green: 0.063, blue: 0.086).opacity(0.5))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let accent = context.attributes.kind == .trail ? Palette.mint : Palette.lime
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(context.state.islandLeading)
                    } icon: {
                        Image(systemName: symbol(context.attributes.kind)).foregroundStyle(accent)
                    }
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.islandTrailing)
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Palette.lime)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(context.state.headline).font(.system(size: 15, weight: .semibold))
                        MetricRow(metrics: context.state.metrics, size: 20)
                        Bar(progress: context.state.progress, color: accent)
                    }
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: symbol(context.attributes.kind)).foregroundStyle(accent)
                    Text(context.state.islandLeading)
                }
                .font(.system(size: 12.5, weight: .semibold, design: .monospaced))
            } compactTrailing: {
                Text(context.state.islandTrailing)
                    .font(.system(size: 12.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Palette.lime)
            } minimal: {
                Image(systemName: symbol(context.attributes.kind)).foregroundStyle(accent)
            }
        }
    }

    private func symbol(_ kind: TripActivityAttributes.Kind) -> String {
        kind == .flight ? "airplane" : "mountain.2.fill"
    }
}

private struct LockScreenCard: View {
    var attributes: TripActivityAttributes
    var state: TripActivityAttributes.ContentState

    var body: some View {
        let accent = attributes.kind == .trail ? Palette.mint : Palette.lime
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: attributes.kind == .flight ? "airplane" : "mountain.2.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(attributes.kind == .flight ? Palette.indigo : Palette.green))
                    Text(state.headline)
                        .font(.system(size: 15, weight: .semibold))
                        .lineLimit(1)
                }
                Spacer()
                if attributes.kind == .flight {
                    Text(state.status.uppercased())
                        .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                        .foregroundStyle(state.statusIsAlert ? Palette.coral : Palette.mint)
                        .padding(.horizontal, 9)
                        .frame(height: 24)
                        .background(Capsule().fill((state.statusIsAlert ? Palette.coral : Palette.mint).opacity(0.14)))
                } else {
                    Text(state.status.uppercased())
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Palette.muted)
                }
            }
            MetricRow(metrics: state.metrics, size: 26)
            Bar(progress: state.progress, color: accent)
            if let footnote = state.footnote {
                Text(footnote.uppercased())
                    .font(.system(size: 11.5, design: .monospaced))
                    .foregroundStyle(Palette.muted)
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
    }
}

private struct MetricRow: View {
    var metrics: [TripActivityAttributes.Metric]
    var size: CGFloat

    var body: some View {
        HStack(alignment: .bottom) {
            ForEach(Array(metrics.enumerated()), id: \.offset) { index, metric in
                VStack(alignment: alignment(index), spacing: 4) {
                    Text(metric.label.uppercased())
                        .font(.system(size: 12, design: .monospaced))
                        .tracking(0.7)
                        .foregroundStyle(Palette.muted)
                    Text(metric.value)
                        .font(.system(size: size, weight: .semibold, design: .monospaced))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment(index), vertical: .bottom))
            }
        }
    }

    private func alignment(_ index: Int) -> HorizontalAlignment {
        index == 0 ? .leading : index == metrics.count - 1 ? .trailing : .center
    }
}

private struct Bar: View {
    var progress: Double
    var color: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.faint)
                Capsule().fill(color)
                    .frame(width: geo.size.width * max(0, min(1, progress)))
                    .shadow(color: color.opacity(0.4), radius: 5)
            }
        }
        .frame(height: 6)
    }
}
