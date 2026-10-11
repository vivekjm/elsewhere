import SwiftUI
import UIKit

/// Your own trip cover photos. Stored in Application Support as
/// `<trip id>.jpg`, uploaded to the account's private photos when signed in,
/// and shown wherever the trip's stock photo would be.
@MainActor
@Observable
final class CoverStore {
    static let shared = CoverStore()

    /// Bumped when a cover is saved or removed, so views reload.
    private(set) var version = 0
    @ObservationIgnored private let memory = NSCache<NSString, UIImage>()

    static func fileName(for trip: UUID) -> String { "\(trip.uuidString).jpg" }

    private var directory: URL {
        let dir = URL.applicationSupportDirectory.appending(path: "covers", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func image(_ file: String?) -> UIImage? {
        _ = version
        guard let file, WardrobePhotos.isSafeFileName(file) else { return nil }
        if let hit = memory.object(forKey: file as NSString) { return hit }
        guard let image = UIImage(contentsOfFile: directory.appending(path: file).path(percentEncoded: false)) else { return nil }
        memory.setObject(image, forKey: file as NSString)
        return image
    }

    func exists(_ file: String?) -> Bool {
        guard let file, WardrobePhotos.isSafeFileName(file) else { return false }
        return FileManager.default.fileExists(atPath: directory.appending(path: file).path(percentEncoded: false))
    }

    /// Saves a photo as the trip's cover (at most 1600 px wide) and returns
    /// the file name, or nil if the data isn't an image.
    @discardableResult
    func save(_ data: Data, for trip: UUID) -> String? {
        guard let image = UIImage(data: data) else { return nil }
        let width = min(image.size.width, 1600)
        let size = CGSize(width: width, height: width * image.size.height / max(image.size.width, 1))
        guard let jpeg = (image.preparingThumbnail(of: size) ?? image).jpegData(compressionQuality: 0.82) else { return nil }
        let name = Self.fileName(for: trip)
        do { try jpeg.write(to: directory.appending(path: name), options: [.atomic, .completeFileProtection]) } catch { return nil }
        memory.removeObject(forKey: name as NSString)
        version += 1
        return name
    }

    func data(_ file: String?) -> Data? {
        guard let file, WardrobePhotos.isSafeFileName(file) else { return nil }
        return try? Data(contentsOf: directory.appending(path: file))
    }

    func delete(_ file: String?) {
        guard let file, WardrobePhotos.isSafeFileName(file) else { return }
        try? FileManager.default.removeItem(at: directory.appending(path: file))
        memory.removeObject(forKey: file as NSString)
        version += 1
    }

    /// Removes covers of trips no longer on this iPhone.
    func prune(keeping trips: Set<UUID>) {
        let files = (try? FileManager.default.contentsOfDirectory(atPath: directory.path(percentEncoded: false))) ?? []
        for file in files {
            guard let id = UUID(uuidString: String(file.dropLast(4))), !trips.contains(id) else { continue }
            delete(file)
        }
    }
}

extension EnvironmentValues {
    /// A trip's own cover photo; every `RemotePhoto` below shows it instead
    /// of the stock photo.
    @Entry var customCover: UIImage? = nil
}

extension View {
    /// Shows the trip's own cover, if it has one, in place of its stock photo.
    func tripCover(_ trip: Trip) -> some View {
        modifier(TripCoverModifier(file: trip.coverFile))
    }
}

private struct TripCoverModifier: ViewModifier {
    var file: String?
    func body(content: Content) -> some View {
        content.environment(\.customCover, CoverStore.shared.image(file))
    }
}
