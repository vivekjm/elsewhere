import SwiftUI
import WidgetKit

/// Home and Lock Screen widget: the next trip's countdown, or today's next
/// plan while the trip is running.
struct NextTripWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextTrip", provider: NextTripProvider()) { entry in
            NextTripView(entry: entry)
                .containerBackground(for: .widget) {
                    LinearGradient(colors: [Color(red: 0.12, green: 0.15, blue: 0.2), Color(red: 0.05, green: 0.06, blue: 0.09)],
                                   startPoint: .top, endPoint: .bottom)
                }
        }
        .configurationDisplayName("Next trip")
        .description("Days until your next trip, and what's next while you're there.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

struct NextTripEntry: TimelineEntry {
    var date: Date
    var snapshot: WidgetSnapshot?
}

struct NextTripProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextTripEntry {
        NextTripEntry(date: .now, snapshot: WidgetSnapshot(
            tripName: "Lisbon", place: "Lisbon, Portugal", firstDay: .now.addingTimeInterval(4 * 86_400),
            lastDay: .now.addingTimeInterval(8 * 86_400), timeZoneID: TimeZone.current.identifier,
            packed: 6, packingTotal: 14, plans: []))
    }

    func getSnapshot(in context: Context, completion: @escaping (NextTripEntry) -> Void) {
        completion(context.isPreview && WidgetSnapshot.load() == nil ? placeholder(in: context) : NextTripEntry(date: .now, snapshot: WidgetSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextTripEntry>) -> Void) {
        let snapshot = WidgetSnapshot.load()
        var dates: [Date] = [.now]
        if let snapshot {
            // Each plan's start, and each midnight at the destination for the next two weeks.
            dates += snapshot.plans.map(\.start).filter { $0 > .now }.prefix(20)
            var midnight = snapshot.calendar.startOfDay(for: .now)
            for _ in 0..<14 {
                guard let next = snapshot.calendar.date(byAdding: .day, value: 1, to: midnight) else { break }
                midnight = next
                dates.append(next)
            }
        }
        let entries = Set(dates).sorted().map { NextTripEntry(date: $0, snapshot: snapshot) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct NextTripView: View {
    var entry: NextTripEntry
    @Environment(\.widgetFamily) private var family

    private static let lime = Color(red: 0.831, green: 0.961, blue: 0.290)
    /// Secondary text on the dark card; on the Lock Screen the system tints it.
    private var muted: Color { family == .systemSmall || family == .systemMedium ? Color.white.opacity(0.65) : Color.secondary }

    var body: some View {
        // The home-screen card is always dark; Lock Screen styles follow the system.
        let home = family == .systemSmall || family == .systemMedium
        if home {
            main.environment(\.colorScheme, .dark).foregroundStyle(.white)
        } else {
            main
        }
    }

    @Environment(\.colorScheme) private var colorScheme

    @ViewBuilder
    private var main: some View {
        if let snapshot = entry.snapshot {
            content(snapshot)
        } else {
            switch family {
            case .accessoryInline: Text("No trips planned")
            default:
                VStack(alignment: .leading, spacing: 4) {
                    Text("No trips yet").font(.headline)
                    Text("Plan one in Trips Loom").font(.caption).foregroundStyle(muted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private func content(_ s: WidgetSnapshot) -> some View {
        let status = s.status(at: entry.date)
        let next = s.upcoming(after: entry.date).first
        switch family {
        case .accessoryInline:
            Text("\(s.tripName) · \(status)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(status).font(.headline).widgetAccentable()
                Text(s.tripName).font(.caption).lineLimit(1)
                if let next { Text("\(time(next.start, s)) \(next.title)").font(.caption2).lineLimit(1) }
            }
        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                header(s, status: status)
                VStack(alignment: .leading, spacing: 6) {
                    Text("NEXT").font(.system(size: 10, weight: .bold, design: .monospaced)).foregroundStyle(muted)
                    let plans = Array(s.upcoming(after: entry.date).prefix(3))
                    if plans.isEmpty {
                        Text(s.packingTotal > 0 ? "\(s.packed)/\(s.packingTotal) packed" : "Nothing planned yet")
                            .font(.caption).foregroundStyle(muted)
                    }
                    ForEach(plans, id: \.start) { plan in
                        VStack(alignment: .leading, spacing: 0) {
                            Text(time(plan.start, s)).font(.system(size: 11, weight: .semibold, design: .monospaced)).foregroundStyle(Self.lime)
                            Text(plan.title).font(.caption).lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        default:
            VStack(alignment: .leading, spacing: 6) {
                header(s, status: status)
                Spacer(minLength: 0)
                if let next {
                    Text("\(time(next.start, s)) · \(next.title)").font(.caption).lineLimit(2)
                } else if s.packingTotal > 0 {
                    Text("\(s.packed)/\(s.packingTotal) packed").font(.caption).foregroundStyle(muted)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private func header(_ s: WidgetSnapshot, status: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(status.uppercased())
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Self.lime)
            Text(s.tripName).font(.headline).lineLimit(2).minimumScaleFactor(0.8)
            Text(s.place).font(.caption).foregroundStyle(muted).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Plan time at the destination.
    private func time(_ date: Date, _ s: WidgetSnapshot) -> String {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("jm")
        f.timeZone = s.timeZone
        return f.string(from: date)
    }
}
