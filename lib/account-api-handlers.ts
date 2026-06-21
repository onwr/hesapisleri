import { NextResponse } from "next/server";
import {
  requireApiCashBankManage,
  requireApiCashBankRead,
} from "@/lib/module-access";
import {
  createCompanyAccount,
  deactivateCompanyAccount,
  setDefaultCompanyAccount,
  updateCompanyAccount,
} from "@/lib/account-admin-service";
import {
  getActiveAccountOptions,
  getCompanyAccount,
  listCompanyAccounts,
} from "@/lib/account-read-service";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";

function toJsonResponse(
  result: Awaited<ReturnType<typeof createCompanyAccount>>
) {
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        errors: result.errors,
      },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    data: result.data,
  });
}

export async function accountListHandler() {
  try {
    const auth = await requireApiCashBankRead();
    if ("error" in auth) return auth.error;

    const data = await listCompanyAccounts(auth.companyId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ACCOUNTS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hesaplar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function accountOptionsHandler() {
  try {
    const auth = await requireApiCashBankRead();
    if ("error" in auth) return auth.error;

    const data = await getActiveAccountOptions(auth.companyId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ACCOUNTS_OPTIONS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hesap seçenekleri yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function accountCreateHandler(req: Request) {
  try {
    const auth = await requireApiCashBankManage();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const result = await createCompanyAccount(
      auth.companyId,
      auth.userId,
      body
    );

    if (result.ok) {
      invalidateDashboardCache(auth.companyId, "account-create");
    }

    return toJsonResponse(result);
  } catch (error) {
    console.error("ACCOUNTS_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hesap oluşturulamadı." },
      { status: 500 }
    );
  }
}

export async function accountDetailHandler(accountId: string) {
  try {
    const auth = await requireApiCashBankRead();
    if ("error" in auth) return auth.error;

    const account = await getCompanyAccount(auth.companyId, accountId);

    if (!account) {
      return NextResponse.json(
        { success: false, message: "Hesap bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    console.error("ACCOUNT_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hesap yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function accountUpdateHandler(req: Request, accountId: string) {
  try {
    const auth = await requireApiCashBankManage();
    if ("error" in auth) return auth.error;

    const body = await req.json();

    if (body?.action === "setDefault") {
      const result = await setDefaultCompanyAccount(
        auth.companyId,
        auth.userId,
        accountId
      );
      return toJsonResponse(result);
    }

    const result = await updateCompanyAccount(
      auth.companyId,
      auth.userId,
      accountId,
      body
    );

    return toJsonResponse(result);
  } catch (error) {
    console.error("ACCOUNT_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hesap güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function accountDeactivateHandler(accountId: string) {
  try {
    const auth = await requireApiCashBankManage();
    if ("error" in auth) return auth.error;

    const result = await deactivateCompanyAccount(
      auth.companyId,
      auth.userId,
      accountId
    );

    return toJsonResponse(result);
  } catch (error) {
    console.error("ACCOUNT_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hesap pasife alınamadı." },
      { status: 500 }
    );
  }
}

export async function accountSetDefaultHandler(accountId: string) {
  try {
    const auth = await requireApiCashBankManage();
    if ("error" in auth) return auth.error;

    const result = await setDefaultCompanyAccount(
      auth.companyId,
      auth.userId,
      accountId
    );

    return toJsonResponse(result);
  } catch (error) {
    console.error("ACCOUNT_DEFAULT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Varsayılan hesap güncellenemedi." },
      { status: 500 }
    );
  }
}
