"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { useHalda } from "@/lib/useHalda";
import { GuideStar } from "./brand";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-sage"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export default function WebChat() {
  const { messages, typing, send } = useHalda();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const submit = () => {
    if (!input.trim()) return;
    send(input, "web");
    setInput("");
  };

  const lastChips = !typing
    ? messages[messages.length - 1]?.role === "halda"
      ? messages[messages.length - 1]?.chips
      : undefined
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-pine text-gold">
          <GuideStar size={18} fill="var(--gold)" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-success" />
        </span>
        <div className="leading-tight">
          <div className="font-display text-sm font-700 text-pine">Halda</div>
          <div className="text-[11px] font-500 text-success">online · web chat</div>
        </div>
        <span className="ml-auto rounded-full bg-mist px-2.5 py-1 text-[10px] font-600 text-coral-ink">
          remembers everything
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "halda" && (
                <span className="mr-2 mt-1 shrink-0 text-coral">
                  <GuideStar size={14} fill="var(--coral)" />
                </span>
              )}
              <div
                className={`max-w-[78%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-soft ${
                  m.role === "student"
                    ? "rounded-br-md bg-pine text-cream"
                    : "rounded-bl-md bg-paper text-pine"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <div className="flex justify-start">
            <span className="mr-2 mt-1 text-coral">
              <GuideStar size={14} fill="var(--coral)" />
            </span>
            <div className="rounded-2xl rounded-bl-md bg-paper px-2 py-1 shadow-soft">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {lastChips && lastChips.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {lastChips.map((c) => (
            <button
              key={c}
              onClick={() => send(c, "web")}
              className="rounded-full border border-coral/40 bg-coral/5 px-3 py-1.5 text-xs font-600 text-coral-ink transition hover:bg-coral/10"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Text Halda anything…"
          className="flex-1 rounded-full border border-line bg-cream px-4 py-2.5 text-sm text-pine outline-none transition focus:border-coral/50 focus:ring-2 focus:ring-coral/15"
        />
        <button
          onClick={submit}
          className="grid h-10 w-10 place-items-center rounded-full bg-coral text-white shadow-soft transition hover:scale-105 active:scale-95"
          aria-label="Send"
        >
          <SendHorizonal size={17} />
        </button>
      </div>
    </div>
  );
}
