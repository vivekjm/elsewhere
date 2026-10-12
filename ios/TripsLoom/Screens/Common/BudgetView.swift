import SwiftUI

/// C7. Every trip has a budget. The pill chart shows spend per day, with the
/// biggest day in lime. It opens from Trip and hides the tab bar.
struct BudgetView: View {
    @Binding var trip: Trip
    @State private var mode: Mode = .trip
    @State private var addingExpense = false
    @State private var editingExpense: Expense?
    @State private var editingLimit = false
    @State private var limitDraft = ""

    enum Mode: Hashable { case trip, daily }

    /// "≈ ₹1,23,000 at today's rate" when the trip isn't in the phone's currency.
    private var homeTotal: String? {
        guard let from = CurrencyService.code(for: trip.currency), from != CurrencyService.home,
              let rate = CurrencyService.shared.rate(from: from, to: CurrencyService.home), trip.totalPlanned > 0
        else { return nil }
        return "≈ \(Fmt.moneyShort(trip.totalPlanned * rate, CurrencyService.symbol(for: CurrencyService.home))) at today's rate"
    }

    var body: some View {
        NightScreen(photo: trip.photo, top: 0.45, bottom: 0.8) {
            VStack(alignment: .leading, spacing: 6) {
                SectionLabel("Total planned")
                let total = Fmt.money(trip.totalPlanned, trip.currency)
                MonoAmount(whole: total.whole, fraction: total.fraction, size: 46)
                    .tracking(-0.9)
                HStack(spacing: 8) {
                    if trip.addedThisWeek > 0 {
                        Chip("+\(Fmt.moneyShort(trip.addedThisWeek, trip.currency)) this week", tone: .tint(.lime))
                    }
                    Button {
                        limitDraft = trip.budgetLimit > 0 ? Fmt.amountInput(trip.budgetLimit) : ""
                        editingLimit = true
                    } label: {
                        if trip.budgetLimit > 0 {
                            Text("of \(Fmt.moneyShort(trip.budgetLimit, trip.currency))")
                                .metaStyle(12, color: trip.totalPlanned > trip.budgetLimit ? .coral : .textMuted)
                        } else {
                            Text("Set a budget").metaStyle(12, color: .lime)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Change the budget")
                }
                .padding(.top, 2)
                if let home = homeTotal {
                    Text(home).metaStyle(12).padding(.top, 2)
                }
            }
            .padding(.horizontal, 4)
            .padding(.top, 12)

            if let from = CurrencyService.code(for: trip.currency), from != CurrencyService.home {
                CurrencyConverter(from: from, to: CurrencyService.home)
            }

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("By day").font(.sf(17, .semibold)).foregroundStyle(.white)
                    Spacer()
                    Button { withAnimation(Motion.snappy) { mode = mode == .trip ? .daily : .trip } } label: { CornerArrow() }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Show daily list")
                }
                PillBarChart(bars: bars)
            }
            .glassCard()

            switch mode {
            case .trip:
                categories
                expenseList
            case .daily: daily
            }

            Button {
                addingExpense = true
            } label: {
                Label("Add expense", systemImage: "plus")
            }
            .buttonStyle(GlassPillStyle())
            .padding(.horizontal, 4)
        }
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .principal) {
                PillSegmented(options: [(.trip, "Trip"), (.daily, "Daily")], selection: $mode, height: 44)
                    .frame(width: 160)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .alert("Trip budget", isPresented: $editingLimit) {
            TextField("Amount in \(trip.currency)", text: $limitDraft)
                .keyboardType(.decimalPad)
            Button("Save") { trip.budgetLimit = Fmt.parseAmount(limitDraft) ?? 0 }
                .disabled(!limitDraft.isEmpty && (Fmt.parseAmount(limitDraft).map { (0...10_000_000).contains($0) } != true))
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Leave empty for no limit.")
        }
        .sheet(isPresented: $addingExpense) {
            ExpenseEditor(trip: $trip)
        }
        .sheet(item: $editingExpense) { ExpenseEditor(trip: $trip, expense: $0) }
    }

    private var bars: [PillBar] {
        let days = Array(trip.dayIndices.prefix(10))
        let values = days.map { trip.spend(onDay: $0) }
        let top = values.enumerated().max { $0.element < $1.element }?.offset
        return days.enumerated().map { i, day in
            let value = values[i]
            let isTop = i == top && value > 0
            let highlight = trip.plans(on: day).max { $0.cost < $1.cost }
            let place = highlight?.meta.split(separator: "·").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
            return PillBar(
                id: day,
                value: value,
                label: Fmt.moneyCompact(value, trip.currency),
                badge: Fmt.weekdayLetter(trip.date(ofDay: day), timeZone: trip.timeZone),
                style: isTop ? .highlight : .normal,
                callout: isTop ? "\(place.isEmpty ? Fmt.weekday(trip.date(ofDay: day), timeZone: trip.timeZone) : place) · \(Fmt.moneyShort(value, trip.currency))" : nil
            )
        }
    }

    private var categories: some View {
        let totals = trip.spendByCategory
        let ordered = BudgetCategory.allCases.filter { (totals[$0] ?? 0) > 0 }
        return GlassList {
            if ordered.isEmpty {
                Text("Nothing planned yet. Plans with a price and expenses appear here.")
                    .font(.sf(15))
                    .foregroundStyle(Color.textMuted)
                    .padding(.vertical, 14)
            }
            ForEach(ordered) { category in
                ListRow(category.title, meta: meta(for: category)) {
                    IconTile(symbol: category.symbol, color: category.tile)
                } trailing: {
                    Text(Fmt.moneyShort(totals[category] ?? 0, trip.currency))
                        .font(.mono(16, .semibold))
                        .foregroundStyle(.white)
                }
            }
        }
    }

    private var daily: some View {
        GlassList {
            ForEach(trip.dayIndices, id: \.self) { day in
                let date = trip.date(ofDay: day)
                ListRow(Fmt.dayTitle(date, timeZone: trip.timeZone), meta: Fmt.count(trip.plans(on: day).count, "plan")) {
                    Text("D\(day + 1)")
                        .font(.mono(13, .bold))
                        .foregroundStyle(Color.lime)
                        .lineLimit(1).fixedSize().frame(minWidth: 36, alignment: .leading)
                } trailing: {
                    Text(Fmt.moneyShort(trip.spend(onDay: day), trip.currency))
                        .font(.mono(16, .semibold))
                        .foregroundStyle(.white)
                }
            }
            ForEach(trip.expenses.filter { $0.day == nil }) { expense in
                Button { editingExpense = expense } label: {
                    ListRow(expense.title, meta: expense.meta.isEmpty ? "Whole trip" : expense.meta) {
                        IconTile(symbol: expense.category.symbol, color: expense.category.tile)
                    } trailing: {
                        Text(Fmt.moneyShort(expense.amount, trip.currency)).font(.mono(16, .semibold)).foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button("Edit", systemImage: "pencil") { editingExpense = expense }
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        withAnimation { trip.expenses.removeAll { $0.id == expense.id } }
                    }
                }
            }
            if trip.guideCost > 0, let guide = trip.adventure?.guide {
                ListRow("Guide · \(guide.name)", meta: "Whole trip · \(Fmt.moneyShort(Double(guide.dayRate), trip.currency))/day") {
                    IconTile(symbol: "person.crop.circle", color: BudgetCategory.activities.tile)
                } trailing: {
                    Text(Fmt.moneyShort(trip.guideCost, trip.currency)).font(.mono(16, .semibold)).foregroundStyle(.white)
                }
            }
            if trip.permitFees > 0 {
                ListRow("Permits", meta: "Whole trip · \(Fmt.count((trip.adventure?.permits ?? []).filter { ($0.fee ?? 0) > 0 }.count, "permit"))") {
                    IconTile(symbol: "checkmark.seal.fill", color: BudgetCategory.other.tile)
                } trailing: {
                    Text(Fmt.moneyShort(trip.permitFees, trip.currency)).font(.mono(16, .semibold)).foregroundStyle(.white)
                }
            }
            if trip.gearRental > 0 {
                ListRow("Gear rental", meta: "Whole trip · \(Fmt.count(trip.gear.filter { $0.status == .rent }.count, "item"))") {
                    IconTile(symbol: "backpack.fill", color: BudgetCategory.other.tile)
                } trailing: {
                    Text(Fmt.moneyShort(trip.gearRental, trip.currency)).font(.mono(16, .semibold)).foregroundStyle(.white)
                }
            }
        }
    }

    private func meta(for category: BudgetCategory) -> String {
        let expenses = trip.expenses.filter { $0.category == category }
        let plans = trip.plans.filter { $0.category.budget == category && $0.cost > 0 }
        var extras: [String] = []
        if category == .other, trip.gearRental > 0 { extras.append("Gear rental") }
        if category == .other, trip.permitFees > 0 { extras.append("Permits") }
        if category == .activities, trip.guideCost > 0 { extras.append("Guide") }
        let rental = extras.count
        if expenses.count + plans.count + rental == 1 { return expenses.first?.title ?? plans.first?.title ?? extras[0] }
        let count = expenses.count + plans.count + rental
        return "\(count) \(count == 1 ? "item" : "items")"
    }

    /// Every expense, newest first, so each can be seen, split and removed.
    @ViewBuilder
    private var expenseList: some View {
        if !trip.expenses.isEmpty {
            GlassList("Expenses") {
                ForEach(trip.expenses.sorted { $0.addedAt > $1.addedAt }) { expense in
                    Button { editingExpense = expense } label: {
                        ListRow(expense.title, meta: expenseMeta(expense)) {
                            IconTile(symbol: expense.category.symbol, color: expense.category.tile)
                        } trailing: {
                            Text(Fmt.moneyShort(expense.amount, trip.currency)).font(.mono(16, .semibold)).foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button("Edit", systemImage: "pencil") { editingExpense = expense }
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            withAnimation { trip.expenses.removeAll { $0.id == expense.id } }
                        }
                    }
                }
            }
        }
    }

    private func expenseMeta(_ expense: Expense) -> String {
        var parts: [String] = []
        if let day = expense.day { parts.append("Day \(day + 1)") } else { parts.append("Whole trip") }
        if let group = expense.splitWith, group.count > 1 {
            let payer = expense.paidBy ?? "You"
            parts.append("\(payer) paid · \(Fmt.moneyShort(expense.amount / Double(group.count), trip.currency)) each")
        } else if !expense.meta.isEmpty {
            parts.append(expense.meta)
        }
        return parts.joined(separator: " · ")
    }
}

struct ExpenseEditor: View {
    @FocusState private var firstFieldFocused: Bool
    @Binding var trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var amount = ""
    @State private var category: BudgetCategory = .food
    @State private var day: Int? = nil
    @State private var paidBy = Trip.me
    @State private var split: Set<String> = []
    @State private var didSetSplit = false
    @State private var pickedCategory = false
    private var existing: Expense?

    /// Who shares the cost, or nil when nobody owes anyone: one person paying
    /// for themselves. Paying for just one other person ("Alex paid for my
    /// ticket") is still a debt.
    static func splitGroup(_ split: Set<String>, paidBy: String, people: [String]) -> [String]? {
        let group = people.filter(split.contains)
        guard !group.isEmpty, group != [paidBy] else { return nil }
        return group
    }

    init(trip: Binding<Trip>, expense: Expense? = nil) {
        _trip = trip
        existing = expense
        if let expense {
            _title = State(initialValue: expense.title)
            _amount = State(initialValue: Fmt.amountInput(expense.amount))
            _category = State(initialValue: expense.category)
            _day = State(initialValue: expense.day)
            _paidBy = State(initialValue: expense.paidBy ?? Trip.me)
            _split = State(initialValue: Set(expense.splitWith ?? []))
            _didSetSplit = State(initialValue: true)
            _pickedCategory = State(initialValue: true)
        }
    }

    /// Split notes are written by the editor; anything else (a booking
    /// reference from an import) is kept.
    private static func isSplitNote(_ meta: String) -> Bool {
        (meta.contains(" paid · split ") && meta.hasSuffix(" ways")) || meta.contains(" paid · for ")
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("What was it?", text: $title)
                    .focused($firstFieldFocused)
                TextField("Amount (\(trip.currency))", text: $amount)
                    .keyboardType(.decimalPad)
                Picker("Category", selection: Binding(get: { category }, set: { category = $0; pickedCategory = true })) {
                    ForEach(BudgetCategory.allCases) { Text($0.title).tag($0) }
                }
                Picker("Day", selection: $day) {
                    Text("Whole trip").tag(Int?.none)
                    ForEach(trip.dayIndices, id: \.self) { d in
                        Text("Day \(d + 1) · \(Fmt.monthDay(trip.date(ofDay: d), timeZone: trip.timeZone))").tag(Int?.some(d))
                    }
                }
                if !trip.companions.isEmpty {
                    Section {
                        Picker("Paid by", selection: $paidBy) {
                            ForEach(trip.people, id: \.self) { Text($0).tag($0) }
                        }
                        ForEach(trip.people, id: \.self) { person in
                            Toggle(isOn: Binding(
                                get: { split.contains(person) },
                                set: { on in if on { split.insert(person) } else { split.remove(person) } }
                            )) {
                                HStack {
                                    Text(person)
                                    Spacer()
                                    if split.contains(person), let value = Fmt.parseAmount(amount), !split.isEmpty {
                                        Text(Fmt.moneyShort(value / Double(split.count), trip.currency)).foregroundStyle(Color.textMuted)
                                    }
                                }
                            }
                            .tint(.lime)
                        }
                    } header: {
                        Text("Split equally")
                    } footer: {
                        Text(Self.splitGroup(split, paidBy: paidBy, people: trip.people) == nil ? "Not split: it counts toward the trip budget only." : "Balances update in the Shared tab.")
                    }
                } else if trip.travellers > 1 {
                    Section {
                        Text("Add the people on this trip in Edit trip to split costs.")
                            .font(.sf(14))
                            .foregroundStyle(Color.textMuted)
                    }
                }
                if let existing {
                    Section {
                        Button("Delete expense", role: .destructive) {
                            trip.expenses.removeAll { $0.id == existing.id }
                            dismiss()
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(existing == nil ? "Add expense" : "Edit expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(existing == nil ? "Add" : "Save") {
                        let value = Fmt.parseAmount(amount) ?? 0
                        let group = Self.splitGroup(split, paidBy: paidBy, people: trip.people)
                        var meta = existing.map { Self.isSplitNote($0.meta) ? "" : $0.meta } ?? ""
                        if let group {
                            let payer = paidBy == Trip.me ? "You paid" : "\(paidBy) paid"
                            meta = group.count == 1 ? "\(payer) · for \(group[0] == Trip.me ? "you" : group[0])" : "\(payer) · split \(group.count) ways"
                        }
                        var expense = Expense(title: title.trimmingCharacters(in: .whitespacesAndNewlines), meta: meta, category: category, amount: value, day: day, addedAt: .now,
                                              paidBy: paidBy == Trip.me ? nil : paidBy, splitWith: group)
                        if let existing, let i = trip.expenses.firstIndex(where: { $0.id == existing.id }) {
                            expense.id = existing.id
                            expense.addedAt = existing.addedAt
                            trip.expenses[i] = expense
                        } else {
                            trip.expenses.append(expense)
                        }
                        dismiss()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || title.count > 200 || Fmt.parseAmount(amount).map { $0 > 0 && $0 <= 10_000_000 } != true)
                }
            }
        }
        .autofocus($firstFieldFocused, when: existing == nil)
        .presentationBackground { SheetGlass(photo: trip.photo) }
        .presentationDetents([.medium, .large])
        .onChange(of: title) { _, text in
            // "Houseboat" is a stay, "Taxi to Munnar" is transport.
            if !pickedCategory, let guess = PlanCategory.guess(from: text) { category = guess.budget }
        }
        .onAppear {
            // Group trips split with everyone by default.
            if !didSetSplit, !trip.companions.isEmpty { split = Set(trip.people) }
            didSetSplit = true
        }
    }
}

/// Two-way converter between the trip's currency and the phone's.
struct CurrencyConverter: View {
    /// Small amounts keep their decimals: "€0.92", "₹8,640".
    private func converted(_ value: Double, _ symbol: String) -> String {
        Fmt.money(value, symbol).whole
    }

    var from: String
    var to: String
    @State private var amount = "1"
    @State private var reversed = false
    @FocusState private var focused: Bool

    var body: some View {
        let a = reversed ? to : from
        let b = reversed ? from : to
        let rate = CurrencyService.shared.rate(from: a, to: b)
        let value = Fmt.parseAmount(amount) ?? 0

        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Currency").font(.sf(17, .semibold)).foregroundStyle(.white)
                Spacer()
                if let updated = CurrencyService.shared.updated(from) ?? CurrencyService.shared.updated(to) {
                    Text("Updated \(updated.formatted(.relative(presentation: .named)))").metaStyle(11)
                }
            }
            HStack(spacing: 10) {
                HStack(spacing: 4) {
                    Text(CurrencyService.symbol(for: a)).font(.mono(18, .semibold)).foregroundStyle(Color.textMuted)
                    TextField("0", text: $amount)
                        .keyboardType(.decimalPad)
                        .focused($focused)
                        .font(.mono(20, .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.08)))

                Button { withAnimation(Motion.snappy) { reversed.toggle() } } label: {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.white.opacity(0.12)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Swap currencies")

                Text(rate.map { converted(value * $0, CurrencyService.symbol(for: b)) } ?? "—")
                    .font(.mono(20, .semibold))
                    .foregroundStyle(Color.lime)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            if rate == nil {
                Text("Rates load when you're online, then work offline.").font(.sf(12)).foregroundStyle(Color.textFaint)
            }
        }
        .glassCard()
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focused = false }
            }
        }
    }
}
