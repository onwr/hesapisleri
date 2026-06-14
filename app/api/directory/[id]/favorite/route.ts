import { NextResponse } from "next/server";
import {
  DirectoryServiceError,
  toggleFavoriteDirectoryContact,
} from "@/lib/directory-service";
import { requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("directory");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    const contact = await toggleFavoriteDirectoryContact({
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

    console.error("DIRECTORY_FAVORITE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Favori durumu güncellenemedi." },
      { status: 500 }
    );
  }
}
