import SwiftUI

struct HelpView: View {
    @Environment(TripStore.self) private var store
    @State private var kind = "issue"
    @State private var message = ""
    @State private var sending = false
    @State private var result: String?
    @FocusState private var composing: Bool

    var body: some View {
        Form {
            Section("Getting started") {
                Text("Create a trip, choose its dates and destination time zone, then add activities, outfits and essentials. Your packing list collects the pieces you need.")
                Text("Signed-in accounts sync when online. Offline edits stay on this device and retry when you return. Travel documents stay on the device.")
                Text("Invitations share a copy of the plan. They do not enable live editing between travellers.")
            }
            Section("Report an issue or share an idea") {
                Picker("Topic", selection: $kind) {
                    Text("Something isn't working").tag("issue")
                    Text("Feature idea").tag("idea")
                    Text("Question").tag("question")
                }
                TextField("Tell us what happened and what you expected", text: $message, axis: .vertical)
                    .lineLimit(5...10)
                    .focused($composing)
                    .onChange(of: message) { _, text in if text.count > 4000 { message = String(text.prefix(4000)) } }
                Text("Your message, account ID, app version and language are sent. Please omit passwords, passport numbers and other sensitive information.")
                    .font(.footnote).foregroundStyle(.secondary)
                Button(sending ? "Sending…" : "Send feedback") {
                    Task {
                        sending = true
                        defer { sending = false }
                        guard store.sync.isSignedIn else {
                            FeedbackAPI.queue(kind: kind, message: message)
                            message = ""
                            result = "Saved on this iPhone. It's sent when you sign in, so we can reply if needed."
                            return
                        }
                        do {
                            try await FeedbackAPI.send(kind: kind, message: message)
                            message = ""
                            result = "Your feedback was received. Thank you for helping improve Trips Loom."
                        } catch { result = error.localizedDescription }
                    }
                }
                .disabled(sending || message.trimmingCharacters(in: .whitespacesAndNewlines).count < 10)
                if !store.sync.isSignedIn {
                    Text(FeedbackAPI.pendingCount > 0
                         ? "\(FeedbackAPI.pendingCount) message\(FeedbackAPI.pendingCount == 1 ? "" : "s") waiting. Sign in from Profile to send."
                         : "You're not signed in. Feedback is saved and sent when you sign in.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            Section("About") {
                LabeledContent("Version", value: FeedbackAPI.appVersion)
                NavigationLink("Privacy & permissions") { PrivacyDetailsView() }
                Link("Website", destination: URL(string: "https://tripsloom.com")!)
            }
        }
        .formScreen()
        .navigationTitle("Help & feedback")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { composing = false }
            }
        }
        .alert("Trips Loom", isPresented: Binding(get: { result != nil }, set: { if !$0 { result = nil } })) {
            Button("OK") { result = nil }
        } message: { Text(result ?? "") }
    }
}
