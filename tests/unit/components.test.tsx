// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GapGauge } from "@/components/skills/gap-gauge";
import { Markdown } from "@/components/mentor/markdown";

describe("GapGauge", () => {
  it("describes current value, target and gap for screen readers", () => {
    render(<GapGauge current={32} required={70} status="beginner" label="Linux" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Linux: 32 of 100, target 70, gap 38");
  });

  it("states that an unassessed skill is unknown rather than zero", () => {
    render(<GapGauge current={null} required={60} status="not_assessed" label="Cryptography" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Cryptography: not assessed yet, target 60");
  });
});

describe("Markdown", () => {
  it("renders code, lists and emphasis without injecting HTML", () => {
    const { container } = render(
      <Markdown text={"**Subnets** split a network.\n\n- `/24` has 256 addresses\n- *hosts* exclude 2\n\n```bash\nip addr\n```\n<script>alert(1)</script>"} />,
    );
    expect(screen.getByText("Subnets").tagName).toBe("STRONG");
    expect(screen.getByText("/24").tagName).toBe("CODE");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("pre")?.textContent).toBe("ip addr");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
