type CompanyMembership = {
  companyId: string;
  status: string;
};

export type MeMembershipResolution =
  | {
      ok: true;
      membership: CompanyMembership;
      requiresCompany: true;
    }
  | {
      ok: true;
      membership: null;
      requiresCompany: false;
    }
  | {
      ok: false;
      status: 403;
      message: string;
    };

/**
 * /api/auth/me için aktif firma üyeliğini çözer.
 * JWT companyId geçersizse başka firmaya düşmez (fail-closed).
 */
export function resolveMeMembership<T extends CompanyMembership>(
  memberships: T[],
  sessionCompanyId: string | null
): MeMembershipResolution & { membership: T | null } {
  const active = memberships.filter((item) => item.status === "ACTIVE");

  if (!sessionCompanyId) {
    return {
      ok: true,
      membership: null,
      requiresCompany: false,
    };
  }

  const match = active.find((item) => item.companyId === sessionCompanyId);
  if (!match) {
    return {
      ok: false,
      status: 403,
      message: "Bu firmaya erişim yetkiniz yok.",
      membership: null,
    };
  }

  return {
    ok: true,
    membership: match,
    requiresCompany: true,
  };
}
