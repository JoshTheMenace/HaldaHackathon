"use client";

import { useMemo, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { tr } from "@/lib/i18n";
import { rankInterestMatches, schoolById } from "@/lib/interest-match";
import {
  COHORT_PEERS, peerById, postsFor, pathwayFor, pathwayShort, cohortSize, cohortFaces,
  hspeersFor, collegeStudentsFor,
  type CohortPost, type HighSchoolPeer, type CollegeStudent,
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

interface PeerCardData {
  id: string;
  name: string;
  avatar: string;
  accent: string;
  badge: string;
  sub: string;
  status: string;
  context: string;
}

function hsToPeerCard(p: HighSchoolPeer): PeerCardData {
  return {
    id: p.id, name: p.name, avatar: p.avatar, accent: p.accent,
    badge: `Gr ${p.grade}`,
    sub: p.pathway.split(/[& ]/)[0],
    status: p.status,
    context: "from your school",
  };
}

function colToPeerCard(s: CollegeStudent): PeerCardData {
  return {
    id: s.id, name: s.name, avatar: s.avatar, accent: s.accent,
    badge: s.schoolShort,
    sub: `${s.year} · ${s.major}`,
    status: s.blurb,
    context: `at ${s.schoolShort}`,
  };
}

interface Comment { id: string; author: string; text: string; time: string; }

export default function CohortTab() {
  const { profile, language } = useHalda();
  const t = (key: string, fallback: string) => tr(language, key, fallback);
  const pathway = pathwayFor(profile) || "Class of 2025";
  const hasPath = !!pathwayFor(profile);

  const compareSchools = useMemo(
    () => rankInterestMatches(profile, 3).map((m) => schoolById(m.schoolId)?.short).filter(Boolean) as string[],
    [profile]
  );
  const faces = useMemo(() => cohortFaces(pathway), [pathway]);
  const seeded = useMemo(() => postsFor(profile), [profile]);

  const hsPeers = useMemo(() => hspeersFor(profile).map(hsToPeerCard), [profile]);
  const savedIds = useMemo(() => {
    const saved = profile.savedSchoolIds ?? [];
    const matched = rankInterestMatches(profile, 3).map((m) => m.schoolId);
    return [...new Set([...saved, ...matched])];
  }, [profile]);
  const collegeStudents = useMemo(() => collegeStudentsFor(savedIds).map(colToPeerCard), [savedIds]);

  const firstName = (profile.name || "You").split(" ")[0];
  const myInitials = (profile.name || "Y").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

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

  // Per-post comments stored in a map
  const [commentsByPost, setCommentsByPost] = useState<Map<string, Comment[]>>(new Map());
  const addComment = (postId: string, text: string) => {
    setCommentsByPost((prev) => {
      const next = new Map(prev);
      const existing = prev.get(postId) ?? [];
      next.set(postId, [...existing, { id: `c_${Date.now()}`, author: firstName, text, time: "Just now" }]);
      return next;
    });
  };

  // Connect state — inline panel, no sheet overlay
  const [connectTarget, setConnectTarget] = useState<PeerCardData | null>(null);
  const [connectQ, setConnectQ] = useState("");
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

  const openConnect = (peer: PeerCardData) => {
    setConnectTarget((prev) => (prev?.id === peer.id ? null : peer)); // toggle
    setConnectQ("");
  };
  const closeConnect = () => { setConnectTarget(null); setConnectQ(""); };

  const submitConnect = () => {
    if (!connectTarget) return;
    const { name, badge, context, id } = connectTarget;
    const q = connectQ.trim();
    const body = q
      ? `${firstName} asked ${name} (${badge}, ${context}): "${q}" — dropping this in the bulletin so everyone can learn from the answer.`
      : `${firstName} just connected with ${name} ${context} 👋 Say hi!`;
    const tags = q ? ["PublicQuestion", badge.replace(/\s/g, "")] : ["Connect", badge.replace(/\s/g, "")];
    setComposed((c) => [{ id: `conn_${Date.now()}`, authorId: "me", pathway, time: "Just now", body, tags, likes: 0, comments: 0 }, ...c]);
    setConnectedIds((s) => new Set(s).add(id));
    closeConnect();
    flash(q ? "Question posted to the Community Bulletin ✓" : `Connected with ${name} — posted to the bulletin ✓`);
  };

  const matchesFilter = (p: CohortPost) => {
    if (filter === "All") return true;
    if (filter === "Scholarships") return p.tags.some((t) => /scholar|grant|aid|fafsa/i.test(t));
    if (filter === "Questions") return p.tags.some((t) => /question/i.test(t)) || /\?/.test(p.body);
    if (filter.startsWith("Local")) return p.tags.some((t) => /local/i.test(t));
    return p.pathway === pathway;
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

      {/* ── From your High School ── */}
      {hsPeers.length > 0 && (
        <PeerSection
          icon="school" title="From your High School"
          peers={hsPeers} connectedIds={connectedIds} connectTarget={connectTarget}
          connectQ={connectQ} setConnectQ={setConnectQ}
          onConnect={openConnect} onCancel={closeConnect} onSubmit={submitConnect}
        />
      )}

      {/* ── From your top Universities ── */}
      {collegeStudents.length > 0 && (
        <PeerSection
          icon="account_balance" title="From your top Universities"
          peers={collegeStudents} connectedIds={connectedIds} connectTarget={connectTarget}
          connectQ={connectQ} setConnectQ={setConnectQ}
          onConnect={openConnect} onCancel={closeConnect} onSubmit={submitConnect}
        />
      )}

      {/* ── Community Bulletin ── */}
      <section className="peer-section">
        <div className="peer-sec-head">
          <Icon name="forum" /><span>Community Bulletin</span>
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
          {filter === "All" && composed.length === 0 && (
            <PostCard p={pinned} my={false} likeCount={likeCount} liked={liked} onLike={toggleLike}
              onAct={flash} onReport={() => setSheet("report")}
              firstName={firstName} myInitials={myInitials}
              comments={commentsByPost.get(pinned.id) ?? []} onAddComment={addComment} />
          )}
          {feed.length === 0 && <p className="cohort-empty">{t("cohort.noPosts", "No posts here yet — be the first to share something with your cohort.")}</p>}
          {feed.map((p) => (
            <PostCard key={p.id} p={p} my={p.authorId === "me"} likeCount={likeCount} liked={liked}
              onLike={toggleLike} onAct={flash} onReport={() => setSheet("report")}
              firstName={firstName} myInitials={myInitials}
              comments={commentsByPost.get(p.id) ?? []} onAddComment={addComment} />
          ))}
        </div>
      </section>

      {toast && <div className="cohort-toast">{toast}</div>}

      {/* guidelines / report sheet — no z-index conflict since Connect is now inline */}
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

// ── Peer section: grid + inline connect panel ────────────────────────────────

function PeerSection({ icon, title, peers, connectedIds, connectTarget, connectQ, setConnectQ, onConnect, onCancel, onSubmit }: {
  icon: string; title: string; peers: PeerCardData[];
  connectedIds: Set<string>; connectTarget: PeerCardData | null;
  connectQ: string; setConnectQ: (v: string) => void;
  onConnect: (p: PeerCardData) => void; onCancel: () => void; onSubmit: () => void;
}) {
  // Which card in this section is currently expanding?
  const activeInSection = connectTarget && peers.some((p) => p.id === connectTarget.id) ? connectTarget : null;

  return (
    <section className="peer-section">
      <div className="peer-sec-head">
        <Icon name={icon} /><span>{title}</span>
      </div>
      <div className="peer-grid">
        {peers.map((p) => (
          <PeerCard key={p.id} data={p}
            connected={connectedIds.has(p.id)}
            expanding={activeInSection?.id === p.id}
            onConnect={() => onConnect(p)} />
        ))}
      </div>

      {/* Inline connect panel — renders in document flow, no z-index issues */}
      {activeInSection && (
        <div className="connect-panel">
          <div className="cp-who">
            <img className="cp-av" src={activeInSection.avatar} alt="" style={{ borderColor: activeInSection.accent }} />
            <div>
              <div className="cp-name">{activeInSection.name}</div>
              <div className="cp-sub">
                <span className="peer-badge" style={{ background: activeInSection.accent }}>{activeInSection.badge}</span>
                <span className="cp-ctx">{activeInSection.sub}</span>
              </div>
            </div>
          </div>
          <p className="cp-note">
            <Icon name="forum" /> Questions post publicly — your classmates might have the same one.
          </p>
          <label className="cp-label">
            Ask {activeInSection.name.split(" ")[0]} a public question <span>(optional)</span>
          </label>
          <textarea
            className="cp-textarea"
            placeholder={`e.g. "What's the ${activeInSection.badge} process like?"`}
            value={connectQ}
            onChange={(e) => setConnectQ(e.target.value)}
            autoFocus
          />
          <div className="cp-actions">
            <button className="co-cancel" onClick={onCancel}>Cancel</button>
            <button className="co-post" onClick={onSubmit}>
              {connectQ.trim() ? "Post question" : "Connect"} <Icon name="arrow_forward" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Unified peer card ────────────────────────────────────────────────────────

function PeerCard({ data: p, connected, expanding, onConnect }: {
  data: PeerCardData; connected: boolean; expanding: boolean; onConnect: () => void;
}) {
  return (
    <div className={`peer-card${expanding ? " expanding" : ""}`}>
      <img className="peer-av" src={p.avatar} alt="" style={{ borderColor: p.accent }} />
      <div className="peer-name">{p.name}</div>
      <span className="peer-badge" style={{ background: p.accent }}>{p.badge}</span>
      <div className="peer-sub">{p.sub}</div>
      <div className="peer-status">{p.status}</div>
      <button
        className={`peer-btn${connected ? " done" : expanding ? " active" : ""}`}
        onClick={connected ? undefined : onConnect}
        disabled={connected}
        style={connected || expanding ? undefined : { borderColor: p.accent, color: p.accent }}
      >
        {connected ? "Connected ✓" : expanding ? "Cancel ↑" : "Connect"}
      </button>
    </div>
  );
}

// ── Feed post card with inline comments ─────────────────────────────────────

function PostCard({ p, my, likeCount, liked, onLike, onAct, onReport, firstName, myInitials, comments, onAddComment }: {
  p: CohortPost; my: boolean; likeCount: (p: CohortPost) => number; liked: Set<string>;
  onLike: (p: CohortPost) => void; onAct: (m: string) => void; onReport: () => void;
  firstName: string; myInitials: string;
  comments: Comment[]; onAddComment: (postId: string, text: string) => void;
}) {
  const peer = peerById(p.authorId);
  const name = p.system ? "Halda" : my ? `${firstName} (you)` : peer?.name || "Classmate";
  const meta = p.system ? `Automated update · Class of 2025` : `${p.pathway} pathway · ${p.time}`;
  const [showComments, setShowComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  const submitComment = () => {
    const t = commentDraft.trim();
    if (!t) return;
    onAddComment(p.id, t);
    setCommentDraft("");
  };

  const totalComments = p.comments + comments.length;

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
        <button className="pact" onClick={() => setShowComments((v) => !v)}>
          <Icon name="chat_bubble" /><span className="n">{totalComments}</span>
        </button>
        <button className="pact spacer" onClick={() => onAct("Shared to your story")}><Icon name="share" /></button>
      </div>

      {showComments && (
        <div className="comment-section">
          {comments.length === 0 && p.comments === 0 && (
            <p className="comment-empty">No comments yet — be the first.</p>
          )}
          {p.comments > 0 && comments.length === 0 && (
            <p className="comment-stub">{p.comments} comment{p.comments > 1 ? "s" : ""} from classmates — add yours below.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="comment-row">
              <span className="comment-av">{c.author[0]}</span>
              <div className="comment-body">
                <span className="comment-author">{c.author}</span>
                <span className="comment-time">{c.time}</span>
                <p className="comment-text">{c.text}</p>
              </div>
            </div>
          ))}
          <div className="comment-compose">
            <span className="comment-av">{myInitials}</span>
            <input
              className="comment-input"
              placeholder="Add a comment…"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
            />
            <button className="comment-send" onClick={submitComment} disabled={!commentDraft.trim()}>
              <Icon name="send" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
