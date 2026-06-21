import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WarehouseDetailRedirectPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const queryParams = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(queryParams)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    }
  }

  const qs = query.toString();
  const target = `/products/stocks/warehouses/${id}`;
  redirect(qs ? `${target}?${qs}` : target);
}
