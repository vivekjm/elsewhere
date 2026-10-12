import StoreKit
import SwiftUI

/// C4. Glass plan cards with the yearly plan selected in lime. Purchases go
/// through StoreKit; the product IDs need to exist in App Store Connect.
struct PaywallView: View {
    /// What the person was trying to do, for the headline.
    var reason: Reason? = nil
    @Environment(\.dismiss) private var dismiss
    @Environment(TripStore.self) private var store
    @State private var plan: Plan = .yearly
    @State private var products: [String: Product] = [:]
    @State private var working = false
    @State private var message: String?
    @State private var trialEligible: Set<String> = []
    @State private var loading = true

    enum Plan: String, CaseIterable {
        case yearly = "com.tripsloom.pro.yearly"
        case monthly = "com.tripsloom.pro.monthly"

        var title: String { self == .yearly ? "Yearly" : "Monthly" }
    }

    enum Reason {
        case drafts, documents, export

        var headline: String {
            switch self {
            case .drafts: "You've used this month's free AI drafts."
            case .documents: "Keep every ticket, ID and voucher in one place."
            case .export: "Send the whole plan to your group."
            }
        }
    }

    /// Trial wording only when the product really has a free trial.
    private var trialDays: Int? {
        guard trialEligible.contains(plan.rawValue), let offer = products[plan.rawValue]?.subscription?.introductoryOffer, offer.paymentMode == .freeTrial else { return nil }
        let period = offer.period
        return switch period.unit {
        case .day: period.value
        case .week: period.value * 7
        case .month: period.value * 30
        case .year: period.value * 365
        @unknown default: nil
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SectionLabel("Trips Loom Pro", color: .lime)
                        .padding(.top, 8)
                    Text("Plan less.\nGo further.").displayTitle(40)
                    if let reason {
                        Text(reason.headline)
                            .font(.sf(15))
                            .foregroundStyle(Color.textMuted)
                    }

                    GlassList {
                        ListRow("Unlimited AI planning", meta: "Free: \(Entitlements.freeDraftsPerMonth) drafts a month") {
                            IconTile(symbol: "sparkles", color: Tile.indigo)
                        }
                        ListRow("Unlimited travel documents", meta: "Face ID lock · free: \(Entitlements.freeDocumentsPerTrip) per trip") {
                            IconTile(symbol: "lock.doc.fill", color: Tile.teal)
                        }
                        ListRow("Itinerary PDF for your group", meta: "Every day, stay and booking") {
                            IconTile(symbol: "doc.richtext.fill", color: Tile.plum)
                        }
                    }

                    Text("Always free: trips, packing, budgets, weather, wardrobe, shared trips and safety check-ins.")
                        .font(.sf(13))
                        .foregroundStyle(Color.textFaint)
                        .padding(.horizontal, 4)

                    HStack(spacing: 12) {
                        ForEach(Plan.allCases, id: \.self) { option in
                            planCard(option)
                        }
                    }
                    .padding(.top, 10)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .background { PhotoBackdrop(photo: .beach).environment(\.customCover, nil) }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    Button {
                        Task { await purchase() }
                    } label: {
                        if working { ProgressView().tint(.ink) } else { Text(trialDays.map { "Start \($0)-day free trial" } ?? "Continue") }
                    }
                    .buttonStyle(CTAStyle())
                    .disabled(working || products[plan.rawValue] == nil)

                    if products[plan.rawValue] != nil {
                    Text("\(trialDays == nil ? "" : "Then ")\(price(plan)) a \(plan == .yearly ? "year" : "month"). Renews automatically; cancel anytime in Settings.")
                        .font(.sf(13))
                        .foregroundStyle(Color.textMuted)
                        .multilineTextAlignment(.center)
                    } else {
                        Text(loading ? "Loading plans…" : "Pro is unavailable right now. Your free features still work.").font(.sf(13)).foregroundStyle(Color.textMuted)
                        if !loading { Button("Try again") { Task { await loadProducts() } } }
                    }
                    HStack(spacing: 14) {
                        Button("Restore purchases") { Task { await restore() } }
                        Link("Privacy", destination: URL(string: "https://tripsloom.com/privacy")!)
                        Link("Terms of Use", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                    }
                    .buttonStyle(.plain)
                    .font(.sf(13))
                    .underline()
                    .foregroundStyle(Color.textMuted)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.bottom, 8)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                }
            }
            .alert("Trips Loom Pro", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
                Button("OK") {}
            } message: {
                Text(message ?? "")
            }
            .task { await loadProducts() }
        }
    }

    private func planCard(_ option: Plan) -> some View {
        let selected = option == plan
        return Button { withAnimation(Motion.snappy) { plan = option } } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(option.title).font(.sf(15, .semibold)).foregroundStyle(.white)
                Text(price(option)).font(.mono(24, .bold)).foregroundStyle(.white).padding(.top, 4)
                Text("Renews \(option == .yearly ? "yearly" : "monthly")").metaStyle()
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glass(24)
            .overlay {
                if selected { RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.lime, lineWidth: 2) }
            }
            .overlay(alignment: .topTrailing) {
                if option == .yearly, let saving = savingPercent { Chip("Save \(saving)%", tone: .solid).offset(x: -12, y: -12) }
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func price(_ option: Plan) -> String {
        products[option.rawValue]?.displayPrice ?? (loading ? "…" : "Unavailable")
    }

    private var savingPercent: Int? {
        guard let year = products[Plan.yearly.rawValue], let month = products[Plan.monthly.rawValue],
              month.price > 0, year.priceFormatStyle.currencyCode == month.priceFormatStyle.currencyCode else { return nil }
        let ratio = NSDecimalNumber(decimal: year.price / (month.price * 12)).doubleValue
        let saving = Int(((1 - ratio) * 100).rounded(.down))
        return saving > 0 ? saving : nil
    }

    private func loadProducts() async {
        loading = true
        defer { loading = false }
        do {
            let loaded = try await Product.products(for: Plan.allCases.map(\.rawValue))
            products = Dictionary(uniqueKeysWithValues: loaded.map { ($0.id, $0) })
            trialEligible = []
            for product in loaded {
                if await product.subscription?.isEligibleForIntroOffer == true { trialEligible.insert(product.id) }
            }
        } catch { products = [:] }
    }

    private func purchase() async {
        guard let product = products[plan.rawValue] else {
            message = "Pro is unavailable right now. Try again later."
            return
        }
        working = true
        defer { working = false }
        do {
            let result = try await product.purchase()
            if case .success(let verification) = result, case .verified(let transaction) = verification {
                await transaction.finish()
                store.profile.isPro = true
                store.profile.proPlan = plan == .yearly ? "yearly" : "monthly"
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
            }
        } catch {
            message = error.localizedDescription
        }
    }

    private func restore() async {
        working = true
        defer { working = false }
        do {
            try await StoreKit.AppStore.sync()
            await Entitlements.refresh(store)
            if store.profile.isPro { dismiss() }
            else { message = "No active Pro subscription was found for this Apple ID." }
        } catch { message = "Purchases could not be restored. Check your connection and try again." }
    }
}
