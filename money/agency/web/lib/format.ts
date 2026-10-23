export function usd(cents: number | null | undefined) {
  if (cents == null) return "";
  const d = cents / 100;
  return "$" + d.toLocaleString("en-US", { minimumFractionDigits: d % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export const PLAN_NAME: Record<string, string> = { front_desk: "Front Desk", front_desk_plus: "Front Desk Plus" };
