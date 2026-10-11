import XCTest
import UIKit

nonisolated final class PowerUserEdgeFlowTests: PowerUserScenarioCase {
    @MainActor func test01EditsNumericEdgeCasesAndNativeExports() {
        let app = launch()
        if app.buttons["Continue as guest"].waitForExistence(timeout: 2) { app.buttons["Continue as guest"].tap() }
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Paris — cafés, art & friends'")).firstMatch)
        tab(app, "Wardrobe")
        let garment = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Cream linen shirt'")).firstMatch
        XCTAssertTrue(garment.waitForExistence(timeout: 8))
        XCTAssertGreaterThanOrEqual(garment.frame.minX, 0)
        XCTAssertLessThan(garment.frame.width, app.frame.width / 2)
        shot(app, "41-wardrobe-photo-grid-stays-in-bounds")
        tap(app, garment)
        tap(app, app.buttons["Edit piece"])
        input(app, "Weight (g)", "220")
        tap(app, app.buttons["Save"])
        shot(app, "41-edited-garment-details")
        tap(app, app.buttons["Done"])
        tab(app, "Days")
        tap(app, app.buttons["Add plan"])
        input(app, "What's the plan?", String(repeating: "x", count: 201))
        XCTAssertFalse(app.buttons["Save"].isEnabled)
        input(app, "What's the plan?", "Montmartre sunset walk")
        let cost = app.textFields.matching(NSPredicate(format: "label BEGINSWITH 'Cost ('")).firstMatch
        tap(app, cost); cost.typeText("-1")
        XCTAssertFalse(app.buttons["Save"].isEnabled)
        input(app, cost.label, "100000000000000000000000")
        XCTAssertFalse(app.buttons["Save"].isEnabled)
        input(app, cost.label, "24.95")
        input(app, "On foot (km)", "2.5")
        shot(app, "42-valid-decimal-plan-after-rejected-values")
        tap(app, app.buttons["Save"])
        let plan = app.staticTexts["Montmartre sunset walk"].firstMatch
        XCTAssertTrue(plan.waitForExistence(timeout: 5)); plan.press(forDuration: 1.2)
        tap(app, app.buttons["Duplicate"].firstMatch)
        XCTAssertEqual(app.staticTexts.matching(identifier: "Montmartre sunset walk").count, 2)
        app.staticTexts["Montmartre sunset walk"].firstMatch.press(forDuration: 1.2)
        tap(app, app.buttons["Delete"].firstMatch)
        XCTAssertEqual(app.staticTexts.matching(identifier: "Montmartre sunset walk").count, 1)
        shot(app, "43-context-plan-duplicate-and-delete")
        tab(app, "Packing")
        tap(app, app.buttons["Add item"])
        input(app, "Item", "Power bank and USB-C cable")
        input(app, "Weight (g)", "-1")
        XCTAssertFalse(app.buttons["Add"].isEnabled)
        input(app, "Weight (g)", "100000000000000000000000")
        XCTAssertFalse(app.buttons["Add"].isEnabled)
        shot(app, "44-overflow-input-rejected-without-crash")
        input(app, "Weight (g)", "320")
        tap(app, app.buttons["Add"])
        tab(app, "Trip")
        tap(app, app.buttons["Trip options"]); tap(app, app.buttons["Edit trip"])
        // The persistent QA workspace may already have a cover from an earlier run.
        let cover = app.buttons.matching(NSPredicate(format: "label == 'Use your own photo' OR label == 'Choose another photo'")).firstMatch
        // The cover section is below the fold; list rows load as they scroll in.
        for _ in 0..<6 where !cover.exists { app.swipeUp() }
        tap(app, cover); choosePhoto(app)
        XCTAssertTrue(app.buttons["Choose another photo"].waitForExistence(timeout: 8))
        tap(app, app.buttons["Save"])
        shot(app, "45-custom-trip-cover")
        tap(app, app.buttons["Trip options"]); tap(app, app.buttons["Export to calendar"])
        XCTAssertTrue(shareSheetShown(app),
                      "Share sheet missing; alert: \(app.alerts.staticTexts.allElementsBoundByIndex.map(\.label))")
        shot(app, "46-native-calendar-export")
        tap(app, app.buttons["Close"].firstMatch)
        tap(app, app.buttons["Trip options"]); tap(app, app.buttons["Invite people"])
        // A guest without a name is asked for one first, so the invite says who sent it.
        if app.textFields["Your name"].waitForExistence(timeout: 3) {
            input(app, "Your name", "Jamie")
            tap(app, app.buttons["Next"])
        }
        XCTAssertTrue(shareSheetShown(app))
        shot(app, "47-share-trip-copy")
        tap(app, app.buttons["Close"].firstMatch)
        closeTrip(app)
        tab(app, "Shared")
        tap(app, app.buttons["Got it"].firstMatch)
        tap(app, app.buttons["Mark as settled"])
        shot(app, "48-shared-expense-settlement")
        tab(app, "Profile")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Trips Loom Pro'")).firstMatch)
        XCTAssertTrue(app.buttons["Restore purchases"].waitForExistence(timeout: 15))
        shot(app, "49-storekit-paywall")
        tap(app, app.buttons["Close"].firstMatch)
    }
}

nonisolated final class PowerUserPreferencesFlowTests: PowerUserScenarioCase {
    @MainActor func test02GuideInsuranceMapAndPreferences() {
        let app = launch()
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Dolomites hut-to-hut'")).firstMatch)
        tab(app, "Trip")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Before you go'")).firstMatch)
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Add your guide' OR label CONTAINS 'Marco — independent'")).firstMatch)
        input(app, "Guide name", "Marco — independent local guide (QA)")
        let rate = app.textFields.matching(NSPredicate(format: "label BEGINSWITH 'Daily rate'")).firstMatch
        input(app, rate.label, "180")
        input(app, "Contact and notes", "+39 000 000 000 · meet at Cortina bus station — fictional QA contact")
        if (app.switches["I have confirmed the arrangement"].value as? String) != "1" {
            tap(app, app.switches["I have confirmed the arrangement"])
        }
        tap(app, app.buttons["Save"])
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Add insurance details' OR label CONTAINS 'QA Alpine Travel Cover'")).firstMatch)
        input(app, "Provider or policy name", "QA Alpine Travel Cover")
        input(app, "Policy number and assistance contact", "TEST-ONLY-2026 · verify altitude coverage before departure")
        tap(app, app.alerts.buttons["Save"])
        shot(app, "50-guide-permits-and-insurance")
        app.navigationBars.buttons.firstMatch.tap()
        tab(app, "Safety")
        tap(app, app.buttons["Route map"])
        tap(app, app.buttons["Save for offline"])
        let saved = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Saved for offline'")).firstMatch
        let failed = app.alerts["Map could not be saved"]
        let complete = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in saved.exists || failed.exists }, object: app)
        XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 45), .completed)
        shot(app, "51-map-save-result")
        if app.alerts.buttons["OK"].exists { app.alerts.buttons["OK"].tap() }
        tap(app, app.buttons["Done"])
        closeTrip(app)
        tab(app, "Profile")
        tap(app, app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Units'")).firstMatch)
        tap(app, app.buttons["Imperial"].firstMatch)
        tap(app, app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Food'")).firstMatch)
        tap(app, app.buttons["Vegetarian"].firstMatch)
        tap(app, app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Pace'")).firstMatch)
        tap(app, app.buttons["Relaxed"].firstMatch)
        shot(app, "52-personalised-units-diet-and-pace")
        app.terminate(); app.launch()
        tab(app, "Profile")
        XCTAssertTrue(app.staticTexts["Imperial"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Vegetarian"].exists)
        shot(app, "53-preferences-persist-after-relaunch")
    }

}
