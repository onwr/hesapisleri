import { notFound } from "next/navigation";
import { guardPageModule } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { EditSupplierForm } from "./edit-supplier-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditSupplierPage({ params }: Props) {
  const session = await guardPageModule("suppliers");
  const company = session.company;
  const { id } = await params;

  const supplier = await db.supplier.findFirst({
    where: { id, companyId: company.id },
  });

  if (!supplier) notFound();

  return (
    <EditSupplierForm
      supplier={{
        id: supplier.id,
        name: supplier.name,
        companyName: supplier.companyName,
        code: supplier.code,
        contactName: supplier.contactName,
        phone: supplier.phone,
        mobilePhone: supplier.mobilePhone,
        email: supplier.email,
        website: supplier.website,
        taxNumber: supplier.taxNumber,
        taxOffice: supplier.taxOffice,
        iban: supplier.iban,
        address: supplier.address,
        city: supplier.city,
        district: supplier.district,
        country: supplier.country,
        category: supplier.category,
        tags: supplier.tags,
        notes: supplier.notes,
        currency: supplier.currency,
        paymentTermDays: supplier.paymentTermDays,
        isFavorite: supplier.isFavorite,
        isActive: supplier.isActive,
      }}
    />
  );
}
