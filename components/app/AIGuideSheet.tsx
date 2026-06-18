"use client";

import { useEffect, useRef, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";

const SUGGESTIONS = ["Next deadline?", "Scholarships for me", "Why BYU?", "Boost my GPA"];
const TOOL_ICON: Record<string, string> = { search: "travel_explore", scholarship: "savings", task: "event_available", profile: "person" };

export default function AIGuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { messages, typing, send } = useHalda();
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 380);
  }, [open]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    send(t, "web");
    setInput("");
  };

  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <section className={`sheet ai-sheet${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="AI Guide">
        <span className="grab" style={{ marginTop: 12, marginBottom: 4 }} />
        <div className="ai-head">
          <span className="ai-mark"><Icon name="hub" /></span>
          <div className="ht">
            <h2>AI Guide</h2>
            <div className="sub">Online · here to help</div>
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <div className="ai-thread" ref={threadRef}>
          {messages.map((m) =>
            m.tool ? (
              <div key={m.id} className="toolchip">
                <Icon name={TOOL_ICON[m.tool.kind] ?? "bolt"} />
                {m.tool.label}
                {m.tool.detail && <span className="d">{m.tool.detail}</span>}
              </div>
            ) : (
              <div key={m.id} className={`ai-row ${m.role === "student" ? "me" : "ai"}`}>
                {m.role !== "student" && <span className="ai-av"><Icon name="hub" /></span>}
                <div className="msg">{m.text}</div>
              </div>
            )
          )}
          {typing && (
            <div className="ai-row ai">
              <span className="ai-av"><Icon name="hub" /></span>
              <div className="msg typing"><span /><span /><span /></div>
            </div>
          )}
        </div>

        <div className="ai-foot">
          <div className="ai-sugg">
            {SUGGESTIONS.map((s) => (
              <b key={s} onClick={() => submit(s)}>{s}</b>
            ))}
          </div>
          <div className="ai-inp">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(input)}
              placeholder="Ask your AI Guide…"
              autoComplete="off"
            />
            <button className="send" onClick={() => submit(input)} aria-label="Send"><Icon name="arrow_upward" /></button>
          </div>
        </div>
      </section>
    </>
  );
}
