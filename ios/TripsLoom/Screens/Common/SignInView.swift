import AuthenticationServices
import SwiftUI

/// C1. A full-bleed photo with a frosted panel. Apple is the white pill;
/// email is the glass pill.
struct SignInView: View {
    @Environment(TripStore.self) private var store
    @State private var showEmail = false
    @State private var appleError: String?
    @State private var nonce = AuthClient.makeNonce()
    @State private var working = false
    @State private var appleEnabled = false
    @State private var shown = false
    @State private var drift = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.clear
                .overlay {
                    // A slow Ken Burns drift keeps the photo alive.
                    RemotePhoto(photo: .tram, width: 900)
                        .scaleEffect(drift ? 1.14 : 1.02)
                        .offset(x: drift ? -14 : 8, y: drift ? -10 : 0)
                }
                .clipped()
                .ignoresSafeArea()
            LinearGradient(
                stops: [
                    .init(color: Color(hex: 0x06080B, opacity: 0.15), location: 0),
                    .init(color: Color(hex: 0x06080B, opacity: 0.1), location: 0.35),
                    .init(color: Color(hex: 0x06080B, opacity: 0.94), location: 0.78),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Text("trips loom")
                    .font(.sf(17, .heavy))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.top, 18)
                    .accessibilityAddTraits(.isHeader)
                    .modifier(Entrance(index: 0, shown: shown))
                Spacer()
                VStack(alignment: .leading, spacing: 12) {
                    Text("Every trip,\nwoven together.")
                        .displayTitle(44)
                    Text("City breaks, coasts and summits. Plans, outfits, gear and safety in one place.")
                        .font(.sf(16))
                        .foregroundStyle(Color.textMuted)
                        .lineSpacing(3)
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 22)
                .modifier(Entrance(index: 2, shown: shown))

                VStack(spacing: 8) {
                    if appleEnabled {
                    SignInWithAppleButton(.signIn) { request in
                        nonce = AuthClient.makeNonce()
                        request.requestedScopes = [.fullName, .email]
                        request.nonce = nonce.hashed
                    } onCompletion: { result in
                        handleApple(result)
                    }
                    .signInWithAppleButtonStyle(.white)
                    .frame(height: 56)
                    .clipShape(Capsule())
                    .transition(.opacity)
                    }

                    // Email is the white primary until Apple is switched on
                    // in the Supabase project.
                    Button("Continue with Email") { showEmail = true }
                        .buttonStyle(CTAStyle(kind: appleEnabled ? .glass : .white))

                    Button {
                        store.session = .guest
                    } label: {
                        Text("Continue as guest")
                            .font(.sf(15))
                            .foregroundStyle(Color.textMuted)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 8)
                            .padding(.bottom, 4)
                    }
                    .buttonStyle(.plain)
                }
                .padding(10)
                .glass(34)
                .modifier(Entrance(index: 4, shown: shown))
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
        .task {
            let providers = await AuthClient.shared.enabledProviders()
            withAnimation(Motion.snappy) { appleEnabled = providers.contains("apple") }
        }
        .onAppear {
            shown = true
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 18).repeatForever(autoreverses: true)) { drift = true }
        }
        .sheet(isPresented: $showEmail) { EmailSignInSheet() }
        .alert("Sign in with Apple isn't available", isPresented: Binding(get: { appleError != nil }, set: { if !$0 { appleError = nil } })) {
            Button("Continue as guest") { store.session = .guest }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(appleError ?? "")
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, any Error>) {
        switch result {
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let token = String(data: tokenData, encoding: .utf8)
            else {
                appleError = "Apple didn't return a sign-in token. Try again or use email."
                return
            }
            let given = credential.fullName?.givenName
            let family = credential.fullName?.familyName
            working = true
            Task {
                defer { working = false }
                do {
                    _ = try await AuthClient.shared.signInWithApple(idToken: token, nonce: nonce.raw)
                    if let given {
                        store.profile.name = [given, family].compactMap(\.self).joined(separator: " ")
                    }
                    await store.didSignIn(via: .apple)
                } catch {
                    appleError = error.localizedDescription
                }
            }
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            appleError = "Sign in with Apple needs this build to be signed with the capability. Use email, or continue as a guest."
        }
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
