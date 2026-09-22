import { expect, test } from "@playwright/test";

test("la raíz pública dirige al login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page).toHaveTitle(/Iniciar sesión/);
  await expect(page.locator("h1")).toContainText("Iniciar sesión");
});

test("rutas SEO públicas están disponibles", async ({ request }) => {
  expect((await request.get("/robots.txt")).ok()).toBeTruthy();
  expect((await request.get("/sitemap.xml")).ok()).toBeTruthy();
  expect((await request.get("/icon.svg")).ok()).toBeTruthy();
});

test("página pública de estado muestra la salud del servicio", async ({ page }) => {
  await page.goto("/status");
  await expect(page.locator("h1")).toContainText("Todo lo que necesitas");
  await expect(page.getByRole("button", { name: "Actualizar" })).toBeVisible();
});

test("dashboard solicita autenticación", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "No autenticado" } }),
    }),
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("panel global de auditoría está publicado", async ({ request }) => {
  const response = await request.get("/dashboard/platform/audit");
  expect(response.status()).toBe(200);
});
