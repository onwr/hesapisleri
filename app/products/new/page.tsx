import { redirect } from "next/navigation";
import { NewProductForm } from "@/components/products/new-product-form";
import { getAuthToken, verifyToken } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function NewProductPage() {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.companyId) redirect("/login");

  return <NewProductForm companyId={payload.companyId} />;
}
