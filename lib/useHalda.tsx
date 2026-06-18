"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Channel, ChatMessage, CreditItem, CreditSourceType, CreditStatus, Importance,
  InterestIntent, InterestSignal, ProfileField, StudentProfile, TaskItem,
} from "./types";
import { haldaOpener, respond, type AgentTurn } from "./agent";
import { FIELD_XP, levelFor, reconcileQuests } from "./gamify";
import { profileCompleteness, rankMatches } from "./match";
import { rankInterestMatches } from "./interest-match";
import { SCHOOLS, schoolById } from "./schools";
import type { ProfileUpdates } from "./halda-prompt";

const LS_KEY = "halda.profile.v1";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const schoolIdFor = (name: string) => {
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  return SCHOOLS.find((s) => {
    const short = s.short.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    const full = s.name.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    return n === short || n === full || full.includes(n) || n.includes(short);
  })?.id;
};

// ── Demo persona (Maya) — seeds every screen so the app renders like the design.
// Conversational fields still update live as the student chats. "Start over"
// reloads this persona; chat overwrites name/interests/tasks/etc. in place.
function freshMaya(): StudentProfile {
  return {
    id: "stu_maya",
    name: "Maya Reynolds",
    grade: 12,
    city: "Provo",
    state: "UT",
    highSchool: "Timpview High School",
    interests: ["nursing", "healthcare", "tennis"],
    interestSignals: [
      { interest: "nursing", intent: "career_path", importance: "must_have" },
      { interest: "biology", intent: "major", importance: "high" },
      { interest: "tennis", intent: "serious_extracurricular", importance: "medium" },
    ],
    intendedMajors: ["Nursing"],
    careerGoal: "Nurse Practitioner",
    needsAid: true,
    firstGen: true,
    stayInState: true,
    gpa: "3.85",
    testType: "ACT",
    testScore: "29",
    serviceHours: 42,
    serviceFocus: "Healthcare",
    lettersConfirmed: 2,
    lettersTotal: 3,
    transcriptStatus: "Pending UVU Request",
    scholarships: { applied: 12, won: 3, rejected: 4, pending: 8 },
    extracurriculars: ["HOSA President", "Varsity Tennis", "Science Club"],
    checklistDone: 13,
    checklistTotal: 20,
    savedSchoolIds: ["byu"],
    trackedSchools: [
      { id: "utah", status: "review" },
      { id: "byu", label: "BYU (Nursing)", status: "draft" },
      { id: "uvu", status: "action" },
    ],
    tasks: [
      { id: "t_fafsa", title: "FAFSA Verification", detail: "Completed on Oct 25", due: "2026-11-01", kind: "deadline", status: "done", source: "halda", key: "fafsa" },
      { id: "t_hosa", title: "HOSA Volunteering Plan", detail: "Required for nursing clinical eligibility.", due: "2026-11-15", kind: "todo", status: "open", source: "halda" },
      { id: "t_rec", title: "Letters of Rec", detail: "Contact Bio teacher and Coach.", due: "2026-12-01", kind: "todo", status: "open", source: "halda" },
    ],
    creditWallet: [
      { id: "cr1", source: "AP Biology", type: "ap", subject: "science", status: "completed", score: "4" },
      { id: "cr2", source: "AP English Language", type: "ap", subject: "writing", status: "completed", score: "4" },
      { id: "cr3", source: "Concurrent Enrollment Math 1050", type: "dual_enrollment", subject: "math", status: "completed", score: "A" },
    ],
    xp: 320,
    streak: 4,
    completedQuests: ["q_spark", "q_direction"],
    badges: ["Career Explorer"],
    channelsLinked: ["web"],
    consent: {
      fields: ["name", "grade", "location", "interests", "major", "goal"],
      shareWithPartners: true,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// A blank profile — used by "Start fresh" so the user can onboard from zero.
function freshEmpty(): StudentProfile {
  return {
    id: "stu_maya",
    interests: [], interestSignals: [], intendedMajors: [], tasks: [], creditWallet: [],
    savedSchoolIds: [], xp: 0, streak: 1, completedQuests: [], badges: [], channelsLinked: ["web"],
    consent: { fields: ["name", "grade", "location", "interests", "major", "goal"], shareWithPartners: true },
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

// Fill in any required arrays a persisted profile might be missing, WITHOUT
// re-injecting demo defaults (so a blank saved profile stays blank).
function hydrate(p: StudentProfile): StudentProfile {
  return { ...freshEmpty(), ...p };
}

export type RewardKind = "xp" | "level" | "badge" | "quest" | "match";
export interface RewardEvent {
  id: number;
  kind: RewardKind;
  label: string;
  sub?: string;
}

interface HaldaCtx {
  profile: StudentProfile;
  messages: ChatMessage[];
  smsMessages: ChatMessage[];
  typing: boolean;
  smsTyping: boolean;
  matchesRevealed: boolean;
  events: RewardEvent[];
  clearEvent: (id: number) => void;
  send: (text: string, channel?: Channel) => void;
  reset: () => void;
  startFresh: () => void;
  linkSMS: () => void;
  completeQuest: (id: string, xp: number) => void;
  completeness: number;
  level: ReturnType<typeof levelFor>;
  smsOpen: boolean;
  openSMS: () => void;
  closeSMS: () => void;
  emailOpen: boolean;
  openEmail: () => void;
  closeEmail: () => void;
  // Gemini-powered + manual profile editing + persistence
  applyUpdates: (u: ProfileUpdates) => void;
  editField: <K extends keyof StudentProfile>(k: K, v: StudentProfile[K]) => void;
  toggleSavedSchool: (id: string, save?: boolean) => void;
  upsertInterestSignal: (s: InterestSignal, index?: number) => void;
  removeInterestSignal: (index: number) => void;
  pushHaldaMessage: (text: string, channel?: Channel) => void;
  ingestVoiceUser: (text: string) => void;
  addTasks: (tasks: TaskItem[]) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  addTask: (t: Omit<TaskItem, "id" | "status" | "source">) => void;
  upsertCredit: (c: CreditItem, index?: number) => void;
  removeCredit: (index: number) => void;
  revealMatchesNow: () => void;
  hasSaved: boolean;
}

const Ctx = createContext<HaldaCtx | null>(null);

let _id = 0;
const nid = () => ++_id;

function computeBadges(p: StudentProfile, matchesRevealed: boolean): string[] {
  const want = new Set(p.badges);
  if (p.name) want.add("b_first_steps");
  if (p.grade === 10) want.add("b_early_bird");
  if (matchesRevealed) want.add("b_star_mapper");
  if (p.completedQuests.includes("q_list")) want.add("b_planner");
  if (p.streak >= 3) want.add("b_on_a_roll");
  if (p.channelsLinked.includes("sms")) want.add("b_always_on");
  if (p.completedQuests.includes("q_essay")) want.add("b_wordsmith");
  return [...want];
}

const BADGE_NAME: Record<string, string> = {
  b_first_steps: "First Steps",
  b_early_bird: "Early Bird",
  b_star_mapper: "Star Mapper",
  b_planner: "Planner",
  b_on_a_roll: "On a Roll",
  b_always_on: "Always-On",
  b_wordsmith: "Wordsmith",
};

export function HaldaProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile>(freshMaya);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "m0", role: "halda", channel: "web", text: haldaOpener(), ts: Date.now(),
      chips: ["Hey Halda 👋", "Let's go"] },
  ]);
  const [smsMessages, setSmsMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [smsTyping, setSmsTyping] = useState(false);
  const [matchesRevealed, setMatchesRevealed] = useState(false);
  const [events, setEvents] = useState<RewardEvent[]>([]);
  const [smsOpen, setSmsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const pendingRef = useRef(pendingAction);
  pendingRef.current = pendingAction;
  const turnRef = useRef(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const revealedRef = useRef(matchesRevealed);
  revealedRef.current = matchesRevealed;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const applyUpdatesRef = useRef<(u: ProfileUpdates, opts?: { tasks?: TaskItem[]; reveal?: boolean }) => void>(() => {});

  const emit = useCallback((evs: Omit<RewardEvent, "id">[]) => {
    if (!evs.length) return;
    setEvents((cur) => [...cur, ...evs.map((e) => ({ ...e, id: nid() }))]);
  }, []);

  const clearEvent = useCallback((id: number) => {
    setEvents((cur) => cur.filter((e) => e.id !== id));
  }, []);

  // fire-and-forget server sync so the partner console reflects the live Maya
  const sync = useCallback((p: StudentProfile) => {
    fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }).catch(() => {});
  }, []);

  const applyTurn = useCallback(
    async (text: string, channel: Channel) => {
      const base = profileRef.current;
      const prevLevel = levelFor(base.xp).current.level;

      // The SMS channel goes through the real server brain (POST /api/chat) —
      // a genuine cross-channel round-trip — with a local fallback so a flaky
      // network can never break the marquee demo moment.
      let result: AgentTurn;
      if (channel === "sms") {
        try {
          const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile: base, message: text, turn: turnRef.current,
              channel: "sms", revealed: revealedRef.current,
            }),
          });
          if (!r.ok) throw new Error("api");
          result = await r.json();
        } catch {
          result = respond(base, text, turnRef.current, revealedRef.current);
        }
        turnRef.current++;
      } else {
        result = respond(base, text, turnRef.current++, revealedRef.current);
      }

      // Build the next profile immutably.
      const next: StudentProfile = {
        ...base,
        ...result.patch,
        interests: result.patch.interests ?? [...base.interests],
        intendedMajors: result.patch.intendedMajors ?? [...base.intendedMajors],
        completedQuests: [...base.completedQuests],
        badges: [...base.badges],
        channelsLinked: [...base.channelsLinked],
      };
      next.xp += result.reward?.xp ?? 0;

      const evs: Omit<RewardEvent, "id">[] = [];
      if (result.reward?.xp) evs.push({ kind: "xp", label: `+${result.reward.xp} XP` });

      const { newlyDone } = reconcileQuests(next);
      for (const q of newlyDone)
        evs.push({ kind: "quest", label: "Quest complete", sub: q.title });

      const willReveal = result.revealMatches || revealedRef.current;
      const before = new Set(next.badges);
      next.badges = computeBadges(next, willReveal);
      for (const b of next.badges)
        if (!before.has(b))
          evs.push({ kind: "badge", label: "Badge earned", sub: BADGE_NAME[b] || b });

      const newLevel = levelFor(next.xp).current;
      if (newLevel.level > prevLevel)
        evs.push({ kind: "level", label: `Level ${newLevel.level}`, sub: newLevel.name });

      next.updatedAt = Date.now();
      setProfile(next);
      sync(next);

      if (result.revealMatches && !revealedRef.current) {
        setMatchesRevealed(true);
        evs.push({ kind: "match", label: "Constellation lit", sub: "Right-fit matches unlocked" });
      }

      // Outgoing Halda message (with a human typing beat).
      const setMsgs = channel === "sms" ? setSmsMessages : setMessages;
      const setT = channel === "sms" ? setSmsTyping : setTyping;
      setT(true);
      const delay = Math.min(1100, 350 + result.text.length * 6);
      window.setTimeout(() => {
        setT(false);
        setMsgs((cur) => [
          ...cur,
          {
            id: `h${nid()}`,
            role: "halda",
            channel,
            text: result.text,
            chips: result.chips,
            ts: Date.now(),
            reward: result.reward,
          },
        ]);
        emit(evs);
      }, delay);
    },
    [emit, sync]
  );

  // Post-reveal action chips: real sub-flows that complete quests + grant badges,
  // so the experience deepens past the reveal instead of looping.
  const haldaSay = useCallback((text: string, channel: Channel, after?: () => void) => {
    const setMsgs = channel === "sms" ? setSmsMessages : setMessages;
    const setT = channel === "sms" ? setSmsTyping : setTyping;
    setT(true);
    window.setTimeout(() => {
      setT(false);
      setMsgs((cur) => [...cur, { id: `h${nid()}`, role: "halda", channel, text, ts: Date.now() }]);
      after?.();
    }, 750);
  }, []);

  const awardQuest = useCallback(
    (id: string, xp: number, extraEvents: Omit<RewardEvent, "id">[] = []) => {
      const base = profileRef.current;
      if (base.completedQuests.includes(id)) { emit(extraEvents); return; }
      const prevLevel = levelFor(base.xp).current.level;
      const next: StudentProfile = {
        ...base, completedQuests: [...base.completedQuests, id],
        badges: [...base.badges], xp: base.xp + xp,
      };
      next.badges = computeBadges(next, revealedRef.current);
      setProfile(next); sync(next);
      const evs: Omit<RewardEvent, "id">[] = [{ kind: "xp", label: `+${xp} XP` }, ...extraEvents];
      if (levelFor(next.xp).current.level > prevLevel)
        evs.push({ kind: "level", label: `Level ${levelFor(next.xp).current.level}`, sub: levelFor(next.xp).current.name });
      emit(evs);
    },
    [emit, sync]
  );

  const runAction = useCallback(
    (kind: "essay" | "aid" | "list", channel: Channel) => {
      const base = profileRef.current;
      const top = rankMatches(base, 5).map((m) => ({ m, s: schoolById(m.schoolId)! }));
      if (kind === "essay") {
        setPendingAction("essay");
        haldaSay(
          `let's bank a story only you could tell — junior-you will thank you (+50 XP). 🌱\n\nquick one: tell me about a time something didn't go how you planned. don't overthink it — first thing that comes to mind.`,
          channel
        );
      } else if (kind === "aid") {
        const cheap = [...top].sort((a, b) => a.s.netPrice - b.s.netPrice).slice(0, 2);
        const lines = cheap.map((c) => `• ${c.s.short} — ~$${c.s.netPrice.toLocaleString()}/yr net`).join("\n");
        haldaSay(
          `on it 💸 two real aid wins for a ${base.intendedMajors[0] || "student"} like you:\n\n${lines}\n\nthe number that matters is net price, not sticker. saved to your money map — quest complete!`,
          channel,
          () => awardQuest("q_aid", 45)
        );
      } else {
        const byReach = (r: string) => top.find((t) => t.m.reach === r)?.s.short;
        const names = [byReach("reach"), byReach("target"), byReach("safety")].filter(Boolean) as string[];
        haldaSay(
          `love it — a balanced list is how you end up with options, not regrets 📌\n\nlocking in: ${names.join(" · ")} — a healthy mix of reach / target / safety. you can always add more.`,
          channel,
          () => awardQuest("q_list", 45, [{ kind: "badge", label: "Badge earned", sub: "Planner" }])
        );
      }
    },
    [haldaSay, awardQuest]
  );

  const handleEssaySeed = useCallback(
    (text: string, channel: Channel) => {
      setPendingAction(null);
      const base = profileRef.current;
      const next: StudentProfile = {
        ...base,
        completedQuests: base.completedQuests.includes("q_essay")
          ? [...base.completedQuests]
          : [...base.completedQuests, "q_essay"],
        badges: [...base.badges],
        careerGoal: base.careerGoal,
        xp: base.xp + (base.completedQuests.includes("q_essay") ? 0 : 50),
      };
      next.badges = computeBadges(next, revealedRef.current);
      setProfile(next); sync(next);
      emit([
        { kind: "quest", label: "Quest complete", sub: "Essay spark" },
        { kind: "xp", label: "+50 XP" },
        { kind: "badge", label: "Badge earned", sub: "Wordsmith" },
      ]);
      haldaSay(
        `that's IT — that's a real story. 🌱 saved as your essay seed. when junior year comes we'll build it into something great. you just made future-you's life way easier.`,
        channel
      );
    },
    [emit, sync, haldaSay]
  );

  const actionOf = (t: string): "essay" | "aid" | "list" | null => {
    if (/start my essay/i.test(t)) return "essay";
    if (/build my list/i.test(t)) return "list";
    return null;
  };

  // Gemini-powered text turn (warm reply + structured extraction), with the
  // deterministic scripted engine as a b/ never-fails fallback.
  const geminiTurn = useCallback(
    async (text: string, channel: Channel) => {
      const setT = channel === "sms" ? setSmsTyping : setTyping;
      setT(true);
      const base = profileRef.current;
      const history = (channel === "sms" ? [] : messagesRef.current)
        .filter((m) => !m.tool) // tool-call chips aren't part of the conversation
        .slice(-8)
        .map((m) => ({ role: m.role === "student" ? ("user" as const) : ("model" as const), text: m.text }));
      try {
        const r = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat", message: text, history, profile: base, matchesRevealed: revealedRef.current }),
        });
        const d = await r.json();
        if (!d.reply && !d.updates) throw new Error("empty");
        applyUpdatesRef.current(d.updates || {}, { tasks: d.tasks, reveal: d.revealMatches });
        setT(false);
        const chips = revealedRef.current
          ? ["Start my essay ✍️", "Find scholarships 💸", "Build my list 📌"]
          : undefined;
        const toolMsgs: ChatMessage[] = ((d.toolEvents as ChatMessage["tool"][]) || []).map((te) => ({
          id: `t${nid()}`, role: "system", channel, text: te!.label, ts: Date.now(), tool: te,
        }));
        const setMsgs = channel === "sms" ? setSmsMessages : setMessages;
        setMsgs((cur) => [
          ...cur,
          // Halda's words first, then the cards/chips she's referring to.
          { id: `h${nid()}`, role: "halda", channel, text: d.reply || "Got it. 👍", chips, ts: Date.now() },
          ...toolMsgs,
        ]);
      } catch {
        setT(false);
        applyTurn(text, channel); // deterministic fallback
      }
    },
    [applyTurn]
  );

  const send = useCallback(
    (text: string, channel: Channel = "web") => {
      const clean = text.trim();
      if (!clean) return;
      const setMsgs = channel === "sms" ? setSmsMessages : setMessages;
      setMsgs((cur) => [
        ...cur,
        { id: `u${nid()}`, role: "student", channel, text: clean, ts: Date.now() },
      ]);
      const action = actionOf(clean);
      if (action) { runAction(action, channel); return; }
      if (pendingRef.current === "essay") { handleEssaySeed(clean, channel); return; }
      if (
        revealedRef.current &&
        /\b(essay|personal statement|write my story)\b/i.test(clean) &&
        /\?|\b(how|help|start|write|begin|idea)\b/i.test(clean)
      ) {
        runAction("essay", channel);
        return;
      }
      // SMS keeps its server round-trip; web/voice text uses the Gemini brain.
      if (channel === "sms") applyTurn(clean, channel);
      else geminiTurn(clean, channel);
    },
    [applyTurn, geminiTurn, runAction, handleEssaySeed]
  );

  const resetTo = useCallback((profile: StudentProfile) => {
    setProfile(profile);
    setMessages([
      { id: "m0", role: "halda", channel: "web", text: haldaOpener(), ts: Date.now(),
        chips: ["Hey Halda 👋", "Let's go"] },
    ]);
    setSmsMessages([]);
    setMatchesRevealed(false);
    setEvents([]);
    setSmsOpen(false);
    setEmailOpen(false);
    setPendingAction(null);
    setHasSaved(false);
    turnRef.current = 0;
    try { localStorage.setItem(LS_KEY, JSON.stringify(profile)); } catch {}
  }, []);

  // Reload the seeded demo persona (Maya).
  const reset = useCallback(() => { resetTo(freshMaya()); }, [resetTo]);
  // Wipe to a blank profile to onboard from scratch.
  const startFresh = useCallback(() => { resetTo(freshEmpty()); }, [resetTo]);

  const linkSMS = useCallback(() => {
    const base = profileRef.current;
    if (base.channelsLinked.includes("sms")) return;
    const next = { ...base, channelsLinked: [...base.channelsLinked, "sms" as Channel], xp: base.xp + 15 };
    next.badges = computeBadges(next, revealedRef.current);
    setProfile(next);
    sync(next);
    emit([
      { kind: "xp", label: "+15 XP", sub: "Omnichannel bonus" },
      { kind: "badge", label: "Badge earned", sub: "Always-On" },
    ]);
    // Halda greets her on the new channel, by name, with REAL recalled facts.
    const bits = [
      base.intendedMajors[0],
      base.city ? `near ${base.city}` : null,
      base.needsAid
        ? "saving for aid"
        : base.maxBudget
          ? `~$${Math.round(base.maxBudget / 1000)}k budget`
          : null,
    ].filter(Boolean) as string[];
    const memory = bits.length
      ? `Same me, same memory: ${bits.join(", ")}.`
      : "Same me, same memory — nothing lost.";
    setSmsMessages([
      {
        id: `sms0`,
        role: "halda",
        channel: "sms",
        text: `Hey ${base.name || "you"} 👋 it's Halda — now on your phone. ${memory} Text me literally anytime. 🔭`,
        ts: Date.now(),
      },
    ]);
  }, [emit, sync]);

  const openSMS = useCallback(() => {
    linkSMS();
    setSmsOpen(true);
  }, [linkSMS]);
  const closeSMS = useCallback(() => setSmsOpen(false), []);

  const openEmail = useCallback(() => {
    const base = profileRef.current;
    if (!base.channelsLinked.includes("email")) {
      const next = { ...base, channelsLinked: [...base.channelsLinked, "email" as Channel] };
      setProfile(next);
      sync(next);
    }
    setEmailOpen(true);
  }, [sync]);
  const closeEmail = useCallback(() => setEmailOpen(false), []);

  const completeQuest = useCallback(
    (id: string, xp: number) => {
      const base = profileRef.current;
      if (base.completedQuests.includes(id)) return;
      const next: StudentProfile = {
        ...base,
        completedQuests: [...base.completedQuests, id],
        badges: [...base.badges],
        xp: base.xp + xp,
      };
      const prevLevel = levelFor(base.xp).current.level;
      next.badges = computeBadges(next, revealedRef.current);
      setProfile(next);
      sync(next);
      const evs: Omit<RewardEvent, "id">[] = [
        { kind: "quest", label: "Quest complete", sub: id },
        { kind: "xp", label: `+${xp} XP` },
      ];
      const newLevel = levelFor(next.xp).current;
      if (newLevel.level > prevLevel)
        evs.push({ kind: "level", label: `Level ${newLevel.level}`, sub: newLevel.name });
      emit(evs);
    },
    [emit, sync]
  );

  // ── Apply structured updates (from Gemini text OR voice transcript extraction).
  // Tasks + match-reveal are folded into ONE setProfile so the calls in a single
  // agent turn don't clobber each other (they'd each read stale state otherwise).
  const applyUpdates = useCallback(
    (u: ProfileUpdates, opts?: { tasks?: TaskItem[]; reveal?: boolean }) => {
      const base = profileRef.current;
      const prevLevel = levelFor(base.xp).current.level;
      const next: StudentProfile = {
        ...base,
        completedQuests: [...base.completedQuests],
        badges: [...base.badges],
        interests: [...base.interests],
        intendedMajors: [...base.intendedMajors],
        interestSignals: [...base.interestSignals],
        channelsLinked: [...base.channelsLinked],
      };
      const learned = new Set<ProfileField>();
      const setIf = <K extends keyof StudentProfile>(k: K, val: StudentProfile[K] | undefined, f: ProfileField) => {
        if (val !== undefined && val !== null && (val as unknown) !== "" && next[k] !== val) { next[k] = val; learned.add(f); }
      };
      setIf("name", u.name as StudentProfile["name"], "name");
      if (u.grade) setIf("grade", u.grade, "grade");
      if (u.highSchool) setIf("highSchool", u.highSchool, "location");
      if (u.firstGen !== undefined && next.firstGen !== u.firstGen) next.firstGen = u.firstGen;
      if (u.city) setIf("city", u.city, "location");
      if (u.state) setIf("state", u.state, "location");
      if (u.zip) setIf("zip", u.zip, "location");
      setIf("careerGoal", u.careerGoal, "goal");
      setIf("settingPref", u.settingPref as StudentProfile["settingPref"], "setting");
      setIf("sizePref", u.sizePref as StudentProfile["sizePref"], "size");
      if (u.maxBudget) setIf("maxBudget", u.maxBudget, "budget");
      if (u.needsAid !== undefined) setIf("needsAid", u.needsAid, "budget");
      if (u.intendedMajors?.length) {
        const merged = Array.from(new Set([...next.intendedMajors, ...u.intendedMajors]));
        if (merged.length !== next.intendedMajors.length) { next.intendedMajors = merged; learned.add("major"); }
      }
      if (u.interestSignals?.length) {
        for (const s of u.interestSignals) {
          const key = s.interest.toLowerCase().trim();
          const idx = next.interestSignals.findIndex((x) => x.interest.toLowerCase().trim() === key);
          const sig: InterestSignal = {
            interest: s.interest, intent: s.intent as InterestIntent,
            importance: (s.importance as Importance) || "medium",
            evidenceQuote: s.evidenceQuote, source: "text",
          };
          if (idx >= 0) next.interestSignals[idx] = { ...next.interestSignals[idx], ...sig };
          else next.interestSignals.push(sig);
          if (!next.interests.some((x) => x.toLowerCase() === key)) next.interests.push(cap(s.interest));
        }
        learned.add("interests");
      }
      if (u.creditItems?.length) {
        next.creditWallet = [...next.creditWallet];
        for (const c of u.creditItems) {
          const key = c.source.toLowerCase().trim();
          const idx = next.creditWallet.findIndex((x) => x.source.toLowerCase().trim() === key);
          const item: CreditItem = {
            id: idx >= 0 ? next.creditWallet[idx].id : `cr_${nid()}`,
            source: c.source, type: (c.type as CreditSourceType) || "ap",
            subject: c.subject || "general", status: (c.status as CreditStatus) || "considering",
            score: c.score, note: c.note,
          };
          if (idx >= 0) next.creditWallet[idx] = item;
          else next.creditWallet.push(item);
        }
      }
      if (u.chosenSchools?.length) {
        const ids = u.chosenSchools.map(schoolIdFor).filter(Boolean) as string[];
        if (ids.length) next.savedSchoolIds = Array.from(new Set([...(next.savedSchoolIds ?? []), ...ids]));
      }

      // fold in any tasks the agent added (dedup by key/title)
      const newTasks: TaskItem[] = [];
      if (opts?.tasks?.length) {
        const have = new Set(base.tasks.map((t) => t.key || t.title));
        for (const t of opts.tasks) if (!have.has(t.key || t.title)) newTasks.push(t);
        if (newTasks.length) next.tasks = [...base.tasks, ...newTasks];
      }

      let xpGain = 0;
      for (const f of learned) xpGain += FIELD_XP[f] || 0;
      next.xp += xpGain;

      const { newlyDone } = reconcileQuests(next);
      const willReveal = revealedRef.current || opts?.reveal === true || profileCompleteness(next) >= 55;
      const beforeBadges = new Set(next.badges);
      next.badges = computeBadges(next, willReveal);
      next.updatedAt = Date.now();
      setProfile(next);
      sync(next);

      const evs: Omit<RewardEvent, "id">[] = [];
      if (xpGain) evs.push({ kind: "xp", label: `+${xpGain} XP` });
      for (const q of newlyDone) evs.push({ kind: "quest", label: "Quest complete", sub: q.title });
      for (const b of next.badges) if (!beforeBadges.has(b)) evs.push({ kind: "badge", label: "Badge earned", sub: BADGE_NAME[b] || b });
      if (willReveal && !revealedRef.current) { setMatchesRevealed(true); evs.push({ kind: "match", label: "Matches unlocked", sub: "Interest-based fits" }); }
      for (const t of newTasks) evs.push({ kind: "match", label: "Added to your list", sub: t.title });
      const nl = levelFor(next.xp).current;
      if (nl.level > prevLevel) evs.push({ kind: "level", label: `Level ${nl.level}`, sub: nl.name });
      emit(evs);
    },
    [emit, sync]
  );
  applyUpdatesRef.current = applyUpdates;

  const editField = useCallback(
    <K extends keyof StudentProfile>(k: K, v: StudentProfile[K]) => {
      const next = { ...profileRef.current, [k]: v, updatedAt: Date.now() };
      setProfile(next);
      sync(next);
    },
    [sync]
  );

  // Swipe-right / swipe-left a school on the Explore tab.
  const toggleSavedSchool = useCallback(
    (id: string, save?: boolean) => {
      const base = profileRef.current;
      const cur = base.savedSchoolIds ?? [];
      const has = cur.includes(id);
      const want = save ?? !has;
      const savedSchoolIds = want ? (has ? cur : [...cur, id]) : cur.filter((x) => x !== id);
      const next = { ...base, savedSchoolIds, updatedAt: Date.now() };
      setProfile(next);
      sync(next);
    },
    [sync]
  );

  const upsertInterestSignal = useCallback(
    (s: InterestSignal, index?: number) => {
      const base = profileRef.current;
      const list = [...base.interestSignals];
      if (index !== undefined && index >= 0 && index < list.length) list[index] = { ...s, source: "manual" };
      else list.push({ ...s, source: "manual" });
      const interests = Array.from(new Set([...base.interests, cap(s.interest)]));
      const next = { ...base, interestSignals: list, interests, updatedAt: Date.now() };
      setProfile(next);
      sync(next);
    },
    [sync]
  );

  const removeInterestSignal = useCallback(
    (index: number) => {
      const base = profileRef.current;
      const list = base.interestSignals.filter((_, i) => i !== index);
      const next = { ...base, interestSignals: list, updatedAt: Date.now() };
      setProfile(next);
      sync(next);
    },
    [sync]
  );

  // ── Tasks & deadlines ────────────────────────────────────────────────────────
  const addTasks = useCallback((tasks: TaskItem[]) => {
    if (!tasks.length) return;
    const base = profileRef.current;
    const have = new Set(base.tasks.map((t) => t.key || t.title));
    const fresh = tasks.filter((t) => !have.has(t.key || t.title));
    if (!fresh.length) return;
    const next = { ...base, tasks: [...base.tasks, ...fresh], updatedAt: Date.now() };
    setProfile(next);
    sync(next);
    emit(fresh.map((t) => ({ kind: "match" as const, label: "Added to your list", sub: t.title })));
  }, [emit, sync]);

  const addTask = useCallback((t: Omit<TaskItem, "id" | "status" | "source">) => {
    addTasks([{ ...t, id: `task_${nid()}`, status: "open", source: "manual" }]);
  }, [addTasks]);

  const toggleTask = useCallback((id: string) => {
    const base = profileRef.current;
    const next = { ...base, tasks: base.tasks.map((t) => t.id === id ? { ...t, status: t.status === "open" ? "done" as const : "open" as const } : t), updatedAt: Date.now() };
    setProfile(next);
    sync(next);
  }, [sync]);

  const removeTask = useCallback((id: string) => {
    const base = profileRef.current;
    const next = { ...base, tasks: base.tasks.filter((t) => t.id !== id), updatedAt: Date.now() };
    setProfile(next);
    sync(next);
  }, [sync]);

  // ── Credit wallet ────────────────────────────────────────────────────────────
  const upsertCredit = useCallback((c: CreditItem, index?: number) => {
    const base = profileRef.current;
    const list = [...base.creditWallet];
    const item = { ...c, id: c.id || `cr_${nid()}` };
    if (index !== undefined && index >= 0 && index < list.length) list[index] = item;
    else list.push(item);
    const next = { ...base, creditWallet: list, updatedAt: Date.now() };
    setProfile(next);
    sync(next);
  }, [sync]);

  const removeCredit = useCallback((index: number) => {
    const base = profileRef.current;
    const next = { ...base, creditWallet: base.creditWallet.filter((_, i) => i !== index), updatedAt: Date.now() };
    setProfile(next);
    sync(next);
  }, [sync]);

  const revealMatchesNow = useCallback(() => {
    if (revealedRef.current) return;
    setMatchesRevealed(true);
    emit([{ kind: "match", label: "Matches unlocked", sub: "Right-fit schools" }]);
  }, [emit]);

  const pushHaldaMessage = useCallback((text: string, channel: Channel = "web") => {
    const setMsgs = channel === "sms" ? setSmsMessages : setMessages;
    setMsgs((cur) => [...cur, { id: `h${nid()}`, role: "halda", channel, text, ts: Date.now() }]);
  }, []);

  // Voice: echo what the student said into the unified transcript, then extract
  // structured profile updates from it (same brain as text, just a microphone).
  const ingestVoiceUser = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMessages((cur) => [...cur, { id: `u${nid()}`, role: "student", channel: "voice", text: clean, ts: Date.now() }]);
    const base = profileRef.current;
    fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "extract", message: clean, profile: base, matchesRevealed: revealedRef.current }),
    })
      .then((r) => r.json())
      .then((d) => applyUpdatesRef.current(d?.updates || {}, { tasks: d?.tasks, reveal: d?.revealMatches }))
      .catch(() => {});
  }, []);

  // ── Persistence: resume an unfinished session ────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        // Use the saved profile AS-IS (hydrated) so a "Start fresh" blank slate
        // persists across refreshes instead of re-seeding the demo persona.
        const saved = JSON.parse(raw) as StudentProfile;
        if (saved && saved.id) {
          const h = hydrate(saved);
          setProfile(h);
          setHasSaved(true);
          if (profileCompleteness(saved) >= 55) setMatchesRevealed(true);
          // Re-push to server store so email/SMS lookups work after a restart.
          sync(h);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(profile)); } catch {}
  }, [profile]);

  const value = useMemo<HaldaCtx>(
    () => ({
      profile,
      messages,
      smsMessages,
      typing,
      smsTyping,
      matchesRevealed,
      events,
      clearEvent,
      send,
      reset,
      startFresh,
      linkSMS,
      completeQuest,
      completeness: profileCompleteness(profile),
      level: levelFor(profile.xp),
      smsOpen,
      openSMS,
      closeSMS,
      emailOpen,
      openEmail,
      closeEmail,
      applyUpdates,
      editField,
      toggleSavedSchool,
      upsertInterestSignal,
      removeInterestSignal,
      pushHaldaMessage,
      ingestVoiceUser,
      addTasks,
      toggleTask,
      removeTask,
      addTask,
      upsertCredit,
      removeCredit,
      revealMatchesNow,
      hasSaved,
    }),
    [profile, messages, smsMessages, typing, smsTyping, matchesRevealed, events,
      clearEvent, send, reset, startFresh, linkSMS, completeQuest,
      smsOpen, openSMS, closeSMS, emailOpen, openEmail, closeEmail,
      applyUpdates, editField, toggleSavedSchool, upsertInterestSignal, removeInterestSignal,
      pushHaldaMessage, ingestVoiceUser, addTasks, toggleTask, removeTask,
      addTask, upsertCredit, removeCredit, revealMatchesNow, hasSaved]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHalda(): HaldaCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useHalda must be used within HaldaProvider");
  return c;
}

export function useMatches() {
  const { profile, matchesRevealed } = useHalda();
  return useMemo(
    () => (matchesRevealed ? rankMatches(profile, 6) : []),
    [profile, matchesRevealed]
  );
}
