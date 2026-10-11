import Foundation

/// First-launch content: Sikkim & Darjeeling (a real tour plan), Everest Base
/// Camp, Goa with friends and Island Peak, plus one past road trip. Dates are
/// relative to today so countdowns stay meaningful.
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
            trips: [sikkim(wardrobe), everest(), goa(), islandPeak(), coorg()].map { trip in
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

    // MARK: Sikkim & Darjeeling (city)

    /// A real 6-night package tour (Your Tours & Travels, Siliguri): Gangtok,
    /// North Sikkim and Darjeeling by point-to-point cab. Times are suggested;
    /// the tour plan itself only gives the order of each day.
    static func sikkim(_ wardrobe: [WardrobeItem]) -> Trip {
        func w(_ name: String) -> UUID { wardrobe.first { $0.name == name }!.id }
        let capsule = ["Puffer jacket", "Sage knit", "Rain shell", "Wool scarf", "Denim", "Dark chinos", "White tee", "Striped shirt", "Walking boots"].map(w)

        let plans: [Plan] = [
            // Day 1: transfer to Gangtok
            Plan(day: 0, time: "11:00", title: "Pickup, Bagdogra or NJP", meta: "Innova or Xylo · point to point", category: .transit, notes: "Non-AC cab, not at disposal: it covers the listed transfers only."),
            Plan(day: 0, time: "12:00", title: "Drive to Gangtok", meta: "Capital of Sikkim · 5,480 ft", category: .transit),
            Plan(day: 0, time: "16:30", title: "Check in, Newa Tiara Regency", meta: "Gangtok · 2 nights · breakfast", category: .stay, action: "Map"),
            Plan(day: 0, time: "18:30", title: "Evening on M G Road", meta: "Gangtok · free evening", category: .evening),
            // Day 2: Changu Lake, Baba Mandir, Nathula
            Plan(day: 1, time: "07:00", title: "Drive to Changu Lake", meta: "48 km · about 2 h", category: .transit),
            Plan(day: 1, time: "09:00", title: "Tsomgo (Changu) Lake", meta: "Holy lake · 12,310 ft", category: .sight),
            Plan(day: 1, time: "10:30", title: "Baba Mandir", meta: "Shrine · on the Nathula road", category: .sight),
            Plan(day: 1, time: "12:00", title: "Nathula Pass (optional)", meta: "₹4,000 per vehicle · closed Mondays", category: .activity, cost: 4_000, notes: "Depends on the permit. Sikkim Govt. may club groups into shared vehicles."),
            // Day 3: Gangtok to Lachung
            Plan(day: 2, time: "08:30", title: "Drive to Lachung", meta: "North Sikkim · arrive early evening", category: .transit),
            Plan(day: 2, time: "10:30", title: "Seven Sisters Waterfall", meta: "On the way", category: .sight),
            Plan(day: 2, time: "13:00", title: "Naga Waterfall", meta: "On the way", category: .sight),
            Plan(day: 2, time: "14:30", title: "Singhik View Point", meta: "Kanchenjunga views", category: .sight),
            Plan(day: 2, time: "17:30", title: "Check in, Lachung Pride", meta: "Lachung · 2 nights · all meals", category: .stay, action: "Map"),
            // Day 4: Yumthang Valley and Zero Point
            Plan(day: 3, time: "07:30", title: "Yumthang Valley", meta: "24 km · Valley of Flowers", category: .sight),
            Plan(day: 3, time: "10:00", title: "Zero Point (optional)", meta: "15,300 ft · ₹4,000 per vehicle", category: .activity, cost: 4_000, notes: "About 2 h and 25 km past Yumthang, where the civilian road ends."),
            Plan(day: 3, time: "14:00", title: "Lunch at Lachung Pride", meta: "Included", category: .food),
            // Day 5: Lachung to Gangtok
            Plan(day: 4, time: "08:30", title: "Drive back to Gangtok", meta: "Via Mangan", category: .transit),
            Plan(day: 4, time: "10:00", title: "Naga Waterfall", meta: "Multi-tiered falls near Lachung", category: .sight),
            Plan(day: 4, time: "12:30", title: "Bhim Nala Falls", meta: "Amitabh Bachchan Falls · Mangan", category: .sight),
            Plan(day: 4, time: "17:30", title: "Overnight in Gangtok", meta: "Hotel not in the package", category: .stay, notes: "The package books Gangtok for 2 nights only; this third night needs a room."),
            // Day 6: Darjeeling
            Plan(day: 5, time: "08:30", title: "Drive to Darjeeling", meta: "Gangtok → Darjeeling", category: .transit),
            Plan(day: 5, time: "13:00", title: "Check in, Himalayan Retreat", meta: "Darjeeling · 1 night · breakfast", category: .stay, action: "Map"),
            Plan(day: 5, time: "14:00", title: "Batasia Loop and War Memorial", meta: "Darjeeling local sightseeing", category: .sight),
            Plan(day: 5, time: "15:00", title: "Mountaineering Institute and zoo", meta: "HMI · Padmaja Naidu Zoo · closed Thursdays", category: .sight),
            Plan(day: 5, time: "16:30", title: "Peace Pagoda and Japanese Temple", meta: "Darjeeling", category: .sight),
            Plan(day: 5, time: "17:30", title: "Tenzing and Gombu Rock, ropeway", meta: "Tea garden on the way", category: .sight),
            // Day 7: to Bagdogra
            Plan(day: 6, time: "04:00", title: "Tiger Hill sunrise (optional)", meta: "Early morning", category: .sight, notes: "Depends on getting early-morning tickets."),
            Plan(day: 6, time: "09:30", title: "Drive to Bagdogra Airport", meta: "Check out after breakfast", category: .transit),
        ]

        let packing: [PackItem] = [
            PackItem(name: "Puffer jacket", section: "Clothes", meta: "Zero Point is 15,300 ft", grams: 550, packed: true, wardrobeID: w("Puffer jacket")),
            PackItem(name: "Sage knit", section: "Clothes", meta: "Worn 3 days", grams: 380, packed: true, wardrobeID: w("Sage knit")),
            PackItem(name: "Rain shell", section: "Clothes", meta: "Mountain showers", grams: 300, wardrobeID: w("Rain shell")),
            PackItem(name: "Wool scarf", section: "Clothes", meta: "Lachung evenings", grams: 150, wardrobeID: w("Wool scarf")),
            PackItem(name: "Denim", section: "Clothes", meta: "Worn 3 days", grams: 650, wardrobeID: w("Denim")),
            PackItem(name: "Dark chinos", section: "Clothes", meta: "Worn 2 days", grams: 480, packed: true, wardrobeID: w("Dark chinos")),
            PackItem(name: "White tee", section: "Clothes", meta: "Worn 2 days", grams: 160, wardrobeID: w("White tee")),
            PackItem(name: "Striped shirt", section: "Clothes", meta: "Worn 2 days", grams: 240, wardrobeID: w("Striped shirt")),
            PackItem(name: "Walking boots", section: "Clothes", meta: "Worn 7 days", grams: 900, packed: true, wardrobeID: w("Walking boots")),
            PackItem(name: "Thermals", section: "Clothes", meta: "Lachung and Zero Point", grams: 300),
            PackItem(name: "Gloves and beanie", section: "Clothes", meta: "Cold at altitude", grams: 180),
            PackItem(name: "Socks × 7", section: "Clothes", meta: "Basics", grams: 350, packed: true),
            PackItem(name: "Underwear × 7", section: "Clothes", meta: "Basics", grams: 350, packed: true),
            PackItem(name: "Original photo ID", section: "Essentials", meta: "Voter ID, passport or licence · not Aadhaar or PAN", grams: 40, required: true),
            PackItem(name: "Passport photos × 4", section: "Essentials", meta: "Recent, colour · for permits", grams: 10, required: true),
            PackItem(name: "Tour voucher", section: "Essentials", meta: "Documents · Your Tours & Travels", grams: 0, packed: true),
            PackItem(name: "Cash", section: "Essentials", meta: "Entry tickets, parking, heaters", grams: 10),
            PackItem(name: "Phone charger", section: "Essentials", meta: "Tech", grams: 90, packed: true),
            PackItem(name: "Power bank", section: "Essentials", meta: "Tech · long drives", grams: 220),
            PackItem(name: "Sunglasses", section: "Essentials", meta: "Snow glare", grams: 30),
            PackItem(name: "Day bag", section: "Essentials", meta: "Accessories", grams: 400),
            PackItem(name: "Toothbrush and paste", section: "Toiletries", meta: "Wash bag", grams: 120),
            PackItem(name: "Sunscreen SPF 50", section: "Toiletries", meta: "Wash bag", grams: 180),
            PackItem(name: "Lip balm", section: "Toiletries", meta: "Dry, cold air", grams: 10),
            PackItem(name: "Moisturiser", section: "Toiletries", meta: "Wash bag", grams: 80),
            PackItem(name: "Travel sickness tablets", section: "Toiletries", meta: "First aid · mountain roads", grams: 20, packed: true),
        ]

        let outfits: [Outfit] = [
            Outfit(day: 0, title: "Travel day", items: [w("Sage knit"), w("Dark chinos"), w("Walking boots")]),
            Outfit(day: 1, title: "Changu Lake", items: [w("Puffer jacket"), w("Sage knit"), w("Denim"), w("Wool scarf")]),
            Outfit(day: 3, title: "Zero Point", items: [w("Puffer jacket"), w("Sage knit"), w("Denim"), w("Walking boots"), w("Wool scarf")]),
            Outfit(day: 5, title: "Darjeeling sights", items: [w("Striped shirt"), w("Dark chinos"), w("Rain shell")]),
        ]

        return Trip(
            name: "Sikkim & Darjeeling",
            place: "Gangtok, Sikkim",
            kind: .city,
            start: day(5),
            dayCount: 7,
            travellers: 6,
            photo: .himalaya,
            currency: "₹",
            budgetLimit: 80_000,
            plans: plans,
            expenses: [
                Expense(title: "Tour package", meta: "Your Tours & Travels · 6 adults · 3 rooms", category: .stay, amount: 66_000, addedAt: .now.addingTimeInterval(-3 * 86_400)),
            ],
            packing: packing,
            capsule: capsule,
            outfits: outfits,
            stayName: "Newa Tiara Regency"
        )
    }

    // MARK: Everest Base Camp (trek)

    static func everest() -> Trip {
        let stages: [Stage] = [
            Stage(day: 1, title: "Lukla → Phakding", meta: "8 km · ↓ 200 m · 3–4 h", km: 8, ascent: 0, altitude: 2610, hours: "3–4 h"),
            Stage(day: 2, title: "Phakding → Namche Bazaar", meta: "10.4 km · ↑ 830 m · 6 h", km: 10.4, ascent: 830, altitude: 3440, hours: "6 h"),
            Stage(day: 3, title: "Namche Bazaar", meta: "Rest day · hike to 3,880 m", km: 5, ascent: 440, altitude: 3440, hours: "3 h"),
            Stage(day: 4, title: "Namche → Tengboche", meta: "9.2 km · ↑ 820 m · 5–6 h", km: 9.2, ascent: 820, altitude: 3860, hours: "5–6 h"),
            Stage(day: 5, title: "Tengboche → Dingboche", meta: "11 km · ↑ 550 m · 5 h", km: 11, ascent: 550, altitude: 4410, hours: "5 h"),
            Stage(day: 6, title: "Dingboche", meta: "Rest day · Nangkartshang 5,083 m", km: 6, ascent: 670, altitude: 4410, hours: "4 h"),
            Stage(day: 7, title: "Dingboche → Lobuche", meta: "8.5 km · ↑ 530 m · 5 h", km: 8.5, ascent: 530, altitude: 4940, hours: "5 h"),
            Stage(day: 8, title: "Lobuche → Gorak Shep", meta: "4.5 km · ↑ 224 m · 3 h", km: 4.5, ascent: 224, altitude: 5164, hours: "3 h"),
            Stage(day: 9, title: "Everest Base Camp", meta: "7 km · ↑ 200 m · 5,364 m", km: 7, ascent: 200, altitude: 5364, hours: "5 h"),
            Stage(day: 10, title: "Gorak Shep → Pheriche", meta: "14 km · ↓ 800 m · 6 h", km: 14, ascent: 0, altitude: 4371, hours: "6 h"),
            Stage(day: 11, title: "Pheriche → Namche", meta: "20 km · ↓ 930 m · 7 h", km: 20, ascent: 0, altitude: 3440, hours: "7 h"),
            Stage(day: 12, title: "Namche → Lukla", meta: "18 km · ↓ 580 m · 7 h", km: 18, ascent: 0, altitude: 2860, hours: "7 h"),
        ]

        let gear: [GearItem] = [
            GearItem(name: "Down jacket, 800 fill", group: .layers, grams: 620, status: .own, packed: true),
            GearItem(name: "Merino base layers", group: .layers, grams: 420, status: .own, packed: true),
            GearItem(name: "Fleece mid layer", group: .layers, grams: 380, status: .own, packed: true),
            GearItem(name: "Hardshell jacket", group: .layers, grams: 450, status: .own),
            GearItem(name: "Trekking trousers × 2", group: .layers, grams: 700, status: .own, packed: true),
            GearItem(name: "Warm gloves and liners", group: .layers, grams: 250, status: .need),
            GearItem(name: "Beanie and buff", group: .layers, grams: 180, status: .own, packed: true),
            GearItem(name: "Sleeping bag, −20°C", group: .sleep, grams: 1600, status: .need, rentPerDay: 180),
            GearItem(name: "Sleeping bag liner", group: .sleep, grams: 300, status: .own, packed: true),
            GearItem(name: "Down booties", group: .sleep, grams: 250, status: .need),
            GearItem(name: "Thermal leggings", group: .sleep, grams: 250, status: .own, packed: true),
            GearItem(name: "Insulated bottle", group: .sleep, grams: 400, status: .own),
            GearItem(name: "Pillow, inflatable", group: .sleep, grams: 90, status: .own, packed: true),
            GearItem(name: "Hut slippers", group: .sleep, grams: 610, status: .own),
            GearItem(name: "Microspikes", group: .traction, grams: 390, status: .need, rentPerDay: 90),
            GearItem(name: "Trekking poles", group: .traction, grams: 480, status: .own, packed: true),
            GearItem(name: "Diamox, 125 mg", group: .safety, grams: 30, status: .need, required: true, note: "First aid · ask a doctor"),
            GearItem(name: "Headlamp + batteries", group: .safety, grams: 110, status: .own, packed: true),
            GearItem(name: "Water purifier tablets", group: .safety, grams: 60, status: .need),
            GearItem(name: "First aid kit", group: .safety, grams: 420, status: .own, packed: true),
            GearItem(name: "Sunglasses, category 4", group: .safety, grams: 40, status: .own, packed: true),
            GearItem(name: "Satellite messenger", group: .safety, grams: 110, status: .own, packed: true),
            GearItem(name: "Water bladder, 2 L", group: .safety, grams: 180, status: .own),
            GearItem(name: "Sunscreen SPF 50", group: .safety, grams: 150, status: .own, packed: true),
            GearItem(name: "Trekking boots", group: .traction, grams: 1400, status: .own, packed: true),
            GearItem(name: "Pack rain cover", group: .other, grams: 120, status: .rent, rentPerDay: 20),
        ]

        return Trip(
            name: "Everest Base Camp",
            place: "Khumbu, Nepal",
            kind: .trek,
            start: day(19),
            dayCount: 12,
            travellers: 1,
            photo: .himalaya,
            currency: "₹",
            budgetLimit: 120_000,
            plans: stages.map {
                Plan(day: $0.day - 1, time: "07:30", title: $0.title, meta: $0.meta, category: .activity, walkKm: $0.km)
            },
            expenses: [
                Expense(title: "Flights KTM ⇄ Lukla", meta: "Tara Air · 2 legs", category: .transport, amount: 38_000, day: 0),
                Expense(title: "Tea houses", meta: "11 nights · half board", category: .stay, amount: 26_400),
                Expense(title: "Sagarmatha permit", meta: "NPR 3,000", category: .other, amount: 1_900),
            ],
            stages: stages,
            gear: gear,
            porterLimitKg: 15,
            adventure: Adventure(
                permits: [
                    Permit(name: "Sagarmatha National Park", meta: "NPR 3,000 · paid", paid: true),
                    Permit(name: "Khumbu Pasang Lhamu", meta: "Buy in Lukla · NPR 2,000", paid: false),
                ],
                guide: Guide(name: "Pemba Sherpa", rating: 4.9, trips: 41, tags: ["English", "Wilderness first aid"], dayRate: 30),
                insurance: "Covered to 6,000 m",
                insuranceMeta: "Includes helicopter rescue",
                training: [
                    TrainingSession(title: "Stair intervals, 45 min", meta: "Tue · 8 kg pack", done: true),
                    TrainingSession(title: "Nandi Hills loop", meta: "Sat · 16 km · ↑ 650 m", done: true),
                    TrainingSession(title: "Back-to-back long hikes", meta: "Sat–Sun · 20 km each", key: true),
                ],
                readiness: Readiness(score: 72, vo2: 44, vo2Change: 3, ascentPerWeek: 1850, ascentChange: 12, longHikeKm: 18, longHikeGoal: 20),
                checkIns: [],
                checkInReminders: true,
                nextCheckIn: "16:00",
                contacts: "Mum + Rahul"
            )
        )
    }

    // MARK: Goa (beach, shared)

    static func goa() -> Trip {
        Trip(
            name: "Goa with friends",
            place: "Panaji, Goa",
            kind: .beach,
            start: day(33),
            dayCount: 4,
            travellers: 4,
            photo: .beach,
            currency: "₹",
            budgetLimit: 50_000,
            plans: [
                Plan(day: 0, time: "12:00", title: "Check in, Casa Anjuna", meta: "Anjuna · 3 nights", category: .stay, action: "Map"),
                Plan(day: 0, time: "17:30", title: "Vagator beach", meta: "Sunset · free", category: .evening, walkKm: 2),
                Plan(day: 1, time: "08:00", title: "Grande Island dive", meta: "2 dives · ₹4,500", category: .activity, cost: 4_500, action: "Go"),
                Plan(day: 1, time: "18:00", title: "Sunset cruise, Mandovi", meta: "Panaji · 2 h · ₹1,500", category: .evening, cost: 1_500),
                Plan(day: 2, time: "10:00", title: "Fontainhas walk", meta: "Panaji · old quarter", category: .sight, walkKm: 3),
                Plan(day: 2, time: "20:00", title: "Beach shack dinner", meta: "Baga · ₹1,800", category: .food, cost: 1_800),
                Plan(day: 3, time: "11:00", title: "Train home", meta: "Madgaon · 12:20", category: .transit, cost: 1_200),
            ],
            expenses: [
                Expense(title: "Casa Anjuna", meta: "Rahul Kumar paid · split 4 ways", category: .stay, amount: 8_000,
                        paidBy: "Rahul Kumar", splitWith: ["You", "Rahul Kumar", "Meera Shah", "Jay Desai"]),
                Expense(title: "Groceries and drinks", meta: "You paid · split 4 ways", category: .food, amount: 2_400,
                        paidBy: nil, splitWith: ["You", "Rahul Kumar", "Meera Shah", "Jay Desai"]),
            ],
            packing: [
                PackItem(name: "Swimwear × 2", section: "Clothes", meta: "Beach", grams: 200, packed: true),
                PackItem(name: "Camel shorts", section: "Clothes", meta: "Worn 1 day", grams: 260),
                PackItem(name: "Leather sandals", section: "Clothes", meta: "Worn 3 days", grams: 420),
                PackItem(name: "Mask and snorkel", section: "Essentials", meta: "Dive", grams: 350),
                PackItem(name: "Dive log book", section: "Essentials", meta: "Dive · certification card", grams: 120, required: true),
                PackItem(name: "Reef-safe sunscreen", section: "Toiletries", meta: "Wash bag", grams: 180),
                PackItem(name: "ID card", section: "Essentials", meta: "Documents", grams: 10, required: true),
            ],
            companions: [
                Person(name: "Rahul Kumar", color: 0xC77A12),
                Person(name: "Meera Shah", color: 0x2E8B4A),
                Person(name: "Jay Desai", color: 0x7A2FA0),
            ],
            poll: Poll(question: "Saturday night", options: [
                PollOption(title: "Sunset cruise", votes: 3),
                PollOption(title: "Beach shack dinner", votes: 1),
            ]),
            dives: [Dive(day: 1, site: "Grande Island, Suzy's wreck", depthM: 12, minutes: 42)]
        )
    }

    // MARK: Island Peak (climb)

    static func islandPeak() -> Trip {
        let start = day(45)
        let winds = [22, 35, 62, 70, 48, 18, 15, 26]
        let forecast = winds.enumerated().map { i, kmh in
            WindDay(date: Calendar.current.date(byAdding: .day, value: 10 + i, to: start) ?? start, kmh: kmh)
        }
        let stages: [Stage] = [
            Stage(day: 1, title: "Lukla → Phakding", meta: "8 km · 3–4 h", km: 8, ascent: 0, altitude: 2610),
            Stage(day: 2, title: "Phakding → Namche Bazaar", meta: "10.4 km · ↑ 830 m", km: 10.4, ascent: 830, altitude: 3440),
            Stage(day: 4, title: "Namche → Tengboche", meta: "9.2 km · ↑ 820 m", km: 9.2, ascent: 820, altitude: 3860),
            Stage(day: 6, title: "Tengboche → Dingboche", meta: "11 km · ↑ 550 m", km: 11, ascent: 550, altitude: 4410),
            Stage(day: 9, title: "Dingboche → Chhukung", meta: "5 km · ↑ 320 m", km: 5, ascent: 320, altitude: 4730),
            Stage(day: 11, title: "Chhukung → Base camp", meta: "6 km · ↑ 357 m", km: 6, ascent: 357, altitude: 5087),
            Stage(day: 12, title: "Base camp → High camp", meta: "3 km · ↑ 513 m", km: 3, ascent: 513, altitude: 5600),
            Stage(day: 13, title: "Summit day", meta: "Island Peak · 6,189 m", km: 6, ascent: 589, altitude: 6189),
        ]
        return Trip(
            name: "Island Peak",
            place: "Imja Tse, Nepal",
            kind: .climb,
            start: start,
            dayCount: 18,
            photo: .himalaya,
            currency: "$",
            budgetLimit: 4200,
            plans: stages.map { Plan(day: $0.day - 1, time: "07:00", title: $0.title, meta: $0.meta, category: .activity, walkKm: $0.km) },
            expenses: [Expense(title: "Climbing permit", meta: "NMA · spring season", category: .other, amount: 250)],
            stages: stages,
            gear: [
                GearItem(name: "Mountaineering boots", group: .traction, grams: 2100, status: .rent, rentPerDay: 12),
                GearItem(name: "Crampons", group: .traction, grams: 900, status: .rent, rentPerDay: 5),
                GearItem(name: "Harness + ascender", group: .safety, grams: 650, status: .need, required: true),
                GearItem(name: "Helmet", group: .safety, grams: 350, status: .own, packed: true),
                GearItem(name: "Expedition down suit", group: .layers, grams: 1300, status: .need),
                GearItem(name: "Sleeping bag, −30°C", group: .sleep, grams: 1900, status: .rent, rentPerDay: 8),
            ],
            porterLimitKg: 15,
            adventure: Adventure(
                permits: [Permit(name: "Island Peak climbing permit", meta: "$250 · spring", paid: true)],
                insurance: "Covered to 6,500 m",
                insuranceMeta: "Includes helicopter rescue",
                summit: Summit(peak: "Island Peak", altitude: 6189, forecast: forecast, dawnTemp: -18, leaveTime: "02:00", highCamp: 5600, turnaround: "11:00")
            )
        )
    }

    // MARK: Coorg (road, past)

    static func coorg() -> Trip {
        Trip(
            name: "Coorg coffee trail",
            place: "Kodagu, Karnataka",
            kind: .road,
            start: day(-40),
            dayCount: 3,
            travellers: 2,
            photo: .himalaya,
            currency: "₹",
            budgetLimit: 18_000,
            plans: [
                Plan(day: 0, time: "06:00", title: "Leave Bangalore", meta: "NH 275 · 5 h", category: .transit, cost: 2400, walkKm: 0),
                Plan(day: 0, time: "14:00", title: "Check in, estate stay", meta: "Madikeri · 2 nights", category: .stay),
                Plan(day: 1, time: "09:00", title: "Coffee estate walk", meta: "Guided · 2 h", category: .activity, cost: 900, walkKm: 5),
                Plan(day: 1, time: "16:00", title: "Abbey Falls", meta: "Madikeri · free", category: .sight, walkKm: 2),
                Plan(day: 2, time: "10:00", title: "Drive home via Mysore", meta: "6 h", category: .transit, cost: 2100),
            ],
            expenses: [Expense(title: "Coffee estate stay", meta: "2 nights", category: .stay, amount: 11_200)],
            stages: [
                Stage(day: 1, title: "Bangalore → Madikeri", meta: "265 km · 5 h", km: 265, ascent: 0, altitude: 1170, hours: "5 h"),
                Stage(day: 2, title: "Madikeri loop", meta: "48 km · 1.5 h", km: 48, ascent: 0, altitude: 1170, hours: "1.5 h"),
                Stage(day: 3, title: "Madikeri → Bangalore", meta: "280 km · 6 h", km: 280, ascent: 0, altitude: 920, hours: "6 h"),
            ],
            stops: [
                Stop(day: 0, name: "Kamat Lokaruchi", meta: "Breakfast · Ramanagara", category: .food, done: true),
                Stop(day: 0, name: "Fuel, Kushalnagar", meta: "Fuel · 1 h from stay", category: .transit, done: true),
                Stop(day: 1, name: "Raja's Seat", meta: "Viewpoint · sunset", category: .sight, done: true),
                Stop(day: 2, name: "Namdroling Monastery", meta: "Bylakuppe · 1 h stop", category: .sight, done: true),
            ],
            stayName: "Coffee estate stay",
            stayRating: 4
        )
    }
}
