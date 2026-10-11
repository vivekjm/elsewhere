import SwiftUI
import UIKit

/// Destination photography. The design uses these Unsplash photos; each has a
/// gradient fallback so screens still read well offline.
enum Photo: String, Codable, CaseIterable, Identifiable, Sendable {
    /// Lisbon street with tram wires.
    case lisbon = "xerkMJTMNR4"
    /// Blue Himalayan ridges.
    case himalaya = "OQE110coqcc"
    /// Aurora over a night sky.
    case aurora = "LtnPejWDSAY"
    /// A Lisbon tram.
    case tram = "UIIwSB8q3mo"
    /// A sandy cove.
    case beach = "pjbixgSFdN8"

    var id: String { rawValue }

    func url(width: Int) -> URL {
        URL(string: "https://unsplash.com/photos/\(rawValue)/download?force=true&w=\(width)")!
    }

    var fallback: [Color] {
        switch self {
        case .lisbon: [Color(hex: 0x3E5A78), Color(hex: 0xC9895A)]
        case .himalaya: [Color(hex: 0x4A6282), Color(hex: 0x1F2A3A)]
        case .aurora: [Color(hex: 0x1D2A4A), Color(hex: 0x3E8F7A)]
        case .tram: [Color(hex: 0x40314F), Color(hex: 0xC8764E)]
        case .beach: [Color(hex: 0x2B8C9E), Color(hex: 0xD9B98A)]
        }
    }
}

/// Small image loader: memory cache, then a disk cache in Caches, then the
/// network. Unsplash download links redirect, which URLCache doesn't keep, so
/// the disk cache is what makes photos appear instantly and offline.
@MainActor
final class PhotoLoader {
    static let shared = PhotoLoader()

    private let memory = NSCache<NSURL, UIImage>()
    private var inflight: [URL: Task<UIImage?, Never>] = [:]
    private let directory: URL = {
        let dir = URL.cachesDirectory.appending(path: "photos", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private func file(for url: URL) -> URL {
        let key = url.absoluteString.utf8.reduce(UInt64(5381)) { ($0 &* 33) &+ UInt64($1) }
        return directory.appending(path: "\(String(key, radix: 16)).jpg")
    }

    /// Memory, then disk. Synchronous so first frames can show the photo.
    func cached(_ url: URL) -> UIImage? {
        if let hit = memory.object(forKey: url as NSURL) { return hit }
        guard let image = UIImage(contentsOfFile: file(for: url).path(percentEncoded: false)) else { return nil }
        memory.setObject(image, forKey: url as NSURL)
        return image
    }

    func load(_ url: URL) async -> UIImage? {
        if let hit = cached(url) { return hit }
        if let task = inflight[url] { return await task.value }
        let destination = file(for: url)
        let task = Task<UIImage?, Never> {
            guard let (data, response) = try? await URLSession.shared.data(from: url),
                  (response as? HTTPURLResponse)?.statusCode ?? 200 < 400,
                  let image = UIImage(data: data)
            else { return nil }
            try? data.write(to: destination, options: .atomic)
            return await image.byPreparingForDisplay() ?? image
        }
        inflight[url] = task
        let image = await task.value
        inflight[url] = nil
        if let image { memory.setObject(image, forKey: url as NSURL) }
        return image
    }
}

struct RemotePhoto: View {
    var photo: Photo
    var width: Int
    @State private var image: UIImage?
    @Environment(\.customCover) private var customCover

    init(photo: Photo, width: Int) {
        self.photo = photo
        self.width = width
        _image = State(initialValue: PhotoLoader.shared.cached(photo.url(width: width)))
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: photo.fallback, startPoint: .topLeading, endPoint: .bottomTrailing)
            if let customCover {
                Image(uiImage: customCover)
                    .resizable()
                    .scaledToFill()
            } else if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            }
        }
        .accessibilityHidden(true)
        // Reloads when the photo changes (a new cover, or a card reused for
        // another trip), so the old image never lingers.
        .task(id: photo.url(width: width)) {
            let url = photo.url(width: width)
            if let hit = PhotoLoader.shared.cached(url) {
                image = hit
                return
            }
            image = nil
            if let loaded = await PhotoLoader.shared.load(url) {
                withAnimation(.easeOut(duration: 0.25)) { image = loaded }
            }
        }
    }
}
