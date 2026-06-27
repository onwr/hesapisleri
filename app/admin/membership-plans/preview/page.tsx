import { permanentRedirect } from "next/navigation";

export default function LegacyPlanPreviewPage() {
  permanentRedirect("/admin/price-preview");
}
