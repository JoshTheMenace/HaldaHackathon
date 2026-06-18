import { NextResponse } from "next/server";
import { getTenants } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ tenants: getTenants() });
}
