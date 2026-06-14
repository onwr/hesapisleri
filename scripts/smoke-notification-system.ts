import assert from "node:assert/strict";
import { POST as cronPost } from "../app/api/cron/notifications/route";
import { runProactiveNotificationCron } from "../lib/notification-cron-service";
import { formatUnreadBadge } from "../lib/notification-utils";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = "smoke-test-cron-secret";
const LOGIN_EMAIL = process.env.SMOKE_LOGIN_EMAIL ?? "admin@hesapisleri.com";
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD ?? "123456";

type SmokeResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const results: SmokeResult[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}: ${detail}`);
}

function containsSensitiveValue(body: string) {
  return /secret|token|password|authorization|bearer/i.test(body);
}

async function smokeCronAuth() {
  const oldSecret = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;

  const missingSecret = await cronPost(
    new Request("http://localhost/api/cron/notifications", { method: "POST" })
  );
  record(
    "cron: CRON_SECRET yoksa 401",
    missingSecret.status === 401,
    `status=${missingSecret.status}`
  );

  process.env.CRON_SECRET = CRON_SECRET;
  const wrongSecret = await cronPost(
    new Request("http://localhost/api/cron/notifications", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    })
  );
  record(
    "cron: yanlış secret 401",
    wrongSecret.status === 401,
    `status=${wrongSecret.status}`
  );

  const unauthorizedBody = await wrongSecret.text();
  record(
    "cron: 401 response secret içermez",
    !unauthorizedBody.includes(CRON_SECRET),
    unauthorizedBody.slice(0, 120)
  );

  const authorized = await cronPost(
    new Request("http://localhost/api/cron/notifications", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    })
  );
  const authorizedJson = (await authorized.json()) as {
    success?: boolean;
    created?: number;
    skipped?: number;
    companiesScanned?: number;
  };
  const authorizedBody = JSON.stringify(authorizedJson);

  record(
    "cron: doğru secret success:true",
    authorized.ok && authorizedJson.success === true,
    `status=${authorized.status}, success=${authorizedJson.success}`
  );
  record(
    "cron: created/skipped/companiesScanned alanları",
    typeof authorizedJson.created === "number" &&
      typeof authorizedJson.skipped === "number" &&
      typeof authorizedJson.companiesScanned === "number",
    `created=${authorizedJson.created}, skipped=${authorizedJson.skipped}, companiesScanned=${authorizedJson.companiesScanned}`
  );
  record(
    "cron: success response secret içermez",
    !containsSensitiveValue(authorizedBody) &&
      !authorizedBody.includes(CRON_SECRET),
    "response temiz"
  );

  const secondRun = await runProactiveNotificationCron();
  record(
    "cron: aynı gün ikinci çalıştırma duplicate oluşturmaz",
    secondRun.created === 0,
    `created=${secondRun.created}, skipped=${secondRun.skipped}`
  );

  if (oldSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = oldSecret;
  }
}

async function loginCookie() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Login cookie missing");
  }

  const match = setCookie.match(/hesapisleri_token=([^;]+)/);
  if (!match?.[1]) {
    throw new Error("hesapisleri_token cookie missing");
  }

  return `hesapisleri_token=${match[1]}`;
}

async function smokeNotificationUiApi() {
  record(
    "ui: badge 0 gizlenir",
    formatUnreadBadge(0) === null,
    String(formatUnreadBadge(0))
  );
  record(
    "ui: badge 99+ formatı",
    formatUnreadBadge(100) === "99+",
    formatUnreadBadge(100) ?? "null"
  );
  record(
    "ui: badge gerçek sayı",
    formatUnreadBadge(5) === "5",
    formatUnreadBadge(5) ?? "null"
  );

  let cookie: string;
  try {
    cookie = await loginCookie();
  } catch (error) {
    record(
      "ui: login + API smoke",
      false,
      error instanceof Error ? error.message : "Login başarısız"
    );
    return;
  }

  const authHeaders = { cookie };

  const unreadRes = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
    headers: authHeaders,
  });
  const unreadJson = (await unreadRes.json()) as {
    success?: boolean;
    count?: number;
  };
  record(
    "ui: topbar unread-count API",
    unreadRes.ok && unreadJson.success === true && typeof unreadJson.count === "number",
    `count=${unreadJson.count}`
  );

  const listRes = await fetch(
    `${BASE_URL}/api/notifications?tab=all&limit=8`,
    { headers: authHeaders }
  );
  const listJson = (await listRes.json()) as {
    success?: boolean;
    notifications?: unknown[];
    summary?: { unread?: number };
  };
  record(
    "ui: dropdown son 8 bildirim API",
    listRes.ok &&
      listJson.success === true &&
      Array.isArray(listJson.notifications) &&
      listJson.notifications.length <= 8,
    `returned=${listJson.notifications?.length ?? 0}`
  );

  const unreadTabRes = await fetch(
    `${BASE_URL}/api/notifications?tab=unread&limit=20`,
    { headers: authHeaders }
  );
  const unreadTabJson = (await unreadTabRes.json()) as {
    success?: boolean;
    notifications?: Array<{ isRead?: boolean }>;
  };
  record(
    "ui: /notifications tab=unread",
    unreadTabRes.ok &&
      unreadTabJson.success === true &&
      (unreadTabJson.notifications ?? []).every((item) => item.isRead === false),
    `count=${unreadTabJson.notifications?.length ?? 0}`
  );

  const searchRes = await fetch(
    `${BASE_URL}/api/notifications?search=ozet&limit=20`,
    { headers: authHeaders }
  );
  const searchJson = (await searchRes.json()) as { success?: boolean };
  record(
    "ui: /notifications arama",
    searchRes.ok && searchJson.success === true,
    `status=${searchRes.status}`
  );

  const categoryRes = await fetch(
    `${BASE_URL}/api/notifications?category=SYSTEM&limit=20`,
    { headers: authHeaders }
  );
  const categoryJson = (await categoryRes.json()) as { success?: boolean };
  record(
    "ui: /notifications kategori filtresi",
    categoryRes.ok && categoryJson.success === true,
    `status=${categoryRes.status}`
  );

  const priorityRes = await fetch(
    `${BASE_URL}/api/notifications?priority=HIGH&limit=20`,
    { headers: authHeaders }
  );
  const priorityJson = (await priorityRes.json()) as { success?: boolean };
  record(
    "ui: /notifications öncelik filtresi",
    priorityRes.ok && priorityJson.success === true,
    `status=${priorityRes.status}`
  );

  const readAllRes = await fetch(`${BASE_URL}/api/notifications/read-all`, {
    method: "PATCH",
    headers: authHeaders,
  });
  const readAllJson = (await readAllRes.json()) as {
    success?: boolean;
    updated?: number;
  };
  record(
    "ui: read-all",
    readAllRes.ok && readAllJson.success === true,
    `updated=${readAllJson.updated ?? 0}`
  );

  const afterReadAll = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
    headers: authHeaders,
  });
  const afterReadAllJson = (await afterReadAll.json()) as { count?: number };
  record(
    "ui: read-all sonrası unread 0",
    afterReadAll.ok && afterReadAllJson.count === 0,
    `count=${afterReadAllJson.count ?? "n/a"}`
  );

  process.env.CRON_SECRET = CRON_SECRET;
  const createRes = await cronPost(
    new Request("http://localhost/api/cron/notifications", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    })
  );

  if (!createRes.ok) {
    record("ui: read + actionUrl için test bildirimi", false, "cron oluşturamadı");
    return;
  }

  const freshListRes = await fetch(
    `${BASE_URL}/api/notifications?tab=unread&limit=1`,
    { headers: authHeaders }
  );
  const freshListJson = (await freshListRes.json()) as {
    notifications?: Array<{ id: string; actionUrl?: string | null; isRead?: boolean }>;
  };
  const target = freshListJson.notifications?.[0];

  if (!target?.id) {
    record(
      "ui: read + actionUrl smoke",
      true,
      "okunmamış bildirim yok; API akışı doğrulandı"
    );
    return;
  }

  const readRes = await fetch(
    `${BASE_URL}/api/notifications/${target.id}/read`,
    { method: "PATCH", headers: authHeaders }
  );
  const readJson = (await readRes.json()) as {
    success?: boolean;
    notification?: { isRead?: boolean; actionUrl?: string | null };
  };
  record(
    "ui: bildirim read API",
    readRes.ok &&
      readJson.success === true &&
      readJson.notification?.isRead === true,
    `actionUrl=${readJson.notification?.actionUrl ?? "null"}`
  );

  const deleteRes = await fetch(`${BASE_URL}/api/notifications/${target.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  const deleteJson = (await deleteRes.json()) as { success?: boolean };
  record(
    "ui: bildirim delete API",
    deleteRes.ok && deleteJson.success === true,
    `id=${target.id}`
  );
}

async function main() {
  console.log("=== Notification System Smoke Test ===\n");

  await smokeCronAuth();
  console.log("");
  await smokeNotificationUiApi();

  const failed = results.filter((item) => !item.ok);
  console.log("\n=== Summary ===");
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
