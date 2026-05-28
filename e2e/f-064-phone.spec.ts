import { test, expect, type Page } from "@playwright/test";

function uniqueEmail() {
  return `f064-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F064 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  // Wait for the post-signup redirect so the session cookie is set before the
  // test navigates on; otherwise /dashboard races the cookie and the auth
  // middleware bounces to /login (no dashboard-page / phone-edit rendered).
  await page.waitForURL(/\/(en|de|es)\/?$/);
}

test.describe("F-064b — edit phone from the dashboard", () => {
  test("edit → save → reload persists the normalised number", async ({
    page,
  }) => {
    await signUp(page, uniqueEmail());

    await page.goto("/en/dashboard");
    await expect(page.getByTestId("dashboard-page")).toBeVisible();

    // Fresh account starts with no phone on file.
    await expect(page.getByTestId("dashboard-account-phone")).toContainText(
      "Not provided",
    );

    await page.getByTestId("phone-edit").click();
    // Spaces must be stripped on save.
    await page.getByTestId("phone-input").fill("+41 76 111 22 33");
    await page.getByTestId("phone-save").click();

    // `.first()` keeps this resilient to the duplicate-Toaster mount on main
    // (fixed separately in chore/fix-double-toaster), where each dashboard toast
    // renders twice; once that lands this still matches the single toast.
    await expect(page.getByText("Phone updated").first()).toBeVisible();
    await expect(page.getByTestId("dashboard-account-phone")).toContainText(
      "+41761112233",
    );

    // Reload: the value came from the server, not just local state.
    await page.reload();
    await expect(page.getByTestId("dashboard-account-phone")).toContainText(
      "+41761112233",
    );
  });

  test("rejects an invalid number inline without persisting", async ({
    page,
  }) => {
    await signUp(page, uniqueEmail());
    await page.goto("/en/dashboard");

    await page.getByTestId("phone-edit").click();
    await page.getByTestId("phone-input").fill("abc");
    await page.getByTestId("phone-save").click();

    await expect(page.getByTestId("phone-error")).toBeVisible();
    await page.getByTestId("phone-cancel").click();
    await expect(page.getByTestId("dashboard-account-phone")).toContainText(
      "Not provided",
    );
  });
});
