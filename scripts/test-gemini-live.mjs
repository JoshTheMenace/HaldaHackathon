// Verifies the Gemini Live API actually streams AUDIO back for our key+model.
// Run: node --env-file=.env.local scripts/test-gemini-live.mjs
import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY (use --env-file=.env.local)");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

let audioBytes = 0;
let audioChunks = 0;
let transcript = "";
let mime = "";
let done = false;

const finish = (ok, note) => {
  console.log("\n──── RESULT ────");
  console.log("model:           ", model);
  console.log("audio chunks:    ", audioChunks);
  console.log("audio bytes:     ", audioBytes);
  console.log("audio mime:      ", mime || "(none)");
  console.log("output transcript:", JSON.stringify(transcript.trim().slice(0, 200)));
  console.log("VERDICT:         ", ok ? "✅ AUDIO RECEIVED" : "❌ NO AUDIO", note || "");
  process.exit(ok ? 0 : 1);
};

const timeout = setTimeout(() => finish(audioBytes > 0, "(timeout)"), 20000);

const session = await ai.live.connect({
  model,
  callbacks: {
    onopen: () => console.log("● live session opened"),
    onmessage: (msg) => {
      const sc = msg.serverContent;
      if (sc?.outputTranscription?.text) transcript += sc.outputTranscription.text;
      const parts = sc?.modelTurn?.parts ?? [];
      for (const p of parts) {
        if (p.inlineData?.data) {
          audioChunks++;
          audioBytes += Buffer.from(p.inlineData.data, "base64").length;
          mime = p.inlineData.mimeType || mime;
        }
      }
      if (sc?.turnComplete && !done) {
        done = true;
        clearTimeout(timeout);
        setTimeout(() => finish(audioBytes > 0), 300);
      }
    },
    onerror: (e) => { clearTimeout(timeout); console.error("onerror:", e?.message || e); finish(false, "(error)"); },
    onclose: (e) => console.log("● closed:", e?.reason || ""),
  },
  config: {
    responseModalities: [Modality.AUDIO],
    outputAudioTranscription: {},
    systemInstruction:
      "You are Halda, a warm college guide. Reply in one short friendly sentence.",
  },
});

console.log("→ sending a text turn, expecting spoken audio back…");
session.sendClientContent({
  turns: [{ role: "user", parts: [{ text: "Hi! Say hello and ask my name." }] }],
  turnComplete: true,
});
