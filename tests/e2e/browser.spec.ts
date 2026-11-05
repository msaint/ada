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
