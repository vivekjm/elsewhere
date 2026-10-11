import Foundation
import Observation
import UIKit
import ImageIO
import PDFKit

/// Tickets, IDs, vouchers and permits for a trip. Files stay on this iPhone
/// (never synced), encrypted at rest with complete file protection.
@MainActor
@Observable
final class TripDocuments {
    static let shared = TripDocuments()

    enum Kind: String, Codable, CaseIterable, Identifiable, Sendable {
        case ticket, id, stay, permit, insurance, other
        var id: String { rawValue }

        var title: String {
            switch self {
            case .ticket: "Ticket"
            case .id: "ID"
            case .stay: "Stay voucher"
            case .permit: "Permit"
            case .insurance: "Insurance"
            case .other: "Other"
            }
        }

        var symbol: String {
            switch self {
            case .ticket: "ticket.fill"
            case .id: "person.text.rectangle.fill"
            case .stay: "bed.double.fill"
            case .permit: "checkmark.seal.fill"
            case .insurance: "cross.case.fill"
            case .other: "doc.fill"
            }
        }
    }

    struct Document: Identifiable, Codable, Hashable, Sendable {
        var id = UUID()
        var tripID: UUID
        var title: String
        var kind: Kind
        var fileName: String
        var addedAt = Date()
    }

    private(set) var all: [Document] = []

    private init() {
        if let data = try? Data(contentsOf: indexURL),
           let saved = try? JSONDecoder().decode([Document].self, from: data) {
            all = saved
        }
    }

    func documents(for trip: UUID) -> [Document] {
        all.filter { $0.tripID == trip }.sorted { $0.addedAt > $1.addedAt }
    }

    func url(_ document: Document) -> URL { directory.appending(path: document.fileName) }

    /// A temporary copy named after the document, so Quick Look's title reads
    /// "Museum ticket" rather than the stored file's UUID. Removed by `endPreview`.
    func previewURL(_ document: Document) -> URL {
        let source = url(document)
        let safe = document.title.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>")).joined(separator: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines).prefix(80)
        let folder = URL.temporaryDirectory.appending(path: "preview-\(document.id.uuidString)", directoryHint: .isDirectory)
        let target = folder.appending(path: "\(safe.isEmpty ? "Document" : String(safe)).\(source.pathExtension)")
        try? FileManager.default.removeItem(at: folder)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: source, to: target)
            return target
        } catch {
            return source
        }
    }

    func endPreview(_ url: URL?) {
        guard let url, url.path(percentEncoded: false).hasPrefix(URL.temporaryDirectory.path(percentEncoded: false)) else { return }
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }

    @discardableResult
    func add(_ data: Data, ext: String, title: String, kind: Kind, trip: UUID) -> Document? {
        guard Self.valid(data, ext: ext), title.count <= 200 else { return nil }
        let doc = Document(tripID: trip, title: title, kind: kind, fileName: "\(UUID().uuidString).\(ext)")
        do {
            try data.write(to: directory.appending(path: doc.fileName), options: [.atomic, .completeFileProtection])
        } catch {
            return nil
        }
        let next = all + [doc]
        do { try writeIndex(next); all = next }
        catch { try? FileManager.default.removeItem(at: url(doc)); return nil }
        return doc
    }

    static let maximumBytes = 10 * 1024 * 1024
    static func valid(_ data: Data, ext: String) -> Bool {
        guard !data.isEmpty, data.count <= maximumBytes else { return false }
        if ext == "pdf" {
            return data.starts(with: Data("%PDF-".utf8)) && PDFDocument(data: data).map { $0.pageCount > 0 && !$0.isLocked } == true
        }
        guard ext == "jpg", data.starts(with: [0xFF, 0xD8]),
              let source = CGImageSourceCreateWithData(data as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let w = properties[kCGImagePropertyPixelWidth] as? Int,
              let h = properties[kCGImagePropertyPixelHeight] as? Int,
              w > 0, h > 0, w <= 12000, h <= 12000, w * h <= 20_000_000 else { return false }
        return CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 64] as CFDictionary) != nil
    }

    /// Commits a validated backup index only after all new files are present.
    func replaceIndex(_ documents: [Document]) throws {
        try writeIndex(documents)
        all = documents
    }

    private func writeIndex(_ documents: [Document]) throws {
        try JSONEncoder().encode(documents).write(to: indexURL, options: [.atomic, .completeFileProtection])
    }

    func update(_ document: Document) {
        guard let i = all.firstIndex(where: { $0.id == document.id }) else { return }
        all[i] = document
        save()
    }

    func delete(_ document: Document) {
        try? FileManager.default.removeItem(at: url(document))
        all.removeAll { $0.id == document.id }
        save()
    }

    /// Removes documents whose trip is no longer on this iPhone (deleted,
    /// or the account signed out).
    func prune(keeping trips: Set<UUID>) {
        let gone = all.filter { !trips.contains($0.tripID) }
        guard !gone.isEmpty else { return }
        for doc in gone { try? FileManager.default.removeItem(at: url(doc)) }
        all.removeAll { !trips.contains($0.tripID) }
        save()
    }

    /// Photos are stored as JPEG, at most 2400 px on the long side.
    static func jpeg(from data: Data) -> Data? {
        guard data.count <= 25 * 1024 * 1024,
              let source = CGImageSourceCreateWithData(data as CFData, nil),
              let thumb = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 2400
              ] as CFDictionary) else { return nil }
        return UIImage(cgImage: thumb).jpegData(compressionQuality: 0.82)
    }

    // MARK: Storage

    private var directory: URL {
        let dir = URL.applicationSupportDirectory.appending(path: "documents", directoryHint: .isDirectory)
        if !FileManager.default.fileExists(atPath: dir.path(percentEncoded: false)) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        }
        return dir
    }

    private var indexURL: URL { directory.appending(path: "index.json") }

    private func save() {
        guard let data = try? JSONEncoder().encode(all) else { return }
        try? data.write(to: indexURL, options: [.atomic, .completeFileProtection])
    }
}
