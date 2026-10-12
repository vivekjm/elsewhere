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
        return all.first { dest in dest.keys.contains { PromptFacts.namesPlace(text, $0) } }
    }

    private static func day(_ title: String, _ area: String, _ stops: [String]) -> DraftDay {
        DraftDay(title: title, stops: stops, area: area)
    }

    static let all: [Destination] = [
        // Europe, the Americas, Asia-Pacific, Africa
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
        Destination(keys: ["rome", "roma"], place: "Rome, Italy", kind: .city, photo: .tram, perDay: 150, currency: "€", days: [
            day("Ancient Rome", "Monti", ["Colosseum", "Roman Forum and Palatine Hill", "Dinner in Monti"]),
            day("The Vatican", "Prati", ["Vatican Museums and Sistine Chapel", "St Peter's Basilica", "Castel Sant'Angelo at sunset"]),
            day("Centro storico", "Centro", ["Pantheon", "Piazza Navona", "Campo de' Fiori market", "Aperitivo in Trastevere"]),
            day("Slow morning", "Aventino", ["Orange Garden viewpoint", "Testaccio market lunch", "Gelato walk"]),
        ]),
        Destination(keys: ["barcelona", "catalonia"], place: "Barcelona, Spain", kind: .city, photo: .tram, perDay: 140, currency: "€", days: [
            day("Gaudí", "Eixample", ["Sagrada Família", "Casa Batlló", "Tapas in Gràcia"]),
            day("Old town", "Barri Gòtic", ["Gothic Quarter walk", "La Boqueria lunch", "Sunset at the Bunkers del Carmel"]),
            day("Sea and hill", "Barceloneta", ["Barceloneta beach", "Montjuïc cable car", "Dinner in El Born"]),
        ]),
        Destination(keys: ["amsterdam", "netherlands"], place: "Amsterdam, Netherlands", kind: .city, photo: .tram, perDay: 160, currency: "€", days: [
            day("Canal ring", "Jordaan", ["Canal cruise", "Anne Frank House", "Dinner in the Jordaan"]),
            day("Museums", "Museumplein", ["Rijksmuseum", "Van Gogh Museum", "Vondelpark bikes"]),
            day("By bike", "Noord", ["Ferry to Noord", "NDSM wharf", "Brouwerij 't IJ"]),
        ]),
        Destination(keys: ["new york", "nyc", "manhattan", "brooklyn"], place: "New York, USA", kind: .city, photo: .aurora, perDay: 220, currency: "$", days: [
            day("Midtown", "Midtown", ["Central Park walk", "The Met", "Top of the Rock at dusk"]),
            day("Downtown", "Lower Manhattan", ["Staten Island Ferry", "9/11 Memorial", "Dinner in the West Village"]),
            day("Brooklyn", "Williamsburg", ["Walk the Brooklyn Bridge", "DUMBO", "Williamsburg bars"]),
            day("Museums and the High Line", "Chelsea", ["Whitney Museum", "The High Line", "Chelsea Market"]),
        ]),
        Destination(keys: ["kyoto"], place: "Kyoto, Japan", kind: .city, photo: .aurora, perDay: 18_000, currency: "¥", days: [
            day("Eastern hills", "Higashiyama", ["Kiyomizu-dera", "Sannenzaka lanes", "Evening in Gion"]),
            day("Bamboo and temples", "Arashiyama", ["Bamboo grove early", "Tenryu-ji", "Riverside tea"]),
            day("Shrines", "Fushimi", ["Fushimi Inari at dawn", "Nishiki Market lunch", "Kaiseki dinner"]),
            day("Zen morning", "Kinkaku-ji", ["Kinkaku-ji", "Ryoan-ji rock garden", "Philosopher's Path"]),
        ]),
        Destination(keys: ["amalfi", "positano", "sorrento", "ravello"], place: "Amalfi Coast, Italy", kind: .beach, photo: .beach, perDay: 180, currency: "€", days: [
            day("Positano", "Positano", ["Check in", "Spiaggia Grande", "Sunset aperitivo above the bay"]),
            day("By boat", "Amalfi", ["Boat to Amalfi", "Amalfi Cathedral", "Lemon groves of Ravello"]),
            day("Path of the Gods", "Bomerano", ["Path of the Gods walk", "Lunch in Nocelle", "Swim at Arienzo"]),
            day("Capri day", "Capri", ["Ferry to Capri", "Chairlift up Monte Solaro", "Last dinner in Positano"]),
        ]),
        Destination(keys: ["santorini", "mykonos", "greek islands", "cyclades"], place: "Santorini, Greece", kind: .beach, photo: .beach, perDay: 160, currency: "€", days: [
            day("Oia", "Oia", ["Check in", "Oia lanes", "Sunset from the castle ruins"]),
            day("Caldera walk", "Fira", ["Fira to Oia caldera walk", "Lunch in Imerovigli", "Swim at Amoudi Bay"]),
            day("Volcano and wine", "Akrotiri", ["Boat to the volcano", "Akrotiri ruins", "Winery tasting at dusk"]),
        ]),
        Destination(keys: ["iceland", "reykjavik", "ring road"], place: "Reykjavík, Iceland", kind: .road, photo: .aurora, perDay: 200, currency: "€", days: [
            day("Golden Circle", "Þingvellir", ["Þingvellir National Park", "Geysir", "Gullfoss"]),
            day("South coast", "Vík", ["Seljalandsfoss", "Skógafoss", "Reynisfjara black sand beach"]),
            day("Glacier lagoon", "Jökulsárlón", ["Skaftafell walk", "Jökulsárlón glacier lagoon", "Diamond Beach"]),
            day("Back west", "Reykjavík", ["Drive back along the coast", "Sky Lagoon", "Dinner in Reykjavík"]),
        ]),
        Destination(keys: ["zermatt", "interlaken", "swiss alps", "switzerland", "grindelwald"], place: "Bernese Alps, Switzerland", kind: .trek, photo: .himalaya, perDay: 200, currency: "CHF", days: [
            day("Arrive and acclimatise", "Grindelwald", ["Train to Grindelwald", "First cliff walk", "Easy evening"]),
            day("Eiger trail", "Eigergletscher", ["Eiger Trail to Alpiglen", "Lunch at Kleine Scheidegg", "Back to Grindelwald"]),
            day("Bachalpsee", "First", ["Gondola to First", "Bachalpsee lake walk", "Faulhorn viewpoint"]),
            day("Lauterbrunnen", "Lauterbrunnen", ["Valley of 72 waterfalls", "Mürren by cable car", "Dinner in Wengen"]),
        ]),
        Destination(keys: ["dolomites", "cortina", "alta badia", "val gardena"], place: "Dolomites, Italy", kind: .trek, photo: .himalaya, perDay: 120, currency: "€", days: [
            day("Tre Cime", "Misurina", ["Tre Cime di Lavaredo loop", "Rifugio Locatelli lunch", "Lago di Misurina"]),
            day("Seceda", "Ortisei", ["Cable car to Seceda", "Ridge walk", "Dinner in Ortisei"]),
            day("Alpe di Siusi", "Compatsch", ["Alpe di Siusi meadows", "Rifugio lunch", "Lago di Braies at dusk"]),
        ]),
        Destination(keys: ["chamonix", "mont blanc", "tour du mont blanc"], place: "Chamonix, France", kind: .trek, photo: .himalaya, perDay: 130, currency: "€", days: [
            day("Aiguille du Midi", "Chamonix", ["Aiguille du Midi cable car", "Step into the Void", "Easy evening"]),
            day("Lac Blanc", "Argentière", ["Lac Blanc hike", "Picnic at the lake", "Back by lift"]),
            day("Mer de Glace", "Montenvers", ["Montenvers train", "Mer de Glace ice cave", "Dinner in Chamonix"]),
        ]),
        Destination(keys: ["patagonia", "torres del paine", "el chalten", "puerto natales"], place: "Torres del Paine, Chile", kind: .trek, photo: .himalaya, perDay: 120, currency: "$", days: [
            day("Base of the towers", "Las Torres", ["Hike to the base of the towers", "Refugio dinner"]),
            day("French Valley", "Los Cuernos", ["Hike to the French Valley lookout", "Camp at Paine Grande"]),
            day("Grey Glacier", "Grey", ["Walk to Grey Glacier", "Catamaran across Lago Pehoé", "Back to Puerto Natales"]),
        ]),
        Destination(keys: ["big sur", "highway 1", "pacific coast highway", "california coast"], place: "Big Sur, California", kind: .road, photo: .beach, perDay: 180, currency: "$", days: [
            day("Monterey", "Monterey", ["17-Mile Drive", "Monterey Bay Aquarium", "Carmel-by-the-Sea dinner"]),
            day("Big Sur", "Big Sur", ["Bixby Bridge", "Pfeiffer Beach", "Sunset at Nepenthe"]),
            day("South to Cambria", "San Simeon", ["McWay Falls", "Elephant seals at Piedras Blancas", "Hearst Castle"]),
        ]),
        Destination(keys: ["scotland", "highlands", "isle of skye", "skye", "edinburgh"], place: "Scottish Highlands, UK", kind: .road, photo: .himalaya, perDay: 140, currency: "£", days: [
            day("Glencoe", "Glencoe", ["Drive through Glencoe", "Three Sisters viewpoint", "Pub dinner in Fort William"]),
            day("Skye", "Portree", ["Old Man of Storr", "Quiraing", "Seafood in Portree"]),
            day("Fairy Pools", "Glenbrittle", ["Fairy Pools", "Neist Point lighthouse", "Talisker distillery"]),
            day("Loch Ness", "Inverness", ["Eilean Donan Castle", "Loch Ness", "Inverness"]),
        ]),
        Destination(keys: ["sydney", "australia"], place: "Sydney, Australia", kind: .city, photo: .beach, perDay: 160, currency: "A$", days: [
            day("Harbour", "Circular Quay", ["Opera House", "Royal Botanic Garden", "Ferry to Manly"]),
            day("Bondi to Coogee", "Bondi", ["Bondi to Coogee coastal walk", "Beach afternoon", "Dinner in Surry Hills"]),
            day("Blue Mountains", "Katoomba", ["Train to Katoomba", "Three Sisters", "Back to Sydney"]),
        ]),
        Destination(keys: ["marrakech", "morocco", "marrakesh"], place: "Marrakech, Morocco", kind: .city, photo: .aurora, perDay: 70, currency: "€", days: [
            day("The medina", "Medina", ["Bahia Palace", "Souks", "Jemaa el-Fnaa at dusk"]),
            day("Gardens", "Gueliz", ["Jardin Majorelle", "YSL Museum", "Rooftop dinner"]),
            day("Atlas foothills", "Imlil", ["Day trip to Imlil", "Village walk", "Tagine lunch"]),
        ]),
        Destination(keys: ["istanbul", "turkey", "türkiye"], place: "Istanbul, Türkiye", kind: .city, photo: .aurora, perDay: 80, currency: "€", days: [
            day("Sultanahmet", "Sultanahmet", ["Hagia Sophia", "Blue Mosque", "Basilica Cistern"]),
            day("Bazaars and the Bosphorus", "Eminönü", ["Grand Bazaar", "Spice Bazaar", "Bosphorus ferry at sunset"]),
            day("Beyoğlu", "Karaköy", ["Galata Tower", "Istiklal Street", "Meze dinner in Karaköy"]),
        ]),
        Destination(keys: ["cape town", "south africa"], place: "Cape Town, South Africa", kind: .city, photo: .beach, perDay: 90, currency: "$", days: [
            day("Table Mountain", "City Bowl", ["Table Mountain cableway", "Bo-Kaap walk", "V&A Waterfront dinner"]),
            day("The Cape", "Cape Point", ["Chapman's Peak Drive", "Cape of Good Hope", "Penguins at Boulders Beach"]),
            day("Winelands", "Stellenbosch", ["Stellenbosch tasting", "Franschhoek lunch", "Sunset at Camps Bay"]),
        ]),
        Destination(keys: ["mexico city", "cdmx"], place: "Mexico City, Mexico", kind: .city, photo: .aurora, perDay: 70, currency: "$", days: [
            day("Centro", "Centro Histórico", ["Zócalo and the cathedral", "Palacio de Bellas Artes", "Dinner in Roma Norte"]),
            day("Coyoacán", "Coyoacán", ["Frida Kahlo Museum", "Coyoacán market lunch", "Mezcal in Condesa"]),
            day("Pyramids", "Teotihuacán", ["Teotihuacán early", "Back for Chapultepec", "Anthropology Museum"]),
        ]),
        Destination(keys: ["kathmandu", "nepal"], place: "Kathmandu, Nepal", kind: .city, photo: .himalaya, perDay: 50, currency: "$", days: [
            day("Kathmandu Durbar Square", "Kathmandu", ["Kathmandu Durbar Square", "Thamel lunch", "Swayambhunath at sunset"]),
            day("Boudha and Pashupati", "Kathmandu", ["Pashupatinath Temple", "Boudhanath Stupa", "Dinner in Boudha"]),
            day("Bhaktapur", "Bhaktapur", ["Bhaktapur Durbar Square", "Juju dhau yoghurt", "Back to Thamel"]),
        ]),
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
    ]
}
