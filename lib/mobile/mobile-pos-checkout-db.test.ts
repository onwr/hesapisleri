/**
 * Mobile POS checkout DB entegrasyon testleri.
 * TEST_DATABASE_URL veya DATABASE_URL gerekir; yoksa skip.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL;
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: mobile POS checkout DB tests require TEST_DATABASE_URL or DATABASE_URL";

describe("mobile POS checkout DB", { skip: SKIP_REASON }, async () => {
  let db: PrismaClient;
  let companyId: string;
  let userId: string;
  let productId: string;
  let accountId: string;
  let warehouseId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const product =
      (await db.product.findFirst({
        where: { status: "ACTIVE", productType: "SERVICE" },
        select: {
          id: true,
          companyId: true,
          name: true,
          sellPrice: true,
          vatRate: true,
        },
      })) ??
      (await db.product.findFirst({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          companyId: true,
          name: true,
          sellPrice: true,
          vatRate: true,
        },
      }));

    if (!product) return;

    companyId = product.companyId;
    productId = product.id;

    const membership = await db.companyUser.findFirst({
      where: { companyId, status: "ACTIVE", role: { in: ["OWNER", "POS_STAFF"] } },
      select: { userId: true },
    });
    if (!membership) return;
    userId = membership.userId;

    const account = await db.account.findFirst({
      where: { companyId, type: { in: ["CASH", "BANK"] }, status: "ACTIVE" },
      select: { id: true },
    });
    accountId = account?.id ?? "";

    const warehouse = await db.warehouse.findFirst({
      where: { companyId, status: "ACTIVE" },
      select: { id: true },
    });
    warehouseId = warehouse?.id ?? "";
  });

  after(async () => {
    await db.$disconnect();
  });

  it("executeMobilePosCheckout PAID satış oluşturur", async () => {
    if (!companyId || !userId || !productId || !accountId) return;

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { name: true, sellPrice: true, vatRate: true },
    });
    if (!product) return;

    const unitPrice = Number(product.sellPrice);
    const vatRate = product.vatRate;
    const lineTotal = unitPrice + (unitPrice * vatRate) / 100;

    const { executeMobilePosCheckout } = await import("./mobile-pos-service");
    const { randomUUID } = await import("crypto");

    const result = await executeMobilePosCheckout({
      companyId,
      userId,
      role: "OWNER",
      isOwner: true,
      data: {
        idempotencyKey: randomUUID(),
        paymentStatus: "PAID",
        discount: 0,
        warehouseId: warehouseId || undefined,
        items: [
          {
            productId,
            name: product.name,
            quantity: 1,
            unitPrice,
            vatRate,
          },
        ],
        payments: [{ paymentMethod: "CASH", amount: lineTotal, accountId }],
      },
    }).catch((error: { name?: string }) => {
      if (error?.name === "SaleStockValidationError") return null;
      throw error;
    });

    if (!result) return;

    assert.ok(result.sale.id);
    assert.equal(result.sale.paymentStatus, "PAID");
    assert.equal(result.sale.paidAmount, lineTotal);
  });

  it("checkout status COMPLETED döner", async () => {
    if (!companyId) return;

    const sale = await db.sale.findFirst({
      where: { companyId, sourceChannel: "POS", status: "COMPLETED" },
      select: { idempotencyKey: true, payloadHash: true },
    });
    if (!sale?.idempotencyKey) return;

    const { getMobilePosCheckoutStatus } = await import("./mobile-pos-service");
    const status = await getMobilePosCheckoutStatus(
      companyId,
      sale.idempotencyKey,
      sale.payloadHash ?? undefined
    );
    assert.equal(status.status, "COMPLETED");
  });

  it("checkout status NOT_FOUND başka tenant için", async () => {
    if (!companyId) return;

    const other = await db.company.findFirst({
      where: { id: { not: companyId }, status: "ACTIVE" },
      select: { id: true },
    });
    if (!other) return;

    const { getMobilePosCheckoutStatus } = await import("./mobile-pos-service");
    const status = await getMobilePosCheckoutStatus(
      other.id,
      "11111111-1111-4111-8111-111111111111"
    );
    assert.equal(status.status, "NOT_FOUND");
  });

  it("foreign collection account reddedilir", async () => {
    if (!companyId || !userId || !productId || !accountId) return;

    const otherAccount = await db.account.findFirst({
      where: { companyId: { not: companyId }, status: "ACTIVE" },
      select: { id: true },
    });
    if (!otherAccount) return;

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { name: true, sellPrice: true, vatRate: true },
    });
    if (!product) return;

    const unitPrice = Number(product.sellPrice);
    const lineTotal = unitPrice + (unitPrice * product.vatRate) / 100;

    const { executeMobilePosCheckout } = await import("./mobile-pos-service");
    const { randomUUID } = await import("crypto");

    await assert.rejects(
      () =>
        executeMobilePosCheckout({
          companyId,
          userId,
          role: "OWNER",
          isOwner: true,
          data: {
            idempotencyKey: randomUUID(),
            paymentStatus: "PAID",
            discount: 0,
            items: [
              {
                productId,
                name: product.name,
                quantity: 1,
                unitPrice,
                vatRate: product.vatRate,
              },
            ],
            payments: [
              { paymentMethod: "CASH", amount: lineTotal, accountId: otherAccount.id },
            ],
          },
        }),
      (err: Error) => err instanceof Error
    );
  });
});
