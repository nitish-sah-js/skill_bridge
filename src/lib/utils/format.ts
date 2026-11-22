export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("en", opts).format(new Date(iso));
}

export function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value)}`;
}

export function firstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}

export const TASK_STATUS_LABEL = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  needs_review: "Needs review",
} as const;

export const SKILL_STATUS_LABEL = {
  strong: "Meets target",
  developing: "Developing",
  beginner: "Beginner",
  not_assessed: "Not assessed",
} as const;

export const TASK_TYPE_LABEL = {
  learn: "Learn",
  practice: "Practice",
  project: "Project",
  assessment: "Assessment",
} as const;
