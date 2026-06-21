import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  assertOwnerOrAdmin,
  testEDocumentIntegration,
} from "@/lib/e-document/e-document-integration-service";

export async function POST() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    assertOwnerOrAdmin({
      role: auth.session.effectiveRole,
      isOwner: auth.session.companyUser.isOwner,
    });

    const result = await testEDocumentIntegration(auth.companyId);
    return NextResponse.json({
      success: result.ok,
      data: result,
      message: result.message,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Bağlantı testi başarısız.",
      },
      { status: 400 }
    );
  }
}
