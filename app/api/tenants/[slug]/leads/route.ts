import { NextResponse } from "next/server";
import { withTenant } from "@/lib/store";

// Tenant-scoped lead list. withTenant() throws if the slug is missing/unknown,
// so School A can NEVER read School B's leads — isolation is structural.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const scope = withTenant(slug);
    return NextResponse.json({
      tenant: scope.info,
      leads: scope.listLeads(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 403 }
    );
  }
}
