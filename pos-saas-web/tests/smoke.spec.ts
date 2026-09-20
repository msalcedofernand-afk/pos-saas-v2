import { expect, test } from "@playwright/test";

test("landing pública tiene metadata básica", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/POS SaaS V2/);
  await expect(page.locator("h1")).toContainText("Opera tu negocio");
});

test("demo muestra los tres modelos visuales", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.locator(".demo-model-card")).toHaveCount(3);
  await page.getByRole("tab", { name: /SaaS analítico/ }).click();
  await expect(page.locator(".v2-preview")).toContainText("Ventas de la semana");
  await page.getByRole("tab", { name: /POS de mesas/ }).click();
  await expect(page.locator(".v2-preview")).toContainText("Mesas y pedidos");
});

test("rutas SEO públicas están disponibles", async ({ request }) => {
  expect((await request.get("/robots.txt")).ok()).toBeTruthy();
  expect((await request.get("/sitemap.xml")).ok()).toBeTruthy();
  expect((await request.get("/icon.svg")).ok()).toBeTruthy();
});

test("dashboard solicita autenticación", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: { message: "No autenticado" } }),
  }));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
