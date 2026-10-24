"use server";

import { revalidatePath } from "next/cache";
import { api, errMsg } from "./api";
import type { ApproveResult, CheckoutResult, Client, DraftResult, ReceptionistResult, SendResult, Suppression } from "./types";

type R<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>, reval = true): Promise<R<T>> {
  try {
    const data = await fn();
    if (reval) revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// Flaw finder + mockup + draft for up to 5 new shops (a few seconds per site)
export async function draftNew(): Promise<R<DraftResult>> {
  return run(() => api<DraftResult>("/outreach/prepare", { method: "POST", body: { limit: 5 } }));
}
export async function approve(id: string | number): Promise<R<ApproveResult>> {
  return run(() => api<ApproveResult>(`/emails/${id}/approve`, { method: "POST" }), false);
}
export async function skip(id: string | number): Promise<R<unknown>> {
  return run(() => api(`/emails/${id}/cancel`, { method: "POST" }));
}
export async function sendApproved(): Promise<R<SendResult>> {
  return run(() => api<SendResult>("/send", { method: "POST" }));
}
export async function saveEmail(id: string | number, subject: string, body: string): Promise<R<unknown>> {
  return run(() => api(`/emails/${id}`, { method: "PATCH", body: { subject, body } }));
}
export async function addSuppression(kind: "email" | "domain", value: string, reason: string): Promise<R<Suppression>> {
  const v = value.trim();
  if (!v) return { ok: false, error: "Enter a value" };
  return run(() =>
    api<Suppression>("/suppressions", { method: "POST", body: { [kind]: v, reason: reason.trim() || "manual" } }),
  );
}
// They replied (no more follow-ups) or the address bounced (never email it again)
export async function markReplied(prospectId: string | number): Promise<R<unknown>> {
  return run(() => api(`/prospects/${prospectId}/replied`, { method: "POST" }));
}
export async function markBounced(prospectId: string | number): Promise<R<unknown>> {
  return run(() => api(`/prospects/${prospectId}/bounced`, { method: "POST" }));
}
export async function unapprove(id: string | number): Promise<R<unknown>> {
  return run(() => api(`/emails/${id}/unapprove`, { method: "POST" }));
}
export async function setPaused(paused: boolean): Promise<R<{ paused: boolean }>> {
  return run(() => api<{ paused: boolean }>("/settings/pause", { method: "POST", body: { paused } }));
}
export async function addClient(fields: {
  prospect_id?: string;
  business_name?: string;
  email?: string;
  trade?: string;
  plan: string;
  billing: string;
}): Promise<R<Client>> {
  const body = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, (v ?? "").trim() || undefined]));
  return run(() => api<Client>("/clients", { method: "POST", body }));
}
// Stripe Checkout link (test mode) for TJ to send to the shop
export async function checkoutLink(id: number, plan: string, billing: string): Promise<R<CheckoutResult>> {
  return run(() => api<CheckoutResult>(`/clients/${id}/checkout`, { method: "POST", body: { plan, billing } }));
}
// Save the shop's hours and set up its Vapi receptionist (a dry run until VAPI_API_KEY is on Render)
export async function setUpReceptionist(
  id: number,
  body: { open_hour: number; close_hour: number; open_saturday: boolean; textback_enabled: boolean; receptionist_number?: string },
): Promise<R<ReceptionistResult>> {
  return run(() => api<ReceptionistResult>(`/clients/${id}/receptionist`, { method: "POST", body }));
}
