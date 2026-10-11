import SwiftUI
import XCTest
@testable import TripsLoom

/// Editing, budgets, polls and tides added in the production-readiness pass.
nonisolated final class CompletenessRegressionTests: XCTestCase {
    @MainActor private func trip(kind: TripKind = .city, days: Int = 4) -> Trip {
        var trip = Trip(name: "Test journey", place: "Goa", kind: kind,
                        start: TravelDates.date("2026-10-24", in: TimeZone(identifier: "Asia/Kolkata")!)!, dayCount: days, photo: .beach)
        trip.timeZoneID = "Asia/Kolkata"; trip.startDayKey = "2026-10-24"
        trip.companions = [Person(name: "Alex", color: 0x127C8C), Person(name: "Sam", color: 0x2E8B4A)]
        return trip
    }

    @MainActor func testPollVotesTravelByNameAndDoNotDoubleCount() throws {
        // Alex organises: two options, votes for the first.
        var organiser = trip()
        organiser.companions = [Person(name: "Sam", color: 0x2E8B4A)]
        let a = PollOption(title: "Fish thali", votes: 0), b = PollOption(title: "Beach shack", votes: 0)
        organiser.poll = Poll(question: "Dinner?", options: [a, b], votesBy: [:])
        organiser.poll?.vote(a.id)
        XCTAssertEqual(organiser.poll?.count(a.id), 1)

        // Sam joins from the link: Alex's vote is there under Alex's name.
        let link = try XCTUnwrap(TripInvite.make(organiser, senderName: "Alex").link)
        let toSam = try XCTUnwrap(TripInvite.from(link: link))
        var sam = toSam.tripForJoining(as: "Sam", existing: nil)
        XCTAssertNil(sam.poll?.myVote)
        XCTAssertEqual(sam.poll?.votesBy?["Alex"], a.id)
        XCTAssertEqual(sam.poll?.count(a.id), 1)

        // Sam votes for the second and shares back.
        sam.poll?.vote(b.id)
        XCTAssertEqual(sam.poll?.total, 2)
        let back = try XCTUnwrap(TripInvite.from(link: try XCTUnwrap(TripInvite.make(sam, senderName: "Sam").link)))
        let updated = back.tripForJoining(as: "Alex", existing: organiser)
        XCTAssertEqual(updated.poll?.myVote, a.id, "Alex's own vote stays Alex's")
        XCTAssertNil(updated.poll?.votesBy?["Alex"], "and isn't counted twice")
        XCTAssertEqual(updated.poll?.votesBy?["Sam"], b.id)
        XCTAssertEqual(updated.poll?.count(a.id), 1)
        XCTAssertEqual(updated.poll?.count(b.id), 1)
        XCTAssertEqual(updated.poll?.voters(a.id), [Trip.me])
    }

    @MainActor func testOlderPollsKeepCountingYourVoteInTheTotals() {
        let a = PollOption(title: "Cruise", votes: 3), b = PollOption(title: "Dinner", votes: 1)
        var poll = Poll(question: "Saturday", options: [a, b])
        poll.vote(b.id)
        XCTAssertEqual(poll.count(b.id), 2)
        poll.vote(a.id)
        XCTAssertEqual(poll.count(a.id), 4)
        XCTAssertEqual(poll.count(b.id), 1)
        poll.vote(a.id)
        XCTAssertNil(poll.myVote)
        XCTAssertEqual(poll.total, 4)
    }

    @MainActor func testRentedGearAndAConfirmedGuideCountTowardTheBudget() {
        var t = trip(kind: .trek, days: 5)
        t.gear = [
            GearItem(name: "Sleeping bag", group: .sleep, grams: 1400, status: .rent, rentPerDay: 200),
            GearItem(name: "Poles", group: .traction, grams: 500, status: .need, rentPerDay: 100),
        ]
        XCTAssertEqual(t.gearRental, 1000)
        t.adventure = Adventure()
        t.adventure?.guide = Guide(name: "Pemba", rating: 0, trips: 0, tags: [], dayRate: 2000, booked: false)
        XCTAssertEqual(t.guideCost, 0, "An unconfirmed guide isn't spent yet")
        t.adventure?.guide?.booked = true
        XCTAssertEqual(t.totalPlanned, 1000 + 10_000)
        XCTAssertEqual(t.spend(onDay: 0), 2200, accuracy: 0.001)
    }

    @MainActor func testPermitNotesSurviveMarkingPaid() {
        let paid = PermitEditor.meta(notes: "₹1,200 at Yuksom", paid: true)
        XCTAssertEqual(paid, "₹1,200 at Yuksom · paid")
        XCTAssertEqual(PermitEditor.notes(from: paid), "₹1,200 at Yuksom")
        XCTAssertEqual(PermitEditor.notes(from: "Not paid"), "")
        XCTAssertEqual(PermitEditor.meta(notes: "", paid: false), "Not paid")
        XCTAssertEqual(PermitEditor.notes(from: "Paid"), "")
    }

    @MainActor func testTideTurnsAreFoundBetweenHourlySamples() {
        let start = Date(timeIntervalSince1970: 0)
        // A 12.42 h tide sampled hourly; the true high is at 6.21 h.
        let curve = (0...24).map { hour in
            Tides.Point(date: start.addingTimeInterval(Double(hour) * 3600), height: cos((Double(hour) - 6.21) / 12.42 * 2 * .pi))
        }
        let turns = Tides.turns(in: curve)
        let high = try? XCTUnwrap(turns.first { $0.high })
        XCTAssertEqual((high?.date.timeIntervalSince(start) ?? 0) / 3600, 6.21, accuracy: 0.05)
        // Highs at 6.2 h and 18.6 h; the only low inside the day is at 12.4 h.
        XCTAssertEqual(turns.filter(\.high).count, 2)
        XCTAssertEqual(turns.filter { !$0.high }.count, 1)
    }

    @MainActor func testImperialEditorsStoreMetricValues() {
        let saved = Fmt.metric
        defer { Fmt.metric = saved }
        Fmt.metric = false
        var grams = 0
        var km = 0.0
        let weight = Binding(get: { grams }, set: { grams = $0 }).inItemWeightUnits
        let distance = Binding(get: { km }, set: { km = $0 }).inDistanceUnits
        weight.wrappedValue = 16
        XCTAssertEqual(grams, 454)
        distance.wrappedValue = 10
        XCTAssertEqual(km, 16.09, accuracy: 0.01)
        weight.wrappedValue = .nan
        XCTAssertFalse((0...1_000_000).contains(grams), "An invalid entry keeps Save disabled")
        Fmt.metric = true
        XCTAssertEqual(Fmt.depth(12), "12 m")
    }
}

nonisolated final class PlanTimeRegressionTests: XCTestCase {
    @MainActor func testTwelveHourTimesAreReadAndStoredAsTwentyFourHour() {
        XCTAssertEqual(TravelDates.clock("9:05 AM"), "09:05")
        XCTAssertEqual(TravelDates.clock("12:30 pm"), "12:30")
        XCTAssertEqual(TravelDates.clock("12:15 AM"), "00:15")
        XCTAssertEqual(TravelDates.clock("6:45 p.m."), "18:45")
        XCTAssertEqual(TravelDates.clock("7:00"), "07:00")
        XCTAssertNil(TravelDates.clock(""))
        XCTAssertNil(TravelDates.clock("25:00"))
        var trip = Trip(name: "T", place: "Paris", kind: .city, start: .now, dayCount: 2, photo: .lisbon)
        trip.plans = [Plan(day: 0, time: "10:00", title: "B", category: .sight), Plan(day: 0, time: "9:00 AM", title: "A", category: .sight),
                      Plan(day: 0, time: "", title: "C", category: .sight)]
        XCTAssertEqual(trip.plans(on: 0).map(\.title), ["A", "B", "C"])
        XCTAssertNotNil(trip.startDate(of: trip.plans[1]))
    }
}

nonisolated final class BookingPasteRegressionTests: XCTestCase {
    @MainActor func testPastedFlightConfirmationIsRecognised() {
        let text = "Flight BA 312 LHR → CDG\nDeparture 10 October 2026 at 10:45\nBooking reference QA1234\nGate A12 Seat 14C"
        let found = BookingParser.parse(text)
        XCTAssertEqual(found.count, 1, "\(found)")
        XCTAssertEqual(found.first?.category, .flight)
        XCTAssertEqual(found.first?.title, "Flight LHR → CDG")
        XCTAssertEqual(found.first?.flight?.gate, "A12")
        XCTAssertEqual(found.first?.flight?.seat, "14C")
        XCTAssertEqual(found.first?.time, "10:45")
    }

    /// Outbound and return each keep their own route, date and seat.
    @MainActor func testRoundTripFlightsKeepTheirOwnRouteAndDate() {
        let text = """
        Booking reference QA5678
        Flight BA 312 LHR → CDG
        Departure 25 October 2026 at 09:00
        Seat 14C
        Flight BA 313 CDG → LHR
        Departure 28 October 2026 at 18:30
        Seat 21A
        """
        let found = BookingParser.parse(text)
        XCTAssertEqual(found.count, 2, "\(found)")
        guard found.count == 2 else { return }
        XCTAssertEqual(found[0].title, "Flight LHR → CDG")
        XCTAssertEqual(found[1].title, "Flight CDG → LHR")
        XCTAssertEqual(found[0].flight?.destination, "CDG")
        XCTAssertEqual(found[1].flight?.destination, "LHR")
        XCTAssertEqual(found[0].time, "09:00")
        XCTAssertEqual(found[1].time, "18:30")
        XCTAssertEqual(found[0].flight?.seat, "14C")
        XCTAssertEqual(found[1].flight?.seat, "21A")
        let day = Calendar.current
        XCTAssertEqual(found[0].date.map { day.component(.day, from: $0) }, 25)
        XCTAssertEqual(found[1].date.map { day.component(.day, from: $0) }, 28)
    }
}

/// A climb with a live forecast must read the same to sync on every launch;
/// otherwise each launch looks like an edit and spawns "recovered edits" copies.
nonisolated final class SummitEncodingRegressionTests: XCTestCase {
    @MainActor private func summit(_ temps: [(UUID, Int)]) -> Summit {
        var summit = Summit(peak: "Island Peak", altitude: 6_189, forecast: [], dawnTemp: -15, leaveTime: "02:00", highCamp: 5_600, turnaround: "11:00")
        var dawn: [UUID: Int] = [:]
        for (id, temp) in temps { dawn[id] = temp }
        summit.dawnTemps = dawn
        return summit
    }

    @MainActor func testDawnTemperaturesEncodeTheSameWhateverTheirOrder() throws {
        let temps = (0..<24).map { (UUID(), -20 + $0) }
        let forward = summit(temps), backward = summit(temps.reversed())
        XCTAssertEqual(forward, backward)
        let encoder = JSONEncoder(); encoder.outputFormatting = .sortedKeys
        XCTAssertEqual(try encoder.encode(forward), try encoder.encode(backward))
        XCTAssertEqual(SyncEngine.fingerprint(forward), SyncEngine.fingerprint(backward))
        let decoded = try JSONDecoder().decode(Summit.self, from: try encoder.encode(forward))
        XCTAssertEqual(decoded, forward)
    }

    @MainActor func testOlderSavedDawnTemperaturesStillLoad() throws {
        let id = UUID()
        let legacy = #"{"peak":"Island Peak","altitude":6189,"forecast":[],"dawnTemp":-15,"leaveTime":"02:00","highCamp":5600,"turnaround":"11:00","dawnTemps":["\#(id.uuidString)",-18]}"#
        let decoded = try JSONDecoder().decode(Summit.self, from: Data(legacy.utf8))
        XCTAssertEqual(decoded.dawnTemps?[id], -18)
    }
}

/// Sample trips are there to explore; they must never send notifications.
nonisolated final class ReminderSampleRegressionTests: XCTestCase {
    @MainActor func testSampleTripsNeverGetReminders() {
        var sample = Trip(name: "Sample trek", place: "Lukla, Nepal", kind: .trek, start: .now.addingTimeInterval(86_400), dayCount: 5, photo: .himalaya)
        sample.isSample = true
        let mine = Trip(name: "My trek", place: "Lukla, Nepal", kind: .trek, start: .now.addingTimeInterval(86_400), dayCount: 5, photo: .himalaya)
        XCTAssertEqual(Reminders.remindable([sample, mine]).map(\.name), ["My trek"])
        let samples = SampleData.make().trips
        XCTAssertFalse(samples.isEmpty)
        XCTAssertTrue(samples.contains { $0.adventure?.checkInReminders == true }, "The sample trek ships with check-ins on")
        XCTAssertTrue(Reminders.remindable(samples).isEmpty, "Every bundled sample trip must be excluded")
    }
}

/// A settled split stays settled after the trip switches to a currency with
/// no minor unit, where each amount is rounded on its own.
nonisolated final class LedgerRoundingRegressionTests: XCTestCase {
    @MainActor func testSettledSplitShowsNoLeftoverInWholeUnitCurrency() {
        var trip = Trip(name: "Tokyo", place: "Tokyo, Japan", kind: .city, start: .now, dayCount: 3, photo: .lisbon)
        trip.currency = "¥"
        // ¥16,237 split three ways, Alex's share settled after conversion rounding.
        trip.expenses = [Expense(title: "Dinner", category: .food, amount: 16_237, splitWith: [Trip.me, "Alex", "Sam"])]
        trip.settlements = [Settlement(person: "Alex", amount: -5_412)]
        XCTAssertNil(trip.ledger.first { $0.person == "Alex" }, "\(trip.ledger)")
        XCTAssertEqual(trip.ledger.first { $0.person == "Sam" }?.amount ?? 0, -16_237.0 / 3, accuracy: 0.001)
    }
}
