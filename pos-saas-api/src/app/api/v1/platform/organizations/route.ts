import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/auth/api";
import { apiError, handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa minúsculas, números y guiones"),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(254),
});

const idempotencyKeySchema = z.string().trim().min(16).max(128);

class ProvisioningError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;

    const { data, error } = await createAdminClient()
      .from("organizations")
      .select("id, name, slug, is_active, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null;
  let createdOrganizationId: string | null = null;
  let cleanupDb: ReturnType<typeof createAdminClient> | null = null;
  let actorUserId: string | null = null;
  let idempotencyKey: string | null = null;

  try {
    const db = createAdminClient();
    cleanupDb = db;
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;
    actorUserId = auth.user.id;
    idempotencyKey = idempotencyKeySchema.parse(request.headers.get("idempotency-key") ?? "");
    const body = createOrganizationSchema.parse(await request.json());
    const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");

    const { data: previousRequest, error: previousRequestError } = await db
      .from("platform_provisioning_requests")
      .select("idempotency_key, actor_user_id, request_hash, status, response")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (previousRequestError) throw previousRequestError;
    if (previousRequest) {
      if (previousRequest.actor_user_id !== auth.user.id || previousRequest.request_hash !== requestHash) {
        throw new ProvisioningError("La clave de idempotencia ya fue usada para otra solicitud", 409);
      }
      if (previousRequest.status === "completed" && previousRequest.response) {
        return NextResponse.json(previousRequest.response, { status: 201 });
      }
      throw new ProvisioningError("La solicitud ya se está procesando", 409);
    }

    const { error: claimError } = await db.from("platform_provisioning_requests").insert({
      idempotency_key: idempotencyKey,
      actor_user_id: auth.user.id,
      request_hash: requestHash,
      status: "processing",
    });
    if (claimError) {
      if (claimError.code === "23505") throw new ProvisioningError("La solicitud ya se está procesando", 409);
      throw claimError;
    }

    const { data: existingOrganization, error: organizationLookupError } = await db
      .from("organizations")
      .select("id")
      .eq("slug", body.slug)
      .maybeSingle();
    if (organizationLookupError) throw organizationLookupError;
    if (existingOrganization) throw new ProvisioningError("Ya existe una organización con ese identificador", 409);

    const webOrigin = (process.env.WEB_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    if (!webOrigin) throw new ProvisioningError("La URL pública de la web no está configurada", 503);

    const { data: authData, error: authError } = await db.auth.admin.inviteUserByEmail(body.adminEmail, {
      data: { name: body.adminName },
      redirectTo: `${webOrigin}/auth/update-password`,
    });
    if (authError || !authData.user) {
      if (authError?.message.toLowerCase().includes("already") || authError?.message.toLowerCase().includes("exist")) {
        throw new ProvisioningError("Ya existe una cuenta con ese correo", 409);
      }
      throw new ProvisioningError("No se pudo enviar la invitación administradora", 400);
    }
    createdUserId = authData.user.id;

    const { data: organization, error: createOrganizationError } = await db
      .from("organizations")
      .insert({ name: body.name, slug: body.slug })
      .select("id, name, slug, is_active, created_at, updated_at")
      .single();
    if (createOrganizationError || !organization) throw createOrganizationError ?? new Error("Organización no creada");
    createdOrganizationId = organization.id;

    const { data: adminRole, error: roleError } = await db.from("roles").select("id").eq("name", "admin").single();
    if (roleError || !adminRole) throw roleError ?? new Error("Rol administrador no encontrado");

    const { error: membershipError } = await db.from("organization_members").insert({
      organization_id: organization.id,
      user_id: createdUserId,
      role_id: adminRole.id,
      is_default: true,
    });
    if (membershipError) throw membershipError;

    const responsePayload = {
      data: {
        organization,
        admin: { id: createdUserId, email: body.adminEmail, name: body.adminName, role: "admin", invitationSent: true },
      },
    };
    const { error: completeError } = await db
      .from("platform_provisioning_requests")
      .update({ status: "completed", organization_id: organization.id, response: responsePayload })
      .eq("idempotency_key", idempotencyKey);
    if (completeError) throw completeError;

    const { error: auditError } = await db.from("platform_audit_logs").insert({
      actor_user_id: auth.user.id,
      action: "organization_provisioned",
      auditable_type: "organizations",
      auditable_id: organization.id,
      new_values: {
        organization: { name: body.name, slug: body.slug },
        admin: { user_id: createdUserId, email: body.adminEmail, role: "admin" },
      },
    });
    if (auditError) throw auditError;

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    if (createdOrganizationId && cleanupDb)
      await cleanupDb.from("organizations").delete().eq("id", createdOrganizationId);
    if (createdUserId && cleanupDb) await cleanupDb.auth.admin.deleteUser(createdUserId);
    if (idempotencyKey && cleanupDb)
      await cleanupDb.from("platform_provisioning_requests").delete().eq("idempotency_key", idempotencyKey);
    if (actorUserId && cleanupDb) {
      await cleanupDb.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        action: "organization_provisioning_failed",
        auditable_type: "organizations",
        auditable_id: createdOrganizationId,
        new_values: { error: error instanceof Error ? error.message : "unknown_error" },
      });
    }
    if (error instanceof ProvisioningError) return apiError(error.message, error.status);
    return handleApiError(error);
  }
}
