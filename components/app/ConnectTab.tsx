"use client";

import { useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";
import SharePlanSheet from "./SharePlanSheet";

export default function ConnectTab({ onAsk }: { onAsk: (text?: string) => void }) {
  const { profile, editField } = useHalda();
  const savedCount = profile.savedSchoolIds?.length ?? 0;
  const [shareOpen, setShareOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [smsState, setSmsState] = useState<"idle" | "linking" | "linked" | "error">("idle");
  const [smsMsg, setSmsMsg] = useState("");
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "linking" | "linked" | "error">("idle");
  const [emailMsg, setEmailMsg] = useState("");

  const linkPhone = async () => {
    setSmsState("linking"); setSmsMsg("");
    try {
      const r = await fetch("/api/sms/link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, profile }),
      });
      const d = await r.json();
      if (!r.ok) { setSmsState("error"); setSmsMsg(d.error || "Couldn't link that number."); return; }
      editField("phone", phone.trim());
      setSmsState("linked");
      setSmsMsg(d.sent ? "Texted you! Reply from your phone and we'll keep going." : "Linked — but the SMS couldn't send (check server setup).");
    } catch {
      setSmsState("error"); setSmsMsg("Network error — try again.");
    }
  };

  const linkEmail = async () => {
    setEmailState("linking"); setEmailMsg("");
    try {
      const r = await fetch("/api/email/link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, profile }),
      });
      const d = await r.json();
      if (!r.ok) { setEmailState("error"); setEmailMsg(d.error || "Couldn't link that address."); return; }
      editField("email", email.trim().toLowerCase());
      setEmailState("linked");
      setEmailMsg(d.sent ? "Check your inbox! Reply to that email and we'll keep going." : "Linked — but the email couldn't send (check server setup).");
    } catch {
      setEmailState("error"); setEmailMsg("Network error — try again.");
    }
  };

  return (
    <main className="scroll">
      <h1 className="greeting">Connect</h1>
      <p style={{ fontSize: 14, color: "var(--h-ink-var)", marginBottom: 6 }}>
        Bring the right people into your college journey.
      </p>

      <section className="guides" style={{ marginTop: 18 }}>
        <article className="hero teal">
          <span className="gico"><Icon name="smartphone" /></span>
          <h4>Continue on your phone</h4>
          <p>Add your number and Halda will text you — pick up this exact conversation over SMS, anytime.</p>
          <div className="phone-link">
            <input
              type="tel" inputMode="tel" value={phone} placeholder="(801) 555-1234"
              onChange={(e) => setPhone(e.target.value)} aria-label="Your phone number"
              disabled={smsState === "linking"}
            />
            <button className="pill" onClick={linkPhone} disabled={smsState === "linking" || phone.trim().length < 7}>
              {smsState === "linking" ? "Texting…" : smsState === "linked" ? "Linked ✓" : "Text me"} <Icon name="send" />
            </button>
          </div>
          {smsMsg && <p className={`phone-status ${smsState}`}>{smsMsg}</p>}
        </article>

        <article className="hero teal">
          <span className="gico"><Icon name="mail" /></span>
          <h4>Continue over email</h4>
          <p>Add your email and Halda will send you a message — pick up this exact conversation in your inbox, anytime.</p>
          <div className="phone-link">
            <input
              type="email" inputMode="email" value={email} placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)} aria-label="Your email address"
              disabled={emailState === "linking"}
            />
            <button className="pill" onClick={linkEmail} disabled={emailState === "linking" || !email.includes("@")}>
              {emailState === "linking" ? "Sending…" : emailState === "linked" ? "Linked ✓" : "Email me"} <Icon name="send" />
            </button>
          </div>
          {emailMsg && <p className={`phone-status ${emailState}`}>{emailMsg}</p>}
        </article>

        <article className="hero emerald">
          <span className="gico"><Icon name="ios_share" /></span>
          <h4>Share your plan</h4>
          <p>Send your top matches and next steps to a parent or counselor.</p>
          <button className="pill" onClick={() => setShareOpen(true)}>Open summary <Icon name="arrow_forward" /></button>
        </article>

        <article className="hero emerald">
          <span className="gico"><Icon name="family_restroom" /></span>
          <h4>Invite a parent or counselor</h4>
          <p>Share your progress and let them cheer you on.</p>
          <button className="pill" onClick={() => onAsk("How do I invite a parent to see my progress?")}>Invite <Icon name="arrow_forward" /></button>
        </article>

        <article className="hero teal">
          <span className="gico"><Icon name="account_balance" /></span>
          <h4>Hear from your schools</h4>
          <p>{savedCount > 0 ? `Let your ${savedCount} saved school${savedCount > 1 ? "s" : ""} reach out with aid + next steps.` : "Save schools on Explore to let them reach out."}</p>
          <button className="pill" onClick={() => onAsk("Connect me with my saved schools")}>Connect <Icon name="arrow_forward" /></button>
        </article>
      </section>

      <SharePlanSheet open={shareOpen} onClose={() => setShareOpen(false)} />
    </main>
  );
}
