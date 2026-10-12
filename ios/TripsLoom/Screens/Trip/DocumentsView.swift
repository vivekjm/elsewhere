import LocalAuthentication
import PhotosUI
import QuickLook
import SwiftUI
import UniformTypeIdentifiers
import VisionKit

struct DocumentsRoute: Hashable {}

/// "Documents · 2 saved" row that opens the trip's documents.
struct DocumentsRow: View {
    var trip: Trip

    var body: some View {
        let count = TripDocuments.shared.documents(for: trip.id).count
        NavigationLink(value: DocumentsRoute()) {
            ListRow("Documents", meta: count == 0 ? "Tickets, IDs and vouchers, offline" : "\(Fmt.count(count, "document")) saved · offline") {
                IconTile(symbol: "wallet.pass.fill", color: Tile.teal)
            } trailing: { CornerArrow() }
        }
        .buttonStyle(.plain)
    }
}

/// Tickets, IDs, vouchers and permits for one trip, kept on this iPhone.
/// Pro can lock them behind Face ID.
struct DocumentsView: View {
    @Binding var trip: Trip
    @Environment(TripStore.self) private var store
    @State private var preview: URL?
    @State private var scanning = false
    @State private var importing = false
    @State private var photoItem: PhotosPickerItem?
    @State private var choosingPhoto = false
    @State private var pending: Pending?
    @State private var renaming: TripDocuments.Document?
    @State private var paywall = false
    @State private var unlocked = false
    /// Set when the app went to the background with the vault open.
    @State private var relockPending = false
    @Environment(\.scenePhase) private var scenePhase
    @State private var suggestion: String?
    @State private var importError: String?

    /// A file waiting for its name and kind.
    struct Pending: Identifiable {
        let id = UUID()
        var data: Data
        var ext: String
        var title: String
        var kind: TripDocuments.Kind
    }

    private var docs: [TripDocuments.Document] { TripDocuments.shared.documents(for: trip.id) }
    private var locked: Bool { store.profile.isPro && store.profile.lockDocuments == true && !unlocked }

    /// Required documents from the packing list that aren't saved yet.
    private var suggestions: [PackItem] {
        let saved = docs.map { $0.title.lowercased() }
        let words = ["passport", "id", "ticket", "boarding", "permit", "visa", "licence", "license", "insurance", "voucher", "photos"]
        return trip.packing
            .filter { $0.required || $0.meta.localizedCaseInsensitiveContains("document") }
            .filter { item in words.contains { item.name.lowercased().contains($0) } }
            .filter { item in !saved.contains { $0.contains(item.name.lowercased()) || item.name.lowercased().contains($0) } }
    }

    var body: some View {
        NightScreen(photo: trip.photo, spacing: 12, title: "Documents") {
            ScreenHeader(
                title: "Documents",
                meta: docs.isEmpty ? "Tickets, IDs and vouchers, offline" : "\(Fmt.count(docs.count, "document")) · on this iPhone, offline",
                size: 34
            )
            .padding(.top, 8)

            if locked {
                lockedCard
            } else {
                content
            }
        }
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    addButtons(title: nil)
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color.ink)
                }
                .menuStyle(.button)
                .buttonStyle(.glassProminent)
                .tint(.lime)
                .accessibilityLabel("Add document")
                .disabled(locked)
            }
        }
        .quickLookPreview($preview)
        .onChange(of: preview) { old, new in if new == nil { TripDocuments.shared.endPreview(old) } }
        .fullScreenCover(isPresented: $scanning) {
            DocumentPDFScanner { data in
                scanning = false
                if let data { pending = Pending(data: data, ext: "pdf", title: suggestion ?? "Scan", kind: kind(for: suggestion)) }
            }
            .ignoresSafeArea()
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf, .image]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                guard (try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0) <= TripDocuments.maximumBytes else {
                    throw BackendError(message: "Choose a document smaller than 10 MB.")
                }
                let data = try Data(contentsOf: url), isPDF = url.pathExtension.lowercased() == "pdf"
                guard let stored = isPDF ? data : TripDocuments.jpeg(from: data), TripDocuments.valid(stored, ext: isPDF ? "pdf" : "jpg") else {
                    throw BackendError(message: "This file cannot be opened. Choose a PDF or photo.")
                }
                pending = Pending(data: stored, ext: isPDF ? "pdf" : "jpg", title: String((suggestion ?? url.deletingPathExtension().lastPathComponent).prefix(200)), kind: kind(for: suggestion ?? url.lastPathComponent))
            } catch CocoaError.userCancelled { } catch { importError = error.localizedDescription }
        }
        .photosPicker(isPresented: $choosingPhoto, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                do {
                    guard let data = try await item.loadTransferable(type: Data.self), let jpeg = TripDocuments.jpeg(from: data) else {
                        throw BackendError(message: "This photo cannot be opened. Choose another image smaller than 25 MB.")
                    }
                    pending = Pending(data: jpeg, ext: "jpg", title: suggestion ?? "Photo", kind: kind(for: suggestion))
                } catch { importError = error.localizedDescription }
                photoItem = nil
            }
        }
        .sheet(item: $pending) { item in
            DocumentDetailsSheet(title: item.title, kind: item.kind, isNew: true) { title, kind in
                if TripDocuments.shared.add(item.data, ext: item.ext, title: title, kind: kind, trip: trip.id) == nil {
                    importError = "The document could not be saved. Check available storage and choose a PDF or photo smaller than 10 MB."
                }
                suggestion = nil
            }
        }
        .sheet(item: $renaming) { doc in
            DocumentDetailsSheet(title: doc.title, kind: doc.kind, isNew: false) { title, kind in
                var updated = doc
                updated.title = title
                updated.kind = kind
                TripDocuments.shared.update(updated)
            }
        }
        .fullScreenCover(isPresented: $paywall) { PaywallView(reason: .documents) }
        .alert("Document needs attention", isPresented: Binding(get: { importError != nil }, set: { if !$0 { importError = nil } })) {
            Button("OK") { importError = nil }
        } message: { Text(importError ?? "") }
        .task { if store.profile.isPro, store.profile.lockDocuments == true { await unlock() } }
        // Leaving the app locks the vault again; coming back asks once. The
        // Face ID sheet only makes the app inactive, so it doesn't count.
        .onChange(of: scenePhase) { _, phase in
            guard store.profile.isPro, store.profile.lockDocuments == true else { return }
            if phase == .background {
                unlocked = false
                relockPending = true
            } else if phase == .active, relockPending {
                relockPending = false
                Task { await unlock() }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if docs.isEmpty {
            EmptyNote(title: "Nothing saved yet", message: "Scan a ticket or add a photo of your ID. Documents open without a signal.")
        } else {
            GlassList {
                ForEach(docs) { doc in
                    Button { preview = TripDocuments.shared.previewURL(doc) } label: {
                        ListRow(doc.title, meta: "\(doc.kind.title) · \(doc.fileName.hasSuffix("pdf") ? "PDF" : "Photo") · added \(Fmt.monthDay(doc.addedAt))") {
                            IconTile(symbol: doc.kind.symbol, color: tile(doc.kind))
                        } trailing: {
                            CornerArrow()
                        }
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button("Rename", systemImage: "pencil") { renaming = doc }
                        ShareLink(item: TripDocuments.shared.previewURL(doc)) { Label("Share", systemImage: "square.and.arrow.up") }
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            withAnimation { TripDocuments.shared.delete(doc) }
                        }
                    }
                }
            }
        }

        if !suggestions.isEmpty {
            SectionLabel("From your packing list")
                .padding(.top, 4)
            GlassList {
                ForEach(suggestions) { item in
                    let name = item.name
                    ListRow(name, meta: item.required ? "Required · not saved yet" : "Not saved yet") {
                        IconTile(symbol: kind(for: name).symbol, color: Tile.bronze)
                    } trailing: {
                        Menu {
                            addButtons(title: name)
                        } label: {
                            Text("Add").font(.sf(15, .semibold)).foregroundStyle(.white)
                                .padding(.horizontal, 14).padding(.vertical, 4).frame(minHeight: 36)
                                .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.white.opacity(0.12)))
                        }
                    }
                }
            }
        }

        GlassList {
            Toggle(isOn: Binding(
                get: { store.profile.isPro && store.profile.lockDocuments == true },
                set: { on in
                    if !store.profile.isPro { paywall = true; return }
                    store.profile.lockDocuments = on
                    if on { unlocked = true }
                }
            )) {
                ListRow("Lock with Face ID", meta: store.profile.isPro ? "Asks each time you open Documents" : "Pro")
            }
            .toggleStyle(LimeToggleStyle())
        }
        .padding(.top, 4)

        if !store.profile.isPro {
            Text("Free plan: \(Entitlements.freeDocumentsPerTrip) documents per trip. Files aren't synced. Exported backups include documents; keep copies private.")
                .font(.sf(13))
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)
        } else {
            Text("Files aren't synced. Exported backups include your documents; keep those copies private.")
                .font(.sf(13))
                .foregroundStyle(Color.textFaint)
                .padding(.horizontal, 4)
        }
    }

    private var lockedCard: some View {
        VStack(spacing: 14) {
            Image(systemName: "faceid").font(.system(size: 40)).foregroundStyle(Color.lime)
            Text("Documents are locked").font(.sf(17, .semibold)).foregroundStyle(.white)
            Button("Unlock") { Task { await unlock() } }
                .buttonStyle(LimePillStyle(height: 40))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .glass(28)
    }

    @ViewBuilder
    private func addButtons(title: String?) -> some View {
        Button("Scan", systemImage: "doc.viewfinder") { start(title) { scanning = true } }
            .disabled(!DocumentScanner.isAvailable)
        Button("Photo", systemImage: "photo") { start(title) { choosingPhoto = true } }
        Button("File", systemImage: "folder") { start(title) { importing = true } }
    }

    /// Checks the free allowance before opening a picker.
    private func start(_ title: String?, open: () -> Void) {
        if !store.profile.isPro, docs.count >= Entitlements.freeDocumentsPerTrip {
            paywall = true
            return
        }
        suggestion = title
        open()
    }

    private func unlock() async {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            unlocked = true
            return
        }
        unlocked = (try? await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock your travel documents")) ?? false
    }

    private func kind(for name: String?) -> TripDocuments.Kind {
        let n = (name ?? "").lowercased()
        if ["ticket", "boarding", "flight", "train", "bus"].contains(where: n.contains) { return .ticket }
        if ["passport", "id", "licence", "license", "aadhaar", "voter", "photos"].contains(where: n.contains) { return .id }
        if ["hotel", "stay", "voucher", "booking"].contains(where: n.contains) { return .stay }
        if ["permit", "visa"].contains(where: n.contains) { return .permit }
        if n.contains("insurance") { return .insurance }
        return .other
    }

    private func tile(_ kind: TripDocuments.Kind) -> Color {
        switch kind {
        case .ticket: Tile.indigo
        case .id: Tile.teal
        case .stay: Tile.green
        case .permit: Tile.amber
        case .insurance: Tile.red
        case .other: Tile.bronze
        }
    }
}

/// Name and kind for a new or existing document.
struct DocumentDetailsSheet: View {
    @State var title: String
    @State var kind: TripDocuments.Kind
    var isNew: Bool
    var save: (String, TripDocuments.Kind) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $title)
                Picker("Kind", selection: $kind) {
                    ForEach(TripDocuments.Kind.allCases) { Label($0.title, systemImage: $0.symbol).tag($0) }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isNew ? "Save document" : "Edit document")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        save(title.trimmingCharacters(in: .whitespaces).isEmpty ? kind.title : title, kind)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

/// VisionKit's document camera; returns the scan as one PDF.
struct DocumentPDFScanner: UIViewControllerRepresentable {
    var done: (Data?) -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(done: done) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let done: (Data?) -> Void
        init(done: @escaping (Data?) -> Void) { self.done = done }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            let bounds = CGRect(x: 0, y: 0, width: 612, height: 792)
            let data = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
                for index in 0..<scan.pageCount {
                    let image = scan.imageOfPage(at: index)
                    context.beginPage()
                    let scale = min(bounds.width / image.size.width, bounds.height / image.size.height)
                    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
                    image.draw(in: CGRect(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2, width: size.width, height: size.height))
                }
            }
            done(data)
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) { done(nil) }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) { done(nil) }
    }
}
