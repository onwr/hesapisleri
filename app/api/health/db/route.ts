import { NextResponse } from "next/server";
import { getSuperAdminUser } from "@/lib/admin-auth";
import {
  DB_UNAVAILABLE_MESSAGE,
  mapDbErrorToApiResponse,
  resolveHealthCheckSecret,
} from "@/lib/db-config";
import { checkDatabaseHealth } from "@/lib/db-health";

function isInternalHealthAuthorized(request: Request) {
  const secret = resolveHealthCheckSecret();
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const querySecret = new URL(request.url).searchParams.get("secret");

  return bearer === secret || querySecret === secret;
}

export async function GET(request: Request) {
  const internalAuthorized = isInternalHealthAuthorized(request);

  let superAdminAuthorized = false;
  if (!internalAuthorized) {
    try {
      superAdminAuthorized = Boolean(await getSuperAdminUser());
    } catch {
      superAdminAuthorized = false;
    }
  }

  if (!internalAuthorized && !superAdminAuthorized) {
    return NextResponse.json(
      { success: false, message: "Yetkisiz erişim." },
      { status: 401 }
    );
  }

  try {
    const result = await checkDatabaseHealth();

    return NextResponse.json({
      success: result.success,
      latencyMs: result.latencyMs,
      poolerConfigured: result.poolerConfigured,
      accelerateConfigured: result.accelerateConfigured,
    });
  } catch (error) {
    const mapped = mapDbErrorToApiResponse(error);

    console.error("DB_HEALTH_CHECK_ERROR", {
      code:
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined,
      message: error instanceof Error ? error.message : "unknown",
    });

    if (mapped) {
      return NextResponse.json(
        { success: mapped.success, message: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json(
      { success: false, message: DB_UNAVAILABLE_MESSAGE },
      { status: 503 }
    );
  }
}
