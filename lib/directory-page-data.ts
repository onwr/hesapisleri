import {
  getDirectoryContacts,
  getDirectorySummary,
  getDirectoryTags,
} from "@/lib/directory-service";
import {
  parseDirectoryActiveFilter,
  parseDirectoryFavoriteFilter,
  parseDirectorySourceFilter,
  parseDirectorySort,
  parseDirectoryTypeFilter,
  type DirectorySortOption,
} from "@/lib/directory-utils";
import type {
  DirectoryContactType,
  DirectorySourceType,
} from "@prisma/client";

export { parseDirectorySearch } from "@/lib/directory-utils";

export function buildDirectoryQuery(params: {
  search?: string;
  type?: string;
  sourceType?: string;
  tag?: string;
  favorite?: string;
  status?: string;
  sort?: string;
}) {
  const search = new URLSearchParams();

  if (params.search?.trim()) {
    search.set("q", params.search.trim());
  }
  if (params.type && params.type !== "ALL") {
    search.set("type", params.type);
  }
  if (params.sourceType && params.sourceType !== "ALL") {
    search.set("sourceType", params.sourceType);
  }
  if (params.tag?.trim()) {
    search.set("tag", params.tag.trim());
  }
  if (params.favorite === "yes" || params.favorite === "no") {
    search.set("favorite", params.favorite);
  }
  if (params.status === "active" || params.status === "passive") {
    search.set("status", params.status);
  } else if (params.status === "ALL") {
    search.set("status", "ALL");
  }
  if (params.sort) {
    search.set("sort", params.sort);
  }

  const query = search.toString();
  return query ? `/directory?${query}` : "/directory";
}

export function buildDirectoryExportQuery(params: {
  search?: string;
  type?: string;
  sourceType?: string;
  tag?: string;
  favorite?: string;
  status?: string;
  sort?: string;
}) {
  const search = new URLSearchParams();

  if (params.search?.trim()) search.set("q", params.search.trim());
  if (params.type && params.type !== "ALL") search.set("type", params.type);
  if (params.sourceType && params.sourceType !== "ALL") {
    search.set("sourceType", params.sourceType);
  }
  if (params.tag?.trim()) search.set("tag", params.tag.trim());
  if (params.favorite === "yes" || params.favorite === "no") {
    search.set("favorite", params.favorite);
  }
  if (params.status === "active" || params.status === "passive") {
    search.set("status", params.status);
  } else if (params.status === "ALL") {
    search.set("status", "ALL");
  }
  if (params.sort) search.set("sort", params.sort);

  const query = search.toString();
  return query ? `/api/directory/export?${query}` : "/api/directory/export";
}

export async function getDirectoryPageData(input: {
  companyId: string;
  search?: string;
  type?: string;
  sourceType?: string;
  tag?: string;
  favorite?: string;
  status?: string;
  sort?: string;
}) {
  const type = parseDirectoryTypeFilter(input.type);
  const sourceType = parseDirectorySourceFilter(input.sourceType);
  const isFavorite = parseDirectoryFavoriteFilter(input.favorite);
  const isActive = parseDirectoryActiveFilter(input.status);
  const sort = parseDirectorySort(input.sort);

  const filters: {
    search?: string;
    type: DirectoryContactType | "ALL";
    sourceType: DirectorySourceType | "ALL";
    tag?: string;
    isFavorite?: boolean;
    isActive?: boolean;
    sort?: DirectorySortOption;
  } = {
    search: input.search,
    type,
    sourceType,
    tag: input.tag,
    isFavorite,
    isActive,
    sort,
  };

  const [contacts, summary, tags] = await Promise.all([
    getDirectoryContacts({
      companyId: input.companyId,
      ...filters,
    }),
    getDirectorySummary(input.companyId),
    getDirectoryTags(input.companyId),
  ]);

  return {
    contacts,
    summary,
    tags,
    filters: {
      search: input.search ?? "",
      type,
      sourceType,
      tag: input.tag ?? "",
      favorite: input.favorite ?? "ALL",
      status: input.status ?? "active",
      sort: sort,
    },
  };
}
