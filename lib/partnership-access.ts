import { db } from "@/lib/prisma";
import { normalizePartnerEmail } from "@/lib/partner-utils";
import { resolvePartnerForUser } from "@/lib/partner-service";

export type PartnershipApplicationSnapshot = {
  id: string;
  fullName: string;
  email: string;
  status: "PENDING" | "REJECTED" | "APPROVED";
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type PartnershipAccessState =
  | { kind: "APPROVED" }
  | { kind: "PENDING"; application: PartnershipApplicationSnapshot }
  | { kind: "REJECTED"; application: PartnershipApplicationSnapshot }
  | { kind: "NONE" };

function serializeApplication(application: {
  id: string;
  fullName: string;
  email: string;
  status: "PENDING" | "REJECTED" | "APPROVED";
  rejectionReason: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}): PartnershipApplicationSnapshot {
  return {
    id: application.id,
    fullName: application.fullName,
    email: application.email,
    status: application.status,
    rejectionReason: application.rejectionReason,
    createdAt: application.createdAt.toISOString(),
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
  };
}

export async function getPartnershipAccessState(
  userId: string,
  email: string
): Promise<PartnershipAccessState> {
  const partner = await resolvePartnerForUser(userId, email);

  if (partner && partner.status === "ACTIVE") {
    return { kind: "APPROVED" };
  }

  const normalizedEmail = normalizePartnerEmail(email);
  const application = await db.partnerApplication.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });

  if (!application) {
    return { kind: "NONE" };
  }

  if (application.status === "PENDING") {
    return {
      kind: "PENDING",
      application: serializeApplication(application),
    };
  }

  if (application.status === "REJECTED") {
    return {
      kind: "REJECTED",
      application: serializeApplication(application),
    };
  }

  if (application.status === "APPROVED") {
    return { kind: "APPROVED" };
  }

  return { kind: "NONE" };
}

export function resolvePartnershipHref(state: PartnershipAccessState) {
  switch (state.kind) {
    case "APPROVED":
      return "/partnership/dashboard";
    case "PENDING":
    case "REJECTED":
      return "/partnership/status";
    default:
      return "/partnership/apply";
  }
}
