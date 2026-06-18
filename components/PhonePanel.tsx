"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Video, X } from "lucide-react";
import { useHalda } from "@/lib/useHalda";

const SMS_CHIPS = ["the money stuff", "yeah add it", "how do you remember all this?"];

export default function PhonePanel({ onClose }: { onClose: () => void }) {
  const { smsMessages, smsTyping, send, profile } = useHalda();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [smsMessages, smsTyping]);

  const submit = (t?: string) => {
    const v = (t ?? input).trim();
    if (!v) return;
    send(v, "sms");
    setInput("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotate: -4, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      exit={{ opacity: 0, y: 60, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="relative h-[560px] w-[280px] shrink-0"
    >
      {/* phone shell */}
      <div className="relative h-full w-full rounded-[42px] bg-pine p-2.5 shadow-lift ring-1 ring-black/10">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px] bg-cream">
          {/* notch */}
          <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-pine" />
          {/* status bar */}
          <div className="flex items-center justify-between px-6 pb-1 pt-2.5 text-[10px] font-700 text-pine">
            <span>9:41</span>
            <span className="opacity-70">Halda SMS</span>
          </div>
          {/* contact header */}
          <div className="flex items-center gap-2 border-b border-line bg-paper/70 px-3 py-2">
            <ChevronLeft size={18} className="text-coral" />
            <div className="flex flex-1 flex-col items-center">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-pine text-xs font-700 text-gold">
                🔭
              </span>
              <span className="text-[11px] font-700 text-pine">Halda</span>
            </div>
            <Video size={17} className="text-coral" />
          </div>

          {/* thread */}
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            <div className="mx-auto w-fit rounded-full bg-mist/70 px-2.5 py-0.5 text-[9px] font-600 text-sage">
              Text Message · now
            </div>
            <AnimatePresence initial={false}>
              {smsMessages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3 py-2 text-[12px] leading-snug ${
                      m.role === "student"
                        ? "rounded-br-sm bg-[#34c759] text-white"
                        : "rounded-bl-sm bg-[#e9e5dd] text-pine"
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {smsTyping && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-[#e9e5dd] px-3 py-2.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-sage"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* quick replies */}
          <div className="flex flex-wrap gap-1 px-2 pb-1">
            {SMS_CHIPS.map((c) => (
              <button key={c} onClick={() => submit(c)}
                className="rounded-full border border-coral/30 bg-coral/5 px-2 py-1 text-[10px] font-600 text-coral-ink">
                {c}
              </button>
            ))}
          </div>
          {/* input */}
          <div className="flex items-center gap-1.5 border-t border-line p-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Text Halda…"
              className="flex-1 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] outline-none" />
            <button onClick={() => submit()}
              className="grid h-7 w-7 place-items-center rounded-full bg-[#34c759] text-white">↑</button>
          </div>
        </div>
      </div>

      <button onClick={onClose}
        className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-pine text-cream shadow-lift">
        <X size={15} />
      </button>
      <div className="absolute -bottom-7 left-1/2 w-max -translate-x-1/2 text-center text-[10px] font-600 text-sage">
        Same Halda, now on {profile.name?.split(" ")[0] || "your"} phone — no app installed
      </div>
    </motion.div>
  );
}
