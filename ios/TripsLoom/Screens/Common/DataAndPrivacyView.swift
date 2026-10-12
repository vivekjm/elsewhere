import StoreKit
import SwiftUI
import UniformTypeIdentifiers

struct DataAndPrivacyView: View {
    @Environment(TripStore.self) private var store
    @State private var sharing: IdentifiedURL?
    @State private var importing = false
    @State private var pending: DataPortability.Archive?
    @State private var message: String?
    @State private var deleting = false
    @State private var working = false
    @State private var deleteText = ""
    @State private var manageSubscriptions = false

    var body: some View {
        Form {
            if let error = store.storageError { Section("Save needs attention") { Text(error).foregroundStyle(Color.coral) } }
            Section {
                Button("Export my data") {
                    do { sharing = IdentifiedURL(url: try DataPortability.exportFile(store)) }
                    catch { message = error.localizedDescription }
                }
                Button("Restore a backup") { importing = true }
            } header: { Text("Your data") } footer: {
                Text("Includes trips, plans, budgets, packing, preferences, local photos and travel documents, up to 24 MB. Exported files are not password encrypted and may contain sensitive information. Keep them privately.")
            }
            Section {
                NavigationLink("Privacy & permissions") { PrivacyDetailsView() }
                Button("Manage subscriptions") { manageSubscriptions = true }
            }
            if store.hasAccount {
                Section {
                    Button("Delete my account", role: .destructive) { deleting = true }
                } footer: { Text("Permanently removes your account and its server data. Your App Store subscription continues until you cancel it with Apple.") }
            }
        }
        .formScreen()
        .navigationTitle("Data & privacy")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $sharing) { file in ShareSheet(items: [file.url]) }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= 24 * 1024 * 1024 else { throw BackendError(message: "Choose a backup smaller than 24 MB.") }
                pending = try DataPortability.decode(Data(contentsOf: url))
            } catch { message = error.localizedDescription }
        }
        .confirmationDialog("Replace your current trips?", isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } }), titleVisibility: .visible) {
            Button("Restore backup", role: .destructive) {
                guard let archive = pending else { return }
                do { try DataPortability.restore(archive, to: store); pending = nil }
                catch { message = error.localizedDescription }
            }
        } message: { Text("\(pending?.trips.count ?? 0) trips and \(pending?.wardrobe.count ?? 0) wardrobe items. This replaces data on this device and, when signed in, your account. Export your current data first.") }
        .sheet(isPresented: $deleting) {
            NavigationStack {
                Form {
                    Section {
                        Text("This permanently deletes your Trips Loom account, trips and uploaded photos from the server. Documents stored on this device will also be removed. This cannot be undone.")
                        Text("Cancel your subscription with Apple first if you have one. Deleting your account does not cancel billing.")
                        TextField("Type DELETE to confirm", text: $deleteText).textInputAutocapitalization(.characters).autocorrectionDisabled()
                        Button("Permanently delete account", role: .destructive) {
                            Task {
                                working = true
                                defer { working = false }
                                do {
                                    try await AccountAPI.delete()
                                    store.signOut()
                                    store.clearAll()
                                    deleting = false
                                } catch { message = error.localizedDescription }
                            }
                        }
                        .disabled(deleteText != "DELETE" || working)
                        if working { ProgressView("Deleting account…") }
                        if let message { Text(message).foregroundStyle(Color.coral) }
                    }
                }
                .navigationTitle("Delete account")
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { deleting = false }.disabled(working) } }
                .interactiveDismissDisabled(working)
            }
        }
        .manageSubscriptionsSheet(isPresented: $manageSubscriptions)
        .alert("Trips Loom", isPresented: Binding(get: { message != nil && !deleting }, set: { if !$0 { message = nil } })) {
            Button("OK") { message = nil }
        } message: { Text(message ?? "") }
    }
}

/// Human-readable, in-app explanation of the app's current data practices.
struct PrivacyDetailsView: View {
    var body: some View {
        Form {
            Section("Account & trips") {
                Text("Your trips, plans, wardrobe, cover photos and travel preferences are saved to your Trips Loom account on Cloudflare and Supabase so you can use them on other devices and tripsloom.com. Signing in with Apple or Google shares only your name and email. Session credentials are stored in the iOS Keychain.")
            }
            Section("Documents & sharing") {
                Text("Travel documents and health check-ins stay on this device with iOS file protection. New trip invitations exclude health records and include the plan, names, costs and votes. Anyone with the invitation can read and forward it; only share it with people you trust. Invitations are copies, not live collaborative editing.")
            }
            Section("External services") {
                Text("Destination names are sent to Apple Maps and, when needed, Open-Meteo for place search and weather. Currency codes are sent to ExchangeRate-API. Cover photos load from Unsplash. Requests expose your IP address to these providers. AI drafting uses Apple's on-device model when available.")
            }
            Section("Permissions") {
                Text("Notifications are optional and requested when you enable reminders. Photos and documents use Apple's pickers. Face ID or your passcode can protect the document viewer. The app does not request your current location or contacts.")
            }
            Section("Control") {
                Text("Export or delete your data from Data & privacy. Signing out removes account data from this device. Deleting your account removes account data from the server. Copies of invitations and exports that you have shared cannot be recalled.")
            }
            Section { Link("Privacy policy", destination: URL(string: "https://tripsloom.com/privacy")!) }
        }
        .navigationTitle("Privacy & permissions")
        .navigationBarTitleDisplayMode(.inline)
    }
}
