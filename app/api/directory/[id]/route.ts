import { NextResponse } from "next/server";
import {
  deleteDirectoryContact,
  DirectoryServiceError,
  getDirectoryContactById,
  permanentlyDeleteDirectoryContact,
  updateDirectoryContact,
} from "@/lib/directory-service";
import {
  requireApiDirectoryManage,
  requireApiModuleAccess,
} from "@/lib/module-access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("directory");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    const contact = await getDirectoryContactById({
      companyId: auth.companyId,
      id,
    });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    if (error instanceof DirectoryServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("DIRECTORY_GET_ONE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Fihrist kaydı yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiDirectoryManage();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const contact = await updateDirectoryContact({
      companyId: auth.companyId,
      id,
      data: body,
    });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    if (error instanceof DirectoryServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("DIRECTORY_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Fihrist kaydı güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiDirectoryManage();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const permanent =
      new URL(req.url).searchParams.get("permanent") === "true";

    if (permanent) {
      const result = await permanentlyDeleteDirectoryContact({
        companyId: auth.companyId,
        id,
      });

      return NextResponse.json({ success: true, ...result });
    }

    const contact = await deleteDirectoryContact({
      companyId: auth.companyId,
      id,
    });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    if (error instanceof DirectoryServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("DIRECTORY_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Fihrist kaydı pasifleştirilemedi." },
      { status: 500 }
    );
  }
}
