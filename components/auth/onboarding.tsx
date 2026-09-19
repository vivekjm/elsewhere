"use client";

import React, { useMemo, useState } from "react";
import { Button, Icon } from "@/components/travel/primitives";
import {
  INTERESTS,
  PACKING_STYLES,
  TRAVEL_STYLES,
  useAuth,
  type OnboardingInput,
} from "./auth-context";

const TOTAL_STEPS = 4;

function initialName(email?: string, metadata?: Record<string, unknown>) {
  const fromMetadata = metadata?.display_name;
  if (typeof fromMetadata === "string" && fromMetadata.trim()) return fromMetadata;
  return email?.split("@")[0]?.replace(/[._-]+/g, " ") || "";
}

export function OnboardingFlow({
  onCancel,
  onComplete,
}: {
  onCancel?: () => void;
  onComplete?: () => void;
} = {}) {
  const auth = useAuth();
  const [step, setStep] = useState(1),
    [draft, setDraft] = useState<OnboardingInput>(() => ({
      display_name:
        auth.profile?.display_name ||
        initialName(
          auth.user?.email,
          auth.user?.user_metadata as Record<string, unknown> | undefined,
        ),
      home_base: auth.profile?.home_base || "",
      travel_style: auth.profile?.travel_style || "a little of everything",
      interests:
        auth.profile?.interests?.length
          ? auth.profile.interests
          : ["Food and drink", "Local life"],
      packing_style: auth.profile?.packing_style || "light and considered",
      unit: auth.profile?.unit || "metric",
    })),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  const style = useMemo(
    () => TRAVEL_STYLES.find((item) => item.value === draft.travel_style),
    [draft.travel_style],
  );

  function update<K extends keyof OnboardingInput>(key: K, value: OnboardingInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function toggleInterest(value: string) {
    update(
      "interests",
      draft.interests.includes(value)
        ? draft.interests.filter((interest) => interest !== value)
        : [...draft.interests, value],
    );
  }

  async function next() {
    setError("");
    if (step === 1 && draft.display_name.trim().length < 2) {
      setError("Tell us what we should call you.");
      return;
    }
    if (step === 1 && draft.home_base.trim().length < 2) {
      setError("A home base helps us make the planning feel personal.");
      return;
    }
    if (step === 3 && draft.interests.length === 0) {
      setError("Choose at least one detail you would love more of.");
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep((current) => current + 1);
      return;
    }
    setBusy(true);
    try {
      await auth.completeOnboarding({
        ...draft,
        display_name: draft.display_name.trim(),
        home_base: draft.home_base.trim(),
      });
      onComplete?.();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your preferences. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ew ew-onboarding-shell">
      <section className="ew-onboarding-card" aria-labelledby="onboarding-heading">
        <div className="ew-onboarding-brand">
          <span className="ew-wordmark">
            trips loom<span>.</span>
          </span>
          <span className="ew-onboarding-account">{auth.user?.email}</span>
        </div>
        <div className="ew-onboarding-progress" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
          <span>YOUR TRAVEL PROFILE</span>
          <span>{step} / {TOTAL_STEPS}</span>
          <div><i style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} /></div>
        </div>
        <div className="ew-onboarding-content">
          {step === 1 && (
            <>
              <p className="ew-eyebrow">A GENTLE START</p>
              <h1 id="onboarding-heading">Let’s make this feel like yours.</h1>
              <p className="ew-onboarding-description">
                A couple of small details help Trips Loom suggest the right pace
                and keep the useful things close at hand.
              </p>
              <div className="ew-onboarding-fields">
                <label className="ew-auth-field">
                  <span>What should we call you?</span>
                  <input
                    autoFocus
                    autoComplete="name"
                    value={draft.display_name}
                    onChange={(e) => update("display_name", e.target.value)}
                    placeholder="Your first name or favourite nickname"
                  />
                </label>
                <label className="ew-auth-field">
                  <span>Where do you usually set off from?</span>
                  <input
                    autoComplete="address-level2"
                    value={draft.home_base}
                    onChange={(e) => update("home_base", e.target.value)}
                    placeholder="City or region"
                  />
                </label>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="ew-eyebrow">YOUR KIND OF TRIP</p>
              <h1 id="onboarding-heading">What kind of trips pull you in?</h1>
              <p className="ew-onboarding-description">
                Choose the rhythm that sounds most like you. You can change it anytime.
              </p>
              <div className="ew-choice-grid" role="radiogroup" aria-label="Travel style">
                {TRAVEL_STYLES.map((item) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.travel_style === item.value}
                    className={draft.travel_style === item.value ? "is-selected" : ""}
                    key={item.value}
                    onClick={() => update("travel_style", item.value)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </button>
                ))}
              </div>
              {style && <p className="ew-onboarding-note"><Icon name="leaf" size={16} /> {style.detail}</p>}
            </>
          )}
          {step === 3 && (
            <>
              <p className="ew-eyebrow">THE DETAILS YOU NOTICE</p>
              <h1 id="onboarding-heading">What would you love more of?</h1>
              <p className="ew-onboarding-description">
                Pick a few threads and we’ll keep them in mind when you shape a day.
              </p>
              <div className="ew-interest-grid" role="group" aria-label="Travel interests">
                {INTERESTS.map((interest) => {
                  const selected = draft.interests.includes(interest);
                  return (
                    <button
                      type="button"
                      className={selected ? "is-selected" : ""}
                      aria-pressed={selected}
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                    >
                      <span className="ew-interest-check">{selected ? "✓" : "+"}</span>
                      {interest}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <p className="ew-eyebrow">PACKING, YOUR WAY</p>
              <h1 id="onboarding-heading">How should we help you pack?</h1>
              <p className="ew-onboarding-description">
                We’ll use this preference for packing suggestions and weight summaries.
              </p>
              <div className="ew-choice-grid ew-packing-choice-grid" role="radiogroup" aria-label="Packing style">
                {PACKING_STYLES.map((item) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.packing_style === item.value}
                    className={draft.packing_style === item.value ? "is-selected" : ""}
                    key={item.value}
                    onClick={() => update("packing_style", item.value)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </button>
                ))}
              </div>
              <fieldset className="ew-unit-fieldset">
                <legend>Weight units</legend>
                <label className={draft.unit === "metric" ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="unit"
                    checked={draft.unit === "metric"}
                    onChange={() => update("unit", "metric")}
                  />
                  <span>Kilograms and centimetres</span>
                </label>
                <label className={draft.unit === "imperial" ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="unit"
                    checked={draft.unit === "imperial"}
                    onChange={() => update("unit", "imperial")}
                  />
                  <span>Pounds and inches</span>
                </label>
              </fieldset>
            </>
          )}
          {error && <p className="ew-auth-message ew-auth-error" role="alert"><Icon name="warning" size={16} />{error}</p>}
          <div className="ew-onboarding-actions">
            {step > 1 ? (
              <Button variant="quiet" onClick={() => setStep((current) => current - 1)} disabled={busy}>Back</Button>
            ) : onCancel ? (
              <Button variant="quiet" onClick={onCancel} disabled={busy}>Cancel</Button>
            ) : (
              <span />
            )}
            <Button variant="primary" onClick={() => void next()} disabled={busy}>
              {busy ? "Saving your preferences…" : step === TOTAL_STEPS ? "Open Trips Loom" : "Continue"}
              {!busy && <Icon name="arrow" size={15} />}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
