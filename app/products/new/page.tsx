import { guardPageModule } from "@/lib/module-access";
import { NewProductForm } from "@/components/products/new-product-form";
import type { ProductTypeKey } from "@/lib/product-type-utils";

type NewProductPageProps = {
  searchParams: Promise<{ type?: string }>;
};

function parseInitialProductType(value?: string): ProductTypeKey {
  if (value === "service") return "SERVICE";
  return "STOCK";
}

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const session = await guardPageModule("products");
  const company = session.company;
  const params = await searchParams;

  return (
    <NewProductForm
      companyId={company.id}
      initialProductType={parseInitialProductType(params.type)}
    />
  );
}
