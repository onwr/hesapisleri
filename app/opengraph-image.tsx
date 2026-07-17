import { ImageResponse } from "next/og";
import {
  getPlatformSettings,
  getPlatformSettingsFallback,
} from "@/lib/admin/platform-settings/platform-settings-loader";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Hesap İşleri — KOBİ'ler için İşletme Yönetim Platformu";

export default async function OpengraphImage() {
  const settings = await getPlatformSettings().catch(() => getPlatformSettingsFallback());
  const brandName = settings.brandName;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background: "linear-gradient(135deg, #0f1f4d 0%, #1e3a8a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
              color: "white",
            }}
          >
            H
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: "white" }}>{brandName}</div>
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "white",
            lineHeight: 1.15,
            maxWidth: 900,
            display: "flex",
          }}
        >
          İşletmenizi tek platformdan yönetin
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 26,
            color: "#93c5fd",
            maxWidth: 820,
            display: "flex",
          }}
        >
          Satış, stok, e-fatura, kasa ve cari hesabı tek panelde yönetin.
        </div>
      </div>
    ),
    { ...size }
  );
}
