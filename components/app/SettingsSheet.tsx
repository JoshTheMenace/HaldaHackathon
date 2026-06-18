"use client";

import { useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";
import { initials } from "./helpers";
import "@/app/settings.css";

type Vis = "counselors" | "cohort" | "private";
const VIS: { id: Vis; icon: string; title: string; sub: string }[] = [
  { id: "counselors", icon: "school", title: "Counselors only", sub: "Your counselor and Halda — recommended" },
  { id: "cohort", icon: "groups", title: "Everyone in my cohort", sub: "Peers can see your profile, GPA & matches" },
  { id: "private", icon: "lock", title: "Private", sub: "Only you can see your profile" },
];
const VIS_LABEL: Record<Vis, string> = { counselors: "Counselors only", cohort: "My cohort", private: "Private" };
const INCLUDE = [{ k: "Deadlines", icon: "event" }, { k: "Scholarships", icon: "savings" }, { k: "GPA & tasks", icon: "school" }];

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, editField, logout } = useHalda();
  const first = profile.name?.split(" ")[0] || "you";

  const [toast, setToast] = useState("");
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  // parent summary
  const [parentOn, setParentOn] = useState(false);
  const [relationship, setRelationship] = useState("Parent");
  const [sendVia, setSendVia] = useState<"sms" | "email">("sms");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [showPhoneCode, setShowPhoneCode] = useState(false);
  const [showEmailCode, setShowEmailCode] = useState(false);
  const [days, setDays] = useState<Set<string>>(new Set(["Sun"]));
  const [includes, setIncludes] = useState<Set<string>>(new Set(["Deadlines", "Scholarships"]));
  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); fn(n);
  };

  // notifications
  const [push, setPush] = useState(true);
  const [deadlineAlerts, setDeadlineAlerts] = useState(true);
  const [scholarshipAlerts, setScholarshipAlerts] = useState(true);

  // privacy & security
  const [vis, setVis] = useState<Vis>("counselors");
  const [visOpen, setVisOpen] = useState(false);
  const [pendingCohort, setPendingCohort] = useState(false);
  const dataSharing = profile.consent?.shareWithPartners ?? true;
  const setDataSharing = (v: boolean) => {
    editField("consent", { ...profile.consent, shareWithPartners: v });
    flash(v ? "Matching sharing on — schools can find you" : "Matching sharing off — you're now private to schools");
  };
  const [twoFA, setTwoFA] = useState(false);
  const [faceUnlock, setFaceUnlock] = useState(true);
  const [ferpaOpen, setFerpaOpen] = useState(false);
  const [correctField, setCorrectField] = useState("GPA");
  const [correctText, setCorrectText] = useState("");

  const Switch = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
    <button className={`switch${on ? " on" : ""}`} onClick={() => set(!on)} aria-label={label} aria-pressed={on} />
  );

  return (
    <div className={`settings-screen${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Settings">
      <header className="shead">
        <button className="back" onClick={onClose} aria-label="Back"><Icon name="arrow_back" /></button>
        <div><h1>Settings</h1><p>Manage your account, privacy, and notifications</p></div>
      </header>

      <main className="sscroll">
        {/* account */}
        <div className="group" style={{ marginTop: 14 }}>
          <div className="gcard">
            <button className="acct" onClick={() => flash("Account details live on your Profile tab")}>
              <span className="pa">{initials(profile.name)}</span>
              <span className="ab">
                <h3>{profile.name || "Your account"}</h3>
                <p>{profile.email || `${first.toLowerCase()}@email.com`}</p>
                <span className="acct-badge"><Icon name="family_restroom" /> Minor — parent tools on</span>
              </span>
              <Icon name="chevron_right" className="chev" />
            </button>
          </div>
        </div>

        {/* parent notifications */}
        <div className="group">
          <div className="glabel"><Icon name="family_restroom" /> Parent Notifications</div>
          <div className="parent-card">
            <div className="parent-hero">
              <span className="ri"><Icon name="forward_to_inbox" /></span>
              <span className="rb">
                <div className="rt">Weekly Parent Summary</div>
                <div className="rs">Send a recap of {first}&rsquo;s deadlines, scholarships, and progress to a verified parent or guardian.</div>
              </span>
              <Switch on={parentOn} set={setParentOn} label="Weekly parent summary" />
            </div>
            <div className={`parent-panel${parentOn ? " open" : ""}`}>
              <div className="parent-inner">
                <div>
                  <span className="fl">Relationship</span>
                  <div className="seg">
                    {["Parent", "Guardian", "Other"].map((r) => (
                      <button key={r} className={relationship === r ? "on" : ""} onClick={() => setRelationship(r)}>{r}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="fl">Parent / guardian name</span>
                  <div className="pfield"><input placeholder="e.g. Maria Reynolds" /></div>
                </div>
                <div>
                  <span className="fl">Send via</span>
                  <div className="seg">
                    <button className={sendVia === "sms" ? "on" : ""} onClick={() => setSendVia("sms")}><Icon name="sms" /> SMS</button>
                    <button className={sendVia === "email" ? "on" : ""} onClick={() => setSendVia("email")}><Icon name="mail" /> Email</button>
                  </div>
                </div>
                {sendVia === "sms" ? (
                  <div>
                    <span className="fl">Mobile number</span>
                    {phoneVerified ? (
                      <div className="verified-chip"><Icon name="verified" /> Verified · summaries can be sent</div>
                    ) : showPhoneCode ? (
                      <div className="code-row">
                        <input placeholder="6-digit code" inputMode="numeric" />
                        <button onClick={() => { setPhoneVerified(true); setShowPhoneCode(false); }}>Confirm</button>
                      </div>
                    ) : (
                      <div className="verify-wrap">
                        <div className="pfield"><input placeholder="(801) 555-1234" inputMode="tel" /></div>
                        <button className="btn-verify" onClick={() => setShowPhoneCode(true)}>Verify</button>
                      </div>
                    )}
                    <div className="hint">We text a 6-digit code to confirm this is really their phone before any records are sent.</div>
                  </div>
                ) : (
                  <div>
                    <span className="fl">Email address</span>
                    {emailVerified ? (
                      <div className="verified-chip"><Icon name="verified" /> Verified · summaries can be sent</div>
                    ) : showEmailCode ? (
                      <div className="code-row">
                        <input placeholder="6-digit code" inputMode="numeric" />
                        <button onClick={() => { setEmailVerified(true); setShowEmailCode(false); }}>Confirm</button>
                      </div>
                    ) : (
                      <div className="verify-wrap">
                        <div className="pfield"><input placeholder="parent@email.com" inputMode="email" /></div>
                        <button className="btn-verify" onClick={() => setShowEmailCode(true)}>Verify</button>
                      </div>
                    )}
                    <div className="hint">We email a 6-digit code to confirm this address before any records are sent.</div>
                  </div>
                )}
                <div>
                  <span className="fl">Delivered every</span>
                  <div className="seg">
                    {["Sun", "Wed", "Fri"].map((d) => (
                      <button key={d} className={days.has(d) ? "on" : ""} onClick={() => toggle(days, d, setDays)}>{d}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="fl">Summary includes — tap to choose</span>
                  <div className="incl">
                    {INCLUDE.map((i) => (
                      <b key={i.k} className={includes.has(i.k) ? "on" : ""} onClick={() => toggle(includes, i.k, setIncludes)}>
                        <Icon name={i.icon} /> {i.k}
                      </b>
                    ))}
                  </div>
                </div>
                <div className="privacy-note">
                  <Icon name="lock" />
                  <span>{first} stays in control — summaries never include passwords or messages, and {first} can turn this off anytime.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* notifications */}
        <div className="group">
          <div className="glabel"><Icon name="notifications" /> Notifications</div>
          <div className="gcard">
            <div className="row static">
              <span className="ri"><Icon name="notifications_active" /></span>
              <span className="rb"><div className="rt">Push notifications</div></span>
              <Switch on={push} set={setPush} label="Push notifications" />
            </div>
            <div className="row static">
              <span className="ri"><Icon name="event_upcoming" /></span>
              <span className="rb"><div className="rt">Deadline reminders</div><div className="rs">Alerts 7 and 1 days before each due date</div></span>
              <Switch on={deadlineAlerts} set={setDeadlineAlerts} label="Deadline reminders" />
            </div>
            <div className="row static">
              <span className="ri"><Icon name="savings" /></span>
              <span className="rb"><div className="rt">Scholarship alerts</div></span>
              <Switch on={scholarshipAlerts} set={setScholarshipAlerts} label="Scholarship alerts" />
            </div>
            <button className="row" onClick={() => flash("Quiet hours: 10 PM – 7 AM")}>
              <span className="ri"><Icon name="bedtime" /></span>
              <span className="rb"><div className="rt">Quiet hours</div></span>
              <span className="rv">10 PM – 7 AM</span>
              <Icon name="chevron_right" className="chev" />
            </button>
          </div>
        </div>

        {/* privacy & security */}
        <div className="group">
          <div className="glabel"><Icon name="shield" /> Privacy &amp; Security</div>
          <div className="gcard">
            <button className={`row${visOpen ? " exp" : ""}`} onClick={() => setVisOpen((o) => !o)}>
              <span className="ri"><Icon name="visibility" /></span>
              <span className="rb"><div className="rt">Profile visibility</div><div className="rs">Who can see your profile</div></span>
              <span className="rv">{VIS_LABEL[vis]}</span>
              <Icon name="chevron_right" className="chev" />
            </button>
            <div className={`disclosure${visOpen ? " open" : ""}`}>
              <div className="disclosure-inner vis-seg">
                {VIS.map((o) => (
                  <button key={o.id} className={`vis-opt${vis === o.id ? " on" : ""}`}
                    onClick={() => { if (o.id === "cohort" && vis !== "cohort") setPendingCohort(true); else setVis(o.id); }}>
                    <span className="vi"><Icon name={o.icon} /></span>
                    <span className="vb"><span className="vt">{o.title}</span><span className="vs">{o.sub}</span></span>
                    <Icon name="check_circle" className="vcheck" />
                  </button>
                ))}
              </div>
            </div>

            <div className="row static">
              <span className="ri"><Icon name="hub" /></span>
              <span className="rb"><div className="rt">Data sharing for matching</div><div className="rs">Let Halda use your profile to find universities &amp; aid</div></span>
              <Switch on={dataSharing} set={setDataSharing} label="Data sharing for matching" />
            </div>
            <div className={`disclosure${dataSharing ? " open" : ""}`}>
              <div className="disclosure-inner">
                <div className="receipt">
                  <Icon name="hub" />
                  <span>Your GPA, test scores, and interests are shared with matched universities and scholarship partners to surface offers. Halda never sells your data, and you can switch this off anytime.</span>
                </div>
              </div>
            </div>

            <div className="row static">
              <span className="ri"><Icon name="verified_user" /></span>
              <span className="rb"><div className="rt">Two-factor authentication</div><div className="rs">Extra code at sign-in</div></span>
              <Switch on={twoFA} set={setTwoFA} label="Two-factor authentication" />
            </div>
            <div className="row static">
              <span className="ri"><Icon name="fingerprint" /></span>
              <span className="rb"><div className="rt">Face / Touch unlock</div></span>
              <Switch on={faceUnlock} set={setFaceUnlock} label="Face or touch unlock" />
            </div>
            <button className="row" onClick={() => flash("Password reset link sent")}>
              <span className="ri"><Icon name="password" /></span>
              <span className="rb"><div className="rt">Change password</div></span>
              <Icon name="chevron_right" className="chev" />
            </button>
            <button className="row" onClick={() => flash("Preparing your data export…")}>
              <span className="ri"><Icon name="download" /></span>
              <span className="rb"><div className="rt">Download my data</div><div className="rs">Get a copy of everything Halda stores</div></span>
              <Icon name="chevron_right" className="chev" />
            </button>
            <button className="row" onClick={() => setFerpaOpen(true)}>
              <span className="ri"><Icon name="policy" /></span>
              <span className="rb"><div className="rt">Privacy &amp; your data rights</div><div className="rs">What we store, who sees it, and your FERPA rights</div></span>
              <Icon name="chevron_right" className="chev" />
            </button>
            <button className="row danger" onClick={() => flash("Account deletion needs email confirmation")}>
              <span className="ri"><Icon name="delete" /></span>
              <span className="rb"><div className="rt">Delete account</div></span>
              <Icon name="chevron_right" className="chev" />
            </button>
          </div>
        </div>

        {/* support */}
        <div className="group">
          <div className="glabel"><Icon name="help" /> Support</div>
          <div className="gcard">
            <button className="row" onClick={() => flash("Opening Help Center…")}>
              <span className="ri"><Icon name="help_center" /></span>
              <span className="rb"><div className="rt">Help Center</div></span>
              <Icon name="chevron_right" className="chev" />
            </button>
            <button className="row" onClick={() => flash("Thanks — feedback helps us improve")}>
              <span className="ri"><Icon name="chat" /></span>
              <span className="rb"><div className="rt">Send feedback</div></span>
              <Icon name="chevron_right" className="chev" />
            </button>
            <button className="row" onClick={() => flash("Halda AI · v1.0.0")}>
              <span className="ri"><Icon name="info" /></span>
              <span className="rb"><div className="rt">About Halda AI</div></span>
              <span className="rv">v1.0.0</span>
              <Icon name="chevron_right" className="chev" />
            </button>
          </div>
        </div>

        <button className="signout" onClick={() => { logout(); onClose(); }}>Sign out</button>
        <div className="ver">Halda AI · Made for the class of 2028</div>
      </main>

      {/* confirm: make profile public to cohort */}
      <div className={`confirm-scrim${pendingCohort ? " on" : ""}`} onClick={() => setPendingCohort(false)}>
        <div className="confirm" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Make profile public">
          <div className="ci"><Icon name="groups" /></div>
          <h3>Make your profile public to your cohort?</h3>
          <p>&ldquo;Everyone&rdquo; lets other students in your cohort see your profile, including your GPA and university matches. You can change this back anytime.</p>
          <div className="btns">
            <button className="cancel" onClick={() => setPendingCohort(false)}>Keep restricted</button>
            <button className="ok" onClick={() => { setVis("cohort"); setPendingCohort(false); flash("Profile shared with your cohort"); }}>Make public</button>
          </div>
        </div>
      </div>

      {/* FERPA privacy & data rights sheet */}
      <div className={`info-scrim${ferpaOpen ? " on" : ""}`} onClick={() => setFerpaOpen(false)} />
      <section className={`info-sheet${ferpaOpen ? " open" : ""}`} aria-label="Privacy and data rights">
        <span className="info-grab" />
        <div className="info-head">
          <span className="ri"><Icon name="policy" /></span>
          <div className="ht"><h2>Privacy &amp; data rights</h2><div className="sub">FERPA-aligned</div></div>
          <button className="info-close" onClick={() => setFerpaOpen(false)} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="info-body">
          <h4><Icon name="database" /> What Halda stores</h4>
          <div className="info-card"><div className="ic-t"><Icon name="school" /> Academic record</div><div className="ic-s">GPA, ACT/SAT scores, coursework and tasks.</div></div>
          <div className="info-card"><div className="ic-t"><Icon name="event" /> Applications &amp; deadlines</div><div className="ic-s">Your tracked schools, deadlines and progress.</div></div>
          <div className="info-card"><div className="ic-t"><Icon name="savings" /> Scholarship matches</div><div className="ic-s">Awards you&rsquo;ve matched, applied to, or won.</div></div>

          <h4><Icon name="share" /> Who it&rsquo;s shared with</h4>
          <p>Halda never sells your data. Records leave the app only when <b>you turn on a specific control</b>:</p>
          <div className="info-card"><div className="ic-t"><Icon name="hub" /> Matched universities &amp; partners</div><div className="ic-s">Only while &ldquo;Data sharing for matching&rdquo; is on.</div></div>
          <div className="info-card"><div className="ic-t"><Icon name="family_restroom" /> A verified parent / guardian</div><div className="ic-s">Only when the Weekly Parent Summary is on and the contact is verified.</div></div>
          <div className="info-card"><div className="ic-t"><Icon name="visibility" /> Counselors or your cohort</div><div className="ic-s">Controlled by your Profile visibility setting.</div></div>

          <h4><Icon name="gavel" /> Your rights</h4>
          <p>Under FERPA you can inspect, correct, and control disclosure of your education records. Request a correction here:</p>
          <select className="cf-input" value={correctField} onChange={(e) => setCorrectField(e.target.value)} aria-label="Field to correct">
            {["GPA", "ACT / SAT score", "Name or contact info", "Coursework or tasks", "Scholarship status", "Something else"].map((o) => <option key={o}>{o}</option>)}
          </select>
          <textarea className="cf-input" placeholder="What should we fix?" value={correctText} onChange={(e) => setCorrectText(e.target.value)} />
          <button className="cf-submit" onClick={() => { setFerpaOpen(false); setCorrectText(""); flash("Correction request submitted"); }}>Submit request</button>
          <p className="legal">Halda follows FERPA, COPPA, and state student-privacy laws. When Halda operates under contract with your school, it acts as a &ldquo;school official&rdquo; handling records on the school&rsquo;s behalf. This screen is product guidance, not legal advice.</p>
        </div>
      </section>

      <div className={`sset-toast${toast ? " on" : ""}`}>{toast}</div>
    </div>
  );
}
