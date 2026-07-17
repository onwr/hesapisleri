import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const clientSource = fs.readFileSync(
  path.join(process.cwd(), "components/cash-bank/cash-daily-close-client.tsx"),
  "utf8"
);
const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/cash-bank/daily-close/page.tsx"),
  "utf8"
);
const actionsSource = fs.readFileSync(
  path.join(process.cwd(), "components/cash-bank/cash-bank-list-actions.tsx"),
  "utf8"
);

describe("cash daily close ui", () => {
  it("kasa dengede/fazlası/açığı etiketlerini kullanır", () => {
    assert.match(clientSource, /getClosingDifferenceLabel/);
    assert.match(clientSource, /Gün Sonunu Kapat/);
    assert.match(clientSource, /Fiili \/ sayılan nakit/);
    assert.match(clientSource, /Geçmiş kapanışlar/);
  });

  it("yetkisiz kullanıcıda kapanış butonu gizlenir", () => {
    assert.match(clientSource, /canManage/);
    assert.match(clientSource, /Kapanış oluşturma yetkiniz yok/);
  });

  it("duplicate kapanış mesajını gösterir", () => {
    assert.match(clientSource, /Bu gün için kasa kapanışı zaten yapılmış/);
  });

  it("route ve kasa menü erişimi vardır", () => {
    assert.match(pageSource, /guardPageModule\("cash-bank"\)/);
    assert.match(actionsSource, /\/cash-bank\/daily-close/);
    assert.match(actionsSource, /Gün Sonu/);
  });
});
