import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiCashBankManage, requireApiCashBankRead } from "@/lib/module-access";
import {
  CashDailyClosingError,
  createCashDailyClosing,
  listCashDailyClosings,
  previewCashDailyClosing,
} from "@/lib/cash-daily-closing-service";

const previewSchema = z.object({
  accountId: z.string().min(1, "Kasa hesabı seçilmelidir."),
  closingDate: z.string().min(1, "Kapanış tarihi zorunludur."),
});

const createSchema = z.object({
  accountId: z.string().min(1, "Kasa hesabı seçilmelidir."),
  closingDate: z.string().min(1, "Kapanış tarihi zorunludur."),
  countedCashAmount: z.union([z.number(), z.string()]),
  note: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const auth = await requireApiCashBankRead();
    if ("error" in auth) return auth.error;

    const { companyId } = auth;
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "Firma bulunamadı." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");
    const accountId = searchParams.get("accountId") ?? undefined;
    const closingDate = searchParams.get("closingDate") ?? undefined;

    if (mode === "preview") {
      const parsed = previewSchema.safeParse({ accountId, closingDate });
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Bilgileri kontrol edin.",
            errors: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const data = await previewCashDailyClosing({
        companyId,
        accountId: parsed.data.accountId,
        closingDate: parsed.data.closingDate,
      });

      return NextResponse.json({ success: true, data });
    }

    const data = await listCashDailyClosings({
      companyId,
      accountId,
      take: 50,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof CashDailyClosingError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("CASH_DAILY_CLOSE_LIST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Gün sonu kapanışları alınamadı." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiCashBankManage();
    if ("error" in auth) return auth.error;

    const { companyId, userId } = auth;
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "Firma bulunamadı." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const closing = await createCashDailyClosing({
      companyId,
      userId,
      accountId: parsed.data.accountId,
      closingDate: parsed.data.closingDate,
      countedCashAmount: parsed.data.countedCashAmount,
      note: parsed.data.note,
    });

    return NextResponse.json({
      success: true,
      message: "Gün sonu kasa kapanışı kaydedildi.",
      data: {
        id: closing.id,
        expectedCashAmount: Number(closing.expectedCashAmount),
        countedCashAmount: Number(closing.countedCashAmount),
        differenceAmount: Number(closing.differenceAmount),
      },
    });
  } catch (error) {
    if (error instanceof CashDailyClosingError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("CASH_DAILY_CLOSE_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Gün sonu kapanışı oluşturulamadı." },
      { status: 500 }
    );
  }
}
