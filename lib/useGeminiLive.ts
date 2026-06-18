"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality, type Session } from "@google/genai";
import { HALDA_SYSTEM } from "./halda-prompt";

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

const VOICE_SYSTEM =
  HALDA_SYSTEM.split("OUTPUT:")[0] +
  "\nThis is a SPOKEN conversation — talk naturally and conversationally, like a real call. Keep replies short (1-2 sentences), one question at a time. Do not output JSON or read formatting aloud.";

export type VoiceStatus = "idle" | "connecting" | "live" | "speaking" | "error";

export interface UseGeminiLive {
  status: VoiceStatus;
  error: string | null;
  userText: string;
  haldaText: string;
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
}): UseGeminiLive {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [haldaText, setHaldaText] = useState("");
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
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) { setError("Missing NEXT_PUBLIC_GEMINI_API_KEY"); setStatus("error"); return; }

    try {
      // Output playback context (24 kHz from Gemini)
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
          systemInstruction: VOICE_SYSTEM,
        },
        callbacks: {
          onopen: () => setStatus("live"),
          onmessage: (msg: any) => {
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
              if (u) opts.onUserTurn?.(u);
              if (h) opts.onHaldaTurn?.(h);
              uBufRef.current = ""; hBufRef.current = "";
            }
          },
          onerror: (e: any) => { setError(e?.message || "live error"); setStatus("error"); },
          onclose: () => setStatus((s) => (s === "error" ? s : "idle")),
        },
      });
      sessionRef.current = session;

      // Mic capture (16 kHz to Gemini). Non-fatal: if the mic is blocked we keep
      // the session so Halda can still speak (and the receive path is testable).
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        streamRef.current = stream;
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
      } catch {
        setError("Mic unavailable — you can still hear Halda; type to reply.");
      }

      // Greet first so the demo always has audio even before the user speaks.
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "Greet me warmly in one sentence and ask my name." }] }],
        turnComplete: true,
      });
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
      stop();
    }
  }, [opts, playChunk, stop]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, []);

  return { status, error, userText, haldaText, start, stop, muted, toggleMute };
}
