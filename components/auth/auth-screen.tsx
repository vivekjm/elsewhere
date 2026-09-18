"use client";

import React, { useState } from "react";
import { useAuth, type AuthMode } from "./auth-context";
import { Button, Icon } from "@/components/travel/primitives";

function Brand() {
  return (
    <span className="ew-wordmark">
      elsewhere<span>.</span>
    </span>
  );
}

export function AuthLoading({ message = "Making room for the journey." }: { message?: string }) {
  return (
    <main className="ew ew-startup">
      <Brand />
      <span className="ew-startup-icon">
        <Icon name="compass" size={33} />
      </span>
      <h1>{message}</h1>
      <p>Opening your private planning space…</p>
    </main>
  );
}

export function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>(
      auth.recovery ? "recover" : "sign-in",
    ),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmation("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (mode === "sign-up" && name.trim().length < 2) {
      setError("Tell us what we should call you.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (mode === "sign-up" && password !== confirmation) {
      setError("Those passwords do not match.");
      return;
    }
    if (mode === "recover" && password !== confirmation) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "sign-in") {
        await auth.signIn(email, password);
      } else if (mode === "sign-up") {
        const result = await auth.signUp(email, password, name);
        if (result.needsEmailConfirmation) {
          setNotice("Check your email to confirm your account, then come back to Elsewhere.");
        } else {
          setNotice("Your account is ready. Let’s make it yours.");
        }
      } else if (mode === "forgot") {
        await auth.sendPasswordReset(email);
        setNotice("A reset link is on its way. Check your inbox.");
      } else {
        await auth.updatePassword(password);
        setNotice("Your password is updated. Sign in with it next time.");
        switchMode("sign-in");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isConfigured = auth.phase !== "unconfigured" && auth.phase !== "error";
  const heading =
    mode === "sign-up"
      ? "Make room for your next chapter."
      : mode === "forgot"
        ? "A way back to your plans."
        : mode === "recover"
          ? "Choose a new password."
          : "Welcome back to Elsewhere.";
  const description =
    mode === "sign-up"
      ? "Create a private space for the trips, clothes, and details you want to remember."
      : mode === "forgot"
        ? "Enter your email and we’ll send a secure reset link."
        : mode === "recover"
          ? "A strong password keeps every journey in your hands."
          : "Your trips, all together, wherever you are planning from.";

  return (
    <main className="ew ew-auth-shell">
      <section className="ew-auth-story" aria-label="About Elsewhere">
        <div className="ew-auth-brand" aria-label="Elsewhere home">
          <Brand />
        </div>
        <div className="ew-auth-story-copy">
          <p className="ew-eyebrow">A LITTLE SPACE FOR THE JOURNEY</p>
          <h1>Plan the days you’ll talk about for years.</h1>
          <p>
            Elsewhere keeps the route, the wardrobe, and the small details in
            one calm place.
          </p>
        </div>
        <div className="ew-auth-story-foot">
          <Icon name="leaf" size={22} />
          <span>Your plans stay private to your account.</span>
        </div>
      </section>
      <section className="ew-auth-panel" aria-labelledby="auth-heading">
        <div className="ew-auth-panel-inner">
          <div className="ew-auth-mobile-brand">
            <Brand />
          </div>
          {!isConfigured ? (
            <>
              <p className="ew-eyebrow">A SMALL DETOUR</p>
              <h2 id="auth-heading">Sign-in is being connected.</h2>
              <p className="ew-auth-description">
                Supabase is not configured for this environment yet. You can
                still explore the visitor workspace while it is being set up.
              </p>
            </>
          ) : (
            <>
              <p className="ew-eyebrow">{mode === "recover" ? "RESET YOUR PASSWORD" : "WELCOME TO ELSEWHERE"}</p>
              <h2 id="auth-heading">{heading}</h2>
              <p className="ew-auth-description">{description}</p>
            </>
          )}
          {isConfigured && mode !== "recover" && (
            <div className="ew-auth-tabs" role="tablist" aria-label="Account actions">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sign-in"}
                onClick={() => switchMode("sign-in")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sign-up"}
                onClick={() => switchMode("sign-up")}
              >
                Create account
              </button>
            </div>
          )}
          {isConfigured ? (
            <form className="ew-auth-form" onSubmit={submit} noValidate>
              {mode === "sign-up" && (
                <label className="ew-auth-field">
                  <span>Your name</span>
                  <input
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="The name you like to travel by"
                  />
                </label>
              )}
              {mode !== "recover" && (
                <label className="ew-auth-field">
                  <span>Email address</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label className="ew-auth-field">
                  <span>{mode === "recover" ? "New password" : "Password"}</span>
                  <input
                    required
                    type="password"
                    autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </label>
              )}
              {(mode === "sign-up" || mode === "recover") && (
                <label className="ew-auth-field">
                  <span>Confirm password</span>
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="Type it once more"
                  />
                </label>
              )}
              {(error || notice) && (
                <p className={`ew-auth-message ${error ? "ew-auth-error" : ""}`} role={error ? "alert" : "status"}>
                  <Icon name={error ? "warning" : "check"} size={16} />
                  {error || notice}
                </p>
              )}
              <Button variant="primary" type="submit" disabled={busy}>
                {busy
                  ? "Working…"
                  : mode === "sign-in"
                    ? "Sign in"
                    : mode === "sign-up"
                      ? "Create my space"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Update password"}
              </Button>
            </form>
          ) : null}
          {isConfigured && mode === "sign-in" && (
            <button className="ew-auth-link" type="button" onClick={() => switchMode("forgot")}>
              Forgot your password?
            </button>
          )}
          {isConfigured && (mode === "forgot" || mode === "recover") && (
            <button className="ew-auth-link" type="button" onClick={() => switchMode("sign-in")}>
              Back to sign in
            </button>
          )}
          <div className="ew-auth-guest">
            <span>Just looking around?</span>
            <button type="button" onClick={auth.enterGuestMode}>
              Continue as a visitor <Icon name="arrow" size={14} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
