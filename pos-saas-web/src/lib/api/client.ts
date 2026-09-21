const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
let csrfToken: string | null = null;

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_URL}/api/v1/auth/csrf`, {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data?.csrfToken) {
    throw new Error("No se pudo preparar la protección CSRF");
  }
  const token = String(payload.data.csrfToken);
  csrfToken = token;
  return token;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (mutatingMethods.has(method) && !path.endsWith("/auth/login")) {
    headers.set("X-CSRF-Token", await getCsrfToken());
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const payload = await response.json().catch(() => null);
  if (payload?.data?.csrfToken) csrfToken = payload.data.csrfToken;
  if (!response.ok) {
    const message = payload?.error?.message ?? "La API devolvió un error";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload as T;
}
