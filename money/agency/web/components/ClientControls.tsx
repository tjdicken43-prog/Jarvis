"use client";

import { useState, useTransition } from "react";
import { addClient, checkoutLink, setUpReceptionist } from "@/lib/actions";
import type { Client } from "@/lib/types";

function PlanPicker({ plan, billing, onPlan, onBilling }: {
  plan: string;
  billing: string;
  onPlan: (v: string) => void;
  onBilling: (v: string) => void;
}) {
  return (
    <>
      <select aria-label="Plan" value={plan} onChange={(e) => onPlan(e.target.value)}>
        <option value="front_desk">Front Desk, $149/mo</option>
        <option value="front_desk_plus">Front Desk Plus, $249/mo</option>
      </select>
      <select aria-label="Billing" value={billing} onChange={(e) => onBilling(e.target.value)}>
        <option value="monthly">Monthly</option>
        <option value="annual">Annual (2 months free)</option>
      </select>
    </>
  );
}

export function CheckoutLink(props: { id: number; plan: string; billing: string; url: string | null; stripe: string }) {
  const [plan, setPlan] = useState(props.plan);
  const [billing, setBilling] = useState(props.billing);
  const [url, setUrl] = useState(props.url);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const off = props.stripe !== "test" && props.stripe !== "live";
  return (
    <div className="row wrapx">
      <PlanPicker plan={plan} billing={billing} onPlan={setPlan} onBilling={setBilling} />
      <button
        className="btn primary"
        disabled={pending || off}
        title={off ? "Set a Stripe test key on Render first" : undefined}
        onClick={() =>
          start(async () => {
            setErr("");
            setCopied(false);
            const r = await checkoutLink(props.id, plan, billing);
            if (r.ok) setUrl(r.data.url);
            else setErr(r.error);
          })
        }
      >
        {pending ? "Making link..." : url ? "New checkout link" : "Make checkout link"}
      </button>
      {url && (
        <>
          <a className="grow small" href={url} target="_blank" rel="noreferrer">{url}</a>
          <button
            className="btn"
            onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setErr("Copy failed"))}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </>
      )}
      {off && <p className="muted small grow">Stripe is off. Add a test key (sk_test_) on Render to make links.</p>}
      {err && <p className="err grow">{err}</p>}
    </div>
  );
}

export function AddClientForm() {
  const [f, setF] = useState({ prospect_id: "", business_name: "", email: "", trade: "plumbing" });
  const [plan, setPlan] = useState("front_desk");
  const [billing, setBilling] = useState("monthly");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const fromProspect = f.prospect_id.trim() !== "";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setErr("");
          const r = await addClient(fromProspect ? { prospect_id: f.prospect_id, plan, billing } : { ...f, prospect_id: "", plan, billing });
          if (r.ok) setF({ prospect_id: "", business_name: "", email: "", trade: "plumbing" });
          else setErr(r.error);
        });
      }}
    >
      <label htmlFor="pid">From a shop in the queue (prospect id), or fill in below</label>
      <input id="pid" placeholder="overture/..." value={f.prospect_id} onChange={set("prospect_id")} />
      {!fromProspect && (
        <div className="row wrapx" style={{ marginTop: 8 }}>
          <input aria-label="Business name" placeholder="Business name" value={f.business_name} onChange={set("business_name")} />
          <input aria-label="Email" type="email" placeholder="owner@shop.com" value={f.email} onChange={set("email")} />
          <select aria-label="Trade" value={f.trade} onChange={set("trade")}>
            <option value="plumbing">Plumbing</option>
            <option value="hvac">HVAC</option>
            <option value="roofing">Roofing</option>
          </select>
        </div>
      )}
      <div className="row wrapx" style={{ marginTop: 8 }}>
        <PlanPicker plan={plan} billing={billing} onPlan={setPlan} onBilling={setBilling} />
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Adding..." : "Add client"}</button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

const HOURS = Array.from({ length: 25 }, (_, h) => h);
const hourName = (h: number) => (h === 0 || h === 24 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`);

export function ReceptionistSetup({ c }: { c: Client }) {
  const [open, setOpen] = useState(c.open_hour);
  const [close, setClose] = useState(c.close_hour);
  const [sat, setSat] = useState(c.open_saturday);
  const [text, setText] = useState(c.textback_enabled);
  const [num, setNum] = useState(c.receptionist_number ?? "");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="row wrapx">
      <select aria-label="Opens" value={open} onChange={(e) => setOpen(+e.target.value)}>
        {HOURS.slice(0, 24).map((h) => <option key={h} value={h}>Opens {hourName(h)}</option>)}
      </select>
      <select aria-label="Closes" value={close} onChange={(e) => setClose(+e.target.value)}>
        {HOURS.slice(1).map((h) => <option key={h} value={h}>Closes {hourName(h)}</option>)}
      </select>
      <label className="small"><input type="checkbox" checked={sat} onChange={(e) => setSat(e.target.checked)} /> Open Saturday</label>
      <label className="small"><input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} /> Text back missed callers</label>
      <input aria-label="Receptionist number" placeholder="Vapi number" value={num} onChange={(e) => setNum(e.target.value)} />
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            setMsg("");
            const r = await setUpReceptionist(c.id, {
              open_hour: open, close_hour: close, open_saturday: sat, textback_enabled: text,
              ...(num.trim() ? { receptionist_number: num.trim() } : {}),
            });
            if (r.ok) setMsg(r.data.mode === "vapi" ? "Receptionist saved on Vapi." : "Saved. Dry run: add VAPI_API_KEY on Render to go live.");
            else setErr(r.error);
          })
        }
      >
        {pending ? "Saving..." : c.has_receptionist ? "Update receptionist" : "Set up receptionist"}
      </button>
      {msg && <p className="muted small grow">{msg}</p>}
      {err && <p className="err grow">{err}</p>}
    </div>
  );
}
