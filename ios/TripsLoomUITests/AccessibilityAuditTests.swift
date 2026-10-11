import XCTest

/// Xcode's accessibility audit over the main screens of the populated QA
/// workspace. Runs after the power-user scenarios have filled it.
nonisolated final class AccessibilityAuditTests: PowerUserScenarioCase {
    @MainActor func testMainScreensPassTheAccessibilityAudit() throws {
        let app = launch()
        var issues: [String] = []
        func audit(_ screen: String) {
            do {
                try app.performAccessibilityAudit(for: [.sufficientElementDescription, .hitRegion, .trait, .elementDetection, .textClipped, .dynamicType]) { issue in
                    issues.append("\(screen): \(issue.auditType) · \(issue.compactDescription) · \(issue.element?.debugDescription.prefix(160) ?? "")")
                    return true
                }
            } catch { issues.append("\(screen): audit failed \(error)") }
        }
        XCTAssertTrue(app.tabBars.buttons["Trips"].waitForExistence(timeout: 10))
        audit("Trips")
        tab(app, "Discover"); audit("Discover")
        tab(app, "Shared"); audit("Shared")
        tab(app, "Profile"); audit("Profile")
        tab(app, "Trips")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Paris — cafés, art & friends'")).firstMatch)
        audit("Trip overview")
        tab(app, "Days"); audit("Days")
        tab(app, "Packing"); audit("Packing")
        closeTrip(app)
        for issue in issues { print("A11Y \(issue)") }
        print("A11Y COUNT \(issues.count)")
        XCTAssertFalse(issues.contains { $0.contains("audit failed") }, "The accessibility audit didn't run on every screen")
    }

    /// At the default size the clipping audit only predicts trouble at larger
    /// sizes. Here the app runs at the largest accessibility size, so anything
    /// it reports is text actually cut off on screen.
    @MainActor func testMainScreensDoNotClipTextAtLargestTextSize() throws {
        let app = launch(["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        var issues: [String] = []
        func audit(_ screen: String) {
            // Let entrance animations finish so nothing is measured mid-scale.
            Thread.sleep(forTimeInterval: 2)
            var elements: [XCUIElement?] = []
            do {
                try app.performAccessibilityAudit(for: [.textClipped]) { issue in
                    elements.append(issue.element)
                    return true
                }
            } catch { issues.append("\(screen): audit failed \(error)") }
            // Described after the audit; doing it inside the handler times it out.
            for element in elements {
                let shown = element.map { $0.exists ? "'\($0.label)' \($0.elementType.rawValue) \($0.frame)" : "gone" } ?? "no element"
                issues.append("\(screen): \(shown)")
            }
        }
        XCTAssertTrue(app.tabBars.buttons["Trips"].waitForExistence(timeout: 10))
        audit("Trips")
        tab(app, "Discover"); audit("Discover")
        tab(app, "Shared"); audit("Shared")
        tab(app, "Profile"); audit("Profile")
        tab(app, "Trips")
        tap(app, app.buttons.matching(NSPredicate(format: "label CONTAINS 'Paris — cafés, art & friends'")).firstMatch)
        audit("Trip overview")
        tab(app, "Days"); audit("Days")
        tab(app, "Packing"); audit("Packing")
        for issue in issues { print("XXXL \(issue)") }
        print("XXXL COUNT \(issues.count)")
        XCTAssertFalse(issues.contains { $0.contains("audit failed") }, "The accessibility audit didn't run on every screen")
    }
}
