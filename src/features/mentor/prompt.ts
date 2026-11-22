import { MENTOR_CONFIG } from "@/config/engine";
import type { ChatMessage } from "@/lib/ai/types";

export type MentorSkill = {
  name: string;
  current: number | null;
  required: number;
  status: "strong" | "developing" | "beginner" | "not_assessed";
};

export type MentorContext = {
  studentName: string | null;
  careerName: string | null;
  experienceLevel: string | null;
  learningGoals: string | null;
  /** Highest-priority gaps, already ordered. */
  prioritySkills: MentorSkill[];
  /** Career skills mentioned in the question (in addition to priorities). */
  mentionedSkills: MentorSkill[];
  strengths: string[];
  notAssessed: string[];
  activeWeek: { number: number; title: string; objective: string } | null;
  currentTask: { title: string; description: string; completionCriteria: string; skill: string | null; status: string } | null;
  practicalFeedback: { title: string; skill: string; score: string; missed: string[] }[];
};

const SYSTEM_PROMPT = `You are SkillBridge Mentor, a patient technical tutor for students preparing for a tech career.

How to teach:
- Match the student's measured level. If a skill is "beginner" or "not assessed", start from fundamentals and avoid jargon; if "developing", build on basics; if "strong", go deeper.
- Explain with a short example or analogy, then step-by-step reasoning. Keep answers focused (usually under 300 words) and use Markdown headings, lists and code blocks where useful.
- When the misunderstanding is unclear, ask one short diagnostic question before a long explanation.
- Offer a small practice exercise sized to the student's level when it helps.
- Connect explanations to the student's target career.
- When recommending what to study, rely only on the skill-gap data provided below. Never invent scores, and never claim the student has mastered something; proficiency changes only through assessments.
- For coding help, explain the error, why it happens, and how to fix it; encourage the student to try the fix themselves.
- For security topics, focus on defensive practice and authorized, legal lab environments. Refuse to help attack systems the student does not own or have written permission to test.
- If you are unsure of a fact, say so.`;

function describeSkill(s: MentorSkill): string {
  const current = s.current === null ? "not assessed" : `${Math.round(s.current)}/100`;
  return `${s.name}: current ${current}, target ${s.required} (${s.status.replace("_", " ")})`;
}

/** Build the minimal context block the model needs for this student and question. */
export function buildContextBlock(ctx: MentorContext): string {
  const lines: string[] = ["Student context (from SkillBridge records):"];
  if (ctx.studentName) lines.push(`- Name: ${ctx.studentName}`);
  lines.push(`- Target career: ${ctx.careerName ?? "not chosen yet"}`);
  if (ctx.experienceLevel) lines.push(`- Self-reported experience: ${ctx.experienceLevel}`);
  if (ctx.learningGoals) lines.push(`- Learning goals: ${ctx.learningGoals.slice(0, 300)}`);

  const skills = [...ctx.prioritySkills, ...ctx.mentionedSkills.filter((m) => !ctx.prioritySkills.some((p) => p.name === m.name))];
  if (skills.length) {
    lines.push("- Relevant skills (measured by SkillBridge assessments):");
    for (const s of skills) lines.push(`  - ${describeSkill(s)}`);
  } else {
    lines.push("- No assessment results yet.");
  }
  if (ctx.strengths.length) lines.push(`- Meets target: ${ctx.strengths.join(", ")}`);
  if (ctx.notAssessed.length) lines.push(`- Not yet assessed: ${ctx.notAssessed.join(", ")}`);
  if (ctx.activeWeek) {
    lines.push(`- Roadmap week ${ctx.activeWeek.number}: ${ctx.activeWeek.title}. Objective: ${ctx.activeWeek.objective}`);
  }
  if (ctx.currentTask) {
    const t = ctx.currentTask;
    lines.push(
      `- Current task: "${t.title}"${t.skill ? ` (${t.skill})` : ""}, status ${t.status.replace("_", " ")}. ${t.description} Completion criteria: ${t.completionCriteria}`,
    );
  }
  for (const p of ctx.practicalFeedback) {
    lines.push(
      `- Latest practical "${p.title}" (${p.skill}) scored ${p.score}.${p.missed.length ? ` Missed: ${p.missed.join("; ")}` : ""}`,
    );
  }
  return lines.join("\n");
}

export function buildMentorMessages(
  ctx: MentorContext,
  history: { role: "user" | "assistant"; content: string }[],
  question: string,
): ChatMessage[] {
  const recent = history.slice(-MENTOR_CONFIG.maxHistoryMessages);
  return [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${buildContextBlock(ctx)}` },
    ...recent.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];
}

/** Career skills whose names (or slug words) appear in the question. */
export function skillsMentioned<T extends { name: string }>(question: string, skills: T[]): T[] {
  const q = question.toLowerCase();
  return skills.filter((s) => {
    const name = s.name.toLowerCase();
    if (q.includes(name)) return true;
    const firstWord = name.split(/[\s&/]+/)[0];
    return firstWord.length >= 3 && new RegExp(`\\b${firstWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(q);
  });
}

export function wantsPracticalFeedback(question: string): boolean {
  return /\b(practical|challenge|assessment|mistake|feedback|rubric|score)\b/i.test(question);
}

export function conversationTitle(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
}
