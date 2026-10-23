
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const base = (process.env.API_URL || "http://localhost:8000").replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: init.method || "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.OPERATOR_TOKEN ?? ""}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the API");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const d = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, typeof d === "string" ? d : `API error ${res.status}`);
  }
  return data as T;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}
