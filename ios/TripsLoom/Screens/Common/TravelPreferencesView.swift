import SwiftUI

/// Profile → Travel preferences: the same inputs first-run onboarding sets.
struct TravelPreferencesView: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var base = ""
    @State private var style = "A bit of everything"
    @State private var pace = "Balanced"
    @State private var diet = "No preference"
    @State private var budget = "Mid-range"
    @State private var metric = true

    var body: some View {
        Form {
            Section {
                TextField("Your name", text: $name).textContentType(.name)
                TextField("Home city or airport", text: $base).textInputAutocapitalization(.words)
            } header: { Text("About you") } footer: { Text("Optional. Used to personalize your trips and suggestions.") }
            Section("Your travel preferences") {
                choice("Travel style", value: $style, options: PreferenceOptions.styles)
                choice("Pace", value: $pace, options: PreferenceOptions.paces)
                choice("Food", value: $diet, options: PreferenceOptions.diets)
                choice("Budget", value: $budget, options: PreferenceOptions.budgets)
                Picker("Units", selection: $metric) { Text("Metric").tag(true); Text("Imperial").tag(false) }
            }
        }
        .formScreen()
        .navigationTitle("Travel preferences")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { finish() }.accessibilityIdentifier("save-travel-preferences")
            }
        }
        .tint(.lime)
        .onAppear {
            name = store.profile.name; base = store.profile.homeAirport
            style = store.profile.travelStyle; pace = store.profile.pace
            diet = store.profile.diet; budget = store.profile.budgetStyle; metric = store.profile.metric
        }
    }

    private func choice(_ title: String, value: Binding<String>, options: [String]) -> some View {
        Picker(title, selection: value) {
            ForEach(options.contains(value.wrappedValue) ? options : options + [value.wrappedValue], id: \.self) { Text($0) }
        }
    }

    private func finish() {
        store.profile.name = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
        store.profile.homeAirport = String(base.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
        store.profile.travelStyle = style; store.profile.pace = pace
        store.profile.diet = diet; store.profile.budgetStyle = budget; store.profile.metric = metric
        store.profile.onboardingCompleted = true
        store.saveNow()
        dismiss()
    }
}

struct TimeZonePicker: View {
    @Binding var identifier: String
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    private var choices: [String] {
        TimeZone.knownTimeZoneIdentifiers.filter { query.isEmpty || $0.localizedCaseInsensitiveContains(query) }
    }
    var body: some View {
        NavigationStack {
            List(choices, id: \.self) { zone in
                Button {
                    identifier = zone
                    dismiss()
                } label: {
                    HStack { Text(zone.replacingOccurrences(of: "_", with: " ")); Spacer(); if identifier == zone { Image(systemName: "checkmark") } }
                }
            }
            .searchable(text: $query, prompt: "City or region")
            .navigationTitle("Trip time zone")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}
