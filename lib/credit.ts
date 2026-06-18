import type { CreditItem, School, StudentProfile } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// "Where will my high-school work actually count?" Per-school AP / dual-enrollment
// credit policies + a creditTransferFit lens. The product insight: it's NOT
// "more credit = better" — it's "the most USABLE credit for your likely path."
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditPolicy {
  apFriendliness: "high" | "medium" | "low";
  minAPScore: 3 | 4 | 5;
  dualTransfer: "easy" | "moderate" | "hard"; // for concurrent/dual enrollment
  capCredits?: number; // max incoming credits accepted
  gradEarlyFriendly: boolean;
  note: string;
}

// Seeded from broadly-true patterns: large publics tend to be generous and
// accept dual-enrollment cleanly (esp. in-state); selective privates take AP but
// often require 4-5 and grant placement over credit.
export const CREDIT_POLICY: Record<string, CreditPolicy> = {
  "ut-austin": { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", capCredits: 60, gradEarlyFriendly: true, note: "Generous AP credit; in-state dual-enrollment transfers cleanly." },
  rice: { apFriendliness: "medium", minAPScore: 4, dualTransfer: "moderate", capCredits: 30, gradEarlyFriendly: false, note: "Takes AP (often 4-5) but leans toward placement; caps transfer credit." },
  tamu: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "AP-friendly; strong in-state dual-enrollment articulation." },
  asu: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "Very generous credit + clear transfer pathways; good for graduating early." },
  colorado: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "AP and concurrent-enrollment friendly, especially in-state." },
  gatech: { apFriendliness: "medium", minAPScore: 4, dualTransfer: "moderate", gradEarlyFriendly: false, note: "Accepts AP (mostly 4-5); rigorous core may limit how much applies to major." },
  uw: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "Generous AP + Running Start/dual-enrollment is built into WA pathways." },
  olin: { apFriendliness: "low", minAPScore: 5, dualTransfer: "hard", capCredits: 0, gradEarlyFriendly: false, note: "Project-based curriculum rarely grants course credit; AP for placement only." },
  rit: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "Credit-friendly; co-op structure pairs well with incoming credit." },
  mtu: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "Accepts AP + dual-enrollment generously." },
  spelman: { apFriendliness: "medium", minAPScore: 3, dualTransfer: "moderate", gradEarlyFriendly: true, note: "Accepts AP and some dual-enrollment toward gen-ed." },
  calpoly: { apFriendliness: "medium", minAPScore: 3, dualTransfer: "moderate", gradEarlyFriendly: false, note: "Learn-by-doing major sequences mean credit often applies to gen-ed, not major." },
  purdue: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "AP-friendly and affordable — strong combo for graduating sooner." },
  northeastern: { apFriendliness: "medium", minAPScore: 4, dualTransfer: "moderate", gradEarlyFriendly: false, note: "Takes AP (often 4-5); co-op timeline can absorb credit differently." },
  utah: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "Generous with AP, and Utah concurrent-enrollment credits transfer in cleanly." },
  byu: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "Accepts AP and concurrent-enrollment credit; a common way to get a head start." },
  uvu: { apFriendliness: "high", minAPScore: 3, dualTransfer: "easy", gradEarlyFriendly: true, note: "Very credit-friendly — built to take your AP/concurrent credit and let you transfer up." },
};

const FR = { high: 1, medium: 0.7, low: 0.35 } as const;
const DT = { easy: 1, moderate: 0.65, hard: 0.3 } as const;
const STATUS_W = { completed: 1, taking: 0.85, planned: 0.6, considering: 0.4 } as const;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function apScoreNum(s?: string): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

const PREMED_RE = /(pre-?med|doctor|physician|medicine|nursing|md\b)/i;
const CORE_SCIENCE = ["science", "biology", "chemistry", "physics"];

export interface CreditFit {
  score: number;
  level: "High" | "Medium" | "Low" | "—";
  summary: string;
  cautions: string[];
}

export function creditTransferFit(p: StudentProfile, s: School): CreditFit {
  const wallet = p.creditWallet ?? [];
  const policy = CREDIT_POLICY[s.id];
  if (!wallet.length || !policy)
    return { score: 60, level: "—", summary: "Add your AP / dual-enrollment classes to see how much would count here.", cautions: [] };

  const inState = !!p.state && p.state === s.state;
  let total = 0;
  let usable = 0;
  const cautions: string[] = [];
  const premed =
    PREMED_RE.test(p.careerGoal ?? "") ||
    (p.intendedMajors ?? []).some((m) => PREMED_RE.test(m)) ||
    (p.interestSignals ?? []).some((x) => PREMED_RE.test(x.interest) && (x.intent === "career_path" || x.intent === "major"));

  for (const c of wallet) {
    const w = STATUS_W[c.status];
    total += w;
    let usability: number;
    if (c.type === "dual_enrollment" || c.type === "clep") {
      usability = DT[policy.dualTransfer] * (inState ? 1 : 0.75);
    } else {
      // AP / IB / honors
      const sc = apScoreNum(c.score);
      const meets = sc === null ? 0.75 : sc >= policy.minAPScore ? 1 : sc >= policy.minAPScore - 1 ? 0.5 : 0.2;
      usability = FR[policy.apFriendliness] * meets;
    }
    usable += w * usability;

    if (premed && CORE_SCIENCE.includes(c.subject.toLowerCase()) && usability > 0.6) {
      cautions.push(`${c.source} could be used to skip intro ${c.subject} here — for a pre-med path, many advisors say take it in college anyway (med schools notice).`);
    }
  }

  const score = clamp((usable / Math.max(1, total)) * 100);
  const level = score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";
  const cap = policy.capCredits === 0 ? " This school grants little course credit (placement only)." : policy.capCredits ? ` Caps incoming credit ~${policy.capCredits}.` : "";
  const summary = `${policy.note}${cap}`;
  return { score, level, summary, cautions: cautions.slice(0, 2) };
}

export function walletPotential(c: CreditItem): string {
  if (c.note) return c.note;
  if (c.type === "dual_enrollment") return "Often transfers at in-state publics";
  if (c.subject?.toLowerCase().includes("writing")) return "May satisfy a writing requirement";
  return "May earn credit or placement, depending on score/school";
}
