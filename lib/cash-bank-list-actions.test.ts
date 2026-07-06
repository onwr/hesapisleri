import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

describe("cash bank account row actions", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const src = readFileSync(
    join(root, "components/cash-bank/cash-bank-list-actions.tsx"),
    "utf8"
  );

  it("erişilebilir üç nokta menüsü ve stopPropagation içerir", () => {
    assert.match(src, /MoreHorizontal/);
    assert.match(src, /aria-label=\{menuLabel\}/);
    assert.match(src, /event\.stopPropagation\(\)/);
  });

  it("gerçek route ve modal aksiyonlarını listeler", () => {
    assert.match(src, /Hesabı Görüntüle/);
    assert.match(src, /Hareketleri Görüntüle/);
    assert.match(src, /Hesabı Düzenle/);
    assert.match(src, /Transfer Yap/);
    assert.match(src, /Tahsilat Al/);
    assert.match(src, /Ödeme Yap/);
    assert.match(src, /Arşivle/);
    assert.match(src, /CashBankTransferModal/);
    assert.match(src, /\/cash-bank\/\$\{accountId\}\?movement=1/);
    assert.match(src, /href="\/expenses"/);
  });

  it("arşiv hesapta mutation aksiyonlarını gizler", () => {
    assert.match(src, /const isActive = status === "ACTIVE"/);
    assert.match(src, /canManage && isActive/);
  });

  it("fiziksel sil aksiyonu eklemez", () => {
    assert.doesNotMatch(src, />\s*Sil\s*</);
  });
});
