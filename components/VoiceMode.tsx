"use client";

import { motion } from "framer-motion";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { useGeminiLive } from "@/lib/useGeminiLive";
import { useHalda } from "@/lib/useHalda";

export default function VoiceMode() {
  const { ingestVoiceUser, pushHaldaMessage } = useHalda();
  const live = useGeminiLive({
    onUserTurn: (t) => ingestVoiceUser(t),
    onHaldaTurn: (t) => pushHaldaMessage(t, "web"),
  });

  const active = live.status === "live" || live.status === "speaking";
  const label =
    live.status === "idle" ? "Tap to talk to Halda"
    : live.status === "connecting" ? "Connecting…"
    : live.status === "speaking" ? "Halda is speaking…"
    : live.status === "error" ? "Mic blocked — tap to retry"
    : "Listening… just talk";

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-5">
      {/* the orb */}
      <button
        onClick={() => (active ? live.stop() : live.start())}
        className="relative grid h-28 w-28 place-items-center"
        aria-label={active ? "End voice" : "Start voice"}
      >
        {active && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-coral/25"
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <motion.span
              className="absolute inset-2 rounded-full bg-coral/30"
              animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.1, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}
        <motion.span
          className={`relative grid h-20 w-20 place-items-center rounded-full text-cream shadow-lift ${
            live.status === "speaking" ? "bg-gold text-gold-ink" : active ? "bg-coral" : "bg-pine"
          }`}
          animate={live.status === "speaking" ? { scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 0.6, repeat: Infinity }}
        >
          {live.status === "connecting" ? <Loader2 className="animate-spin" size={28} />
            : active ? <Mic size={30} /> : <Mic size={30} />}
        </motion.span>
      </button>

      <div className="text-center">
        <div className="font-display text-sm font-700 text-pine">{label}</div>
        <div className="text-[11px] text-sage">powered by Gemini Live · gemini-3.1</div>
      </div>

      {/* live partial transcript */}
      {(live.userText || live.haldaText) && (
        <div className="w-full space-y-1.5 rounded-xl2 border border-line bg-cream/70 p-3 text-[12px]">
          {live.haldaText && <p className="text-pine"><b className="text-coral">Halda:</b> {live.haldaText}</p>}
          {live.userText && <p className="text-sage"><b>You:</b> {live.userText}</p>}
        </div>
      )}

      {active && (
        <div className="flex items-center gap-2">
          <button onClick={live.toggleMute}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-700 ${live.muted ? "bg-pine text-cream" : "bg-mist text-coral-ink"}`}>
            {live.muted ? <MicOff size={13} /> : <Mic size={13} />} {live.muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={live.stop}
            className="flex items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-[11px] font-700 text-white">
            <PhoneOff size={13} /> End
          </button>
        </div>
      )}
      {live.error && live.status === "live" && (
        <p className="text-center text-[10.5px] text-sage">{live.error}</p>
      )}
    </div>
  );
}
