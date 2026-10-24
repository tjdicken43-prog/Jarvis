"use server";

import { revalidatePath } from "next/cache";
import { api, errMsg } from "./api";
import type { ApproveResult, BookingSettings, CheckoutResult, Client, DraftResult, ReceptionistResult, SendResult, Suppression } from "./types";

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
// Skip needs a reason: it's how the factory learns what TJ won't send
export async function skip(id: string | number, reason: string, note: string): Promise<R<unknown>> {
  return run(() => api(`/emails/${id}/cancel`, { method: "POST", body: { reason, note: note.trim() || undefined } }));
}
export async function redraft(id: string | number): Promise<R<unknown>> {
  return run(() => api(`/emails/${id}/redraft`, { method: "POST" }));
}
export async function setWarmup(started: string): Promise<R<{ cap_today: number; detail: string }>> {
  return run(() => api<{ cap_today: number; detail: string }>("/settings/warmup", { method: "POST", body: { started } }));
}
export async function resumeStep(step: string): Promise<R<unknown>> {
  return run(() => api("/settings/resume", { method: "POST", body: { step } }));
}
export async function goLiveStep(id: number, step: "forwarding" | "hours", done: boolean): Promise<R<Client>> {
  return run(() => api<Client>(`/clients/${id}/golive`, { method: "POST", body: { step, done } }));
}
export async function goLive(id: number): Promise<R<Client>> {
  return run(() => api<Client>(`/clients/${id}/live`, { method: "POST" }));
}
export async function reviewCall(id: number, ok: boolean, note: string): Promise<R<unknown>> {
  return run(() => api(`/calls/${id}/review`, { method: "POST", body: { ok, note: note.trim() || undefined } }));
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
// Where the owner's emails go, when the morning summary lands, and the Google review link
export async function saveOwner(id: number, body: { notify_email: string; summary_hour: number; review_url: string }): Promise<R<Client>> {
  return run(() => api<Client>(`/clients/${id}/owner`, { method: "POST", body }));
}
// Plus: booking windows; also updates the Vapi assistant's tools
export async function saveBooking(
  id: number,
  body: Partial<BookingSettings> & { enabled: boolean },
): Promise<R<{ mode: string; booking: BookingSettings | null; calendar_url: string | null }>> {
  return run(() => api(`/clients/${id}/booking`, { method: "POST", body }));
}
// Mark a visit done (queues the Plus review ask) or cancelled
export async function setBooking(id: number, status: string, customer_email?: string): Promise<R<{ review: { queued: boolean; reason?: string; channel?: string } | null }>> {
  return run(() => api(`/bookings/${id}`, { method: "POST", body: { status, customer_email: customer_email?.trim() || undefined } }));
}
export async function askForReview(
  id: number,
  body: { customer_name: string; email?: string; phone?: string; ok_to_text: boolean },
): Promise<R<unknown>> {
  return run(() => api(`/clients/${id}/review-requests`, { method: "POST", body }));
}
// Build the live site from the preview facts (and attach their domain once it points here)
export async function publishSite(id: number, domain: string): Promise<R<{ url: string }>> {
  return run(() => api<{ url: string }>(`/clients/${id}/site`, { method: "POST", body: domain.trim() ? { domain: domain.trim() } : {} }));
}
