import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_LOCK_SECONDS = 15 * 60;

type RateLimitRow = { allowed?: boolean; blocked?: boolean; locked?: boolean; retry_after_seconds?: number | null };

function numericEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function hashRateKey(prefix: string, value: string) {
  return `${prefix}:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function getConfig() {
  return {
    maxAttempts: numericEnv("AUTH_LOGIN_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS),
    windowSeconds: numericEnv("AUTH_LOGIN_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS),
    lockSeconds: numericEnv("AUTH_LOGIN_LOCK_SECONDS", DEFAULT_LOCK_SECONDS),
  };
}

async function getUserIdByEmail(email: string) {
  const adminClient = createAdminClient();
  const { data, error } = await (adminClient as any)
    .from("users")
    .select("id")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

async function callRateLimitFunction(functionName: string, args: Record<string, unknown>) {
  const adminClient = createAdminClient();
  const { data, error } = await (adminClient as any).rpc(functionName, args);
  if (error) throw error;
  return firstRow(data as RateLimitRow | RateLimitRow[] | null);
}

function retryAfter(row: RateLimitRow | null) {
  const seconds = Number(row?.retry_after_seconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

export async function checkLoginSecurity(request: Request, email: string) {
  const config = getConfig();
  const emailKey = hashRateKey("email", normalizeEmail(email));
  const ipKey = hashRateKey("ip", getClientIp(request));
  const userId = await getUserIdByEmail(email);

  const [emailLimit, ipLimit, userLock] = await Promise.all([
    callRateLimitFunction("check_login_rate_limit", {
      p_rate_key: emailKey,
      p_max_attempts: config.maxAttempts,
      p_window_seconds: config.windowSeconds,
      p_lock_seconds: config.lockSeconds,
    }),
    callRateLimitFunction("check_login_rate_limit", {
      p_rate_key: ipKey,
      p_max_attempts: config.maxAttempts,
      p_window_seconds: config.windowSeconds,
      p_lock_seconds: config.lockSeconds,
    }),
    userId ? callRateLimitFunction("check_user_login_lock", { p_user_id: userId }) : Promise.resolve(null),
  ]);

  const retries = [retryAfter(emailLimit), retryAfter(ipLimit), retryAfter(userLock)].filter(
    (value): value is number => value !== undefined,
  );
  return {
    emailKey,
    ipKey,
    ip: getClientIp(request),
    userId,
    blocked: emailLimit?.allowed === false || ipLimit?.allowed === false || userLock?.locked === true,
    retryAfter: retries.length ? Math.max(...retries) : undefined,
  };
}

export async function recordLoginFailure(context: Awaited<ReturnType<typeof checkLoginSecurity>>) {
  const config = getConfig();
  const [emailLimit, ipLimit, userLock] = await Promise.all([
    callRateLimitFunction("record_login_failure", {
      p_rate_key: context.emailKey,
      p_max_attempts: config.maxAttempts,
      p_window_seconds: config.windowSeconds,
      p_lock_seconds: config.lockSeconds,
    }),
    callRateLimitFunction("record_login_failure", {
      p_rate_key: context.ipKey,
      p_max_attempts: config.maxAttempts,
      p_window_seconds: config.windowSeconds,
      p_lock_seconds: config.lockSeconds,
    }),
    context.userId
      ? callRateLimitFunction("record_user_login_failure", {
          p_user_id: context.userId,
          p_ip: context.ip,
          p_max_attempts: config.maxAttempts,
          p_lock_seconds: config.lockSeconds,
        })
      : Promise.resolve(null),
  ]);

  const retries = [retryAfter(emailLimit), retryAfter(ipLimit), retryAfter(userLock)].filter(
    (value): value is number => value !== undefined,
  );
  return {
    blocked: emailLimit?.blocked === true || ipLimit?.blocked === true || userLock?.blocked === true,
    retryAfter: retries.length ? Math.max(...retries) : undefined,
  };
}

export async function resetLoginSecurity(context: Awaited<ReturnType<typeof checkLoginSecurity>>) {
  await Promise.all([
    callRateLimitFunction("reset_login_rate_limit", { p_rate_key: context.emailKey }),
    callRateLimitFunction("reset_login_rate_limit", { p_rate_key: context.ipKey }),
    context.userId
      ? callRateLimitFunction("reset_user_login_security", { p_user_id: context.userId })
      : Promise.resolve(null),
  ]);
}
