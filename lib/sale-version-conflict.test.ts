import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Bu testler version conflict mantığını izole eder.
// Gerçek DB işlemleri olmadan sadece karar mantığını doğrular.

function checkVersionConflict(
  storedRevision: number,
  inputRevision: number | undefined
): { conflict: boolean; status?: number; message?: string } {
  if (inputRevision === undefined) {
    return { conflict: false };
  }
  if (storedRevision !== inputRevision) {
    return {
      conflict: true,
      status: 409,
      message: `SALE_VERSION_CONFLICT: Beklenen revizyon ${inputRevision}, mevcut ${storedRevision}`,
    };
  }
  return { conflict: false };
}

describe("revisionNumber — version conflict kontrolü", () => {
  it("inputRevision verilmezse conflict olmaz", () => {
    const result = checkVersionConflict(5, undefined);
    assert.equal(result.conflict, false);
  });

  it("inputRevision stored ile eşleşirse conflict olmaz", () => {
    const result = checkVersionConflict(3, 3);
    assert.equal(result.conflict, false);
  });

  it("inputRevision stored'dan farklıysa 409 conflict döner", () => {
    const result = checkVersionConflict(3, 2);
    assert.equal(result.conflict, true);
    assert.equal(result.status, 409);
    assert.match(result.message!, /SALE_VERSION_CONFLICT/);
  });

  it("stored daha yüksekse (başka kullanıcı güncelledi) conflict döner", () => {
    const result = checkVersionConflict(5, 3);
    assert.equal(result.conflict, true);
    assert.equal(result.status, 409);
  });

  it("stored 0, input 0 — yeni satışta conflict olmaz", () => {
    const result = checkVersionConflict(0, 0);
    assert.equal(result.conflict, false);
  });
});

// revisionNumber artış simülasyonu
describe("revisionNumber — artış mantığı", () => {
  it("her başarılı güncellemede 1 artar", () => {
    let storedRevision = 0;
    const simulateUpdate = (inputRevision: number) => {
      if (storedRevision !== inputRevision) return false;
      storedRevision += 1;
      return true;
    };

    assert.equal(simulateUpdate(0), true);
    assert.equal(storedRevision, 1);

    assert.equal(simulateUpdate(1), true);
    assert.equal(storedRevision, 2);

    // Eski revizyon ile güncelleme girişimi başarısız olur
    assert.equal(simulateUpdate(1), false);
    assert.equal(storedRevision, 2);
  });

  it("paralel düzenleme yarış koşulunda sadece biri kazanır", () => {
    let storedRevision = 3;

    // İki kullanıcı aynı anda revizyon 3 ile gelir
    const userA = () => {
      if (storedRevision !== 3) return false;
      storedRevision += 1;
      return true;
    };
    const userB = () => {
      if (storedRevision !== 3) return false;
      storedRevision += 1;
      return true;
    };

    // Sadece biri kazanır — önce gelen A
    assert.equal(userA(), true);
    assert.equal(storedRevision, 4);

    // B artık eski revizyon ile geldiği için kaybeder
    assert.equal(userB(), false);
    assert.equal(storedRevision, 4);
  });
});
