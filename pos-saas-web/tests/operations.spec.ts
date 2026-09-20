import { expect, test, type APIRequestContext } from "@playwright/test";

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3000";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const configured = Boolean(email && password);

async function login(request: APIRequestContext) {
  const response = await request.post(`${apiUrl}/api/v1/auth/login`, { data: { email, password } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<{ data: { user: { roles: string[] } } }>;
}

async function createTestProduct(request: APIRequestContext) {
  const categoriesResponse = await request.get(`${apiUrl}/api/v1/categories`);
  const categories = (await categoriesResponse.json()).data as { id: string }[];
  expect(categories.length).toBeGreaterThan(0);
  const response = await request.post(`${apiUrl}/api/v1/products`, {
    data: { categoryId: categories[0].id, name: `E2E producto ${Date.now()}`, price: 9.9, isAvailable: true, prepTimeMinutes: 5 },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: string };
}

async function createTestOrder(request: APIRequestContext) {
  const product = await createTestProduct(request);
  const response = await request.post(`${apiUrl}/api/v1/orders`, {
    data: { tableId: null, guests: 1, items: [{ productId: product.id, quantity: 1 }] },
  });
  expect(response.status(), await response.text()).toBe(201);
  return { order: (await response.json()).data as { id: string }, product };
}

test.describe("operaciones autenticadas", () => {
  test("login correcto", async ({ request }) => {
    test.skip(!configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const result = await login(request);
    expect(result.data.user.roles.length).toBeGreaterThan(0);
  });

  test("login incorrecto", async ({ request }) => {
    test.skip(!configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const response = await request.post(`${apiUrl}/api/v1/auth/login`, { data: { email, password: `${password}-incorrecta` } });
    expect(response.status()).toBe(401);
  });

  test("creación y limpieza de productos", async ({ request }) => {
    test.skip(!configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const result = await login(request);
    test.skip(!result.data.user.roles.includes("admin"), "La cuenta E2E debe tener rol admin");
    const product = await createTestProduct(request);
    expect((await request.delete(`${apiUrl}/api/v1/products/${product.id}`)).status()).toBe(200);
  });

  test("creación de pedidos", async ({ request }) => {
    test.skip(!configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const result = await login(request);
    test.skip(!result.data.user.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)), "La cuenta E2E no puede crear pedidos");
    const { order, product } = await createTestOrder(request);
    expect((await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, { data: { status: "cancelled" } })).status()).toBe(200);
    if (result.data.user.roles.includes("admin")) await request.delete(`${apiUrl}/api/v1/products/${product.id}`);
  });

  test("cancelación de pedidos", async ({ request }) => {
    test.skip(!configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const result = await login(request);
    test.skip(!result.data.user.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)), "La cuenta E2E no puede cancelar pedidos");
    const { order, product } = await createTestOrder(request);
    const cancelled = await request.patch(`${apiUrl}/api/v1/orders/${order.id}/status`, { data: { status: "cancelled" } });
    expect(cancelled.status()).toBe(200);
    if (result.data.user.roles.includes("admin")) await request.delete(`${apiUrl}/api/v1/products/${product.id}`);
  });

  test("apertura y cierre de caja", async ({ request }) => {
    test.skip(!configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const result = await login(request);
    test.skip(!result.data.user.roles.some((role) => ["admin", "cashier"].includes(role)), "La cuenta E2E no puede operar caja");
    const summary = await (await request.get(`${apiUrl}/api/v1/cash/summary`)).json();
    if (summary.data.shift) {
      expect(summary.data.shift.status).toBe("open");
      return;
    }
    expect((await request.post(`${apiUrl}/api/v1/cash/open`, { data: { openingAmount: 0 } })).status()).toBe(201);
    expect((await request.post(`${apiUrl}/api/v1/cash/close`, { data: { closingAmount: 0 } })).status()).toBe(200);
  });

  test("cambio de estados en cocina", async ({ request }) => {
    test.skip(!configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const result = await login(request);
    test.skip(!result.data.user.roles.includes("admin"), "La cuenta E2E debe tener rol admin para este flujo");
    const { order, product } = await createTestOrder(request);
    for (const status of ["preparing", "ready", "served"]) {
      const response = await request.patch(`${apiUrl}/api/v1/kitchen/orders/${order.id}/status`, { data: { status } });
      expect(response.status(), await response.text()).toBe(200);
    }
    await request.delete(`${apiUrl}/api/v1/products/${product.id}`);
  });

  test("restricciones según rol", async ({ request }) => {
    test.skip(!process.env.E2E_RESTRICTED_EMAIL || !process.env.E2E_RESTRICTED_PASSWORD, "Configura credenciales E2E_RESTRICTED_* para probar restricciones");
    const response = await request.post(`${apiUrl}/api/v1/auth/login`, { data: { email: process.env.E2E_RESTRICTED_EMAIL, password: process.env.E2E_RESTRICTED_PASSWORD } });
    expect(response.status()).toBe(200);
    const result = await response.json() as { data: { user: { roles: string[] } } };
    test.skip(result.data.user.roles.some((role) => ["admin", "cashier"].includes(role)), "La cuenta restringida debe no tener permisos de caja");
    const cash = await request.get(`${apiUrl}/api/v1/cash/summary`);
    expect(cash.status()).toBe(403);
  });
});
