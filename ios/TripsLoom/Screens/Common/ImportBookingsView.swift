import AVFoundation
import PDFKit
import SwiftUI
import UniformTypeIdentifiers
import Vision
import VisionKit

/// C10. Bookings pasted or scanned from a ticket are filed to the right day,
/// so there is almost no typing.
struct ImportBookingsView: View {
    let tripID: UUID
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var found: [ParsedBooking] = []
    @State private var selected: Set<UUID> = []
    @State private var scanning = false
    @State private var choosingFile = false
    @State private var note: String?

    var body: some View {
        let trip = store.trip(tripID)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Group {
                        if found.isEmpty {
                            Text("Paste, scan or choose a booking confirmation and it's filed to the right day of \(Text(trip?.name ?? "your trip").foregroundStyle(.white).bold()).")
                        } else {
                            Text("\(found.count) \(found.count == 1 ? "booking matches" : "bookings match") \(Text(trip?.name ?? "your trip").foregroundStyle(.white).bold()).")
                        }
                    }
                    .font(.sf(15))
                    .foregroundStyle(Color.textMuted)
                    .lineSpacing(2)
                    .padding(.horizontal, 4)

                    if !found.isEmpty {
                        GlassList {
                            ForEach(found) { booking in
                                Button {
                                    if selected.contains(booking.id) { selected.remove(booking.id) } else { selected.insert(booking.id) }
                                } label: {
                                    ListRow(booking.title, meta: meta(booking)) {
                                        IconTile(symbol: booking.category.symbol, color: booking.category.tile)
                                    } trailing: {
                                        CheckCircle(isOn: selected.contains(booking.id))
                                    }
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(selected.contains(booking.id) ? .isSelected : [])
                            }
                        }
                    }

                    if let note {
                        Text(note).font(.sf(13)).foregroundStyle(Color.apricot).padding(.horizontal, 4)
                    }

                    SectionLabel(found.isEmpty ? "Ways to add" : "More ways to add")
                    GlassList {
                        ListRow("Paste a confirmation", meta: "Email or message text") {
                            IconTile(symbol: "doc.on.clipboard.fill", color: Tile.indigo)
                        } trailing: {
                            PasteButton(payloadType: String.self) { strings in
                                ingest(strings.joined(separator: "\n"))
                            }
                            .buttonBorderShape(.capsule)
                            .labelStyle(.titleOnly)
                            .tint(.white.opacity(0.12))
                        }
                        Button {
                            if DocumentScanner.isAvailable {
                                scanning = true
                            } else {
                                note = "Scanning needs a device camera. Paste the confirmation instead."
                            }
                        } label: {
                            ListRow("Scan a ticket or passport") {
                                IconTile(symbol: "viewfinder", color: Tile.green)
                            } trailing: { CornerArrow() }
                        }
                        .buttonStyle(.plain)
                        Button { choosingFile = true } label: {
                            ListRow("Choose a PDF or file", meta: "E-tickets, hotel vouchers, saved emails") {
                                IconTile(symbol: "doc.fill", color: Tile.amber)
                            } trailing: { CornerArrow() }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .safeAreaInset(edge: .bottom) {
                if !selected.isEmpty {
                    Button("Add \(selected.count) to trip") { add() }
                        .buttonStyle(CTAStyle())
                        .padding(.horizontal, Metrics.gutter)
                        .padding(.bottom, 8)
                }
            }
            .navigationTitle(found.isEmpty ? "Add bookings" : "Found bookings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                }
            }
            .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.pdf, .plainText, .text, .emailMessage, .html]) { result in
                guard case let .success(url) = result else { return }
                let text = Self.text(from: url)
                if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    note = "Couldn't read text from that file. If it's a scan, use Scan a ticket instead."
                } else {
                    ingest(String(text.prefix(60_000)))
                }
            }
            .fullScreenCover(isPresented: $scanning) {
                DocumentScanner { text in
                    scanning = false
                    if let text { ingest(text) }
                }
                .ignoresSafeArea()
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(40)
        .presentationBackground { SheetGlass(photo: trip?.photo ?? .lisbon) }
    }

    private func meta(_ booking: ParsedBooking) -> String {
        var parts: [String] = []
        if let date = booking.date { parts.append(Fmt.monthDay(date)) }
        if let trip = store.trip(tripID), let offset = BookingParser.dayOffset(booking, in: trip) {
            if !trip.dayIndices.contains(offset) { parts.append("Outside trip dates · review before adding") }
            parts.append("Day \(max(0, min(offset, trip.dayCount - 1)) + 1)")
        }
        if let time = booking.time { parts.append(time) }
        if !booking.meta.isEmpty { parts.append(booking.meta) }
        return parts.joined(separator: " · ")
    }

    /// Text from a PDF's pages, or a text, HTML or email file (at most 2 MB).
    static func text(from url: URL) -> String {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        if let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > 20_000_000 { return "" }
        if url.pathExtension.lowercased() == "pdf" || UTType(filenameExtension: url.pathExtension)?.conforms(to: .pdf) == true {
            guard let document = PDFDocument(url: url) else { return "" }
            return (0..<min(document.pageCount, 30)).compactMap { document.page(at: $0)?.string }.joined(separator: "\n")
        }
        guard let data = try? Data(contentsOf: url), data.count <= 2_000_000 else { return "" }
        let raw = String(decoding: data, as: UTF8.self)
        if ["html", "htm"].contains(url.pathExtension.lowercased()),
           let attributed = try? NSAttributedString(data: data, options: [.documentType: NSAttributedString.DocumentType.html], documentAttributes: nil) {
            return attributed.string
        }
        return raw
    }

    private func ingest(_ text: String) {
        guard text.utf8.count <= 100_000 else {
            note = "Paste one confirmation at a time, under 100 KB."; return
        }
        let parsed = BookingParser.parse(text)
        if parsed.isEmpty {
            note = "Nothing that looks like a booking was found."
            return
        }
        note = nil
        let additions = parsed.filter { candidate in !found.contains { BookingParser.sameBooking($0, candidate) } }
        guard !additions.isEmpty else { note = "This confirmation is already in the preview."; return }
        withAnimation(Motion.snappy) {
            found.append(contentsOf: additions)
            selected.formUnion(additions.map(\.id))
        }
    }

    private func add() {
        store.update(tripID) { trip in
            trip.plans.append(contentsOf: BookingParser.importedPlans(found.filter { selected.contains($0.id) }, into: trip))
        }
        dismiss()
    }
}

/// VisionKit's document camera, with Vision text recognition on the result.
struct DocumentScanner: UIViewControllerRepresentable {
    var onFinish: (String?) -> Void

    /// VisionKit reports support on the Simulator and on devices whose camera
    /// is restricted; both only show "Unable to capture media".
    static var isAvailable: Bool {
        VNDocumentCameraViewController.isSupported && AVCaptureDevice.default(for: .video) != nil
    }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let onFinish: (String?) -> Void
        init(onFinish: @escaping (String?) -> Void) { self.onFinish = onFinish }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            let images = (0..<scan.pageCount).compactMap { scan.imageOfPage(at: $0).cgImage }
            let finish = onFinish
            Task {
                var lines: [String] = []
                for image in images {
                    var request = RecognizeTextRequest()
                    request.recognitionLevel = .accurate
                    if let observations = try? await request.perform(on: image) {
                        lines += observations.compactMap { $0.topCandidates(1).first?.string }
                    }
                }
                finish(lines.joined(separator: "\n"))
            }
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            onFinish(nil)
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: any Error) {
            onFinish(nil)
        }
    }
}
