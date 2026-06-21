import { NextResponse } from "next/server";
import {
  ImageOptimizerError,
  StorageConfigError,
  StorageUploadError,
  saveFileFromWebFile,
  saveTaxCertificateFromWebFile,
} from "@/lib/storage/cdn";
import { requireAnyApiModuleAccess } from "@/lib/module-access";

export const runtime = "nodejs";

const DEFAULT_FOLDER = "hesapisleri/general";

export async function POST(req: Request) {
  try {
    const auth = await requireAnyApiModuleAccess([
      "dashboard",
      "products",
      "sales",
      "pos",
      "settings",
      "customers",
      "employees",
      "invoices",
      "expenses",
    ]);
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;

    const formData = await req.formData();
    const file = formData.get("file");
    const folder =
      formData.get("folder")?.toString().trim() || DEFAULT_FOLDER;
    const purpose = formData.get("purpose")?.toString().trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Dosya bulunamadı." },
        { status: 400 }
      );
    }

    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
    const uploadFolder = safeFolder.includes(companyId)
      ? safeFolder
      : `${safeFolder}/${companyId}`;

    const url =
      purpose === "tax-certificate"
        ? await saveTaxCertificateFromWebFile(
            file,
            uploadFolder,
            `hesapisleri_${companyId}_${Date.now()}`
          )
        : await saveFileFromWebFile(
            file,
            uploadFolder,
            `hesapisleri_${companyId}_${Date.now()}`
          );

    if (!url) {
      return NextResponse.json(
        { success: false, message: "Görsel CDN'e yüklenemedi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Görsel yüklendi.",
      data: { url },
    });
  } catch (error) {
    if (error instanceof ImageOptimizerError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    if (error instanceof StorageConfigError) {
      console.error("UPLOAD_CONFIG_ERROR", error);
      return NextResponse.json(
        { success: false, message: "CDN yapılandırması eksik." },
        { status: 500 }
      );
    }

    if (error instanceof Error && error.message.includes("yükleyebilirsiniz")) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof StorageUploadError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    console.error("UPLOAD_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Görsel yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
