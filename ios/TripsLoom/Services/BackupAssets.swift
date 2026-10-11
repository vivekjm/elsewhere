import Foundation
import UIKit
import ImageIO

extension DataPortability {
    struct Asset: Codable {
        enum Kind: String, Codable { case cover, garment, document }
        var kind: Kind
        var id: UUID
        var ext: String
        var data: Data
    }

    @MainActor
    static func encodeBundle(_ store: TripStore) throws -> Data {
        var archive = try decode(encode(trips: store.trips, wardrobe: store.wardrobe, profile: store.profile))
        archive.version = 2
        var assets: [Asset] = []
        func append(_ kind: Asset.Kind, _ id: UUID, _ ext: String, _ data: Data) throws {
            guard assets.reduce(data.count, { $0 + $1.data.count }) <= 17 * 1024 * 1024 else {
                throw BackendError(message: "Your photos and documents exceed the 24 MB backup limit. Export large documents individually.")
            }
            assets.append(Asset(kind: kind, id: id, ext: ext, data: data))
        }
        for trip in store.trips {
            if let file = trip.coverFile {
                guard let data = CoverStore.shared.data(file) else { throw BackendError(message: "A cover photo is missing. Restore or remove it before exporting.") }
                try append(.cover, trip.id, "jpg", data)
            }
        }
        for item in store.wardrobe {
            if let file = item.imageFile {
                guard WardrobePhotos.isSafeFileName(file), let data = try? Data(contentsOf: WardrobePhotos.directory.appending(path: file)) else {
                    throw BackendError(message: "A wardrobe photo is missing. Restore or remove it before exporting.")
                }
                try append(.garment, item.id, "jpg", data)
            }
        }
        archive.documents = TripDocuments.shared.all.filter { doc in store.trips.contains { $0.id == doc.tripID } }
        for doc in archive.documents ?? [] {
            guard let data = try? Data(contentsOf: TripDocuments.shared.url(doc)) else { throw BackendError(message: "A document is missing. Restore or remove it before exporting.") }
            try append(.document, doc.id, doc.fileName.hasSuffix(".pdf") ? "pdf" : "jpg", data)
        }
        archive.assets = assets
        try validate(archive)
        let data = try JSONEncoder.store.encode(archive)
        guard data.count <= 24 * 1024 * 1024 else { throw BackendError(message: "Choose fewer photos and documents to keep your backup under 24 MB.") }
        return data
    }

    static func validateAssets(_ archive: Archive) throws {
        let assets = archive.assets ?? [], docs = archive.documents ?? []
        guard (archive.version == 2 || (assets.isEmpty && docs.isEmpty)), assets.count <= 6500,
              docs.count <= 1000, Set(docs.map(\.id)).count == docs.count,
              Set(assets.map { "\($0.kind.rawValue):\($0.id)" }).count == assets.count,
              assets.reduce(0, { $0 + $1.data.count }) <= 17 * 1024 * 1024 else {
            throw BackendError(message: "This backup has invalid or oversized attachments.")
        }
        let trips = Set(archive.trips.map(\.id)), wardrobe = Set(archive.wardrobe.map(\.id))
        let documentIDs = Set(docs.map(\.id))
        for asset in assets {
            let owns = switch asset.kind {
            case .cover: trips.contains(asset.id)
            case .garment: wardrobe.contains(asset.id)
            case .document: documentIDs.contains(asset.id)
            }
            guard owns, TripDocuments.valid(asset.data, ext: asset.ext) else { throw BackendError(message: "This backup has an invalid attachment. Nothing has been changed.") }
            if asset.kind != .document, asset.ext != "jpg" { throw BackendError(message: "Photos must be JPEG images.") }
            if asset.ext == "jpg" {
                guard let source = CGImageSourceCreateWithData(asset.data as CFData, nil),
                      let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
                      let w = props[kCGImagePropertyPixelWidth] as? Int, let h = props[kCGImagePropertyPixelHeight] as? Int,
                      w > 0, h > 0, w <= 12000, h <= 12000, w * h <= 20_000_000 else {
                    throw BackendError(message: "A backup image is too large or cannot be opened.")
                }
            }
        }
        guard docs.allSatisfy({ trips.contains($0.tripID) && !$0.title.isEmpty && $0.title.count <= 200 }) else {
            throw BackendError(message: "A backup document is missing its file or trip.")
        }
        for doc in docs where !assets.contains(where: { $0.kind == .document && $0.id == doc.id }) {
            throw BackendError(message: "A backup document is missing its file.")
        }
    }

    /// All assets receive new, app-generated filenames. Imported paths are never
    /// used. A failure rolls back the model/index and removes the staged files.
    @MainActor
    static func restore(_ archive: Archive, to store: TripStore) throws {
        try validate(archive)
        let oldProfile = store.profile
        let oldDocuments = TripDocuments.shared.all
        var trips = archive.trips, wardrobe = archive.wardrobe, documents = archive.documents ?? []
        var staged: [URL] = []
        do {
            for asset in archive.assets ?? [] {
                let folder = switch asset.kind { case .cover: "covers"; case .garment: "wardrobe"; case .document: "documents" }
                let directory = URL.applicationSupportDirectory.appending(path: folder, directoryHint: .isDirectory)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
                let file = "\(UUID().uuidString).\(asset.ext)", url = directory.appending(path: file)
                try asset.data.write(to: url, options: [.atomic, .completeFileProtection]); staged.append(url)
                switch asset.kind {
                case .cover: if let i = trips.firstIndex(where: { $0.id == asset.id }) { trips[i].coverFile = file }
                case .garment: if let i = wardrobe.firstIndex(where: { $0.id == asset.id }) { wardrobe[i].imageFile = file }
                case .document: if let i = documents.firstIndex(where: { $0.id == asset.id }) { documents[i].fileName = file }
                }
            }
            try TripDocuments.shared.replaceIndex(documents)
            var profile = archive.profile
            profile.isPro = oldProfile.isPro; profile.proPlan = oldProfile.proPlan
            profile.email = oldProfile.email; profile.onboardingCompleted = true
            store.openTripID = nil
            guard store.replaceData(trips: trips, wardrobe: wardrobe, profile: profile) else {
                throw BackendError(message: store.storageError ?? "Your backup could not be saved.")
            }
            for doc in oldDocuments where !documents.contains(where: { $0.fileName == doc.fileName }) {
                try? FileManager.default.removeItem(at: TripDocuments.shared.url(doc))
            }
            // The restore replaced every trip and piece, so photos the restored
            // data doesn't use would stay on the phone with nothing pointing at them.
            for file in photoFiles(in: "covers").subtracting(trips.compactMap(\.coverFile)) { CoverStore.shared.delete(file) }
            for file in photoFiles(in: "wardrobe").subtracting(wardrobe.compactMap(\.imageFile)) { WardrobePhotos.delete(file) }
            RouteSnapshots.prune(keeping: Set(trips.map(\.id)))
        } catch {
            try? TripDocuments.shared.replaceIndex(oldDocuments)
            for file in staged { try? FileManager.default.removeItem(at: file) }
            throw error
        }
    }

    /// App-generated photo names in one of the app's photo folders.
    private static func photoFiles(in folder: String) -> Set<String> {
        let directory = URL.applicationSupportDirectory.appending(path: folder, directoryHint: .isDirectory)
        let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path(percentEncoded: false))) ?? []
        return Set(names.filter(WardrobePhotos.isSafeFileName))
    }
}
