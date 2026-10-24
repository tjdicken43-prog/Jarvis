"use client";

import { useState, useTransition } from "react";
import { goLive, goLiveStep, redraft, resumeStep, reviewCall, setWarmup, skip } from "@/lib/actions";
import { SKIP_REASONS } from "@/lib/reasons";
import type { Client, ReviewCall } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

// Two-step button for anything that can't be undone: the first tap says exactly what will happen
export function ConfirmButton({
  label,
  confirm,
  onConfirm,
  primary = false,
}: {
  label: string;
  confirm: string;
  onConfirm: () => Promise<Result>;
  primary?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  if (!asking)
    return (
      <button className={primary ? "btn primary" : "btn"} disabled={pending} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <span className="confirm" role="group" aria-label={confirm}>
      <span className="small">{confirm}</span>
      <button
        className="btn danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await onConfirm();
            if (r.ok) setAsking(false);
            else setErr(r.error);
          })
        }
      >
        {pending ? "Working..." : "Confirm"}
      </button>
      <button className="btn" disabled={pending} onClick={() => setAsking(false)}>
        Cancel
      </button>
      {err && <span className="err">{err}</span>}
    </span>
  );
}


export function SkipPicker({ id, onClose }: { id: string | number; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <fieldset className="picker">
      <legend className="small muted">Why skip this one? It teaches the next drafts.</legend>
      <div className="choices">
        {SKIP_REASONS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={reason === k ? "choice on" : "choice"}
            aria-pressed={reason === k}
            onClick={() => setReason(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <input id={`skip-note-${id}`} aria-label="Note (optional)" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row">
        <button
          className="btn primary"
          disabled={!reason || pending}
          onClick={() =>
            start(async () => {
              setErr("");
              const r = await skip(id, reason, note);
              if (!r.ok) setErr(r.error);
            })
          }
        >
          {pending ? "Skipping..." : "Skip shop"}
        </button>
        <button className="btn" disabled={pending} onClick={onClose}>Keep it</button>
      </div>
      {err && <p className="err">{err}</p>}
    </fieldset>
  );
}

export function RedraftButton({ id }: { id: string | number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <>
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await redraft(id);
            if (!r.ok) setErr(r.error);
          })
        }
      >
        {pending ? "Rewriting..." : "Redraft"}
      </button>
      {err && <span className="err">{err}</span>}
    </>
  );
}

export function WarmupForm({ started }: { started?: string | null }) {
  const [day, setDay] = useState(started ?? "");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setErr("");
          setMsg("");
          const r = await setWarmup(day);
          if (r.ok) setMsg(r.data.detail);
          else setErr(r.error);
        });
      }}
    >
      <label htmlFor="warmup" className="inline">Inbox warm-up started</label>
      <input id="warmup" type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
      <button className="btn" type="submit" disabled={pending || !day}>Save</button>
      {msg && <span className="muted small" role="status">{msg}</span>}
      {err && <span className="err">{err}</span>}
    </form>
  );
}

const STEP_NAME: Record<string, string> = { send: "Sending", draft: "Drafting", flaw: "Site checks", mockup: "Previews" };

export function StoppedSteps({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <div className="alert" role="alert">
      <p>
        <b>{steps.map((s) => STEP_NAME[s] ?? s).join(", ")} stopped</b> after the same step failed 3 times in a row.{" "}
        <a href="/log?failed=1">See what failed</a>, then resume.
      </p>
      <div className="row">
        {steps.map((s) => (
          <ConfirmButton
            key={s}
            label={`Resume ${STEP_NAME[s]?.toLowerCase() ?? s}`}
            confirm={s === "send" ? "Resume? Sending also needs its own unpause." : "Resume this step?"}
            onConfirm={async () => {
              const r = await resumeStep(s);
              return r.ok ? { ok: true } : r;
            }}
          />
        ))}
      </div>
    </div>
  );
}

const CHECKS: [keyof NonNullable<Client["golive"]>, string, string][] = [
  ["paying", "Paid", "Stripe marks this when the first invoice clears."],
  ["receptionist_built", "Receptionist built", "Save the receptionist above with the Vapi key on."],
  ["test_call", "Test call received", "Call the Vapi number yourself; this ticks when the call shows up below."],
  ["forwarding", "Forwarding works", "After hours, call the shop's own number and make sure the receptionist answers."],
  ["hours", "Hours confirmed by the shop", "Read the hours back to the owner and get a yes."],
];

export function GoLiveChecklist({ c }: { c: Client }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const g = c.golive;
  if (!g) return null;
  const tick = (step: "forwarding" | "hours", done: boolean) =>
    start(async () => {
      setErr("");
      const r = await goLiveStep(c.id, step, done);
      if (!r.ok) setErr(r.error);
    });
  const ready = (c.golive_missing ?? []).length === 0;
  return (
    <div>
      <ol className="checklist">
        {CHECKS.map(([k, label, how]) => (
          <li key={k} className={g[k] ? "done" : ""}>
            <span className="mark" aria-hidden="true">{g[k] ? "✓" : ""}</span>
            <div>
              <div>{label}</div>
              {!g[k] && <div className="muted small">{how}</div>}
            </div>
            {(k === "forwarding" || k === "hours") && (
              <button className="btn" disabled={pending} onClick={() => tick(k, !g[k])}>
                {g[k] ? "Undo" : "Confirmed"}
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="row">
        {c.live_at ? (
          <span className="live">Live since {new Date(c.live_at).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" })}</span>
        ) : (
          <button
            className="btn primary"
            disabled={!ready || pending}
            onClick={() =>
              start(async () => {
                setErr("");
                const r = await goLive(c.id);
                if (!r.ok) setErr(r.error);
              })
            }
          >
            Mark live
          </button>
        )}
        {!ready && !c.live_at && <span className="muted small">{(c.golive_missing ?? []).length} left</span>}
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export function CallReviewList({ calls }: { calls: ReviewCall[] }) {
  if (!calls.length) return <p className="muted small">Nothing to listen to this week.</p>;
  return (
    <ul className="reviews">
      {calls.map((r) => (
        <CallReviewRow key={r.id} r={r} />
      ))}
    </ul>
  );
}

function CallReviewRow({ r }: { r: ReviewCall }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const send = (ok: boolean) =>
    start(async () => {
      setErr("");
      const res = await reviewCall(r.id, ok, note);
      if (!res.ok) setErr(res.error);
    });
  return (
    <li>
      <div className="small">
        {new Date(r.started_at).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" })}
        <span className="muted">, {Math.max(1, Math.round(r.seconds / 60))} min</span>
      </div>
      <p className="small">{r.summary || <span className="muted">No summary</span>}</p>
      <div className="row">
        <input id={`call-note-${r.id}`} aria-label="What was wrong (optional)" placeholder="What was wrong (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn" disabled={pending} onClick={() => send(true)}>Handled well</button>
        <button className="btn" disabled={pending} onClick={() => send(false)}>Needs a fix</button>
      </div>
      {err && <p className="err">{err}</p>}
    </li>
  );
}
