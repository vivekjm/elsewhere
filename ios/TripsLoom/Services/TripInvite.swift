import Foundation
import Compression
import UniformTypeIdentifiers

extension UTType {
    static let tripsloomTrip = UTType(exportedAs: "com.tripsloom.trip")
}

/// Sharing a trip with the people on it: a `tripsloom://join` link and a
/// `.tripsloom` file carry the plan, costs and votes. Opening either shows a
/// preview; the other person picks who they are and gets their own copy.
/// Sharing again later updates their copy.
///
/// Not included: documents, cover photos, wardrobe pieces and outfits, and
/// your packing ticks — those stay on your iPhone.
struct TripInvite: Codable, Hashable, Identifiable {
    var version = 1
    var trip: Trip
    /// Who sent it, as they appear on the trip for everyone else.
    var from: String
    var sentAt = Date()

    var id: UUID { trip.id }

    /// Builds an invite, renaming "You" in costs to the sender's name.
    static func make(_ trip: Trip, senderName: String) -> TripInvite {
        let sender = senderName.trimmingCharacters(in: .whitespaces).isEmpty ? "Trip organiser" : senderName
        var copy = trip
        copy.isSample = nil
        // Health check-ins, insurance and emergency contacts are personal.
        copy.adventure = nil
        copy.coverFile = nil
        copy.coverRemote = nil
        copy.capsule = []
        copy.outfits = []
        copy.packing = trip.packing.filter { $0.wardrobeID == nil }.map { item in
            var item = item
            item.packed = false
            return item
        }
        copy.gear = trip.gear.map { item in
            var item = item
            item.packed = false
            return item
        }
        if var poll = copy.poll {
            // Your vote travels under your name; older polls carry counts only.
            if poll.votesBy != nil {
                poll.votesBy?[sender] = poll.myVote
            }
            poll.myVote = nil
            copy.poll = poll
        }
        copy.expenses = trip.expenses.map { expense in
            var e = expense
            e.paidBy = e.paidBy ?? sender
            e.splitWith = e.splitWith?.map { $0 == Trip.me ? sender : $0 }
            return e
        }
        copy.settlements = trip.settlements?.map { s in
            // Stored from your side; the recipient re-derives theirs.
            var s = s
            s.person = "\(sender)↔\(s.person)"
            return s
        }
        copy.balances = []
        return TripInvite(trip: copy, from: sender)
    }

    // MARK: Encoding

    func encoded() -> Data? { try? JSONEncoder.store.encode(self) }

    static func decode(_ data: Data) -> TripInvite? {
        guard data.count <= 2 * 1024 * 1024,
              var invite = try? JSONDecoder.store.decode(TripInvite.self, from: data), invite.version == 1 else { return nil }
        invite.trip.coverFile = nil; invite.trip.coverRemote = nil
        invite.trip.capsule = []; invite.trip.outfits = []
        for i in invite.trip.packing.indices { invite.trip.packing[i].wardrobeID = nil }
        guard (try? DataPortability.validate(.init(trips: [invite.trip], wardrobe: [], profile: Profile()))) != nil else { return nil }
        return invite
    }

    /// `tripsloom://join?d=<lzma, base64url>`: a compact copy of the plan
    /// and costs. iOS cuts opened links at 2,047 characters, so bigger trips
    /// go by file only (nil here).
    var link: URL? {
        guard let json = try? JSONEncoder().encode(CompactInvite(self)),
              let packed = try? (json as NSData).compressed(using: .lzma) as Data else { return nil }
        let token = packed.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let url = "tripsloom://join?d=\(token)"
        return url.count <= 1_900 ? URL(string: url) : nil
    }

    static func from(link url: URL) -> TripInvite? {
        guard url.scheme == "tripsloom", url.host() == "join",
              let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "d" })?.value
              , token.count <= 1900
        else { return nil }
        var base64 = token.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64 += "=" }
        guard let packed = Data(base64Encoded: base64),
              let json = boundedDecompression(packed),
              let compact = try? JSONDecoder().decode(CompactInvite.self, from: json)
        else { return nil }
        guard let invite = compact.invite, let data = invite.encoded() else { return nil }
        return decode(data)
    }

    static func from(file url: URL) -> TripInvite? {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              size <= 2 * 1024 * 1024 else { return nil }
        return (try? Data(contentsOf: url)).flatMap(decode)
    }

    /// Invitations are untrusted input. Bound allocation before decompressing,
    /// rather than expanding an arbitrary payload and checking its size later.
    static func boundedDecompression(_ packed: Data) -> Data? {
        let capacity = 2 * 1024 * 1024 + 1
        var output = Data(count: capacity)
        let count = output.withUnsafeMutableBytes { destination in
            packed.withUnsafeBytes { source in
                guard let dst = destination.bindMemory(to: UInt8.self).baseAddress,
                      let src = source.bindMemory(to: UInt8.self).baseAddress else { return 0 }
                return compression_decode_buffer(dst, capacity, src, packed.count, nil, COMPRESSION_LZMA)
            }
        }
        guard count > 0, count < capacity else { return nil }
        output.count = count
        return output
    }

    /// The file to attach, named after the trip.
    func file() -> URL? {
        guard let data = encoded() else { return nil }
        guard let url = try? TripExports.exportURL(named: trip.name, ext: "tripsloom") else { return nil }
        return (try? data.write(to: url, options: [.atomic, .completeFileProtection])) != nil ? url : nil
    }

    /// The message that goes with the link and file.
    var message: String {
        var text = "Join me on Trips Loom: \(trip.name), \(trip.dateRange) in \(trip.place)."
        if let link {
            text += "\n\nOpen in the app: \(link.absoluteString)"
        } else {
            text += "\n\nOpen the attached \(trip.name).tripsloom file and choose Trips Loom."
        }
        return text
    }

    // MARK: Joining

    /// The trip as it should be saved for the person joining, who is
    /// `me` (one of the people on the trip) or nobody in particular.
    func tripForJoining(as me: String?, existing: Trip?) -> Trip {
        var t = trip
        let sender = from
        var people = t.companions.filter { $0.name != me }
        if !people.contains(where: { $0.name == sender }) {
            people.insert(Person(name: sender, color: 0x127C8C), at: 0)
        }
        t.companions = people
        t.expenses = t.expenses.map { expense in
            var e = expense
            if let me {
                if e.paidBy == me { e.paidBy = nil }
                e.splitWith = e.splitWith?.map { $0 == me ? Trip.me : $0 }
            }
            return e
        }
        // Settlements between the sender and you carry over; others don't concern you.
        t.settlements = trip.settlements?.compactMap { s in
            let parts = s.person.components(separatedBy: "↔")
            guard parts.count == 2, parts[1] == me else { return nil }
            var mine = s
            mine.person = sender
            mine.amount = -s.amount
            return mine
        }
        t.travellers = max(t.travellers, t.companions.count + 1)
        if var poll = t.poll, poll.votesBy != nil {
            // Your own vote comes back under your name: it's yours again. A
            // vote you've changed since is newer than the copy you were sent.
            let returned = me.flatMap { poll.votesBy?.removeValue(forKey: $0) }
            let local = existing?.poll.flatMap { $0.votesBy != nil ? $0.myVote : nil }
            let pick = existing?.poll != nil ? local : returned
            poll.myVote = pick.flatMap { id in poll.options.contains { $0.id == id } ? id : nil }
            t.poll = poll
        }
        if let existing {
            // An update: keep what's personal to this iPhone.
            t.packing = existing.packing
            t.gear = t.gear.map { item in
                var item = item
                item.packed = existing.gear.first { $0.name == item.name }?.packed ?? false
                return item
            }
            t.capsule = existing.capsule
            t.outfits = existing.outfits
            t.coverFile = existing.coverFile
            t.coverRemote = existing.coverRemote
            t.adventure = existing.adventure
            if t.poll?.votesBy == nil, let vote = existing.poll?.myVote, t.poll?.options.contains(where: { $0.id == vote }) == true { t.poll?.myVote = vote }
        }
        t.isSample = nil
        return t
    }
}

/// The link's payload: short keys, and only what the other person needs
/// (plans, stages, people and costs). Their packing list is their own.
private struct CompactInvite: Codable {
    struct P: Codable { var d: Int; var t: String; var n: String; var m: String?; var c: String; var x: Double?; var o: String? }
    struct E: Codable { var n: String; var a: Double; var c: String; var d: Int?; var p: String?; var s: [String]? }
    struct S: Codable { var d: Int; var n: String; var m: String?; var k: Double; var u: Int; var h: Int }
    struct O: Codable { var i: UUID; var t: String; var c: Int }
    struct V: Codable { var q: String; var o: [O]; var b: [String: UUID]? }
    var v = 1
    var i: UUID
    var n: String
    var pl: String
    var k: String
    var st: Date
    var dc: Int
    var tr: Int
    var ph: String
    var cu: String
    var b: Double
    var f: String
    var pe: [String]
    var p: [P]
    var e: [E]
    var s: [S]
    var sn: String?
    var tz: String?
    var sd: String?
    var po: V?

    init(_ invite: TripInvite) {
        let t = invite.trip
        i = t.id; n = t.name; pl = t.place; k = t.kind.rawValue; st = t.start; dc = t.dayCount
        tr = t.travellers; ph = t.photo.rawValue; cu = t.currency; b = t.budgetLimit; f = invite.from
        pe = t.companions.map(\.name)
        p = t.plans.map { P(d: $0.day, t: $0.time, n: $0.title, m: $0.meta.isEmpty ? nil : $0.meta, c: $0.category.rawValue,
                            x: $0.cost > 0 ? $0.cost : nil, o: $0.notes.isEmpty ? nil : $0.notes) }
        e = t.expenses.map { E(n: $0.title, a: $0.amount, c: $0.category.rawValue, d: $0.day, p: $0.paidBy, s: $0.splitWith) }
        s = t.stages.map { S(d: $0.day, n: $0.title, m: $0.meta.isEmpty ? nil : $0.meta, k: $0.km, u: $0.ascent, h: $0.altitude) }
        sn = t.stayName; tz = t.timeZoneID; sd = t.startDayKey
        po = t.poll.map { poll in V(q: poll.question, o: poll.options.map { O(i: $0.id, t: $0.title, c: $0.votes) }, b: poll.votesBy) }
    }

    var invite: TripInvite? {
        guard let kind = TripKind(rawValue: k) else { return nil }
        let palette: [UInt32] = [0xC77A12, 0x2E8B4A, 0x7A2FA0, 0x127C8C, 0xC0392B, 0x4636E8]
        var trip = Trip(name: n, place: pl, kind: kind, start: st, dayCount: dc, travellers: tr,
                        photo: Photo(rawValue: ph) ?? kind.defaultPhoto, currency: cu, budgetLimit: b)
        trip.id = i; trip.timeZoneID = tz; trip.startDayKey = sd
        trip.companions = pe.enumerated().map { Person(name: $1, color: palette[$0 % palette.count]) }
        trip.plans = p.map { Plan(day: $0.d, time: $0.t, title: $0.n, meta: $0.m ?? "", category: PlanCategory(rawValue: $0.c) ?? .sight,
                                  cost: $0.x ?? 0, action: PlanCategory(rawValue: $0.c) == .stay ? "Map" : nil, notes: $0.o ?? "") }
        trip.expenses = e.map { Expense(title: $0.n, category: BudgetCategory(rawValue: $0.c) ?? .other, amount: $0.a, day: $0.d, paidBy: $0.p, splitWith: $0.s) }
        trip.stages = s.map { Stage(day: $0.d, title: $0.n, meta: $0.m ?? "", km: $0.k, ascent: $0.u, altitude: $0.h) }
        trip.stayName = sn
        trip.poll = po.map { poll in Poll(question: poll.q, options: poll.o.map { PollOption(id: $0.i, title: $0.t, votes: max(0, $0.c)) }, votesBy: poll.b) }
        if kind.isAdventure {
            trip.adventure = Adventure()
            trip.gear = PackingSuggestions.gear(for: kind)
        }
        return TripInvite(trip: trip, from: f)
    }
}
