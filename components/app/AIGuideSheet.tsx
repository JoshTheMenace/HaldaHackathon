"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useHalda } from "@/lib/useHalda";
import { Icon } from "./Icon";
import VoiceView from "./VoiceView";
import ChatSchoolCard from "./ChatSchoolCard";
import MatchDetailSheet from "./MatchDetailSheet";

const TOOL_ICON: Record<string, string> = { search: "travel_explore", scholarship: "savings", task: "event_available", profile: "person", school: "account_balance", web: "language" };

// Web sources come back as opaque Google grounding-redirect URLs with duplicate
// titles. Show a clean publisher domain instead, deduped and capped — never the
// raw vertexaisearch redirect.
const hostname = (s: string) => { try { return new URL(s).hostname.replace(/^www\./, ""); } catch { return s.replace(/^www\./, ""); } };
function webSources(items: { title?: string; sub?: string }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const t = (it.title || "").trim();
    let label = t && !/^https?:\/\//i.test(t) ? t : hostname(t || it.sub || "");
    if (!label || /vertexaisearch|googleusercontent|google\.com/i.test(label)) label = "web source";
    const key = label.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(label); }
  }
  return out.slice(0, 3);
}

export default function AIGuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { messages, typing, send } = useHalda();
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [input, setInput] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The guide's latest text message (skip tool chips) — what we suggest replies to.
  const lastAi = useMemo(() => [...messages].reverse().find((m) => m.role !== "student" && !m.tool), [messages]);

  // After each guide turn, ask a small model for tappable replies — but only when
  // the question has a few natural choices (it returns [] for open-ended ones).
  useEffect(() => {
    if (mode !== "chat" || typing || !lastAi?.text) return;
    let cancelled = false;
    fetch("/api/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: lastAi.text }) })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSuggestions(Array.isArray(d.suggestions) ? d.suggestions : []); })
      .catch(() => { if (!cancelled) setSuggestions([]); });
    return () => { cancelled = true; };
  }, [lastAi?.id, lastAi?.text, typing, mode]);

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
    setSuggestions([]); // stale once the student replies
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
                      m.tool.kind === "web" ? (
                        <div className="tool-sources">
                          {webSources(m.tool.items).map((src, i) => (
                            <span key={i} className="tool-source"><Icon name="link" /> {src}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="tool-cards">
                          {m.tool.items.map((it, i) => (
                            <div key={i} className="tool-card">
                              <span className="tc-ico"><Icon name="savings" /></span>
                              <div className="tc-b"><b>{it.title}</b>{it.sub && <span>{it.sub}</span>}</div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                    {m.tool.schools && m.tool.schools.length > 0 && (
                      <div className="chat-schools">
                        {m.tool.schools.map((sc) => (
                          <ChatSchoolCard key={sc.schoolId} schoolId={sc.schoolId} matchPct={sc.matchPct} onOpen={() => setDetailId(sc.schoolId)} />
                        ))}
                      </div>
                    )}
                    {m.tool.media && m.tool.media.length > 0 && (
                      <div className="tool-media">
                        {m.tool.media.map((it) => (
                          <div key={it.title} className="tool-media-card">
                            <span className="tm-photo">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={it.imageUrl} alt={`${it.title} campus`} />
                            </span>
                            <span className="tm-b">
                              <b>{it.title}</b>
                              {it.sub && <span>{it.sub}</span>}
                            </span>
                            {it.logoUrl && (
                              <span className="tm-logo">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={it.logoUrl} alt={`${it.title} logo`} />
                              </span>
                            )}
                          </div>
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
            {suggestions.length > 0 && (
              <div className="ai-sugg">
                {suggestions.map((s) => (
                  <b key={s} onClick={() => submit(s)}>{s}</b>
                ))}
              </div>
            )}
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
