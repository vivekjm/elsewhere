import XCTest

/// Runs on the separate recovery simulator and isolated local Auth harness.
/// Provider email delivery and Sign in with Apple require a signed device.
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
        tap(app, password); password.typeText("seven77")
        let submit = app.buttons.matching(identifier: "Create account").allElementsBoundByIndex.last!
        XCTAssertFalse(submit.isEnabled)
        password.typeText("8")
        tap(app, submit)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'link to confirm your account'")).firstMatch.waitForExistence(timeout: 8))
        shot(app, "90-create-account-confirmation-and-password-policy")
        tap(app, app.buttons["Forgot password?"])
        tap(app, app.buttons["Send reset link"])
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'a reset link is on its way'")).firstMatch.waitForExistence(timeout: 8))
        shot(app, "91-password-reset-request-acknowledged")
        tap(app, app.buttons["Back to sign in"])
        tap(app, app.buttons["Close"].firstMatch)
        XCTAssertTrue(app.buttons["Continue as guest"].waitForExistence(timeout: 8))
    }
}
