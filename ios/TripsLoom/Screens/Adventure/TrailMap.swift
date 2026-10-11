import MapKit
import SwiftUI
import UIKit

/// The route's villages and towns, placed with Apple Maps. Each stage's
/// destination ("Lukla → Phakding" → Phakding) becomes a waypoint; places
/// far from the trip's region are dropped as wrong matches.
@MainActor
enum RouteWaypoints {
    struct Point: Identifiable, Hashable {
        var id: String { name }
        var name: String
        var coordinate: CLLocationCoordinate2D
        /// Index of the stage that ends here (-1 for the start).
        var stage: Int

        static func == (a: Point, b: Point) -> Bool { a.name == b.name && a.stage == b.stage }
        func hash(into hasher: inout Hasher) { hasher.combine(name); hasher.combine(stage) }
    }

    /// Place names in route order, without repeats.
    static func names(_ trip: Trip) -> [(name: String, stage: Int)] {
        var result: [(String, Int)] = []
        for (i, stage) in trip.stages.enumerated() {
            let parts = stage.title.components(separatedBy: "→").map { $0.trimmingCharacters(in: .whitespaces) }
            if i == 0, parts.count == 2 { result.append((parts[0], -1)) }
            let end = parts.last ?? stage.title
            // "Summit day", "Rest day" and the like aren't places.
            guard !end.isEmpty, !end.lowercased().contains(" day"), result.last?.0 != end else { continue }
            result.append((end, i))
        }
        return result
    }

    static func resolve(_ trip: Trip) async -> [Point] {
        let region = trip.place
        var points: [Point] = []
        for (name, stage) in names(trip) {
            var place = await Places.lookup("\(name), \(region)")
            if place == nil { place = await Places.lookup(name) }
            guard let place else { continue }
            let coordinate = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
            // The same coordinates twice means the name wasn't found precisely.
            if points.contains(where: { abs($0.coordinate.latitude - coordinate.latitude) < 0.0005 && abs($0.coordinate.longitude - coordinate.longitude) < 0.0005 }) { continue }
            points.append(Point(name: name, coordinate: coordinate, stage: stage))
        }
        return dropStrays(points)
    }

    /// Map searches sometimes match a village to a namesake far away
    /// ("Phakding" → a hotel in Kathmandu). Stops much further from the
    /// route's middle than the others are dropped.
    static func dropStrays(_ points: [Point]) -> [Point] {
        guard points.count >= 3 else { return points }
        func median(_ values: [Double]) -> Double {
            let sorted = values.sorted()
            return sorted.count % 2 == 1 ? sorted[sorted.count / 2] : (sorted[sorted.count / 2 - 1] + sorted[sorted.count / 2]) / 2
        }
        let middle = CLLocation(latitude: median(points.map(\.coordinate.latitude)), longitude: median(points.map(\.coordinate.longitude)))
        let distances = points.map { CLLocation(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude).distance(from: middle) }
        let limit = max(60_000, median(distances) * 3)
        return zip(points, distances).filter { $0.1 <= limit }.map(\.0)
    }
}

/// Offline copies of route maps: a snapshot image with the route drawn on,
/// saved while online.
@MainActor
enum RouteSnapshots {
    private static var directory: URL {
        let dir = URL.applicationSupportDirectory.appending(path: "maps", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func url(_ trip: UUID) -> URL { directory.appending(path: "\(trip.uuidString).png") }

    static func image(_ trip: UUID) -> UIImage? { UIImage(contentsOfFile: url(trip).path(percentEncoded: false)) }

    static func savedDate(_ trip: UUID) -> Date? {
        (try? FileManager.default.attributesOfItem(atPath: url(trip).path(percentEncoded: false)))?[.modificationDate] as? Date
    }

    static func delete(_ trip: UUID) { try? FileManager.default.removeItem(at: url(trip)) }

    /// Removes maps of trips no longer on this iPhone.
    static func prune(keeping trips: Set<UUID>) {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: directory.path(percentEncoded: false))) ?? []
        for file in files {
            if let id = UUID(uuidString: String(file.dropLast(4))), !trips.contains(id) { delete(id) }
        }
    }

    /// Satellite snapshot of the route with the path and stops drawn on.
    static func save(_ trip: UUID, points: [RouteWaypoints.Point]) async -> Bool {
        guard points.count >= 2 else { return false }
        let options = MKMapSnapshotter.Options()
        options.region = region(points, padding: 1.35)
        options.size = CGSize(width: 900, height: 600)
        options.preferredConfiguration = MKHybridMapConfiguration(elevationStyle: .flat)
        guard let snapshot = try? await MKMapSnapshotter(options: options).start() else { return false }
        let image = UIGraphicsImageRenderer(size: options.size).image { context in
            snapshot.image.draw(at: .zero)
            let cg = context.cgContext
            let path = UIBezierPath()
            for (i, point) in points.enumerated() {
                let p = snapshot.point(for: point.coordinate)
                if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
            }
            cg.setShadow(offset: .zero, blur: 6, color: UIColor.black.withAlphaComponent(0.6).cgColor)
            UIColor(red: 0.83, green: 0.96, blue: 0.29, alpha: 1).setStroke()
            path.lineWidth = 5
            path.lineJoinStyle = .round
            path.stroke()
            for point in points {
                let p = snapshot.point(for: point.coordinate)
                UIColor.white.setFill()
                UIBezierPath(ovalIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)).fill()
                let label = NSAttributedString(string: point.name, attributes: [
                    .font: UIFont.systemFont(ofSize: 17, weight: .semibold),
                    .foregroundColor: UIColor.white,
                ])
                label.draw(at: CGPoint(x: p.x + 9, y: p.y - 11))
            }
        }
        guard let png = image.pngData(), (try? png.write(to: url(trip), options: .atomic)) != nil else { return false }
        UserDefaults.standard.set(signature(of: points), forKey: "route.snapshot.\(trip.uuidString)")
        return true
    }

    /// Which stops a saved map shows, to redraw it when the route changes.
    static func signature(of points: [RouteWaypoints.Point]) -> String {
        points.map { "\($0.name)@\(String(format: "%.3f,%.3f", $0.coordinate.latitude, $0.coordinate.longitude))" }.joined(separator: "|")
    }

    static func signature(_ trip: UUID) -> String? {
        UserDefaults.standard.string(forKey: "route.snapshot.\(trip.uuidString)")
    }

    static func region(_ points: [RouteWaypoints.Point], padding: Double) -> MKCoordinateRegion {
        let lats = points.map(\.coordinate.latitude), lons = points.map(\.coordinate.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(), let minLon = lons.min(), let maxLon = lons.max() else {
            return MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 0, longitude: 0), span: MKCoordinateSpan(latitudeDelta: 60, longitudeDelta: 60))
        }
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2)
        let span = MKCoordinateSpan(latitudeDelta: max((maxLat - minLat) * padding, 0.05),
                                    longitudeDelta: max((maxLon - minLon) * padding, 0.05))
        return MKCoordinateRegion(center: center, span: span)
    }
}

/// The real route map: satellite imagery, the route in lime, stops as dots
/// and where you are. Without signal it shows the saved snapshot.
struct TrailMap: View {
    var trip: Trip
    var online: Bool
    var interactive = false
    @State private var points: [RouteWaypoints.Point] = []
    @State private var loaded = false

    private var current: Int { trip.currentStageIndex }

    var body: some View {
        Group {
            if online, points.count >= 2 {
                map
            } else if let snapshot = RouteSnapshots.image(trip.id) {
                Image(uiImage: snapshot)
                    .resizable()
                    .scaledToFill()
            } else if loaded {
                // Couldn't place the route: the drawn progress line.
                RouteMap(progress: Double(current + 1) / Double(max(trip.stages.count, 1)))
            } else {
                Color(hex: 0x0F1419).overlay { ProgressView().tint(.white) }
            }
        }
        .task(id: trip.stages.map(\.title)) {
            points = await RouteWaypoints.resolve(trip)
            loaded = true
            // Keep an offline copy, refreshed when the route changes.
            if online, points.count >= 2 {
                let old = RouteSnapshots.savedDate(trip.id).map { $0 < .now.addingTimeInterval(-7 * 86_400) } ?? true
                if old || RouteSnapshots.signature(trip.id) != RouteSnapshots.signature(of: points) {
                    _ = await RouteSnapshots.save(trip.id, points: points)
                }
            }
        }
    }

    private var map: some View {
        let here = points.last { $0.stage <= current && trip.status == .active } ?? (trip.status == .upcoming ? points.first : nil)
        // Full screen: room below for the info panel.
        var region = RouteSnapshots.region(points, padding: interactive ? 1.9 : 1.5)
        if interactive { region.center.latitude -= region.span.latitudeDelta * 0.18 }
        return Map(initialPosition: .region(region),
                   interactionModes: interactive ? .all : []) {
            MapPolyline(coordinates: points.map(\.coordinate))
                .stroke(Color.lime, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            ForEach(points) { point in
                if interactive {
                    Marker(point.name, systemImage: point == here ? "figure.hiking" : "circle.fill", coordinate: point.coordinate)
                        .tint(point == here ? Color.marker : point == points.last ? Color.lime : Color(hex: 0x2A2E36))
                } else {
                    Annotation(point == points.first || point == points.last ? point.name : "", coordinate: point.coordinate, anchor: .center) {
                        Circle()
                            .fill(point == here ? Color.marker : .white)
                            .frame(width: point == here ? 14 : 9, height: point == here ? 14 : 9)
                            .overlay(Circle().strokeBorder(Color.black.opacity(0.4), lineWidth: 1))
                    }
                }
            }
        }
        .mapStyle(.hybrid(elevation: .flat))
        .mapControlVisibility(interactive ? .automatic : .hidden)
    }
}

/// Full-screen route map with Apple Maps hand-off and offline status.
struct TrailMapSheet: View {
    var trip: Trip
    var online: Bool
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var saving = false
    @State private var savedAt: Date?
    @State private var saveFailed = false

    var body: some View {
        NavigationStack {
            TrailMap(trip: trip, online: online, interactive: true)
                .ignoresSafeArea(edges: .bottom)
                .safeAreaInset(edge: .bottom) {
                    VStack(alignment: .leading, spacing: 10) {
                        Label(savedAt.map { "Saved for offline · \(Fmt.monthDay($0))" } ?? "Not saved for offline yet",
                              systemImage: savedAt == nil ? "icloud.slash" : "checkmark.icloud")
                            .font(.sf(14, .medium))
                            .foregroundStyle(.white)
                        Text("For turn-by-turn maps without signal, download this area in Apple Maps: Profile → Offline Maps.")
                            .font(.sf(13))
                            .foregroundStyle(Color.textMuted)
                        HStack(spacing: 10) {
                            Button("Open in Maps") {
                                Task {
                                    let points = await RouteWaypoints.resolve(trip)
                                    guard let first = points.first, let last = points.last else { return }
                                    let url = URL(string: "maps://?saddr=\(first.coordinate.latitude),\(first.coordinate.longitude)&daddr=\(last.coordinate.latitude),\(last.coordinate.longitude)&dirflg=w")!
                                    openURL(url)
                                }
                            }
                            .buttonStyle(GlassPillStyle(height: 40))
                            Button(saving ? "Saving…" : "Save for offline") {
                                Task {
                                    saving = true
                                    let points = await RouteWaypoints.resolve(trip)
                                    if await RouteSnapshots.save(trip.id, points: points) { savedAt = .now }
                                    else { saveFailed = true }
                                    saving = false
                                }
                            }
                            .buttonStyle(LimePillStyle(height: 40))
                            .disabled(!online || saving)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .glass(24)
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.bottom, 8)
                }
                .navigationTitle("Route map")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                }
        }
        .onAppear { savedAt = RouteSnapshots.savedDate(trip.id) }
        .alert("Map could not be saved", isPresented: $saveFailed) {
            Button("OK", role: .cancel) { }
        } message: { Text("Check your internet connection and use recognisable place names in your route stages, then try again. Your existing offline snapshot is kept.") }
    }
}
