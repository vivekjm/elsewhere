import XCTest
import StoreKit
import StoreKitTest
@testable import TripsLoom

nonisolated final class PurchaseRegressionTests: XCTestCase {
    @MainActor func testVerifiedPurchaseAndRefundUpdatePro() async throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "TripsLoom", withExtension: "storekit"))
        let session = try SKTestSession(contentsOf: url)
        session.disableDialogs = true
        session.clearTransactions()
        defer { session.clearTransactions() }
        let store = TripStore(fileURL: URL.temporaryDirectory.appending(path: "purchase-\(UUID().uuidString).json"))
        let transaction = try await session.buyProduct(identifier: Entitlements.yearly)
        await Entitlements.refresh(store)
        XCTAssertTrue(store.profile.isPro)
        XCTAssertEqual(store.profile.proPlan, "yearly")
        await transaction.finish()
        try session.refundTransaction(identifier: UInt(transaction.id))
        // StoreKit delivers a refund asynchronously, even in the local store.
        for _ in 0..<30 {
            await Entitlements.refresh(store)
            if !store.profile.isPro { break }
            try await Task.sleep(for: .milliseconds(100))
        }
        XCTAssertFalse(store.profile.isPro)
        XCTAssertNil(store.profile.proPlan)
    }
}
