// Small presentation helpers shared across the mobile app screens.

export type Tab = "home" | "explore" | "profile" | "connect";

export function initials(name?: string): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthDay(iso?: string): { m: string; d: string } | null {
  if (!iso) return null;
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return null;
  return { m: MONTHS[d.getMonth()], d: String(d.getDate()).padStart(2, "0") };
}

export function dueLabel(iso?: string): string {
  const md = monthDay(iso);
  return md ? `Due ${md.m} ${parseInt(md.d, 10)}` : "";
}

export function gradeLabel(g?: number): string {
  if (!g) return "";
  return { 9: "Freshman (9th)", 10: "Sophomore (10th)", 11: "Junior (11th)", 12: "Senior (12th)" }[g] ?? `Grade ${g}`;
}
