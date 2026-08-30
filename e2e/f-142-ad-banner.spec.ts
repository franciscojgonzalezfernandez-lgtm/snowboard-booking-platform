import { test, expect, type Page } from "@playwright/test";
import { signUpVerified } from "./helpers/auth";
import { config as loadDotenv } from "dotenv";
import { PrismaClient, Role } from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

// Ad-banner CRUD mutates the shared banner set. Run serially and clean up any
// banner this spec creates so the home band other specs (f-053) see is stable.
test.describe.configure({ mode: "serial" });

const ROTATION_BODY = `E2E Rotation ${Date.now()}`;
const EMAIL_PREFIX = "f142-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUpAsAdmin(page: Page): Promise<void> {
  const email = uniqueEmail("admin");
  const userId = await signUpVerified(page, email, "F142 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.admin] },
  });
}

test.beforeAll(async () => {
  // Ensure at least one enabled banner so the band renders at all.
  const enabled = await prisma.adBanner.count({ where: { enabled: true } });
  if (enabled === 0) await prisma.adBanner.updateMany({ data: { enabled: true } });
});

test.afterAll(async () => {
  // Remove any banner this spec created (by its unique body copy).
  await prisma.adBanner.deleteMany({
    where: { body: { path: ["en"], equals: ROTATION_BODY } },
  });
  await prisma.$disconnect();
});

test.describe("F-142 ad banner", () => {
  test("the home renders an announcement band", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("complementary").first()).toBeVisible();
  });

  test("a second enabled banner makes the home band rotate", async ({ page }) => {
    await signUpAsAdmin(page);

    // Create a distinctly-labelled second banner through the admin UI (the
    // action revalidates the `ad-banners` cache tag, so the home reflects it).
    await page.goto("/admin/announcements");
    await page.getByTestId("announcement-new").click();
    await expect(page.getByTestId("announcement-create-dialog")).toBeVisible();
    await page.getByTestId("banner-body-en").fill(ROTATION_BODY);
    await page.getByTestId("banner-body-de").fill(`${ROTATION_BODY} DE`);
    await page.getByTestId("banner-body-es").fill(`${ROTATION_BODY} ES`);
    await page.getByTestId("announcement-submit").click();
    await expect(page.getByTestId("announcement-create-dialog")).toHaveCount(0);

    // Home now has 2+ enabled banners → the rotating carousel mounts, with
    // manual prev/next controls (also the reduced-motion affordance).
    await page.goto("/en");
    const band = page.getByRole("complementary").first();
    await expect(band).toBeVisible();
    const next = band.getByRole("button", { name: "Next announcement" });
    await expect(next).toBeVisible();

    // Click through the slides until the new banner's copy shows (only the
    // active slide is in the DOM). It must appear within the banner count.
    let found = false;
    for (let i = 0; i < 8; i++) {
      if (await band.getByText(ROTATION_BODY, { exact: false }).count()) {
        found = true;
        break;
      }
      await next.click();
    }
    expect(found).toBe(true);
  });

  test("reduced-motion still exposes manual controls", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/en");
    const band = page.getByRole("complementary").first();
    // With 2+ banners the carousel + its controls render regardless of motion
    // preference; auto-advance is what's suppressed under reduced motion.
    await expect(
      band.getByRole("button", { name: "Next announcement" }),
    ).toBeVisible();
    await context.close();
  });
});
