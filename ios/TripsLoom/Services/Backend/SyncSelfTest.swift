#if DEBUG
import Foundation

/// Debug-only: `-sync-self-test` writes the sample trips as a web workspace,
/// imports that back and exports again, so the output can be checked against
/// the web app's validator (`lib/model.ts`) from the command line.
enum SyncSelfTest {
    @MainActor
    static func runIfRequested() {
        guard ProcessInfo.processInfo.arguments.contains("-sync-self-test") else { return }
        let seed = SampleData.make()
        let first = WorkspaceMapper.export(trips: seed.trips, wardrobe: seed.wardrobe, base: nil)
        // Through real JSON, as the server returns it.
        let wire = (try? JSONSerialization.data(withJSONObject: first))
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? first
        let imported = WorkspaceMapper.importWorkspace(wire, known: [], wardrobe: [], extras: [:])
        let second = WorkspaceMapper.export(trips: imported.trips, wardrobe: imported.wardrobe, base: first)
        let dir = URL.documentsDirectory
        for (name, value) in [("export-1", first), ("export-2", second)] {
            if let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]) {
                try? data.write(to: dir.appending(path: "\(name).json"))
            }
        }
        if let first = seed.trips.first, let pdf = ItineraryPDF.make(first) {
            try? FileManager.default.removeItem(at: dir.appending(path: "itinerary.pdf"))
            try? FileManager.default.copyItem(at: pdf, to: dir.appending(path: "itinerary.pdf"))
        }
        // Invite round trip: the Goa trip, joined as Meera.
        if let goa = seed.trips.first(where: { $0.name.hasPrefix("Goa") }) {
            let invite = TripInvite.make(goa, senderName: "Vivek")
            var lines = ["link length \(invite.link?.absoluteString.count ?? -1)"]
            if let link = invite.link, let back = TripInvite.from(link: link) {
                let joined = back.tripForJoining(as: "Meera Shah", existing: nil)
                lines.append("decoded \(back.trip.name) from \(back.from) plans \(back.trip.plans.count)")
                lines.append("companions \(joined.companions.map(\.name))")
                lines.append("sender ledger \(goa.ledger.map { "\($0.person) \($0.amount)" })")
                lines.append("meera ledger \(joined.ledger.map { "\($0.person) \($0.amount)" })")
            } else {
                lines.append("decode FAILED")
            }
            try? Data(lines.joined(separator: "\n").utf8).write(to: dir.appending(path: "invite-test.txt"))
            try? Data((invite.link?.absoluteString ?? "").utf8).write(to: dir.appending(path: "invite-link.txt"))
            for trip in seed.trips {
                let length = TripInvite.make(trip, senderName: "Vivek").link?.absoluteString.count
                lines.append("\(trip.name): link \(length.map(String.init) ?? "too long, file only")")
            }
            try? Data(lines.joined(separator: "\n").utf8).write(to: dir.appending(path: "invite-test.txt"))
        }
        // Live summit wind for Island Peak (27.922, 86.936, 6,189 m).
        Task { @MainActor in
            let days = await SummitForecast.fetch(latitude: 27.922, longitude: 86.936, altitude: 6189) ?? []
            let text = days.prefix(16).map { "\($0.date.dayKey) wind \($0.kmh) km/h dawn \($0.dawnTemp.map(String.init) ?? "?")°C" }.joined(separator: "\n")
            try? Data((days.isEmpty ? "FAILED" : text).utf8).write(to: dir.appending(path: "summit-test.txt"))
            try? Data("done".utf8).write(to: dir.appending(path: "self-test-done"))
        }
        return

    }
}
#endif
