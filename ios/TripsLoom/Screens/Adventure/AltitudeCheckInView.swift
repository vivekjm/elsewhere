import SwiftUI

/// A3. An evening check-in: blood oxygen, heart rate and a Lake Louise
/// symptom score. A glowing bar says whether it's safe to go higher.
struct AltitudeCheckInView: View {
    @Binding var trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var entry: AltitudeCheckIn

    init(trip: Binding<Trip>) {
        _trip = trip
        let t = trip.wrappedValue
        let stage = t.stages.indices.contains(t.currentStageIndex) ? t.stages[t.currentStageIndex] : nil
        let last = t.adventure?.checkIns.last
        _entry = State(initialValue: AltitudeCheckIn(
            altitude: stage?.altitude ?? last?.altitude ?? 0,
            spo2: last?.spo2 ?? 92,
            heartRate: last?.heartRate ?? 75,
            symptoms: Array(repeating: 0, count: AltitudeCheckIn.symptomNames.count)
        ))
    }

    private var stage: Stage? {
        trip.stages.indices.contains(trip.currentStageIndex) ? trip.stages[trip.currentStageIndex] : nil
    }

    var body: some View {
        NightScreen(photo: trip.photo, top: 0.52, bottom: 0.87, spacing: 12) {
            vitals
                .padding(.top, 12)
            symptoms
            advice
            Button("Save check-in") {
                if trip.adventure == nil { trip.adventure = Adventure() }
                var saved = entry
                saved.date = .now
                trip.adventure?.checkIns.append(saved)
                dismiss()
            }
            .buttonStyle(CTAStyle())
            .padding(.top, 4)
        }
        .toolbar(.hidden, for: .tabBar)
        .navigationTitle(stage.map { "Day \($0.day) · \(place($0))" } ?? "Check-in")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var vitals: some View {
        let gain = stage.map { s -> Int in
            guard let i = trip.stages.firstIndex(where: { $0.id == s.id }), i > 0 else { return 0 }
            return s.altitude - trip.stages[i - 1].altitude
        } ?? 0
        return HStack(spacing: 16) {
            ProgressRing(progress: Double(entry.spo2) / 100, color: color, size: 108, lineWidth: 8) {
                VStack(spacing: 4) {
                    Text("\(entry.spo2)").font(.mono(30, .bold)).foregroundStyle(.white)
                    Text("SpO₂ %").font(.mono(11, .medium)).foregroundStyle(Color.textMuted)
                }
            }
            .accessibilityElement()
            .accessibilityLabel("Blood oxygen")
            .accessibilityValue("\(entry.spo2) percent")
            .accessibilityAdjustableAction { direction in
                entry.spo2 = direction == .increment ? min(100, entry.spo2 + 1) : max(60, entry.spo2 - 1)
            }
            VStack(alignment: .leading, spacing: 0) {
                SectionLabel(entry.altitude > 0 ? "\(Fmt.grouped(entry.altitude)) m\(gain > 0 ? " · +\(gain) today" : "")" : "Set your altitude")
                Text(headline)
                    .font(.sf(22, .bold))
                    .foregroundStyle(.white)
                    .padding(.top, 6)
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        MiniStepper(label: "SpO₂", value: $entry.spo2, range: 60...100)
                        MiniStepper(label: "HR", value: $entry.heartRate, range: 30...200)
                    }
                    MiniStepper(label: "Alt", value: $entry.altitude, range: 0...8800, step: 50, suffix: " m")
                }
                .padding(.top, 8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .glassCard()
    }

    private var symptoms: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("How do you feel?")
            VStack(spacing: 12) {
                ForEach(AltitudeCheckIn.symptomNames.indices, id: \.self) { i in
                    HStack(spacing: 12) {
                        Text(AltitudeCheckIn.symptomNames[i])
                            .font(.sf(15))
                            .foregroundStyle(.white)
                            .lineLimit(1).minimumScaleFactor(0.8).frame(width: 96, alignment: .leading)
                        HStack(spacing: 4) {
                            ForEach(1...3, id: \.self) { level in
                                let current = entry.symptoms[i]
                                Button {
                                    withAnimation(Motion.quick) { entry.symptoms[i] = current == level ? level - 1 : level }
                                } label: {
                                    Capsule()
                                        .fill(level <= current ? levelColor(current) : Color.white.opacity(0.1))
                                        .frame(height: 10)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .accessibilityElement()
                        .accessibilityLabel(AltitudeCheckIn.symptomNames[i])
                        .accessibilityValue(["None", "Mild", "Moderate", "Severe"][entry.symptoms[i]])
                        .accessibilityAdjustableAction { direction in
                            entry.symptoms[i] = direction == .increment ? min(3, entry.symptoms[i] + 1) : max(0, entry.symptoms[i] - 1)
                        }
                    }
                    .frame(height: 22)
                }
            }
            .padding(.top, 14)
            HStack {
                Text("Symptom score").font(.sf(15, .semibold)).foregroundStyle(.white)
                Spacer()
                Text(entry.scoreLabel).font(.mono(14, .bold)).textCase(.uppercase).foregroundStyle(color)
            }
            .padding(.top, 12)
            .overlay(alignment: .top) { Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1) }
            .padding(.top, 14)
        }
        .glassCard()
    }

    private var advice: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(adviceTitle).font(.sf(17, .semibold)).foregroundStyle(.white)
            Text(adviceBody).font(.sf(14)).foregroundStyle(Color.textMuted).lineSpacing(2)
            Link("Altitude guidance · CDC", destination: URL(string: "https://www.cdc.gov/yellow-book/hcp/environmental-hazards-risks/high-altitude-travel-and-altitude-illness.html")!).font(.sf(13)).padding(.top, 8)
            HStack {
                ShareLink(item: shareText) { Text("Share with guide") }
                    .buttonStyle(GlassPillStyle())
            }
            .padding(.top, 8)
        }
        .padding(.vertical, 16)
        .padding(.leading, 20)
        .padding(.trailing, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .leading) { CategoryBar(color: color, inset: 16) }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .glass(24)
    }

    private var color: Color {
        switch entry.advice {
        case .safe: .mint
        case .caution: .sun
        case .descend: .coral
        }
    }

    private func levelColor(_ level: Int) -> Color {
        switch level {
        case 1: .mint
        case 2: .sun
        default: .coral
        }
    }

    private var headline: String {
        switch entry.advice {
        case .safe: "Symptoms recorded"
        case .caution: "Take it slowly"
        case .descend: "Descend now"
        }
    }

    private var adviceTitle: String {
        switch entry.advice {
        case .safe: "A log, not clearance to ascend"
        case .caution: "Rest before going higher"
        case .descend: "Go down and get help"
        }
    }

    private var adviceBody: String {
        switch entry.advice {
        case .safe: "A low score does not rule out altitude illness. If you feel unwell, tell your guide and do not ascend to sleep higher until symptoms resolve. Seek medical advice."
        case .caution: "Don't gain height today. Rest, drink, and check in again this evening. Tell your guide."
        case .descend: "Symptoms like these can become dangerous. Stop ascending and seek urgent help from your guide, rescue service or a medical professional. Do not descend alone."
        }
    }

    private var shareText: String {
        "Altitude check-in, \(trip.name): \(Fmt.grouped(entry.altitude)) m, SpO₂ \(entry.spo2)%, HR \(entry.heartRate), Symptom score \(entry.scoreLabel). \(adviceTitle)."
    }

    private func place(_ stage: Stage) -> String {
        stage.title.components(separatedBy: "→").last?.trimmingCharacters(in: .whitespaces) ?? stage.title
    }
}

private struct MiniStepper: View {
    var label: String
    @Binding var value: Int
    var range: ClosedRange<Int>
    var step = 1
    var suffix = ""

    var body: some View {
        HStack(spacing: 6) {
            Button { value = max(range.lowerBound, value - step) } label: { Image(systemName: "minus") }
                .accessibilityLabel("Decrease \(label)")
            Text("\(label) \(step > 1 ? Fmt.grouped(value) : "\(value)")\(suffix)").font(.mono(11.5, .semibold)).contentTransition(.numericText())
            Button { value = min(range.upperBound, value + step) } label: { Image(systemName: "plus") }
                .accessibilityLabel("Increase \(label)")
        }
        .buttonStyle(.plain)
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 4).frame(minHeight: 30)
        .background(Capsule().fill(Color.white.opacity(0.1)))
    }
}
