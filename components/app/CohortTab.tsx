"use client";

import { useMemo, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { tr } from "@/lib/i18n";
import { rankInterestMatches, schoolById } from "@/lib/interest-match";
import {
  COHORT_PEERS, peerById, postsFor, pathwayFor, pathwayShort, cohortSize, cohortFaces,
  type CohortPost,
} from "@/lib/cohort";
import { dueLabel } from "./helpers";
import { Icon } from "./Icon";

const REPORT_REASONS: [string, string, boolean][] = [
  ["Bullying or harassment", "sentiment_dissatisfied", true],
  ["Inappropriate or unsafe content", "report", true],
  ["Someone shared personal info", "shield_person", false],
  ["Spam or scam", "block", false],
  ["Something else", "more_horiz", false],
];
const GUIDELINES: [string, string, string][] = [
  ["verified_user", "Verified students only", "This cohort is private to confirmed Class of 2025 students at your school — never the open internet."],
  ["smart_toy", "AI-moderated, students only", "Halda's AI screens every post for safety. No adult members, no private messaging."],
  ["shield_person", "Keep personal info private", "Members show first names only — never share phone numbers, addresses, or socials."],
  ["volunteer_activism", "Be kind", "No bullying, harassment, or hate. Treat every classmate with respect."],
  ["flag", "Report anything", "Tap ⋮ on any post to report it — our safety system reviews every report right away."],
];

export default function CohortTab() {
  const { profile, language } = useHalda();
  const t = (key: string, fallback: string) => tr(language, key, fallback);
  const pathway = pathwayFor(profile) || "Class of 2025";
  const hasPath = !!pathwayFor(profile);

  // Schools the cohort is comparing = the student's own top matches.
  const compareSchools = useMemo(
    () => rankInterestMatches(profile, 3).map((m) => schoolById(m.schoolId)?.short).filter(Boolean) as string[],
    [profile]
  );
  const faces = useMemo(() => cohortFaces(pathway), [pathway]);
  const seeded = useMemo(() => postsFor(profile), [profile]);

  const firstName = (profile.name || "You").split(" ")[0];
  const myInitials = (profile.name || "Y").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // The pinned Halda post adapts to the student's real next deadline + pathway.
  const nextTask = profile.tasks?.find((t) => t.status !== "done" && t.due);
  const pinned: CohortPost = {
    id: "post_halda", authorId: "halda", pathway, time: "Automated update", system: true, pinned: true,
    body: nextTask
      ? `Reminder for the ${pathwayShort(pathway)} cohort: ${nextTask.title}${nextTask.due ? ` is ${dueLabel(nextTask.due).toLowerCase()}` : ""}. Tap your AI Guide to add it to your tracker so you don't miss it.`
      : `Welcome to the ${pathway} cohort 👋 Ask your AI Guide anything — deadlines, scholarships, or how your matches compare — and share wins here so classmates learn from you.`,
    tags: [], likes: 38, comments: 12,
  };

  const FILTERS = ["All", hasPath ? pathwayShort(pathway) : "My path", "Scholarships", `Local · ${profile.state || "UT"}`, "Questions"];
  const [filter, setFilter] = useState("All");
  const [composed, setComposed] = useState<CohortPost[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState<null | "report" | "guidelines">(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const matchesFilter = (p: CohortPost) => {
    if (filter === "All") return true;
    if (filter === "Scholarships") return p.tags.some((t) => /scholar|grant|aid|fafsa/i.test(t));
    if (filter === "Questions") return p.tags.some((t) => /question/i.test(t)) || /\?/.test(p.body);
    if (filter.startsWith("Local")) return p.tags.some((t) => /local/i.test(t));
    return p.pathway === pathway; // the pathway chip
  };

  const feed = [...composed, ...seeded].filter(matchesFilter);
  const toggleLike = (p: CohortPost) =>
    setLiked((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; });
  const likeCount = (p: CohortPost) => p.likes + (liked.has(p.id) ? 1 : 0);

  const post = () => {
    const body = draft.trim();
    if (!body) return;
    setComposed((c) => [{ id: `mine_${Date.now()}`, authorId: "me", pathway, time: "Just now", body, tags: [], likes: 0, comments: 0 }, ...c]);
    setDraft(""); setComposeOpen(false);
    flash("Posted — screened for safety before classmates see it ✓");
  };

  return (
    <main className="scroll cohort">
      <div className="htitle">
        <h1>{t("cohort.title", "Cohort")}</h1>
        <p>{t("cohort.sub", "Your Class of 2025 community")}</p>
      </div>

      <div className="banner">
        <span className="bglow" />
        <span className="eyebrow">{hasPath ? `${pathway} ${language === "es" ? "ruta" : "pathway"}` : t("cohort.findPath", "Find your pathway")}</span>
        <h2>{hasPath ? (language === "es" ? `${cohortSize(pathway)} estudiantes están en tu ruta` : `${cohortSize(pathway)} students are on your path`) : t("cohort.meet", "Tell Halda your major to meet your cohort")}</h2>
        <div className="brow">
          <div className="faces">
            {faces.map((f) => <img key={f.id} src={f.avatar} alt="" />)}
            <span className="more">+{Math.max(0, cohortSize(pathway) - faces.length)}</span>
          </div>
          <span className="bcount">{compareSchools.length ? `Comparing ${compareSchools.slice(0, 3).join(", ")}` : "Comparing top matches"}</span>
        </div>
      </div>

      <div className="safety">
        <span className="sh"><Icon name="verified_user" /></span>
        <div className="st">
          <div className="stt">{t("cohort.safe", "Safe, verified community")}</div>
          <div className="sts">{t("cohort.safeSub", "Private to Class of 2025 · AI-moderated · built for students under 18")}</div>
        </div>
        <button className="sbtn" onClick={() => setSheet("guidelines")}>{t("cohort.guidelines", "Guidelines")}</button>
      </div>

      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f} className={`fchip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {composeOpen ? (
        <div className="composer-open">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Share a win or question with the ${pathwayShort(pathway)} cohort…`} autoFocus />
          <div className="co-row">
            <span className="co-note"><Icon name="verified_user" /> Screened for safety</span>
            <div>
              <button className="co-cancel" onClick={() => { setComposeOpen(false); setDraft(""); }}>Cancel</button>
              <button className="co-post" onClick={post} disabled={!draft.trim()}>Post</button>
            </div>
          </div>
        </div>
      ) : (
        <button className="composer" onClick={() => setComposeOpen(true)}>
          <span className="cmp-av">{myInitials}</span>
          <span>{t("cohort.share", "Share something with your cohort…")}</span>
          <Icon name="edit" />
        </button>
      )}

      <div className="feed">
        {filter === "All" && composed.length === 0 && <PostCard p={pinned} my={false} likeCount={likeCount} liked={liked} onLike={toggleLike} onAct={flash} onReport={() => setSheet("report")} firstName={firstName} myInitials={myInitials} />}
        {feed.length === 0 && <p className="cohort-empty">{t("cohort.noPosts", "No posts here yet — be the first to share something with your cohort.")}</p>}
        {feed.map((p) => (
          <PostCard key={p.id} p={p} my={p.authorId === "me"} likeCount={likeCount} liked={liked} onLike={toggleLike} onAct={flash} onReport={() => setSheet("report")} firstName={firstName} myInitials={myInitials} />
        ))}
      </div>

      {toast && <div className="cohort-toast">{toast}</div>}

      {/* safety / report bottom sheet */}
      <div className={`scrim${sheet ? " on" : ""}`} onClick={() => setSheet(null)} />
      <section className={`sheet cohort-sheet${sheet ? " open" : ""}`} role="dialog" aria-modal="true">
        <span className="grab" />
        <div className="cs-head">
          <span className="cs-i"><Icon name={sheet === "guidelines" ? "shield" : "flag"} /></span>
          <h2>{sheet === "guidelines" ? "Community Guidelines" : "Report post"}</h2>
          <button className="sheet-close" onClick={() => setSheet(null)} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="cs-body">
          {sheet === "guidelines" ? (
            <>
              <p className="cs-intro">Halda Cohort is built to be a safe space for students under 18.</p>
              {GUIDELINES.map(([icon, t, s]) => (
                <div key={t} className="guide-item">
                  <span className="gi"><Icon name={icon} /></span>
                  <div><div className="gt">{t}</div><div className="gs">{s}</div></div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="cs-intro">Reports are private and reviewed by Halda&apos;s automated safety system. What&apos;s happening?</p>
              {REPORT_REASONS.map(([label, icon, warn]) => (
                <button key={label} className={`reason${warn ? " warn" : ""}`} onClick={() => { setSheet(null); flash("Report received — thanks for keeping the cohort safe."); }}>
                  <Icon name={icon} />{label}<span className="ch"><Icon name="chevron_right" /></span>
                </button>
              ))}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function PostCard({ p, my, likeCount, liked, onLike, onAct, onReport, firstName, myInitials }: {
  p: CohortPost; my: boolean; likeCount: (p: CohortPost) => number; liked: Set<string>;
  onLike: (p: CohortPost) => void; onAct: (m: string) => void; onReport: () => void;
  firstName: string; myInitials: string;
}) {
  const peer = peerById(p.authorId);
  const name = p.system ? "Halda" : my ? `${firstName} (you)` : peer?.name || "Classmate";
  const meta = p.system ? `Automated update · Class of 2025` : `${p.pathway} pathway · ${p.time}`;
  return (
    <article className={`post${p.pinned ? " pinned" : ""}`}>
      <div className="phead">
        {p.system ? <span className="sysmark"><Icon name="hub" /></span>
          : my ? <span className="cmp-av post-av">{myInitials}</span>
          : <img className="post-av" src={peer?.avatar} alt="" />}
        <div className="pi">
          <div className="pn">{name}{p.system && <Icon name="verified" className="vchk" />}</div>
          <div className="pm">{meta}</div>
        </div>
        {p.pinned ? <span className="pintag"><Icon name="push_pin" />Pinned</span>
          : <button className="kebab" aria-label="Post options" onClick={onReport}><Icon name="more_horiz" /></button>}
      </div>
      <p className="pbody">{p.body}</p>
      {p.tags.length > 0 && <div className="pchips">{p.tags.map((t) => <b key={t}>#{t}</b>)}</div>}
      <div className="pacts">
        <button className={`pact${liked.has(p.id) ? " liked" : ""}`} onClick={() => onLike(p)}>
          <Icon name="favorite" /><span className="n">{likeCount(p)}</span>
        </button>
        <button className="pact" onClick={() => onAct("Replies are coming soon — for now, react and share.")}>
          <Icon name="chat_bubble" /><span className="n">{p.comments}</span>
        </button>
        <button className="pact spacer" onClick={() => onAct("Shared to your story")}><Icon name="share" /></button>
      </div>
    </article>
  );
}
