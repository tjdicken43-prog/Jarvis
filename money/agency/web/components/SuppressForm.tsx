"use client";

import { useState, useTransition } from "react";
import { addSuppression } from "@/lib/actions";

export function SuppressForm() {
  const [kind, setKind] = useState<"email" | "domain">("domain");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <form
      className="row wrapx"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setErr("");
          const r = await addSuppression(kind, value, reason);
          if (r.ok) {
            setValue("");
            setReason("");
          } else setErr(r.error);
        });
      }}
    >
      <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as "email" | "domain")}>
        <option value="domain">Domain</option>
        <option value="email">Email</option>
      </select>
      <input aria-label="Value" placeholder={kind === "domain" ? "example.com" : "name@example.com"} value={value} onChange={(e) => setValue(e.target.value)} />
      <input aria-label="Reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn primary" type="submit" disabled={pending}>Add</button>
      {err && <p className="err grow">{err}</p>}
    </form>
  );
}
