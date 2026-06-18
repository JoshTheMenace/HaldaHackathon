import { NextResponse } from "next/server";
import { getTenants, resetStore } from "@/lib/store";

// One click to restore a known-good stage before every take.
export async function POST() {
  resetStore();
  return NextResponse.json({ ok: true, tenants: getTenants() });
}
