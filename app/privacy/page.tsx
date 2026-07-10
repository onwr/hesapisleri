import Link from "next/link";
import { PrivacyPolicyContent } from "@/components/legal/privacy-policy-content";
import { getPlatformLegalInfo } from "@/lib/legal/platform-legal-info";

export const metadata = {
  title: "Gizlilik Politikası | Hesapisleri",
  description: "Hesap İşleri gizlilik politikası",
};

export default async function PrivacyPolicyPage() {
  const legalInfo = await getPlatformLegalInfo();

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          ← Ana sayfaya dön
        </Link>

        <div className="mt-6">
          <PrivacyPolicyContent legalInfo={legalInfo} />
        </div>
      </div>
    </div>
  );
}
