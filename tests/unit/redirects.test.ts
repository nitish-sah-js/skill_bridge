import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/features/auth/redirects";

describe("safeNextPath", () => {
  it("allows relative app paths only", () => {
    expect(safeNextPath("/roadmap")).toBe("/roadmap");
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
