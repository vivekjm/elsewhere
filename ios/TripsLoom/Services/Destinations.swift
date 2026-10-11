import Foundation

/// Well-known highlights for popular destinations, so offline drafts name
/// real places ("Houseboat on Vembanad Lake") instead of "Main museum".
/// Days are in a sensible travel order; the drafter takes as many as fit.
struct Destination {
    var keys: [String]
    var place: String
    var kind: TripKind
    var photo: Photo
    /// Rough cost per person per day, mid-range, in `currency`.
    var perDay: Double
    var currency: String
    var days: [DraftDay]

    static func match(_ prompt: String) -> Destination? {
        let text = prompt.lowercased()
        return all.first { dest in dest.keys.contains { PromptFacts.startsWord(text, $0) } }
    }

    private static func day(_ title: String, _ area: String, _ stops: [String]) -> DraftDay {
        DraftDay(title: title, stops: stops, area: area)
    }

    static let all: [Destination] = [
        // India
        Destination(keys: ["kerala", "kochi", "cochin", "munnar", "alleppey", "alappuzha"], place: "Kerala, India", kind: .city, photo: .beach, perDay: 4_000, currency: "₹", days: [
            day("Fort Kochi", "Fort Kochi", ["Chinese fishing nets", "Mattancherry Palace and Jew Town", "Kathakali performance"]),
            day("Drive up to Munnar", "Munnar", ["Drive to Munnar", "Check in, tea estate stay", "Sunset at a tea viewpoint"]),
            day("Tea country", "Munnar", ["Eravikulam National Park", "Tea Museum", "Tea estate walk"]),
            day("Alleppey backwaters", "Alleppey", ["Houseboat check-in", "Cruise on Vembanad Lake", "Karimeen fry dinner on board"]),
            day("Village canoe and Kumarakom", "Kumarakom", ["Village canoe ride", "Kumarakom Bird Sanctuary", "Kerala sadya lunch"]),
            day("Varkala cliffs", "Varkala", ["Drive to Varkala", "Cliff walk", "Seafood dinner on the cliff"]),
        ]),
        Destination(keys: ["goa"], place: "Goa, India", kind: .beach, photo: .beach, perDay: 3_500, currency: "₹", days: [
            day("North Goa beaches", "North Goa", ["Check in", "Vagator beach", "Sunset at Chapora Fort"]),
            day("Panaji and Fontainhas", "Panaji", ["Fontainhas Latin quarter walk", "Goan fish thali lunch", "Mandovi sunset cruise"]),
            day("Old Goa", "Old Goa", ["Basilica of Bom Jesus", "Se Cathedral", "Dinner at a Goan tavern"]),
            day("South Goa", "South Goa", ["Drive to Palolem", "Palolem beach", "Beach shack dinner"]),
            day("Dudhsagar Falls", "Dudhsagar", ["Jeep to Dudhsagar Falls", "Spice plantation lunch", "Easy evening"]),
        ]),
        Destination(keys: ["sikkim", "gangtok", "darjeeling"], place: "Gangtok, Sikkim", kind: .city, photo: .himalaya, perDay: 4_000, currency: "₹", days: [
            day("Arrive in Gangtok", "Gangtok", ["Pickup at Bagdogra or NJP", "Check in", "Evening on M G Road"]),
            day("Tsomgo Lake", "Gangtok", ["Tsomgo (Changu) Lake", "Baba Mandir", "Nathula Pass (permit)"]),
            day("North to Lachung", "Lachung", ["Drive to Lachung", "Seven Sisters Waterfall", "Check in, Lachung"]),
            day("Yumthang Valley", "Lachung", ["Yumthang Valley", "Zero Point (optional)", "Lunch in Lachung"]),
            day("Back to Gangtok", "Gangtok", ["Drive to Gangtok", "Rumtek Monastery", "Dinner in Gangtok"]),
            day("Darjeeling", "Darjeeling", ["Drive to Darjeeling", "Batasia Loop", "Himalayan Mountaineering Institute"]),
            day("Tiger Hill and home", "Darjeeling", ["Tiger Hill sunrise", "Tea garden visit", "Transfer to Bagdogra"]),
        ]),
        Destination(keys: ["jaipur", "rajasthan", "udaipur", "jodhpur", "jaisalmer"], place: "Rajasthan, India", kind: .city, photo: .aurora, perDay: 4_000, currency: "₹", days: [
            day("Jaipur old city", "Jaipur", ["Hawa Mahal", "City Palace", "Dinner at Chokhi Dhani"]),
            day("Amber and Nahargarh", "Jaipur", ["Amber Fort", "Jantar Mantar", "Sunset at Nahargarh Fort"]),
            day("On to Udaipur", "Udaipur", ["Drive or train to Udaipur", "Check in", "Dinner by Lake Pichola"]),
            day("Udaipur lakes", "Udaipur", ["City Palace, Udaipur", "Boat ride on Lake Pichola", "Bagore ki Haveli dance show"]),
            day("Jodhpur, the blue city", "Jodhpur", ["Mehrangarh Fort", "Clock Tower market", "Rooftop dinner facing the fort"]),
            day("Jaisalmer and the desert", "Jaisalmer", ["Jaisalmer Fort", "Patwon ki Haveli", "Sam sand dunes at sunset"]),
        ]),
        Destination(keys: ["ladakh", "leh"], place: "Leh, Ladakh", kind: .road, photo: .himalaya, perDay: 4_500, currency: "₹", days: [
            day("Arrive and acclimatise", "Leh", ["Fly into Leh", "Check in and rest", "Short walk to Leh market"]),
            day("Leh around town", "Leh", ["Shanti Stupa", "Leh Palace", "Sunset at Shanti Stupa"]),
            day("Monasteries", "Leh", ["Thiksey Monastery", "Hemis Monastery", "Dinner in Leh"]),
            day("Nubra via Khardung La", "Nubra", ["Drive over Khardung La", "Diskit Monastery", "Hunder sand dunes"]),
            day("Pangong Lake", "Pangong", ["Drive to Pangong Lake", "Lakeside afternoon", "Overnight at Pangong"]),
            day("Back to Leh", "Leh", ["Drive back to Leh", "Hall of Fame museum", "Farewell dinner"]),
        ]),
        Destination(keys: ["manali", "himachal", "kasol"], place: "Manali, Himachal Pradesh", kind: .city, photo: .himalaya, perDay: 3_500, currency: "₹", days: [
            day("Old Manali", "Manali", ["Check in", "Hadimba Temple", "Cafés in Old Manali"]),
            day("Solang Valley", "Solang", ["Solang Valley", "Paragliding (optional)", "Dinner on Mall Road"]),
            day("Atal Tunnel and Sissu", "Lahaul", ["Drive through Atal Tunnel", "Sissu waterfall", "Back to Manali"]),
            day("Jogini Falls hike", "Vashisht", ["Jogini Falls hike", "Vashisht hot springs", "Easy evening"]),
            day("Naggar", "Naggar", ["Naggar Castle", "Roerich Art Gallery", "Riverside dinner"]),
        ]),
        Destination(keys: ["rishikesh", "haridwar"], place: "Rishikesh, Uttarakhand", kind: .city, photo: .himalaya, perDay: 3_000, currency: "₹", days: [
            day("Rishikesh by the Ganga", "Rishikesh", ["Check in", "Laxman Jhula walk", "Ganga aarti at Parmarth Niketan"]),
            day("River day", "Rishikesh", ["White-water rafting", "Café lunch in Tapovan", "Beatles Ashram"]),
            day("Yoga and waterfalls", "Rishikesh", ["Morning yoga class", "Neer Garh waterfall", "Triveni Ghat aarti"]),
            day("Haridwar", "Haridwar", ["Drive to Haridwar", "Har Ki Pauri", "Evening aarti at Har Ki Pauri"]),
        ]),
        Destination(keys: ["varanasi", "banaras", "kashi"], place: "Varanasi, Uttar Pradesh", kind: .city, photo: .aurora, perDay: 3_000, currency: "₹", days: [
            day("The ghats", "Varanasi", ["Check in", "Walk the ghats", "Ganga aarti at Dashashwamedh Ghat"]),
            day("Sunrise on the Ganges", "Varanasi", ["Sunrise boat ride", "Kashi Vishwanath Temple", "Banarasi food walk"]),
            day("Sarnath", "Sarnath", ["Sarnath stupa and museum", "Lunch", "Assi Ghat evening"]),
        ]),
        Destination(keys: ["agra", "taj mahal"], place: "Agra, Uttar Pradesh", kind: .city, photo: .aurora, perDay: 3_500, currency: "₹", days: [
            day("Taj Mahal", "Agra", ["Taj Mahal at sunrise", "Agra Fort", "Mehtab Bagh at sunset"]),
            day("Fatehpur Sikri", "Fatehpur Sikri", ["Fatehpur Sikri", "Petha and chaat lunch", "Kinari Bazaar"]),
        ]),
        Destination(keys: ["delhi"], place: "Delhi, India", kind: .city, photo: .aurora, perDay: 4_000, currency: "₹", days: [
            day("Old Delhi", "Old Delhi", ["Jama Masjid", "Chandni Chowk food walk", "Red Fort"]),
            day("Mughal Delhi", "New Delhi", ["Humayun's Tomb", "Lodhi Garden", "India Gate at dusk"]),
            day("South Delhi", "Mehrauli", ["Qutub Minar", "Hauz Khas Village", "Dinner in Hauz Khas"]),
        ]),
        Destination(keys: ["mumbai", "bombay"], place: "Mumbai, Maharashtra", kind: .city, photo: .aurora, perDay: 5_000, currency: "₹", days: [
            day("South Mumbai", "Colaba", ["Gateway of India", "Colaba Causeway", "Sunset on Marine Drive"]),
            day("Elephanta and the Fort", "Fort", ["Ferry to Elephanta Caves", "Chhatrapati Shivaji Terminus", "Dinner in Kala Ghoda"]),
            day("Bandra", "Bandra", ["Bandstand promenade", "Bandra street art walk", "Dinner in Bandra"]),
        ]),
        Destination(keys: ["hampi"], place: "Hampi, Karnataka", kind: .city, photo: .aurora, perDay: 2_500, currency: "₹", days: [
            day("Hampi Bazaar", "Hampi", ["Virupaksha Temple", "Hampi Bazaar", "Sunset on Hemakuta Hill"]),
            day("Royal Hampi", "Hampi", ["Vittala Temple and stone chariot", "Lotus Mahal", "Coracle ride on the Tungabhadra"]),
            day("Across the river", "Hampi", ["Anegundi village", "Anjanadri Hill", "Café dinner"]),
        ]),
        Destination(keys: ["coorg", "kodagu", "madikeri"], place: "Kodagu, Karnataka", kind: .road, photo: .himalaya, perDay: 3_500, currency: "₹", days: [
            day("Into coffee country", "Madikeri", ["Drive to Madikeri", "Check in, coffee estate stay", "Sunset at Raja's Seat"]),
            day("Estates and falls", "Madikeri", ["Coffee estate walk", "Abbey Falls", "Coorgi pork dinner"]),
            day("Dubare and Bylakuppe", "Kushalnagar", ["Dubare Elephant Camp", "Namdroling Monastery", "Drive home"]),
        ]),
        Destination(keys: ["pondicherry", "puducherry", "pondy", "auroville"], place: "Puducherry, India", kind: .beach, photo: .beach, perDay: 3_500, currency: "₹", days: [
            day("White Town", "White Town", ["French Quarter walk", "Café lunch", "Promenade Beach at dusk"]),
            day("Auroville", "Auroville", ["Auroville visitor centre", "Matrimandir viewpoint", "Paradise Beach"]),
        ]),
        Destination(keys: ["andaman", "havelock", "port blair"], place: "Andaman Islands, India", kind: .beach, photo: .beach, perDay: 5_000, currency: "₹", days: [
            day("Port Blair", "Port Blair", ["Arrive in Port Blair", "Cellular Jail", "Light and sound show"]),
            day("Havelock", "Havelock", ["Ferry to Havelock", "Radhanagar Beach", "Sunset at Radhanagar"]),
            day("Under water", "Havelock", ["Snorkelling at Elephant Beach", "Seafood lunch", "Easy evening"]),
            day("Neil Island", "Neil Island", ["Ferry to Neil Island", "Natural bridge", "Laxmanpur beach sunset"]),
        ]),
        Destination(keys: ["ooty", "nilgiris", "kodaikanal"], place: "Ooty, Tamil Nadu", kind: .city, photo: .himalaya, perDay: 3_000, currency: "₹", days: [
            day("Ooty", "Ooty", ["Government Botanical Garden", "Ooty Lake boat ride", "Tea factory visit"]),
            day("Nilgiri toy train", "Coonoor", ["Nilgiri Mountain Railway to Coonoor", "Sim's Park", "Doddabetta Peak sunset"]),
        ]),
        // Abroad
        Destination(keys: ["bali", "ubud", "seminyak"], place: "Bali, Indonesia", kind: .beach, photo: .beach, perDay: 90, currency: "$", days: [
            day("Ubud", "Ubud", ["Sacred Monkey Forest", "Ubud market", "Balinese dance show"]),
            day("Rice terraces", "Ubud", ["Tegallalang rice terraces", "Tirta Empul temple", "Dinner in Ubud"]),
            day("Uluwatu", "Uluwatu", ["Padang Padang beach", "Uluwatu Temple", "Kecak dance at sunset"]),
            day("Seminyak", "Seminyak", ["Beach morning", "Spa", "Sunset at a beach club"]),
        ]),
        Destination(keys: ["bangkok", "thailand"], place: "Bangkok, Thailand", kind: .city, photo: .aurora, perDay: 80, currency: "$", days: [
            day("Old Bangkok", "Rattanakosin", ["Grand Palace", "Wat Pho", "Wat Arun at sunset"]),
            day("Markets and canals", "Bangkok", ["Long-tail boat on the canals", "Chatuchak Weekend Market", "Yaowarat street food"]),
            day("Modern Bangkok", "Sukhumvit", ["Jim Thompson House", "Siam malls", "Rooftop bar"]),
        ]),
        Destination(keys: ["dubai"], place: "Dubai, UAE", kind: .city, photo: .aurora, perDay: 150, currency: "$", days: [
            day("Old Dubai", "Deira", ["Abra across Dubai Creek", "Gold and spice souks", "Al Fahidi district"]),
            day("Downtown", "Downtown", ["Burj Khalifa", "Dubai Mall", "Dubai Fountain show"]),
            day("Desert", "Desert", ["Beach morning", "Desert safari", "Dinner in the dunes"]),
        ]),
        Destination(keys: ["singapore"], place: "Singapore", kind: .city, photo: .aurora, perDay: 150, currency: "$", days: [
            day("Marina Bay", "Marina Bay", ["Gardens by the Bay", "Marina Bay Sands", "Supertree light show"]),
            day("Neighbourhoods", "Chinatown", ["Chinatown", "Maxwell hawker centre lunch", "Little India"]),
            day("Sentosa", "Sentosa", ["Cable car to Sentosa", "Beach afternoon", "Dinner at Clarke Quay"]),
        ]),
        Destination(keys: ["paris"], place: "Paris, France", kind: .city, photo: .tram, perDay: 150, currency: "€", days: [
            day("Classic Paris", "Paris", ["Louvre", "Tuileries Garden", "Eiffel Tower at night"]),
            day("Montmartre", "Montmartre", ["Sacré-Cœur", "Montmartre walk", "Dinner in Montmartre"]),
            day("Le Marais", "Le Marais", ["Le Marais walk", "Musée d'Orsay", "Seine cruise at sunset"]),
        ]),
        Destination(keys: ["london"], place: "London, UK", kind: .city, photo: .tram, perDay: 150, currency: "£", days: [
            day("Westminster", "Westminster", ["Westminster Abbey", "Walk the South Bank", "Theatre in the West End"]),
            day("Museums", "Bloomsbury", ["British Museum", "Covent Garden", "Dinner in Soho"]),
            day("The City", "The City", ["Tower of London", "Borough Market lunch", "Sunset from Sky Garden"]),
        ]),
        Destination(keys: ["tokyo", "japan"], place: "Tokyo, Japan", kind: .city, photo: .aurora, perDay: 150, currency: "$", days: [
            day("Old Tokyo", "Asakusa", ["Senso-ji Temple", "Nakamise street snacks", "Sumida river walk"]),
            day("Shibuya and Harajuku", "Shibuya", ["Meiji Shrine", "Harajuku", "Shibuya crossing at night"]),
            day("Markets", "Tsukiji", ["Tsukiji Outer Market", "teamLab", "Izakaya dinner"]),
            day("Day trip", "Kamakura", ["Train to Kamakura", "Great Buddha", "Back to Tokyo"]),
        ]),
        Destination(keys: ["lisbon", "portugal"], place: "Lisbon, Portugal", kind: .city, photo: .lisbon, perDay: 120, currency: "€", days: [
            day("Alfama", "Alfama", ["Tram 28", "São Jorge Castle", "Fado dinner"]),
            day("Belém", "Belém", ["Jerónimos Monastery", "Pastéis de Belém", "Sunset at the riverside"]),
            day("Sintra", "Sintra", ["Train to Sintra", "Pena Palace", "Train back to Rossio"]),
        ]),
        Destination(keys: ["kathmandu", "nepal"], place: "Kathmandu, Nepal", kind: .city, photo: .himalaya, perDay: 50, currency: "$", days: [
            day("Kathmandu Durbar Square", "Kathmandu", ["Kathmandu Durbar Square", "Thamel lunch", "Swayambhunath at sunset"]),
            day("Boudha and Pashupati", "Kathmandu", ["Pashupatinath Temple", "Boudhanath Stupa", "Dinner in Boudha"]),
            day("Bhaktapur", "Bhaktapur", ["Bhaktapur Durbar Square", "Juju dhau yoghurt", "Back to Thamel"]),
        ]),
    ]
}
