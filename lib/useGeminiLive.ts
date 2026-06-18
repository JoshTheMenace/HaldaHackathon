"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality, Type, type Session } from "@google/genai";
import type { StudentProfile } from "./types";

// ── PCM helpers ───────────────────────────────────────────────────────────────
function floatToPcm16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const len = bin.length / 2;
  const out = new Float32Array(len);
  const view = new DataView(new ArrayBuffer(2));
  for (let i = 0; i < len; i++) {
    view.setUint8(0, bin.charCodeAt(i * 2));
    view.setUint8(1, bin.charCodeAt(i * 2 + 1));
    out[i] = view.getInt16(0, true) / 0x8000;
  }
  return out;
}

// Lean, spoken-conversation prompt (NOT the big JSON-extraction system prompt).
// `facts` is what we already know, so Halda never re-asks.
function voiceSystem(facts: string): string {
  return `You are Halda, a warm, encouraging AI college guide for high-school students (mostly sophomores). This is live voice chat inside the app, not a phone call: talk naturally, 1-2 short sentences, ONE question at a time. Never say "thanks for calling" or imply the student called you. Never output JSON or read formatting aloud.

It is currently 2026; use 2026 whenever you need the current year.

Your job: learn what they care about (their interests and WHY), their location and budget, and help them find colleges that fit.

- NEVER re-ask something you already know. ${facts}
- If the facts include chosenSchools or trackedSchools, switch from discovery into application-coach mode: help them meet requirements, improve odds, finish tasks, essays, transcripts, recommendations, aid, and deadlines for those school(s). Do not keep suggesting a fresh broad list unless they ask for alternatives.
- If the facts include isTransfer, country, visaNeed, internationalAidNeed, or targetSchools, adapt your role: transfer advisor, international counselor, or data-first comparison partner.
- When they ask for facts about one school, whether it is good for a program, or how they can improve odds there, call research_school first. Use hard facts from catalog/College Scorecard and program/culture context from web research.
- Infer city/state from their high school or ZIP (e.g. "Timpview High" or "84604" → Provo, UT) — don't ask where a local school they named is.
- Be specific and honest; never invent numbers or admit rates.`;
}

const LIVE_TOOLS = [{
  functionDeclarations: [{
    name: "research_school",
    description: "Fetch hard facts and web-grounded context for one school, including College Scorecard/catalog data and program/culture evidence.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        school: { type: Type.STRING, description: "School name, e.g. BYU or Utah Valley University" },
        question: { type: Type.STRING, description: "What the student wants to know, e.g. whether BYU is good for animation" },
      },
      required: ["school"],
    },
  }],
}];

export type VoiceStatus = "idle" | "connecting" | "live" | "speaking" | "error";
export interface VoiceTurn { role: "you" | "halda"; text: string }

export interface UseGeminiLive {
  status: VoiceStatus;
  error: string | null;
  userText: string;
  haldaText: string;
  transcript: VoiceTurn[];
  start: () => Promise<void>;
  stop: () => void;
  muted: boolean;
  toggleMute: () => void;
}

const LIVE_MODEL =
  process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";

export function useGeminiLive(opts: {
  onUserTurn?: (text: string) => void; // final user transcript → extraction
  onHaldaTurn?: (text: string) => void;
  knownFacts?: string; // "KNOWN SO FAR: …" injected so Halda doesn't re-ask
  profile?: StudentProfile;
}): UseGeminiLive {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [haldaText, setHaldaText] = useState("");
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [muted, setMuted] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const outCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const mutedRef = useRef(false);
  const playHeadRef = useRef(0);
  const uBufRef = useRef("");
  const hBufRef = useRef("");

  const playChunk = useCallback((b64: string) => {
    const ctx = outCtxRef.current;
    if (!ctx) return;
    const f32 = base64ToFloat32(b64);
    const buffer = ctx.createBuffer(1, f32.length, 24000);
    buffer.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(now, playHeadRef.current);
    src.start(startAt);
    playHeadRef.current = startAt + buffer.duration;
    setStatus("speaking");
    src.onended = () => {
      if (outCtxRef.current && playHeadRef.current - outCtxRef.current.currentTime < 0.05)
        setStatus((s) => (s === "speaking" ? "live" : s));
    };
  }, []);

  const stop = useCallback(() => {
    try { procRef.current?.disconnect(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { micCtxRef.current?.close(); } catch {}
    try { outCtxRef.current?.close(); } catch {}
    try { sessionRef.current?.close(); } catch {}
    procRef.current = null; streamRef.current = null;
    micCtxRef.current = null; outCtxRef.current = null; sessionRef.current = null;
    playHeadRef.current = 0;
    uBufRef.current = ""; hBufRef.current = "";
    setUserText(""); setHaldaText("");
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setStatus("connecting");
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) { setError("Missing NEXT_PUBLIC_GEMINI_API_KEY in .env.local."); setStatus("error"); return; }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This page can't use the microphone. Voice needs a secure context — open the app at http://localhost:3000 or over https:// (an IP address or plain http won't work).");
      setStatus("error");
      return;
    }

    // 1) MICROPHONE FIRST, so the browser's permission prompt is clearly tied to
    // the tap — and so we can give a precise reason if it's blocked.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone permission is blocked. Click the camera/🔒 icon in your browser's address bar, set Microphone to Allow, reload, then tap again."
          : name === "NotFoundError" || name === "DevicesNotFoundError"
          ? "No microphone was found. Connect one and tap to retry."
          : `Microphone error (${name || "unknown"}): ${(e as Error).message}`
      );
      setStatus("error");
      return;
    }

    // 2) Connect to Gemini Live and wire the audio in/out.
    try {
      const OutCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      outCtxRef.current = new OutCtx({ sampleRate: 24000 });
      await outCtxRef.current.resume();

      const ai = new GoogleGenAI({ apiKey });
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: voiceSystem(opts.knownFacts || "KNOWN SO FAR: nothing yet"),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: LIVE_TOOLS as any,
        },
        callbacks: {
          onopen: () => setStatus("live"),
          onmessage: (msg: any) => {
            if (msg.toolCall?.functionCalls?.length) {
              Promise.all(msg.toolCall.functionCalls.map(async (call: { id?: string; name?: string; args?: Record<string, unknown> }) => {
                let response: Record<string, unknown>;
                if (call.name === "research_school") {
                  const r = await fetch("/api/school-research", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      school: String(call.args?.school ?? ""),
                      question: String(call.args?.question ?? ""),
                      profile: opts.profile,
                    }),
                  });
                  response = r.ok ? await r.json() : { error: await r.text() };
                } else {
                  response = { error: `Unknown tool ${call.name}` };
                }
                return { id: call.id, name: call.name, response };
              }))
                .then((functionResponses) => sessionRef.current?.sendToolResponse({ functionResponses }))
                .catch((e) => sessionRef.current?.sendToolResponse({
                  functionResponses: { name: "research_school", response: { error: (e as Error).message } },
                }));
              return;
            }
            const sc = msg.serverContent;
            if (sc?.inputTranscription?.text) {
              uBufRef.current += sc.inputTranscription.text;
              setUserText(uBufRef.current);
            }
            if (sc?.outputTranscription?.text) {
              hBufRef.current += sc.outputTranscription.text;
              setHaldaText(hBufRef.current);
            }
            const parts = sc?.modelTurn?.parts ?? [];
            for (const p of parts) if (p.inlineData?.data) playChunk(p.inlineData.data);
            if (sc?.turnComplete) {
              const u = uBufRef.current.trim();
              const h = hBufRef.current.trim();
              // Append finalized turns in spoken order → a real timeline.
              setTranscript((cur) => [...cur, ...(u ? [{ role: "you" as const, text: u }] : []), ...(h ? [{ role: "halda" as const, text: h }] : [])]);
              if (u) opts.onUserTurn?.(u);
              if (h) opts.onHaldaTurn?.(h);
              uBufRef.current = ""; hBufRef.current = "";
              setUserText(""); setHaldaText("");
            }
          },
          onerror: (e: any) => { setError(`Couldn't reach Gemini Live. On Firefox this is usually an ad-blocker or strict Tracking Protection blocking the connection — try Chrome, or turn off tracking protection (shield icon) for this site. (${e?.message || "connection failed"})`); setStatus("error"); },
          onclose: () => setStatus((s) => (s === "error" ? s : "idle")),
        },
      });
      sessionRef.current = session;

      const MicCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const micCtx = new MicCtx({ sampleRate: 16000 });
      micCtxRef.current = micCtx;
      const source = micCtx.createMediaStreamSource(stream);
      const proc = micCtx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      proc.onaudioprocess = (ev) => {
        if (mutedRef.current || !sessionRef.current) return;
        const data = ev.inputBuffer.getChannelData(0);
        try {
          sessionRef.current.sendRealtimeInput({
            audio: { data: floatToPcm16Base64(data), mimeType: "audio/pcm;rate=16000" },
          });
        } catch {}
      };
      source.connect(proc);
      proc.connect(micCtx.destination);

      // Greet first so there's always audio even before the user speaks.
      // Adapt: ask the name only if we don't already know it.
      const knowName = /name=/.test(opts.knownFacts || "");
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: knowName
          ? "Greet me warmly by name in one sentence and pick up where we left off with one question. Do not mention calls or phones."
          : "Greet me warmly in one sentence and ask my name. Do not mention calls or phones." }] }],
        turnComplete: true,
      });
    } catch (e) {
      setError(`Couldn't connect to Gemini Live. On Firefox an ad-blocker or strict Tracking Protection often blocks this — try Chrome, or turn off tracking protection (shield icon) for this site. (model "${LIVE_MODEL}": ${(e as Error).message})`);
      setStatus("error");
      stop();
    }
  }, [opts, playChunk, stop]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, []);

  return { status, error, userText, haldaText, transcript, start, stop, muted, toggleMute };
}
