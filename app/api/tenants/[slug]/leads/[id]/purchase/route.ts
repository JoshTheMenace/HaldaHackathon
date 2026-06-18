import { NextResponse } from "next/server";
import { withTenant } from "@/lib/store";

// Purchase = spend credits + freeze a redacted snapshot onto the Lead.
// Schools buy a profile, not live access.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  try {
    const scope = withTenant(slug);
    const lead = scope.purchase(id);
    return NextResponse.json({ ok: true, lead, credits: scope.info.leadCredits });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
