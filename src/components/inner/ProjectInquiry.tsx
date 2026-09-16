"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Five-step project brief. The answers are composed into the same payload the
 * plain contact form posts (/api/contact), so storage, spam checks and email
 * delivery are unchanged.
 */
const NEEDS = [
  { id: "ai-product", label: "AI product", hint: "What should it do for the person using it?" },
  { id: "rag", label: "RAG system", hint: "Which documents or knowledge should it answer from?" },
  { id: "automation", label: "Automation", hint: "Which repetitive process is costing the most time?" },
  { id: "data-platform", label: "Data platform", hint: "Which sources need to come together, and for whom?" },
  { id: "analytics", label: "Analytics", hint: "Which decisions should the numbers support?" },
  { id: "mlops", label: "MLOps / LLMOps", hint: "What is already built, and what keeps breaking?" },
  { id: "other", label: "Something else", hint: "Describe the problem in your own words." },
];
const TIMELINES = ["As soon as possible", "Within 1-3 months", "This quarter", "Still exploring"];
const ENGAGEMENTS = ["Fixed-scope project", "Ongoing collaboration", "Advisory / review", "Not sure yet"];

type Status = "idle" | "sending" | "sent" | "error";

export default function ProjectInquiry({ initialNeed }: { initialNeed?: string }) {
  const [step, setStep] = useState(0);
  const [need, setNeed] = useState(
    NEEDS.find((n) => n.id === initialNeed)?.id ?? "",
  );
  const [goal, setGoal] = useState("");
  const [timeline, setTimeline] = useState("");
  const [engagement, setEngagement] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const chosen = NEEDS.find((n) => n.id === need);
  const steps = ["Need", "Goal", "Timeline", "Engagement", "Details"];
  const canAdvance = [Boolean(need), goal.trim().length > 9, Boolean(timeline), Boolean(engagement)][step];

  function go(next: number) {
    setStep(next);
    panel.current?.focus({ preventScroll: true });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const message = [
      `Need: ${chosen?.label ?? "Not specified"}`,
      `Goal: ${goal}`,
      `Timeline: ${timeline}`,
      `Engagement: ${engagement}`,
      data.company ? `Company: ${data.company}` : "",
      data.notes ? `Notes: ${data.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          website: data.website,
          subject: `${chosen?.label ?? "Project"} inquiry`,
          message,
          startedAt: startedAt.current,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "sent") {
    return (
      <div className="ct-form ct-done" role="status">
        <span className="ct-check" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5L19 7" />
          </svg>
        </span>
        <h2>Message received.</h2>
        <p>
          Thanks for the brief - I’ll read it properly and reply by email with
          questions and a suggested first step.
        </p>
      </div>
    );
  }

  return (
    <form className="ct-form" onSubmit={onSubmit}>
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <ol className="ct-steps" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} data-state={i === step ? "current" : i < step ? "done" : "todo"}>
            <button type="button" onClick={() => i < step && go(i)} disabled={i > step}>
              <span className="ct-step-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="ct-step-label">{s}</span>
            </button>
          </li>
        ))}
        <span className="ct-steps-rail" aria-hidden>
          <span style={{ scale: `${step / (steps.length - 1)} 1` }} />
        </span>
      </ol>

      <div className="ct-panel" ref={panel} tabIndex={-1} key={step}>
        {step === 0 && (
          <fieldset>
            <legend className="ct-question">What do you need?</legend>
            <div className="ct-options">
              {NEEDS.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="ct-option"
                  aria-pressed={need === n.id}
                  onClick={() => setNeed(n.id)}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="ct-question">What are you trying to achieve?</legend>
            <p className="ct-hint">{chosen?.hint}</p>
            <label className="ct-field">
              <textarea
                rows={6}
                value={goal}
                minLength={10}
                maxLength={2000}
                placeholder=" "
                onChange={(event) => setGoal(event.target.value)}
              />
              <span>Describe the goal and what’s in the way</span>
            </label>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend className="ct-question">When would you like to start?</legend>
            <div className="ct-options">
              {TIMELINES.map((t) => (
                <button key={t} type="button" className="ct-option" aria-pressed={timeline === t} onClick={() => setTimeline(t)}>
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <legend className="ct-question">How would you like to work together?</legend>
            <div className="ct-options">
              {ENGAGEMENTS.map((e) => (
                <button key={e} type="button" className="ct-option" aria-pressed={engagement === e} onClick={() => setEngagement(e)}>
                  {e}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 4 && (
          <fieldset>
            <legend className="ct-question">How can I reach you?</legend>
            <div className="ct-grid">
              <label className="ct-field">
                <input name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder=" " />
                <span>Your name *</span>
              </label>
              <label className="ct-field">
                <input name="email" type="email" required maxLength={200} autoComplete="email" placeholder=" " />
                <span>Email *</span>
              </label>
            </div>
            <label className="ct-field">
              <input name="company" maxLength={120} autoComplete="organization" placeholder=" " />
              <span>Company (optional)</span>
            </label>
            <label className="ct-field">
              <textarea name="notes" rows={3} maxLength={2000} placeholder=" " />
              <span>Anything else I should know? (optional)</span>
            </label>
            <div className="ct-summary">
              <p className="hm-label">Your brief</p>
              <dl>
                <div>
                  <dt>Need</dt>
                  <dd>{chosen?.label}</dd>
                </div>
                <div>
                  <dt>Timeline</dt>
                  <dd>{timeline}</dd>
                </div>
                <div>
                  <dt>Engagement</dt>
                  <dd>{engagement}</dd>
                </div>
              </dl>
            </div>
          </fieldset>
        )}
      </div>

      {error && (
        <p role="alert" className="ct-error">
          {error}
        </p>
      )}

      <div className="ct-actions">
        {step > 0 && (
          <button type="button" className="hm-link" onClick={() => go(step - 1)}>
            <span aria-hidden>←</span> Back
          </button>
        )}
        {step < 4 ? (
          <button
            type="button"
            className="hm-button"
            disabled={!canAdvance}
            onClick={() => go(step + 1)}
          >
            Continue <span aria-hidden>→</span>
          </button>
        ) : (
          <button type="submit" className="hm-button" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send brief"} <span aria-hidden>↗</span>
          </button>
        )}
        <p className="ct-privacy">
          Your details are only used to reply.{" "}
          <a href="/privacy-policy">Privacy policy</a>
        </p>
      </div>
    </form>
  );
}
