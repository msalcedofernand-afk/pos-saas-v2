const surface = process.argv.includes("--surface")
  ? process.argv[process.argv.indexOf("--surface") + 1]
  : "all";

if (!["api", "web", "all"].includes(surface)) {
  console.error("Uso: node scripts/preflight-production.mjs --surface api|web|all");
  process.exit(2);
}

const missing = [];
const invalid = [];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) missing.push(name);
  return value;
}

function httpsUrl(name, { allowSupabase = false } = {}) {
  const value = required(name);
  if (!value) return null;
  try {
    const url = new URL(value);
    const validSupabase = allowSupabase && url.hostname.endsWith(".supabase.co");
    if (url.protocol !== "https:" && !validSupabase) invalid.push(`${name} debe usar HTTPS`);
    if (url.pathname !== "/" || url.search || url.hash) invalid.push(`${name} no debe incluir ruta, query ni hash`);
    if (value.endsWith("/")) invalid.push(`${name} no debe terminar en /`);
    return url;
  } catch {
    invalid.push(`${name} no es una URL válida`);
    return null;
  }
}

function validateTimezone() {
  const timezone = required("NEXT_PUBLIC_BUSINESS_TIMEZONE");
  if (!timezone) return;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    invalid.push("NEXT_PUBLIC_BUSINESS_TIMEZONE no es válida");
  }
}

if (surface === "api" || surface === "all") {
  httpsUrl("NEXT_PUBLIC_SUPABASE_URL", { allowSupabase: true });
  httpsUrl("NEXT_PUBLIC_SITE_URL");
  httpsUrl("WEB_ORIGIN");
  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  required("SUPABASE_SECRET_KEY");
  const sameSite = required("AUTH_COOKIE_SAME_SITE");
  if (sameSite && !["lax", "strict", "none"].includes(sameSite.toLowerCase())) {
    invalid.push("AUTH_COOKIE_SAME_SITE debe ser lax, strict o none");
  }
  if (process.env.AUTH_COOKIE_SECURE?.toLowerCase() !== "true") {
    invalid.push("AUTH_COOKIE_SECURE debe ser true");
  }
  validateTimezone();
}

if (surface === "web" || surface === "all") {
  httpsUrl("NEXT_PUBLIC_API_URL");
  httpsUrl("NEXT_PUBLIC_SITE_URL");
  validateTimezone();
}

if (missing.length || invalid.length) {
  console.error("Preflight de producción rechazado.");
  if (missing.length) console.error(`Faltan variables: ${missing.join(", ")}`);
  if (invalid.length) console.error(`Variables inválidas: ${invalid.join("; ")}`);
  process.exit(1);
}

console.log(`Preflight de producción correcto para: ${surface}`);
