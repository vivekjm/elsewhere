import AuthenticationServices
import SwiftUI

/// C1. Welcome: a short swipeable intro over a slow brand gradient, then
/// one panel to continue with Apple, Google or email. There is no guest mode;
/// trips already on this iPhone join the account on first sync.
struct SignInView: View {
    @Environment(TripStore.self) private var store
    @State private var showEmail = false
    @State private var authError: String?
    @State private var nonce = AuthClient.makeNonce()
    @State private var working: String?
    @State private var providers: Set<String> = []
    @State private var page = 0
    @State private var shown = false

    private static let pages: [IntroPage] = [
        IntroPage(title: "Every trip,\nwoven together.",
                  body: "City breaks, coasts, treks and summits. Plans, bookings and budgets in one place.",
                  tiles: [("building.2.fill", Tile.plum), ("mountain.2.fill", Tile.green), ("water.waves", Tile.teal)]),
        IntroPage(title: "Pack light,\ndress right.",
                  body: "Packing lists and outfits built from your wardrobe and the forecast where you're going.",
                  tiles: [("tshirt.fill", Tile.indigo), ("checklist", Tile.amber), ("cloud.sun.fill", Tile.bronze)]),
        IntroPage(title: "Travel together,\nsafely.",
                  body: "Split costs and vote on plans with friends, and check in with people at home.",
                  tiles: [("person.2.fill", Tile.teal), ("checkmark.shield.fill", Tile.green), ("map.fill", Tile.red)]),
    ]

    /// Release builds show a provider once it's switched on in Supabase;
    /// debug builds always show both so the design can be tried.
    private func offers(_ provider: String) -> Bool {
        #if DEBUG
        true
        #else
        providers.contains(provider)
        #endif
    }

    var body: some View {
        ZStack {
            BrandBackdrop()
            VStack(spacing: 0) {
                header
                    .modifier(Entrance(index: 0, shown: shown))
                TabView(selection: $page) {
                    ForEach(Self.pages.indices, id: \.self) { index in
                        IntroPageView(page: Self.pages[index]).tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .modifier(Entrance(index: 1, shown: shown))
                PageDots(count: Self.pages.count, current: page)
                    .padding(.bottom, 18)
                authPanel
                    .padding(.horizontal, 16)
                    .modifier(Entrance(index: 3, shown: shown))
            }
            .padding(.bottom, 8)
        }
        .task {
            let found = await AuthClient.shared.enabledProviders()
            withAnimation(Motion.snappy) { providers = found }
        }
        .onAppear { shown = true }
        .sheet(isPresented: $showEmail) { EmailSignInSheet() }
        .alert("Couldn't sign in", isPresented: Binding(get: { authError != nil }, set: { if !$0 { authError = nil } })) {
            Button("Use email instead") { showEmail = true }
            Button("OK", role: .cancel) {}
        } message: {
            Text(authError ?? "")
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: "point.topleft.down.to.point.bottomright.curvepath.fill")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Color.ink)
                .frame(width: 34, height: 34)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.lime))
                .accessibilityHidden(true)
            Text("trips loom")
                .font(.sf(19, .heavy))
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.top, 14)
    }

    private var authPanel: some View {
        VStack(spacing: 10) {
            if !store.trips.isEmpty {
                // Older guests, and anyone whose session ended.
                Label("Your \(Fmt.count(store.trips.count, "trip")) on this iPhone will be kept and added to your account.", systemImage: "icloud.and.arrow.up")
                    .font(.sf(13))
                    .foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 6)
                    .padding(.bottom, 2)
            }
            if offers("apple") {
                SignInWithAppleButton(.continue) { request in
                    nonce = AuthClient.makeNonce()
                    request.requestedScopes = [.fullName, .email]
                    request.nonce = nonce.hashed
                } onCompletion: { result in
                    handleApple(result)
                }
                .signInWithAppleButtonStyle(.white)
                .frame(height: 56)
                .clipShape(Capsule())
                .disabled(working != nil)
            }
            if offers("google") {
                Button { Task { await signInWithGoogle() } } label: {
                    HStack(spacing: 10) {
                        if working == "google" { ProgressView().tint(.white) } else { GoogleMark().frame(width: 20, height: 20) }
                        Text("Continue with Google")
                    }
                }
                .buttonStyle(CTAStyle(kind: .glass))
                .disabled(working != nil)
                .accessibilityLabel("Continue with Google")
            }
            Button("Continue with Email") { showEmail = true }
                .buttonStyle(CTAStyle(kind: offers("apple") || offers("google") ? .glass : .white))
                .disabled(working != nil)
            legal
                .padding(.top, 4)
        }
        .padding(12)
        .glass(34)
    }

    private var legal: some View {
        Text("By continuing you agree to the [Terms of Use](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) and [Privacy Policy](https://tripsloom.com/privacy).")
            .font(.sf(12))
            .foregroundStyle(Color.textFaint)
            .tint(Color.textMuted)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)
    }

    private func signInWithGoogle() async {
        working = "google"
        defer { working = nil }
        let enabled = providers.contains("google") ? providers : await AuthClient.shared.enabledProviders()
        guard enabled.contains("google") else {
            authError = "Google sign-in isn't switched on for Trips Loom yet. Use Apple or email for now."
            return
        }
        do {
            try await AuthClient.shared.signInWithOAuth(provider: "google")
            if store.profile.name.isEmpty, let name = await AuthClient.shared.displayName() { store.profile.name = name }
            await store.didSignIn(via: .google)
        } catch is CancellationError {
            return
        } catch {
            authError = error.localizedDescription
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, any Error>) {
        switch result {
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let token = String(data: tokenData, encoding: .utf8)
            else {
                authError = "Apple didn't return a sign-in token. Try again or use email."
                return
            }
            let given = credential.fullName?.givenName
            let family = credential.fullName?.familyName
            working = "apple"
            Task {
                defer { working = nil }
                do {
                    _ = try await AuthClient.shared.signInWithApple(idToken: token, nonce: nonce.raw)
                    // Apple shares the name only on the first sign-in.
                    if let given, store.profile.name.isEmpty {
                        store.profile.name = [given, family].compactMap(\.self).joined(separator: " ")
                    }
                    await store.didSignIn(via: .apple)
                } catch {
                    authError = error.localizedDescription
                }
            }
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            authError = "Sign in with Apple isn't available on this device right now. Try again, or use Google or email."
        }
    }
}

/// One intro page: a small stack of the app's own icon tiles, a headline and a line of copy.
private struct IntroPage {
    var title: String
    var body: String
    var tiles: [(symbol: String, color: Color)]
}

private struct IntroPageView: View {
    var page: IntroPage
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Spacer(minLength: 12)
            if !typeSize.isAccessibilitySize {
                TileFan(tiles: page.tiles)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 18)
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
            }
            WordFittingTitle(text: page.title, size: 40, tracking: -1)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text(page.body)
                .font(.sf(16))
                .foregroundStyle(Color.textMuted)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Three icon tiles fanned like cards, gently floating.
private struct TileFan: View {
    var tiles: [(symbol: String, color: Color)]
    @State private var float = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            ForEach(tiles.indices, id: \.self) { i in
                let offset = CGFloat(i - 1)
                Image(systemName: tiles[i].symbol)
                    .font(.system(size: 38, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 104, height: 104)
                    .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(tiles[i].color.gradient))
                    .overlay(RoundedRectangle(cornerRadius: 30, style: .continuous).strokeBorder(.white.opacity(0.18), lineWidth: 1))
                    .shadow(color: .black.opacity(0.35), radius: 18, y: 12)
                    .rotationEffect(.degrees(Double(offset) * 9))
                    .offset(x: offset * 92, y: abs(offset) * 14 + (float ? (i == 1 ? -8 : 4) : 0))
                    .zIndex(i == 1 ? 1 : 0)
            }
        }
        .frame(height: 150)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true)) { float = true }
        }
    }
}

private struct PageDots: View {
    var count: Int
    var current: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<count, id: \.self) { i in
                Capsule()
                    .fill(i == current ? Color.lime : Color.white.opacity(0.25))
                    .frame(width: i == current ? 22 : 7, height: 7)
            }
        }
        .animation(Motion.snappy, value: current)
        .accessibilityElement()
        .accessibilityLabel("Page \(current + 1) of \(count)")
    }
}

/// A slow, dark brand gradient: ink with hints of indigo, plum and lime.
/// Holds still with Reduce Motion.
struct BrandBackdrop: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            let s = Float(sin(t / 6)), c = Float(cos(t / 7))
            MeshGradient(width: 3, height: 3, points: [
                [0, 0], [0.5, 0], [1, 0],
                [0, 0.5], [0.5 + 0.12 * s, 0.42 + 0.08 * c], [1, 0.5],
                [0, 1], [0.5, 1], [1, 1],
            ], colors: [
                Color(hex: 0x1B1640), Color(hex: 0x0B0E12), Color(hex: 0x2A0F2E),
                Color(hex: 0x0E1A24), Color(hex: 0x23214F), Color(hex: 0x0B0E12),
                Color(hex: 0x0B0E12), Color(hex: 0x1E2A12), Color(hex: 0x0B0E12),
            ])
        }
        .overlay(LinearGradient(colors: [.clear, Color(hex: 0x06080B, opacity: 0.7)], startPoint: .center, endPoint: .bottom))
        .ignoresSafeArea()
    }
}

/// Google's four-colour "G", drawn so no image asset is needed.
struct GoogleMark: View {
    var body: some View {
        Canvas { context, size in
            let r = min(size.width, size.height) / 2
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let line = r * 0.38
            let radius = r - line / 2
            func arc(_ from: Double, _ to: Double, _ color: Color) {
                var path = Path()
                path.addArc(center: center, radius: radius, startAngle: .degrees(from), endAngle: .degrees(to), clockwise: false)
                context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: line, lineCap: .butt))
            }
            arc(-40, 45, Color(hex: 0x4285F4))   // blue, right
            arc(45, 140, Color(hex: 0x34A853))   // green, bottom
            arc(140, 215, Color(hex: 0xFBBC05))  // yellow, left
            arc(215, 320, Color(hex: 0xEA4335))  // red, top
            // The crossbar.
            let bar = CGRect(x: center.x, y: center.y - line / 2, width: r, height: line)
            context.fill(Path(bar), with: .color(Color(hex: 0x4285F4)))
        }
        .accessibilityHidden(true)
    }
}

private struct EmailSignInSheet: View {
    @Environment(TripStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var working = false
    @State private var message: String?
    @State private var messageIsError = true
    @FocusState private var focus: Field?

    enum Mode: Hashable { case signIn, create, reset }
    enum Field { case name, email, password }

    private var emailIsValid: Bool {
        email.trimmingCharacters(in: .whitespaces).wholeMatch(of: /[^@\s]+@[^@\s]+\.[^@\s]{2,}/) != nil
    }

    /// UI tests type their own password; iOS's Automatic Strong Password would
    /// otherwise take the field over mid-test. Real installs always get it.
    private static var newPasswordType: UITextContentType {
        #if DEBUG
        if ProcessInfo.processInfo.environment["TRIPSLOOM_UI_TEST_ID"] != nil { return .password }
        #endif
        return .newPassword
    }

    private var canSubmit: Bool {
        guard emailIsValid, !working else { return false }
        switch mode {
        case .signIn: return !password.isEmpty
        case .create: return password.count >= AuthClient.minimumPasswordLength && name.count <= 200
        case .reset: return true
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    PillSegmented(options: [(.signIn, "Sign in"), (.create, "Create account")], selection: $mode)
                        .opacity(mode == .reset ? 0.4 : 1)

                    GlassList {
                        if mode == .create {
                            field("Your name", text: $name, field: .name, next: .email)
                                .textContentType(.name)
                        }
                        field("Email", text: $email, field: .email, next: mode == .reset ? nil : .password)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        if mode != .reset {
                            SecureField("Password", text: $password)
                                .textContentType(mode == .create ? Self.newPasswordType : .password)
                                .font(.sf(16, .semibold))
                                .padding(.vertical, 14)
                                .focused($focus, equals: .password)
                                .submitLabel(.go)
                                .onSubmit { if canSubmit { Task { await submit() } } }
                        }
                    }

                    if mode == .create {
                        Text("Use at least 8 characters for your password.")
                            .font(.sf(13)).foregroundStyle(Color.textMuted)
                    }

                    if let message {
                        Text(message)
                            .font(.sf(14))
                            .foregroundStyle(messageIsError ? Color.coral : Color.mint)
                            .padding(.horizontal, 4)
                            .transition(.opacity)
                    }

                    Button {
                        Task { await submit() }
                    } label: {
                        if working { ProgressView().tint(.ink) } else {
                            Text(mode == .signIn ? "Sign in" : mode == .create ? "Create account" : "Send reset link")
                        }
                    }
                    .buttonStyle(CTAStyle())
                    .disabled(!canSubmit)
                    .opacity(canSubmit ? 1 : 0.5)

                    Button(mode == .reset ? "Back to sign in" : "Forgot password?") {
                        withAnimation(Motion.snappy) {
                            mode = mode == .reset ? .signIn : .reset
                            message = nil
                        }
                    }
                    .font(.sf(15))
                    .foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)

                    Text("The same account works on tripsloom.com. Your trips sync between them.")
                        .font(.sf(13))
                        .foregroundStyle(Color.textFaint)
                        .padding(.horizontal, 4)
                        .padding(.top, 8)
                }
                .padding(16)
                .animation(Motion.snappy, value: mode)
            }
            .navigationTitle(mode == .reset ? "Reset password" : "Continue with Email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Close")
                }
            }
        }
        .presentationDetents([.large])
        .presentationBackground(Color(hex: 0x12141A, opacity: 0.94))
        .onAppear { focus = .email }
    }

    private func field(_ title: String, text: Binding<String>, field: Field, next: Field?) -> some View {
        TextField(title, text: text)
            .font(.sf(16, .semibold))
            .padding(.vertical, 14)
            .focused($focus, equals: field)
            .submitLabel(next == nil ? .go : .next)
            .onSubmit {
                if let next { focus = next } else if canSubmit { Task { await submit() } }
            }
    }

    private func submit() async {
        let email = email.trimmingCharacters(in: .whitespaces)
        working = true
        message = nil
        defer { working = false }
        do {
            switch mode {
            case .signIn:
                _ = try await AuthClient.shared.signIn(email: email, password: password)
                await store.didSignIn(via: .email)
                dismiss()
            case .create:
                let trimmed = name.trimmingCharacters(in: .whitespaces)
                if !trimmed.isEmpty { store.profile.name = trimmed }
                switch try await AuthClient.shared.signUp(email: email, password: password, name: trimmed) {
                case .signedIn:
                    await store.didSignIn(via: .email)
                    dismiss()
                case .confirmEmail:
                    messageIsError = false
                    message = "Check \(email) for a link to confirm your account. It opens Trips Loom and signs you in."
                }
            case .reset:
                try await AuthClient.shared.sendPasswordReset(email: email)
                messageIsError = false
                message = "If \(email) has an account, a reset link is on its way. It opens Trips Loom to set a new password."
            }
        } catch {
            messageIsError = true
            message = error.localizedDescription
        }
    }
}

/// Opened by a password-reset email link.
struct NewPasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var working = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                GlassList {
                    SecureField("New password", text: $password)
                        .textContentType(.newPassword)
                        .font(.sf(16, .semibold))
                        .padding(.vertical, 14)
                }
                if let message {
                    Text(message).font(.sf(14)).foregroundStyle(Color.coral).padding(.horizontal, 4)
                }
                Button {
                    Task {
                        working = true
                        defer { working = false }
                        do {
                            try await AuthClient.shared.updatePassword(password)
                            dismiss()
                        } catch {
                            message = error.localizedDescription
                        }
                    }
                } label: {
                    if working { ProgressView().tint(.ink) } else { Text("Save password") }
                }
                .buttonStyle(CTAStyle())
                .disabled(password.count < AuthClient.minimumPasswordLength || working)
                .opacity(password.count < AuthClient.minimumPasswordLength ? 0.5 : 1)
                Spacer()
            }
            .padding(16)
            .navigationTitle("Set a new password")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.large])
        .presentationBackground(Color(hex: 0x12141A, opacity: 0.94))
    }
}
