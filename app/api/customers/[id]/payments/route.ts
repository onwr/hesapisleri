import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiCustomerFinance } from "@/lib/module-access";
import {
  createCustomerPayment,
  CustomerFinanceError,
} from "@/lib/customer-finance-service";
import { parseCustomerFinanceDate } from "@/lib/customer-finance-utils";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

const bodySchema = z.object({
  accountId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().optional(),
  description: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

type Props = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiCustomerFinance();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz ödeme verisi." },
        { status: 400 }
      );
    }

    const dateParsed = parseCustomerFinanceDate(parsed.data.date);
    if (!dateParsed.ok) {
      return NextResponse.json(
        { success: false, message: dateParsed.message },
        { status: 400 }
      );
    }

    const result = await createCustomerPayment({
      companyId: auth.companyId,
      customerId: id,
      userId: auth.userId,
      accountId: parsed.data.accountId,
      amount: parsed.data.amount,
      date: dateParsed.date,
      description: parsed.data.description,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "customer-payment",
        entityIds: { customerId: id },
        entity: {
          transactionId: result.transaction.id,
          customerBalance: result.customerBalance,
          replay: result.replay,
        },
        message: result.replay
          ? "Ödeme zaten kayıtlı."
          : "Müşteriye ödeme kaydedildi.",
        status: result.replay ? "replay" : "recorded",
        affectedIds: [id, result.transaction.id],
      })
    );
  } catch (error) {
    if (error instanceof CustomerFinanceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("CUSTOMER_PAYMENT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "İşlem kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
