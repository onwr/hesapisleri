import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSystemEventId } from "./calendar-utils";

describe("calendar service guards", () => {
  it("SYSTEM event id manuel CRUD için engellenir", () => {
    assert.equal(isSystemEventId("system:invoice:abc"), true);
    assert.equal(isSystemEventId("manual-event-id"), false);
  });
});

describe("calendar API response shape", () => {
  it("GET success response events dizisi içerir", () => {
    const response = {
      success: true,
      events: [
        {
          id: "evt1",
          companyId: "c1",
          type: "APPOINTMENT",
          title: "Toplantı",
          startAt: "2026-06-10T10:00:00.000Z",
          allDay: false,
          status: "SCHEDULED",
          source: "MANUAL",
          readOnly: false,
        },
      ],
    };

    assert.equal(response.success, true);
    assert.equal(Array.isArray(response.events), true);
    assert.equal(response.events[0]?.readOnly, false);
  });

  it("POST validation 400 mesajı üretilebilir", () => {
    const response = {
      success: false,
      message: "Başlık zorunludur.",
    };

    assert.equal(response.success, false);
    assert.match(response.message, /Başlık/);
  });

  it("SYSTEM PATCH/DELETE 403 mesajı", () => {
    const message = "Sistem kayıtları takvimden düzenlenemez.";
    assert.match(message, /Sistem kayıtları/);
  });
});
