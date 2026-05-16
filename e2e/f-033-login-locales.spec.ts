import { test, expect, type Page } from "@playwright/test";

type Locale = "en" | "de" | "es";

const LOGIN_COPY: Record<Locale, {
  heading: string;
  email: string;
  password: string;
  name: string;
  tabSignin: string;
  tabSignup: string;
  submitSignin: string;
  submitSignup: string;
  google: string;
  magicLink: string;
}> = {
  en: {
    heading: "Sign in",
    email: "Email",
    password: "Password",
    name: "Name",
    tabSignin: "Sign in",
    tabSignup: "Create account",
    submitSignin: "Sign in",
    submitSignup: "Create account",
    google: "Continue with Google",
    magicLink: "Email me a magic link",
  },
  de: {
    heading: "Anmelden",
    email: "E-Mail",
    password: "Passwort",
    name: "Name",
    tabSignin: "Anmelden",
    tabSignup: "Konto erstellen",
    submitSignin: "Anmelden",
    submitSignup: "Konto erstellen",
    google: "Mit Google fortfahren",
    magicLink: "Magic Link per E-Mail",
  },
  es: {
    heading: "Inicia sesión",
    email: "E-mail",
    password: "Contraseña",
    name: "Nombre",
    tabSignin: "Iniciar sesión",
    tabSignup: "Crear cuenta",
    submitSignin: "Iniciar sesión",
    submitSignup: "Crear cuenta",
    google: "Continuar con Google",
    magicLink: "Envíame un magic link",
  },
};

function uniqueEmail() {
  return `f033-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function assertLocaleLabels(page: Page, locale: Locale) {
  const copy = LOGIN_COPY[locale];
  await expect(page.getByTestId("login-title")).toHaveText(copy.heading);
  await expect(page.getByText(copy.email, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(copy.password, { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("tab-signin")).toHaveText(copy.tabSignin);
  await expect(page.getByTestId("tab-signup")).toHaveText(copy.tabSignup);
  await expect(page.getByTestId("submit-credentials")).toHaveText(
    copy.submitSignin,
  );
  await expect(page.getByTestId("btn-google")).toHaveText(copy.google);
  await expect(page.getByTestId("btn-magic-link")).toHaveText(copy.magicLink);
}

test.describe("F-033 — Login × 3 locales", () => {
  for (const locale of ["en", "de", "es"] as const) {
    test(`/${locale}/login shows translated labels from messages/${locale}.json`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/login`);
      await assertLocaleLabels(page, locale);
    });

    test(`/${locale}/login signin ↔ signup tab toggle works`, async ({
      page,
    }) => {
      const copy = LOGIN_COPY[locale];
      await page.goto(`/${locale}/login`);

      await expect(page.getByTestId("input-name")).toHaveCount(0);
      await expect(page.getByTestId("submit-credentials")).toHaveText(
        copy.submitSignin,
      );

      await page.getByTestId("tab-signup").click();
      await expect(page.getByTestId("input-name")).toBeVisible();
      await expect(page.getByText(copy.name, { exact: true }).first()).toBeVisible();
      await expect(page.getByTestId("submit-credentials")).toHaveText(
        copy.submitSignup,
      );

      await page.getByTestId("tab-signin").click();
      await expect(page.getByTestId("input-name")).toHaveCount(0);
      await expect(page.getByTestId("submit-credentials")).toHaveText(
        copy.submitSignin,
      );
    });
  }

  test("authenticated user on /de/login redirects to /de (not /)", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = "Sn0wb0ard!Strong";

    await page.goto("/en/login");
    await page.getByTestId("tab-signup").click();
    await page.getByTestId("input-name").fill("F033 Redirect");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-password").fill(password);
    await page.getByTestId("submit-credentials").click();
    await page.waitForURL(/\/(en|de|es)\/?$/);

    await page.goto("/de/login");
    await page.waitForURL(/\/de\/?$/);
    expect(new URL(page.url()).pathname).toBe("/de");

    await page.goto("/es/login");
    await page.waitForURL(/\/es\/?$/);
    expect(new URL(page.url()).pathname).toBe("/es");
  });
});
