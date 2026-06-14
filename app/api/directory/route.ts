import { NextResponse } from "next/server";
import {
  createDirectoryContact,
  DirectoryServiceError,
  getDirectoryContacts,
  getDirectorySummary,
  getDirectoryTags,
} from "@/lib/directory-service";
import {
  parseDirectoryActiveFilter,
  parseDirectoryFavoriteFilter,
  parseDirectorySourceFilter,
  parseDirectoryTypeFilter,
} from "@/lib/directory-utils";
import {
  requireApiDirectoryManage,
  requireApiModuleAccess,
} from "@/lib/module-access";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("directory");
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? undefined;
    const type = parseDirectoryTypeFilter(url.searchParams.get("type"));
    const sourceType = parseDirectorySourceFilter(
      url.searchParams.get("sourceType")
    );
    const tag = url.searchParams.get("tag") ?? undefined;
    const isFavorite = parseDirectoryFavoriteFilter(
      url.searchParams.get("favorite")
    );
    const isActive = parseDirectoryActiveFilter(url.searchParams.get("status"));
    const sort = url.searchParams.get("sort") ?? undefined;

    const [contacts, summary, tags] = await Promise.all([
      getDirectoryContacts({
        companyId: auth.companyId,
        search,
        type,
        sourceType,
        tag,
        isFavorite,
        isActive,
        sort,
      }),
      getDirectorySummary(auth.companyId),
      getDirectoryTags(auth.companyId),
    ]);

    return NextResponse.json({
      success: true,
      contacts,
      summary,
      tags,
    });
  } catch (error) {
    if (error instanceof DirectoryServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("DIRECTORY_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Fihrist yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiDirectoryManage();
    if ("error" in auth) return auth.error;

    const body = await req.json();

    const contact = await createDirectoryContact({
      companyId: auth.companyId,
      createdByUserId: auth.userId,
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

    console.error("DIRECTORY_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Kişi eklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
