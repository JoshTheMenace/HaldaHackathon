import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, formatStudent, MODEL } from "@/lib/evaluator";
import fs from "fs";
import path from "path";

function loadJson(dir: string, slug: string) {
  const p = path.join(process.cwd(), "lib/data", dir, `${slug}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function evaluateCollege(
  student: unknown,
  college: Record<string, unknown>,
  client: Anthropic
): Promise<Record<string, unknown>> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3500,
    system: buildSystemPrompt(college),
    messages: [{ role: "user", content: formatStudent(student) }],
  });

  let raw = (message.content[0] as Anthropic.TextBlock).text.trim();
  if (raw.startsWith("```")) {
    const parts = raw.split("```");
    raw = parts[1];
    if (raw.startsWith("json")) raw = raw.slice(4);
    raw = raw.trim();
  }

  const result = JSON.parse(raw) as Record<string, unknown>;
  result._slug = college.slug;
  return result;
}

export async function POST(req: Request) {
  const { student_slug, college_slugs, halda_profile } = (await req.json()) as {
    student_slug?: string;
    college_slugs: string[];
    halda_profile?: unknown;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  let student: unknown;
  if (halda_profile) {
    student = halda_profile;
  } else if (student_slug) {
    try {
      student = loadJson("students", student_slug);
    } catch {
      return Response.json({ error: "Student not found" }, { status: 404 });
    }
  } else {
    return Response.json({ error: "student_slug or halda_profile required" }, { status: 400 });
  }

  const colleges = college_slugs.map((slug) => loadJson("colleges", slug));
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        await Promise.all(
          colleges.map(async (college) => {
            try {
              send(await evaluateCollege(student, college, client));
            } catch (e) {
              send({
                college: college.name,
                _slug: college.slug,
                error: String(e),
                score: 0,
                tier: "Error",
              });
            }
          })
        );
      } finally {
        controller.enqueue(encoder.encode("data: __done__\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
