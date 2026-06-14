import { NextResponse } from "next/server";
import { getDirectoryExportRows } from "@/lib/directory-service";
import { buildDirectoryCsvWithBom } from "@/lib/directory-utils";
import {
  parseDirectoryActiveFilter,
  parseDirectoryFavoriteFilter,
  parseDirectorySourceFilter,
  parseDirectoryTypeFilter,
} from "@/lib/directory-utils";
import { requireApiModuleAccess } from "@/lib/module-access";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("directory");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") ?? undefined;
    const type = parseDirectoryTypeFilter(searchParams.get("type"));
    const sourceType = parseDirectorySourceFilter(
      searchParams.get("sourceType")
    );
    const tag = searchParams.get("tag") ?? undefined;
    const isFavorite = parseDirectoryFavoriteFilter(
      searchParams.get("favorite")
    );
    const isActive = parseDirectoryActiveFilter(searchParams.get("status"));
    const sort = searchParams.get("sort") ?? undefined;

    const contacts = await getDirectoryExportRows({
      companyId: auth.companyId,
      search,
      type,
      sourceType,
      tag,
      isFavorite,
      isActive,
      sort,
    });

    const csv = buildDirectoryCsvWithBom(contacts);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="fihrist.csv"',
      },
    });
  } catch (error) {
    console.error("DIRECTORY_EXPORT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Fihrist dışa aktarılamadı.",
      },
      { status: 500 }
    );
  }
}
