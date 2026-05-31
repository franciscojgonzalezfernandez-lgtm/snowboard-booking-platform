import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  Locale as DbLocale,
  PrismaClient,
  Role,
} from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();
const EMAIL_PREFIX = "f073-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUpAsInstructor(page: Page): Promise<{
  userId: string;
  instructorId: string;
}> {
  const email = uniqueEmail("instr");
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F073 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  await prisma.user.update({
    where: { id: user.id },
    data: { roles: [Role.student, Role.instructor] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId: user.id,
      bio: "Seed bio",
      specialties: ["freestyle"],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  return { userId: user.id, instructorId: instructor.id };
}

test.afterAll(async () => {
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
  await prisma.$disconnect();
});

test("instructor edits bio + specialties + languages and the changes persist", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { instructorId } = await signUpAsInstructor(page);

  await page.goto("/instructor/profile");
  await expect(page.getByTestId("instructor-profile")).toBeVisible();

  // Edit bio.
  const bio = page.getByTestId("profile-bio");
  await bio.fill("New bio — F-073 e2e.");

  // Add a specialty.
  await page.getByTestId("profile-specialty-input").fill("kids");
  await page.getByTestId("profile-specialty-add").click();
  await expect(page.getByTestId("profile-specialty-kids")).toBeVisible();

  // Add a language (German).
  await page.getByTestId("profile-language-de").click();

  await page.getByTestId("profile-form-submit").click();

  // Server persisted everything.
  await page.waitForTimeout(500);
  const row = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { bio: true, specialties: true, languages: true },
  });
  expect(row?.bio).toBe("New bio — F-073 e2e.");
  expect(row?.specialties).toEqual(
    expect.arrayContaining(["freestyle", "kids"]),
  );
  expect(row?.languages).toEqual(
    expect.arrayContaining([DbLocale.en, DbLocale.de]),
  );
});

test("submit on an invalid bio surfaces an inline banner and focuses the field", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await signUpAsInstructor(page);

  await page.goto("/instructor/profile");
  // Force a too-long bio via fill (Textarea ignores maxLength on programmatic fill).
  await page.getByTestId("profile-bio").evaluate((el, value) => {
    const target = el as HTMLTextAreaElement;
    target.value = value;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("blur", { bubbles: true }));
  }, "a".repeat(2001));

  // Submit is clickable — no silent disable.
  const submit = page.getByTestId("profile-form-submit");
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByTestId("profile-form-error")).toBeVisible();
  await expect(page.getByTestId("profile-bio")).toBeFocused();
});

test("blob token not configured shows the inline notice and disables the upload controls", async ({
  page,
}) => {
  test.setTimeout(60_000);
  test.skip(
    Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    "Skipped when Vercel Blob is provisioned — the gated UI is only relevant on environments without the token.",
  );
  await signUpAsInstructor(page);
  await page.goto("/instructor/profile");

  await expect(page.getByTestId("photo-uploader-not-configured")).toBeVisible();
  await expect(page.getByTestId("photo-uploader-pick")).toBeDisabled();
});

test("blob token configured: uploading a tiny PNG persists the photo URL", async ({
  page,
}) => {
  test.setTimeout(90_000);
  test.skip(
    !process.env.BLOB_READ_WRITE_TOKEN,
    "Skipped when Vercel Blob is not provisioned. Set BLOB_READ_WRITE_TOKEN locally via `vercel env pull` to exercise this path.",
  );
  const { instructorId } = await signUpAsInstructor(page);
  await page.goto("/instructor/profile");

  // 1x1 transparent PNG.
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Z4n8s8AAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByTestId("photo-uploader-input").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  await page.waitForTimeout(1500);
  const row = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { photo: true },
  });
  expect(row?.photo).toBeTruthy();
  expect(row?.photo).toMatch(/^https:\/\/.+public\.blob\.vercel-storage\.com\//);
});
