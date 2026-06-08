import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractEmailList,
  extractPhoneList,
  formatWhatsAppLinks,
} from "./customer-bulk-actions-utils";
import {
  filterBulkCustomers,
  matchesBulkBalanceFilter,
  summarizeBulkActions,
} from "./customer-bulk-actions-service";
import type { BulkActionCustomer } from "./customer-bulk-actions-service";

const sampleCustomers: BulkActionCustomer[] = [
  {
    id: "1",
    name: "Ali",
    phone: "0555 111 22 33",
    email: "ali@test.com",
    taxNo: "111",
    group: "Genel",
    groupColor: null,
    balance: 100,
    status: "ACTIVE",
  },
  {
    id: "2",
    name: "Ayşe",
    phone: "",
    email: "",
    taxNo: null,
    group: "Perakende",
    groupColor: null,
    balance: -50,
    status: "PASSIVE",
  },
  {
    id: "3",
    name: "Mehmet",
    phone: "0532 444 55 66",
    email: "mehmet@test.com",
    taxNo: "222",
    group: "Genel",
    groupColor: null,
    balance: 0,
    status: "ACTIVE",
  },
];

describe("bulk customer filters", () => {
  it("grup filtresi çalışır", () => {
    const filtered = filterBulkCustomers(sampleCustomers, {
      group: "Perakende",
      status: "all",
      balanceType: "all",
      search: null,
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.name, "Ayşe");
  });

  it("borçlu filtresi balance > 0 kullanır", () => {
    assert.equal(matchesBulkBalanceFilter(100, "debtor"), true);
    assert.equal(matchesBulkBalanceFilter(-50, "debtor"), false);

    const filtered = filterBulkCustomers(sampleCustomers, {
      group: null,
      status: "all",
      balanceType: "debtor",
      search: null,
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.name, "Ali");
  });

  it("alacaklı filtresi balance < 0 kullanır", () => {
    const filtered = filterBulkCustomers(sampleCustomers, {
      group: null,
      status: "all",
      balanceType: "creditor",
      search: null,
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.name, "Ayşe");
  });
});

describe("bulk copy helpers", () => {
  it("telefon kopyalama boşları atlar", () => {
    const phones = extractPhoneList(sampleCustomers);
    assert.deepEqual(phones, ["0555 111 22 33", "0532 444 55 66"]);
  });

  it("e-posta kopyalama boşları atlar", () => {
    const emails = extractEmailList(sampleCustomers);
    assert.deepEqual(emails, ["ali@test.com", "mehmet@test.com"]);
  });

  it("whatsapp linkleri üretir", () => {
    const links = formatWhatsAppLinks(["0555 111 22 33"]);
    assert.deepEqual(links, ["https://wa.me/905551112233"]);
  });
});

describe("bulk summary", () => {
  it("seçili müşteri borç/alacak özetini hesaplar", () => {
    const summary = summarizeBulkActions(sampleCustomers, ["1", "2"]);

    assert.equal(summary.selectedCustomers, 2);
    assert.equal(summary.selectedWithPhone, 1);
    assert.equal(summary.selectedWithEmail, 1);
    assert.equal(summary.totalDebt, 100);
    assert.equal(summary.totalCredit, 50);
  });
});
