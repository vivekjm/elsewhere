import UIKit

/// A printable, shareable A4 itinerary: every day with times, stays, notes
/// and costs, then the budget and must-bring documents. Pro.
@MainActor
enum ItineraryPDF {
    private static let page = CGRect(x: 0, y: 0, width: 595, height: 842)
    private static let margin: CGFloat = 44
    private static let accent = UIColor(red: 0.20, green: 0.36, blue: 0.10, alpha: 1)

    static func make(_ trip: Trip) -> URL? {
        guard let url = try? TripExports.exportURL(named: "\(trip.name) itinerary", ext: "pdf") else { return nil }
        let renderer = UIGraphicsPDFRenderer(bounds: page, format: {
            let f = UIGraphicsPDFRendererFormat()
            f.documentInfo = [kCGPDFContextTitle as String: trip.name, kCGPDFContextCreator as String: "Trips Loom"]
            return f
        }())
        do {
            let data = renderer.pdfData { context in
                var writer = Writer(context: context)
                writer.newPage()
                writer.text(trip.name, font: .systemFont(ofSize: 26, weight: .bold))
                writer.text([trip.dateRange, trip.place, Fmt.count(trip.travellers, "traveller")].joined(separator: " · "),
                            font: .systemFont(ofSize: 12), color: .darkGray, after: 16)

                for day in trip.dayIndices {
                    let plans = trip.plans(on: day)
                    var heading = "Day \(day + 1) · \(Fmt.dayTitle(trip.date(ofDay: day), timeZone: trip.timeZone))"
                    if let w = WeatherService.shared.day(trip, day) {
                        heading += "   \(w.summary), \(w.high)°/\(w.low)°"
                    }
                    writer.ensure(60)
                    writer.rule()
                    writer.text(heading, font: .systemFont(ofSize: 14, weight: .semibold), color: accent, after: 6)
                    if plans.isEmpty {
                        writer.text("Free day", font: .systemFont(ofSize: 11), color: .gray, after: 8)
                    }
                    for plan in plans {
                        var line = plan.title
                        if plan.cost > 0 { line += "  ·  \(Fmt.moneyShort(plan.cost, trip.currency))" }
                        writer.row(time: plan.time, title: line, meta: plan.meta, notes: plan.notes)
                    }
                    writer.space(6)
                }

                let expenses = trip.expenses
                if !expenses.isEmpty || trip.budgetLimit > 0 {
                    writer.ensure(80)
                    writer.rule()
                    writer.text("Budget", font: .systemFont(ofSize: 14, weight: .semibold), color: accent, after: 6)
                    for e in expenses {
                        writer.row(time: "", title: "\(e.title)  ·  \(Fmt.moneyShort(e.amount, trip.currency))", meta: e.meta, notes: "")
                    }
                    let limit = trip.budgetLimit > 0 ? " of \(Fmt.moneyShort(trip.budgetLimit, trip.currency))" : ""
                    writer.text("Planned: \(Fmt.moneyShort(trip.totalPlanned, trip.currency))\(limit)", font: .systemFont(ofSize: 11, weight: .medium), after: 8)
                }

                let required = trip.packing.filter(\.required)
                if !required.isEmpty {
                    writer.ensure(60)
                    writer.rule()
                    writer.text("Must bring", font: .systemFont(ofSize: 14, weight: .semibold), color: accent, after: 6)
                    for item in required {
                        writer.row(time: "☐", title: item.name, meta: item.meta, notes: "")
                    }
                }

                writer.footer()
            }
            try data.write(to: url, options: [.atomic, .completeFileProtection])
        } catch {
            return nil
        }
        return url
    }

    private struct Writer {
        let context: UIGraphicsPDFRendererContext
        var y: CGFloat = 0
        var pageNumber = 0
        private var width: CGFloat { page.width - margin * 2 }

        init(context: UIGraphicsPDFRendererContext) { self.context = context }

        mutating func newPage() {
            if pageNumber > 0 { footer() }
            context.beginPage()
            pageNumber += 1
            y = margin
        }

        mutating func ensure(_ height: CGFloat) {
            if y + height > page.height - margin - 20 { newPage() }
        }

        mutating func space(_ h: CGFloat) { y += h }

        mutating func rule() {
            let path = UIBezierPath(rect: CGRect(x: margin, y: y, width: width, height: 0.5))
            UIColor.lightGray.setFill()
            path.fill()
            y += 10
        }

        mutating func text(_ string: String, font: UIFont, color: UIColor = .black, x: CGFloat? = nil, width w: CGFloat? = nil, after: CGFloat = 4) {
            let attributed = NSAttributedString(string: string, attributes: [.font: font, .foregroundColor: color])
            let boxWidth = w ?? width
            let height = ceil(attributed.boundingRect(with: CGSize(width: boxWidth, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil).height)
            ensure(height)
            attributed.draw(with: CGRect(x: x ?? margin, y: y, width: boxWidth, height: height), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
            y += height + after
        }

        /// Time in a narrow column, then title, meta and notes.
        mutating func row(time: String, title: String, meta: String, notes: String) {
            ensure(34)
            let column: CGFloat = 46
            let top = y
            let t = NSAttributedString(string: time, attributes: [.font: UIFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium), .foregroundColor: UIColor.darkGray])
            t.draw(at: CGPoint(x: margin, y: top + 1))
            text(title, font: .systemFont(ofSize: 12, weight: .medium), x: margin + column, width: width - column, after: 1)
            if !meta.isEmpty { text(meta, font: .systemFont(ofSize: 10), color: .darkGray, x: margin + column, width: width - column, after: 1) }
            if !notes.isEmpty { text(notes, font: .italicSystemFont(ofSize: 10), color: .gray, x: margin + column, width: width - column, after: 1) }
            y += 6
        }

        func footer() {
            let s = NSAttributedString(string: "Made with Trips Loom · tripsloom.com   ·   Page \(pageNumber)",
                                       attributes: [.font: UIFont.systemFont(ofSize: 9), .foregroundColor: UIColor.gray])
            s.draw(at: CGPoint(x: margin, y: page.height - margin + 10))
        }
    }
}
