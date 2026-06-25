import { Handshake } from "lucide-react";
import type { PublicReferralSignupInfo } from "@/lib/partner-service";

type ReferralSignupNoticeProps = {
  referral: PublicReferralSignupInfo;
};

export function ReferralSignupNotice({ referral }: ReferralSignupNoticeProps) {
  const label = referral.partnerName?.trim() || referral.referralCode;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/90 px-4 py-3">
      <Handshake
        size={18}
        className="mt-0.5 shrink-0 text-violet-600"
        aria-hidden
      />
      <p className="text-[13px] leading-5 text-violet-900">
        <span className="font-bold">{label}</span> referansıyla kayıt
        oluyorsunuz.
      </p>
    </div>
  );
}
