import { expect, request as requestContext, test, type APIRequestContext } from "@playwright/test";

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3000";
const actorCredentials = { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD };
const adminCredentials = {
  email: process.env.E2E_ADMIN_EMAIL ?? process.env.E2E_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD,
};
const platformCredentials = {
  email: process.env.E2E_PLATFORM_EMAIL,
  password: process.env.E2E_PLATFORM_PASSWORD,
};
const configured = Boolean(
  actorCredentials.email && actorCredentials.password && adminCredentials.email && adminCredentials.password,
);
const requireFullSuite = process.env.E2E_REQUIRE_FULL_SUITE === "true";

function requireOrSkip(condition: boolean, reason: string) {
  if (condition) return;
  if (requireFullSuite) throw new Error(reason);
  test.skip(true, reason);
}

async function login(request: APIRequestContext, credentials: { email?: string; password?: string }) {
  const response = await request.post(`${apiUrl}/api/v1/auth/login`, { data: credentials });
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<{
    data: { user: { organizationId: string }; roles: string[]; csrfToken: string };
  }>;
}

function csrfOptions(csrfToken: string, data?: unknown) {
  return { data, headers: { "X-CSRF-Token": csrfToken } };
}

function idempotentCsrfOptions(csrfToken: string, data?: unknown) {
  return { data, headers: { "X-CSRF-Token": csrfToken, "Idempotency-Key": crypto.randomUUID() } };
}

function scopedIdempotentCsrfOptions(csrfToken: string, organizationId: string, data?: unknown) {
  return {
    data,
    headers: {
      "X-CSRF-Token": csrfToken,
      "X-Organization-Id": organizationId,
      "Idempotency-Key": crypto.randomUUID(),
    },
  };
}

type TestProduct = { id: string; createdCategoryId?: string };

async function createTestProduct(adminApi: APIRequestContext, csrfToken: string): Promise<TestProduct> {
  const categoriesResponse = await adminApi.get(`${apiUrl}/api/v1/categories`);
  expect(categoriesResponse.status(), await categoriesResponse.text()).toBe(200);
  const categories = (await categoriesResponse.json()).data as { id: string }[];
  let categoryId = categories[0]?.id;
  let createdCategoryId: string | undefined;

  if (!categoryId) {
    const categoryResponse = await adminApi.post(
      `${apiUrl}/api/v1/categories`,
      csrfOptions(csrfToken, { name: `E2E categoría ${Date.now()}`, sortOrder: 0 }),
    );
    expect(categoryResponse.status(), await categoryResponse.text()).toBe(201);
    createdCategoryId = ((await categoryResponse.json()).data as { id: string }).id;
    categoryId = createdCategoryId;
  }

  const response = await adminApi.post(
    `${apiUrl}/api/v1/products`,
    csrfOptions(csrfToken, {
      categoryId,
      name: `E2E producto ${Date.now()}`,
      price: 9.9,
      isAvailable: true,
      prepTimeMinutes: 5,
    }),
  );
  try {
    expect(response.status(), await response.text()).toBe(201);
    return { ...((await response.json()).data as { id: string }), createdCategoryId };
  } catch (error) {
    if (createdCategoryId)
      await adminApi.delete(`${apiUrl}/api/v1/categories/${createdCategoryId}`, csrfOptions(csrfToken));
    throw error;
  }
}

async function cleanupTestProduct(adminApi: APIRequestContext, csrfToken: string, product: TestProduct) {
  await adminApi.delete(`${apiUrl}/api/v1/products/${product.id}`, csrfOptions(csrfToken));
  if (product.createdCategoryId)
    await adminApi.delete(`${apiUrl}/api/v1/categories/${product.createdCategoryId}`, csrfOptions(csrfToken));
}

async function createTestOrder(actorApi: APIRequestContext, productId: string, csrfToken: string) {
  const response = await actorApi.post(
    `${apiUrl}/api/v1/orders`,
    idempotentCsrfOptions(csrfToken, {
      tableId: null,
      guests: 1,
      items: [{ productId, quantity: 1 }],
    }),
  );
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: string };
}

test.describe("operaciones autenticadas", () => {
  test("login correcto", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD, E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD");
    const result = await login(request, actorCredentials);
    expect(result.data.roles.length).toBeGreaterThan(0);
  });

  test("login incorrecto", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const response = await request.post(`${apiUrl}/api/v1/auth/login`, {
      data: { email: actorCredentials.email, password: `${actorCredentials.password}-incorrecta` },
    });
    expect(response.status()).toBe(401);
  });

  test("administración global de usuarios y membresías", async ({ request }) => {
    const targetUserId = process.env.E2E_PLATFORM_TARGET_USER_ID;
    if (!platformCredentials.email || !platformCredentials.password || !targetUserId) {
      test.skip(true, "Configura E2E_PLATFORM_EMAIL, E2E_PLATFORM_PASSWORD y E2E_PLATFORM_TARGET_USER_ID");
      return;
    }
    const platform = await login(request, platformCredentials);
    requireOrSkip(platform.data.roles.includes("platform_admin"), "La cuenta E2E global debe tener platform_admin");

    const usersResponse = await request.get(`${apiUrl}/api/v1/platform/users`);
    expect(usersResponse.status(), await usersResponse.text()).toBe(200);
    const users = (await usersResponse.json()).data as Array<{ id: string }>;
    expect(users.some((user) => user.id === targetUserId)).toBe(true);

    const blockResponse = await request.post(`${apiUrl}/api/v1/platform/users/${targetUserId}/block`, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    expect(blockResponse.status(), await blockResponse.text()).toBe(200);

    const unblockResponse = await request.post(`${apiUrl}/api/v1/platform/users/${targetUserId}/unblock`, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    expect(unblockResponse.status(), await unblockResponse.text()).toBe(200);
  });

  test("auditoría global paginada y detalle de evento", async ({ request }) => {
    if (!platformCredentials.email || !platformCredentials.password) {
      test.skip(true, "Configura E2E_PLATFORM_EMAIL y E2E_PLATFORM_PASSWORD");
      return;
    }
    const platform = await login(request, platformCredentials);
    requireOrSkip(platform.data.roles.includes("platform_admin"), "La cuenta E2E global debe tener platform_admin");

    const auditResponse = await request.get(`${apiUrl}/api/v1/platform/audit?page=1&pageSize=10`);
    expect(auditResponse.status(), await auditResponse.text()).toBe(200);
    const audit = (await auditResponse.json()).data as { items: Array<{ id: string }>; total: number; page: number };
    expect(audit.page).toBe(1);
    expect(audit.total).toBeGreaterThanOrEqual(0);
    if (audit.items[0]) {
      const detailResponse = await request.get(`${apiUrl}/api/v1/platform/audit/${audit.items[0].id}`);
      expect(detailResponse.status(), await detailResponse.text()).toBe(200);
      expect((await detailResponse.json()).data.id).toBe(audit.items[0].id);
    }
  });

  test("acceso temporal de soporte inicia lectura y puede revocarse", async ({ request }) => {
    const targetOrganizationId = process.env.E2E_PLATFORM_TARGET_ORGANIZATION_ID;
    if (!platformCredentials.email || !platformCredentials.password || !targetOrganizationId) {
      test.skip(true, "Configura E2E_PLATFORM_EMAIL, E2E_PLATFORM_PASSWORD y E2E_PLATFORM_TARGET_ORGANIZATION_ID");
      return;
    }
    const platform = await login(request, platformCredentials);
    requireOrSkip(platform.data.roles.includes("platform_admin"), "La cuenta E2E global debe tener platform_admin");
    const createResponse = await request.post(`${apiUrl}/api/v1/platform/support/access`, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
      data: {
        organizationId: targetOrganizationId,
        reason: "Verificación E2E de soporte temporal",
        durationMinutes: 15,
      },
    });
    expect(createResponse.status(), await createResponse.text()).toBe(201);
    const created = (await createResponse.json()).data as { id: string; mode: string };
    expect(created.mode).toBe("read_only");

    const revokeResponse = await request.post(`${apiUrl}/api/v1/platform/support/access/${created.id}/revoke`, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
      data: { reason: "Prueba E2E finalizada" },
    });
    expect(revokeResponse.status(), await revokeResponse.text()).toBe(200);
    expect((await revokeResponse.json()).data.status).toBe("revoked");
  });

  test("cambio explícito de organización", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL y E2E_PASSWORD para probar multi-tenant");
    const result = await login(request, actorCredentials);
    const organizationsResponse = await request.get(`${apiUrl}/api/v1/organizations`);
    expect(organizationsResponse.status(), await organizationsResponse.text()).toBe(200);
    const organizations = (await organizationsResponse.json()).data as Array<{ id: string }>;
    requireOrSkip(organizations.length >= 2, "La cuenta E2E debe pertenecer a dos organizaciones de staging");

    const targetOrganization = organizations.find(
      (organization) => organization.id !== result.data.user.organizationId,
    );
    expect(targetOrganization).toBeTruthy();
    const scopedMe = await request.get(`${apiUrl}/api/v1/auth/me`, {
      headers: { "X-Organization-Id": targetOrganization!.id },
    });
    expect(scopedMe.status(), await scopedMe.text()).toBe(200);
    const scopedUser = (await scopedMe.json()).data.user as { organizationId: string };
    expect(scopedUser.organizationId).toBe(targetOrganization!.id);
  });

  test("aislamiento de datos entre organizaciones", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD y credenciales admin para probar aislamiento");
    const adminApi = await requestContext.newContext();
    let product: TestProduct | undefined;
    let orderId: string | undefined;
    let adminCsrfToken: string | undefined;
    let actorCsrfToken: string | undefined;
    try {
      const actor = await login(request, actorCredentials);
      actorCsrfToken = actor.data.csrfToken;
      requireOrSkip(
        actor.data.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)),
        "La cuenta E2E no puede crear pedidos",
      );

      const organizationsResponse = await request.get(`${apiUrl}/api/v1/organizations`);
      expect(organizationsResponse.status(), await organizationsResponse.text()).toBe(200);
      const organizations = (await organizationsResponse.json()).data as Array<{ id: string }>;
      requireOrSkip(organizations.length >= 2, "La cuenta E2E debe pertenecer a dos organizaciones de staging");
      const primaryOrganizationId = actor.data.user.organizationId;
      const targetOrganization = organizations.find((organization) => organization.id !== primaryOrganizationId);
      expect(targetOrganization).toBeTruthy();

      const admin = await login(adminApi, adminCredentials);
      adminCsrfToken = admin.data.csrfToken;
      requireOrSkip(admin.data.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      expect(admin.data.user.organizationId).toBe(primaryOrganizationId);
      product = await createTestProduct(adminApi, admin.data.csrfToken);

      orderId = await createTestOrder(request, product.id, actor.data.csrfToken).then((order) => order.id);

      const foreignProductsResponse = await request.get(`${apiUrl}/api/v1/products`, {
        headers: { "X-Organization-Id": targetOrganization!.id },
      });
      expect(foreignProductsResponse.status(), await foreignProductsResponse.text()).toBe(200);
      const foreignProducts = (await foreignProductsResponse.json()).data as Array<{ id: string }>;
      expect(foreignProducts.some((foreignProduct) => foreignProduct.id === product!.id)).toBe(false);

      const foreignOrdersResponse = await request.get(`${apiUrl}/api/v1/orders`, {
        headers: { "X-Organization-Id": targetOrganization!.id },
      });
      expect(foreignOrdersResponse.status(), await foreignOrdersResponse.text()).toBe(200);
      const foreignOrders = (await foreignOrdersResponse.json()).data as Array<{ id: string }>;
      expect(foreignOrders.some((foreignOrder) => foreignOrder.id === orderId)).toBe(false);

      const invalidOrganizationResponse = await request.get(`${apiUrl}/api/v1/products`, {
        headers: { "X-Organization-Id": "00000000-0000-0000-0000-000000000999" },
      });
      expect([403, 404]).toContain(invalidOrganizationResponse.status());

      const crossOrganizationOrder = await request.post(
        `${apiUrl}/api/v1/orders`,
        scopedIdempotentCsrfOptions(actor.data.csrfToken, targetOrganization!.id, {
          tableId: null,
          guests: 1,
          items: [{ productId: product.id, quantity: 1 }],
        }),
      );
      expect([400, 403, 404, 409]).toContain(crossOrganizationOrder.status());
    } finally {
      if (orderId && actorCsrfToken)
        await request
          .patch(`${apiUrl}/api/v1/orders/${orderId}/status`, csrfOptions(actorCsrfToken, { status: "cancelled" }))
          .catch(() => undefined);
      if (product && adminCsrfToken) await cleanupTestProduct(adminApi, adminCsrfToken, product);
      await adminApi.dispose();
    }
  });

  test("creación y limpieza de productos", async () => {
    requireOrSkip(configured, "Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para preparar productos");
    const adminApi = await requestContext.newContext();
    let product: TestProduct | undefined;
    let adminCsrfToken: string | undefined;
    try {
      const result = await login(adminApi, adminCredentials);
      adminCsrfToken = result.data.csrfToken;
      requireOrSkip(result.data.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      product = await createTestProduct(adminApi, result.data.csrfToken);
      expect(product.id).toBeTruthy();
    } finally {
      if (product && adminCsrfToken) await cleanupTestProduct(adminApi, adminCsrfToken, product);
      await adminApi.dispose();
    }
  });

  test("creación de pedidos", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD y credenciales admin para preparar productos");
    const adminApi = await requestContext.newContext();
    let product: TestProduct | undefined;
    let orderId: string | undefined;
    let adminCsrfToken: string | undefined;
    let actorCsrfToken: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      adminCsrfToken = admin.data.csrfToken;
      requireOrSkip(admin.data.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      product = await createTestProduct(adminApi, admin.data.csrfToken);
      const actor = await login(request, actorCredentials);
      actorCsrfToken = actor.data.csrfToken;
      requireOrSkip(
        actor.data.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)),
        "La cuenta E2E no puede crear pedidos",
      );
      orderId = (await createTestOrder(request, product.id, actor.data.csrfToken)).id;
      expect(orderId).toBeTruthy();
    } finally {
      if (orderId && actorCsrfToken)
        await request
          .patch(`${apiUrl}/api/v1/orders/${orderId}/status`, csrfOptions(actorCsrfToken, { status: "cancelled" }))
          .catch(() => undefined);
      if (product && adminCsrfToken) await cleanupTestProduct(adminApi, adminCsrfToken, product);
      await adminApi.dispose();
    }
  });

  test("cancelación de pedidos", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL, E2E_PASSWORD y credenciales admin para preparar productos");
    const adminApi = await requestContext.newContext();
    let product: TestProduct | undefined;
    let orderId: string | undefined;
    let adminCsrfToken: string | undefined;
    let actorCsrfToken: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      adminCsrfToken = admin.data.csrfToken;
      requireOrSkip(admin.data.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      product = await createTestProduct(adminApi, admin.data.csrfToken);
      const actor = await login(request, actorCredentials);
      actorCsrfToken = actor.data.csrfToken;
      requireOrSkip(
        actor.data.roles.some((role) => ["admin", "cashier", "waiter"].includes(role)),
        "La cuenta E2E no puede cancelar pedidos",
      );
      orderId = await createTestOrder(request, product.id, actor.data.csrfToken).then((order) => order.id);
      const cancelled = await request.patch(
        `${apiUrl}/api/v1/orders/${orderId}/status`,
        csrfOptions(actor.data.csrfToken, { status: "cancelled" }),
      );
      expect(cancelled.status()).toBe(200);
    } finally {
      if (orderId && actorCsrfToken)
        await request
          .patch(`${apiUrl}/api/v1/orders/${orderId}/status`, csrfOptions(actorCsrfToken, { status: "cancelled" }))
          .catch(() => undefined);
      if (product && adminCsrfToken) await cleanupTestProduct(adminApi, adminCsrfToken, product);
      await adminApi.dispose();
    }
  });

  test("apertura y cierre de caja", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_EMAIL y E2E_PASSWORD para pruebas contra una API real");
    const result = await login(request, actorCredentials);
    requireOrSkip(
      result.data.roles.some((role) => ["admin", "cashier"].includes(role)),
      "La cuenta E2E no puede operar caja",
    );
    const organizationsResponse = await request.get(`${apiUrl}/api/v1/organizations`);
    expect(organizationsResponse.status(), await organizationsResponse.text()).toBe(200);
    const organizations = (await organizationsResponse.json()).data as Array<{ id: string }>;
    let cashOrganizationId: string | undefined;
    for (const organization of organizations) {
      const summaryResponse = await request.get(`${apiUrl}/api/v1/cash/summary`, {
        headers: { "X-Organization-Id": organization.id },
      });
      if (summaryResponse.status() !== 200) continue;
      const summary = (await summaryResponse.json()).data as { shift: unknown | null };
      if (!summary.shift) {
        cashOrganizationId = organization.id;
        break;
      }
    }
    requireOrSkip(cashOrganizationId !== undefined, "No hay una organización E2E sin caja abierta disponible");
    let opened = false;
    try {
      expect(
        (
          await request.post(
            `${apiUrl}/api/v1/cash/open`,
            scopedIdempotentCsrfOptions(result.data.csrfToken, cashOrganizationId!, { openingAmount: 0 }),
          )
        ).status(),
      ).toBe(201);
      opened = true;
      expect(
        (
          await request.post(
            `${apiUrl}/api/v1/cash/close`,
            scopedIdempotentCsrfOptions(result.data.csrfToken, cashOrganizationId!, { closingAmount: 0 }),
          )
        ).status(),
      ).toBe(200);
      opened = false;
    } finally {
      if (opened)
        await request
          .post(
            `${apiUrl}/api/v1/cash/close`,
            scopedIdempotentCsrfOptions(result.data.csrfToken, cashOrganizationId!, { closingAmount: 0 }),
          )
          .catch(() => undefined);
    }
  });

  test("cambio de estados en cocina", async ({ request }) => {
    requireOrSkip(configured, "Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para preparar productos");
    const adminApi = await requestContext.newContext();
    let product: TestProduct | undefined;
    let orderId: string | undefined;
    let adminCsrfToken: string | undefined;
    try {
      const admin = await login(adminApi, adminCredentials);
      adminCsrfToken = admin.data.csrfToken;
      requireOrSkip(admin.data.roles.includes("admin"), "E2E_ADMIN_EMAIL debe tener rol admin");
      product = await createTestProduct(adminApi, admin.data.csrfToken);
      orderId = await createTestOrder(adminApi, product.id, admin.data.csrfToken).then((order) => order.id);
      for (const status of ["preparing", "ready", "served"]) {
        const response = await adminApi.patch(
          `${apiUrl}/api/v1/kitchen/orders/${orderId}/status`,
          csrfOptions(admin.data.csrfToken, { status }),
        );
        expect(response.status(), await response.text()).toBe(200);
      }
    } finally {
      if (product && adminCsrfToken) await cleanupTestProduct(adminApi, adminCsrfToken, product);
      await adminApi.dispose();
    }
  });

  test("restricciones según rol", async ({ request }) => {
    const restrictedConfigured = Boolean(process.env.E2E_RESTRICTED_EMAIL && process.env.E2E_RESTRICTED_PASSWORD);
    requireOrSkip(restrictedConfigured, "Configura E2E_RESTRICTED_EMAIL y E2E_RESTRICTED_PASSWORD");
    const response = await request.post(`${apiUrl}/api/v1/auth/login`, {
      data: { email: process.env.E2E_RESTRICTED_EMAIL, password: process.env.E2E_RESTRICTED_PASSWORD },
    });
    expect(response.status()).toBe(200);
    const result = (await response.json()) as { data: { roles: string[] } };
    requireOrSkip(
      !result.data.roles.some((role) => ["admin", "cashier"].includes(role)),
      "La cuenta restringida debe no tener permisos de caja",
    );
    const cash = await request.get(`${apiUrl}/api/v1/cash/summary`);
    expect(cash.status()).toBe(403);
  });
});
