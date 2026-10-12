import Foundation

/// Demo content for the sync self-test and previews: Lisbon and Porto, the
/// Tour du Mont Blanc, the Amalfi Coast with friends and Gran Paradiso, plus
/// one past road trip. Dates are relative to today so countdowns stay
/// meaningful. Nothing here reaches a real account.
enum SampleData {
    static func day(_ offset: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: offset, to: Calendar.current.startOfDay(for: .now)) ?? .now
    }

    struct Seed {
        var trips: [Trip]
        var wardrobe: [WardrobeItem]
        var profile: Profile
    }

    static func make() -> Seed {
        let wardrobe = makeWardrobe().map { item in
            var item = item
            item.isSample = true
            return item
        }
        return Seed(
            trips: [lisbon(wardrobe), montBlanc(), amalfi(), granParadiso(), pacificCoast()].map { trip in
                var trip = trip
                trip.isSample = true
                return trip
            },
            wardrobe: wardrobe,
            profile: Profile()
        )
    }

    // MARK: Wardrobe

    static func makeWardrobe() -> [WardrobeItem] {
        [
            WardrobeItem(name: "Linen overshirt", category: .tops, color: 0xE8DCC4, worn: 3, grams: 320),
            WardrobeItem(name: "Dark chinos", category: .bottoms, color: 0x3B4252, worn: 2, grams: 480),
            WardrobeItem(name: "Slip dress", category: .dresses, color: 0xB5484B, worn: 1, grams: 220),
            WardrobeItem(name: "White sneakers", category: .shoes, color: 0xF4F4F2, worn: 5, grams: 700),
            WardrobeItem(name: "White tee", category: .tops, color: 0xFBFBF9, worn: 4, grams: 160),
            WardrobeItem(name: "Denim", category: .bottoms, color: 0x5877A6, worn: 2, grams: 650),
            WardrobeItem(name: "Sage knit", category: .layers, color: 0x9CAE8C, worn: 1, grams: 380),
            WardrobeItem(name: "Camel shorts", category: .bottoms, color: 0xC9A27A, worn: 1, grams: 260),
            WardrobeItem(name: "Rain shell", category: .layers, color: 0x2A2A2E, worn: 0, grams: 300),
            WardrobeItem(name: "Striped shirt", category: .tops, color: 0x7C8FA8, worn: 2, grams: 240),
            WardrobeItem(name: "Leather sandals", category: .shoes, color: 0x8A5A3C, worn: 3, grams: 420),
            WardrobeItem(name: "Wool scarf", category: .accessories, color: 0xA66A5A, worn: 1, grams: 150),
            WardrobeItem(name: "Puffer jacket", category: .layers, color: 0x2F3B55, worn: 2, grams: 550),
            WardrobeItem(name: "Walking boots", category: .shoes, color: 0x5A4632, worn: 4, grams: 900),
        ]
    }

    // MARK: Lisbon and Porto (city)

    /// A week in Portugal: four nights in Lisbon, a day in Sintra, then the
    /// train north to Porto. Times are suggestions.
    static func lisbon(_ wardrobe: [WardrobeItem]) -> Trip {
        func w(_ name: String) -> UUID { wardrobe.first { $0.name == name }!.id }
        let capsule = ["Linen overshirt", "Sage knit", "Rain shell", "Denim", "Dark chinos", "White tee", "Striped shirt", "White sneakers", "Leather sandals"].map(w)

        let plans: [Plan] = [
            // Day 1: arrive
            Plan(day: 0, time: "11:00", title: "Land at Lisbon Airport", meta: "Metro to Baixa-Chiado · 25 min", category: .transit),
            Plan(day: 0, time: "14:00", title: "Check in, Casa do Chiado", meta: "Chiado · 4 nights · breakfast", category: .stay, action: "Map"),
            Plan(day: 0, time: "18:30", title: "Miradouro de Santa Catarina", meta: "Sunset over the river", category: .evening, walkKm: 2),
            // Day 2: Alfama
            Plan(day: 1, time: "09:30", title: "Tram 28 to Graça", meta: "Board early to get a seat", category: .transit, cost: 3),
            Plan(day: 1, time: "10:30", title: "São Jorge Castle", meta: "€15 · ramparts and views", category: .sight, cost: 15),
            Plan(day: 1, time: "13:00", title: "Lunch at Ramiro", meta: "Seafood · expect a queue", category: .food, cost: 35),
            Plan(day: 1, time: "20:00", title: "Fado in Alfama", meta: "Small house · book ahead", category: .evening, cost: 40, notes: "Dinner is included; arrive by 19:45."),
            // Day 3: Belém
            Plan(day: 2, time: "09:30", title: "Tram 15 to Belém", meta: "From Praça da Figueira", category: .transit, cost: 3),
            Plan(day: 2, time: "10:15", title: "Jerónimos Monastery", meta: "€12 · cloisters first", category: .sight, cost: 12),
            Plan(day: 2, time: "12:30", title: "Pastéis de Belém", meta: "Warm, with cinnamon", category: .food, cost: 6),
            Plan(day: 2, time: "15:00", title: "MAAT and the riverside walk", meta: "Back towards the bridge", category: .sight, walkKm: 4),
            // Day 4: Sintra
            Plan(day: 3, time: "08:30", title: "Train to Sintra", meta: "From Rossio · 40 min", category: .transit, cost: 5),
            Plan(day: 3, time: "10:00", title: "Pena Palace", meta: "€20 · timed ticket", category: .sight, cost: 20, notes: "Book the 10:00 slot; the bus from the station fills up."),
            Plan(day: 3, time: "14:30", title: "Quinta da Regaleira", meta: "Initiation well", category: .sight, cost: 15),
            Plan(day: 3, time: "18:00", title: "Train back to Lisbon", meta: "Rossio", category: .transit, cost: 5),
            // Day 5: to Porto
            Plan(day: 4, time: "10:00", title: "Train to Porto", meta: "Alfa Pendular · 3 h", category: .transit, cost: 35),
            Plan(day: 4, time: "14:00", title: "Check in, Ribeira guesthouse", meta: "Porto · 2 nights", category: .stay, action: "Map"),
            Plan(day: 4, time: "17:00", title: "Dom Luís I Bridge at dusk", meta: "Upper deck walk", category: .evening, walkKm: 3),
            // Day 6: Porto
            Plan(day: 5, time: "10:00", title: "Livraria Lello and Clérigos", meta: "Book the bookshop slot", category: .sight, cost: 8),
            Plan(day: 5, time: "13:00", title: "Francesinha lunch", meta: "Café Santiago", category: .food, cost: 14),
            Plan(day: 5, time: "15:30", title: "Port cellars, Vila Nova de Gaia", meta: "Tasting · 1 h", category: .activity, cost: 25),
            // Day 7: home
            Plan(day: 6, time: "11:00", title: "Metro to Porto Airport", meta: "Line E · 35 min", category: .transit, cost: 3),
        ]

        let packing: [PackItem] = [
            PackItem(name: "Linen overshirt", section: "Clothes", meta: "Worn 3 days", grams: 320, packed: true, wardrobeID: w("Linen overshirt")),
            PackItem(name: "Sage knit", section: "Clothes", meta: "Evenings by the river", grams: 380, packed: true, wardrobeID: w("Sage knit")),
            PackItem(name: "Rain shell", section: "Clothes", meta: "Porto showers", grams: 300, wardrobeID: w("Rain shell")),
            PackItem(name: "Denim", section: "Clothes", meta: "Worn 3 days", grams: 650, wardrobeID: w("Denim")),
            PackItem(name: "Dark chinos", section: "Clothes", meta: "Worn 2 days", grams: 480, packed: true, wardrobeID: w("Dark chinos")),
            PackItem(name: "White tee", section: "Clothes", meta: "Worn 2 days", grams: 160, wardrobeID: w("White tee")),
            PackItem(name: "Striped shirt", section: "Clothes", meta: "Worn 2 days", grams: 240, wardrobeID: w("Striped shirt")),
            PackItem(name: "White sneakers", section: "Clothes", meta: "Hills and cobbles", grams: 700, packed: true, wardrobeID: w("White sneakers")),
            PackItem(name: "Leather sandals", section: "Clothes", meta: "Warm afternoons", grams: 420, wardrobeID: w("Leather sandals")),
            PackItem(name: "Socks × 7", section: "Clothes", meta: "Basics", grams: 350, packed: true),
            PackItem(name: "Underwear × 7", section: "Clothes", meta: "Basics", grams: 350, packed: true),
            PackItem(name: "Passport", section: "Essentials", meta: "Documents", grams: 40, required: true),
            PackItem(name: "Rail tickets", section: "Essentials", meta: "Documents · Lisbon → Porto", grams: 0, packed: true),
            PackItem(name: "Travel adapter", section: "Essentials", meta: "Tech · type F", grams: 60),
            PackItem(name: "Phone charger", section: "Essentials", meta: "Tech", grams: 90, packed: true),
            PackItem(name: "Power bank", section: "Essentials", meta: "Tech · long days out", grams: 220),
            PackItem(name: "Sunglasses", section: "Essentials", meta: "Riverside glare", grams: 30),
            PackItem(name: "Day bag", section: "Essentials", meta: "Accessories", grams: 400),
            PackItem(name: "Toothbrush and paste", section: "Toiletries", meta: "Wash bag", grams: 120),
            PackItem(name: "Sunscreen SPF 50", section: "Toiletries", meta: "Wash bag", grams: 180),
            PackItem(name: "Lip balm", section: "Toiletries", meta: "Sea air", grams: 10),
            PackItem(name: "Blister plasters", section: "Toiletries", meta: "First aid · steep streets", grams: 20, packed: true),
        ]

        let outfits: [Outfit] = [
            Outfit(day: 0, title: "Travel day", items: [w("Sage knit"), w("Dark chinos"), w("White sneakers")]),
            Outfit(day: 1, title: "Alfama", items: [w("Linen overshirt"), w("White tee"), w("Denim"), w("White sneakers")]),
            Outfit(day: 3, title: "Sintra", items: [w("Striped shirt"), w("Dark chinos"), w("Rain shell"), w("White sneakers")]),
            Outfit(day: 5, title: "Porto", items: [w("Linen overshirt"), w("Denim"), w("Leather sandals")]),
        ]

        return Trip(
            name: "Lisbon & Porto",
            place: "Lisbon, Portugal",
            kind: .city,
            start: day(5),
            dayCount: 7,
            travellers: 2,
            photo: .lisbon,
            currency: "€",
            budgetLimit: 1_800,
            plans: plans,
            expenses: [
                Expense(title: "Casa do Chiado", meta: "4 nights · 2 adults", category: .stay, amount: 640, addedAt: .now.addingTimeInterval(-3 * 86_400)),
            ],
            packing: packing,
            capsule: capsule,
            outfits: outfits,
            stayName: "Casa do Chiado"
        )
    }

    // MARK: Tour du Mont Blanc (trek)

    static func montBlanc() -> Trip {
        let stages: [Stage] = [
            Stage(day: 1, title: "Les Houches → Les Contamines", meta: "16 km · ↑ 650 m · 6 h", km: 16, ascent: 650, altitude: 1167, hours: "6 h"),
            Stage(day: 2, title: "Les Contamines → Les Chapieux", meta: "18 km · ↑ 1,300 m · 7 h", km: 18, ascent: 1300, altitude: 1554, hours: "7 h"),
            Stage(day: 3, title: "Les Chapieux → Rifugio Elisabetta", meta: "15 km · ↑ 1,000 m · 6 h", km: 15, ascent: 1000, altitude: 2195, hours: "6 h"),
            Stage(day: 4, title: "Elisabetta → Courmayeur", meta: "18 km · ↓ 1,000 m · 6 h", km: 18, ascent: 300, altitude: 1224, hours: "6 h"),
            Stage(day: 5, title: "Courmayeur", meta: "Rest day · Val Ferret walk", km: 6, ascent: 300, altitude: 1224, hours: "3 h"),
            Stage(day: 6, title: "Courmayeur → Rifugio Bonatti", meta: "12 km · ↑ 860 m · 5 h", km: 12, ascent: 860, altitude: 2025, hours: "5 h"),
            Stage(day: 7, title: "Bonatti → La Fouly", meta: "20 km · ↑ 750 m · 7 h", km: 20, ascent: 750, altitude: 1610, hours: "7 h"),
            Stage(day: 8, title: "La Fouly → Champex", meta: "15 km · ↑ 400 m · 5 h", km: 15, ascent: 400, altitude: 1466, hours: "5 h"),
            Stage(day: 9, title: "Champex → Trient", meta: "16 km · ↑ 1,100 m · 7 h", km: 16, ascent: 1100, altitude: 1300, hours: "7 h"),
            Stage(day: 10, title: "Trient → Tré-le-Champ", meta: "11 km · ↑ 1,000 m · 6 h", km: 11, ascent: 1000, altitude: 1417, hours: "6 h"),
            Stage(day: 11, title: "Tré-le-Champ → Les Houches", meta: "18 km · ↑ 900 m · 7 h", km: 18, ascent: 900, altitude: 1008, hours: "7 h"),
        ]

        let gear: [GearItem] = [
            GearItem(name: "Light down jacket", group: .layers, grams: 420, status: .own, packed: true),
            GearItem(name: "Merino base layers", group: .layers, grams: 420, status: .own, packed: true),
            GearItem(name: "Fleece mid layer", group: .layers, grams: 380, status: .own, packed: true),
            GearItem(name: "Hardshell jacket", group: .layers, grams: 450, status: .own),
            GearItem(name: "Trekking trousers × 2", group: .layers, grams: 700, status: .own, packed: true),
            GearItem(name: "Light gloves", group: .layers, grams: 120, status: .need),
            GearItem(name: "Beanie and buff", group: .layers, grams: 180, status: .own, packed: true),
            GearItem(name: "Sleeping bag liner", group: .sleep, grams: 300, status: .own, packed: true, note: "Refuges provide blankets"),
            GearItem(name: "Earplugs", group: .sleep, grams: 10, status: .need),
            GearItem(name: "Hut slippers", group: .sleep, grams: 300, status: .own),
            GearItem(name: "Trekking poles", group: .traction, grams: 480, status: .own, packed: true),
            GearItem(name: "Trekking boots", group: .traction, grams: 1400, status: .own, packed: true),
            GearItem(name: "Headlamp + batteries", group: .safety, grams: 110, status: .own, packed: true),
            GearItem(name: "First aid kit", group: .safety, grams: 420, status: .own, packed: true),
            GearItem(name: "Sunglasses, category 3", group: .safety, grams: 40, status: .own, packed: true),
            GearItem(name: "Water bladder, 2 L", group: .safety, grams: 180, status: .own),
            GearItem(name: "Sunscreen SPF 50", group: .safety, grams: 150, status: .own, packed: true),
            GearItem(name: "Emergency bivvy", group: .safety, grams: 110, status: .need, required: true),
            GearItem(name: "Pack rain cover", group: .other, grams: 120, status: .rent, rentPerDay: 2),
        ]

        return Trip(
            name: "Tour du Mont Blanc",
            place: "Chamonix, France",
            kind: .trek,
            start: day(19),
            dayCount: 11,
            travellers: 1,
            photo: .himalaya,
            currency: "€",
            budgetLimit: 1_400,
            plans: stages.map {
                Plan(day: $0.day - 1, time: "07:30", title: $0.title, meta: $0.meta, category: .activity, walkKm: $0.km)
            },
            expenses: [
                Expense(title: "Train to Chamonix", meta: "Geneva · return", category: .transport, amount: 70, day: 0),
                Expense(title: "Refuges", meta: "10 nights · half board", category: .stay, amount: 720),
            ],
            stages: stages,
            gear: gear,
            porterLimitKg: 15,
            adventure: Adventure(
                permits: [
                    Permit(name: "Refuge reservations", meta: "All 10 nights confirmed", paid: true),
                ],
                guide: Guide(name: "Élodie Martin", rating: 4.9, trips: 38, tags: ["English", "French", "Mountain leader"], dayRate: 320),
                insurance: "Covered to 4,000 m",
                insuranceMeta: "Includes mountain rescue",
                training: [
                    TrainingSession(title: "Stair intervals, 45 min", meta: "Tue · 8 kg pack", done: true),
                    TrainingSession(title: "Hill loop", meta: "Sat · 16 km · ↑ 650 m", done: true),
                    TrainingSession(title: "Back-to-back long hikes", meta: "Sat–Sun · 20 km each", key: true),
                ],
                readiness: Readiness(score: 72, vo2: 44, vo2Change: 3, ascentPerWeek: 1850, ascentChange: 12, longHikeKm: 18, longHikeGoal: 20),
                checkIns: [],
                checkInReminders: true,
                nextCheckIn: "16:00",
                contacts: "Mum + Sam"
            )
        )
    }

    // MARK: Amalfi Coast (beach, shared)

    static func amalfi() -> Trip {
        Trip(
            name: "Amalfi with friends",
            place: "Positano, Italy",
            kind: .beach,
            start: day(33),
            dayCount: 4,
            travellers: 4,
            photo: .beach,
            currency: "€",
            budgetLimit: 1_600,
            plans: [
                Plan(day: 0, time: "12:00", title: "Check in, Casa Positano", meta: "Positano · 3 nights", category: .stay, action: "Map"),
                Plan(day: 0, time: "17:30", title: "Spiaggia Grande", meta: "Sunset · free", category: .evening, walkKm: 2),
                Plan(day: 1, time: "08:00", title: "Li Galli dive", meta: "2 dives · €110", category: .activity, cost: 110, action: "Go"),
                Plan(day: 1, time: "18:00", title: "Sunset sail", meta: "Positano · 2 h · €85", category: .evening, cost: 85),
                Plan(day: 2, time: "10:00", title: "Path of the Gods", meta: "Bomerano → Nocelle", category: .sight, walkKm: 8),
                Plan(day: 2, time: "20:00", title: "Dinner on the beach", meta: "Da Adolfo · €45", category: .food, cost: 45),
                Plan(day: 3, time: "11:00", title: "Ferry to Naples", meta: "Molo Beverello · 12:20", category: .transit, cost: 25),
            ],
            expenses: [
                Expense(title: "Casa Positano", meta: "Alex Rivera paid · split 4 ways", category: .stay, amount: 960,
                        paidBy: "Alex Rivera", splitWith: ["You", "Alex Rivera", "Maya Chen", "Jonas Weber"]),
                Expense(title: "Groceries and drinks", meta: "You paid · split 4 ways", category: .food, amount: 120,
                        paidBy: nil, splitWith: ["You", "Alex Rivera", "Maya Chen", "Jonas Weber"]),
            ],
            packing: [
                PackItem(name: "Swimwear × 2", section: "Clothes", meta: "Beach", grams: 200, packed: true),
                PackItem(name: "Camel shorts", section: "Clothes", meta: "Worn 1 day", grams: 260),
                PackItem(name: "Leather sandals", section: "Clothes", meta: "Worn 3 days", grams: 420),
                PackItem(name: "Mask and snorkel", section: "Essentials", meta: "Dive", grams: 350),
                PackItem(name: "Dive log book", section: "Essentials", meta: "Dive · certification card", grams: 120, required: true),
                PackItem(name: "Reef-safe sunscreen", section: "Toiletries", meta: "Wash bag", grams: 180),
                PackItem(name: "Passport", section: "Essentials", meta: "Documents", grams: 40, required: true),
            ],
            companions: [
                Person(name: "Alex Rivera", color: 0xC77A12),
                Person(name: "Maya Chen", color: 0x2E8B4A),
                Person(name: "Jonas Weber", color: 0x7A2FA0),
            ],
            poll: Poll(question: "Saturday night", options: [
                PollOption(title: "Sunset sail", votes: 3),
                PollOption(title: "Dinner on the beach", votes: 1),
            ]),
            dives: [Dive(day: 1, site: "Li Galli, the wall", depthM: 18, minutes: 42)]
        )
    }

    // MARK: Gran Paradiso (climb)

    static func granParadiso() -> Trip {
        let start = day(45)
        let winds = [22, 35, 62, 70, 48, 18, 15, 26]
        let forecast = winds.enumerated().map { i, kmh in
            WindDay(date: Calendar.current.date(byAdding: .day, value: 1 + i, to: start) ?? start, kmh: kmh)
        }
        let stages: [Stage] = [
            Stage(day: 1, title: "Pont → Rifugio Vittorio Emanuele II", meta: "5 km · ↑ 760 m", km: 5, ascent: 760, altitude: 2732),
            Stage(day: 2, title: "Acclimatise", meta: "Rest day · Col del Gran Paradiso approach", km: 4, ascent: 400, altitude: 2732),
            Stage(day: 3, title: "Summit day", meta: "Gran Paradiso · 4,061 m", km: 8, ascent: 1329, altitude: 4061),
            Stage(day: 4, title: "Back to Pont", meta: "5 km · ↓ 760 m", km: 5, ascent: 0, altitude: 1960),
        ]
        return Trip(
            name: "Gran Paradiso",
            place: "Aosta Valley, Italy",
            kind: .climb,
            start: start,
            dayCount: 4,
            photo: .himalaya,
            currency: "€",
            budgetLimit: 900,
            plans: stages.map { Plan(day: $0.day - 1, time: "07:00", title: $0.title, meta: $0.meta, category: .activity, walkKm: $0.km) },
            expenses: [Expense(title: "Mountain guide", meta: "2 days · shared", category: .other, amount: 380)],
            stages: stages,
            gear: [
                GearItem(name: "Mountaineering boots", group: .traction, grams: 2100, status: .rent, rentPerDay: 12),
                GearItem(name: "Crampons", group: .traction, grams: 900, status: .rent, rentPerDay: 5),
                GearItem(name: "Harness and ice axe", group: .safety, grams: 650, status: .need, required: true),
                GearItem(name: "Helmet", group: .safety, grams: 350, status: .own, packed: true),
                GearItem(name: "Insulated jacket", group: .layers, grams: 620, status: .own, packed: true),
                GearItem(name: "Sleeping bag liner", group: .sleep, grams: 300, status: .own, packed: true),
            ],
            porterLimitKg: 15,
            adventure: Adventure(
                permits: [Permit(name: "Refuge reservation", meta: "2 nights · half board", paid: true)],
                insurance: "Covered to 4,500 m",
                insuranceMeta: "Includes helicopter rescue",
                summit: Summit(peak: "Gran Paradiso", altitude: 4061, forecast: forecast, dawnTemp: -8, leaveTime: "04:00", highCamp: 2732, turnaround: "11:00")
            )
        )
    }

    // MARK: Pacific Coast Highway (road, past)

    static func pacificCoast() -> Trip {
        Trip(
            name: "Pacific Coast drive",
            place: "Big Sur, California",
            kind: .road,
            start: day(-40),
            dayCount: 3,
            travellers: 2,
            photo: .beach,
            currency: "$",
            budgetLimit: 900,
            plans: [
                Plan(day: 0, time: "08:00", title: "Leave San Francisco", meta: "Highway 1 · 3 h to Monterey", category: .transit, cost: 60, walkKm: 0),
                Plan(day: 0, time: "14:00", title: "Check in, Big Sur lodge", meta: "Big Sur · 2 nights", category: .stay),
                Plan(day: 1, time: "09:00", title: "Pfeiffer Beach", meta: "Purple sand · $15 parking", category: .activity, cost: 15, walkKm: 3),
                Plan(day: 1, time: "16:00", title: "McWay Falls", meta: "Julia Pfeiffer Burns · overlook", category: .sight, walkKm: 2),
                Plan(day: 2, time: "10:00", title: "Drive south to San Luis Obispo", meta: "3 h", category: .transit, cost: 55),
            ],
            expenses: [Expense(title: "Big Sur lodge", meta: "2 nights", category: .stay, amount: 520)],
            stages: [
                Stage(day: 1, title: "San Francisco → Big Sur", meta: "240 km · 4 h", km: 240, ascent: 0, altitude: 60, hours: "4 h"),
                Stage(day: 2, title: "Big Sur loop", meta: "50 km · 1.5 h", km: 50, ascent: 0, altitude: 60, hours: "1.5 h"),
                Stage(day: 3, title: "Big Sur → San Luis Obispo", meta: "200 km · 3 h", km: 200, ascent: 0, altitude: 70, hours: "3 h"),
            ],
            stops: [
                Stop(day: 0, name: "Half Moon Bay bakery", meta: "Breakfast · on the way", category: .food, done: true),
                Stop(day: 0, name: "Fuel, Monterey", meta: "Fuel · last big town", category: .transit, done: true),
                Stop(day: 1, name: "Bixby Bridge", meta: "Viewpoint · sunset", category: .sight, done: true),
                Stop(day: 2, name: "Elephant seals, Piedras Blancas", meta: "20 min stop", category: .sight, done: true),
            ],
            stayName: "Big Sur lodge",
            stayRating: 4
        )
    }
}
