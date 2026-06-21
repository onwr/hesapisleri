import { redirect } from "next/navigation";

type StocksRedirectPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StocksRedirectPage({
  searchParams,
}: StocksRedirectPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    }
  }

  const qs = query.toString();
  redirect(qs ? `/products/stocks?${qs}` : "/products/stocks");
}
