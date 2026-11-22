import { PROCTORING_CONFIG } from "@/config/engine";
import type { ViolationType } from "@/lib/validation/schemas";

/**
 * Strike rules for a proctored assessment. Pure: the test window feeds it timestamped
 * browser events and it decides which ones count. One strike per "away episode": once a
 * strike is raised, nothing else counts until the student acknowledges the warning.
 */
export type StrikeTracker = {
  /** Window hidden or lost focus. Counts only if it lasts past the grace period (see `check`). */
  away(now: number): void;
  /** Window visible and focused again. Cancels a pending focus loss still inside the grace period. */
  back(now: number): void;
  /** Call periodically (and on `back`) to turn a long-enough focus loss into a strike. */
  check(now: number): ViolationType | null;
  /** Fullscreen exit, reload or Print Screen: counts immediately unless an episode is already open. */
  instant(type: Exclude<ViolationType, "focus_lost">): ViolationType | null;
  /** The student dismissed the warning and is back in the test. */
  acknowledge(): void;
  readonly episodeOpen: boolean;
};

export function createStrikeTracker(graceMs: number = PROCTORING_CONFIG.focusGraceMs): StrikeTracker {
  let awaySince: number | null = null;
  let episodeOpen = false;

  function open(type: ViolationType): ViolationType {
    episodeOpen = true;
    awaySince = null;
    return type;
  }

  return {
    away(now) {
      if (episodeOpen || awaySince !== null) return;
      awaySince = now;
    },
    back(now) {
      if (awaySince !== null && now - awaySince < graceMs) awaySince = null;
    },
    check(now) {
      if (episodeOpen || awaySince === null || now - awaySince < graceMs) return null;
      return open("focus_lost");
    },
    instant(type) {
      if (episodeOpen) return null;
      return open(type);
    },
    acknowledge() {
      episodeOpen = false;
      awaySince = null;
    },
    get episodeOpen() {
      return episodeOpen;
    },
  };
}

export type StrikeOutcome = { kind: "warning"; number: number; remaining: number } | { kind: "auto_submit" };

/** Strikes up to `maxWarnings` warn; the next one auto-submits. */
export function strikeOutcome(count: number, maxWarnings: number = PROCTORING_CONFIG.maxWarnings): StrikeOutcome {
  if (count > maxWarnings) return { kind: "auto_submit" };
  return { kind: "warning", number: count, remaining: maxWarnings - count };
}

export const VIOLATION_LABELS: Record<ViolationType, string> = {
  focus_lost: "You left the test window.",
  fullscreen_exit: "You left fullscreen.",
  reload: "The test page was reloaded.",
  screenshot_key: "The screenshot key was pressed.",
};
