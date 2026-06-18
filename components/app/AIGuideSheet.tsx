"use client";

import { useEffect, useRef, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";
import VoiceView from "./VoiceView";
import ChatSchoolCard from "./ChatSchoolCard";
import MatchDetailSheet from "./MatchDetailSheet";

const SUGGESTIONS = ["Next deadline?", "Scholarships for me", "Why BYU?", "Boost my GPA"];
const TOOL_ICON: Record<string, string> = { search: "travel_explore", scholarship: "savings", task: "event_available", profile: "person", school: "account_balance" };

export default function AIGuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { messages, typing, send } = useHalda();
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [input, setInput] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open, mode]);

  useEffect(() => {
    if (open && mode === "chat") {
      const t = setTimeout(() => inputRef.current?.focus(), 380);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

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
          <div className="ai-modes">
            <button className={mode === "chat" ? "on" : ""} onClick={() => setMode("chat")}><Icon name="chat_bubble" />Chat</button>
            <button className={mode === "voice" ? "on" : ""} onClick={() => setMode("voice")}><Icon name="mic" />Voice</button>
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        {mode === "voice" && <VoiceView />}

        {mode === "chat" && (
          <div className="ai-thread" ref={threadRef}>
            {messages.map((m) => {
              if (m.tool) {
                return (
                  <div key={m.id} className="toolwrap">
                    <div className="toolchip">
                      <Icon name={TOOL_ICON[m.tool.kind] ?? "bolt"} />
                      {m.tool.label}
                      {m.tool.detail && <span className="d">{m.tool.detail}</span>}
                    </div>
                    {m.tool.items && m.tool.items.length > 0 && (
                      <div className="tool-cards">
                        {m.tool.items.map((it, i) => (
                          <div key={i} className="tool-card">
                            <span className="tc-ico"><Icon name="savings" /></span>
                            <div className="tc-b"><b>{it.title}</b>{it.sub && <span>{it.sub}</span>}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.tool.schools && m.tool.schools.length > 0 && (
                      <div className="chat-schools">
                        {m.tool.schools.map((sc) => (
                          <ChatSchoolCard key={sc.schoolId} schoolId={sc.schoolId} matchPct={sc.matchPct} onOpen={() => setDetailId(sc.schoolId)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={m.id} className={`ai-row ${m.role === "student" ? "me" : "ai"}`}>
                  {m.role !== "student" && <span className="ai-av"><Icon name="hub" /></span>}
                  <div className="msg">{m.text}</div>
                </div>
              );
            })}
            {typing && (
              <div className="ai-row ai">
                <span className="ai-av"><Icon name="hub" /></span>
                <div className="msg typing"><span /><span /><span /></div>
              </div>
            )}
          </div>
        )}

        {mode === "chat" && (
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
        )}
      </section>

      <MatchDetailSheet schoolId={detailId} onClose={() => setDetailId(null)} onAsk={(t) => t && send(t, "web")} />
    </>
  );
}
