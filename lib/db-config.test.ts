import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  DB_UNAVAILABLE_MESSAGE,
  isPoolerDatabaseUrl,
  isPrismaConnectionError,
  mapDbErrorToApiResponse,
  resolveHealthCheckSecret,
} from "./db-config";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("db config", () => {
  it("connection error kodlarını tanır", () => {
    assert.equal(isPrismaConnectionError({ code: "P2024" }), true);
    assert.equal(isPrismaConnectionError({ code: "P1001" }), true);
    assert.equal(isPrismaConnectionError({ code: "P2002" }), false);
    assert.equal(
      isPrismaConnectionError(new Error("Connection pool timeout")),
      true
    );
  });

  it("connection error için kullanıcı dostu API yanıtı üretir", () => {
    const mapped = mapDbErrorToApiResponse({ code: "P2024" });
    assert.ok(mapped);
    assert.equal(mapped?.message, DB_UNAVAILABLE_MESSAGE);
    assert.equal(mapped?.status, 503);
    assert.equal(mapDbErrorToApiResponse({ code: "P2002" }), null);
  });

  it("pooler URL desenlerini tanır", () => {
    assert.equal(
      isPoolerDatabaseUrl(
        "postgresql://user:pass@aws-0-eu.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
      ),
      true
    );
    assert.equal(
      isPoolerDatabaseUrl("postgresql://user:pass@localhost:5432/hesapisleri"),
      false
    );
  });

  it("health secret DB_HEALTH_SECRET veya CRON_SECRET kullanır", () => {
    const oldHealth = process.env.DB_HEALTH_SECRET;
    const oldCron = process.env.CRON_SECRET;

    process.env.DB_HEALTH_SECRET = "health-token";
    process.env.CRON_SECRET = "cron-token";
    assert.equal(resolveHealthCheckSecret(), "health-token");

    delete process.env.DB_HEALTH_SECRET;
    assert.equal(resolveHealthCheckSecret(), "cron-token");

    delete process.env.CRON_SECRET;
    assert.equal(resolveHealthCheckSecret(), null);

    process.env.DB_HEALTH_SECRET = oldHealth;
    process.env.CRON_SECRET = oldCron;
  });
});

describe("prisma singleton", () => {
  it("lib/prisma.ts global cache kullanır", () => {
    const source = read("lib/prisma.ts");
    assert.match(source, /globalForPrisma\.prisma/);
    assert.match(source, /globalForPrisma\.prisma = client/);
    assert.doesNotMatch(source, /NODE_ENV !== "production"/);
  });

  it("API route içinde new PrismaClient bulunmaz", () => {
    const apiDir = path.join(__dirname, "..", "app", "api");
    const files = walkTsFiles(apiDir);
    const offenders = files.filter((file) => {
      const content = fs.readFileSync(file, "utf8");
      return /new PrismaClient\s*\(/.test(content);
    });

    assert.deepEqual(offenders, []);
  });

  it("schema directUrl destekler", () => {
    const schema = read("prisma/schema.prisma");
    assert.match(schema, /directUrl\s*=\s*env\("DIRECT_URL"\)/);
  });

  it(".env.example DATABASE_URL ve DIRECT_URL içerir", () => {
    const envExample = read(".env.example");
    assert.match(envExample, /DATABASE_URL=/);
    assert.match(envExample, /DIRECT_URL=/);
    assert.match(envExample, /connection_limit/);
    assert.match(envExample, /pooler\.supabase\.com/);
  });
});

function walkTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkTsFiles(fullPath);
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      return [fullPath];
    }
    return [];
  });
}
