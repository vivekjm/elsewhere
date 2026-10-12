import StoreKitTest
import XCTest

/// Buys Pro through the paywall against the local StoreKit test file. No App
/// Store account is involved.
nonisolated final class PurchaseFlowTests: XCTestCase {
    @MainActor func testBuyingProThroughThePaywall() throws {
        continueAfterFailure = false
        let file = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "TripsLoom", withExtension: "storekit"))
        let session = try SKTestSession(contentsOf: file)
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
        defer { session.clearTransactions() }
        let app = XCUIApplication()
        app.launchEnvironment["TRIPSLOOM_UI_TEST_ID"] = UUID().uuidString
        app.launchEnvironment["TRIPSLOOM_UI_TEST_SIGNED_IN"] = "1"
        app.launchArguments = ["-backend-url", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        if app.buttons["Set up later"].waitForExistence(timeout: 8) { app.buttons["Set up later"].tap() }
        XCTAssertTrue(app.tabBars.buttons["Profile"].waitForExistence(timeout: 10))
        app.tabBars.buttons["Profile"].tap()

        let chip = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'see Pro'")).firstMatch
        XCTAssertTrue(chip.waitForExistence(timeout: 8))
        // A tap during the profile's entrance animation can be dropped; try once more.
        let paywall = app.buttons["Restore purchases"]
        chip.tap()
        if !paywall.waitForExistence(timeout: 4), chip.isHittable { chip.tap() }
        XCTAssertTrue(paywall.waitForExistence(timeout: 8), "The paywall didn't open")
        let terms = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Renews automatically'")).firstMatch
        XCTAssertTrue(terms.waitForExistence(timeout: 20), "Plans didn't load from the StoreKit test file")
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = "paywall-plans"; a.lifetime = .keepAlways; add(a)

        app.buttons.matching(NSPredicate(format: "label CONTAINS 'free trial' OR label == 'Continue'")).firstMatch.tap()
        // StoreKit's own confirmation sheet.
        let confirm = app.buttons.matching(NSPredicate(format: "label IN {'Subscribe', 'Confirm', 'Buy', 'Start Trial', 'Try It Free'}")).firstMatch
        if confirm.waitForExistence(timeout: 15) { confirm.tap() }
        if app.alerts.buttons["OK"].waitForExistence(timeout: 5) { app.alerts.buttons["OK"].tap() }

        let pro = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Pro ·'")).firstMatch
        XCTAssertTrue(pro.waitForExistence(timeout: 20), "Profile didn't switch to Pro after buying")
        let b = XCTAttachment(screenshot: app.screenshot()); b.name = "profile-after-purchase"; b.lifetime = .keepAlways; add(b)
    }
}
