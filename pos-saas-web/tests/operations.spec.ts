import { expect, request as requestContext, test, type APIRequestContext } from "@playwright/test";

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3000";
const actorCredentials = { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD };
const adminCredentials = {
  email: process.env.E2E_ADMIN_EMAIL ?? process.env.E2E_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD,
};
const configured = Boolean(actorCredentials.email && actorCredentials.password && adminCredentials.email && adminCredentials.password);
const requireFullSuite = process.env.E2E_REQUIRE_FULL_SUITE === "true";

function requireOrSkip(condition: boolean, reason: string) {
  if (condition) return;
  if (requireFullSuite) throw new Error(reason);
  test.skip(true, reason);
}

async function login(request: APIRequestContext, credentials: { email?: string; password?: string }) {
  const response = await request.post(`${apiUrl}/api/v1/auth/login`, { data: credentials });
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<{ data: { user: { roles: string[] }; csrfToken: string } }>;
}

function csrfOptions(csrfToken: string, data?: unknown) {
  return { data, headers: { "X-CSRF-Token": csrfToken } };
}

function idempotentCsrfOptions(csrfToken: string, data?: unknown) {
  return { data, headers: { "X-CSRF-Token": csrfToken, "Idempotency-Key": crypto.randomUUID() } };
}

async function createTestProduct(adminApi: APIRequestContext, csrfToken: string) {
  const categoriesResponse = await adminApi.get(`${apiUrl}/api/v1/categories`);
  const categories = (await categoriesResponse.json()).data as { id: string }[];
  expect(categories.length).toBeGreaterThan(0);
  const response = await adminApi.post(`${apiUrl}/api/v1/products`, csrfOptions(csrfToken, {
    categoryId: categories[0].id, name: `E2E producto ${Date.now()}`, price: 9.9, isAvailable: true, prepTimeMinutes: 5,
  }));
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: string };
}

async function createTestOrder(actorApi: APIRequestContext, productId: string, csrfToken: string) {
  const response = await actorApi.post(`${apiUrl}/api/v1/orders`, idempotentCsrfOptions(csrfToken, {
    tableId: null, guests: 1, items: [{ productId, quantity: 1 }],
  }));
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: string };
}

test.describe("operaciones autenticadas", () => {
  test("login correcto", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD, E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD");
    const result = await login(request, actorCredentials);
    expect(result.data.user.roles.length).toBeGreaterThan(0);
  });

  test("login incorrecto", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const response = await request.post(`${apiUrl}/api/v1/auth/login`, { data: { email: actorCredentials.email, password: `${actorCredentials.password}-incorrecta` } });
    expect(response.status()).toBe(401);
  });

  test("creación y limpieza de productos", async () => {
    requireOrSkip(configured, "Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para preparar productos");
    const adminApi = await requestContext.newContext();
    let productId: string | undefined;
    let adminCsrfToken: string | undefined;
    try {
      const result = await login(adminApi, adminCredentials);
      adminCsrfToken = result.data.csrfToken;
      requireOrSkip(result.data.user.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      const product = await createTestProduct(adminApi, result.data.csrfToken);
      productId = product.id;
      expect(productId).toBeTruthy();
    } finally {
      if (productId && adminCsrfToken) await adminApi.delete(`${apiUrl}/api/v1/products/${productId}`, csrfOptions(adminCsrfToken));
      await adminApi.dispose();
    }
  });

  test("creación de pedidos", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD y credenciales admin para preparar productos");
    const adminApi = await requestContext.newContext();
    let productId: string | undefined;
    let orderId: string | undefined;
    let adminCsrfToken: string | undefined;
    let actorCsrfToken: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      adminCsrfToken = admin.data.csrfToken;
      requireOrSkip(admin.data.user.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      productId = (await createTestProduct(adminApi, admin.data.csrfToken)).id;
      const actor = await login(request, actorCredentials);
      actorCsrfToken = actor.data.csrfToken;
      requireOrSkip(actor.data.user.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)), "La cuenta E2E no puede crear pedidos");
      orderId = (await createTestOrder(request, productId, actor.data.csrfToken)).id;
      expect(orderId).toBeTruthy();
    } finally {
      if (orderId && actorCsrfToken) await request.patch(`${apiUrl}/api/v1/orders/${orderId}/status`, csrfOptions(actorCsrfToken, { status: "cancelled" })).catch(() => undefined);
      if (productId && adminCsrfToken) await adminApi.delete(`${apiUrl}/api/v1/products/${productId}`, csrfOptions(adminCsrfToken));
      await adminApi.dispose();
    }
  });

  test("cancelación de pedidos", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD y credenciales admin para preparar productos");
    const adminApi = await requestContext.newContext();
    let productId: string | undefined;
    let orderId: string | undefined;
    let adminCsrfToken: string | undefined;
    let actorCsrfToken: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      adminCsrfToken = admin.data.csrfToken;
      requireOrSkip(admin.data.user.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      productId = (await createTestProduct(adminApi, admin.data.csrfToken)).id;
      const actor = await login(request, actorCredentials);
      actorCsrfToken = actor.data.csrfToken;
      requireOrSkip(actor.data.user.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)), "La cuenta E2E no puede cancelar pedidos");
      orderId = await createTestOrder(request, productId, actor.data.csrfToken).then((order) => order.id);
      const cancelled = await request.patch(`${apiUrl}/api/v1/orders/${orderId}/status`, csrfOptions(actor.data.csrfToken, { status: "cancelled" }));
      expect(cancelled.status()).toBe(200);
    } finally {
      if (orderId && actorCsrfToken) await request.patch(`${apiUrl}/api/v1/orders/${orderId}/status`, csrfOptions(actorCsrfToken, { status: "cancelled" })).catch(() => undefined);
      if (productId && adminCsrfToken) await adminApi.delete(`${apiUrl}/api/v1/products/${productId}`, csrfOptions(adminCsrfToken));
      await adminApi.dispose();
    }
  });

  test("apertura y cierre de caja", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const result = await login(request, actorCredentials);
    requireOrSkip(result.data.user.roles.some((role) => ["admin", "cashier"].includes(role)), "La cuenta E2E no puede operar caja");
    const summary = await (await request.get(`${apiUrl}/api/v1/cash/summary`)).json();
    if (summary.data.shift) {
      expect(summary.data.shift.status).toBe("open");
      return;
    }
    expect((await request.post(`${apiUrl}/api/v1/cash/open`, idempotentCsrfOptions(result.data.csrfToken, { openingAmount: 0 }))).status()).toBe(201);
    expect((await request.post(`${apiUrl}/api/v1/cash/close`, idempotentCsrfOptions(result.data.csrfToken, { closingAmount: 0 }))).status()).toBe(200);
  });

  test("cambio de estados en cocina", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para preparar productos");
    const adminApi = await requestContext.newContext();
    let productId: string | undefined;
    let orderId: string | undefined;
    let adminCsrfToken: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      adminCsrfToken = admin.data.csrfToken;
      requireOrSkip(admin.data.user.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      productId = (await createTestProduct(adminApi, admin.data.csrfToken)).id;
      orderId = await createTestOrder(adminApi, productId, admin.data.csrfToken).then((order) => order.id);
      for (const status of ["preparing", "ready", "served"]) {
        const response = await adminApi.patch(`${apiUrl}/api/v1/kitchen/orders/${orderId}/status`, csrfOptions(admin.data.csrfToken, { status }));
        expect(response.status(), await response.text()).toBe(200);
      }
    } finally {
      if (productId && adminCsrfToken) await adminApi.delete(`${apiUrl}/api/v1/products/${productId}`, csrfOptions(adminCsrfToken));
      await adminApi.dispose();
    }
  });

  test("restricciones según rol", async ({ request }) => {
    const restrictedConfigured = Boolean(process.env.E2E_RESTRICTED_EMAIL && process.env.E2E_RESTRICTED_PASSWORD);
    requireOrSkip(restrictedConfigured, "Configura E2E_RESTRICTED_EMAIL y E2E_RESTRICTED_PASSWORD");
    const response = await request.post(`${apiUrl}/api/v1/auth/login`, { data: { email: process.env.E2E_RESTRICTED_EMAIL, password: process.env.E2E_RESTRICTED_PASSWORD } });
    expect(response.status()).toBe(200);
    const result = await response.json() as { data: { user: { roles: string[] } } };
    requireOrSkip(!result.data.user.roles.some((role) => ["admin", "cashier"].includes(role)), "La cuenta restringida debe no tener permisos de caja");
    const cash = await request.get(`${apiUrl}/api/v1/cash/summary`);
    expect(cash.status()).toBe(403);
  });
});
