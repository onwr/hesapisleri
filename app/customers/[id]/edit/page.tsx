import { notFound } from "next/navigation";
import { guardPageModule } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { EditCustomerForm } from "./edit-customer-form";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditCustomerPage({ params }: Props) {
  const session = await guardPageModule("customers");
  const company = session.company;
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: {
      id,
      companyId: company.id,
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
        taxOffice: customer.taxOffice,
        taxCertificateUrl: customer.taxCertificateUrl,
        taxCertificateFileName: customer.taxCertificateFileName,
        taxCertificateMimeType: customer.taxCertificateMimeType,
        taxCertificateSize: customer.taxCertificateSize,
        address: customer.address,
        group: customer.group,
      }}
    />
  );
}
