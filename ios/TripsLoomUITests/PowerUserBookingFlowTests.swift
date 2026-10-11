import XCTest
import UIKit

nonisolated final class PowerUserBookingFlowTests: PowerUserScenarioCase {
    @MainActor func testConfirmationPasteRepeatedPasteAndFlightTicket() {
        let app = launch()
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Paris — cafés, art & friends'")).firstMatch)
        tab(app, "Trip")
        tap(app, app.buttons["Trip options"]); tap(app, app.buttons["Add bookings"])
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Scan a ticket or passport'")).firstMatch)
        if !app.staticTexts["Scanning needs a device camera. Paste the confirmation instead."].waitForExistence(timeout: 1) {
            let system = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            if system.alerts.buttons["Allow"].waitForExistence(timeout: 1) { system.alerts.buttons["Allow"].tap() }
            else if system.alerts.buttons["OK"].exists { system.alerts.buttons["OK"].tap() }
            shot(app, "60-native-document-scanner")
            tap(app, app.buttons["Cancel"].firstMatch)
        }
        UIPasteboard.general.string = "Flight BA 312 LHR → CDG\nDeparture 10 October 2026 at 10:45\nBooking reference QA1234\nGate A12 Seat 14C"
        tap(app, app.buttons["Paste"])
        XCTAssertTrue(app.buttons["Add 1 to trip"].waitForExistence(timeout: 8))
        shot(app, "60-confirmation-parsed-and-reviewed")
        tap(app, app.buttons["Paste"])
        XCTAssertTrue(app.staticTexts["This confirmation is already in the preview."].waitForExistence(timeout: 5))
        shot(app, "61-repeat-paste-does-not-duplicate-booking")
        tap(app, app.buttons["Add 1 to trip"])
        tab(app, "Days")
        let ticket = app.buttons["Ticket"].firstMatch
        tap(app, ticket)
        // The ticket's seat is an editable field; its value is the imported seat.
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label == '14C' OR value == '14C'")).firstMatch.waitForExistence(timeout: 5))
        shot(app, "62-imported-flight-ticket")
        tap(app, app.buttons["Done"].firstMatch)
        closeTrip(app)
    }
}
