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

const INTEREST_ICONS = {
  "Food and drink": "food",
  Architecture: "stay",
  Nature: "leaf",
  "Art and design": "event",
  "Local life": "people",
  "Rest and slow mornings": "cloud",
} as const;

function visualScene(value: string) {
  if (value === "slow and scenic") return "scenic";
  if (value === "city weekends") return "city";
  if (value === "food and culture") return "culture";
  if (value === "outdoors and open air") return "outdoors";
  return "everything";
}

function OnboardingIllustration({
  step,
  draft,
}: {
  step: number;
  draft: OnboardingInput;
}) {
  if (step === 1) {
    return (
      <aside className="ew-onboarding-visual ew-onboarding-visual-start" aria-hidden="true">
        <div className="ew-visual-kicker">YOUR JOURNEY STARTS HERE</div>
        <div className="ew-visual-map">
          <span className="ew-map-orbit ew-map-orbit-one" />
          <span className="ew-map-orbit ew-map-orbit-two" />
          <span className="ew-map-pin ew-map-pin-home"><i /></span>
          <span className="ew-map-pin ew-map-pin-away"><i /></span>
          <span className="ew-map-route" />
          <span className="ew-map-plane"><Icon name="plane" size={30} /></span>
          <span className="ew-map-sun" />
          <span className="ew-map-mountain ew-map-mountain-one" />
          <span className="ew-map-mountain ew-map-mountain-two" />
        </div>
        <div className="ew-visual-caption">
          <span>SETTING OFF FROM</span>
          <strong>{draft.home_base.trim() || "Your home base"}</strong>
        </div>
      </aside>
    );
  }

  if (step === 2) {
    const scene = visualScene(draft.travel_style);
    return (
      <aside className="ew-onboarding-visual ew-onboarding-visual-rhythm" data-scene={scene} aria-hidden="true">
        <div className="ew-visual-kicker">A TRIP IN YOUR RHYTHM</div>
        <div className="ew-rhythm-scene" key={scene}>
          <span className="ew-rhythm-sun" />
          <span className="ew-rhythm-cloud ew-rhythm-cloud-one" />
          <span className="ew-rhythm-cloud ew-rhythm-cloud-two" />
          <span className="ew-rhythm-mountain ew-rhythm-mountain-back" />
          <span className="ew-rhythm-mountain ew-rhythm-mountain-front" />
          <span className="ew-rhythm-city">
            <i /><i /><i /><i />
          </span>
          <span className="ew-rhythm-table"><Icon name="food" size={35} /></span>
          <span className="ew-rhythm-path" />
          <span className="ew-rhythm-traveller"><Icon name="people" size={25} /></span>
        </div>
        <div className="ew-visual-caption">
          <span>YOUR PACE</span>
          <strong>{TRAVEL_STYLES.find((item) => item.value === draft.travel_style)?.label}</strong>
        </div>
      </aside>
    );
  }

  if (step === 3) {
    return (
      <aside className="ew-onboarding-visual ew-onboarding-visual-interests" aria-hidden="true">
        <div className="ew-visual-kicker">THE DETAILS MAKE THE TRIP</div>
        <div className="ew-interest-orbit">
          <span className="ew-interest-orbit-line" />
          <div className="ew-interest-orbit-centre">
            <Icon name="compass" size={42} />
            <small>{draft.interests.length || 0} chosen</small>
          </div>
          {INTERESTS.map((interest, index) => {
            const selected = draft.interests.includes(interest);
            return (
              <span
                className={`ew-interest-orbit-item ew-interest-orbit-${index + 1} ${selected ? "is-selected" : ""}`}
                key={interest}
              >
                <Icon name={INTEREST_ICONS[interest as keyof typeof INTEREST_ICONS]} size={22} />
                <b>{interest}</b>
              </span>
            );
          })}
        </div>
        <div className="ew-visual-caption">
          <span>YOUR TRAVEL THREADS</span>
          <strong>{draft.interests.length ? draft.interests.slice(0, 2).join(" · ") : "Choose what draws you in"}</strong>
        </div>
      </aside>
    );
  }

  const packingLabel = PACKING_STYLES.find((item) => item.value === draft.packing_style)?.label;
  return (
    <aside className="ew-onboarding-visual ew-onboarding-visual-packing" data-packing={draft.packing_style} aria-hidden="true">
      <div className="ew-visual-kicker">PACKED FOR YOUR WAY OF GOING</div>
      <div className="ew-suitcase-scene" key={`${draft.packing_style}-${draft.unit}`}>
        <span className="ew-suitcase-lid" />
        <span className="ew-suitcase-body">
          <i className="ew-packed-item ew-packed-shirt" />
          <i className="ew-packed-item ew-packed-roll" />
          <i className="ew-packed-item ew-packed-extra" />
          <i className="ew-packed-item ew-packed-comfort" />
        </span>
        <span className="ew-suitcase-handle" />
        <span className="ew-suitcase-tag">{draft.unit === "metric" ? "KG" : "LB"}</span>
        <span className="ew-suitcase-spark ew-suitcase-spark-one" />
        <span className="ew-suitcase-spark ew-suitcase-spark-two" />
      </div>
      <div className="ew-visual-caption">
        <span>YOUR PACKING STYLE</span>
        <strong>{packingLabel}</strong>
      </div>
    </aside>
  );
}

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
          <div className="ew-onboarding-stage" key={`onboarding-step-${step}`}>
            <div className="ew-onboarding-copy">
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
            </div>
            <OnboardingIllustration step={step} draft={draft} />
          </div>
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
