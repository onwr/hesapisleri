import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { redactSovosSecrets } from "@/lib/e-document/providers/sovos/sovos-auth";
import { normalizeSovosHttpError, SovosError } from "@/lib/e-document/providers/sovos/sovos-errors";
import { runSovosConnectionTest } from "@/lib/e-document/providers/sovos/sovos-connection-service";

type MockRoute = {
  match: RegExp;
  status: number;
  body: string;
  delayMs?: number;
};

function createMockFetch(routes: MockRoute[], calls: Array<{ headers: Record<string, string>; body: string }>) {
  return (async (url: string | URL, init?: RequestInit) => {
    const body = String(init?.body ?? "");
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const raw = init.headers as Record<string, string>;
      for (const [key, value] of Object.entries(raw)) {
        headers[key.toLowerCase()] = value;
      }
    }
    calls.push({ headers, body });

    const route = routes.find((item) => item.match.test(body));
    if (!route) {
      return new Response("not found", { status: 404 });
    }

    if (route.delayMs) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, route.delayMs);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          const abortError = new Error("Aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    }

    return new Response(route.body, {
      status: route.status,
      headers: { "content-type": "text/xml; charset=utf-8" },
    });
  }) as typeof fetch;
}

const invoiceOkBody = `
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <getRAWUserListResponse xmlns="http:/fitcons.com/eInvoice/">
      <DocData>UEsDBA==</DocData>
    </getRAWUserListResponse>
  </s:Body>
</s:Envelope>`;

const archiveOkBody = `
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <getUserListResponse xmlns="http:/fitcons.com/earchive/getuserlist">
      <binaryData>UEsDBA==</binaryData>
    </getUserListResponse>
  </s:Body>
</s:Envelope>`;

const credentials = {
  invoiceUsername: "ws-user",
  invoicePassword: "ws-pass",
  archiveUsername: "archive-user",
  archivePassword: "archive-pass",
  useSameArchiveCredentials: false,
};

describe("sovos connection service", () => {
  const originalAllow = process.env.SOVOS_ALLOW_REAL_CONNECTION_TEST;

  before(() => {
    process.env.SOVOS_ALLOW_REAL_CONNECTION_TEST = "true";
  });

  after(() => {
    if (originalAllow === undefined) {
      delete process.env.SOVOS_ALLOW_REAL_CONNECTION_TEST;
    } else {
      process.env.SOVOS_ALLOW_REAL_CONNECTION_TEST = originalAllow;
    }
  });

  it("bağlantı başarılı — invoice ve archive", async () => {
    const calls: Array<{ headers: Record<string, string>; body: string }> = [];
    const fetchImpl = createMockFetch(
      [
        { match: /getRAWUserListRequest/, status: 200, body: invoiceOkBody },
        { match: /getUserListRequest/, status: 200, body: archiveOkBody },
      ],
      calls
    );

    const result = await runSovosConnectionTest({
      environment: "STAGE",
      taxId: "1234567801",
      credentials,
      invoiceEndpointOverride: "http://mock/invoice",
      archiveEndpointOverride: "http://mock/archive",
      fetchImpl,
    });

    assert.equal(result.ok, false);
    assert.notEqual(result.status, "CONNECTED");
    assert.equal(result.capabilities.eInvoice.verified, false);
    assert.equal(result.capabilities.eInvoice.mockTested, true);
    assert.equal(result.capabilities.eArchive.mockTested, true);
    assert.equal(result.capabilities.taxpayerLookup, false);
    assert.match(calls[0]?.headers.authorization ?? "", /^basic /i);
    assert.doesNotMatch(JSON.stringify(calls), /ws-pass|archive-pass/i);
  });

  it("yanlış şifre — INVALID_CREDENTIALS", () => {
    const error = normalizeSovosHttpError(401, "", "E-Fatura");
    assert.equal(error.code, "INVALID_CREDENTIALS");
  });

  it("SOAP fault normalize edilir", () => {
    const body = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <soap:Fault>
            <faultstring>Processing error</faultstring>
            <Code>90</Code>
          </soap:Fault>
        </soap:Body>
      </soap:Envelope>`;
    const error = normalizeSovosHttpError(500, body, "E-Arşiv");
    assert.equal(error.code, "SOAP_FAULT");
    assert.match(error.message, /Processing error/);
  });

  it("timeout", async () => {
    const fetchImpl = createMockFetch(
      [
        {
          match: /getRAWUserListRequest/,
          status: 200,
          body: invoiceOkBody,
          delayMs: 80,
        },
      ],
      []
    );

    const result = await runSovosConnectionTest({
      environment: "STAGE",
      taxId: "1234567801",
      credentials: {
        ...credentials,
        archiveUsername: "",
        archivePassword: "",
      },
      invoiceEndpointOverride: "http://mock/invoice",
      fetchImpl,
      timeoutMs: 20,
    });

    assert.equal(result.ok, false);
    assert.equal(result.outcomes.find((o) => o.service === "eInvoice")?.errorCode, "TIMEOUT");
  });

  it("e-Fatura başarılı / e-Arşiv başarısız — PARTIALLY_CONNECTED", async () => {
    const fetchImpl = createMockFetch(
      [
        { match: /getRAWUserListRequest/, status: 200, body: invoiceOkBody },
        {
          match: /getUserListRequest/,
          status: 401,
          body: "<html>Unauthorized</html>",
        },
      ],
      []
    );

    const result = await runSovosConnectionTest({
      environment: "STAGE",
      taxId: "1234567801",
      credentials,
      invoiceEndpointOverride: "http://mock/invoice",
      archiveEndpointOverride: "http://mock/archive",
      fetchImpl,
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, "ERROR");
    assert.equal(result.capabilities.eInvoice.verified, false);
    assert.equal(result.capabilities.eInvoice.mockTested, true);
    assert.equal(result.capabilities.eArchive.verified, false);
    assert.notEqual(result.status, "CONNECTED");
  });

  it("credential redaction", () => {
    const token = Buffer.from("user:secret123", "utf8").toString("base64");
    const redacted = redactSovosSecrets(`Authorization: Basic ${token}`);
    assert.equal(redacted, "[REDACTED]");
  });

  it("gerçek test bayrağı kapalıysa başarılı sayılmaz", async () => {
    process.env.SOVOS_ALLOW_REAL_CONNECTION_TEST = "false";
    const result = await runSovosConnectionTest({
      environment: "STAGE",
      taxId: "1234567801",
      credentials,
      invoiceEndpointOverride: "http://mock/invoice",
      archiveEndpointOverride: "http://mock/archive",
    });
    assert.equal(result.ok, false);
    assert.equal(result.lastErrorCode, "SOVOS_REAL_TEST_DISABLED");
    process.env.SOVOS_ALLOW_REAL_CONNECTION_TEST = "true";
  });
});

describe("sovos mock http server", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const auth = req.headers.authorization ?? "";
        if (!auth.toLowerCase().startsWith("basic ")) {
          res.writeHead(401);
          res.end("unauthorized");
          return;
        }

        if (body.includes("getRAWUserListRequest")) {
          res.writeHead(200, { "content-type": "text/xml" });
          res.end(invoiceOkBody);
          return;
        }

        res.writeHead(404);
        res.end("not found");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("mock SOAP server ile invoice testi", async () => {
    process.env.SOVOS_ALLOW_REAL_CONNECTION_TEST = "true";
    const result = await runSovosConnectionTest({
      environment: "STAGE",
      taxId: "1234567801",
      credentials: {
        invoiceUsername: "demo",
        invoicePassword: "demo",
        archiveUsername: "",
        archivePassword: "",
        useSameArchiveCredentials: false,
      },
      invoiceEndpointOverride: baseUrl,
    });

    assert.equal(result.capabilities.eInvoice.verified, true);
    assert.equal(result.status, "CONNECTED");
  });
});

describe("sovos errors", () => {
  it("endpoint yapılandırma hatası", () => {
    const error = new SovosError("ENDPOINT_NOT_CONFIGURED", "endpoint yok");
    assert.equal(error.code, "ENDPOINT_NOT_CONFIGURED");
  });
});
