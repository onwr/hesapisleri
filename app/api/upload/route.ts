import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  StorageConfigError,
  StorageUploadError,
  saveFileFromWebFile,
} from "@/lib/storage/cdn";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

const DEFAULT_FOLDER = "hesapisleri/general";

export async function POST(req: Request) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folder =
      formData.get("folder")?.toString().trim() || DEFAULT_FOLDER;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Dosya bulunamadı." },
        { status: 400 }
      );
    }

    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
    const companyId = payload.companyId ?? "common";
    const uploadFolder = safeFolder.includes(companyId)
      ? safeFolder
      : `${safeFolder}/${companyId}`;

    const url = await saveFileFromWebFile(
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
