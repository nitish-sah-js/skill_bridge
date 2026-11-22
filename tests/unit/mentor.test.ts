import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildContextBlock,
  buildMentorMessages,
  conversationTitle,
  skillsMentioned,
  wantsPracticalFeedback,
  type MentorContext,
} from "@/features/mentor/prompt";
import { GroqProvider, parseDelta } from "@/lib/ai/groq";
import { ProviderError } from "@/lib/ai/types";
import { mentorMessageSchema } from "@/lib/validation/schemas";

const ctx: MentorContext = {
  studentName: "Asha",
  careerName: "Cybersecurity Engineer",
  experienceLevel: "beginner",
  learningGoals: "SOC internship",
  prioritySkills: [{ name: "Linux Fundamentals", current: 32, required: 70, status: "beginner" }],
  mentionedSkills: [{ name: "Cryptography", current: null, required: 60, status: "not_assessed" }],
  strengths: ["Computer Networking"],
  notAssessed: ["Cryptography"],
  activeWeek: { number: 1, title: "Linux Fundamentals", objective: "Move Linux from 32 toward 70." },
  currentTask: null,
  practicalFeedback: [],
};

describe("mentor prompt", () => {
  it("includes the student's measured data and never invents values for unassessed skills", () => {
    const block = buildContextBlock(ctx);
    expect(block).toContain("Target career: Cybersecurity Engineer");
    expect(block).toContain("Linux Fundamentals: current 32/100, target 70 (beginner)");
    expect(block).toContain("Cryptography: current not assessed, target 60 (not assessed)");
    expect(block).toContain("Roadmap week 1");
  });

  it("limits history and puts the system prompt first", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `m${i}` }));
    const messages = buildMentorMessages(ctx, history, "Why Linux?");
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/authorized/);
    expect(messages.at(-1)).toEqual({ role: "user", content: "Why Linux?" });
    expect(messages.length).toBe(1 + 12 + 1);
  });

  it("detects mentioned skills and practical-feedback questions", () => {
    const skills = [{ name: "Linux Fundamentals" }, { name: "SQL & Relational Databases" }, { name: "Cryptography" }];
    expect(skillsMentioned("Why do I need linux for this?", skills).map((s) => s.name)).toEqual(["Linux Fundamentals"]);
    expect(skillsMentioned("explain sql joins", skills).map((s) => s.name)).toEqual(["SQL & Relational Databases"]);
    expect(wantsPracticalFeedback("Help me understand the mistake in my practical exercise")).toBe(true);
    expect(wantsPracticalFeedback("What is subnetting?")).toBe(false);
  });

  it("derives short conversation titles", () => {
    expect(conversationTitle("  I don't understand   subnetting ")).toBe("I don't understand subnetting");
    expect(conversationTitle("x".repeat(100))).toHaveLength(58);
  });
});

describe("mentor request validation", () => {
  it("rejects empty and over-long questions", () => {
    expect(mentorMessageSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(mentorMessageSchema.safeParse({ content: "a".repeat(2001) }).success).toBe(false);
    expect(mentorMessageSchema.safeParse({ content: "What is DNS?", extra: 1 }).success).toBe(false);
    expect(mentorMessageSchema.safeParse({ content: "What is DNS?" }).success).toBe(true);
  });
});

function sseResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const chunk of chunks) c.enqueue(encoder.encode(chunk));
        c.close();
      },
    }),
    { status },
  );
}

async function collect(stream: AsyncIterable<string>) {
  let text = "";
  for await (const t of stream) text += t;
  return text;
}

describe("Groq provider", () => {
  it("parses streamed deltas split across chunks", async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Sub"}}]}\n\ndata: {"choices":[{"de',
        'lta":{"content":"netting"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    const provider = new GroqProvider("key", "test-model", fetchMock as unknown as typeof fetch);
    expect(await collect(provider.streamChat([{ role: "user", content: "hi" }]))).toBe("Subnetting");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "test-model", stream: true });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
  });

  it("maps HTTP failures to typed provider errors", async () => {
    const provider = new GroqProvider("key", "m", (async () => new Response("no", { status: 429 })) as typeof fetch);
    await expect(collect(provider.streamChat([]))).rejects.toMatchObject({ kind: "rate_limited" });
    const auth = new GroqProvider("key", "m", (async () => new Response("no", { status: 401 })) as typeof fetch);
    await expect(collect(auth.streamChat([]))).rejects.toMatchObject({ kind: "auth" });
  });

  it("reports network failures as unavailable", async () => {
    const provider = new GroqProvider("key", "m", (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch);
    await expect(collect(provider.streamChat([]))).rejects.toBeInstanceOf(ProviderError);
  });

  it("ignores malformed lines but surfaces provider error payloads", () => {
    expect(parseDelta("not json")).toBe("");
    expect(() => parseDelta('{"error":{"message":"bad model"}}')).toThrow(ProviderError);
  });
});
