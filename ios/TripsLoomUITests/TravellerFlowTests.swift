import XCTest

nonisolated final class TravellerFlowTests: XCTestCase {
    @MainActor private func launch(largeText: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["TRIPSLOOM_UI_TEST_ID"] = UUID().uuidString
        app.launchEnvironment["TRIPSLOOM_UI_TEST_SIGNED_IN"] = "1"
        app.launchArguments = ["-backend-url", "http://127.0.0.1:8787"]
        if largeText { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] }
        app.launch()
        return app
    }

    @MainActor private func screenshot(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }

    /// Skips first-run onboarding to reach an empty Trips tab.
    @MainActor private func skipOnboarding(_ app: XCUIApplication) {
        XCTAssertTrue(app.buttons["Set up later"].waitForExistence(timeout: 10))
        app.buttons["Set up later"].tap()
        XCTAssertTrue(app.buttons["New trip"].waitForExistence(timeout: 10))
    }

    @MainActor func testOnboardingSettingsAndSupport() {
        let app = launch()
        skipOnboarding(app)
        XCTAssertFalse(app.staticTexts["A week in Lisbon"].exists)
        screenshot(app, "Fresh account has no sample trips")
        app.tabBars.buttons["Profile"].tap()
        let privacy = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Data & privacy'")).firstMatch
        if !privacy.isHittable { app.swipeUp() }
        XCTAssertTrue(privacy.waitForExistence(timeout: 5)); privacy.tap()
        XCTAssertTrue(app.buttons["Export my data"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Delete my account"].exists)
        screenshot(app, "Data controls")
        app.navigationBars.buttons.firstMatch.tap()
        let help = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Help & feedback'")).firstMatch
        if !help.isHittable { app.swipeUp() }
        XCTAssertTrue(help.exists); help.tap()
        XCTAssertTrue(app.staticTexts["Help & feedback"].waitForExistence(timeout: 5))
        screenshot(app, "Support")
    }

    @MainActor func testCreateTripWithoutSampleData() {
        let app = launch(); skipOnboarding(app)
        app.buttons["New trip"].tap()
        XCTAssertTrue(app.buttons["Continue"].waitForExistence(timeout: 5))
        app.buttons["Continue"].tap()
        let name = app.textFields["Trip name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5)); name.tap(); name.typeText("QA mountain escape")
        let place = app.textFields["Destination"]
        place.tap(); place.typeText("Chamonix")
        app.buttons["Create trip"].tap()
        XCTAssertTrue(app.staticTexts["QA mountain escape"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["These are sample trips"].exists)
        screenshot(app, "New trip")
    }

    @MainActor func testCloseNewTripFormDiscardsDraftImmediately() {
        let app = launch(); skipOnboarding(app)
        app.buttons["New trip"].tap()
        app.buttons["Continue"].tap()
        let name = app.textFields["Trip name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5)); name.tap(); name.typeText("Unsaved draft")
        app.buttons["Close"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Continue"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Discard your unsaved form changes?"].exists)
        screenshot(app, "Draft closed")
    }

    @MainActor func testCityActivityAndPackingFlow() {
        let app = launch(); skipOnboarding(app)
        app.buttons["New trip"].tap()
        let city = app.buttons["trip-kind-city"]
        XCTAssertTrue(city.waitForExistence(timeout: 5))
        if !city.isHittable { app.swipeUp() }
        city.tap(); app.buttons["Continue"].tap()
        let name = app.textFields["Trip name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5)); name.tap(); name.typeText("QA city weekend")
        let place = app.textFields["Destination"]; place.tap(); place.typeText("Paris")
        app.buttons["Create trip"].tap()
        XCTAssertTrue(app.staticTexts["QA city weekend"].waitForExistence(timeout: 10))
        app.tabBars.buttons["Days"].tap()
        let add = app.buttons["Add plan"]
        XCTAssertTrue(add.waitForExistence(timeout: 5)); add.tap()
        let title = app.textFields["What's the plan?"]
        XCTAssertTrue(title.waitForExistence(timeout: 5)); title.tap(); title.typeText("Coffee with Alex")
        app.buttons["Save"].tap()
        XCTAssertTrue(app.staticTexts["Coffee with Alex"].waitForExistence(timeout: 5))
        screenshot(app, "Saved city activity")
        app.tabBars.buttons["Packing"].tap()
        screenshot(app, "Packing list")
    }

    @MainActor func testLargeTextPreferencesCanBeSaved() {
        let app = launch(largeText: true)
        for step in 0..<3 {
            let next = app.buttons["Continue"]
            XCTAssertTrue(next.waitForExistence(timeout: 10)); next.tap()
            // "Just looking" lands on home; the other intents open a trip form.
            if step == 0 {
                let looking = app.buttons["Just looking for now"]
                XCTAssertTrue(looking.waitForExistence(timeout: 5))
                if !looking.isHittable { app.swipeUp() }
                looking.tap()
            }
        }
        let save = app.buttons["save-travel-preferences"]
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        if !save.isHittable { app.swipeUp() }
        screenshot(app, "Accessibility text size onboarding")
        save.tap()
        XCTAssertTrue(app.buttons["New trip"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Trips"].exists)
        let newTrip = app.buttons["New trip"]
        for _ in 0..<3 where !newTrip.isHittable { app.swipeUp() }
        XCTAssertTrue(newTrip.isHittable, "Large text must leave the main action reachable")
        screenshot(app, "Accessibility text size home")
        newTrip.tap()
        XCTAssertTrue(app.buttons["Continue"].waitForExistence(timeout: 5))
    }
}
