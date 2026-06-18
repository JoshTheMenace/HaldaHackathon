"use client";

import { useEffect, useMemo } from "react";
import { useGeminiLive } from "@/lib/useGeminiLive";
import { useHalda } from "@/lib/useHalda";
import { rankInterestMatches, schoolById } from "@/lib/interest-match";
import { Icon } from "./Icon";
import { CampusPhoto, SchoolLogo } from "./SchoolImage";

export default function VoiceView({ onOpenSchool }: { onOpenSchool?: (id: string) => void }) {
  const { ingestVoiceUser, pushHaldaMessage, profile, matchesRevealed } = useHalda();
  const live = useGeminiLive({
    onUserTurn: (t) => ingestVoiceUser(t),
    onHaldaTurn: (t) => pushHaldaMessage(t, "voice"),
  });

  // Always release the mic / live session when leaving voice.
  useEffect(() => () => live.stop(), [live.stop]);

  const matches = useMemo(() => (matchesRevealed ? rankInterestMatches(profile, 6) : []), [matchesRevealed, profile]);
  const active = live.status === "live" || live.status === "speaking";
  const label =
    live.status === "idle" ? "Tap to talk to Halda" :
    live.status === "connecting" ? "Connecting…" :
    live.status === "speaking" ? "Halda is speaking…" :
    live.status === "error" ? "Mic blocked — tap to retry" :
    "Listening… just talk";

  return (
    <div className="voice">
      <button className={`orb ${active ? "on" : ""} ${live.status === "speaking" ? "speak" : ""}`}
        onClick={() => (active ? live.stop() : live.start())} aria-label={active ? "End voice" : "Start voice"}>
        {active && <><span className="ring r1" /><span className="ring r2" /></>}
        <span className="orb-core">
          <Icon name={live.status === "connecting" ? "sync" : "mic"} />
        </span>
      </button>

      <div className="voice-label">{label}</div>
      <div className="voice-sub">Gemini Live · talk through your whole plan</div>

      {(live.userText || live.haldaText) && (
        <div className="voice-transcript">
          {live.haldaText && <p><b>Halda</b> {live.haldaText}</p>}
          {live.userText && <p className="you"><b>You</b> {live.userText}</p>}
        </div>
      )}

      {matches.length > 0 && (
        <div className="voice-matches">
          <div className="vm-head"><Icon name="auto_awesome" /> Schools Halda found for you</div>
          <div className="vm-row">
            {matches.map((m) => {
              const s = schoolById(m.schoolId)!;
              return (
                <button key={m.schoolId} className="vm-card" onClick={() => onOpenSchool?.(m.schoolId)}>
                  <span className="vm-photo"><CampusPhoto id={s.id} /><span className="vm-logo"><SchoolLogo id={s.id} /></span></span>
                  <div className="vm-b"><b>{s.short}</b><span>{m.overallFit}% match</span></div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {active && (
        <div className="voice-ctrl">
          <button className={`vc-btn${live.muted ? " on" : ""}`} onClick={live.toggleMute}>
            <Icon name={live.muted ? "mic_off" : "mic"} /> {live.muted ? "Unmute" : "Mute"}
          </button>
          <button className="vc-btn end" onClick={live.stop}><Icon name="call_end" /> End</button>
        </div>
      )}
      {live.error && active && <p className="voice-err">{live.error}</p>}
    </div>
  );
}
