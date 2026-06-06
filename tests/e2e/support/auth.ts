import { expect, type Page } from "@playwright/test";

export async function loginAs(
  page: Page,
  persona: { email: string; password: string }
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(persona.email);
  await page.getByLabel("Password").fill(persona.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

export async function logout(page: Page) {
  await Promise.all([
    page.waitForURL(/\/login$/),
    page.getByRole("button", { name: "Sign out" }).click(),
  ]);
}
