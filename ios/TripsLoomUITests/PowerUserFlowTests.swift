import XCTest
import UIKit

/// Persistent, synthetic traveller workspace on the dedicated QA simulator.
/// Content is entered through user-facing controls, including system pickers.
nonisolated class PowerUserScenarioCase: XCTestCase {
    static let storeID = "B6D8F18B-EA54-4CFD-94AD-B8C568219925"
    @MainActor func launch(_ extraArguments: [String] = []) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["TRIPSLOOM_UI_TEST_ID"] = Self.storeID
        // Starts signed in (without tokens) so feature flows skip the welcome screen.
        app.launchEnvironment["TRIPSLOOM_UI_TEST_SIGNED_IN"] = "1"
        app.launchArguments = ["-backend-url", "http://127.0.0.1:8787", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"] + extraArguments
        // A freshly erased simulator can raise iOS's "Keyboard Detected"
        // prompt in the middle of typing; dismiss it so the flow carries on.
        addUIInterruptionMonitor(withDescription: "Keyboard setup") { alert in
            guard alert.label.contains("Keyboard") else { return false }
            for title in ["Done", "Continue", "OK", "Not Now"] where alert.buttons[title].exists {
                alert.buttons[title].tap()
                return true
            }
            alert.buttons.firstMatch.tap()
            return true
        }
        app.launch()
        if app.buttons["Set up later"].waitForExistence(timeout: 3) { app.buttons["Set up later"].tap() }
        return app
    }
    /// The system share sheet is up. On iOS 26 its actions are cells, not buttons.
    @MainActor func shareSheetShown(_ app: XCUIApplication, timeout: TimeInterval = 15) -> Bool {
        app.otherElements["ActivityListView"].waitForExistence(timeout: timeout)
            || app.cells["Copy"].exists || app.buttons["Copy"].exists
    }
    @MainActor func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }
    @MainActor func tap(_ app: XCUIApplication, _ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        let exists = element.exists || element.waitForExistence(timeout: 8)
        if !exists { shot(app, "missing-control"); print("MISSING CONTROL TREE\n" + app.debugDescription) }
        XCTAssertTrue(exists, "Missing control: \(element)", file: file, line: line)
        // A sheet still animating in can report no frame yet; asking for hit
        // points then fails the test outright.
        let framed = XCTNSPredicateExpectation(predicate: NSPredicate { object, _ in
            guard let element = object as? XCUIElement else { return false }
            return element.exists && !element.frame.isEmpty
        }, object: element)
        _ = XCTWaiter.wait(for: [framed], timeout: 3)
        var control = element
        // Menus may have the same label as an underlying, obscured filter.
        if !control.isHittable, control.elementType == .button,
           let visible = app.buttons.matching(NSPredicate(format: "label == %@", control.label)).allElementsBoundByIndex.first(where: { $0.isHittable }) { control = visible }
        if !control.isHittable {
            let settled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "hittable == true"), object: control)
            _ = XCTWaiter.wait(for: [settled], timeout: 2)
        }
        for _ in 0..<8 {
            if control.isHittable { break }
            let top = min(app.frame.height * 0.3, max(130, app.navigationBars.allElementsBoundByIndex.filter(\.isHittable).map { $0.frame.maxY }.max() ?? 130) + 20)
            // iOS 26 draws the suggestion bar above the keyboard's reported frame.
            let bottom = min(app.frame.height - 120, app.keyboards.firstMatch.exists ? app.keyboards.firstMatch.frame.minY - 70 : app.frame.height - 120)
            let upper = app.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: top / app.frame.height))
            let lower = app.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: max(top + 40, bottom) / app.frame.height))
            if control.frame.maxY < top { upper.press(forDuration: 0.05, thenDragTo: lower) }
            else { lower.press(forDuration: 0.05, thenDragTo: upper) }
        }
        if !control.isHittable { print("UNREACHABLE TREE\n" + app.debugDescription) }
        XCTAssertTrue(control.isHittable, "Unreachable control: \(control)", file: file, line: line)
        control.tap()
    }
    @MainActor func input(_ app: XCUIApplication, _ label: String, _ value: String) {
        // Sheets may still be animating in; wait for the field before picking its kind.
        let field = app.textFields[label], view = app.textViews[label]
        for _ in 0..<10 where !field.exists && !view.exists { _ = field.waitForExistence(timeout: 0.5) }
        let e = field.exists ? field : view
        if (e.value as? String) == value { return }
        tap(app, e)
        if let old = e.value as? String, old != label, old != (e.placeholderValue ?? ""), !old.isEmpty {
            // A tap can place the caret before an existing number, so put it at
            // the end first. No ⌘A: a hardware shortcut makes a freshly erased
            // simulator raise iOS's "Keyboard Detected" prompt mid-test.
            e.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.5)).tap()
            e.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: old.count + 2))
        }
        e.typeText(value)
    }
    @MainActor func create(_ app: XCUIApplication, _ kind: String, _ name: String, _ place: String) {
        if !app.buttons["New trip"].exists {
            tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'upcoming trips, add a trip'")).firstMatch)
        }
        tap(app, app.buttons["New trip"]); tap(app, app.buttons["trip-kind-\(kind)"])
        tap(app, app.buttons["Continue"])
        XCTAssertFalse(app.buttons["Create trip"].isEnabled, "An empty trip must not save")
        input(app, "Trip name", name); input(app, "Destination", place)
        tap(app, app.buttons["Create trip"])
        XCTAssertTrue(app.staticTexts[name].waitForExistence(timeout: 10))
    }
    @MainActor func tab(_ app: XCUIApplication, _ name: String) {
        if !app.tabBars.buttons[name].exists, app.buttons["Close"].firstMatch.exists { app.buttons["Close"].firstMatch.tap() }
        if !app.tabBars.buttons[name].exists, let collapsed = app.tabBars.buttons.allElementsBoundByIndex.first(where: { ($0.value as? String) == "Collapsed" }) { collapsed.tap() }
        tap(app, app.tabBars.buttons[name])
    }
    @MainActor func closeTrip(_ app: XCUIApplication) {
        tab(app, "Trip"); tap(app, app.buttons["All trips"])
        XCTAssertTrue(app.tabBars.buttons["Trips"].waitForExistence(timeout: 8))
        app.tabBars.buttons["Trips"].tap()
    }
    @MainActor func choosePhoto(_ app: XCUIApplication) {
        XCTAssertTrue(app.buttons["Cancel"].waitForExistence(timeout: 8))
        // Picker thumbnails read "Photo, <date>"; don't match the app's own "photo" icon behind it.
        let photo = app.images.matching(NSPredicate(format: "label BEGINSWITH 'Photo,'")).firstMatch
        if !photo.waitForExistence(timeout: 25) {
            print("PHOTO PICKER TREE\n" + app.debugDescription)
            XCTFail("The system photo picker did not load QA images"); return
        }
        let loaded = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.staticTexts["Loading..."].firstMatch)
        XCTAssertEqual(XCTWaiter.wait(for: [loaded], timeout: 20), .completed)
        shot(app, "system-photo-picker-ready")
        // Photos' remote view exposes the thumbnail as an Image, whose AX
        // activation point is missing on this runtime. Tap its visible centre.
        photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
}

nonisolated final class PowerUserCityFlowTests: PowerUserScenarioCase {
    @MainActor func test01CityTripWardrobePhotosPackingBudgetAndDocuments() {
        let app = launch()
        XCTAssertTrue(app.tabBars.buttons["Trips"].waitForExistence(timeout: 10))
        let existing = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Paris — cafés, art & friends'")).firstMatch
        if existing.waitForExistence(timeout: 2) { existing.tap() }
        else { create(app, "city", "Paris — cafés, art & friends", "Paris, France") }
        shot(app, "01-city-created")
        tab(app, "Days")
        for title in ["Coffee at Café de Flore", "Louvre afternoon with Alex", "Dinner by the Seine"] where !app.staticTexts[title].exists {
            tap(app, app.buttons["Add plan"]); input(app, "What's the plan?", title)
            input(app, "Where · details", title.contains("Louvre") ? "Rue de Rivoli" : "Saint-Germain-des-Prés")
            tap(app, app.buttons["Save"]); XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 5))
        }
        shot(app, "02-city-plans")
        tab(app, "Wardrobe")
        for (index, name) in ["Cream linen shirt", "Everyday trousers", "Walking trainers", "Rain shell"].enumerated() where !app.staticTexts[name].exists {
            tap(app, app.buttons["Add piece"])
            XCTAssertFalse(app.buttons["Add"].isEnabled)
            input(app, "Name", name)
            if index == 0 {
                tap(app, app.buttons["Add a photo"]); choosePhoto(app)
                XCTAssertTrue(app.buttons["Change photo"].waitForExistence(timeout: 10), "Selected image must load into the garment editor")
                shot(app, "03-garment-photo-picker-result")
            }
            if index > 0 {
                tap(app, app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Category'")).firstMatch)
                tap(app, app.buttons.matching(identifier: index == 1 ? "Bottoms" : index == 2 ? "Shoes" : "Layers").firstMatch)
            }
            tap(app, app.buttons["Add"])
            XCTAssertTrue(app.staticTexts[name].waitForExistence(timeout: 5))
        }
        shot(app, "04-wardrobe-with-photo")
        tap(app, app.buttons["AI stylist"])
        tap(app, app.buttons["Build a capsule for me"])
        tap(app, app.buttons["Restyle"])
        shot(app, "05-generated-capsule-outfits")
        app.navigationBars.buttons.firstMatch.tap()
        tab(app, "Packing")
        tap(app, app.buttons["Add item"]); input(app, "Item", "Passport (QA copy)")
        tap(app, app.buttons["Add"])
        XCTAssertTrue(app.staticTexts["Passport (QA copy)"].waitForExistence(timeout: 5))
        let unpacked = app.buttons["Not packed"].firstMatch
        tap(app, unpacked)
        shot(app, "06-packing-progress")
        tab(app, "Trip")
        tap(app, app.buttons["Trip options"]); tap(app, app.buttons["Edit trip"])
        input(app, "Add someone by name", "Alex Chen"); tap(app, app.buttons["Add"])
        input(app, "Add someone by name", "Zoë Martin"); tap(app, app.buttons["Add"])
        shot(app, "07-trip-companions")
        tap(app, app.buttons["Save"])
        tap(app, app.buttons["Budget"])
        let budgetLink = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Total planned'")).firstMatch
        tap(app, budgetLink)
        for (title, amount) in [("Apartment — four nights", "420.50"), ("Metro passes for everyone", "31.25"), ("Group dinner", "89.99")] {
            tap(app, app.buttons["Add expense"])
            input(app, "What was it?", title)
            let amountField = app.textFields.matching(NSPredicate(format: "placeholderValue BEGINSWITH 'Amount ('")).firstMatch
            tap(app, amountField); amountField.typeText(amount)
            tap(app, app.buttons["Add"])
            XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 5))
        }
        tap(app, app.buttons["Show daily list"])
        shot(app, "08-budget-daily")
        app.navigationBars.buttons.firstMatch.tap()
        tap(app, app.buttons["Overview"])
        let documents = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Documents'")).firstMatch
        tap(app, documents)
        tap(app, app.buttons["Add document"]); tap(app, app.buttons["Photo"])
        choosePhoto(app)
        XCTAssertTrue(app.navigationBars["Save document"].waitForExistence(timeout: 8))
        input(app, "Name", "QA museum ticket — not a real booking")
        tap(app, app.buttons["Save"])
        XCTAssertTrue(app.staticTexts["QA museum ticket — not a real booking"].waitForExistence(timeout: 8))
        shot(app, "09-offline-documents-with-photo")
        app.navigationBars.buttons.firstMatch.tap()
        closeTrip(app)
        app.terminate(); app.launch()
        XCTAssertTrue(app.staticTexts["Paris — cafés, art & friends"].waitForExistence(timeout: 8))
        shot(app, "10-city-persists-after-relaunch")
    }
}

nonisolated final class PowerUserAdventureFlowTests: PowerUserScenarioCase {
    @MainActor func test02AdventureRoadBeachAndCampingModes() {
        let app = launch()
        for (kind, name, place) in [
            ("trek", "Dolomites hut-to-hut", "Cortina d'Ampezzo, Italy"),
            ("climb", "Island Peak acclimatisation", "Lukla, Nepal"),
            ("camp", "Lakeside family camp", "Lake District, England"),
            ("road", "Pacific coast road trip", "San Francisco, California"),
            ("beach", "Goa coast and dive weekend", "Goa, India")
        ] {
            let existing = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
            if existing.waitForExistence(timeout: 1) { tap(app, existing) }
            else { create(app, kind, name, place) }
            if kind == "climb" {
                tab(app, "Climb"); tap(app, app.buttons[app.buttons["Set up summit"].exists ? "Set up summit" : "Edit summit"])
                input(app, "Peak, like Island Peak", "Island Peak")
                input(app, "Summit height (m)", "6189")
                input(app, "High camp height (m)", "7000")
                XCTAssertFalse(app.buttons["Save"].isEnabled, "High camp must be below the summit")
                input(app, "High camp height (m)", "5600")
                tap(app, app.buttons["Save"]); shot(app, "20-climb-summit")
                tab(app, "Trip")
                tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Approach and route'")).firstMatch)
            } else if kind != "beach" { tab(app, "Route") }
            if kind != "beach" {
                for (index, title) in ["Arrival and acclimatisation", "Scenic traverse and overnight stay"].enumerated() where !app.staticTexts[title].exists {
                    tap(app, app.buttons["Add stage"])
                    input(app, kind == "road" ? "From → To" : "From → To, or a rest day", title)
                    input(app, "Distance (km)", kind == "road" ? "135" : index == 0 ? "8.5" : "12")
                    if kind != "road" {
                        input(app, "Climb (m)", "450"); input(app, "Sleep altitude (m)", kind == "climb" ? "3400" : "1800")
                    }
                    input(app, "Time, e.g. 5–6 h", "4–5 h")
                    tap(app, app.buttons["Save"])
                    XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 5))
                }
                shot(app, "21-\(kind)-route-stages")
                if kind == "climb" { app.navigationBars.buttons.firstMatch.tap() }
            }
            if ["trek", "climb", "camp"].contains(kind) {
                tab(app, "Gear")
                for item in ["Insulated sleeping bag", "Headlamp and spare battery"] where !app.staticTexts[item].exists {
                    tap(app, app.buttons["Add gear"]); input(app, "Item", item)
                    input(app, "Weight (g)", item.contains("bag") ? "950" : "120")
                    tap(app, app.buttons["Add"])
                }
                shot(app, "22-\(kind)-gear")
                tab(app, "Trip")
                tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Before you go'")).firstMatch)
                if !app.staticTexts["QA park entry permit"].exists {
                    tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Add a permit'")).firstMatch)
                    input(app, "Permit name", "QA park entry permit")
                    tap(app, app.buttons["Add"])
                }
                if app.buttons["Mark as paid"].exists { tap(app, app.buttons["Mark as paid"]) }
                shot(app, "23-\(kind)-permits")
                app.navigationBars.buttons.firstMatch.tap()
                tab(app, "Safety")
                let contact = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Who to tell'")).firstMatch
                tap(app, contact); input(app, "e.g. Mum + Rahul", "Alex — scheduled evening check-in")
                tap(app, app.alerts.buttons["Save"])
                if kind == "trek" {
                    tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Altitude check-in'")).firstMatch)
                    tap(app, app.buttons["Increase SpO₂"])
                    shot(app, "24-altitude-check-in")
                    tap(app, app.buttons["Save check-in"])
                    tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Local emergency number'")).firstMatch)
                    input(app, "Verified local number", "112")
                    tap(app, app.alerts.buttons["Save"])
                    tap(app, app.buttons["Emergency call"])
                    XCTAssertTrue(app.buttons["Call 112"].waitForExistence(timeout: 5))
                    shot(app, "25-emergency-confirmation")
                    app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.2)).tap()
                    let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.buttons["Call 112"])
                    XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed)
                }
                shot(app, "26-\(kind)-safety")
            } else if kind == "road" {
                tab(app, "Stops")
                for stop in ["Monterey aquarium", "Big Sur coastal viewpoint"] where !app.staticTexts[stop].exists {
                    tap(app, app.buttons["Add stop"]); input(app, "Place", stop)
                    input(app, "Details", "Parking and tickets arranged — QA")
                    tap(app, app.buttons["Add"])
                }
                shot(app, "27-road-stops")
            } else {
                tab(app, "Tides")
                if !app.staticTexts["Grande Island — QA dive log"].exists {
                    tap(app, app.buttons["Log"]); input(app, "Dive site", "Grande Island — QA dive log")
                    tap(app, app.buttons["Save"])
                }
                XCTAssertTrue(app.staticTexts["Grande Island — QA dive log"].waitForExistence(timeout: 5))
                shot(app, "28-beach-dive-log")
            }
            closeTrip(app)
        }
        shot(app, "29-six-fully-created-trip-types")
    }

}

nonisolated final class PowerUserAccountFlowTests: PowerUserScenarioCase {
    @MainActor func test03SearchDiscoverDraftAccountSyncAndExports() {
        let app = launch()
        XCTAssertTrue(app.tabBars.buttons["Trips"].waitForExistence(timeout: 10))
        tab(app, "Search")
        let search = app.searchFields.firstMatch; tap(app, search); search.typeText("Louvre")
        XCTAssertTrue(app.staticTexts["Louvre afternoon with Alex"].waitForExistence(timeout: 8))
        shot(app, "30-search-across-trips")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Louvre afternoon'")).firstMatch)
        XCTAssertTrue(app.tabBars.buttons["Days"].waitForExistence(timeout: 8))
        closeTrip(app)
        tab(app, "Discover"); tap(app, app.buttons["Cities"])
        shot(app, "31-discover-city-ideas")
        tab(app, "Shared"); shot(app, "32-shared-cost-balances")
        tab(app, "Profile")
        tap(app, app.buttons["More"]); tap(app, app.buttons["Edit name"])
        input(app, "Name", "Jamie Rivera — QA traveller"); tap(app, app.alerts.buttons["Save"])
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Home base'")).firstMatch)
        input(app, "City or airport", "London · LHR"); tap(app, app.alerts.buttons["Save"])
        shot(app, "33-personalised-profile")
        let signIn = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Sign in to sync' OR label CONTAINS 'Sign in again'")).firstMatch
        if signIn.exists {
        tap(app, signIn)
        tap(app, app.buttons["Continue with Email"])
        input(app, "Email", "e2e@tripsloom.test")
        let password = app.secureTextFields["Password"]; tap(app, password); password.typeText("incorrect-password")
        tap(app, app.buttons.matching(identifier: "Sign in").allElementsBoundByIndex.last!)
        XCTAssertTrue(app.staticTexts["That email and password don't match."].waitForExistence(timeout: 8))
        shot(app, "34-invalid-sign-in-error")
        tap(app, password)
        password.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 24) + "QA-only-passphrase-2026!")
        tap(app, app.buttons.matching(identifier: "Sign in").allElementsBoundByIndex.last!)
        XCTAssertTrue(app.tabBars.buttons["Trips"].waitForExistence(timeout: 10))
        tab(app, "Profile")
        }
        let account = app.buttons.matching(NSPredicate(format: "label CONTAINS 'e2e@tripsloom.test'")).firstMatch
        tap(app, account)
        shot(app, "35-account-sync")
        let help = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Help & feedback'")).firstMatch
        tap(app, help)
        let message = app.textFields["Tell us what happened and what you expected"]
        if message.exists { tap(app, message); message.typeText("QA only: the Paris trip and all six trip modes are being tested.") }
        else { let text = app.textViews.firstMatch; tap(app, text); text.typeText("QA only: all six trip modes are being tested.") }
        tap(app, app.buttons["Done"].firstMatch)
        tap(app, app.buttons["Send feedback"])
        XCTAssertTrue(app.alerts.staticTexts.matching(NSPredicate(format: "label CONTAINS 'received'")).firstMatch.waitForExistence(timeout: 8))
        shot(app, "36-feedback-server-acknowledgement")
        tap(app, app.alerts.buttons["OK"])
        app.navigationBars.buttons.firstMatch.tap()
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Data & privacy'")).firstMatch)
        tap(app, app.buttons["Export my data"])
        XCTAssertTrue(shareSheetShown(app),
                      "Share sheet missing; alert: \(app.alerts.staticTexts.allElementsBoundByIndex.map(\.label))")
        shot(app, "37-asset-inclusive-backup-share")
        let close = app.buttons["Close"].firstMatch
        if close.exists { close.tap() } else { app.swipeDown() }
        XCTAssertTrue(app.buttons["Restore a backup"].waitForExistence(timeout: 8))
        tap(app, app.buttons["Restore a backup"])
        XCTAssertTrue(app.buttons["Cancel"].waitForExistence(timeout: 8))
        shot(app, "38-native-backup-file-picker")
        tap(app, app.buttons["Cancel"])
        app.navigationBars.buttons.firstMatch.tap()
        tab(app, "Trips")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'upcoming trips, add a trip'")).firstMatch)
        tap(app, app.buttons["Plan with AI"])
        let prompt = app.textFields["Describe your trip"]
        if prompt.exists { tap(app, prompt); prompt.typeText("Three relaxed days in Kyoto with vegetarian food and a modest budget") }
        else { let prompt = app.textViews.firstMatch; tap(app, prompt); prompt.typeText("Three relaxed days in Kyoto with vegetarian food and a modest budget") }
        tap(app, app.buttons["Draft trip"])
        XCTAssertTrue(app.buttons["Save as trip"].waitForExistence(timeout: 25))
        shot(app, "39-personalised-draft-preview")
        tap(app, app.buttons["Save as trip"])
        XCTAssertTrue(app.tabBars.buttons["Trip"].waitForExistence(timeout: 10))
        closeTrip(app)
        shot(app, "40-power-user-workspace")
    }

}
