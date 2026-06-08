import { normalizeInviteEmail } from "@/lib/company-users-utils";

export type InvitePreviewMode =
  | "logged_in_match"
  | "logged_in_mismatch"
  | "existing_account"
  | "new_account"
  | "invalid"
  | "expired"
  | "already_accepted"
  | "rejected"
  | "cancelled";

export function resolveInvitePreviewMode(input: {
  inviteStatus: string;
  isExpired: boolean;
  isLoggedIn: boolean;
  loggedInEmail: string | null;
  inviteEmail: string;
  accountExists: boolean;
}): { mode: InvitePreviewMode; canAccept: boolean } {
  if (input.inviteStatus === "ACCEPTED") {
    return { mode: "already_accepted", canAccept: false };
  }

  if (input.inviteStatus === "REJECTED") {
    return { mode: "rejected", canAccept: false };
  }

  if (input.inviteStatus === "CANCELLED") {
    return { mode: "cancelled", canAccept: false };
  }

  if (input.inviteStatus === "EXPIRED" || input.isExpired) {
    return { mode: "expired", canAccept: false };
  }

  if (input.inviteStatus !== "PENDING") {
    return { mode: "invalid", canAccept: false };
  }

  if (input.isLoggedIn) {
    const matches =
      !!input.loggedInEmail &&
      normalizeInviteEmail(input.loggedInEmail) ===
        normalizeInviteEmail(input.inviteEmail);

    if (matches) {
      return { mode: "logged_in_match", canAccept: true };
    }

    return { mode: "logged_in_mismatch", canAccept: false };
  }

  if (input.accountExists) {
    return { mode: "existing_account", canAccept: false };
  }

  return { mode: "new_account", canAccept: true };
}
