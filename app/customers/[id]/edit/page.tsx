import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { EditCustomerForm } from "./edit-customer-form";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;

  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const customer = await db.customer.findFirst({
    where: {
      id,
      companyId: payload.companyId,
    },
  });

  if (!customer) notFound();

  return (
    <EditCustomerForm
      customer={{
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        taxNo: customer.taxNo,
        address: customer.address,
        group: customer.group,
      }}
    />
  );
}
