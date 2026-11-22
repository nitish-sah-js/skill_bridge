import { describe, expect, it } from "vitest";
import { createStrikeTracker, strikeOutcome } from "@/features/assessments/proctoring";
import { violationSchema } from "@/lib/validation/schemas";

describe("strike tracker", () => {
  it("ignores a focus loss shorter than the grace period", () => {
    const t = createStrikeTracker(1000);
    t.away(0);
    t.back(400);
    expect(t.check(2000)).toBeNull();
  });

  it("counts a focus loss once it passes the grace period", () => {
    const t = createStrikeTracker(1000);
    t.away(0);
    expect(t.check(999)).toBeNull();
    expect(t.check(1000)).toBe("focus_lost");
    expect(t.episodeOpen).toBe(true);
  });

  it("still counts a long absence when the student comes back before the next check", () => {
    const t = createStrikeTracker(1000);
    t.away(0);
    t.back(5000);
    expect(t.check(5000)).toBe("focus_lost");
  });

  it("raises only one strike per episode until the warning is acknowledged", () => {
    const t = createStrikeTracker(1000);
    t.away(0);
    expect(t.check(1500)).toBe("focus_lost");
    expect(t.instant("fullscreen_exit")).toBeNull();
    t.away(1600);
    expect(t.check(4000)).toBeNull();
    t.acknowledge();
    expect(t.instant("fullscreen_exit")).toBe("fullscreen_exit");
  });

  it("absorbs a pending focus loss into an instant strike", () => {
    const t = createStrikeTracker(1000);
    t.away(0);
    expect(t.instant("fullscreen_exit")).toBe("fullscreen_exit");
    expect(t.check(3000)).toBeNull();
  });

  it("counts reload and screenshot key immediately", () => {
    expect(createStrikeTracker().instant("reload")).toBe("reload");
    expect(createStrikeTracker().instant("screenshot_key")).toBe("screenshot_key");
  });
});

describe("strike outcome", () => {
  it("warns for strikes 1 to 3 and auto-submits on the 4th", () => {
    expect(strikeOutcome(1, 3)).toEqual({ kind: "warning", number: 1, remaining: 2 });
    expect(strikeOutcome(3, 3)).toEqual({ kind: "warning", number: 3, remaining: 0 });
    expect(strikeOutcome(4, 3)).toEqual({ kind: "auto_submit" });
  });
});

describe("violation schema", () => {
  it("accepts known types with an optional draft and rejects unknown ones", () => {
    expect(violationSchema.safeParse({ type: "focus_lost" }).success).toBe(true);
    expect(
      violationSchema.safeParse({ type: "reload", answers: { "7c9e6679-7425-40de-944b-e07fc1f90ae7": 1 } }).success,
    ).toBe(true);
    expect(violationSchema.safeParse({ type: "devtools" }).success).toBe(false);
  });
});
