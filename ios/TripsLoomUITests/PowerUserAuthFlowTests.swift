import XCTest

/// Runs on the separate recovery simulator and isolated local Auth harness.
/// Provider email delivery and Sign in with Apple require a signed device;
/// the harness stands in for Google's consent screen.
nonisolated final class PowerUserAuthFlowTests: PowerUserScenarioCase {
    @MainActor func testCreateAccountPasswordPolicyAndResetRequest() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["TRIPSLOOM_UI_TEST_ID"] = UUID().uuidString
        app.launchArguments = ["-backend-url", "http://127.0.0.1:8788", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        tap(app, app.buttons["Continue with Email"])
        tap(app, app.buttons["Create account"].firstMatch)
        input(app, "Your name", "Casey — authentication QA")
        input(app, "Email", "signup@tripsloom.test")
        let password = app.secureTextFields["Password"]
        tap(app, password)
        password.typeText("seven77")
        let submit = app.buttons.matching(identifier: "Create account").allElementsBoundByIndex.last!
        XCTAssertFalse(submit.isEnabled)
        // Typed into the focused field: an element-level typeText can refocus a
        // secure field when iOS shows password AutoFill, and refocusing clears it.
        app.typeText("8")
        XCTAssertTrue(submit.isEnabled, "Create account stayed disabled; password field holds \((password.value as? String)?.count ?? 0) characters")
        tap(app, submit)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'link to confirm your account'")).firstMatch.waitForExistence(timeout: 8),
                      "No confirmation. On screen: \(app.staticTexts.allElementsBoundByIndex.map(\.label)) alerts: \(app.alerts.staticTexts.allElementsBoundByIndex.map(\.label))")
        shot(app, "90-create-account-confirmation-and-password-policy")
        tap(app, app.buttons["Forgot password?"])
        tap(app, app.buttons["Send reset link"])
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'a reset link is on its way'")).firstMatch.waitForExistence(timeout: 8))
        shot(app, "91-password-reset-request-acknowledged")
        tap(app, app.buttons["Back to sign in"])
        tap(app, app.buttons["Close"].firstMatch)
        // There is no guest mode: closing returns to the account choices.
        XCTAssertTrue(app.buttons["Continue with Email"].waitForExistence(timeout: 8))
        XCTAssertFalse(app.buttons["Continue as guest"].exists)
    }

    @MainActor func testGoogleSignInRunsOnboardingAndKeepsPreferences() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["TRIPSLOOM_UI_TEST_ID"] = UUID().uuidString
        app.launchArguments = ["-backend-url", "http://127.0.0.1:8788", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Trips Loom"].waitForExistence(timeout: 10))
        shot(app, "92-welcome")
        tap(app, app.buttons["Continue with Google"])
        // iOS asks before a web sign-in; the alert belongs to SpringBoard.
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.buttons["Continue"]
        XCTAssertTrue(allow.waitForExistence(timeout: 15), "No web sign-in prompt")
        allow.tap()
        // The harness returns Google's name, which onboarding greets and keeps.
        XCTAssertTrue(app.staticTexts["Good to have you, Gia."].waitForExistence(timeout: 15))
        XCTAssertEqual(app.textFields["Your name"].value as? String, "Gia Google")
        shot(app, "93-onboarding-about-you")
        tap(app, app.buttons["Continue"])
        // Exploring lands on home rather than opening a trip form.
        tap(app, app.buttons["Just looking for now"])
        shot(app, "94-onboarding-intent")
        tap(app, app.buttons["Continue"])
        tap(app, app.buttons["Budget and shared costs"])
        tap(app, app.buttons["Continue"])
        tap(app, app.buttons["Imperial"])
        shot(app, "95-onboarding-units-and-currency")
        tap(app, app.buttons["save-travel-preferences"])
        XCTAssertTrue(app.buttons["New trip"].waitForExistence(timeout: 10))
        tab(app, "Profile")
        let account = app.buttons.matching(NSPredicate(format: "label CONTAINS 'google-'")).firstMatch
        XCTAssertTrue(account.waitForExistence(timeout: 15), "Google account not shown after sync")
        let shows = { (text: String) in
            app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@ OR value CONTAINS %@", text, text)).firstMatch
        }
        XCTAssertTrue(shows("Imperial").waitForExistence(timeout: 5))
        shot(app, "96-preferences-kept")
    }
}
