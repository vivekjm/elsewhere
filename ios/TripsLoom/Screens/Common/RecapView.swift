import SwiftUI

/// C14. An automatic recap when a trip ends. It shares as a story card, and
/// your stay rating is saved with the trip.
struct RecapView: View {
    @Binding var trip: Trip
    @Environment(TripStore.self) private var store
    @State private var story: UIImage?

    var body: some View {
        NightScreen(photo: trip.photo, title: "Recap") {
            ScreenHeader(title: "\(placeName), in \(trip.dayCount) days", meta: meta, eyebrow: "Recap", size: 34)
                .padding(.top, 8)

            collage

            RecapStatRow {
                RecapStat(value: firstStat.0, label: firstStat.1)
                RecapStat(value: "\(trip.plans.count)", label: "plans")
                RecapStat(value: Fmt.moneyCompact(trip.totalPlanned, trip.currency), label: "planned")
            }

            GlassList("How was it?") {
                ListRow(trip.stayName ?? "Your stay", meta: "Your stay") {
                    PhotoThumb(photo: trip.photo).tripCover(trip)
                } trailing: {
                    StarRating(rating: Binding(get: { trip.stayRating ?? 0 }, set: { trip.stayRating = $0 }))
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Group {
                    if let story {
                        ShareLink(item: Image(uiImage: story), message: Text(shareText),
                                  preview: SharePreview("\(trip.name) recap", image: Image(uiImage: story))) { shareLabel }
                    } else {
                        ShareLink(item: shareText) { shareLabel }
                    }
                }
                .buttonStyle(OutlinePillStyle())
                .accessibilityHint("Shares a story card of the trip")
            }
            .sharedBackgroundVisibility(.hidden)
        }
        .task(id: "\(trip.photo.rawValue)|\(trip.coverFile ?? "")|\(trip.plans.count)|\(trip.stayRating ?? 0)") { await renderStory() }
    }

    /// Distance when the trip logged any, otherwise its length in days.
    private var firstStat: (String, String) {
        let km = trip.walkingKm + trip.totalKm
        guard km > 0 else { return ("\(trip.dayCount)", trip.dayCount == 1 ? "day" : "days") }
        return (Fmt.distanceValue(km), trip.kind == .road ? "\(Fmt.distanceUnit) driven" : "\(Fmt.distanceUnit) walked")
    }

    private var shareLabel: some View {
        HStack(spacing: 6) {
            Text("Share")
            Image(systemName: "square.and.arrow.up").font(.system(size: 13, weight: .bold))
        }
    }

    /// A 1080 × 1920 story card: the cover, the place and three numbers.
    private func renderStory() async {
        var photo = CoverStore.shared.image(trip.coverFile)
        if photo == nil { photo = await PhotoLoader.shared.load(trip.photo.url(width: 1080)) }
        let card = RecapStoryCard(
            photo: photo, fallback: trip.photo.fallback, title: "\(placeName), in \(Fmt.count(trip.dayCount, "day"))", dates: meta,
            stats: [
                firstStat,
                ("\(trip.plans.count)", "plans"),
                trip.stayRating.map { ("\($0)/5", "stay") } ?? (Fmt.moneyCompact(trip.totalPlanned, trip.currency), "planned"),
            ]
        )
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3
        story = renderer.uiImage
    }

    private var placeName: String {
        trip.place.split(separator: ",").first.map(String.init) ?? trip.name
    }

    private var meta: String {
        let with = trip.companions.first.map { " · with \($0.name.split(separator: " ").first ?? "")" } ?? ""
        return "\(trip.dateRange)\(with)"
    }

    private var shareText: String {
        let km = trip.walkingKm + trip.totalKm
        return "\(trip.name): \(Fmt.count(trip.dayCount, "day")), \(Fmt.count(trip.plans.count, "plan"))\(km > 0 ? ", \(Fmt.distance(km))" : ""). Planned with Trips Loom."
    }

    /// Three crops of the trip's own photo, as a story-style collage.
    private var collage: some View {
        HStack(spacing: 6) {
            crop(scale: 1, anchor: .center)
                .frame(maxWidth: .infinity)
            VStack(spacing: 6) {
                crop(scale: 2.2, anchor: .topTrailing).frame(height: 150)
                crop(scale: 2.4, anchor: .bottomLeading).frame(height: 110)
            }
            .frame(width: 150)
        }
        .frame(height: 266)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }

    private func crop(scale: CGFloat, anchor: UnitPoint) -> some View {
        Color.photoPlaceholder
            .overlay { RemotePhoto(photo: trip.photo, width: 900).scaleEffect(scale, anchor: anchor).tripCover(trip) }
            .clipped()
    }
}

/// Three stats side by side, stacked at accessibility text sizes so labels
/// don't break mid-word.
struct RecapStatRow<Content: View>: View {
    @ViewBuilder var content: Content
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        (typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 10)) : AnyLayout(HStackLayout(alignment: .top, spacing: 10))) {
            content
        }
    }
}

struct RecapStat: View {
    var value: String
    var label: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.mono(22, .semibold)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.sf(13)).foregroundStyle(Color.textMuted)
        }
        .glassCard(padding: 14)
    }
}

struct StarRating: View {
    @Binding var rating: Int

    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { star in
                Button {
                    withAnimation(Motion.quick) { rating = star }
                } label: {
                    Image(systemName: "star")
                        .symbolVariant(star <= rating ? .fill : .none)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(star <= rating ? Color.lime : Color.white.opacity(0.3))
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Rating")
        .accessibilityValue("\(rating) of 5 stars")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: rating = min(5, rating + 1)
            case .decrement: rating = max(0, rating - 1)
            @unknown default: break
            }
        }
    }
}

/// Rendered to an image for sharing; sized 360 × 640 points at 3×.
private struct RecapStoryCard: View {
    var photo: UIImage?
    var fallback: [Color]
    var title: String
    var dates: String
    var stats: [(String, String)]

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: fallback, startPoint: .topLeading, endPoint: .bottomTrailing)
            if let photo {
                Image(uiImage: photo).resizable().scaledToFill().frame(width: 360, height: 640).clipped()
            }
            LinearGradient(colors: [.black.opacity(0), .black.opacity(0.25), .black.opacity(0.85)], startPoint: .top, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 10) {
                Text("RECAP").font(.mono(12, .bold)).foregroundStyle(Color.lime).tracking(1.5)
                Text(title).font(.sf(34, .bold)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text(dates).font(.sf(15)).foregroundStyle(.white.opacity(0.8))
                HStack(spacing: 8) {
                    ForEach(stats.indices, id: \.self) { i in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(stats[i].0).font(.mono(22, .bold)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
                            Text(stats[i].1).font(.sf(11, .medium)).foregroundStyle(.white.opacity(0.7))
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.14)))
                    }
                }
                .padding(.top, 8)
                Text("Planned with Trips Loom").font(.sf(12, .semibold)).foregroundStyle(.white.opacity(0.6)).padding(.top, 10)
            }
            .padding(24)
        }
        .frame(width: 360, height: 640)
        .environment(\.colorScheme, .dark)
    }
}
