import { expect, test, type Page } from "@playwright/test";

/**
 * The full demo journey: register → onboard → assess → gaps → roadmap → task →
 * mentor → refresh/sign out/sign in with data intact → follow-up assessment.
 */

const email = `student-${Date.now()}@example.com`;
const password = "Sk1llBridge-e2e!";
const mentorConfigured = Boolean(process.env.GROQ_API_KEY);

test.describe.configure({ mode: "serial" });

/** Start an assessment, take it in the proctored test window, and return to the results. */
async function takeAssessment(page: Page, startButton: string) {
  const popup = page.context().waitForEvent("page");
  await page.getByRole("button", { name: startButton }).click();
  const testWindow = await popup;
  await testWindow.waitForURL(/\/assessment\/[0-9a-f-]{36}\/take$/);
  await expect(page).toHaveURL(/\/assessment\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Your test runs in a separate window" })).toBeVisible();

  await testWindow.getByRole("button", { name: "Begin test in fullscreen" }).click();
  await answerAssessment(testWindow);
  await expect(testWindow.getByRole("heading", { name: "Assessment submitted" })).toBeVisible();
  await testWindow.waitForEvent("close", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /assessment results/i })).toBeVisible();
}

async function answerAssessment(page: Page) {
  // 20 multiple-choice questions: choose the first option each time.
  for (let i = 0; i < 20; i++) {
    await expect(page.getByText(`Item ${i + 1} of 22`)).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Next" }).click();
  }
  // Two practical challenges: one real attempt, one skipped.
  await expect(page.getByText("Item 21 of 22")).toBeVisible();
  await page.getByLabel("Your answer").fill("ip addr show; sudo find / -perm -4000 -type f; chmod 640 file; sha256sum evidence.img");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Item 22 of 22")).toBeVisible();
  await page.getByRole("button", { name: "Review answers" }).click();

  await expect(page.getByRole("heading", { name: "Ready to submit?" })).toBeVisible();
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
}

test("a student completes the full SkillBridge journey", async ({ page }) => {
  // 1. Register
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Asha Verma");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // 2. Onboarding
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByLabel("Full name")).toHaveValue("Asha Verma");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Education level").selectOption("undergraduate");
  await page.getByLabel("Technical experience").selectOption("beginner");
  await page.getByLabel("Institution").fill("State University");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "+ Security" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // 3. Select Cybersecurity Engineer
  await page.getByText("Cybersecurity Engineer", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Hours per week for learning").fill("6");
  await page.getByText("Steady", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Cybersecurity Engineer").last()).toBeVisible();
  await page.getByRole("button", { name: "Save and start assessment" }).click();

  // 4-6. Assessment with two practical challenges
  await expect(page).toHaveURL(/\/assessment$/);
  await takeAssessment(page, "Start assessment");

  // 7. Skill profile is shown
  await expect(page.getByRole("heading", { name: "Skill proficiency" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Computer Networking: \d+ of 100, target 75/ })).toBeVisible();

  // 8. Skill gaps
  await page.getByRole("link", { name: "View skill gaps" }).click();
  await expect(page.getByRole("heading", { name: "Skill gap" })).toBeVisible();
  await expect(page.getByText(/Readiness indicator based on \d+ of 10 skills/)).toBeVisible();

  // 9. Generate the roadmap
  await page.getByRole("button", { name: "Generate my roadmap" }).click();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(page.getByRole("heading", { name: /Cybersecurity Engineer: 6-week plan/ })).toBeVisible();
  await expect(page.getByText(/^0 of \d+ tasks completed$/)).toBeVisible();

  // 10-11. Complete a task and confirm progress updates
  await page.getByRole("button", { name: /^Start "/ }).first().click();
  await expect(page.getByRole("button", { name: /^Mark ".*" as completed$/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /^Mark ".*" as completed$/ }).first().click();
  await expect(page.getByText(/^1 of \d+ tasks completed$/)).toBeVisible();

  await page.goto("/progress");
  await expect(page.locator("#main").getByText("Roadmap complete")).toBeVisible();
  await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();

  // 12. Ask the mentor
  await page.goto("/mentor");
  if (mentorConfigured) {
    await page.getByLabel("Your question").fill("Why do I need Linux for cybersecurity? Answer in two sentences.");
    await page.getByRole("button", { name: "Send question" }).click();
    await expect(page).toHaveURL(/\/mentor\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await expect(page.locator("text=Mentor:").first()).toBeAttached();
  } else {
    await expect(page.locator("#main").getByText("The AI mentor isn't configured")).toBeVisible();
  }

  // 13. Refresh, sign out, sign back in: data persists
  await page.goto("/dashboard");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi, Asha" })).toBeVisible();
  await expect(page.getByText(/1 of \d+ tasks/)).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/1 of \d+ tasks/)).toBeVisible();

  // Follow-up assessment updates skill history and gaps
  await page.goto("/assessment");
  await takeAssessment(page, "Start follow-up assessment");
  await expect(page.getByRole("heading", { name: "Follow-up assessment results" })).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByRole("combobox", { name: "Skill" })).toBeVisible();
  await expect(page.getByText(/^2$/).first()).toBeVisible();
});

test("protected API routes reject anonymous requests", async ({ request }) => {
  for (const path of ["/api/profile", "/api/skill-gap", "/api/progress", "/api/mentor/conversations"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  }
});
