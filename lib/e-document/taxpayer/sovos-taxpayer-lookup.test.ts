import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  filterGibUserAliasesByTaxId,
  getPartialUserListFiltersSingleTaxId,
  SOVOS_TAXPAYER_LOOKUP_METHOD,
  SOVOS_TAXPAYER_SYNC_OPERATION,
} from "@/lib/e-document/taxpayer/gib-user-list-parser";
import { extractXmlFromUserListZip } from "@/lib/e-document/taxpayer/gib-user-list-zip";
import AdmZip from "adm-zip";
import { validateUblInvoiceXml } from "@/lib/e-document/ubl-tr/ubl-xsd-validator";

describe("sovos taxpayer contract", () => {
  it("getPartialUserList tek VKN filtresi yapmaz", () => {
    assert.equal(getPartialUserListFiltersSingleTaxId(), false);
    assert.equal(SOVOS_TAXPAYER_SYNC_OPERATION, "getRAWUserList");
    assert.equal(SOVOS_TAXPAYER_LOOKUP_METHOD, "local-cache");
  });

  it("mükellef listesi zip içinden taxId ile filtreler", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UserList>
  <User>
    <Identifier>urn:mail:pk1@test.com</Identifier>
    <Type>PK</Type>
    <Title>Test AŞ</Title>
    <VKN_TCKN>1234567890</VKN_TCKN>
  </User>
  <User>
    <Identifier>urn:mail:pk2@test.com</Identifier>
    <Type>PK</Type>
    <Title>Diğer</Title>
    <VKN_TCKN>9999999999</VKN_TCKN>
  </User>
</UserList>`;

    const zip = new AdmZip();
    zip.addFile("users.xml", Buffer.from(xml, "utf8"));
    const parts = extractXmlFromUserListZip(zip.toBuffer());
    const aliases = filterGibUserAliasesByTaxId(parts, "1234567890");
    assert.equal(aliases.length, 1);
    assert.equal(aliases[0]?.alias, "urn:mail:pk1@test.com");
  });
});

describe("ubl-tr xsd engine", () => {
  it("resmi GİB örnek faturayı doğrular", () => {
    const samplePath = path.join(
      process.cwd(),
      "docs",
      "private",
      "sovos",
      "ubl-tr-extract",
      "UBLTR_1.2.1_Paketi",
      "xml",
      "TemelFaturaOrnegi.xml"
    );
    if (!fs.existsSync(samplePath)) {
      return;
    }
    const xml = fs.readFileSync(samplePath, "utf8");
    const result = validateUblInvoiceXml(xml, { profile: "signed" });
    assert.equal(result.schemaLoaded, true);
    assert.equal(result.ok, true, result.issues[0]?.message);
  });
});
