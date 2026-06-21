import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("dashboard notifications panel", () => {
  it("uses existing notification read endpoints", () => {
    const source = read("components/dashboard/dashboard-notifications-panel.tsx");
    assert.match(source, /\/api\/notifications\/\$\{id\}\/read/);
    assert.match(source, /\/api\/notifications\/read-all/);
  });

  it("does not create a new notification model", () => {
    const schema = read("prisma/schema.prisma");
    assert.doesNotMatch(schema, /Notification2|DashboardAlert/);
  });

  it("dashboard action query is company scoped in service", () => {
    const source = read("lib/notification-service.ts");
    assert.match(source, /getDashboardActionNotifications/);
    assert.match(source, /baseCompanyScope\(input\.companyId, input\.userId\)/);
  });
});
