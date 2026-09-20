import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function withApiCors(response: NextResponse, request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) return response;

  const origin = request.headers.get("origin");
  const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  if (origin && origin === allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  response.headers.append("Vary", "Origin");
  return response;
}

export async function updateSession(request: NextRequest) {
  // --- GUARDIA DE DISPOSITIVO (DEVICE COOKIE) ---
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicApiRoute = pathname === "/api/v1/health";

  if (isApiRoute && request.method === "OPTIONS") {
    return withApiCors(new NextResponse(null, { status: 204 }), request);
  }
  
  // Permitimos el acceso sin cookie sólo a recursos estáticos, la ruta de registro, y la pantalla de no autorizado
  if (
    !isApiRoute &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/db") &&
    !isPublicApiRoute &&
    pathname !== "/setup-device" &&
    pathname !== "/unauthorized-device" &&
    !pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    const isAuthorizedDevice = request.cookies.get('pos_device_authorized')?.value === 'true';
    if (!isAuthorizedDevice) {
      if (isApiRoute) {
        return withApiCors(NextResponse.json({ error: { code: "DEVICE_NOT_AUTHORIZED", message: "Dispositivo no autorizado" } }, { status: 403 }), request);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized-device";
      return NextResponse.redirect(url);
    }
  }
  // --- FIN GUARDIA DE DISPOSITIVO ---

  if (isPublicApiRoute) {
    return withApiCors(NextResponse.next(), request);
  }

  const supabaseResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Permite mostrar las pantallas públicas en instalaciones aún no configuradas.
  // Las rutas API protegidas no se consideran disponibles sin credenciales.
  if (!supabaseUrl || !supabasePublishableKey) {
    if (isApiRoute) {
      return withApiCors(NextResponse.json(
        { error: { code: "SUPABASE_NOT_CONFIGURED", message: "La API no está configurada" } },
        { status: 503 }
      ), request);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !isPublicApiRoute &&
    !isApiRoute &&
    pathname !== "/login" &&
    pathname !== "/unauthorized-device" &&
    pathname !== "/setup-device" &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api/auth/callback") &&
    !pathname.startsWith("/api/auth/users") &&
    !pathname.startsWith("/api/db/clear-other-sessions")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return withApiCors(supabaseResponse, request);
}
