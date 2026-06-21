import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "@prisma/client";
import {
  TRIAL_DAYS,
  createCompanyForUser,
} from "./create-company-service";

type OperationName =
  | "company"
  | "companyUser"
  | "membershipPayment"
  | "membershipPlan"
  | "companySubscription"
  | "warehouse"
  | "account"
  | "companySettings"
  | "notification"
  | "activityLog";

function createMockTx() {
  const operations: OperationName[] = [];

  const tx = {
    company: {
      create: async (args: { data: { name: string } }) => {
        operations.push("company");
        return {
          id: "company-1",
          name: args.data.name,
          taxNo: null,
          taxOffice: null,
          phone: null,
          email: null,
          address: null,
          logoUrl: null,
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    },
    companyUser: {
      create: async (args: {
        data: { role: string; status: string; isOwner: boolean };
      }) => {
        operations.push("companyUser");
        assert.equal(args.data.role, "OWNER");
        assert.equal(args.data.status, "ACTIVE");
        assert.equal(args.data.isOwner, true);
      },
    },
    membershipPayment: {
      create: async (args: { data: { provider: string; amount: number } }) => {
        operations.push("membershipPayment");
        assert.equal(args.data.provider, "TRIAL");
        assert.equal(args.data.amount, 1499);
      },
    },
    membershipPlan: {
      findFirst: async () => {
        operations.push("membershipPlan");
        return { id: "plan-standard" };
      },
    },
    companySubscription: {
      create: async () => {
        operations.push("companySubscription");
      },
    },
    warehouse: {
      create: async (args: { data: { name: string; isDefault: boolean } }) => {
        operations.push("warehouse");
        assert.equal(args.data.name, "Ana Depo");
        assert.equal(args.data.isDefault, true);
      },
    },
    account: {
      createMany: async (args: {
        data: Array<{ type: string; name: string; currency: string }>;
      }) => {
        operations.push("account");
        assert.equal(args.data.length, 2);
        assert.equal(args.data[0]?.type, "CASH");
        assert.equal(args.data[0]?.name, "Merkez Kasa");
        assert.equal(args.data[1]?.type, "BANK");
        assert.equal(args.data[1]?.name, "Banka Hesabı");
        assert.equal(args.data[0]?.currency, "TRY");
      },
    },
    companySettings: {
      create: async (args: {
        data: { currency: string; defaultVatRate: number };
      }) => {
        operations.push("companySettings");
        assert.equal(args.data.currency, "TRY");
        assert.equal(args.data.defaultVatRate, 20);
      },
    },
    notification: {
      findFirst: async () => null,
      create: async () => {
        operations.push("notification");
        return {
          id: "notification-1",
          companyId: "company-1",
          userId: "user-1",
          type: "SUCCESS",
          category: "SYSTEM",
          module: "settings",
          entityType: "COMPANY",
          entityId: "company-1",
          actionUrl: "/settings",
          metadata: null,
          priority: "NORMAL",
          channel: "IN_APP",
          dedupeKey: null,
          title: "Test",
          message: "Test",
          readAt: null,
          createdAt: new Date(),
        };
      },
    },
    activityLog: {
      create: async (args: { data: { action: string } }) => {
        operations.push("activityLog");
        assert.equal(args.data.action, "CREATE_COMPANY");
      },
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, operations };
}

describe("createCompanyForUser", () => {
  it("company, owner üyelik, depo, hesaplar, trial ve ayarları oluşturur", async () => {
    const { tx, operations } = createMockTx();

    const result = await createCompanyForUser(tx, {
      userId: "user-1",
      name: "Test Firma",
      source: "NEW_COMPANY",
    });

    assert.equal(result.company.id, "company-1");
    assert.equal(result.company.name, "Test Firma");
    assert.deepEqual(operations, [
      "company",
      "companyUser",
      "membershipPayment",
      "membershipPlan",
      "companySubscription",
      "warehouse",
      "account",
      "companySettings",
      "notification",
      "activityLog",
    ]);
  });

  it("register kaynağında REGISTER aktivitesi yazar", async () => {
    let activityAction = "";
    const { tx, operations } = createMockTx();

    const mockTx = tx as unknown as {
      activityLog: {
        create: (args: { data: { action: string } }) => Promise<void>;
      };
    };

    mockTx.activityLog.create = async (args: { data: { action: string } }) => {
      operations.push("activityLog");
      activityAction = args.data.action;
    };

    await createCompanyForUser(tx, {
      userId: "user-1",
      name: "İşletmem",
      source: "REGISTER",
      registerCompanyNameProvided: false,
    });

    assert.equal(activityAction, "REGISTER");
  });

  it("transaction içinde hata fırlatılırsa işlem yarım kalmaz", async () => {
    const { tx } = createMockTx();

    const mockTx = tx as unknown as {
      companyUser: { create: () => Promise<never> };
    };

    mockTx.companyUser.create = async () => {
      throw new Error("Simulated failure");
    };

    await assert.rejects(
      () =>
        createCompanyForUser(tx, {
          userId: "user-1",
          name: "Test Firma",
          source: "NEW_COMPANY",
        }),
      /Simulated failure/
    );
  });

  it("TRIAL_DAYS 14 olarak tanımlıdır", () => {
    assert.equal(TRIAL_DAYS, 14);
  });
});
