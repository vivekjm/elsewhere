import SwiftUI
import UIKit

/// C12. The global Profile tab: travel stats in mono, preferences that feed
/// the planner, and a glass settings list.
struct ProfileView: View {
    @Environment(TripStore.self) private var store
    /// Re-renders the stats once past places are geocoded.
    @State private var countriesTick = 0
    @Environment(AppRouter.self) private var router
    @State private var editingName = false
    @State private var editingAirport = false
    @State private var draft = ""
    @State private var confirmClear = false
    @State private var confirmSignOut = false
    @State private var reminderNote: String?
    @State private var notificationsDenied = false
    @Environment(\.openURL) private var openURL


    private func preferenceMenu(_ title: String, symbol: String, color: Color, value: Binding<String>, options: [String]) -> some View {
        Menu {
            Picker(title, selection: value) {
                ForEach(Array(Set(options + [value.wrappedValue])).sorted { (options.firstIndex(of: $0) ?? 99) < (options.firstIndex(of: $1) ?? 99) }, id: \.self) { Text($0) }
            }
        } label: {
            ListRow(title) {
                IconTile(symbol: symbol, color: color, size: .medium)
            } trailing: {
                Text(value.wrappedValue).font(.sf(15)).foregroundStyle(Color.textMuted)
            }
        }
        .buttonStyle(.plain)
    }
    private var isAccount: Bool { store.session.isAccount }

    var body: some View {
        @Bindable var store = store
        NightScreen(photo: .tram, spacing: 10, title: store.profile.name.isEmpty ? "Profile" : store.profile.name) {
            HStack(spacing: 14) {
                Text(store.profile.badge)
                    .font(.sf(26, .bold))
                    .foregroundStyle(.white)
                    .frame(width: 72, height: 72)
                    .background(Circle().fill(Color.white.opacity(0.16)))
                    .overlay(Circle().strokeBorder(Color.white.opacity(0.2), lineWidth: 1))
                VStack(alignment: .leading, spacing: 4) {
                    Button {
                        draft = store.profile.name
                        editingName = true
                    } label: {
                        Text(store.profile.name.isEmpty ? "Add your name" : store.profile.name)
                            .font(.display(30))
                            .tracking(-0.4)
                            .foregroundStyle(store.profile.name.isEmpty ? Color.textMuted : .white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Edit your name")
                    Button { if !store.profile.isPro { router.showPaywall(from: "pro-chip") } } label: {
                        Chip(store.profile.isPro ? "Pro · \(store.profile.proPlan ?? "yearly")" : "Free · see Pro", tone: store.profile.isPro ? .solid : .tint(.lime))
                            .zoomSource("pro-chip", radius: 12)
                    }
                    .buttonStyle(.card)
                }
            }
            .padding(.horizontal, 4)
            .padding(.top, 4)

            RecapStatRow {
                RecapStat(value: "\(store.trips.count)", label: "trips")
                RecapStat(value: "\(countriesTick >= 0 ? store.countriesVisited : 0)", label: store.countriesVisited == 1 ? "country" : "countries")
                RecapStat(value: Fmt.distanceValue(Double(store.kmHiked)), label: "\(Fmt.distanceUnit) hiked")
            }

            GlassList("Preferences") {
                Menu {
                    Picker("Travel style", selection: $store.profile.travelStyle) {
                        ForEach(PreferenceOptions.styles, id: \.self) { Text($0) }
                    }
                } label: {
                    ListRow("Travel style") {
                        IconTile(symbol: "heart.fill", color: Tile.plum, size: .medium)
                    } trailing: {
                        Text(store.profile.travelStyle).font(.sf(15)).foregroundStyle(Color.textMuted)
                    }
                }
                .buttonStyle(.plain)

                Button {
                    draft = store.profile.homeAirport
                    editingAirport = true
                } label: {
                    ListRow("Home base") {
                        IconTile(symbol: "airplane", color: Tile.amber, size: .medium)
                    } trailing: {
                        Text(store.profile.homeAirport.isEmpty ? "Not set" : store.profile.homeAirport).font(.sf(15)).foregroundStyle(Color.textMuted)
                    }
                }
                .buttonStyle(.plain)

                Menu {
                    Picker("Units", selection: $store.profile.metric) {
                        Text("Metric").tag(true)
                        Text("Imperial").tag(false)
                    }
                } label: {
                    ListRow("Units") {
                        IconTile(symbol: "ruler", color: Tile.teal, size: .medium)
                    } trailing: {
                        Text(store.profile.metric ? "Metric" : "Imperial").font(.sf(15)).foregroundStyle(Color.textMuted)
                    }
                }
                .buttonStyle(.plain)

                Menu {
                    Picker("Currency", selection: Binding(
                        get: { store.profile.currency ?? CurrencyService.home },
                        set: { store.profile.currency = $0; CurrencyService.preferred = $0 })) {
                        ForEach(CurrencyService.common, id: \.self) { Text("\($0) · \(CurrencyService.name(for: $0))").tag($0) }
                    }
                } label: {
                    ListRow("Currency", meta: "New trips and conversions") {
                        IconTile(symbol: "banknote", color: Tile.bronze, size: .medium)
                    } trailing: {
                        Text(store.profile.currency ?? CurrencyService.home).font(.sf(15)).foregroundStyle(Color.textMuted)
                    }
                }
                .buttonStyle(.plain)
            }

            // Used by the AI planner and stylist.
            GlassList("For planning") {
                preferenceMenu("Food", symbol: "fork.knife", color: Tile.amber, value: $store.profile.diet,
                               options: PreferenceOptions.diets)
                preferenceMenu("Budget", symbol: "banknote", color: Tile.green, value: $store.profile.budgetStyle,
                               options: PreferenceOptions.budgets)
                preferenceMenu("Pace", symbol: "figure.walk", color: Tile.indigo, value: $store.profile.pace,
                               options: PreferenceOptions.paces)
            }

            GlassList {
                Toggle(isOn: $store.profile.reminders) {
                    ListRow("Trip reminders", meta: notificationsDenied ? "Notifications are off" : reminderNote) {
                        IconTile(symbol: "bell.fill", color: Tile.red, size: .medium)
                    }
                }
                .toggleStyle(LimeToggleStyle())

                if notificationsDenied {
                    Button { if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) } } label: {
                        ListRow("Open Settings", meta: "Allow notifications here") {
                            IconTile(symbol: "gearshape.fill", color: Color.white.opacity(0.14), size: .medium)
                        } trailing: { CornerArrow() }
                        .zoomSource("pro-row", radius: 12)
                    }
                    .buttonStyle(.plain)
                }

                AccountSyncRow()

                if !store.profile.isPro {
                    Button { router.showPaywall(from: "pro-row") } label: {
                        ListRow("Trips Loom Pro", meta: "Unlimited AI drafts · documents · PDF") {
                            IconTile(symbol: "sparkles", color: Tile.green, size: .medium)
                        } trailing: { CornerArrow() }
                    }
                    .buttonStyle(.plain)
                }
            }

            GlassList("Your account") {
                NavigationLink { DataAndPrivacyView() } label: {
                    ListRow("Data & privacy") { IconTile(symbol: "lock.shield", color: Tile.teal, size: .medium) } trailing: { CornerArrow() }
                }
                NavigationLink { TravelPreferencesView() } label: {
                    ListRow("Travel preferences") { IconTile(symbol: "slider.horizontal.3", color: Tile.indigo, size: .medium) } trailing: { CornerArrow() }
                }
                NavigationLink { HelpView() } label: {
                    ListRow("Help & feedback") { IconTile(symbol: "questionmark.circle", color: Tile.plum, size: .medium) } trailing: { CornerArrow() }
                }
            }

            Button {
                confirmSignOut = true
            } label: {
                Text("Sign out")
                    .font(.sf(16, .semibold))
                    .foregroundStyle(Color.coral)
                    .frame(maxWidth: .infinity)
                    .padding(4)
            }
            .buttonStyle(.plain)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Edit name", systemImage: "pencil") {
                        draft = store.profile.name
                        editingName = true
                    }
                    Button("Start fresh", systemImage: "sparkles") { confirmClear = true }
                    Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) { confirmSignOut = true }
                } label: {
                    Image(systemName: "ellipsis")
                }
                .accessibilityLabel("More")
            }
        }
        .alert("Your name", isPresented: $editingName) {
            TextField("Name", text: $draft)
            Button("Save") {
                let name = draft.trimmingCharacters(in: .whitespaces)
                if !name.isEmpty { store.profile.name = name }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Home base", isPresented: $editingAirport) {
            TextField("City or airport", text: $draft)
                .textInputAutocapitalization(.words)
            Button("Save") {
                let place = String(draft.trimmingCharacters(in: .whitespaces).prefix(60))
                if !place.isEmpty { store.profile.homeAirport = place }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Where your trips usually start, like London or LHR. Shared with tripsloom.com.")
        }
        .confirmationDialog("Start fresh?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Delete all trips and wardrobe", role: .destructive) { store.clearAll() }
        } message: {
            Text(isAccount
                 ? "Every trip, plan, packing list and wardrobe piece is removed from your account, here and on tripsloom.com."
                 : "Every trip, plan, packing list and wardrobe piece on this iPhone is removed.")
        }
        .confirmationDialog("Sign out?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) {
                Task {
                    // Send any last edits before they leave this iPhone.
                    if isAccount, store.sync.pendingChanges { await store.sync.sync() }
                    guard !isAccount || (!store.sync.pendingChanges && store.storageError == nil) else {
                        router.authMessage = "Some changes are still waiting to sync. Export your data from Data & privacy or reconnect before signing out."
                        return
                    }
                    store.signOut()
                }
            }
        } message: {
            if store.sync.pendingChanges {
                Text("Some edits have not synced yet. We will try again. If they cannot be sent, you will stay signed in so you can reconnect or export your data.")
            } else {
                Text("Your trips are saved to your account and come back when you sign in. This iPhone is cleared.")
            }
        }
        .task(id: store.trips.count) {
            // Resolve past places to countries for the stat above.
            for trip in store.trips where trip.status != .upcoming && Places.cached(trip.place) == nil {
                _ = await Places.lookup(trip.place)
            }
            countriesTick += 1
        }
        .task {
            // A switch that's on without permission would be misleading.
            if store.profile.reminders, await !Reminders.isAuthorized {
                store.profile.reminders = false
                return
            }
            reminderNote = await Reminders.sync(enabled: store.profile.reminders, trips: store.upcoming, prompt: false)
        }
        .onChange(of: store.profile.reminders) { _, on in
            Task {
                reminderNote = await Reminders.sync(enabled: on, trips: store.upcoming, prompt: true)
                if on, await !Reminders.isAuthorized {
                    notificationsDenied = true
                    reminderNote = nil
                    store.profile.reminders = false
                } else if on {
                    notificationsDenied = false
                }
            }
        }
    }
}

/// Account and sync state: syncs on tap, or offers sign-in when the
/// session has lapsed.
private struct AccountSyncRow: View {
    @Environment(TripStore.self) private var store

    var body: some View {
        let sync = store.sync
        Button {
            if sync.isSignedIn {
                Task { await sync.sync() }
            } else {
                // Reauthenticate without discarding unsent trips from the
                // expired account. didSignIn handles a different account.
                store.session = .signedOut
            }
        } label: {
            ListRow(title(sync), meta: meta(sync)) {
                IconTile(symbol: symbol(sync), color: Tile.indigo, size: .medium)
                    .symbolEffect(.rotate, isActive: sync.status == .syncing)
            } trailing: {
                if sync.status == .syncing {
                    ProgressView().tint(.white)
                } else {
                    CornerArrow()
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityHint(sync.isSignedIn ? "Sync now" : "Sign in")
    }

    private func title(_ sync: SyncEngine) -> String {
        guard sync.isSignedIn else { return "Sign in again" }
        return sync.accountEmail ?? "Your account"
    }

    private func meta(_ sync: SyncEngine) -> String {
        if let notice = sync.recoveryNotice { return notice }
        guard sync.isSignedIn else {
            return "Session ended · trips here are safe"
        }
        switch sync.status {
        case .syncing: return "Syncing…"
        case .synced(let date): return "Synced \(date.formatted(.relative(presentation: .named)))"
        case .offline: return sync.pendingChanges ? "Offline · changes waiting" : "Offline"
        case .failed(let message): return message
        case .expired: return "Session expired · sign in again"
        case .local: return sync.pendingChanges ? "Changes waiting to sync" : "Tap to sync"
        }
    }

    private func symbol(_ sync: SyncEngine) -> String {
        guard sync.isSignedIn else { return "person.crop.circle.badge.plus" }
        switch sync.status {
        case .offline: return "icloud.slash.fill"
        case .failed, .expired: return "exclamationmark.icloud.fill"
        default: return "arrow.triangle.2.circlepath"
        }
    }
}
