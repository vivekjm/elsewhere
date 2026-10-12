import SwiftUI

/// The pill chart used for daily spend (C7) and summit wind (A5): striped
/// tracks, rounded bars with a vertical value and a day badge.
struct PillBar: Identifiable {
    enum Style { case normal, highlight, danger }

    var id: Int
    var value: Double
    var label: String
    var badge: String
    var style: Style = .normal
    var callout: String?
}

struct PillBarChart: View {
    var bars: [PillBar]
    var height: CGFloat = 220
    var minimumBar: CGFloat = 92
    @State private var risen = false
    @State private var selected: Int?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize

    /// Room above the tallest bar for a callout, which grows with the text size.
    private var calloutRoom: CGFloat { (TypeScale.scaled(12) * 1.25 + 19).rounded(.up) }

    var body: some View {
        let maxValue = max(bars.map(\.value).max() ?? 1, 1)
        HStack(alignment: .bottom, spacing: 7) {
            ForEach(Array(bars.enumerated()), id: \.element.id) { index, bar in
                let barHeight = max(minimumBar, height * bar.value / maxValue)
                let calloutAlignment: Alignment = index == 0 ? .bottomLeading : index == bars.count - 1 ? .bottomTrailing : .bottom
                let up = risen || reduceMotion
                let callout = selected == bar.id ? "\(bar.badge) · \(bar.label)" : (selected == nil ? bar.callout : nil)
                ZStack(alignment: .bottom) {
                    StripeTrack()
                    barBody(bar, height: min(barHeight, height))
                        .scaleEffect(x: 1, y: up ? 1 : 0.02, anchor: .bottom)
                        .opacity(up ? 1 : 0)
                        .animation(.spring(duration: 0.7, bounce: 0.22).delay(Double(index) * 0.05), value: up)
                        .brightness(selected == bar.id ? 0.08 : 0)
                }
                .frame(height: height)
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.spring(duration: 0.35, bounce: 0.3)) { selected = selected == bar.id ? nil : bar.id }
                }
                .overlay(alignment: calloutAlignment) {
                    if let callout, up {
                        Text(callout)
                            .font(.mono(12, .semibold))
                            .foregroundStyle(.white)
                            .fixedSize()
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Color(hex: 0x0A0C10, opacity: 0.85)))
                            .overlay(RoundedRectangle(cornerRadius: 4, style: .continuous).strokeBorder(Color.white.opacity(0.12), lineWidth: 1))
                            .offset(y: -(min(barHeight, height) + 10))
                            .transition(.scale(scale: 0.85, anchor: .bottom).combined(with: .opacity))
                            .id(callout)
                    }
                }
                .zIndex(bar.callout == nil ? 0 : 1)
                .accessibilityElement()
                .accessibilityLabel("\(bar.badge): \(bar.label)")
            }
        }
        .padding(.top, calloutRoom)
        .animation(.spring(duration: 0.6, bounce: 0.15), value: bars.map(\.value))
        .sensoryFeedback(.selection, trigger: selected)
        .onAppear {
            guard !risen else { return }
            risen = true
        }
    }

    @ViewBuilder
    private func barBody(_ bar: PillBar, height: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: 4, style: .continuous)
        VStack {
            // The sideways label needs room above the badge; empty days
            // don't need one.
            // At accessibility sizes the value reads across the top instead,
            // since large text can't fit the narrow sideways slot.
            if bar.value > 0, height >= 96, !typeSize.isAccessibilitySize {
                Text(bar.label)
                    .font(.mono(12, .semibold))
                    .fixedSize()
                    .rotationEffect(.degrees(-90))
                    .frame(width: 16, height: 48)
                    .padding(.top, 10)
            } else if bar.value > 0 {
                // Short bars (often the ones that matter, like calm days)
                // get their value across the top instead.
                Text(bar.label)
                    .font(.mono(11, .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(typeSize.isAccessibilitySize ? 0.4 : 0.7)
                    .padding(.horizontal, 4)
                    .padding(.top, 10)
            }
            Spacer(minLength: 0)
            Text(bar.badge)
                .font(.mono(11, .bold))
                .foregroundStyle(bar.style == .highlight ? Color.lime : .white)
                .frame(width: 28, height: 28)
                .background(Circle().fill(bar.style == .highlight ? Color.ink : Color(hex: 0x0A0C10, opacity: 0.55)))
                .padding(.bottom, 5)
        }
        .foregroundStyle(bar.style == .highlight ? Color.ink : .white)
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .background {
            switch bar.style {
            case .normal:
                shape.fill(LinearGradient(colors: [.white.opacity(0.3), .white.opacity(0.12)], startPoint: .top, endPoint: .bottom))
            case .highlight:
                shape.fill(Color.lime).shadow(color: .lime.opacity(0.35), radius: 12)
            case .danger:
                shape.fill(LinearGradient(colors: [Color(hex: 0xFF8A8A), Color.coral.opacity(0.45)], startPoint: .top, endPoint: .bottom))
            }
        }
    }
}

/// Diagonal stripes marking the unfilled part of a bar.
struct StripeTrack: View {
    var radius: CGFloat = 20
    var opacity: Double = 0.04

    var body: some View {
        Canvas { context, size in
            var path = Path()
            var x: CGFloat = -size.height
            while x < size.width {
                path.move(to: CGPoint(x: x, y: size.height))
                path.addLine(to: CGPoint(x: x + size.height, y: 0))
                x += 12
            }
            context.stroke(path, with: .color(.white.opacity(opacity)), lineWidth: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}
