import XCTest
import UIKit
@testable import TripsLoom

nonisolated final class PowerUserRegressionTests: XCTestCase {
    @MainActor func testWardrobePlaceholdersHaveValidSystemSymbols() {
        for category in GarmentCategory.allCases {
            XCTAssertNotNil(UIImage(systemName: category.symbol), "Missing system symbol for \(category.title)")
        }
    }
    @MainActor func testBookingImportHandlesRepeatsLargeClipboardAndDestinationDays() throws {
        XCTAssertTrue(BookingParser.parse(String(repeating: "x", count: 100_001)).isEmpty)
        var trip = Trip(name: "Tokyo", place: "Tokyo", kind: .city, start: .now, dayCount: 4, photo: .lisbon)
        trip.timeZoneID = "Asia/Tokyo"
        trip.startDayKey = "2026-10-10"
        let printedDate = try XCTUnwrap(Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 11)))
        let booking = ParsedBooking(category: .flight, title: "Flight LHR → NRT", meta: "BA 7 · PNR QA1234", date: printedDate, time: "09:30")
        XCTAssertEqual(BookingParser.dayOffset(booking, in: trip), 1)
        var duplicate = booking; duplicate.id = UUID()
        XCTAssertTrue(BookingParser.sameBooking(booking, duplicate))
        let imported = BookingParser.importedPlans([booking, duplicate], into: trip)
        XCTAssertEqual(imported.count, 1); XCTAssertEqual(imported.first?.day, 1)
        trip.plans = imported
        XCTAssertTrue(BookingParser.importedPlans([booking], into: trip).isEmpty)
    }
    @MainActor private func image() -> Data {
        UIGraphicsImageRenderer(size: CGSize(width: 50, height: 70)).jpegData(withCompressionQuality: 0.8) { c in
            UIColor.systemTeal.setFill(); c.fill(CGRect(x: 0, y: 0, width: 50, height: 70))
        }
    }
    @MainActor func testAssetBackupRestoresPhotosAndDocumentsIntoFreshStore() throws {
        let source = TripStore(fileURL: URL.temporaryDirectory.appending(path: "source-\(UUID()).json"))
        var trip = Trip(name: "Paris — café & friends", place: "Paris", kind: .city, start: .now, dayCount: 4, photo: .lisbon)
        trip.coverFile = try XCTUnwrap(CoverStore.shared.save(image(), for: trip.id))
        var garment = WardrobeItem(name: "Linen shirt", category: .tops, color: 0xFFFFFF)
        garment.imageFile = try XCTUnwrap(WardrobePhotos.save(image(), for: garment.id))
        trip.capsule = [garment.id]; trip.outfits = [Outfit(day: 0, title: "Arrival", items: [garment.id])]
        source.trips = [trip]; source.wardrobe = [garment]
        let doc = try XCTUnwrap(TripDocuments.shared.add(image(), ext: "jpg", title: "QA ticket", kind: .ticket, trip: trip.id))
        defer {
            TripDocuments.shared.delete(doc)
            CoverStore.shared.delete(trip.coverFile); WardrobePhotos.delete(garment.imageFile)
        }
        let bytes = try DataPortability.encodeBundle(source)
        let archive = try DataPortability.decode(bytes)
        XCTAssertEqual(archive.version, 2); XCTAssertEqual(archive.assets?.count, 3)
        let target = TripStore(fileURL: URL.temporaryDirectory.appending(path: "target-\(UUID()).json"))
        target.profile.email = "signed-in@example.test"; target.profile.isPro = true
        try DataPortability.restore(archive, to: target)
        XCTAssertNotNil(CoverStore.shared.image(target.trips[0].coverFile))
        XCTAssertNotNil(WardrobePhotos.image(target.wardrobe[0].imageFile))
        XCTAssertEqual(target.trips[0].outfits[0].items, [garment.id])
        let restoredDoc = try XCTUnwrap(TripDocuments.shared.documents(for: trip.id).first)
        XCTAssertEqual(try Data(contentsOf: TripDocuments.shared.url(restoredDoc)), image())
        XCTAssertEqual(target.profile.email, "signed-in@example.test"); XCTAssertTrue(target.profile.isPro)
        TripDocuments.shared.delete(restoredDoc)
        CoverStore.shared.delete(target.trips[0].coverFile); WardrobePhotos.delete(target.wardrobe[0].imageFile)
    }
    @MainActor func testBackupRejectsOrphanDuplicateAndInvalidAttachments() throws {
        let trip = Trip(name: "Valid", place: "Paris", kind: .city, start: .now, dayCount: 2, photo: .lisbon)
        var archive = DataPortability.Archive(version: 2, trips: [trip], wardrobe: [], profile: Profile())
        let asset = DataPortability.Asset(kind: .cover, id: trip.id, ext: "jpg", data: image())
        archive.assets = [asset, asset]; XCTAssertThrowsError(try DataPortability.validate(archive))
        archive.assets = [.init(kind: .cover, id: UUID(), ext: "jpg", data: image())]
        XCTAssertThrowsError(try DataPortability.validate(archive))
        archive.assets = [.init(kind: .cover, id: trip.id, ext: "jpg", data: Data("invalid".utf8))]
        XCTAssertThrowsError(try DataPortability.validate(archive))
        archive.assets = []; archive.documents = [.init(tripID: trip.id, title: "Ticket", kind: .ticket, fileName: "../../evil.pdf")]
        XCTAssertThrowsError(try DataPortability.validate(archive))
        XCTAssertNil(TripDocuments.shared.add(image(), ext: "../../evil.jpg", title: "Bad", kind: .other, trip: trip.id))
        XCTAssertFalse(TripDocuments.valid(Data(repeating: 0, count: TripDocuments.maximumBytes + 1), ext: "pdf"))
    }
    @MainActor func testFailedBackupRestorePreservesOriginalDataAndDocuments() throws {
        let invalidLocation = URL.temporaryDirectory.appending(path: "nonexistent-\(UUID())/data.json")
        let store = TripStore(fileURL: invalidLocation)
        let original = Trip(name: "Preserved", place: "Paris", kind: .city, start: .now, dayCount: 2, photo: .lisbon)
        store.trips = [original]
        let document = try XCTUnwrap(TripDocuments.shared.add(image(), ext: "jpg", title: "Original", kind: .ticket, trip: original.id))
        defer { TripDocuments.shared.delete(document) }
        let next = Trip(name: "Replacement", place: "Tokyo", kind: .city, start: .now, dayCount: 3, photo: .lisbon)
        XCTAssertThrowsError(try DataPortability.restore(.init(trips: [next], wardrobe: [], profile: Profile()), to: store))
        XCTAssertEqual(store.trips.first?.id, original.id)
        XCTAssertTrue(FileManager.default.fileExists(atPath: TripDocuments.shared.url(document).path))
        XCTAssertNotNil(TripDocuments.shared.all.first { $0.id == document.id })
    }
    @MainActor func testMalformedNumericRoutesExpensesAndDocumentsAreRejected() throws {
        var trip = Trip(name: "Untrusted import", place: "Paris", kind: .trek, start: .now, dayCount: 4, photo: .himalaya)
        trip.stages = [Stage(day: 1, title: "Route", meta: "", km: 12, ascent: Int.max, altitude: 1800)]
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [trip], wardrobe: [], profile: Profile())))
        trip.stages[0].ascent = 100; trip.stages[0].km = .infinity
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [trip], wardrobe: [], profile: Profile())))
        trip.stages = []
        trip.expenses = [Expense(title: "Overflow", category: .other, amount: 1e100)]
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [trip], wardrobe: [], profile: Profile())))
        trip.expenses = []; trip.gear = [GearItem(name: "Overflow", group: .other, grams: Int.max, status: .own)]
        XCTAssertThrowsError(try DataPortability.validate(.init(trips: [trip], wardrobe: [], profile: Profile())))
        XCTAssertFalse(TripDocuments.valid(Data("%PDF-fake document".utf8), ext: "pdf"))
        let pdf = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 200, height: 200)).pdfData { context in
            context.beginPage(); ("Synthetic QA ticket" as NSString).draw(at: CGPoint(x: 10, y: 10), withAttributes: nil)
        }
        XCTAssertTrue(TripDocuments.valid(pdf, ext: "pdf"))
    }
    @MainActor func testLargeWorkspaceBackupRoundTripPerformance() throws {
        let trips = (0..<500).map { n in
            var t = Trip(name: "Trip \(n) — café", place: "Paris", kind: .city, start: .now, dayCount: 4, photo: .lisbon)
            t.plans = (0..<10).map { Plan(day: $0 % 4, time: "09:00", title: "Activity \($0)", category: .sight, cost: 12.5) }
            return t
        }
        let wardrobe = (0..<500).map { WardrobeItem(name: "Piece \($0)", category: .tops, color: 0xFFFFFF) }
        measure(metrics: [XCTClockMetric()]) {
            do {
                let data = try DataPortability.encode(trips: trips, wardrobe: wardrobe, profile: Profile())
                let result = try DataPortability.decode(data)
                XCTAssertEqual(result.trips.count, 500); XCTAssertEqual(result.wardrobe.count, 500)
            } catch { XCTFail(error.localizedDescription) }
        }
    }

}
