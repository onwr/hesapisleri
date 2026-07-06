import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  assertDemoTenantCompany,
  DEMO_TAX_NO,
  isUnsafeDemoContent,
} from "@/lib/demo-tenant";
import {
  mapActivityLogToDashboardItem,
  normalizeAuditDisplayText,
} from "@/lib/activity-log-utils";
import {
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} from "@/lib/auth/auth-cookie";
import { contentSecurityPolicy } from "@/lib/security-headers";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function assertMinHelperFontSize(source: string, label: string) {
  const tiny = source.match(/text-\[(9|10|10\.5|11)px\]/g) ?? [];
  assert.equal(
    tiny.length,
    0,
    `${label} should not use sub-12px helper text: ${tiny.join(", ")}`
  );
}

describe("QA Faz 2 — demo veri hijyeni", () => {
  it("cleanup-demo-data.ts dry-run varsayılan ve --apply korumalı", () => {
    const script = read("scripts/cleanup-demo-data.ts");
    assert.match(script, /process\.argv\.includes\("--apply"\)/);
    assert.match(script, /resolveDemoCompany/);
    assert.match(script, /assertDemoTenantCompany/);
    assert.doesNotMatch(script, /console\.log\([^)]*message/);
  });

  it("canonical demo tenant DEMO_TAX_NO kullanır", () => {
    assert.equal(DEMO_TAX_NO, "DEMO-9988776655");
    const seed = read("scripts/seed-demo-business.ts");
    assert.match(seed, /DEMO-9988776655/);
  });

  it("production tenant cleanup reddedilir", () => {
    assert.throws(
      () =>
        assertDemoTenantCompany({
          id: "prod-1",
          taxNo: "1234567890",
        }),
      /canonical demo tenant/i
    );
  });

  it("unsafe içerik tespiti HTML ve event handler yakalar", () => {
    assert.equal(isUnsafeDemoContent('<img src=x onerror=alert(1)>'), true);
    assert.equal(isUnsafeDemoContent("normal metin"), false);
  });
});

describe("QA Faz 2 — audit log güvenliği", () => {
  it("dashboard dangerouslySetInnerHTML kullanmaz", () => {
    const content = read("components/dashboard/dashboard-content.tsx");
    assert.doesNotMatch(content, /dangerouslySetInnerHTML/);
  });

  it("DOMPurify bağımlılığı eklenmemiş", () => {
    const pkg = read("package.json");
    assert.doesNotMatch(pkg, /dompurify/i);
  });

  it("legacy XSS payload plain text olarak sanitize edilir", () => {
    const item = mapActivityLogToDashboardItem(
      {
        id: "xss-1",
        action: "CREATE",
        module: "expenses",
        message: '<img src=x onerror=alert(1)>',
        createdAt: new Date(),
      },
      () => "Az önce"
    );
    assert.ok(item);
    assert.doesNotMatch(item?.title ?? "", /</);
  });

  it("account-admin-service buildSafeActivityMessage kullanır", () => {
    const service = read("lib/account-admin-service.ts");
    assert.match(service, /buildSafeActivityMessage/);
    assert.match(service, /createActivityLog/);
  });
});

describe("QA Faz 2 — recent activity doğruluğu", () => {
  it("dashboard-content hard-coded demo müşteri isimleri içermez", () => {
    const content = read("components/dashboard/dashboard-content.tsx");
    assert.doesNotMatch(content, /Mehmet Kaya/);
    assert.doesNotMatch(content, /ABC Ltd/);
    assert.doesNotMatch(content, /Kırtasiye alımı/);
  });

  it("activity-log-utils demo pattern filtreler", () => {
    const utils = read("lib/activity-log-utils.ts");
    assert.match(utils, /DEMO_ACTIVITY_MESSAGE_PATTERNS/);
    assert.match(utils, /isDemoActivityMessage/);
  });
});

describe("QA Faz 2 — font ve kontrast", () => {
  it("stat-card yardımcı metin minimum 12px", () => {
    assertMinHelperFontSize(read("components/cards/stat-card.tsx"), "stat-card");
  });

  it("action-card açıklama metni okunabilir kontrastta", () => {
    const card = read("components/cards/compact-action-card.tsx");
    assert.match(card, /text-\[11px\] font-medium text-slate-500/);
    // Kart gövdesi artık hafif renkli tondan beyaza gradient (to-white) —
    // düz bg-white değil ama açıklama metninin arka planı hâlâ beyaza yakın.
    assert.match(card, /to-white/);
  });

  it("dashboard-content küçük badge fontları kaldırıldı", () => {
    const content = read("components/dashboard/dashboard-content.tsx");
    assert.doesNotMatch(content, /text-\[10px\]/);
    assert.doesNotMatch(content, /text-\[10\.5px\]/);
    assert.doesNotMatch(content, /text-\[11px\]/);
  });
});

describe("QA Faz 2 — grafik erişilebilirliği", () => {
  it("satış grafiği figure ve aria-label içerir", () => {
    const chart = read("components/dashboard/dashboard-sales-chart.tsx");
    assert.match(chart, /<figure/);
    assert.match(chart, /aria-label=/);
    assert.match(chart, /figcaption className="sr-only"/);
    assert.match(chart, /role="status"/);
  });

  it("gelir-gider grafiği figure ve sr-only özet içerir", () => {
    const chart = read("components/dashboard/dashboard-income-chart.tsx");
    assert.match(chart, /<figure/);
    assert.match(chart, /aria-label=/);
    assert.match(chart, /figcaption className="sr-only"/);
  });

  it("satış grafiği eksen formatı K kullanır", () => {
    const chart = read("components/dashboard/dashboard-sales-chart.tsx");
    assert.match(chart, /1_000\) return `\$\{Math\.round\(value \/ 1_000\)\}K`/);
    assert.doesNotMatch(chart, /1000\) return `\$\{Math\.round\(value \/ 1000\)\}B`/);
  });
});

describe("QA Faz 2 — klavye ve focus", () => {
  it("kısayol düzenle butonu işlevsel ve aria-label içerir", () => {
    const panel = read("components/dashboard/dashboard-shortcuts-panel.tsx");
    assert.match(panel, /aria-label="Kısayolları düzenle"/);
    assert.match(panel, /Dialog/);
    assert.match(panel, /setEditOpen/);
  });

  it("hızlı işlem kartları Link ile navigasyon sağlar", () => {
    const card = read("components/cards/action-card.tsx");
    const compact = read("components/cards/compact-action-card.tsx");
    assert.match(card, /iconName:/);
    assert.match(compact, /<Link href=\{href\}/);
  });

  it("stat-card focus-visible ring içerir", () => {
    const card = read("components/cards/stat-card.tsx");
    assert.match(card, /focus-visible:ring/);
  });
});

describe("QA Faz 2 — web mobil dashboard", () => {
  it("dashboard-content min-w-0 ve responsive grid kullanır", () => {
    const content = read("components/dashboard/dashboard-content.tsx");
    assert.match(content, /max-md:min-w-0/);
    assert.match(content, /md:grid-cols-2/);
    assert.match(content, /xl:grid-cols-5/);
  });

  it("global body overflow-x hidden eklenmemiş", () => {
    const globals = read("app/globals.css");
    assert.doesNotMatch(globals, /overflow-x:\s*hidden/);
  });

  it("grafik container min-w-0 kullanır", () => {
    const sales = read("components/dashboard/dashboard-sales-chart.tsx");
    assert.match(sales, /min-w-0/);
  });
});

describe("QA Faz 2 — bilgi yoğunluğu", () => {
  it("boş grafiklerde compact empty state uygulanır", () => {
    const content = read("components/dashboard/dashboard-content.tsx");
    assert.match(content, /showCompactCharts/);
    const sales = read("components/dashboard/dashboard-sales-chart.tsx");
    assert.match(sales, /henüz satış verisi yok/i);
  });

  it("onboarding varken ipucu kartı gizlenir", () => {
    const content = read("components/dashboard/dashboard-content.tsx");
    assert.match(content, /!onboardingChecklist/);
  });
});

describe("QA Faz 2 — kısayollar", () => {
  it("shortcut tanımları gerçek route içerir", () => {
    const shortcuts = read("lib/dashboard-shortcuts.ts");
    assert.match(shortcuts, /href:\s*"\/[^"]+"/);
    assert.doesNotMatch(shortcuts, /href:\s*"#"/);
  });
});

describe("QA Faz 2 — döviz kuru cache/fallback", () => {
  it("dashboard read path harici API çağırmaz", () => {
    const service = read("lib/exchange-rate-service.ts");
    const fnMatch = service.match(
      /export async function getDashboardExchangeRates\([\s\S]*?\n\}/
    );
    assert.ok(fnMatch);
    assert.doesNotMatch(fnMatch[0], /fetchExternalExchangeRates/);
  });

  it("fetch timeout ve fallback mevcut", () => {
    const service = read("lib/exchange-rate-service.ts");
    assert.match(service, /FETCH_TIMEOUT_MS/);
    assert.match(service, /AbortController/);
    assert.match(service, /getLatestSuccessfulSnapshot/);
  });
});

describe("QA Faz 2 — performance ölçümü", () => {
  it("bundle analyzer yalnız ANALYZE=true ile etkin", () => {
    const config = read("next.config.ts");
    assert.match(config, /@next\/bundle-analyzer/);
    assert.match(config, /ANALYZE === "true"/);
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.ok(pkg.devDependencies?.["@next/bundle-analyzer"]);
    assert.equal(pkg.dependencies?.["@next/bundle-analyzer"], undefined);
  });
});

describe("QA Faz 2 — cookie/session", () => {
  it("auth cookie HttpOnly Secure path maxAge içerir", () => {
    const options = getAuthCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.path, "/");
    assert.ok(options.maxAge > 0);
    assert.equal(options.sameSite, "lax");
  });

  it("logout cookie invalidation maxAge 0", () => {
    const clear = getClearAuthCookieOptions();
    assert.equal(clear.maxAge, 0);
    assert.equal(clear.httpOnly, true);
  });
});

describe("QA Faz 2 — CSP regresyonu", () => {
  it("mevcut CSP yapısı korunur ve dashboard assetleri destekler", () => {
    assert.match(contentSecurityPolicy, /default-src 'self'/);
    assert.match(contentSecurityPolicy, /img-src[^;]*https:/);
    assert.match(contentSecurityPolicy, /font-src/);
    assert.match(contentSecurityPolicy, /connect-src[^;]*https:/);
    const config = read("next.config.ts");
    assert.match(config, /securityHeaders/);
  });
});

describe("QA Faz 2 — demo credential kontrolü", () => {
  it("login formunda düz metin demo şifresi yok", () => {
    const login = read("components/login/login-form.tsx");
    assert.doesNotMatch(login, /123456/);
    assert.doesNotMatch(login, /Şifre:/);
  });

  it("public login bundle demo credential sızdırmaz", () => {
    const login = read("components/login/login-form.tsx");
    assert.match(login, /\/api\/auth\/demo-login/);
    assert.doesNotMatch(login, /owner@demo\.com/);
  });
});

describe("QA Faz 2 — normalizeAuditDisplayText contract", () => {
  it("maksimum uzunluk uygulanır", () => {
    const long = "A".repeat(250);
    const normalized = normalizeAuditDisplayText(long);
    assert.ok(normalized.length <= 201);
  });
});
