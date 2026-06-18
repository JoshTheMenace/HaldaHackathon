"use client";

import { useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";
import SharePlanSheet from "./SharePlanSheet";

export default function ConnectTab({ onAsk }: { onAsk: (text?: string) => void }) {
  const { profile } = useHalda();
  const savedCount = profile.savedSchoolIds?.length ?? 0;
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <main className="scroll">
      <h1 className="greeting">Connect</h1>
      <p style={{ fontSize: 14, color: "var(--h-ink-var)", marginBottom: 6 }}>
        Bring the right people into your college journey.
      </p>

      <section className="guides" style={{ marginTop: 18 }}>
        <article className="hero emerald">
          <span className="gico"><Icon name="ios_share" /></span>
          <h4>Share your plan</h4>
          <p>Send your top matches and next steps to a parent or counselor.</p>
          <button className="pill" onClick={() => setShareOpen(true)}>Open summary <Icon name="arrow_forward" /></button>
        </article>
        <article className="hero teal">
          <span className="gico"><Icon name="sms" /></span>
          <h4>Text-message reminders</h4>
          <p>Halda texts you before every deadline so nothing slips.</p>
          <button className="pill" onClick={() => onAsk("Set up text reminders for my deadlines")}>Turn on <Icon name="arrow_forward" /></button>
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
