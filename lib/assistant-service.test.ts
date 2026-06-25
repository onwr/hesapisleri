import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  assistantChatBodySchema,
  buildSafeContextSummary,
  generateAssistantReply,
  getAssistantProviderMode,
} from "./assistant-service";
import { generateAiAnswer } from "./ai-assistant-page-utils";
import { canAccessModule } from "./permission-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

const sampleContext = {
  userFirstName: "Ali",
  totalSales: 10000,
  totalExpenses: 4000,
  profit: 6000,
  cashIncome: 9000,
  saleCollectionIncome: 8000,
  manualIncome: 1000,
  manualCashExpense: 500,
  saleCancelExpense: 0,
  transferInTotal: 0,
  transferOutTotal: 0,
  salesCount: 12,
  expensesCount: 5,
  unpaidInvoiceTotal: 1500,
  unpaidInvoiceCount: 2,
  accountBalance: 3200,
  lowStockCount: 1,
  outOfStockCount: 0,
  riskScore: 28,
  riskLevel: "Düşük Risk",
  topProductName: "Ürün A",
  topProductRevenue: 3000,
  topProductSoldQty: 8,
  topCustomerName: "Müşteri B",
  topCustomerRevenue: 2500,
  topCustomerSalesCount: 4,
  topExpenseCategory: "Kira",
  topExpenseAmount: 1200,
  periodLabel: "01.06.2026 - 30.06.2026",
};

describe("assistant chat schema", () => {
  it("boş mesaj reddedilir", () => {
    const parsed = assistantChatBodySchema.safeParse({ message: "   " });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.match(parsed.error.issues[0]?.message || "", /mesaj yazın/i);
    }
  });

  it("çok uzun mesaj reddedilir", () => {
    const parsed = assistantChatBodySchema.safeParse({
      message: "a".repeat(ASSISTANT_MESSAGE_MAX_LENGTH + 1),
    });
    assert.equal(parsed.success, false);
  });

  it("geçerli mesaj kabul edilir", () => {
    const parsed = assistantChatBodySchema.safeParse({
      message: "Bugünkü satışlarımı özetle",
      context: "dashboard",
    });
    assert.equal(parsed.success, true);
  });
});

describe("assistant provider mode", () => {
  it("OPENAI_API_KEY yokken auto modda rules döner", () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.AI_PROVIDER = "auto";
    delete process.env.OPENAI_API_KEY;
    assert.equal(getAssistantProviderMode(), "rules");
    process.env.AI_PROVIDER = previousProvider;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  });

  it("AI_PROVIDER=openai ve key yoksa missing döner", () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.AI_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    assert.equal(getAssistantProviderMode(), "missing");
    process.env.AI_PROVIDER = previousProvider;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  });
});

describe("assistant safe context", () => {
  it("hassas alanları filtreler ve özet döner", () => {
    const summary = buildSafeContextSummary(sampleContext);
    assert.equal(summary.topProductName, "Ürün A");
    assert.equal(summary.lowStockCount, 1);
    assert.equal("userFirstName" in summary, false);
  });
});

describe("assistant reply generation", () => {
  it("rules modunda generateAiAnswer ile cevap üretir", async () => {
    const previousProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "rules";
    const result = await generateAssistantReply("Bu ay kârda mıyım?", sampleContext);
    assert.equal(result.provider, "rules");
    assert.equal(result.message, generateAiAnswer("Bu ay kârda mıyım?", sampleContext));
    process.env.AI_PROVIDER = previousProvider;
  });
});

describe("assistant permissions", () => {
  it("STAFF ai-assistant modülüne erişemez", () => {
    assert.equal(canAccessModule("STAFF", "ai-assistant", false), false);
  });

  it("ACCOUNTANT ai-assistant modülüne erişebilir", () => {
    assert.equal(canAccessModule("ACCOUNTANT", "ai-assistant", false), true);
  });
});

describe("assistant API integration", () => {
  it("chat handler auth ve validasyon içerir", () => {
    const handlers = read("lib/ai/ai-api-handlers.ts");
    assert.match(handlers, /requireApiModuleAccess\("ai-assistant"\)/);
    assert.match(handlers, /chatSchema/);
    assert.match(handlers, /status: 400/);
  });

  it("API route POST handler export eder", () => {
    const route = read("app/api/assistant/chat/route.ts");
    assert.match(route, /export async function POST/);
    assert.match(route, /assistantChatHandler/);
  });
});

describe("assistant UI integration", () => {
  it("chat panel API endpoint kullanır", () => {
    const panel = read("components/ai-assistant/ai-assistant-chat-panel.tsx");
    assert.match(panel, /\/api\/ai\/chat/);
    assert.match(panel, /Lütfen bir mesaj yazın/);
    assert.match(panel, /Tekrar dene/);
    assert.match(panel, /Tam ekran/);
    assert.match(panel, /aria-label="Gönder"/);
  });

  it("ai-assistant sayfası chat panel bileşenini kullanır", () => {
    const page = read("app/ai-assistant/page.tsx");
    assert.match(page, /AiAssistantChatPanel/);
    assert.match(page, /getAiAssistantPageData/);
  });
});

describe("assistant security", () => {
  it("client bundle OPENAI_API_KEY kullanmaz", () => {
    const panel = read("components/ai-assistant/ai-assistant-chat-panel.tsx");
    assert.doesNotMatch(panel, /OPENAI_API_KEY/);
    assert.doesNotMatch(panel, /NEXT_PUBLIC_OPENAI/);
  });

  it("assistant service sadece server lib içindedir", () => {
    const service = read("lib/assistant-service.ts");
    assert.match(service, /process\.env\.OPENAI_API_KEY/);
    assert.doesNotMatch(service, /NEXT_PUBLIC_/);
  });
});
