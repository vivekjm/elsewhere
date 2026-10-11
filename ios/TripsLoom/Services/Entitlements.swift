import StoreKit
import SwiftUI

/// Trips Loom Pro, as the App Store sees it. Checked at launch and on every
/// foreground, and kept current by `Transaction.updates`, so renewals,
/// purchases on another device, refunds and lapsed plans all show up.
@MainActor
enum Entitlements {
    static let yearly = "com.tripsloom.pro.yearly"
    static let monthly = "com.tripsloom.pro.monthly"
    static let productIDs = [yearly, monthly]

    /// Free accounts get this many AI trip drafts a month.
    static let freeDraftsPerMonth = 3
    /// Free accounts can keep this many documents per trip.
    static let freeDocumentsPerTrip = 3

    private static var listener: Task<Void, Never>?

    static func start(_ store: TripStore) {
        guard listener == nil else { return }
        listener = Task {
            for await update in Transaction.updates {
                if case .verified(let transaction) = update { await transaction.finish() }
                await refresh(store)
            }
        }
        Task { await refresh(store) }
    }

    /// Sets Pro from the current entitlements. Leaves Pro alone when the App
    /// Store can't be asked (no products configured), so a purchase recorded
    /// earlier isn't wiped by an offline launch.
    static func refresh(_ store: TripStore) async {
        var active: String?
        var sawAny = false
        for await entitlement in Transaction.currentEntitlements {
            sawAny = true
            guard case .verified(let transaction) = entitlement,
                  productIDs.contains(transaction.productID),
                  transaction.revocationDate == nil,
                  (transaction.expirationDate ?? .distantFuture) > .now
            else { continue }
            active = transaction.productID == yearly ? "yearly" : "monthly"
        }
        if let active {
            if !store.profile.isPro || store.profile.proPlan != active {
                store.profile.isPro = true
                store.profile.proPlan = active
            }
        } else if store.profile.isPro, await storeAnswered(sawAny) {
            // The store answered and there's no live plan: it lapsed or was refunded.
            store.profile.isPro = false
            store.profile.proPlan = nil
        }
    }

    private static func storeAnswered(_ sawAny: Bool) async -> Bool {
        if sawAny { return true }
        let products = (try? await Product.products(for: productIDs)) ?? []
        return !products.isEmpty
    }
}

extension TripStore {
    private static let monthKey: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM"
        return f
    }()

    /// AI drafts left this month; `nil` means unlimited (Pro).
    var draftsLeft: Int? {
        guard !profile.isPro else { return nil }
        let used = profile.aiDraftMonth == Self.monthKey.string(from: .now) ? (profile.aiDraftCount ?? 0) : 0
        return max(Entitlements.freeDraftsPerMonth - used, 0)
    }

    /// Counts one AI draft. Returns false when the free allowance is used up.
    func useDraft() -> Bool {
        guard let left = draftsLeft else { return true }
        guard left > 0 else { return false }
        let month = Self.monthKey.string(from: .now)
        let used = profile.aiDraftMonth == month ? (profile.aiDraftCount ?? 0) : 0
        profile.aiDraftMonth = month
        profile.aiDraftCount = used + 1
        return true
    }
}
