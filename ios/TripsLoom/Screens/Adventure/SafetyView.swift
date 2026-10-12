import Network
import SwiftUI
import UIKit

/// A4. Built for places without signal: the route map, timed check-in
/// reminders, the altitude check-in, and the coral SOS button.
struct SafetyView: View {
    @Binding var trip: Trip
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.openURL) private var openURL
    @State private var connection = ConnectionMonitor()
    @State private var confirmSOS = false
    @State private var reminderDenied = false
    @State private var editingContacts = false
    @State private var contactsDraft = ""
    @State private var showingMap = false
    @State private var editingEmergency = false
    @State private var emergencyDraft = ""

    var body: some View {
        let adventure = trip.adventure ?? Adventure()
        NightScreen(photo: trip.photo, spacing: 14, title: "Safety") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Safety").displayTitle(40)
                HStack(spacing: 8) {
                    if connection.isOnline {
                        Chip("Online", tone: .tint(.mint))
                    } else {
                        Chip("No internet", tone: .tint(.coral))
                    }
                    Chip(adventure.checkInReminders ? "Check-ins on" : "Check-ins off", tone: .tint(adventure.checkInReminders ? .mint : .apricot))
                }
            }
            .padding(.horizontal, 4)

            if trip.stages.isEmpty {
                EmptyNote(title: "No route yet", message: "Add stages in Route to see your progress on the map.")
            } else {
                // At accessibility sizes the labels sit under the map, where
                // they can wrap, instead of colliding on top of it.
                let large = typeSize.isAccessibilitySize
                VStack(alignment: .leading, spacing: 8) {
                    TrailMap(trip: trip, online: connection.isOnline)
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.white.opacity(0.09), lineWidth: 1))
                        .overlay(alignment: .topLeading) {
                            if !large { mapLabel(routeLabel).padding(12) }
                        }
                        .overlay(alignment: .bottomTrailing) {
                            if !large, let next = nextStage { mapLabel(Text(nextLabel(next))).padding(12) }
                        }
                    if large {
                        mapLabel(routeLabel)
                        if let next = nextStage { mapLabel(Text(nextLabel(next))) }
                    }
                }
                    .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .onTapGesture { showingMap = true }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Route map")
                    .accessibilityValue("\(Int(routeProgress * 100)) percent complete")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityHint("Opens the full map")
                    .accessibilityAction { showingMap = true }
            }

            GlassList("Check-ins") {
                Toggle(isOn: reminderBinding) {
                    ListRow("Daily check-in \(adventure.nextCheckIn)", meta: adventure.contacts.isEmpty ? "Reminder to tell someone you're safe" : "Reminder · tell \(adventure.contacts)") {
                        IconTile(symbol: "mappin", color: Tile.green)
                    }
                }
                .toggleStyle(LimeToggleStyle())

                Menu {
                    Picker("Check-in time", selection: adventureBinding(\.nextCheckIn)) {
                        ForEach(["07:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"], id: \.self) { Text($0) }
                    }
                } label: {
                    ListRow("Check-in time") {
                        IconTile(symbol: "clock.fill", color: Tile.amber)
                    } trailing: {
                        Text(adventure.nextCheckIn).font(.mono(15, .semibold)).foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)

                Button {
                    contactsDraft = adventure.contacts
                    editingContacts = true
                } label: {
                    ListRow("Who to tell", meta: adventure.contacts.isEmpty ? "Add names" : adventure.contacts) {
                        IconTile(symbol: "person.2.fill", color: Tile.plum)
                    } trailing: { CornerArrow() }
                }
                .buttonStyle(.plain)

                ShareLink(item: safeMessage) {
                    ListRow("Send \"I'm safe\"", meta: adventure.contacts.isEmpty ? "Message someone where you are" : "Message \(adventure.contacts)") {
                        IconTile(symbol: "checkmark.message.fill", color: Tile.green)
                    } trailing: { CornerArrow() }
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens a message you can send by text or chat")

                NavigationLink(value: AdventureRoute.checkIn) {
                    ListRow("Altitude check-in", meta: lastCheckInMeta(adventure)) {
                        IconTile(symbol: "lungs.fill", color: Tile.teal)
                    } trailing: {
                        if let last = adventure.checkIns.last {
                            Chip(last.scoreLabel, tone: .tint(color(last.advice)))
                        } else {
                            CornerArrow()
                        }
                    }
                }
                .buttonStyle(.plain)

                Button {
                    if let url = URL(string: "findmy://") { openURL(url) }
                } label: {
                    ListRow("Share your location", meta: "Opens Find My") {
                        IconTile(symbol: "location.fill", color: Tile.indigo)
                    } trailing: { CornerArrow() }
                }
                .buttonStyle(.plain)
            }

            if reminderDenied {
                Button {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                } label: {
                    Text("Notifications are off for Trips Loom. \(Text("Open Settings").underline()) to get check-in reminders.")
                        .font(.sf(13))
                        .foregroundStyle(Color.apricot)
                        .multilineTextAlignment(.leading)
                        .padding(.horizontal, 4)
                }
                .buttonStyle(.plain)
            }

            Button {
                emergencyDraft = adventure.emergencyNumber ?? ""
                editingEmergency = true
            } label: {
                ListRow("Local emergency number", meta: adventure.emergencyNumber ?? "Set and verify for your destination") { IconTile(symbol: "phone", color: Tile.red) } trailing: { CornerArrow() }
            }.buttonStyle(.plain)

            Button {
                if adventure.emergencyNumber?.isEmpty == false { confirmSOS = true }
                else { editingEmergency = true }
            } label: {
                Label("Emergency call", systemImage: "phone.fill")
                    .font(.sf(17, .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 64)
                    .background {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(LinearGradient(colors: [Color(hex: 0xFF7A7A), Color(hex: 0xE0393E)], startPoint: .top, endPoint: .bottom))
                            .shadow(color: Color(hex: 0xFF5050, opacity: 0.45), radius: 20, y: 14)
                    }
                    .overlay(TopHighlight(shape: RoundedRectangle(cornerRadius: 8, style: .continuous), opacity: 0.3))
            }
            .buttonStyle(.plain)
        }
        .navigationDestination(for: AdventureRoute.self) { route in
            if route == .checkIn { AltitudeCheckInView(trip: $trip) }
        }
        .sheet(isPresented: $showingMap) { TrailMapSheet(trip: trip, online: connection.isOnline) }
        .confirmationDialog("Call emergency services?", isPresented: $confirmSOS, titleVisibility: .visible) {
            Button("Call \(trip.adventure?.emergencyNumber ?? "")", role: .destructive) {
                if let number = trip.adventure?.emergencyNumber, let url = URL(string: "tel:\(number)") { openURL(url) }
            }
        } message: {
            Text("This opens the Phone app with the emergency number you set. Satellite SOS depends on your iPhone, location and Apple service availability; Trips Loom cannot activate it.")
        }
        .alert("Local emergency number", isPresented: $editingEmergency) {
            TextField("Verified local number", text: $emergencyDraft).keyboardType(.phonePad)
            Button("Save") {
                let number = emergencyDraft.filter { $0.isASCII && $0.isNumber }
                if !number.isEmpty && number.count <= 15 {
                    if trip.adventure == nil { trip.adventure = Adventure() }
                    trip.adventure?.emergencyNumber = number
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: { Text("Confirm the correct emergency number for your destination before travel. Numbers differ by country.") }
        .task {
            if trip.adventure?.checkInReminders == true, await !Reminders.isAuthorized {
                trip.adventure?.checkInReminders = false
                return
            }
            await scheduleCheckIns(prompt: false)
        }
        .onChange(of: trip.adventure?.checkInReminders) { _, _ in
            Task { await scheduleCheckIns(prompt: true) }
        }
        .onChange(of: trip.adventure?.nextCheckIn) { _, _ in
            Task { await scheduleCheckIns(prompt: false) }
        }
        .alert("Who to tell", isPresented: $editingContacts) {
            TextField("e.g. Mum + Rahul", text: $contactsDraft)
            Button("Save") { adventureBinding(\.contacts).wrappedValue = contactsDraft.trimmingCharacters(in: .whitespaces) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Used in your check-in reminder so you remember who to message.")
        }
    }

    private func scheduleCheckIns(prompt: Bool) async {
        guard let adventure = trip.adventure else { return }
        let ok = await Reminders.scheduleCheckIn(enabled: adventure.checkInReminders, time: adventure.nextCheckIn, trip: trip, contacts: adventure.contacts, prompt: prompt)
        reminderDenied = !ok
        if !ok { trip.adventure?.checkInReminders = false }
    }

    private func adventureBinding(_ key: WritableKeyPath<Adventure, String>) -> Binding<String> {
        Binding(
            get: { trip.adventure?[keyPath: key] ?? "" },
            set: { value in
                if trip.adventure == nil { trip.adventure = Adventure() }
                trip.adventure?[keyPath: key] = value
            }
        )
    }

    private var reminderBinding: Binding<Bool> {
        Binding(
            get: { trip.adventure?.checkInReminders ?? false },
            set: { value in
                if trip.adventure == nil { trip.adventure = Adventure() }
                trip.adventure?.checkInReminders = value
            }
        )
    }

    /// "I'm safe. Day 4 of Goechala, sleeping at Dzongri tonight (4,020 m). 4:05 PM"
    private var safeMessage: String {
        var parts = ["I'm safe."]
        if let day = trip.todayIndex {
            var line = "Day \(day + 1) of \(trip.name)"
            if let stage = nextStage {
                line += ", sleeping at \(destination(stage)) tonight"
                if stage.altitude > 0 { line += " (\(Fmt.grouped(stage.altitude)) m)" }
            }
            parts.append(line + ".")
        } else {
            parts.append("\(trip.name), \(trip.place).")
        }
        if let last = trip.adventure?.checkIns.last, Calendar.current.isDateInToday(last.date) {
            parts.append("Altitude check-in: SpO₂ \(last.spo2)%, \(last.scoreLabel.lowercased()).")
        }
        parts.append(Date.now.formatted(date: .omitted, time: .shortened))
        return parts.joined(separator: " ")
    }

    private var nextStage: Stage? {
        let i = trip.currentStageIndex
        return trip.stages.indices.contains(i) ? trip.stages[i] : nil
    }

    private var routeProgress: Double {
        guard trip.stages.count > 1 else { return 0 }
        if trip.status == .past { return 1 }
        return Double(trip.currentStageIndex) / Double(trip.stages.count - 1)
    }

    private func destination(_ stage: Stage) -> String {
        stage.title.components(separatedBy: "→").last?.trimmingCharacters(in: .whitespaces) ?? stage.title
    }

    private func lastCheckInMeta(_ adventure: Adventure) -> String {
        guard let last = adventure.checkIns.last else { return "SpO₂ and symptoms, each evening" }
        return "SpO₂ \(last.spo2)% · \(Fmt.grouped(last.altitude)) m · \(Fmt.monthDay(last.date))"
    }

    private func color(_ advice: AltitudeCheckIn.Advice) -> Color {
        switch advice {
        case .safe: .mint
        case .caution: .sun
        case .descend: .coral
        }
    }
}

/// A dark contour map with the walked part in mint and the rest dotted lime.
struct RouteMap: View {
    var progress: Double

    var body: some View {
        Canvas { context, size in
            let sx = size.width / 358
            let sy = size.height / 200
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * sx, y: y * sy) }

            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: 0x0F1419)))

            for i in 0..<6 {
                let o = CGFloat(i) * 26
                var contour = Path()
                contour.move(to: p(-20, 170 - o))
                contour.addCurve(to: p(220, 150 - o), control1: p(80, 140 - o - CGFloat(i) * 4), control2: p(140, 190 - o))
                contour.addQuadCurve(to: p(380, 130 - o), control: p(330, 110 - o))
                context.stroke(contour, with: .color(.white.opacity(0.07)), lineWidth: 1.2)
            }

            var route = Path()
            route.move(to: p(30, 175))
            route.addCurve(to: p(160, 108), control1: p(80, 150), control2: p(110, 120))
            route.addCurve(to: p(310, 40), control1: p(210, 96), control2: p(250, 70))

            context.stroke(route, with: .color(.lime), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [1, 7]))
            let walked = route.trimmedPath(from: 0, to: max(0.001, progress))
            context.stroke(walked, with: .color(.mint), style: StrokeStyle(lineWidth: 4, lineCap: .round))

            let here = walked.currentPoint ?? p(30, 175)
            context.fill(Path(ellipseIn: CGRect(x: here.x - 16, y: here.y - 16, width: 32, height: 32)), with: .color(Color.marker.opacity(0.18)))
            context.fill(Path(ellipseIn: CGRect(x: here.x - 7, y: here.y - 7, width: 14, height: 14)), with: .color(.marker))
            context.stroke(Path(ellipseIn: CGRect(x: here.x - 7, y: here.y - 7, width: 14, height: 14)), with: .color(.night), lineWidth: 2.5)

            let end = p(310, 40)
            context.fill(Path(ellipseIn: CGRect(x: end.x - 6, y: end.y - 6, width: 12, height: 12)), with: .color(.night))
            context.stroke(Path(ellipseIn: CGRect(x: end.x - 6, y: end.y - 6, width: 12, height: 12)), with: .color(.lime), lineWidth: 2.5)
        }
    }
}

@Observable
final class ConnectionMonitor {
    var isOnline = true
    @ObservationIgnored private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.isOnline = online }
        }
        monitor.start(queue: DispatchQueue(label: "connection"))
    }

    deinit { monitor.cancel() }
}

extension SafetyView {
    fileprivate var routeLabel: Label<Text, Image> {
        Label("Route · \(Fmt.count(trip.stages.count, "stage"))", systemImage: "map")
    }

    fileprivate func nextLabel(_ next: Stage) -> String {
        "\(destination(next)) · \(Fmt.distance(next.km))"
    }

    @ViewBuilder
    fileprivate func mapLabel(_ content: some View) -> some View {
        let styled = content
            .font(.mono(11.5, .semibold))
            .textCase(.uppercase)
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 4).frame(minHeight: 30)
        if typeSize.isAccessibilitySize {
            styled.glass(16)
        } else {
            styled.glassCapsule()
        }
    }
}
