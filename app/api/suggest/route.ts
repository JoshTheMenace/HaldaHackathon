import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Quick-reply chips. A small, fast model reads the guide's latest message and,
// ONLY when it asks a question with a few natural choices, returns 2-4 short
// first-person replies the student could tap. Open-ended questions (name, "what
// are you into?") and non-questions return [] so we show nothing.
const MODEL = process.env.GEMINI_SUGGEST_MODEL || process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";

const SYS = `You generate quick-reply chips for a high-school student texting an AI college guide.
Read the guide's latest message and return SHORT replies the STUDENT could tap back — first person, max ~4 words each, 2-4 of them.
ONLY produce chips when the message asks a question with a SMALL, guessable set of answers: yes/no, this-or-that, or a short menu (e.g. "big school or small?", "want to see a few matches?", "any AP classes planned?").
Return an EMPTY array when the question is OPEN-ENDED or needs the student's own facts — their name, "what are you into?", "tell me about yourself", "what's your dream career?" — or when it isn't a question at all.
Output ONLY a JSON array of strings. Examples: ["Stay in Utah","Open to leaving","Not sure yet"] · ["Yes, show me","Not yet"] · []`;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });
  const { message, language } = (await req.json()) as { message?: string; language?: string };
  if (!message?.trim()) return NextResponse.json({ suggestions: [] });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: `Guide just said: "${message}"${language === "es" ? "\nReturn Spanish reply chips." : ""}`,
      config: { systemInstruction: SYS, temperature: 0.3, responseMimeType: "application/json" },
    });
    const arr = JSON.parse(res.text ?? "[]");
    const suggestions = Array.isArray(arr)
      ? arr.filter((x) => typeof x === "string" && x.trim()).map((x: string) => x.trim()).slice(0, 4)
      : [];
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
