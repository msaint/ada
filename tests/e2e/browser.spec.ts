import { test, expect, type Page } from "@playwright/test";
// Explicitly enabled on a machine with Playwright browsers. The managed session
// had no browser-control tool; these cases were authored but not executed here.
test.skip(
  process.env.ADA_BROWSER_TESTS !== "true",
  "Requires supported browser QA runtime",
);
async function createCourse(page: Page, topic: string) {
  await page.goto("/app");
  await page
    .getByRole("textbox", { name: "What would you like to learn?" })
    .fill(topic);
  await page.getByRole("button", { name: "Start a new course" }).click();
  await expect(
    page.getByRole("button", { name: "Let Ada decide · Start now" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Let Ada decide · Start now" })
    .click();
  await page.getByRole("button", { name: "Start course", exact: true }).click();
  await page.getByRole("button", { name: "Begin learning" }).click();
}
test("curiosity: keyboard answer, feedback and exact reload", async ({
  page,
}) => {
  await createCourse(page, "Exploring a new curiosity");
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Reading counts activity",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Learning evidence" }),
  ).toBeVisible();
});
test("goal: mobile course drawer and assisted evidence", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCourse(page, "Learn something for work");
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(
    page.getByText("This attempt will be recorded as assisted."),
  ).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Open course menu" }).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByText("Assisted · correct")).toBeVisible();
});

test("answer autosave stays quiet and submission waits for it", async ({
  page,
}) => {
  await createCourse(page, "Quiet answer saving");
  let releaseSave!: () => void;
  const holdSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  let saving!: () => void;
  const saveStarted = new Promise<void>((resolve) => {
    saving = resolve;
  });
  let submittedAnswer: string | undefined;
  await page.route("**/api/v1/command", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "saveAnswer") {
      saving();
      await holdSave;
    }
    if (body.action === "attempt") submittedAnswer = body.text;
    await route.continue();
  });
  try {
    const choices = page.getByRole("radio");
    await choices.first().check();
    await saveStarted;
    await expect(choices.nth(1)).toBeEnabled();
    const submit = page.getByRole("button", {
      name: "Check answer",
      exact: true,
    });
    await expect(submit).toBeEnabled();
    await choices.nth(1).check();
    const selected = await choices.nth(1).inputValue();
    await submit.click();
    releaseSave();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    expect(submittedAnswer).toBe(selected);
  } finally {
    releaseSave();
  }
});
