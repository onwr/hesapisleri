import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isValidAccountName,
  OPENING_BALANCE_MIN_MESSAGE,
  validateAccountCreateForm,
  validateOpeningBalanceInput,
} from "@/lib/account-validation";
import {
  isAllowedMutationOrigin,
} from "@/lib/api-origin-guard";
import { createAccountSchema } from "@/lib/account-utils";
import { formatCashDate, formatCashMoney, getAccountStatusBadge } from "@/lib/cash-bank-page-utils";
import { formatMoney } from "@/lib/format-utils";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";
import { privateRouteMetadata } from "@/lib/route-seo";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("QA Faz 1 — negatif açılış bakiyesi", () => {
  it("client schema negatif açılış bakiyesini reddeder", () => {
    const result = validateOpeningBalanceInput("-100");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, OPENING_BALANCE_MIN_MESSAGE);
    }
  });

  it("API createAccountSchema negatif açılış bakiyesini reddeder", () => {
    const parsed = createAccountSchema.safeParse({
      name: "Merkez Kasa",
      type: "CASH",
      openingBalance: -50,
    });
    assert.equal(parsed.success, false);
  });

  it("boş açılış bakiyesi sıfır kabul edilir", () => {
    const result = validateOpeningBalanceInput("");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, 0);
  });
});

describe("QA Faz 1 — hesap adı validasyonu", () => {
  it("HTML tag ve script reddedilir", () => {
    assert.equal(isValidAccountName("<script>x</script>"), false);
    assert.equal(isValidAccountName("Kasa <test>"), false);
  });

  it("kontrol karakterleri reddedilir", () => {
    assert.equal(isValidAccountName("Kasa\u0007"), false);
  });

  it("meşru Türkçe işletme adı kabul edilir", () => {
    assert.equal(isValidAccountName("Merkez Kasa (Şube-1) & POS"), true);
    assert.equal(isValidAccountName("Garanti BBVA / Ana"), true);
  });

  it("validateAccountCreateForm Türkçe alan hatası döner", () => {
    const result = validateAccountCreateForm({
      name: "<b>",
      type: "CASH",
      openingBalance: "0",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.name);
    }
  });
});

describe("QA Faz 1 — hesap arşivleme", () => {
  it("account-admin-service arşiv mesajı ve bakiye uyarısı içerir", () => {
    const service = read("lib/account-admin-service.ts");
    assert.match(service, /Hesap arşivlendi/);
    assert.match(service, /balanceWarning/);
    assert.match(service, /Varsayılan hesap arşivlenemez/);
  });

  it("aktif hesap seçim listeleri PASSIVE filtreler", () => {
    const readService = read("lib/account-read-service.ts");
    assert.match(readService, /status: "ACTIVE"/);
  });

  it("cash-bank sayfası transfer seçeneklerinde yalnız ACTIVE hesapları kullanır", () => {
    const page = read("app/cash-bank/page.tsx");
    assert.match(page, /filter\(\(account\) => account\.status === "ACTIVE"\)/);
  });

  it("arşiv durumu Arşivde etiketiyle gösterilir", () => {
    const badge = getAccountStatusBadge("PASSIVE");
    assert.equal(badge.label, "Arşivde");
  });

  it("account detail arşiv aksiyonu permission-aware", () => {
    const detail = read("app/cash-bank/[id]/page.tsx");
    assert.match(detail, /AccountArchiveActions/);
    assert.match(detail, /canManageAccounts/);
  });
});

describe("QA Faz 1 — demo giriş güvenliği", () => {
  it("login formunda düz metin demo şifresi yok", () => {
    const login = read("components/login/login-form.tsx");
    assert.doesNotMatch(login, /123456/);
    assert.doesNotMatch(login, /owner@demo\.com/);
    assert.doesNotMatch(login, /Şifre:/);
    assert.match(login, /Demo Hesaba Gir/);
    assert.match(login, /\/api\/auth\/demo-login/);
  });

  it("demo-login-service env tabanlı credential kullanır", () => {
    const service = read("lib/demo-login-service.ts");
    assert.match(service, /DEMO_LOGIN_EMAIL/);
    assert.match(service, /DEMO_LOGIN_PASSWORD/);
    assert.match(service, /checkRateLimit/);
  });
});

describe("QA Faz 1 — Türkçe form validasyonu", () => {
  it("hesap formu noValidate kullanır", () => {
    const dialog = read("components/cash-bank/account-form-dialog.tsx");
    assert.match(dialog, /noValidate/);
  });

  it("transfer formu noValidate kullanır", () => {
    const modal = read("components/cash-bank/cash-bank-transfer-modal.tsx");
    assert.match(modal, /noValidate/);
  });

  it("login formu noValidate kullanır", () => {
    const login = read("components/login/login-form.tsx");
    assert.match(login, /noValidate/);
  });
});

describe("QA Faz 1 — tarih ve para birimi", () => {
  it("formatCashDate tr-TR DD.MM.YYYY döner", () => {
    const formatted = formatCashDate(new Date("2026-03-15T12:00:00Z"));
    assert.match(formatted, /^\d{2}\.\d{2}\.\d{4}$/);
  });

  it("formatCashDate ISO string ve geçersiz değerleri tolere eder", () => {
    const fromIso = formatCashDate("2026-03-15T12:00:00.000Z");
    assert.match(fromIso, /^\d{2}\.\d{2}\.\d{4}$/);
    assert.equal(formatCashDate("invalid"), "-");
    assert.equal(formatCashDate(null), "-");
  });

  it("TRY formatter ₺ sembolü kullanır", () => {
    const formatted = formatCashMoney(1234.5);
    assert.match(formatted, /₺/);
    assert.doesNotMatch(formatted, /£/);
    assert.doesNotMatch(formatted, /₤/);
    assert.equal(formatMoney(100).includes("₺"), true);
  });
});

describe("QA Faz 1 — responsive taşma", () => {
  it("cash-bank sayfası min-w-0 ve kontrollü grid kullanır", () => {
    const page = read("app/cash-bank/page.tsx");
    assert.match(page, /min-w-0/);
    assert.match(page, /overflow-x-auto/);
    assert.doesNotMatch(page, /overflow-x-hidden/);
  });

  it("global body overflow-x hidden eklenmemiş", () => {
    const globals = read("app/globals.css");
    assert.doesNotMatch(globals, /overflow-x:\s*hidden/);
  });
});

describe("QA Faz 1 — kayıt linki", () => {
  it("register-content tekrar giriş linki içermez", () => {
    const content = read("components/register/register-content.tsx");
    assert.doesNotMatch(content, /Zaten hesabınız var mı/);
  });

  it("register-form tek giriş linkini korur", () => {
    const form = read("components/register/register-form.tsx");
    const matches = form.match(/Zaten hesabınız var mı/g) ?? [];
    assert.equal(matches.length, 1);
  });
});

describe("QA Faz 1 — AI floating button", () => {
  it("safe-area ve 44px touch target içerir", () => {
    const launcher = read("components/ai-assistant/ai-floating-launcher.tsx");
    assert.match(launcher, /safe-area-inset-bottom/);
    assert.match(launcher, /min-h-\[44px\]/);
    assert.match(launcher, /min-w-\[44px\]/);
    assert.match(launcher, /aria-label/);
    assert.match(launcher, /max-w-\[calc\(100vw/);
  });
});

describe("QA Faz 1 — CSRF origin doğrulaması", () => {
  it("cross-origin mutation reddedilir", () => {
    assert.equal(
      isAllowedMutationOrigin("https://evil.example", null),
      false
    );
  });

  it("same-origin localhost mutation kabul edilir", () => {
    assert.equal(
      isAllowedMutationOrigin("http://localhost:3000", null),
      true
    );
  });

  it("account ve transfer route handler origin guard kullanır", () => {
    const handlers = read("lib/account-api-handlers.ts");
    assert.match(handlers, /verifyApiMutationOrigin/);
    const transfer = read("app/api/cash-bank/transfer/route.ts");
    assert.match(transfer, /verifyApiMutationOrigin/);
    const transactions = read("app/api/cash-bank/accounts/[id]/transactions/route.ts");
    assert.match(transactions, /verifyApiMutationOrigin/);
  });

  it("verifyApiMutationOrigin test bypass kodu içerir", () => {
    const guard = read("lib/api-origin-guard.ts");
    assert.match(guard, /NODE_ENV === "test"/);
  });
});

describe("QA Faz 1 — CSP ve güvenlik başlıkları", () => {
  it("CSP temel direktifleri içerir", () => {
    assert.match(contentSecurityPolicy, /default-src 'self'/);
    assert.match(contentSecurityPolicy, /object-src 'none'/);
    assert.match(contentSecurityPolicy, /frame-ancestors/);
    assert.match(contentSecurityPolicy, /form-action/);
  });

  it("X-XSS-Protection başlığı eklenmemiş", () => {
    const keys = securityHeaders.map((header) => header.key);
    assert.equal(keys.includes("X-XSS-Protection"), false);
  });
});

describe("QA Faz 1 — public SEO", () => {
  it("robots.ts ve sitemap.ts mevcut", () => {
    assert.match(read("app/robots.ts"), /disallow/);
    assert.match(read("app/robots.ts"), /\/login/);
    assert.match(read("app/robots.ts"), /\/cash-bank/);
    assert.match(read("app/sitemap.ts"), /PUBLIC_ROUTES/);
    assert.doesNotMatch(read("app/sitemap.ts"), /\/login/);
    assert.doesNotMatch(read("app/sitemap.ts"), /\/dashboard/);
  });

  it("private cash-bank layout noindex metadata export eder", () => {
    const layout = read("app/cash-bank/layout.tsx");
    assert.match(layout, /privateRouteMetadata/);
    const robots = privateRouteMetadata.robots;
    assert.equal(
      typeof robots === "object" && robots !== null && "index" in robots
        ? robots.index
        : undefined,
      false
    );
  });

  it("meta keywords eklenmemiş", () => {
    const layout = read("app/layout.tsx");
    assert.doesNotMatch(layout, /keywords/);
    const homepage = read("app/page.tsx");
    assert.doesNotMatch(homepage, /keywords/);
  });
});

describe("QA Faz 1 — 404 davranışı", () => {
  it("not-found noindex ve public linkler içerir", () => {
    const notFound = read("app/not-found.tsx");
    assert.match(notFound, /Sayfa bulunamadı/);
    assert.match(notFound, /index:\s*false/);
    assert.match(notFound, /href="\/"/);
    assert.match(notFound, /href="\/login"/);
    assert.doesNotMatch(notFound, /href="\/dashboard"/);
  });
});

describe("QA Faz 1 — demo süre bilgisi", () => {
  it("sidebar üyelik kartı bitiş tarihi ve politika notu gösterir", () => {
    const sidebar = read("components/layout/app-sidebar.tsx");
    assert.match(sidebar, /periodEndLabel/);
    assert.match(sidebar, /policyNote/);
    const membership = read("lib/membership-service.ts");
    assert.match(membership, /periodEndLabel/);
    assert.match(membership, /policyNote/);
  });
});
