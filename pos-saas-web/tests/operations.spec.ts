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
  return response.json() as Promise<{ data: { user: { roles: string[] } } }>;
}

async function createTestProduct(adminApi: APIRequestContext) {
  const categoriesResponse = await adminApi.get(`${apiUrl}/api/v1/categories`);
  const categories = (await categoriesResponse.json()).data as { id: string }[];
  expect(categories.length).toBeGreaterThan(0);
  const response = await adminApi.post(`${apiUrl}/api/v1/products`, {
    data: { categoryId: categories[0].id, name: `E2E producto ${Date.now()}`, price: 9.9, isAvailable: true, prepTimeMinutes: 5 },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: string };
}

async function createTestOrder(actorApi: APIRequestContext, productId: string) {
  const response = await actorApi.post(`${apiUrl}/api/v1/orders`, {
    data: { tableId: null, guests: 1, items: [{ productId, quantity: 1 }] },
  });
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
    try {
      const result = await login(adminApi, adminCredentials);
      requireOrSkip(result.data.user.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      const product = await createTestProduct(adminApi);
      productId = product.id;
      expect(productId).toBeTruthy();
    } finally {
      if (productId) await adminApi.delete(`${apiUrl}/api/v1/products/${productId}`);
      await adminApi.dispose();
    }
  });

  test("creación de pedidos", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD y credenciales admin para preparar productos");
    const adminApi = await requestContext.newContext();
    let productId: string | undefined;
    let orderId: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      requireOrSkip(admin.data.user.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      productId = (await createTestProduct(adminApi)).id;
      const actor = await login(request, actorCredentials);
      requireOrSkip(actor.data.user.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)), "La cuenta E2E no puede crear pedidos");
      orderId = (await createTestOrder(request, productId)).id;
      expect(orderId).toBeTruthy();
    } finally {
      if (orderId) await request.patch(`${apiUrl}/api/v1/orders/${orderId}/status`, { data: { status: "cancelled" } }).catch(() => undefined);
      if (productId) await adminApi.delete(`${apiUrl}/api/v1/products/${productId}`);
      await adminApi.dispose();
    }
  });

  test("cancelación de pedidos", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD y credenciales admin para preparar productos");
    const adminApi = await requestContext.newContext();
    let productId: string | undefined;
    let orderId: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      requireOrSkip(admin.data.user.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      productId = (await createTestProduct(adminApi)).id;
      const actor = await login(request, actorCredentials);
      requireOrSkip(actor.data.user.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)), "La cuenta E2E no puede cancelar pedidos");
      orderId = await createTestOrder(request, productId).then((order) => order.id);
      const cancelled = await request.patch(`${apiUrl}/api/v1/orders/${orderId}/status`, { data: { status: "cancelled" } });
      expect(cancelled.status()).toBe(200);
    } finally {
      if (orderId) await request.patch(`${apiUrl}/api/v1/orders/${orderId}/status`, { data: { status: "cancelled" } }).catch(() => undefined);
      if (productId) await adminApi.delete(`${apiUrl}/api/v1/products/${productId}`);
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
    expect((await request.post(`${apiUrl}/api/v1/cash/open`, { data: { openingAmount: 0 } })).status()).toBe(201);
    expect((await request.post(`${apiUrl}/api/v1/cash/close`, { data: { closingAmount: 0 } })).status()).toBe(200);
  });

  test("cambio de estados en cocina", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para preparar productos");
    const adminApi = await requestContext.newContext();
    let productId: string | undefined;
    let orderId: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      requireOrSkip(admin.data.user.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      productId = (await createTestProduct(adminApi)).id;
      orderId = await createTestOrder(adminApi, productId).then((order) => order.id);
      for (const status of ["preparing", "ready", "served"]) {
        const response = await adminApi.patch(`${apiUrl}/api/v1/kitchen/orders/${orderId}/status`, { data: { status } });
        expect(response.status(), await response.text()).toBe(200);
      }
    } finally {
      if (productId) await adminApi.delete(`${apiUrl}/api/v1/products/${productId}`);
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
