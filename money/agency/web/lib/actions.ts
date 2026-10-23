"use server";

import { revalidatePath } from "next/cache";
import { api, errMsg } from "./api";
import type { ApproveResult, DraftResult, SendResult, Suppression } from "./types";

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
export async function unapprove(id: string | number): Promise<R<unknown>> {
  return run(() => api(`/emails/${id}/unapprove`, { method: "POST" }));
}
export async function setPaused(paused: boolean): Promise<R<{ paused: boolean }>> {
  return run(() => api<{ paused: boolean }>("/settings/pause", { method: "POST", body: { paused } }));
}
