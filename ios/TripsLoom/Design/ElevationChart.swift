import Charts
import SwiftUI

/// Mint elevation line with a dashed coral line at the altitude-sickness
/// height and a yellow marker for where you are (A1).
struct ElevationChart: View {
    var stages: [Stage]
    var current: Int
    var amsLine = 4000
    var mode: Mode = .stages
    /// Before the trip, the marker is the start, not "you".
    var started = true
    @State private var revealed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    enum Mode: Hashable { case stages, daily }

    private struct Point: Identifiable {
        var id: Int { day }
        var day: Int
        var value: Double
    }

    var body: some View {
        Group {
            switch mode {
            case .stages: elevation.transition(.opacity.combined(with: .scale(scale: 0.98)))
            case .daily: distance.transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        // The line draws in from the left the first time it's shown.
        .mask(alignment: .leading) {
            Rectangle().scaleEffect(x: revealed || reduceMotion ? 1 : 0, anchor: .leading)
        }
        .animation(.snappy, value: mode)
        .onAppear {
            guard !revealed, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.1).delay(0.25)) { revealed = true }
        }
    }

    private var points: [Point] {
        stages.map { Point(day: $0.day, value: Double($0.altitude)) }
    }

    private var domain: ClosedRange<Double> {
        let values = points.map(\.value)
        let low = ((values.min() ?? 0) - 400) / 500
        let high = ((values.max() ?? 1000) + 400) / 500
        return (low.rounded(.down) * 500)...(high.rounded(.up) * 500)
    }

    private var yTicks: [Double] {
        // The top edge gets no label: it would be clipped by the frame.
        stride(from: (domain.lowerBound / 1000).rounded(.up) * 1000, through: domain.upperBound - 300, by: 1000).map { $0 }
    }

    private var xTicks: [Int] {
        guard let first = stages.first?.day, let last = stages.last?.day else { return [] }
        let peak = stages.max { $0.altitude < $1.altitude }?.day
        let step = max((last - first) / 4, 1)
        var ticks = Array(stride(from: first, through: last, by: step))
        if let peak, !ticks.contains(peak) { ticks.append(peak) }
        if !ticks.contains(last) { ticks.append(last) }
        return ticks.sorted()
    }

    @ViewBuilder
    private var elevation: some View {
        let here = stages.indices.contains(current) ? stages[current] : nil
        let peak = stages.max { $0.altitude < $1.altitude }
        ZStack {
            // Glow under the line.
            Chart(points) { point in
                LineMark(x: .value("Day", point.day), y: .value("Altitude", point.value))
                    .interpolationMethod(.catmullRom)
                    .lineStyle(StrokeStyle(lineWidth: 4))
                    .foregroundStyle(Color.mint.opacity(0.7))
            }
            .chartYScale(domain: domain)
            .chartXScale(domain: (stages.first?.day ?? 0)...(stages.last?.day ?? 1))
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(position: .leading, values: yTicks) { _ in AxisValueLabel("00").foregroundStyle(.clear) }
            }
            .blur(radius: 4)

            Chart {
                ForEach(points) { point in
                    AreaMark(
                        x: .value("Day", point.day),
                        yStart: .value("Base", domain.lowerBound),
                        yEnd: .value("Altitude", point.value)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(colors: [.mint.opacity(0.28), .mint.opacity(0)], startPoint: .top, endPoint: .bottom))
                    LineMark(x: .value("Day", point.day), y: .value("Altitude", point.value))
                        .interpolationMethod(.catmullRom)
                        .lineStyle(StrokeStyle(lineWidth: 2.5))
                        .foregroundStyle(Color.mint)
                }
                if Double(amsLine) > domain.lowerBound && Double(amsLine) < domain.upperBound {
                    RuleMark(y: .value("AMS", amsLine))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 5]))
                        .foregroundStyle(Color.coral)
                        .annotation(position: .top, alignment: .leading, spacing: 2) {
                            Text("AMS \(Fmt.grouped(amsLine)) m").font(.mono(10, .semibold)).foregroundStyle(Color.coral)
                                .padding(.leading, 4)
                        }
                }
                if let peak, peak.id != here?.id {
                    PointMark(x: .value("Day", peak.day), y: .value("Altitude", peak.altitude))
                        .symbolSize(0)
                        .annotation(position: .top, alignment: peakAlignment(peak), spacing: 4) {
                            Text("\(shortName(peak.title)) \(Fmt.grouped(peak.altitude))")
                                .font(.mono(10.5, .bold))
                                .foregroundStyle(.white)
                                .fixedSize()
                        }
                }
                if let here {
                    RuleMark(x: .value("Now", here.day))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 4]))
                        .foregroundStyle(Color.white.opacity(0.5))
                    PointMark(x: .value("Day", here.day), y: .value("Altitude", here.altitude))
                        .symbolSize(260)
                        .foregroundStyle(Color.marker.opacity(0.25))
                    PointMark(x: .value("Day", here.day), y: .value("Altitude", here.altitude))
                        .symbolSize(110)
                        .foregroundStyle(Color.marker)
                        .annotation(position: Double(here.altitude) < (domain.lowerBound + domain.upperBound) / 2 ? .topTrailing : .bottomTrailing, spacing: 6) {
                            Text("\(started ? "You" : "Start") · \(Fmt.grouped(here.altitude)) m")
                                .font(.mono(11, .semibold))
                                .foregroundStyle(.white)
                                .fixedSize()
                                .padding(.horizontal, 9)
                                .padding(.vertical, 6)
                                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(hex: 0x0A0C10, opacity: 0.85)))
                                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.white.opacity(0.12), lineWidth: 1))
                        }
                }
            }
            .chartYScale(domain: domain)
            .chartXScale(domain: (stages.first?.day ?? 0)...(stages.last?.day ?? 1))
            .chartXAxis {
                AxisMarks(values: xTicks) { value in
                    AxisValueLabel {
                        if let day = value.as(Int.self) { Text("D\(day)").font(.mono(10)).foregroundStyle(Color.white.opacity(0.6)) }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: yTicks) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [4, 5])).foregroundStyle(Color.white.opacity(0.14))
                    AxisValueLabel {
                        if let v = value.as(Double.self) { Text("\(Int(v / 1000))k").font(.mono(10)).foregroundStyle(Color.white.opacity(0.6)) }
                    }
                }
            }
        }
        .frame(height: 160)
        .accessibilityElement()
        .accessibilityLabel("Elevation profile")
        .accessibilityValue(here.map { "Day \($0.day), \($0.altitude) metres. Highest \(peak?.altitude ?? 0) metres." } ?? "")
    }

    /// Keeps the peak label inside the chart when the peak is near an edge.
    private func peakAlignment(_ peak: Stage) -> Alignment {
        guard let first = stages.first?.day, let last = stages.last?.day, last > first else { return .center }
        let position = Double(peak.day - first) / Double(last - first)
        return position > 0.8 ? .trailing : position < 0.2 ? .leading : .center
    }

    private func barColor(_ stage: Stage) -> Color {
        let currentID = stages.indices.contains(current) ? stages[current].id : nil
        return stage.id == currentID ? Color.lime : Color.white.opacity(0.3)
    }

    private var distance: some View {
        Chart(stages) { stage in
            BarMark(x: .value("Day", "D\(stage.day)"), y: .value("Km", stage.km))
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .foregroundStyle(barColor(stage))
                .annotation(position: .top, spacing: 3) {
                    Text(Fmt.km(stage.km)).font(.mono(9.5)).foregroundStyle(Color.white.opacity(0.6))
                }
        }
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks { _ in
                AxisValueLabel().font(.mono(10)).foregroundStyle(Color.white.opacity(0.6))
            }
        }
        .frame(height: 160)
        .accessibilityLabel("Distance per day")
    }

    private func shortName(_ title: String) -> String {
        let last = title.components(separatedBy: "→").last?.trimmingCharacters(in: .whitespaces) ?? title
        let words = last.split(separator: " ")
        if words.count > 1, words.allSatisfy({ $0.first?.isUppercase == true }) {
            return words.map { String($0.prefix(1)) }.joined()
        }
        return String(last.prefix(10))
    }
}
