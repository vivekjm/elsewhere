import XCTest

nonisolated final class PowerUserBackupExportFlowTests: PowerUserScenarioCase {
    @MainActor func testExportCompleteTravelBundle() {
        let app = launch()
        tab(app, "Profile")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Data & privacy'")).firstMatch)
        tap(app, app.buttons["Export my data"])
        XCTAssertTrue(shareSheetShown(app),
                      "Share sheet missing; alert: \(app.alerts.staticTexts.allElementsBoundByIndex.map(\.label))")
        shot(app, "54-complete-power-user-backup")
        tap(app, app.buttons["Close"].firstMatch)
    }

    /// Runs after several signed-in launches. Nothing was edited on another
    /// device, so sync must never have made a "recovered edits" copy.
    @MainActor func testSyncAcrossLaunchesLeavesNoRecoveredCopies() {
        let app = launch()
        tab(app, "Search")
        let search = app.searchFields.firstMatch; tap(app, search); search.typeText("recovered edits")
        let copy = app.buttons.matching(NSPredicate(format: "label CONTAINS 'recovered edits'")).firstMatch
        XCTAssertFalse(copy.waitForExistence(timeout: 4), "Sync made a recovered copy of a trip nobody edited elsewhere")
    }
}

/// Run on a separate clean QA simulator after transferring the UI-exported
/// bundle into its public Documents folder. No production account is used.
nonisolated final class PowerUserRecoveryFlowTests: PowerUserScenarioCase {
    @MainActor func testFreshInstallationRejectsBadFileAndRestoresTravelBundle() {
        let app = launch()
        if app.buttons["Continue as guest"].waitForExistence(timeout: 5) {
            app.buttons["Continue as guest"].tap()
            tap(app, app.buttons["Set up later"])
        }
        tab(app, "Profile")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Data & privacy'")).firstMatch)
        tap(app, app.buttons["Restore a backup"])
        openFile(app, "QA-invalid-backup")
        XCTAssertTrue(app.alerts.firstMatch.waitForExistence(timeout: 5))
        shot(app, "55-malformed-backup-rejected")
        tap(app, app.alerts.buttons["OK"])
        tap(app, app.buttons["Restore a backup"])
        openFile(app, "QA-complete-backup")
        XCTAssertTrue(app.buttons["Restore backup"].waitForExistence(timeout: 8))
        shot(app, "56-restore-count-confirmation")
        tap(app, app.buttons["Restore backup"])
        app.navigationBars.buttons.firstMatch.tap()
        tab(app, "Trips")
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS 'Paris — cafés, art & friends'")).firstMatch.waitForExistence(timeout: 8))
        shot(app, "57-restored-workspace-on-second-device")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Paris — cafés, art & friends'")).firstMatch)
        tab(app, "Wardrobe")
        let photo = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Cream linen shirt'")).firstMatch
        XCTAssertTrue(photo.waitForExistence(timeout: 8)); XCTAssertGreaterThanOrEqual(photo.frame.minX, 0)
        shot(app, "58-restored-garment-photo")
        tab(app, "Trip")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Documents'")).firstMatch)
        XCTAssertTrue(app.staticTexts["QA museum ticket — not a real booking"].waitForExistence(timeout: 8))
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'QA museum ticket'")).firstMatch)
        // iOS 26 Quick Look opens photos full screen with its controls hidden; a tap shows them.
        let close = app.buttons["QLOverlayDoneButtonAccessibilityIdentifier"]
        if !close.waitForExistence(timeout: 3) { app.tap() }
        XCTAssertTrue(close.waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'QA museum ticket'")).firstMatch.waitForExistence(timeout: 5),
                      "The viewer is titled with the document's name: \(app.buttons.allElementsBoundByIndex.prefix(4).map(\.label))")
        shot(app, "59-restored-document-opens-offline")
        tap(app, close)
        app.navigationBars.buttons.firstMatch.tap()
        closeTrip(app)
    }
    @MainActor private func openFile(_ app: XCUIApplication, _ name: String) {
        let browse = app.buttons["Browse"].firstMatch
        if browse.waitForExistence(timeout: 3) { browse.tap() }
        let phone = app.cells.matching(NSPredicate(format: "label CONTAINS 'On My iPhone'")).firstMatch
        if phone.waitForExistence(timeout: 3) { phone.tap() }
        let folder = app.cells.matching(NSPredicate(format: "label BEGINSWITH 'Trips Loom'")).firstMatch
        if folder.waitForExistence(timeout: 3) { folder.tap() }
        let file = app.cells.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
        if file.waitForExistence(timeout: 5) { tap(app, file) }
        else { print("FILE PICKER TREE\n" + app.debugDescription); tap(app, app.staticTexts[name].firstMatch) }
        let open = app.buttons["Open"].firstMatch
        if open.exists { open.tap() }
    }
}
