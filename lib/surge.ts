import "server-only";
import Surge from "@surgeapi/node";

// Thin server-side Surge client for sending SMS. Lives only in API routes — the
// key never reaches the browser. Returns null (and logs) on misconfig/failure so
// a texting hiccup never crashes a turn.
const apiKey = process.env.SURGE_API_KEY;
const ACCOUNT_ID = process.env.SURGE_ACCOUNT_ID;

const client = apiKey ? new Surge({ apiKey }) : null;

export const smsConfigured = () => !!client && !!ACCOUNT_ID;

export async function sendSms(to: string, body: string): Promise<{ id: string } | null> {
  if (!client || !ACCOUNT_ID) {
    console.error("[surge] not configured — set SURGE_API_KEY + SURGE_ACCOUNT_ID");
    return null;
  }
  try {
    const msg = await client.messages.create(ACCOUNT_ID!, { to, body });
    return { id: msg.id ?? "" };
  } catch (err) {
    console.error("[surge] send failed:", (err as { error?: { message?: string }; message?: string })?.error?.message ?? (err as Error).message);
    return null;
  }
}
