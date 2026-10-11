import XCTest
@testable import TripsLoom

nonisolated final class ProductRegressionTests: XCTestCase {
    @MainActor func testNotificationCapacityIsSharedAcrossTrips() {
        XCTAssertEqual(Reminders.remainingSlots(pendingCount: 45), 15)
        XCTAssertEqual(Reminders.remainingSlots(pendingCount: 60), 0)
        XCTAssertEqual(Reminders.remainingSlots(pendingCount: 80), 0)
    }

    @MainActor func testAcceptingAnInvitationUpdateKeepsPersonalHealthRecords() {
        var local = trip(); local.adventure = Adventure()
        local.adventure?.checkIns = [.init(altitude: 4500, spo2: 92, heartRate: 75, symptoms: [0, 0, 0, 0, 0])]
        let invite = TripInvite.make(local, senderName: "Friend")
        XCTAssertNil(invite.trip.adventure)
        XCTAssertEqual(invite.tripForJoining(as: nil, existing: local).adventure?.checkIns.count, 1)
    }

    @MainActor func testInvitationDecompressionIsBoundedAndLinksStillRoundTrip() throws {
        let large = Data(repeating: 65, count: 3 * 1024 * 1024)
        let compressed = try (large as NSData).compressed(using: .lzma) as Data
        XCTAssertNil(TripInvite.boundedDecompression(compressed))
        let invite = TripInvite.make(trip(), senderName: "Traveller")
        let link = try XCTUnwrap(invite.link)
        XCTAssertEqual(TripInvite.from(link: link)?.trip.id, invite.trip.id)
    }

    @MainActor func trip(zone: String = "Europe/Paris", start: String = "2026-10-24", days: Int = 4) -> Trip {
        var trip = Trip(name: "Test journey", place: "Paris", kind: .city,
                        start: TravelDates.date(start, in: TimeZone(identifier: zone)!)!, dayCount: days, photo: .lisbon)
        trip.timeZoneID = zone; trip.startDayKey = start
        return trip
    }

    @MainActor func testDestinationDaysRemainStableAcrossDaylightSaving() {
        let t = trip()
        XCTAssertEqual(t.dayKey(0), "2026-10-24")
        XCTAssertEqual(t.dayKey(1), "2026-10-25")
        XCTAssertEqual(t.dayKey(2), "2026-10-26")
        XCTAssertEqual(t.dayKey(3), "2026-10-27")
        XCTAssertEqual(t.date(ofDay: 2).timeIntervalSince(t.date(ofDay: 1)), 25 * 3600)
    }

    @MainActor func testChangingZoneKeepsTheDepartureDay() {
        var t = trip(zone: "Pacific/Auckland")
        t.setTimeZone("America/Los_Angeles")
        XCTAssertEqual(t.dayKey(0), "2026-10-24")
        XCTAssertEqual(t.calendar.timeZone.identifier, "America/Los_Angeles")
    }

    @MainActor func testInvalidCivilDatesAndTimesAreRejected() {
        XCTAssertNil(TravelDates.date("2026-02-30"))
        XCTAssertNil(TravelDates.date("2026-13-01"))
        let t = trip()
        XCTAssertNil(t.startDate(of: Plan(day: 0, time: "25:00", title: "Invalid", category: .activity)))
        XCTAssertNil(t.startDate(of: Plan(day: 0, time: "10:70", title: "Invalid", category: .activity)))
        XCTAssertNil(t.startDate(of: Plan(day: 7, time: "10:00", title: "Invalid", category: .activity)))
    }

    @MainActor func testCalendarHasExclusiveAllDayEndAndUTCTimes() {
        var t = trip()
        t.plans = [Plan(day: 2, time: "10:00", title: "Museum, café; lunch\nSecond line", category: .activity)]
        let calendar = TripExports.calendar(t)
        XCTAssertTrue(calendar.contains("DTEND;VALUE=DATE:20261028"))
        XCTAssertTrue(calendar.contains("DTSTART:20261026T090000Z"))
        XCTAssertTrue(calendar.contains("Museum\\, café\\; lunch\\nSecond line"))
        XCTAssertTrue(calendar.hasSuffix("END:VCALENDAR\r\n"))
    }

    @MainActor func testCalendarFoldsUnicodeWithoutExceeding75Bytes() {
        let original = "SUMMARY:" + String(repeating: "世界🧳", count: 100)
        let folded = TripExports.fold(original)
        XCTAssertTrue(folded.components(separatedBy: "\r\n").allSatisfy { $0.utf8.count <= 75 })
        XCTAssertEqual(folded.replacingOccurrences(of: "\r\n ", with: ""), original)
    }

    @MainActor func testSmallSplitBalancesAreNotHidden() {
        var t = trip()
        t.expenses = [Expense(title: "Coffee", category: .food, amount: 1.50, splitWith: [Trip.me, "Alex"])]
        XCTAssertEqual(t.ledger.first?.amount, -0.75)
    }

    @MainActor func testCurrenciesUseLocalePrecisionAndCarryCorrectly() {
        let usd = Fmt.currencyFormatter("USD", locale: Locale(identifier: "en_US"))
        XCTAssertEqual(usd.string(from: 1.999), "$2.00")
        XCTAssertEqual(usd.string(from: -1.5), "-$1.50")
        let jpy = Fmt.currencyFormatter("JPY", locale: Locale(identifier: "en_US"))
        XCTAssertEqual(jpy.maximumFractionDigits, 0)
        let kwd = Fmt.currencyFormatter("KWD", locale: Locale(identifier: "en_US"))
        XCTAssertEqual(kwd.maximumFractionDigits, 3)
    }

    @MainActor func testLocalisedAmountEntryIsStrictAndKeepsDecimals() {
        XCTAssertEqual(Fmt.parseAmount("1,234.56", locale: Locale(identifier: "en_US")), 1234.56)
        XCTAssertEqual(Fmt.parseAmount("1.234,56", locale: Locale(identifier: "de_DE")), 1234.56)
        XCTAssertEqual(Fmt.parseAmount("1\u{202F}234,56", locale: Locale(identifier: "fr_FR")), 1234.56)
        XCTAssertEqual(Fmt.parseAmount("1,23,456.78", locale: Locale(identifier: "en_IN")), 123456.78)
        XCTAssertNil(Fmt.parseAmount("12,50", locale: Locale(identifier: "en_US")))
        XCTAssertNil(Fmt.parseAmount("12.50oops", locale: Locale(identifier: "en_US")))
        XCTAssertNil(Fmt.parseAmount("NaN"))
        XCTAssertEqual(Fmt.roundedCurrency(1.999, "USD"), 2)
        XCTAssertEqual(Fmt.roundedCurrency(12.7, "JPY"), 13)
        XCTAssertEqual(Fmt.roundedCurrency(1.2345, "KWD"), 1.235)
    }

    @MainActor func testDayLabelsUseDestinationInsteadOfPhoneZone() {
        let t = trip(zone: "Pacific/Auckland")
        XCTAssertEqual(Fmt.dayNumber(t.civilStart, timeZone: t.timeZone), "24")
    }

    @MainActor func testCheckInRemindersAreFiniteAndEndWithTrip() {
        let t = trip()
        let before = t.civilStart.addingTimeInterval(-1)
        let dates = Reminders.checkInDates(time: "16:30", trip: t, now: before)
        XCTAssertEqual(dates.count, t.dayCount)
        XCTAssertTrue(dates.allSatisfy { t.calendar.component(.hour, from: $0) == 16 })
        XCTAssertEqual(Reminders.checkInDates(time: "16:30", trip: t, now: t.end.addingTimeInterval(86400)).count, 0)
        XCTAssertTrue(Reminders.checkInDates(time: "25:00", trip: t, now: before).isEmpty)
    }

    @MainActor func testInvitationsKeepTimeZoneAndExcludePrivateHealthRecords() throws {
        var t = trip()
        t.adventure = Adventure()
        t.adventure?.insurance = "Private policy"
        t.adventure?.checkIns = [.init(altitude: 4500, spo2: 92, heartRate: 75, symptoms: [0, 0, 0, 0, 0])]
        let invite = TripInvite.make(t, senderName: "Alex")
        XCTAssertNil(invite.trip.adventure)
        let restored = try XCTUnwrap(TripInvite.decode(try XCTUnwrap(invite.encoded())))
        XCTAssertEqual(restored.trip.dayKey(0), t.dayKey(0))
        let compact = try XCTUnwrap(TripInvite.from(link: try XCTUnwrap(invite.link)))
        XCTAssertEqual(compact.trip.timeZoneID, t.timeZoneID)
        XCTAssertEqual(compact.trip.dayKey(0), t.dayKey(0))
        var bad = invite; bad.trip.dayCount = -100
        XCTAssertNil(TripInvite.decode(try XCTUnwrap(bad.encoded())))
    }

    @MainActor func testUnsupportedHealthArraysAreRejectedBeforeRestore() {
        var t = trip(); t.adventure = Adventure()
        t.adventure?.checkIns = [.init(altitude: 4500, spo2: 92, heartRate: 75, symptoms: [9])]
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [t], wardrobe: [], profile: Profile())))
    }

    @MainActor func testCloudCopyExcludesPrivateHealthAndLocalFilePaths() {
        var t = trip(); t.adventure = Adventure(); t.coverFile = "private.jpg"
        t.adventure?.checkIns = [.init(altitude: 4500, spo2: 92, heartRate: 75, symptoms: [0, 0, 0, 0, 0])]
        XCTAssertNil(t.cloudCopy.coverFile)
        XCTAssertTrue(t.cloudCopy.adventure?.checkIns.isEmpty == true)
        XCTAssertEqual(t.adventure?.checkIns.count, 1)
        XCTAssertFalse(WardrobePhotos.isSafeFileName("../../tripsloom.json"))
        XCTAssertTrue(WardrobePhotos.isSafeFileName("\(UUID().uuidString).jpg"))
    }

    @MainActor func testBackupRoundTripStripsEntitlementsAndAccountIdentity() throws {
        var profile = Profile(); profile.name = "Alex"; profile.isPro = true; profile.email = "private@example.test"
        let bytes = try DataPortability.encode(trips: [trip()], wardrobe: [], profile: profile)
        let restored = try DataPortability.decode(bytes)
        XCTAssertEqual(restored.trips.count, 1)
        XCTAssertFalse(restored.profile.isPro)
        XCTAssertNil(restored.profile.email)
        XCTAssertFalse(String(decoding: bytes, as: UTF8.self).contains("accessToken"))
    }

    @MainActor func testBackupRejectsDuplicateAndMalformedDataBeforeRestore() throws {
        let t = trip()
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [t, t], wardrobe: [], profile: Profile())))
        var invalid = t; invalid.dayCount = -1
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [invalid], wardrobe: [], profile: Profile())))
        invalid = t; invalid.budgetLimit = -.infinity
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [invalid], wardrobe: [], profile: Profile())))
        invalid = t; invalid.timeZoneID = "Fake/Timezone"
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [invalid], wardrobe: [], profile: Profile())))
        XCTAssertThrowsError(try DataPortability.decode(Data(repeating: 0, count: 24 * 1024 * 1024 + 1)))
    }

    @MainActor func testFreshStoreHasNoSampleTripsAndCanPersist() throws {
        let directory = URL.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appending(path: "store.json")
        let store = TripStore(fileURL: url)
        XCTAssertTrue(store.trips.isEmpty); XCTAssertTrue(store.wardrobe.isEmpty)
        XCTAssertEqual(store.profile.name, "")
        store.add(trip()); XCTAssertTrue(store.saveNow())
        XCTAssertEqual(TripStore(fileURL: url).trips.count, 1)
    }

    @MainActor func testSaveFailureIsVisibleAndDoesNotDiscardInMemoryTrips() {
        let store = TripStore(fileURL: URL(fileURLWithPath: "/nonexistent/tripsloom/store.json"))
        store.add(trip())
        XCTAssertFalse(store.saveNow())
        XCTAssertNotNil(store.storageError)
        XCTAssertEqual(store.trips.count, 1)
    }

    @MainActor func testUnreadableExistingStorageIsNotTreatedAsANewWorkspace() throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        // A directory at the file path deterministically produces a read error,
        // unlike POSIX permission bits on privileged CI machines.
        let marker = folder.appending(path: "preserve-me")
        try Data("original".utf8).write(to: marker)
        let store = TripStore(fileURL: folder)
        XCTAssertNotNil(store.storageError)
        store.add(trip())
        XCTAssertFalse(store.saveNow())
        XCTAssertEqual(try Data(contentsOf: marker), Data("original".utf8))
    }

    @MainActor func testWebRoundTripKeepsDestinationDateAndUnknownFields() throws {
        let t = trip(zone: "Pacific/Auckland")
        let exported = WorkspaceMapper.export(trips: [t], wardrobe: [], base: nil)
        let rows = try XCTUnwrap(exported["trips"] as? [[String: Any]])
        XCTAssertEqual(rows[0]["start"] as? String, "2026-10-24")
        var base = exported
        var modified = rows
        modified[0]["notes"] = "Web-only notes"
        base["trips"] = modified
        let merged = WorkspaceMapper.export(trips: [t], wardrobe: [], base: base)
        XCTAssertEqual((merged["trips"] as? [[String: Any]])?.first?["notes"] as? String, "Web-only notes")
    }
}
